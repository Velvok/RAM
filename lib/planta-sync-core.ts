// Formato de las operaciones que la tablet de planta guarda en local y envía
// al servidor (también tras horas sin conexión). Lógica pura, sin BD, para
// poder probarla y para usarla igual en el navegador y en el servidor.

export const PLANTA_OP_VERSION = 1

export type PlantaOpKind = 'cut' | 'prepare' | 'confirm_pickup' | 'change_sheet' | 'note' | 'note_read'

export interface PlantaOpPayloads {
  cut: { cutOrderId: string; selectedMaterialId: string; materialLength: number; quantity: number }
  prepare: { itemId: string; quantity: number }
  confirm_pickup: { cutOrderId: string }
  change_sheet: { cutOrderId: string; inventoryId: string; productId: string; size: number; quantity: number }
  note: { content: string }
  note_read: { noteId: string; operatorName: string }
}

export interface PlantaOp<K extends PlantaOpKind = PlantaOpKind> {
  v: number
  opId: string
  kind: K
  orderId: string
  payload: PlantaOpPayloads[K]
  /** Hora real en la tablet (ISO) */
  occurredAt: string
  /** Texto para enseñar al operario y al admin ("Corte 2 × AC25110.4,5") */
  label: string
}

export type PlantaOpResult =
  | { opId: string; status: 'applied'; message?: string }
  | { opId: string; status: 'rejected'; message: string }
  | { opId: string; status: 'retry'; message: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 100000
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1000

/** Valida y normaliza una operación recibida. Devuelve el motivo si no vale. */
export function parsePlantaOp(raw: unknown, now = Date.now()): { ok: true; op: PlantaOp } | { ok: false; reason: string; opId?: string } {
  const r = raw as any
  const opId = isUuid(r?.opId) ? r.opId : undefined
  if (!r || typeof r !== 'object') return { ok: false, reason: 'Operación vacía' }
  if (!opId) return { ok: false, reason: 'Operación sin identificador' }
  if (r.v !== PLANTA_OP_VERSION) return { ok: false, reason: `Versión de operación no soportada (${r.v})`, opId }
  if (!isUuid(r.orderId)) return { ok: false, reason: 'Pedido no válido', opId }
  const t = Date.parse(r.occurredAt)
  // Sin conexión puede pasar un día (o un fin de semana); más de 7 días o del futuro es un reloj mal puesto
  if (!Number.isFinite(t) || t > now + 10 * 60 * 1000 || t < now - 7 * 24 * 3600 * 1000) return { ok: false, reason: 'Hora de la operación fuera de rango', opId }
  const label = typeof r.label === 'string' ? r.label.slice(0, 200) : ''
  const p = r.payload || {}
  let payload: any
  switch (r.kind) {
    case 'cut':
      if (!isUuid(p.cutOrderId) || !isUuid(p.selectedMaterialId) || !isNum(p.materialLength) || !isPosInt(p.quantity)) return { ok: false, reason: 'Corte con datos incompletos', opId }
      payload = { cutOrderId: p.cutOrderId, selectedMaterialId: p.selectedMaterialId, materialLength: p.materialLength, quantity: p.quantity }
      break
    case 'prepare':
      if (!isUuid(p.itemId) || !isPosInt(p.quantity)) return { ok: false, reason: 'Preparación con datos incompletos', opId }
      payload = { itemId: p.itemId, quantity: p.quantity }
      break
    case 'confirm_pickup':
      if (!isUuid(p.cutOrderId)) return { ok: false, reason: 'Recogida con datos incompletos', opId }
      payload = { cutOrderId: p.cutOrderId }
      break
    case 'change_sheet':
      if (!isUuid(p.cutOrderId) || !isUuid(p.inventoryId) || !isUuid(p.productId) || !isNum(p.size) || !isPosInt(p.quantity)) return { ok: false, reason: 'Cambio de chapa con datos incompletos', opId }
      payload = { cutOrderId: p.cutOrderId, inventoryId: p.inventoryId, productId: p.productId, size: p.size, quantity: p.quantity }
      break
    case 'note': {
      const content = typeof p.content === 'string' ? p.content.trim().slice(0, 500) : ''
      if (!content) return { ok: false, reason: 'Nota vacía', opId }
      payload = { content }
      break
    }
    case 'note_read':
      if (!isUuid(p.noteId)) return { ok: false, reason: 'Nota no válida', opId }
      payload = { noteId: p.noteId, operatorName: typeof p.operatorName === 'string' ? p.operatorName.slice(0, 120) : '' }
      break
    default:
      return { ok: false, reason: `Tipo de operación desconocido (${String(r.kind)})`, opId }
  }
  return { ok: true, op: { v: PLANTA_OP_VERSION, opId, kind: r.kind, orderId: r.orderId, payload, occurredAt: new Date(t).toISOString(), label } }
}

/**
 * Cuánto se puede aplicar de un corte o preparación que llega tarde: si en
 * el servidor ya se hizo parte (otra tablet, o el admin), se registra solo lo
 * que falta y se avisa del exceso; si ya no falta nada, se rechaza.
 */
export function clampQuantity(requested: number, alreadyDone: number, wanted: number): { apply: number; excess: number } {
  const remaining = Math.max(0, Number(requested || 0) - Number(alreadyDone || 0))
  const apply = Math.min(Math.max(0, wanted), remaining)
  return { apply, excess: Math.max(0, wanted - apply) }
}
