'use client'

// Planta sin conexión, lado tablet.
//
// - Foto local (IndexedDB) de la lista de pedidos, de cada pedido, sus notas,
//   su actividad y el stock que se puede usar, para seguir trabajando sin red.
// - Cola local de acciones (cortes, preparaciones, recogidas, cambios de
//   chapa, notas). Cada una con un opId único y la hora real.
// - Envío en orden a /api/planta/sync en cuanto hay conexión. El servidor no
//   aplica dos veces el mismo opId, así que reintentar siempre es seguro.
// - Latido cada 30 s para que el admin sepa si la tablet está conectada y
//   cuántas acciones tiene guardadas sin enviar.

import { reportPossibleStaleDeploy } from '@/lib/stale-deploy'
import { PLANTA_OP_VERSION, type PlantaOp, type PlantaOpKind, type PlantaOpPayloads, type PlantaOpResult } from '@/lib/planta-sync-core'

const DB_NAME = 'ram-planta'
const DB_VERSION = 1
const SYNC_URL = '/api/planta/sync'
const HEARTBEAT_MS = 30 * 1000
const BATCH = 20

export interface QueuedOp extends PlantaOp { seq: number }
export interface SyncNotice { opId: string; label: string; orderId: string; message: string; occurredAt: string; at: string; kind: 'rejected' | 'partial' }
export interface SyncState {
  online: boolean
  syncing: boolean
  pending: number
  oldestPendingAt: string | null
  lastSyncAt: string | null
  lastSentCount: number
  sessionExpired: boolean
  notices: SyncNotice[]
}

// ---------- IndexedDB mínima ----------

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv')
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'opId' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode)
    const r = fn(t.objectStore(store))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }))
}
const kvGet = <T,>(key: string) => tx<T | undefined>('kv', 'readonly', s => s.get(key) as IDBRequest<T | undefined>).catch(() => undefined)
const kvSet = (key: string, value: unknown) => tx('kv', 'readwrite', s => s.put(value, key)).catch(() => undefined)

// ---------- Fotos locales ----------

export interface Snapshot<T> { data: T; savedAt: string }
export async function saveSnapshot<T>(key: string, data: T) { await kvSet(`snap:${key}`, { data, savedAt: new Date().toISOString() }) }
export async function readSnapshot<T>(key: string): Promise<Snapshot<T> | undefined> { return kvGet<Snapshot<T>>(`snap:${key}`) }

// ---------- Estado y suscripción ----------

let state: SyncState = { online: typeof navigator === 'undefined' ? true : navigator.onLine, syncing: false, pending: 0, oldestPendingAt: null, lastSyncAt: null, lastSentCount: 0, sessionExpired: false, notices: [] }
const listeners = new Set<(s: SyncState) => void>()
function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l(state))
}
export function getSyncState() { return state }
export function subscribeSync(fn: (s: SyncState) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

export function deviceId(): string {
  try {
    let id = localStorage.getItem('ram-device-id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ram-device-id', id) }
    return id
  } catch {
    return 'sin-almacenamiento-local'
  }
}

// ---------- Cola ----------

export async function listOutbox(): Promise<QueuedOp[]> {
  const all = await tx<QueuedOp[]>('outbox', 'readonly', s => s.getAll() as IDBRequest<QueuedOp[]>).catch(() => [] as QueuedOp[])
  return all.sort((a, b) => a.seq - b.seq)
}
async function refreshCounts() {
  const ops = await listOutbox()
  setState({ pending: ops.length, oldestPendingAt: ops[0]?.occurredAt ?? null })
  return ops
}

/** Guarda una acción en la tablet y la intenta enviar ya. */
export async function enqueue<K extends PlantaOpKind>(kind: K, orderId: string, payload: PlantaOpPayloads[K], label: string): Promise<QueuedOp> {
  const op: QueuedOp = { v: PLANTA_OP_VERSION, opId: crypto.randomUUID(), kind, orderId, payload, occurredAt: new Date().toISOString(), label, seq: Date.now() * 1000 + Math.floor(Math.random() * 1000) }
  await tx('outbox', 'readwrite', s => s.put(op))
  await refreshCounts()
  void flush()
  return op
}

/** Acciones aún sin enviar de un pedido (para pintarlas encima de los datos del servidor). */
export async function pendingFor(orderId: string): Promise<QueuedOp[]> {
  return (await listOutbox()).filter(o => o.orderId === orderId)
}

// ---------- Avisos para el operario ----------

