'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Undo2 } from 'lucide-react'
import { getCutUndoInfo, nudgeOutboundQueue, undoLastCut, type CutUndoInfo } from '@/app/actions/cut-undo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'
import { userMessage } from '@/lib/user-error'

// Historial del pedido, con «Deshacer» en el último corte de cada orden.

type EvoStatus = 'pendiente' | 'confirmado' | 'error' | 'no_hizo_falta'
const EVO_CHIP: Record<EvoStatus, { label: string; chip: string; dot: string }> = {
  pendiente: { label: 'EVO: pendiente de confirmar', chip: 'bg-warning/15 text-foreground', dot: 'bg-warning' },
  confirmado: { label: 'EVO: confirmado', chip: 'bg-success/15 text-foreground', dot: 'bg-success' },
  error: { label: 'EVO: no lo aceptó, revisa Logs', chip: 'bg-destructive/15 text-foreground', dot: 'bg-destructive' },
  no_hizo_falta: { label: 'EVO: no hizo falta avisar', chip: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fmtM = (v: unknown) => `${(Number(v) || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m`

function cutDetail(metadata: any): string | null {
  if (!metadata || metadata.material_length == null) return null
  return Number(metadata.remnant_per_sheet) > 0
    ? `Chapa de ${fmtM(metadata.material_length)} · remanente ${fmtM(metadata.remnant_per_sheet)}`
    : 'Corte exacto, sin remanente'
}

export function OrderHistory({ orderId, orderNumber, activityLog, onChanged, className }: {
  orderId: string
  orderNumber: string
  activityLog: any[]
  onChanged: () => void | Promise<void>
  className?: string
}) {
  const [undo, setUndo] = useState<Record<string, CutUndoInfo>>({})
  const [evoStatus, setEvoStatus] = useState<Record<string, EvoStatus>>({})
  const [target, setTarget] = useState<{ activity: any; info: CutUndoInfo } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const hasCuts = activityLog.some(a => a.activity_type === 'cut_completed' || a.activity_type === 'cut_reverted')
  const load = useCallback(async () => {
    if (!hasCuts) return
    try {
      const res = await getCutUndoInfo(orderId)
      setUndo(res.undo)
      setEvoStatus(res.evoStatus)
    } catch (e) {
      console.error('Error cargando los cortes que se pueden deshacer:', e)
    }
  }, [orderId, hasCuts])
  // Se recalcula cada vez que cambia el historial (corte nuevo, corte deshecho)
  useEffect(() => { load() }, [load, activityLog])

  // Mientras EVO no confirma un deshacer, se empuja la cola (el aviso puede
  // estar esperando detrás de otro evento) y se vuelve a preguntar
  const waiting = Object.values(evoStatus).includes('pendiente')
  useEffect(() => {
    if (!waiting) return
    const tick = async () => {
      try { await nudgeOutboundQueue() } catch (e) { console.error('Error empujando la cola de EVO:', e) }
      await load()
    }
    const t = setInterval(tick, 8000)
    return () => clearInterval(t)
  }, [waiting, load])

  async function handleUndo() {
    if (!target) return
    setBusy(true)
    try {
      const res = await undoLastCut(target.info.cutOrderId, reason)
      toast.success('Corte deshecho', {
        description: res.evo === 'inverso' ? 'Se ha avisado a EVO para que devuelva el stock.' : 'No hizo falta avisar a EVO.',
      })
      setTarget(null)
      setReason('')
      await onChanged()
    } catch (e: any) {
      toast.error('No se pudo deshacer el corte', { description: userMessage(e) })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const info = target?.info
  const statusLabel = (s: string) => getOrderStatusConfig(s).label

  return (
    <section className={cn('flex flex-col gap-3 p-5', className)}>
      <h2 className="text-base font-semibold text-foreground">Historial</h2>
      {activityLog.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
      ) : (
        <ol className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
          {activityLog.map(a => {
            const cutInfo = undo[a.id]
            const reverted = a.activity_type === 'cut_completed' && !!a.metadata?.reverted_at
            const detail = a.activity_type === 'cut_completed' && !reverted ? cutDetail(a.metadata) : null
            const evo = a.activity_type === 'cut_reverted' ? evoStatus[a.id] : undefined
            return (
              <li key={a.id} className="flex gap-3 text-[13px]">
                <span className="w-[74px] shrink-0 tabular-nums text-muted-foreground">{fmtTime(a.created_at)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className={cn(reverted ? 'text-muted-foreground line-through' : 'text-foreground')}>{a.description}</span>
                  {reverted && (
                    <span className="self-start rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deshecho</span>
                  )}
                  {a.activity_type === 'cut_reverted' && a.metadata?.reason && (
                    <span className="text-xs text-muted-foreground">Motivo: {a.metadata.reason}</span>
                  )}
                  {evo && (
                    <span className={cn('inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium', EVO_CHIP[evo].chip)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', EVO_CHIP[evo].dot)} />
                      {EVO_CHIP[evo].label}
                    </span>
                  )}
                  {cutInfo && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{cutInfo.blocked || detail}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={!!cutInfo.blocked || busy}
                        title={cutInfo.blocked || undefined}
                        onClick={() => { setReason(''); setTarget({ activity: a, info: cutInfo }) }}
                      >
                        <Undo2 size={14} />
                        Deshacer
                      </Button>
                    </div>
                  )}
                  {!cutInfo && detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {target && info && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="undo-cut-title">
          <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex flex-col gap-1.5">
              <h3 id="undo-cut-title" className="text-lg font-semibold text-foreground">¿Deshacer este corte?</h3>
              <p className="text-sm text-muted-foreground">Úsalo cuando el corte se registró por error. La orden vuelve a planta para cortarla de nuevo.</p>
            </div>

            <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
              <span className="text-sm font-semibold text-foreground">{info.quantity} ud{info.quantity !== 1 ? 's' : ''} de {info.productName}</span>
              <span className="text-xs text-muted-foreground">
                {[target.activity.metadata?.operator_name, fmtTime(target.activity.created_at), `Pedido ${orderNumber}`].filter(Boolean).join(' · ')}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qué va a pasar</h4>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-[13px] text-foreground marker:text-primary">
                <li>La orden de corte pasa de <strong className="font-semibold">{info.before}</strong> a <strong className="font-semibold">{info.after}</strong> y vuelve a aparecer en la tablet de planta.</li>
                <li>
                  {info.orderStatusAfter === info.orderStatus
                    ? <>El pedido sigue en <strong className="font-semibold">{statusLabel(info.orderStatus)}</strong>.</>
                    : <>El pedido pasa de <strong className="font-semibold">{statusLabel(info.orderStatus)}</strong> a <strong className="font-semibold">{statusLabel(info.orderStatusAfter)}</strong>.</>}
                </li>
                <li>
                  {info.evo === 'inverso'
                    ? (info.stock.length
                      ? 'Se avisa a EVO para que devuelva el stock y deje de dar la línea por preparada:'
                      : 'Se avisa a EVO para que deje de dar la línea por preparada. El stock no cambia (corte exacto).')
                    : info.evo === 'descartar'
                      ? 'El aviso de este corte todavía no había llegado a EVO: se anula y EVO no nota nada.'
                      : 'Este corte no se notificó a EVO, así que no hay nada que avisarle.'}
                </li>
              </ul>
              {info.stock.length > 0 && (
                <table className="w-full overflow-hidden rounded-lg border border-border text-[13px]">
                  <tbody>
                    {info.stock.map((s, i) => (
                      <tr key={i} className={cn(i > 0 && 'border-t border-border')}>
                        <td className={cn('w-14 px-3 py-2 font-semibold tabular-nums', s.delta > 0 ? 'text-success' : 'text-destructive')}>{s.delta > 0 ? '+' : '−'} {Math.abs(s.delta)}</td>
                        <td className="px-3 py-2 text-foreground">{s.name}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{s.delta > 0 ? 'vuelve al stock' : 'se retira'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="undo-cut-reason">Motivo <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="undo-cut-reason" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="Ej.: se marcó en el pedido equivocado" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={busy} onClick={handleUndo}>
                {busy && <Loader2 size={14} className="animate-spin" />}
                Sí, deshacer corte
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
