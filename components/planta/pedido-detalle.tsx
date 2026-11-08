'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, ChevronRight, MessageSquare, X } from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { enqueue, fetchWithSnapshot, pendingFor, type QueuedOp } from '@/lib/planta-offline/store'
import { applyPendingToNotes, applyPendingToOrder } from '@/lib/planta-offline/apply'
import { PlantaOfflineBanner, PlantaSyncBadge, useSyncState } from '@/components/planta/sync-status'
import { BigButton, Label, P, PlantaHeader, PlantaStepper } from './planta-ui'
import { cutCardState, cutPlan, formatMeters, productLength, sortByRemnant, type CutCardState } from '@/lib/planta-tasks'
import { extractSizeFromCode } from '@/lib/product-utils'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'

const QUICK_REPLIES = ['Llegamos a tiempo', 'Falta material', 'Chapa dañada', 'Tengo una pregunta']

const STATE_RANK: Record<CutCardState, number> = { confirmar_recogida: 0, cortando: 1, por_empezar: 2, sin_chapa: 3, terminada: 4 }

const STATE_LABEL: Record<CutCardState, { text: string; tone: 'amber' | 'green' | 'blue' | 'muted' }> = {
  cortando: { text: 'Cortando', tone: 'amber' },
  por_empezar: { text: 'Por empezar', tone: 'amber' },
  sin_chapa: { text: 'Sin chapa asignada', tone: 'muted' },
  confirmar_recogida: { text: 'Confirmar recogida', tone: 'amber' },
  terminada: { text: 'Terminada', tone: 'green' },
}

type Done = { title: string; lines: string[] }

