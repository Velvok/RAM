'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { getOrderById, approveOrderModification, undoOrderDelivery } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { useConfirm } from '@/components/confirm-modal'
import OrderNotesAdmin from '@/components/order-notes-admin'
import { OrderStatusBadge } from '@/components/order-status-badge'
import { AssignStockPanel, ReassignPanel, Summary, unassignedLines, type PanelLine } from '@/components/pedido/order-panels'
import OrderActions from './order-actions'

const n = (v: unknown) => Number(v) || 0

type Panel = { type: 'assign'; line: PanelLine } | { type: 'reassign'; cut: any } | null

type Tone = 'muted' | 'ok' | 'warn' | 'bad' | 'info'
const TONE: Record<Tone, string> = {
  muted: 'bg-muted text-muted-foreground',
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  bad: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
}
const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', TONE[tone])}>{children}</span>
)

function cutState(c: any, paused: boolean): { label: string; tone: Tone } {
  if (c.status === 'entregado') return { label: 'Entregada', tone: 'info' }
  if (c.status === 'pendiente_confirmacion') return { label: 'Recogida pendiente', tone: 'warn' }
  if (c.status === 'completada' || n(c.quantity_cut) >= n(c.quantity_requested)) return { label: 'Cortada', tone: 'ok' }
  if (!c.material_base_id) return { label: paused ? 'Bloquea' : 'Sin asignar', tone: paused ? 'bad' : 'warn' }
  return n(c.quantity_cut) > 0 ? { label: 'Cortando', tone: 'info' } : { label: 'Por empezar', tone: 'muted' }
}

function prepState(p: any, paused: boolean): { label: string; tone: Tone } {
  if (p.status === 'entregado') return { label: 'Entregado', tone: 'info' }
  if (n(p.quantity_prepared) >= n(p.quantity_requested)) return { label: 'Preparado', tone: 'ok' }
  if (!p.assigned_inventory_id) return { label: paused ? 'Bloquea' : 'Sin asignar', tone: paused ? 'bad' : 'warn' }
  return n(p.quantity_prepared) > 0 ? { label: 'Preparando', tone: 'info' } : { label: 'Por preparar', tone: 'muted' }
}

function Progress({ done, total, delivered }: { done: number; total: number; delivered: number }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}{delivered ? ` · ${delivered} entr.` : ''}</span>
    </div>
  )
}

const card = 'rounded-xl border border-border bg-card'
const th = 'px-2.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const td = 'px-2.5 py-3 align-middle text-sm'
const linkBtn = 'whitespace-nowrap text-xs font-semibold text-primary hover:underline disabled:opacity-40'

