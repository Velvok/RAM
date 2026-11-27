'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { enqueue, fetchWithSnapshot, pendingFor, readSnapshot, type QueuedOp } from '@/lib/planta-offline/store'
import { applyPendingToNotes, applyPendingToOrder } from '@/lib/planta-offline/apply'
import { PlantaOfflineBanner, PlantaRefreshButton, PlantaSyncBadge, useSyncState } from '@/components/planta/sync-status'
import { BigButton, Label, P, PlantaHeader, PlantaStepper } from './planta-ui'
import { cutCardState, cutPlan, formatMeters, productLength, sortByRemnant, type CutCardState } from '@/lib/planta-tasks'
import { extractSizeFromCode } from '@/lib/product-utils'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'
import { userMessage } from '@/lib/user-error'
import { cutOutcome, describeLeftovers, sheetsFor } from '@/lib/sheet-plan'
import { SheetMini, SheetPlan } from '@/components/sheet-bar'
import { descriptionsByProduct } from '@/lib/line-description'

const STATE_RANK: Record<CutCardState, number> = { confirmar_recogida: 0, cortando: 1, por_empezar: 2, sin_chapa: 3, terminada: 4 }

const STATE_LABEL: Record<CutCardState, { text: string; tone: 'amber' | 'green' | 'blue' | 'muted' }> = {
  cortando: { text: 'Cortando', tone: 'amber' },
  por_empezar: { text: 'Por empezar', tone: 'amber' },
  sin_chapa: { text: 'Sin chapa asignada', tone: 'muted' },
  confirmar_recogida: { text: 'Reasignación', tone: 'amber' },
  terminada: { text: 'Terminada', tone: 'green' },
}

type Done = { title: string; lines: string[] }

const n = (v: unknown) => Number(v) || 0
/** ¿Los datos nuevos son iguales a los que ya se ven? Entonces no se repinta nada. */
const same = (a: unknown, b: unknown) => { try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false } }

const TZ = 'America/Argentina/Buenos_Aires'
/** Hora de Argentina; si no es de hoy (en Argentina), con el día delante: «23/11 19:00». */
function hora(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const day = (x: Date) => x.toLocaleDateString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
  return day(d) === day(new Date()) ? time : `${d.toLocaleDateString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit' })} ${time}`
}