const n = (v: unknown) => Number(v) || 0

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
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
  const [showNotes, setShowNotes] = useState(false)
  const [activity, setActivity] = useState<{ activity: any[]; evo: { pending: number; failed: number } }>({ activity: [], evo: { pending: 0, failed: 0 } })

  // Lo que el operario ya hizo y aún no ha llegado al servidor, pintado encima
  const pedido = useMemo(() => (base ? applyPendingToOrder(base, pendingOps) : null), [base, pendingOps])
  const notes = useMemo(() => applyPendingToNotes(rawNotes, pendingOps, pedidoId, operator?.full_name || ''), [rawNotes, pendingOps, pedidoId, operator])

  const refreshPending = useCallback(async () => setPendingOps(await pendingFor(pedidoId)), [pedidoId])

  const loadPedido = useCallback(async () => {
    const { getOrderById } = await import('@/app/actions/client-queries')
    const r = await fetchWithSnapshot(`order:${pedidoId}`, () => getOrderById(pedidoId))
    if (r) { setBase(r.data); setSavedAt(r.savedAt); setFromCache(r.fromCache) }
    return r?.data
  }, [pedidoId])

  const loadNotes = useCallback(async () => {
    try {
      const { getOrderNotes } = await import('@/app/actions/order-notes')
      const r = await fetchWithSnapshot(`notes:${pedidoId}`, () => getOrderNotes(pedidoId))
      if (r) setRawNotes(r.data)
    } catch (e) {
      console.error('Error cargando notas:', e)
    }
  }, [pedidoId])

  const loadActivity = useCallback(async () => {
    try {
      const { getPlantaOrderActivity } = await import('@/app/actions/client-queries')
      const r = await fetchWithSnapshot(`activity:${pedidoId}`, () => getPlantaOrderActivity(pedidoId))
      if (r) setActivity(r.data)
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
    loadPedido().catch(e => console.error('Error cargando pedido:', e)).finally(() => setLoading(false))
    loadNotes()
    loadActivity()
    refreshPending()
  }, [router, loadPedido, loadNotes, loadActivity, refreshPending])

  // La cola cambia (se guarda o se envía algo): repintar lo pendiente
  useEffect(() => { refreshPending() }, [sync.pending, refreshPending])
  // Tras enviar, traer el estado real del servidor
  useEffect(() => {
    if (sync.lastSyncAt && sync.online) { loadPedido().catch(() => {}); loadNotes(); loadActivity(); setStockByCut({}) }
  }, [sync.lastSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambios desde admin (asignaciones, notas, reasignaciones) sin recargar la página
  useAutoRefresh(pedidoId, loadPedido, { enabled: true, interval: 10, onChange: () => {} })
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) { loadNotes(); loadActivity() }
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
      const plan = cutPlan(materialLength, productLength(cut.product))
      setDone({
        title: 'Corte registrado',
        lines: [
          `${quantity} × ${cut.product?.code || cut.product?.name}`,
          `De ${cut.material_product?.code || 'chapa asignada'} (${formatMeters(materialLength)})`,
          plan.exact ? 'Chapa exacta, sin sobrante' : `Sobrante: ${quantity} × ${formatMeters(plan.remnant)} al estante de remanentes`,
          savedLine(),
        ],
      })
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el corte')
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
      toast.error(e?.message || 'No se pudo guardar la preparación')
    } finally {
      setBusy(null)
    }
  }

  async function handleConfirmPickup(cut: any) {
    setBusy(cut.id)
    try {
      await enqueue('confirm_pickup', pedidoId, { cutOrderId: cut.id }, `Recogida de ${cut.quantity_requested} × ${cut.product?.code || 'chapa'} del pedido ${cut.reassigned_from_order?.order_number || '—'}`)
      await refreshPending()
      setDone({ title: 'Recogida confirmada', lines: [`${cut.quantity_requested} × ${cut.product?.code || cut.product?.name}`, `Venía del pedido ${cut.reassigned_from_order?.order_number || '—'}`, savedLine()] })
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la recogida')
    } finally {
      setBusy(null)
    }
  }

  function openChange(cut: any) {
    const rows = stockByCut[cut.id] || []
    const remaining = n(cut.quantity_requested) - n(cut.quantity_cut)
    setChangeFor(cut)
    setChangeRow(rows.find(r => r.product_id !== cut.material_base_id) || null)
    setChangeQty(remaining)
  }

  async function handleChange() {
    if (!changeFor || !changeRow) return
    const remaining = n(changeFor.quantity_requested) - n(changeFor.quantity_cut)
    // Cambiar solo una parte parte la línea en dos en el servidor: sin red no se puede pintar bien
    if (!sync.online && changeQty < remaining) {
      toast.error('Sin conexión solo se puede cambiar la chapa de todas las piezas que faltan')
      return
    }
    setBusy(changeFor.id)
    try {
      const code = changeRow.product?.code || ''
      await enqueue('change_sheet', pedidoId, { cutOrderId: changeFor.id, inventoryId: changeRow.id, productId: changeRow.product.id, size: extractSizeFromCode(code), quantity: changeQty }, `Cambiar chapa de ${changeFor.product?.code || 'la línea'} a ${code}`)
      await refreshPending()
      setChangeFor(null)
      toast.success(`Ahora se corta de ${code}${sync.online ? '' : ' (guardado en la tablet)'}`)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cambiar la chapa')
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
      toast.error(e?.message || 'No se pudo marcar la nota')
    }
  }

  async function sendNote(content: string, okMessage: string) {
    setBusy('note')
    try {
      await enqueue('note', pedidoId, { content }, `Nota: «${content.slice(0, 60)}»`)
      await refreshPending()
      toast.success(sync.online ? okMessage : `${okMessage} (se enviará al volver la conexión)`)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo enviar el aviso')
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

  const unread = notes.filter(x => !x.read_at).length
  const status = getOrderStatusConfig(pedido.status)
  const adminNotes = notes.filter(x => !String(x.created_by_name || '').endsWith('(planta)'))
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
          <button type="button" onClick={() => setShowNotes(true)} className={cn('relative inline-flex h-14 items-center gap-2 rounded-2xl border px-4 text-base font-semibold', unread ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#fbbf24]' : cn(P.border, P.card, P.muted))}>
            <MessageSquare className="h-5 w-5" /> Notas{unread ? ` · ${unread}` : ''}
          </button>
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
                state={state}
                busy={busy === cut.id || busy === 'note'}
                onSelect={() => setActiveCutId(cut.id)}
                onConfirm={() => handleConfirmPickup(cut)}
                onNotify={() => sendNote(`Falta chapa para ${cut.product?.code || cut.product?.name} (${cut.cut_number || 'corte'}). Avisad cuando esté asignada.`, 'Aviso enviado al admin')}
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={cn('text-lg font-bold leading-tight', P.text)}>{item.product?.name}</div>
                      <div className={cn('text-[15px]', P.muted)}>{item.product?.code}{!item.assigned_inventory && !finished && ' · sin stock asignado, prepara lo que haya'}</div>
                    </div>
                    <span className={cn('shrink-0 text-lg font-bold tabular-nums', finished ? 'text-[#4ade80]' : P.soft)}>{doneQ}/{total}</span>
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

          <div className={cn('flex flex-col gap-2 rounded-2xl border p-4', P.card, P.border)}>
            <Label>Último movimiento</Label>
            {activity.activity.length === 0 && <div className={cn('text-base', P.muted)}>Todavía no se ha cortado ni preparado nada.</div>}
            {activity.activity.slice(0, 3).map((a, i) => (
              <div key={i} className="flex gap-3 text-[15px]">
                <span className={cn('shrink-0 tabular-nums', P.muted)}>{hora(a.created_at)}</span>
                <span className={P.soft}>{a.description}</span>
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
          onSelect={setChangeRow}
          qty={changeQty}
          onQty={setChangeQty}
          busy={busy === changeFor.id}
          onClose={() => setChangeFor(null)}
          onConfirm={handleChange}
        />
      )}

      {showNotes && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#0b1220]/70" onClick={() => setShowNotes(false)}>
          <div className={cn('flex h-full w-full max-w-[460px] flex-col border-l', P.panel, P.border)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-4">
              <div className={cn('text-xl font-bold', P.text)}>Notas del pedido</div>
              <button type="button" onClick={() => setShowNotes(false)} aria-label="Cerrar notas" className={cn('inline-flex h-12 w-12 items-center justify-center rounded-xl border', P.border, P.card, P.muted)}><X className="h-6 w-6" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {notes.length === 0 && <div className={cn('text-base', P.muted)}>El admin no ha dejado notas en este pedido.</div>}
              {notes.map(note => {
                const mine = String(note.created_by_name || '').endsWith('(planta)')
                return (
                  <div key={note.id} className={cn('flex flex-col gap-2 rounded-xl border p-4', mine ? cn(P.border, P.card) : note.read_at ? cn(P.border, P.card) : 'border-[#f59e0b] bg-[#f59e0b]/10')}>
                    <div className={cn('text-[17px] leading-snug', P.text)}>{note.content}</div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn('text-[14px]', P.muted)}>{note.created_by_name || 'Admin'} · {hora(note.created_at)}</span>
                      {!mine && !note.read_at && <BigButton tone="amber" className="h-12 px-5" onClick={() => handleMarkRead(note.id)}>Leída</BigButton>}
                      {!mine && note.read_at && <span className="inline-flex items-center gap-1 text-[14px] text-[#4ade80]"><Check className="h-4 w-4" /> Leída</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[#1e293b] px-5 py-4">
              <Label>Responder al admin</Label>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {QUICK_REPLIES.map(r => (
                  <BigButton key={r} tone="ghost" className="h-14 text-[15px]" disabled={busy === 'note'} onClick={() => sendNote(r, 'Respuesta enviada')}>{r}</BigButton>
                ))}
              </div>
              {adminNotes.length === 0 && <div className={cn('mt-3 text-[14px]', P.muted)}>El admin verá tu respuesta en el detalle del pedido.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveCutCard({ cut, rows, qty, onQty, busy, onCut, onChange }: {
  cut: any
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
  const assigned = rows?.find(r => r.product_id === cut.material_base_id)
  const otherOptions = (rows || []).filter(r => r.product_id !== cut.material_base_id).length

  return (
    <div className={cn('flex flex-col gap-5 rounded-2xl border-2 border-[#f59e0b] p-6', P.card)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={cn('text-[30px] font-extrabold leading-tight', P.text)}>{cut.product?.name || cut.product?.code}</div>
          <div className={cn('text-lg', P.muted)}>{cut.product?.code}{cut.cut_number ? ` · ${cut.cut_number}` : ''}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Label tone="amber">{doneQ > 0 ? 'Cortando' : 'Por empezar'}</Label>
          <span className={cn('text-2xl font-extrabold tabular-nums', P.text)}>{doneQ}/{total}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Box label="Coger del estante" value={cut.material_product?.code || '—'} hint={materialLength ? `Chapa de ${formatMeters(materialLength)}${assigned ? ` · ${n(assigned.stock_disponible)} disponibles` : rows ? ' · sin stock en el sistema' : ''}` : 'Sin largo conocido'} warn={!!rows && !assigned} />
        <Box label="Cortar a" value={pieceLength ? formatMeters(pieceLength) : '—'} hint={`${value} ${value === 1 ? 'pieza' : 'piezas'}, una por chapa`} />
        <Box label="Sobrante" value={plan.exact ? 'Ninguno' : materialLength ? formatMeters(plan.remnant) : '—'} hint={plan.exact ? 'Chapa exacta' : `por chapa · ${value} × ${formatMeters(plan.remnant)} al estante`} tone={plan.exact ? 'green' : 'default'} />
      </div>

      {rows && !assigned && (
        <div className="rounded-xl border border-[#f59e0b]/60 bg-[#f59e0b]/10 px-4 py-3 text-base text-[#fbbf24]">
          Esta chapa no aparece con stock en el sistema. Si la tienes en el estante, corta igual; si no, elige otra o avisa al admin.
        </div>
      )}

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
        <span className={cn('text-[15px]', P.muted)}>{remaining === 1 ? 'Queda 1 pieza' : `Quedan ${remaining} piezas`}</span>
      </div>
    </div>
  )
}

function Box({ label, value, hint, tone = 'default', warn }: { label: string; value: string; hint?: string; tone?: 'default' | 'green'; warn?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-xl border p-4', P.panel, warn ? 'border-[#f59e0b]/60' : P.border)}>
      <Label>{label}</Label>
      <div className={cn('text-[26px] font-extrabold leading-tight', tone === 'green' ? 'text-[#4ade80]' : P.text)}>{value}</div>
      {hint && <div className={cn('text-[14px] leading-snug', warn ? 'text-[#fbbf24]' : P.muted)}>{hint}</div>}
    </div>
  )
}

function CutRow({ cut, state, busy, onSelect, onConfirm, onNotify }: {
  cut: any
  state: CutCardState
  busy: boolean
  onSelect: () => void
  onConfirm: () => void
  onNotify: () => void
}) {
  const total = n(cut.quantity_requested), doneQ = n(cut.quantity_cut)
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
        <div className="min-w-0">
          <div className={cn('text-[22px] font-bold leading-tight', state === 'terminada' ? P.soft : P.text)}>{cut.product?.name || cut.product?.code}</div>
          <div className={cn('text-base', P.muted)}>
            {cut.product?.code}{cut.material_product?.code ? ` · de ${cut.material_product.code}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex flex-col items-end">
            <Label tone={label.tone}>{label.text}</Label>
            <span className={cn('text-xl font-bold tabular-nums', state === 'terminada' ? 'text-[#4ade80]' : P.text)}>{doneQ}/{total}</span>
          </div>
          {selectable && <ChevronRight className={cn('h-7 w-7', P.muted)} />}
          {state === 'terminada' && <Check className="h-7 w-7 text-[#4ade80]" />}
        </div>
      </div>

      {state === 'confirmar_recogida' && (
        <div className="flex flex-col gap-3">
          <div className={cn('text-base', P.soft)}>Esta pieza viene ya cortada del pedido <b className={P.text}>{cut.reassigned_from_order?.order_number || '—'}</b>. Cógela de ahí y confirma.</div>
          <BigButton tone="amber" className="h-16 text-xl" disabled={busy} onClick={onConfirm}>{busy ? '...' : 'Confirmar recogida'}</BigButton>
        </div>
      )}

      {state === 'sin_chapa' && (
        <div className="flex items-center justify-between gap-3">
          <div className={cn('text-base', P.muted)}>El admin aún no ha asignado chapa. No hay nada que cortar todavía.</div>
          <BigButton tone="outline-amber" className="h-12 shrink-0" disabled={busy} onClick={onNotify}>Avisar al admin</BigButton>
        </div>
      )}
    </Wrapper>
  )
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
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/85 p-6" onClick={onClose}>
      <div className={cn('flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-3xl border', P.panel, P.border)} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#1e293b] px-6 py-5">
          <div>
            <div className={cn('text-2xl font-bold', P.text)}>Usar otra chapa</div>
            <div className={cn('text-base', P.muted)}>Para {cut.product?.code} ({formatMeters(pieceLength)}). Ahora: {cut.material_product?.code || '—'}. Ordenadas por menos sobrante.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', P.border, P.card, P.muted)}><X className="h-6 w-6" /></button>
        </div>
        <div className="flex-1 space-y-2.5 overflow-y-auto px-6 py-4">
          {options.length === 0 && <div className={cn('text-lg', P.muted)}>No hay otra chapa de esta familia con stock.</div>}
          {options.map(r => {
            const len = extractSizeFromCode(r.code)
            const plan = cutPlan(len, pieceLength)
            const active = selected?.id === r.id
            return (
              <button key={r.id} type="button" onClick={() => onSelect(r)} className={cn('flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left', active ? 'border-[#f59e0b] bg-[#f59e0b]/10' : cn(P.border, P.card))}>
                <div>
                  <div className={cn('text-xl font-bold', P.text)}>{r.code}</div>
                  <div className={cn('text-[15px]', P.muted)}>Chapa de {formatMeters(len)} · {r.stock_disponible} disponibles</div>
                </div>
                <div className="text-right">
                  <Label tone={plan.exact ? 'green' : 'muted'}>Sobrante</Label>
                  <div className={cn('text-xl font-extrabold', plan.exact ? 'text-[#4ade80]' : P.text)}>{plan.exact ? 'Ninguno' : formatMeters(plan.remnant)}</div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[#1e293b] px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <Label>Piezas con la chapa nueva</Label>
            <PlantaStepper size="md" value={Math.min(qty, remaining) || 1} onChange={onQty} min={1} max={remaining} />
          </div>
          <BigButton tone="green" className="h-16 flex-1 text-xl" disabled={!selected || busy} onClick={onConfirm}>
            {busy ? 'Cambiando...' : selected ? `Cambiar a ${selected.product?.code}` : 'Elige una chapa'}
          </BigButton>
        </div>
      </div>
    </div>
  )
}