export default function OrderDetailClient({ initialOrder }: { initialOrder: any }) {
  const [order, setOrder] = useState(initialOrder)
  const [refreshKey, setRefreshKey] = useState(0)
  const [panel, setPanel] = useState<Panel>(null)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[] | null>(null)
  const [showEvoLines, setShowEvoLines] = useState(false)
  const [busy, setBusy] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  const loadActivityLog = useCallback(async () => {
    try {
      const { getOrderActivityLog } = await import('@/app/actions/client-queries')
      setActivityLog((await getOrderActivityLog(order.id)) || [])
    } catch (e) {
      console.error('Error cargando historial:', e)
    }
  }, [order.id])

  const hasDeliveries = order.status === 'entregado' || order.status === 'parcialmente_entregado'
    || (order.cut_orders || []).some((c: any) => n(c.quantity_delivered) > 0)
    || (order.preparation_items || []).some((p: any) => n(p.quantity_delivered) > 0)

  const loadDeliveries = useCallback(async () => {
    try {
      const { getDeliveryHistory } = await import('@/app/actions/delivery-history')
      setDeliveries(await getDeliveryHistory(order.id))
    } catch (e) {
      console.error('Error cargando entregas:', e)
      setDeliveries([])
    }
  }, [order.id])

  useEffect(() => { loadActivityLog() }, [loadActivityLog])
  useEffect(() => { if (hasDeliveries) loadDeliveries() }, [hasDeliveries, loadDeliveries])

  async function reloadOrder() {
    try {
      const updated = await getOrderById(order.id)
      if (updated) setOrder(updated)
      setRefreshKey(k => k + 1)
      await loadActivityLog()
      if (hasDeliveries) await loadDeliveries()
    } catch (e) {
      console.error('Error recargando pedido:', e)
    }
  }

  // Cambios desde la tablet (cortes, recogidas) sin recargar la página
  useAutoRefresh(order.id, () => getOrderById(order.id), {
    enabled: true,
    interval: 10,
    onChange: updated => {
      if (!updated) return
      setOrder(updated)
      setRefreshKey(k => k + 1)
      loadActivityLog()
    },
  })

  async function afterPanel() {
    setPanel(null)
    await reloadOrder()
  }

  const paused = order.status === 'aprobado_en_pausa'
  // En un pedido cerrado no se toca el stock de sus líneas
  const closed = order.status === 'entregado' || order.status === 'cancelado'
  // Orden estable: la base no garantiza el orden de las relaciones
  const byCreated = (a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at))
  const cuts: any[] = [...(order.cut_orders || [])].sort(byCreated)
  const preps: any[] = [...(order.preparation_items || [])].sort(byCreated)
  const missing = unassignedLines(order)
  const pendingLines = (order.lines || []).filter((l: any) => n(l.quantity_pending_approval) > 0)
  const activeLineId = panel?.type === 'assign' ? panel.line.item.id : panel?.type === 'reassign' ? panel.cut.id : null

  async function handleApproveModification(onHold: boolean) {
    const ok = await confirm(
      onHold ? '¿Aprobar la ampliación en pausa?' : '¿Aprobar la ampliación?',
      onHold
        ? 'Se crean las órdenes de lo añadido sin reservar stock y el pedido queda en pausa hasta que lo asignes aquí. La planta sigue con lo ya aprobado.'
        : 'Se comprueba el stock de lo añadido, se reserva y se crean sus órdenes de corte y preparación. Si algo no tiene stock, no se aprueba nada y te lo indica.',
      { variant: onHold ? 'warning' : 'success', confirmText: onHold ? 'Sí, en pausa' : 'Sí, aprobar' },
    )
    if (!ok) return
    setBusy(true)
    try {
      const res = await approveOrderModification(order.id, { onHold })
      if (res.success) toast.success(onHold ? 'Ampliación aprobada en pausa' : 'Ampliación aprobada y stock reservado')
      else toast.warning('Ampliación aprobada con incidencias', { description: res.errors?.join(' · ') })
      await reloadOrder()
    } catch (e: any) {
      toast.error('No se pudo aprobar la ampliación', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleUndoDelivery() {
    const ok = await confirm(
      '¿Deshacer la última entrega?',
      'El pedido vuelve al estado anterior, se reservan otra vez las unidades entregadas y queda registrado quién lo hizo. Solo se puede dentro de las 24 h siguientes al remito.',
      { variant: 'danger', confirmText: 'Sí, deshacer' },
    )
    if (!ok) return
    setBusy(true)
    try {
      await undoOrderDelivery(order.id)
      toast.success('Entrega deshecha')
      await reloadOrder()
    } catch (e: any) {
      toast.error('No se pudo deshacer la entrega', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  // Resumen
  const units = (order.lines || []).reduce((s: number, l: any) => s + (l.units || Math.ceil(Number(l.quantity)) || 0), 0)
  const pendingUnits = pendingLines.reduce((s: number, l: any) => s + n(l.quantity_pending_approval), 0)
  const done = cuts.reduce((s, c) => s + n(c.quantity_cut), 0) + preps.reduce((s, p) => s + n(p.quantity_prepared), 0)
  const total = cuts.reduce((s, c) => s + n(c.quantity_requested), 0) + preps.reduce((s, p) => s + n(p.quantity_requested), 0)
  const delivered = cuts.reduce((s, c) => s + n(c.quantity_delivered), 0) + preps.reduce((s, p) => s + n(p.quantity_delivered), 0)
  const missingUnits = cuts.filter(c => !c.material_base_id && c.status === 'pendiente').reduce((s, c) => s + n(c.quantity_requested) - n(c.quantity_cut), 0)
    + preps.filter(p => !p.assigned_inventory_id).reduce((s, p) => s + n(p.quantity_requested) - n(p.quantity_prepared), 0)
  const tiles = [
    { label: 'Cliente', value: order.client?.business_name || 'Sin cliente', detail: order.client?.tax_id ? `CUIT ${order.client.tax_id}` : order.client?.contact_name || '' },
    { label: 'Unidades pedidas', value: `${units}${pendingUnits ? ` +${pendingUnits}` : ''}`, detail: pendingUnits ? `${pendingUnits} pendientes de aprobar` : `${(order.lines || []).length} línea${(order.lines || []).length === 1 ? '' : 's'}` },
    { label: 'Planta', value: total ? `${done} / ${total}` : '—', detail: total ? (missingUnits ? `${missingUnits} unidades sin stock asignado` : done >= total ? 'todo cortado y preparado' : `${total - done} por hacer`) : 'sin órdenes todavía', warn: missingUnits > 0 },
    { label: 'Entregado', value: delivered ? `${delivered} / ${total}` : '—', detail: order.delivered_at ? formatDate(order.delivered_at) : delivered ? 'entrega parcial' : 'sin remito de EVO' },
  ]

  const lastActive = (deliveries || []).find(d => d.is_active)
  const canUndo = order.status === 'entregado' && lastActive && Date.now() - new Date(lastActive.delivered_at).getTime() <= 24 * 3600 * 1000

  return (
    <div className="space-y-5">
      <ConfirmDialog />

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/admin/pedidos" className="mt-0.5">
            <Button variant="outline" size="icon" aria-label="Volver a pedidos"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{order.order_number}</h1>
              <OrderStatusBadge status={order.status} size="md" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.client?.business_name || 'Sin cliente'} · entró el {formatDate(order.created_at)}
              {order.evo_order_id && order.evo_order_id !== order.order_number ? ` · EVO ${order.evo_order_id}` : ''}
              {order.delivered_at ? ` · entregado el ${formatDate(order.delivered_at)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paused && missing.length > 0 && (
            <Button size="sm" onClick={() => {
              const c = cuts.find(x => x.id === missing[0].id)
              setPanel({ type: 'assign', line: c ? { kind: 'cut', item: c } : { kind: 'prep', item: preps.find(x => x.id === missing[0].id) } })
            }}>
              Asignar lo que falta ({missing.length} {missing.length === 1 ? 'línea' : 'líneas'})
            </Button>
          )}
          <OrderActions key={refreshKey} order={order} onUpdate={reloadOrder} isHeaderMode />
        </div>
      </div>

      {/* Avisos */}
      {paused && (
        <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', missing.length ? 'border-warning/40 bg-warning/10' : 'border-success/40 bg-success/10')}>
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', missing.length ? 'bg-warning' : 'bg-success')} />
          <span className="flex-1 text-sm text-foreground">
            {missing.length
              ? <><strong>Para que la planta pueda empezar</strong> falta stock para {missing.map(m => m.code).join(', ')}. Lo que ya está reservado la planta ya lo ve.</>
              : <><strong>Todo tiene stock asignado.</strong> El pedido sale de la pausa en cuanto se recalcule su estado.</>}
          </span>
          <span className="hidden text-xs text-muted-foreground md:inline">se activa solo al asignar la última</span>
        </div>
      )}

      {order.status === 'modificado' && pendingLines.length > 0 && (
        <section className={cn(card, 'flex flex-col gap-4 border-warning/40 p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-warning">EVO amplió el pedido</div>
              <h2 className="text-base font-semibold text-foreground">Ampliación pendiente de aprobar</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">La planta sigue con lo ya aprobado; lo añadido no existe para ella hasta que lo apruebes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="success" size="sm" disabled={busy} onClick={() => handleApproveModification(false)}>Aprobar ampliación</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => handleApproveModification(true)}>Aprobar en pausa</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-border"><tr><th className={th}>Línea</th><th className={cn(th, 'text-right')}>Antes</th><th className={cn(th, 'text-right')}>Ahora</th><th className={cn(th, 'text-right')}>Cambio</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {(order.lines || []).map((l: any) => {
                  const before = l.units || Math.ceil(Number(l.quantity)) || 0
                  const add = n(l.quantity_pending_approval)
                  return (
                    <tr key={l.id} className={add ? 'bg-warning/5' : ''}>
                      <td className={td}><span className="font-semibold">{l.product?.code}</span>{!before && add ? <span className="ml-2"><Pill tone="warn">nueva</Pill></span> : null}<div className="text-xs text-muted-foreground">{l.product?.name}</div></td>
                      <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>{before || '—'}</td>
                      <td className={cn(td, 'text-right font-semibold tabular-nums')}>{before + add}</td>
                      <td className={cn(td, 'text-right font-semibold tabular-nums', add ? 'text-success' : 'text-muted-foreground')}>{add ? `+${add}` : '='}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Summary rows={[
            { label: 'Al aprobar', value: 'se crean órdenes solo para lo añadido y se reserva su stock' },
            { label: 'Si algo no tiene stock', value: 'aprueba en pausa y asígnalo después aquí', tone: 'warn' },
          ]} />
        </section>
      )}

      {/* Resumen */}
      <div className="admin-kpis">
        {tiles.map(t => (
          <div key={t.label} className={cn(card, 'p-4')}>
            <div className="text-xs font-semibold text-muted-foreground">{t.label}</div>
            <div className="mt-1 truncate text-xl font-bold text-foreground" title={String(t.value)}>{t.value}</div>
            <div className={cn('mt-1 truncate text-xs', t.warn ? 'font-medium text-warning' : 'text-muted-foreground')}>{t.detail}</div>
          </div>
        ))}
      </div>

      <div className="admin-split" style={{ ['--aside-w' as string]: 'clamp(320px, 25vw, 400px)' }}>
        <div className="flex min-w-0 flex-col gap-5">
          {/* Líneas */}
          <section className={cn(card, 'overflow-hidden')}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold text-foreground">Líneas del pedido</h2>
              <span className="text-xs text-muted-foreground">una fila por orden de corte o artículo · las acciones abren el panel de la derecha</span>
            </div>
            {cuts.length + preps.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                {order.status === 'nuevo' ? 'Al aprobar el pedido se crean aquí sus órdenes de corte y preparación.' : 'Este pedido no tiene órdenes de corte ni artículos a preparar.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b border-border bg-muted/40">
                    <tr><th className={th}>Producto</th><th className={cn(th, 'text-right')}>Pedido</th><th className={th}>Stock asignado</th><th className={th}>Estado · planta</th><th className={cn(th, 'text-right')}>Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {cuts.map(c => {
                      const st = cutState(c, paused)
                      const pending = !closed && c.status === 'pendiente' && n(c.quantity_cut) < n(c.quantity_requested)
                      return (
                        <tr key={c.id} className={cn(activeLineId === c.id && 'bg-primary/5', st.tone === 'bad' && activeLineId !== c.id && 'bg-destructive/5')}>
                          <td className={td}>
                            <div className="font-semibold text-foreground">{c.product?.code}</div>
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={c.product?.name}>{c.product?.name}</div>
                          </td>
                          <td className={cn(td, 'text-right tabular-nums')}>{n(c.quantity_requested)}</td>
                          <td className={td}>
                            {c.material_base_id ? (
                              <span className="whitespace-nowrap">
                                de <strong>{c.material_base?.code || 'chapa asignada'}</strong>
                                {c.material_base?.code === c.product?.code && <span className="ml-1.5"><Pill tone="ok">exacta</Pill></span>}
                              </span>
                            ) : c.status === 'pendiente_confirmacion' ? (
                              <span className="text-xs text-muted-foreground">reasignada de otro pedido</span>
                            ) : (
                              <Pill tone={paused ? 'bad' : 'warn'}>Sin asignar</Pill>
                            )}
                          </td>
                          <td className={td}>
                            <div className="flex flex-col items-start gap-1.5">
                              <Pill tone={st.tone}>{st.label}</Pill>
                              <Progress done={n(c.quantity_cut)} total={n(c.quantity_requested)} delivered={n(c.quantity_delivered)} />
                            </div>
                          </td>
                          <td className={cn(td, 'text-right')}>
                            {pending ? (
                              <span className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1">
                                <button type="button" className={linkBtn} onClick={() => setPanel({ type: 'assign', line: { kind: 'cut', item: c } })}>{c.material_base_id ? 'Cambiar chapa' : 'Asignar'}</button>
                                <button type="button" className={linkBtn} onClick={() => setPanel({ type: 'reassign', cut: c })}>Reasignar</button>
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {preps.map(p => {
                      const st = prepState(p, paused)
                      const pending = !closed && n(p.quantity_prepared) < n(p.quantity_requested) && p.status !== 'entregado'
                      return (
                        <tr key={p.id} className={cn(activeLineId === p.id && 'bg-primary/5', st.tone === 'bad' && activeLineId !== p.id && 'bg-destructive/5')}>
                          <td className={td}>
                            <div className="font-semibold text-foreground">{p.product?.code}</div>
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={p.product?.name}>{p.product?.name}</div>
                          </td>
                          <td className={cn(td, 'text-right tabular-nums')}>{n(p.quantity_requested)}</td>
                          <td className={td}>
                            {p.assigned_inventory ? (
                              <span className="whitespace-nowrap"><strong>{p.assigned_inventory.product?.code}</strong> <span className="text-xs text-muted-foreground">· {new Intl.NumberFormat('es-AR').format(n(p.assigned_inventory.stock_disponible))} disp.</span></span>
                            ) : (
                              <Pill tone={paused ? 'bad' : 'warn'}>Sin asignar</Pill>
                            )}
                          </td>
                          <td className={td}>
                            <div className="flex flex-col items-start gap-1.5">
                              <Pill tone={st.tone}>{st.label}</Pill>
                              <Progress done={n(p.quantity_prepared)} total={n(p.quantity_requested)} delivered={n(p.quantity_delivered)} />
                            </div>
                          </td>
                          <td className={cn(td, 'text-right')}>
                            {pending ? (
                              <button type="button" className={linkBtn} onClick={() => setPanel({ type: 'assign', line: { kind: 'prep', item: p } })}>{p.assigned_inventory_id ? 'Cambiar' : 'Asignar'}</button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-border px-5 py-2.5">
              <button type="button" onClick={() => setShowEvoLines(v => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                {showEvoLines ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showEvoLines ? 'Ocultar el pedido tal como lo mandó EVO' : 'Ver el pedido tal como lo mandó EVO'}
              </button>
            </div>
            {showEvoLines && (
              <div className="overflow-x-auto border-t border-border">
                <table className="min-w-full">
                  <thead className="bg-muted/40"><tr><th className={th}>Producto</th><th className={cn(th, 'text-right')}>Cantidad</th><th className={cn(th, 'text-right')}>Precio unit.</th><th className={cn(th, 'text-right')}>Subtotal</th></tr></thead>
                  <tbody className="divide-y divide-border/60">
                    {(order.lines || []).map((l: any) => (
                      <tr key={l.id}>
                        <td className={td}><span className="font-semibold">{l.product?.code}</span> <span className="text-muted-foreground">{l.product?.name}</span></td>
                        <td className={cn(td, 'text-right tabular-nums')}>{l.units || Math.ceil(l.quantity) || 0}{n(l.quantity_pending_approval) ? <span className="ml-1 text-warning">+{l.quantity_pending_approval}</span> : null}</td>
                        <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>{formatCurrency(l.unit_price)}</td>
                        <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(l.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Entregas */}
          {hasDeliveries && (
            <section className={cn(card, 'flex flex-col gap-4 p-5')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Entregas y remitos</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Las entregas las manda EVO con el remito. Si EVO se equivocó, la última se puede deshacer dentro de 24 h.</p>
                </div>
                {canUndo && <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={handleUndoDelivery}>Deshacer la última entrega</Button>}
              </div>
              {deliveries === null ? (
                <div className="text-sm text-muted-foreground">Cargando entregas…</div>
              ) : deliveries.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin remitos registrados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="border-b border-border"><tr><th className={th}>Fecha</th><th className={th}>Tipo</th><th className={th}>Líneas</th><th className={cn(th, 'text-right')}>Unidades</th><th className={th}>Estado</th></tr></thead>
                    <tbody className="divide-y divide-border/60">
                      {deliveries.map(d => {
                        const items: any[] = Array.isArray(d.stock_consumed) ? d.stock_consumed : []
                        const unitsOut = items.reduce((s, i) => s + n(i.cantidad), 0)
                        return (
                          <tr key={d.id} className={d.is_active ? '' : 'opacity-60'}>
                            <td className={cn(td, 'whitespace-nowrap')}>{new Date(d.delivered_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</td>
                            <td className={td}>{d.delivery_type === 'partial' ? 'Parcial' : 'Completa'}</td>
                            <td className={td}>{items.length ? items.map(i => `${n(i.cantidad)} × ${i.codart}`).join(' · ') : 'todo lo pendiente'}</td>
                            <td className={cn(td, 'text-right tabular-nums')}>{unitsOut || '—'}</td>
                            <td className={td}><Pill tone={d.is_active ? 'info' : 'muted'}>{d.is_active ? 'EVO' : 'Deshecha'}</Pill></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Columna derecha: panel activo o notas e historial */}
        <aside className="flex min-w-0 flex-col gap-5">
          {panel?.type === 'assign' && (
            <AssignStockPanel key={panel.line.item.id} order={order} line={panel.line} onClose={() => setPanel(null)} onDone={afterPanel} />
          )}
          {panel?.type === 'reassign' && (
            <ReassignPanel key={panel.cut.id} order={order} cut={panel.cut} onClose={() => setPanel(null)} onDone={afterPanel} />
          )}

          <OrderNotesAdmin orderId={order.id} />

          <section className={cn(card, 'flex flex-col gap-3 p-5')}>
            <h2 className="text-base font-semibold text-foreground">Historial</h2>
            {activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
            ) : (
              <ol className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
                {activityLog.map(a => (
                  <li key={a.id} className="flex gap-3 text-[13px]">
                    <span className="w-[74px] shrink-0 tabular-nums text-muted-foreground">
                      {new Date(a.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                    </span>
                    <span className="text-foreground">{a.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