// Detalle de pedido de planta. Funciona con y sin conexión: lee del servidor
// (y guarda la foto en la tablet) o, sin red, de la última foto; cada acción
// se guarda en la cola de la tablet y se envía en cuanto hay conexión.
export function PedidoDetalle({ pedidoId, onBack }: { pedidoId: string; onBack: () => void }) {
  const router = useRouter()
  const sync = useSyncState()

  const [operator, setOperator] = useState<any>(null)
  const [base, setBase] = useState<any>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [pendingOps, setPendingOps] = useState<QueuedOp[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCutId, setActiveCutId] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [stockByCut, setStockByCut] = useState<Record<string, any[]>>({})
  const [changeFor, setChangeFor] = useState<any | null>(null)
  const [changeRow, setChangeRow] = useState<any | null>(null)
  const [changeQty, setChangeQty] = useState(1)
  const [done, setDone] = useState<Done | null>(null)
  const [rawNotes, setRawNotes] = useState<any[]>([])
  const [activity, setActivity] = useState<{ activity: any[]; evo: { pending: number; failed: number } }>({ activity: [], evo: { pending: 0, failed: 0 } })

  // Lo que el operario ya hizo y aún no ha llegado al servidor, pintado encima
  const pedido = useMemo(() => (base ? applyPendingToOrder(base, pendingOps) : null), [base, pendingOps])
  // Descripción de EVO de cada artículo (trae las unidades); si no llega, el nombre del catálogo
  const evoNames = useMemo(() => descriptionsByProduct(pedido?.order_lines), [pedido])
  const notes = useMemo(() => applyPendingToNotes(rawNotes, pendingOps, pedidoId, operator?.full_name || ''), [rawNotes, pendingOps, pedidoId, operator])

  const refreshPending = useCallback(async () => setPendingOps(await pendingFor(pedidoId)), [pedidoId])

  const loadPedido = useCallback(async () => {
    const { getOrderById } = await import('@/app/actions/client-queries')
    const r = await fetchWithSnapshot(`order:${pedidoId}`, () => getOrderById(pedidoId))
    if (r) { setBase((prev: any) => same(prev, r.data) ? prev : r.data); setSavedAt(r.savedAt); setFromCache(r.fromCache) }
    return r?.data
  }, [pedidoId])

  const loadNotes = useCallback(async () => {
    try {
      const { getOrderNotes } = await import('@/app/actions/order-notes')
      const r = await fetchWithSnapshot(`notes:${pedidoId}`, () => getOrderNotes(pedidoId))
      if (r) setRawNotes(prev => same(prev, r.data) ? prev : r.data)
    } catch (e) {
      console.error('Error cargando notas:', e)
    }
  }, [pedidoId])

  const loadActivity = useCallback(async () => {
    try {
      const { getPlantaOrderActivity } = await import('@/app/actions/client-queries')
      const r = await fetchWithSnapshot(`activity:${pedidoId}`, () => getPlantaOrderActivity(pedidoId))
      if (r) setActivity(prev => same(prev, r.data) ? prev : r.data)
    } catch (e) {
      console.error('Error cargando actividad:', e)
    }
  }, [pedidoId])

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    // Primero lo guardado en la tablet (al instante) y después lo del servidor
    let fresh = false
    readSnapshot<any>(`order:${pedidoId}`).then(s => { if (s && !fresh) { setBase((prev: any) => prev ?? s.data); setLoading(false) } })
    readSnapshot<any[]>(`notes:${pedidoId}`).then(s => { if (s && !fresh) setRawNotes(prev => prev.length ? prev : s.data) })
    loadPedido().catch(e => console.error('Error cargando pedido:', e)).finally(() => { fresh = true; setLoading(false) })
    loadNotes()
    loadActivity()
    refreshPending()
  }, [router, loadPedido, loadNotes, loadActivity, refreshPending])

  // La cola cambia (se guarda o se envía algo): repintar lo pendiente
  useEffect(() => { refreshPending() }, [sync.pending, refreshPending])
  // Tras enviar, traer el estado real del servidor
  useEffect(() => {
    // El stock no se vacía con el selector de chapas abierto: se quedaría sin opciones a media elección
    if (sync.lastSyncAt && sync.online) { loadPedido().catch(() => {}); loadNotes(); loadActivity(); if (!changeFor) setStockByCut({}) }
  }, [sync.lastSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambios desde admin (asignaciones, notas, reasignaciones) sin recargar la página
  useAutoRefresh(pedidoId, loadPedido, { enabled: true, interval: 10, onChange: () => {} })
  useEffect(() => {
    let running = false
    const interval = setInterval(() => {
      if (document.hidden || running) return
      running = true
      Promise.all([loadNotes(), loadActivity()]).finally(() => { running = false })
    }, 15000)
    return () => clearInterval(interval)
  }, [loadNotes, loadActivity])

  const cuts: any[] = useMemo(() => [...(pedido?.cut_orders || [])].sort((a, b) => STATE_RANK[cutCardState(a)] - STATE_RANK[cutCardState(b)]), [pedido])
  const preps: any[] = pedido?.preparation_items || []

  // La tarjeta activa es la primera que se puede cortar, salvo que el operario toque otra
  const activeCut = useMemo(() => {
    const cuttable = cuts.filter(c => ['cortando', 'por_empezar'].includes(cutCardState(c)))
    return cuttable.find(c => c.id === activeCutId) || cuttable[0] || null
  }, [cuts, activeCutId])

  // Stock de la familia (también guardado en la tablet para poder cambiar de chapa sin red)
  useEffect(() => {
    if (!activeCut || stockByCut[activeCut.id]) return
    const code = activeCut.product?.code || ''
    import('@/app/actions/get-available-stock')
      .then(({ getAvailableStock }) => fetchWithSnapshot(`stock:${code}`, () => getAvailableStock(code)))
      .then(r => { if (r) setStockByCut(prev => ({ ...prev, [activeCut.id]: r.data as any[] })) })
      .catch(e => console.error('Error cargando stock:', e))
  }, [activeCut, stockByCut])

  const savedLine = () => (sync.online ? 'Enviado a la oficina' : 'Guardado en la tablet: se enviará al volver la conexión')

  async function handleCut(cut: any) {
    if (!operator) return
    const remaining = n(cut.quantity_requested) - n(cut.quantity_cut)
    const quantity = Math.min(qty[cut.id] ?? remaining, remaining)
    if (quantity <= 0) return
    const materialLength = productLength(cut.material_product)
    const assigned = (stockByCut[cut.id] || []).find(r => r.product_id === cut.material_base_id)
    setBusy(cut.id)
    try {
      await enqueue('cut', pedidoId, { cutOrderId: cut.id, selectedMaterialId: assigned?.id || cut.material_base_id, materialLength, quantity }, `Corte ${quantity} × ${cut.product?.code || 'chapa'} de ${cut.material_product?.code || 'chapa asignada'}`)
      await refreshPending()
      const out = cutOutcome(materialLength, productLength(cut.product), quantity)
      setDone({
        title: 'Corte registrado',
        lines: [
          `${quantity} × ${cut.product?.code || cut.product?.name}`,
          `De ${out.sheets || quantity} × ${cut.material_product?.code || 'chapa asignada'} (${formatMeters(materialLength)})`,
          out.exact ? 'Chapa exacta, sin sobrante' : out.leftovers.length ? `Sobrante: ${describeLeftovers(out.leftovers)} al estante de remanentes` : 'Sin sobrante: se aprovecha toda la chapa',
          savedLine(),
        ],
      })
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo guardar el corte'))
    } finally {
      setBusy(null)
    }
  }

  async function handlePrepare(item: any) {
    if (!operator) return
    const remaining = n(item.quantity_requested) - n(item.quantity_prepared)
    const quantity = Math.min(qty[item.id] ?? remaining, remaining)
    if (quantity <= 0) return
    setBusy(item.id)
    try {
      await enqueue('prepare', pedidoId, { itemId: item.id, quantity }, `Preparación ${quantity} × ${item.product?.code || 'artículo'}`)
      await refreshPending()
      setDone({ title: 'Preparación registrada', lines: [`${quantity} × ${item.product?.code || item.product?.name}`, `${Math.min(n(item.quantity_prepared) + quantity, n(item.quantity_requested))} de ${n(item.quantity_requested)} preparadas`, savedLine()] })
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo guardar la preparación'))
    } finally {
      setBusy(null)
    }
  }

  async function handleConfirmPickup(cut: any) {
    setBusy(cut.id)
    try {
      await enqueue('confirm_pickup', pedidoId, { cutOrderId: cut.id }, `Reasignación de ${cut.quantity_requested} × ${cut.product?.code || 'chapa'} del pedido ${cut.reassigned_from_order?.order_number || '—'}`)
      await refreshPending()
      setDone({ title: 'Reasignación confirmada', lines: [`${cut.quantity_requested} × ${cut.product?.code || cut.product?.name}`, `Venía del pedido ${cut.reassigned_from_order?.order_number || '—'}`, savedLine()] })
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo guardar la reasignación'))
    } finally {
      setBusy(null)
    }
  }

  async function openChange(cut: any) {
    let rows: any[] = stockByCut[cut.id]
    if (!rows) {
      // Líneas sin chapa: no son la tarjeta activa, así que su stock aún no está cargado
      const code = cut.product?.code || ''
      try {
        const { getAvailableStock } = await import('@/app/actions/get-available-stock')
        const r = await fetchWithSnapshot(`stock:${code}`, () => getAvailableStock(code))
        rows = (r?.data as any[]) || []
      } catch (e) {
        console.error('Error cargando stock:', e)
        rows = []
      }
      setStockByCut(prev => ({ ...prev, [cut.id]: rows }))
    }
    const remaining = n(cut.quantity_requested) - n(cut.quantity_cut)
    const best = sortByRemnant(
      rows.filter(r => r.product_id !== cut.material_base_id).map(r => ({ ...r, code: r.product?.code || '', stock_disponible: n(r.stock_disponible) })),
      productLength(cut.product),
      remaining,
    )[0]
    setChangeFor(cut)
    setChangeRow(best ? rows.find(r => r.id === best.id) || null : null)
    setChangeQty(ALL_SHEETS)
  }

  async function handleChange() {
    if (!changeFor || !changeRow) return
    const remaining = n(changeFor.quantity_requested) - n(changeFor.quantity_cut)
    // changeQty son CHAPAS de la nueva; de cada una salen varias piezas
    const { maxSheets, pps } = sheetChoice(changeRow, changeFor)
    if (maxSheets < 1) {
      toast.error('Esa chapa no sirve para esta pieza o no queda ninguna disponible')
      return
    }
    const sheets = Math.max(1, Math.min(changeQty, maxSheets))
    const quantity = Math.min(remaining, sheets * pps)
    // Cambiar solo una parte parte la línea en dos en el servidor: sin red no se puede pintar bien
    if (!sync.online && quantity < remaining) {
      toast.error('Sin conexión solo se puede cambiar la chapa de todas las piezas que faltan')
      return
    }
    setBusy(changeFor.id)
    try {
      const code = changeRow.product?.code || ''
      await enqueue('change_sheet', pedidoId, { cutOrderId: changeFor.id, inventoryId: changeRow.id, productId: changeRow.product.id, size: extractSizeFromCode(code), quantity }, `Cambiar chapa de ${changeFor.product?.code || 'la línea'} a ${code}`)
      await refreshPending()
      setChangeFor(null)
      toast.success(`Ahora se corta de ${code}${sync.online ? '' : ' (guardado en la tablet)'}`)
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo cambiar la chapa'))
    } finally {
      setBusy(null)
    }
  }

  async function handleMarkRead(noteId: string) {
    if (!operator) return
    try {
      await enqueue('note_read', pedidoId, { noteId, operatorName: operator.full_name }, 'Nota marcada como leída')
      await refreshPending()
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo marcar la nota'))
    }
  }

  async function sendNote(content: string, okMessage: string) {
    setBusy('note')
    try {
      await enqueue('note', pedidoId, { content }, `Nota: «${content.slice(0, 60)}»`)
      await refreshPending()
      toast.success(sync.online ? okMessage : `${okMessage} (se enviará al volver la conexión)`)
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo enviar el aviso'))
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div className={cn('flex min-h-screen items-center justify-center text-xl', P.bg, P.muted)}>Cargando pedido...</div>
  }

  if (!pedido) {
    return (
      <div className={cn('flex min-h-screen flex-col items-center justify-center gap-5', P.bg)}>
        <div className={cn('text-2xl font-bold', P.text)}>{sync.online ? 'Pedido no encontrado' : 'Este pedido no está guardado en la tablet'}</div>
        <BigButton tone="ghost" onClick={() => onBack()}>Volver a pedidos</BigButton>
      </div>
    )
  }

  const status = getOrderStatusConfig(pedido.status)
  const adminNotes = notes.filter(x => !String(x.created_by_name || '').endsWith('(planta)'))
  const unread = adminNotes.filter(x => !x.read_at).length
  const evo = activity.evo

  return (
    <div className={cn('min-h-screen', P.bg)}>
      <PlantaHeader
        operator={operator}
        title={pedido.order_number}
        subtitle={<>{pedido.client?.business_name || 'Sin cliente'} · {status.label}{pedido.status === 'modificado' && ' (ampliación pendiente de aprobar)'}</>}
        left={
          <button type="button" onClick={() => onBack()} aria-label="Volver a pedidos" className={cn('inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border', P.border, P.card, P.text)}>
            <ArrowLeft className="h-7 w-7" />
          </button>
        }
        right={
          <>
          <PlantaSyncBadge />
          <PlantaRefreshButton onRefresh={() => { setStockByCut({}); return Promise.all([loadPedido(), loadNotes(), loadActivity()]) }} />
          </>
        }
      />
      <PlantaOfflineBanner savedAt={savedAt} fromCache={fromCache} />

      <main className="mx-auto grid max-w-[1180px] grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-[1fr_380px]">
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label>Chapas a cortar · {cuts.length}</Label>
            {activeCut && <Label tone="amber">Siguiente: {activeCut.product?.code}</Label>}
          </div>
          {cuts.length === 0 && <div className={cn('rounded-2xl border p-6 text-lg', P.card, P.border, P.muted)}>Este pedido no tiene chapas que cortar.</div>}
          {cuts.map(cut => {
            const state = cutCardState(cut)
            const isActive = activeCut?.id === cut.id
            if (isActive) {
              return (
                <ActiveCutCard
                  key={cut.id}
                  cut={cut}
                  evoName={evoNames.get(cut.product_id)}
                  rows={stockByCut[cut.id]}
                  qty={qty[cut.id]}
                  onQty={v => setQty(prev => ({ ...prev, [cut.id]: v }))}
                  busy={busy === cut.id}
                  onCut={() => handleCut(cut)}
                  onChange={() => openChange(cut)}
                />
              )
            }
            return (
              <CutRow
                key={cut.id}
                cut={cut}
                evoName={evoNames.get(cut.product_id)}
                state={state}
                busy={busy === cut.id || busy === 'note'}
                onSelect={() => setActiveCutId(cut.id)}
                onConfirm={() => handleConfirmPickup(cut)}
                onAssign={() => openChange(cut)}
                onNotify={() => sendNote(`Falta chapa para ${cut.product?.code || cut.product?.name}. Avisad cuando esté asignada.`, 'Aviso enviado al admin')}
              />
            )
          })}
        </section>

        <aside className="flex flex-col gap-4">
          <div className={cn('flex flex-col gap-3 rounded-2xl border p-4', P.card, P.border)}>
            <Label tone="blue">Para preparar · {preps.length}</Label>
            {preps.length === 0 && <div className={cn('text-base', P.muted)}>Nada que preparar en este pedido.</div>}
            {preps.map(item => {
              const total = n(item.quantity_requested), doneQ = n(item.quantity_prepared)
              const remaining = total - doneQ
              const value = Math.min(qty[item.id] ?? remaining, remaining) || remaining
              const finished = remaining <= 0
              return (
                <div key={item.id} className={cn('flex flex-col gap-3 rounded-xl border p-3', P.border, P.panel)}>
                  <div className="flex items-center gap-3">
                    <div className="flex w-[64px] shrink-0 flex-col items-center">
                      <span className={cn('text-[36px] font-extrabold leading-none tabular-nums', finished ? 'text-[#4ade80]' : 'text-[#93c5fd]')}>{finished ? total : remaining}</span>
                      <span className={cn('text-[12px] font-semibold', P.muted)}>{finished ? 'listas' : remaining === 1 ? 'unidad' : 'unidades'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[17px] font-bold leading-tight', P.text)}>{evoNames.get(item.product_id) || item.product?.name}</div>
                      <div className={cn('text-[15px]', P.muted)}>{item.product?.code} · {doneQ} de {total}{!item.assigned_inventory && !finished && ' · sin stock asignado, prepara lo que haya'}</div>
                    </div>
                  </div>
                  {finished ? (
                    <div className="inline-flex items-center gap-2 text-base font-semibold text-[#4ade80]"><Check className="h-5 w-5" /> Preparado</div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <PlantaStepper size="md" value={value} onChange={v => setQty(prev => ({ ...prev, [item.id]: v }))} min={1} max={remaining} />
                      <BigButton tone="blue" className="h-14 flex-1" disabled={busy === item.id} onClick={() => handlePrepare(item)}>
                        {busy === item.id ? '...' : `Preparar ${value}`}
                      </BigButton>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Las notas de la oficina sustituyen al papel: fijas aquí durante todo el pedido, leídas o no */}
          <div className={cn('flex flex-col gap-3.5 rounded-2xl p-4', unread ? 'border-2 border-[#f59e0b] bg-[#f59e0b]/10' : cn('border', P.card, P.border))}>
            <div className="flex items-center justify-between gap-3">
              <Label tone={adminNotes.length ? 'amber' : 'muted'}>Notas de la oficina</Label>
              {unread > 0 && <span className="rounded-full bg-[#f59e0b] px-2.5 py-0.5 text-[13px] font-extrabold text-[#0b1220]">{unread} sin leer</span>}
            </div>
            {adminNotes.length === 0 && <div className={cn('text-base', P.muted)}>La oficina no ha dejado notas en este pedido.</div>}
            {adminNotes.map(note => (
              <div key={note.id} className="flex flex-col gap-2.5 border-t border-[#233052] pt-3.5 first:border-t-0 first:pt-0">
                <div className={cn('whitespace-pre-wrap break-words text-[20px] leading-snug', note.read_at ? cn('font-semibold', P.soft) : cn('font-bold', P.text))}>{note.content}</div>
                <div className={cn('flex items-center justify-between gap-3 text-[14px]', P.muted)}>
                  <span>{note.created_by_name || 'Oficina'} · {hora(note.created_at)}</span>
                  {note.read_at && <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#4ade80]"><Check className="h-4 w-4" /> Leída</span>}
                </div>
                {!note.read_at && <BigButton tone="amber" className="h-[52px] text-[17px]" onClick={() => handleMarkRead(note.id)}>Marcar como leída</BigButton>}
              </div>
            ))}
          </div>

          <div className={cn('flex items-center gap-3 rounded-2xl border p-4', P.card, P.border)}>
            <span className={cn('inline-block h-3 w-3 shrink-0 rounded-full', evo.failed ? 'bg-red-500' : evo.pending ? 'bg-[#f59e0b]' : 'bg-[#16a34a]')} />
            <div className="min-w-0">
              <div className={cn('text-base font-semibold', P.text)}>
                {evo.failed ? `${evo.failed} aviso${evo.failed > 1 ? 's' : ''} a EVO sin enviar` : evo.pending ? `${evo.pending} aviso${evo.pending > 1 ? 's' : ''} a EVO en cola` : 'EVO al día'}
              </div>
              <div className={cn('text-[14px]', P.muted)}>{evo.failed ? 'El admin lo ve en su panel; tú puedes seguir cortando.' : evo.pending ? 'Se envían solos en unos segundos.' : 'Todo lo registrado está avisado.'}</div>
            </div>
          </div>
        </aside>
      </main>

      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/85 p-6" onClick={() => setDone(null)}>
          <div className={cn('flex w-full max-w-[560px] flex-col items-center gap-5 rounded-3xl border p-10 text-center', P.panel, P.border)} onClick={e => e.stopPropagation()}>
            <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-[#16a34a]"><Check className="h-14 w-14 text-white" strokeWidth={3} /></span>
            <div className={cn('text-[34px] font-extrabold', P.text)}>{done.title}</div>
            <div className="flex flex-col gap-1.5">
              {done.lines.map((l, i) => <div key={i} className={cn(i === 0 ? cn('text-2xl font-bold', P.text) : cn('text-lg', P.soft))}>{l}</div>)}
            </div>
            <div className="mt-2 flex w-full flex-col gap-3">
              <BigButton tone="green" className="h-16 text-xl" onClick={() => setDone(null)}>Seguir con este pedido</BigButton>
              <BigButton tone="ghost" onClick={() => onBack()}>Volver a la lista</BigButton>
            </div>
          </div>
        </div>
      )}

      {changeFor && (
        <ChangeSheetModal
          cut={changeFor}
          rows={stockByCut[changeFor.id] || []}
          selected={changeRow}
          onSelect={r => { setChangeRow(r); setChangeQty(ALL_SHEETS) }}
          qty={changeQty}
          onQty={setChangeQty}
          busy={busy === changeFor.id}
          onClose={() => setChangeFor(null)}
          onConfirm={handleChange}
        />
      )}

    </div>
  )
}

function ActiveCutCard({ cut, evoName, rows, qty, onQty, busy, onCut, onChange }: {
  cut: any
  evoName?: string
  rows?: any[]
  qty?: number
  onQty: (v: number) => void
  busy: boolean
  onCut: () => void
  onChange: () => void
}) {
  const total = n(cut.quantity_requested), doneQ = n(cut.quantity_cut)
  const remaining = total - doneQ
  const value = Math.min(qty ?? remaining, remaining) || remaining
  const materialLength = productLength(cut.material_product)
  const pieceLength = productLength(cut.product)
  const plan = cutPlan(materialLength, pieceLength)
  // Lo que pasa si corta `value` piezas ahora: chapas que gasta y trozos que sobran
  const out = cutOutcome(materialLength, pieceLength, value)
  const sheetsNeeded = out.sheets || value
  const assigned = rows?.find(r => r.product_id === cut.material_base_id)
  const otherOptions = (rows || []).filter(r => r.product_id !== cut.material_base_id).length

  return (
    <div className={cn('flex flex-col gap-7 rounded-2xl border-2 border-[#f59e0b] p-7', P.card)}>
      {/* La cantidad manda: es lo primero y lo más grande, para que nadie la confunda con un número del nombre */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label tone="amber">{doneQ > 0 ? 'Faltan por cortar' : 'Hay que cortar'}</Label>
          <div className="flex items-baseline gap-3">
            <span className="text-[84px] font-extrabold leading-none tabular-nums text-[#fbbf24]">{remaining}</span>
            <span className={cn('text-[30px] font-extrabold leading-tight', P.text)}>
              {remaining === 1 ? 'pieza' : 'piezas'}{pieceLength ? ` de ${formatMeters(pieceLength)}` : ''}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Label tone="amber">{doneQ > 0 ? 'Cortando' : 'Por empezar'}</Label>
          <span className={cn('text-lg font-semibold tabular-nums', P.soft)}>{doneQ} de {total} cortadas</span>
        </div>
      </div>
      <div className="-mt-2 min-w-0">
        <div className={cn('text-xl font-semibold leading-snug', P.soft)}>{evoName || cut.product?.name || cut.product?.code}</div>
        <div className={cn('text-base', P.muted)}>{cut.product?.code}</div>
      </div>

      {/* Plano de corte: de qué chapa sale, qué sobra y el dibujo a escala, en su propio recuadro */}
      <div className={cn('flex flex-col gap-5 rounded-2xl border px-6 pb-6 pt-5', P.panel, P.border)}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <Label>Se corta de</Label>
            <div className={cn('text-[22px] font-extrabold leading-tight', P.text)}>{sheetsNeeded} {sheetsNeeded === 1 ? 'chapa' : 'chapas'} {cut.material_product?.code || '—'}</div>
            {assigned && <div className={cn('text-[14px]', P.muted)}>{n(assigned.stock_disponible)} más disponibles</div>}
          </div>
          <div className="text-right">
            <Label>Sobrante</Label>
            <div className={cn('text-[22px] font-extrabold leading-tight', out.leftovers.length ? 'text-[#7dd3fc]' : 'text-[#4ade80]')}>{out.leftovers.length ? describeLeftovers(out.leftovers) : 'Ninguno'}</div>
            {plan.exact && <div className={cn('text-[14px]', P.muted)}>Chapa exacta: no hay que cortar</div>}
          </div>
        </div>
        {!plan.exact && out.sheets > 0 && <SheetPlan variant="planta" sheetLength={materialLength} pieceLength={pieceLength} pieces={value} />}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Cuántas cortas ahora</Label>
          <PlantaStepper value={value} onChange={onQty} min={1} max={remaining} />
        </div>
        <BigButton tone="green" className="h-[72px] flex-1 text-[22px]" disabled={busy || remaining <= 0 || !cut.material_base_id} onClick={onCut}>
          {busy ? 'Registrando...' : `Confirmar corte de ${value}`}
        </BigButton>
      </div>

      <div className="flex items-center justify-between">
        <BigButton tone="ghost" className="h-12" disabled={!rows || otherOptions === 0} onClick={onChange}>
          Usar otra chapa{rows && otherOptions > 0 ? ` (${otherOptions})` : ''}
        </BigButton>
        {remaining - value > 0 && <span className={cn('text-[15px]', P.muted)}>Después de este corte quedan {remaining - value} por cortar</span>}
      </div>
    </div>
  )
}

function CutRow({ cut, evoName, state, busy, onSelect, onConfirm, onAssign, onNotify }: {
  cut: any
  evoName?: string
  state: CutCardState
  busy: boolean
  onSelect: () => void
  onConfirm: () => void
  onAssign: () => void
  onNotify: () => void
}) {
  const total = n(cut.quantity_requested), doneQ = n(cut.quantity_cut)
  const remaining = Math.max(0, total - doneQ)
  const pieceLength = productLength(cut.product)
  const label = STATE_LABEL[state]
  const selectable = state === 'cortando' || state === 'por_empezar'
  const Wrapper: any = selectable ? 'button' : 'div'

  return (
    <Wrapper
      type={selectable ? 'button' : undefined}
      onClick={selectable ? onSelect : undefined}
      className={cn('flex flex-col gap-3 rounded-2xl border p-5 text-left', P.card, state === 'confirmar_recogida' ? 'border-[#f59e0b]' : state === 'terminada' ? 'border-[#16a34a]/50' : P.border, selectable && 'hover:border-[#f59e0b]/60 active:bg-[#162138]')}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {/* Cantidad delante y grande, igual que en la tarjeta activa */}
          <div className="flex w-[92px] shrink-0 flex-col items-center">
            <span className={cn('text-[44px] font-extrabold leading-none tabular-nums', state === 'terminada' ? 'text-[#4ade80]' : state === 'sin_chapa' ? P.soft : 'text-[#fbbf24]')}>{state === 'terminada' ? total : remaining}</span>
            <span className={cn('text-[13px] font-semibold', P.muted)}>{state === 'terminada' ? 'cortadas' : remaining === 1 ? 'pieza' : 'piezas'}</span>
          </div>
          <div className="min-w-0">
            <div className={cn('text-[20px] font-bold leading-tight', state === 'terminada' ? P.soft : P.text)}>{evoName || cut.product?.name || cut.product?.code}</div>
            <div className={cn('text-base', P.muted)}>
              {cut.product?.code}{pieceLength ? ` · ${formatMeters(pieceLength)} cada una` : ''}{cut.material_product?.code ? ` · de ${cut.material_product.code}` : ''}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex flex-col items-end">
            <Label tone={label.tone}>{label.text}</Label>
            <span className={cn('text-base font-semibold tabular-nums', state === 'terminada' ? 'text-[#4ade80]' : P.soft)}>{doneQ} de {total}</span>
          </div>
          {selectable && <ChevronRight className={cn('h-7 w-7', P.muted)} />}
          {state === 'terminada' && <Check className="h-7 w-7 text-[#4ade80]" />}
        </div>
      </div>

      {state === 'confirmar_recogida' && (
        <div className="flex flex-col gap-3">
          <div className={cn('text-base', P.soft)}><b className={P.text}>Reasignación:</b> esta pieza viene ya cortada del pedido <b className={P.text}>{cut.reassigned_from_order?.order_number || '—'}</b>. Retírala de ahí y confirma la reasignación.</div>
          <BigButton tone="amber" className="h-16 text-xl" disabled={busy} onClick={onConfirm}>{busy ? '...' : 'Confirmar reasignación'}</BigButton>
        </div>
      )}

      {state === 'sin_chapa' && (
        <div className="flex items-center justify-between gap-3">
          <div className={cn('text-base', P.muted)}>Aún sin chapa asignada. Elige de qué chapa se corta o avisa al admin.</div>
          <div className="flex shrink-0 gap-2">
            <BigButton tone="outline-amber" className="h-12" disabled={busy} onClick={onNotify}>Avisar al admin</BigButton>
            <BigButton tone="amber" className="h-12" disabled={busy} onClick={onAssign}>Elegir chapa</BigButton>
          </div>
        </div>
      )}
    </Wrapper>
  )
}

/** «Todas las chapas que hagan falta»: el selector lo ajusta al máximo real. */
const ALL_SHEETS = 9999

/** Cuántas chapas de `row` se pueden usar para lo que falta de `cut` y cuántas piezas da cada una. */
function sheetChoice(row: any, cut: any): { maxSheets: number; pps: number; length: number } {
  const length = extractSizeFromCode(row.product?.code || row.code || '')
  const pps = cutPlan(length, productLength(cut.product)).piecesPerSheet
  const remaining = n(cut.quantity_requested) - n(cut.quantity_cut)
  if (pps < 1) return { maxSheets: 0, pps: 0, length }
  return { maxSheets: Math.min(Math.floor(n(row.stock_disponible)), sheetsFor(remaining, pps)), pps, length }
}

function ChangeSheetModal({ cut, rows, selected, onSelect, qty, onQty, busy, onClose, onConfirm }: {
  cut: any
  rows: any[]
  selected: any | null
  onSelect: (r: any) => void
  qty: number
  onQty: (v: number) => void
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const pieceLength = productLength(cut.product)
  const remaining = n(cut.quantity_requested) - n(cut.quantity_cut)
  const options = sortByRemnant(
    rows.filter(r => r.product_id !== cut.material_base_id).map(r => ({ ...r, code: r.product?.code || '', stock_disponible: n(r.stock_disponible) })),
    pieceLength,
    remaining,
  ).filter(r => cutPlan(extractSizeFromCode(r.code), pieceLength).piecesPerSheet > 0)
  // Se eligen CHAPAS de la nueva: las justas para lo que falta, sin pasar de las libres
  const choice = selected ? sheetChoice(selected, cut) : { maxSheets: 1, pps: 1, length: 0 }
  const max = Math.max(1, choice.maxSheets)
  const sheets = Math.max(1, Math.min(qty, max))
  const pieces = Math.min(remaining, sheets * choice.pps)
  const result = selected ? cutOutcome(choice.length, pieceLength, pieces) : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/85 p-6" onClick={onClose}>
      <div className={cn('flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-3xl border', P.panel, P.border)} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#1e293b] px-6 py-5">
          <div>
            <div className={cn('text-2xl font-bold', P.text)}>{cut.material_base_id ? 'Usar otra chapa' : 'Elegir chapa'}</div>
            <div className={cn('text-base', P.muted)}>Para {cut.product?.code} ({formatMeters(pieceLength)}).{cut.material_base_id ? ` Ahora: ${cut.material_product?.code || '—'}.` : ''} Ordenadas por menos sobrante.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', P.border, P.card, P.muted)}><X className="h-6 w-6" /></button>
        </div>
        <div className="min-h-[140px] flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {options.length === 0 && <div className={cn('text-lg', P.muted)}>No hay otra chapa de esta familia con stock.</div>}
          {options.map(r => {
            const len = extractSizeFromCode(r.code)
            const plan = cutPlan(len, pieceLength)
            const active = selected?.id === r.id
            // Lo que pasaría con las piezas que faltan (no con la chapa aprovechada entera)
            const can = Math.min(remaining, Math.floor(r.stock_disponible) * plan.piecesPerSheet)
            const o = cutOutcome(len, pieceLength, can)
            return (
              <button key={r.id} type="button" onClick={() => onSelect(r)} className={cn('grid w-full grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] items-center gap-5 rounded-2xl border px-5 py-[18px] text-left', active ? 'border-[#f59e0b] bg-[#f59e0b]/10' : cn(P.border, P.card))}>
                <div className="min-w-0">
                  <div className={cn('text-xl font-bold', P.text)}>{r.code}</div>
                  <div className={cn('text-[15px]', P.muted)}>{formatMeters(len)} · {Math.floor(r.stock_disponible)} disponibles{can < remaining ? ` · alcanza para ${can}` : ''}</div>
                </div>
                {plan.exact
                  ? <div className={cn('text-[15px]', P.muted)}>Medida exacta: no hay que cortar</div>
                  : <SheetMini variant="planta" sheetLength={len} pieceLength={pieceLength} pieces={can} />}
                <div className="shrink-0 whitespace-nowrap text-right">
                  <Label>{o.sheets} {o.sheets === 1 ? 'chapa' : 'chapas'}{plan.exact ? '' : ' · sobra'}</Label>
                  <div className={cn('text-xl font-extrabold', o.leftovers.length === 0 ? 'text-[#4ade80]' : P.text)}>{o.leftovers.length === 0 ? 'Nada' : describeLeftovers(o.leftovers)}</div>
                </div>
              </button>
            )
          })}
        </div>
        {selected && result && !result.exact && (
          <div className="border-t border-[#1e293b] px-6 pt-5">
            <div className={cn('rounded-2xl border px-6 py-5', P.card, P.border)}>
              <SheetPlan variant="planta" sheetLength={choice.length} pieceLength={pieceLength} pieces={pieces} />
            </div>
          </div>
        )}
        <div className={cn('flex items-center justify-between gap-4 px-6 py-5', !(selected && result && !result.exact) && 'border-t border-[#1e293b]')}>
          <div className="flex flex-col gap-1.5">
            <Label>Chapas a usar</Label>
            <PlantaStepper size="md" value={sheets} onChange={onQty} min={1} max={max} />
            {result && <span className={cn('text-[14px]', P.muted)}>{pieces} de {remaining} {remaining === 1 ? 'pieza' : 'piezas'}{result.leftovers.length ? ` · sobra ${describeLeftovers(result.leftovers)}` : ' · sin sobrante'}</span>}
          </div>
          <BigButton tone="green" className="h-16 flex-1 text-xl" disabled={!selected || busy} onClick={onConfirm}>
            {busy ? 'Cambiando...' : selected ? `Cambiar a ${selected.product?.code}` : 'Elige una chapa'}
          </BigButton>
        </div>
      </div>
    </div>
  )
}