async function loadNotices() {
  const notices = (await kvGet<SyncNotice[]>('notices')) || []
  setState({ notices })
}
async function addNotices(items: SyncNotice[]) {
  if (!items.length) return
  const notices = [...items, ...((await kvGet<SyncNotice[]>('notices')) || [])].slice(0, 50)
  await kvSet('notices', notices)
  setState({ notices })
}
export async function dismissNotice(opId: string) {
  const notices = ((await kvGet<SyncNotice[]>('notices')) || []).filter(n => n.opId !== opId)
  await kvSet('notices', notices)
  setState({ notices })
}

// ---------- Envío ----------

let flushing: Promise<void> | null = null
export function flush(): Promise<void> {
  if (!flushing) flushing = doFlush().finally(() => { flushing = null })
  return flushing
}

async function post(ops: QueuedOp[], all: QueuedOp[]) {
  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({
      deviceId: deviceId(),
      ops: ops.map(({ seq: _s, ...o }) => o),
      pending: all.length,
      oldestPendingAt: all[0]?.occurredAt ?? null,
      pendingOrderIds: [...new Set(all.map(o => o.orderId))],
    }),
  })
  if (res.status === 401) { setState({ sessionExpired: true }); throw new Error('session') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  setState({ sessionExpired: false })
  return (await res.json()) as { results: PlantaOpResult[] }
}

async function doFlush() {
  let ops = await refreshCounts()
  if (typeof navigator !== 'undefined' && !navigator.onLine) { setState({ online: false }); return }
  setState({ syncing: ops.length > 0 })
  let sent = 0
  try {
    // Sin acciones: solo latido
    if (!ops.length) {
      await post([], [])
      setState({ online: true })
      return
    }
    while (ops.length) {
      const batch = ops.slice(0, BATCH)
      const { results } = await post(batch, ops)
      setState({ online: true })
      const notices: SyncNotice[] = []
      let progressed = false
      for (const r of results) {
        const op = batch.find(o => o.opId === r.opId)
        if (!op || r.status === 'retry') continue
        await tx('outbox', 'readwrite', s => s.delete(r.opId))
        progressed = true
        sent++
        if (r.status === 'rejected' || r.message) {
          notices.push({ opId: op.opId, label: op.label, orderId: op.orderId, message: r.message || '', occurredAt: op.occurredAt, at: new Date().toISOString(), kind: r.status === 'rejected' ? 'rejected' : 'partial' })
        }
      }
      // Operaciones que el servidor no reconoce (formato roto): se quitan para no bloquear la cola
      for (const op of batch) {
        if (!results.some(r => r.opId === op.opId)) {
          await tx('outbox', 'readwrite', s => s.delete(op.opId))
          notices.push({ opId: op.opId, label: op.label, orderId: op.orderId, message: 'El servidor no aceptó esta acción', occurredAt: op.occurredAt, at: new Date().toISOString(), kind: 'rejected' })
          progressed = true
        }
      }
      await addNotices(notices)
      ops = await refreshCounts()
      if (!progressed) break
    }
    setState({ lastSyncAt: new Date().toISOString(), lastSentCount: sent })
  } catch (e: any) {
    if (e?.message !== 'session') setState({ online: false })
  } finally {
    setState({ syncing: false })
    await refreshCounts()
  }
}

// ---------- Arranque ----------

let started = false
/** Arranca latido y envíos automáticos. Idempotente. */
export function startPlantaSync() {
  if (started || typeof window === 'undefined') return
  started = true
  void loadNotices()
  void refreshCounts().then(() => flush())
  window.addEventListener('online', () => { setState({ online: true }); void flush() })
  window.addEventListener('offline', () => setState({ online: false }))
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void flush() })
  setInterval(() => { if (!document.hidden) void flush() }, HEARTBEAT_MS)
  // Pedir al navegador que no borre la base local si le falta espacio
  try { void navigator.storage?.persist?.() } catch {}
}

/** Lee del servidor y guarda la foto; sin conexión devuelve la última foto. */
export async function fetchWithSnapshot<T>(key: string, load: () => Promise<T>): Promise<{ data: T; savedAt: string; fromCache: boolean } | null> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline')
    const data = await load()
    await saveSnapshot(key, data)
    setState({ online: true })
    return { data, savedAt: new Date().toISOString(), fromCache: false }
  } catch (e) {
    // Solo es «sin conexión» si falla la red; un error del servidor no lo es
    const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || (e as any)?.message === 'offline' || e instanceof TypeError
    if (offline) setState({ online: false })
    else reportPossibleStaleDeploy(e)
    const snap = await readSnapshot<T>(key)
    if (snap) return { data: snap.data, savedAt: snap.savedAt, fromCache: true }
    throw e
  }
}
