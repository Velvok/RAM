'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, AlertTriangle, Scissors, Package, Truck, Activity } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getOperationalDashboard, type OperationalDashboard, type DashboardTile } from '@/app/actions/dashboard-operativo'

const toneStyles: Record<DashboardTile['tone'], string> = {
  default: 'text-muted-foreground',
  warning: 'text-amber-600',
  success: 'text-emerald-600',
  danger: 'text-destructive',
}

const stateLabel: Record<string, { label: string; className: string }> = {
  cortando: { label: 'Cortando', className: 'bg-blue-100 text-blue-800' },
  preparando: { label: 'Preparando', className: 'bg-blue-100 text-blue-800' },
  confirmar: { label: 'Confirmar recogida', className: 'bg-amber-100 text-amber-800' },
  pendiente: { label: 'Pendiente', className: 'bg-muted text-foreground/80' },
  sin_stock: { label: 'Sin stock', className: 'bg-orange-100 text-orange-800' },
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

function shortDate(iso?: string) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n)
}

export function DashboardOperativo({ initial }: { initial: OperationalDashboard }) {
  const [data, setData] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)
  // La fecha se formatea solo en el cliente (evita diferencias de locale con el servidor)
  const [generatedLabel, setGeneratedLabel] = useState('')
  useEffect(() => {
    setGeneratedLabel(new Date(data.generatedAt).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))
  }, [data.generatedAt])

  async function refresh() {
    setRefreshing(true)
    try {
      setData(await getOperationalDashboard())
    } catch (e) {
      console.error('Error actualizando el dashboard:', e)
    } finally {
      setRefreshing(false)
    }
  }

  // Refresco cada minuto mientras la pestaña está visible
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) refresh() }, 60000)
    return () => clearInterval(id)
  }, [])

  const maxDaily = Math.max(1, ...data.daily.map(d => d.units))
  const avgDaily = data.daily.reduce((s, d) => s + d.units, 0) / data.daily.length
  const today = data.daily[data.daily.length - 1]?.units ?? 0
  const deltaWeek = data.week.delivered - data.week.deliveredPrevWeek

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hoy en RAM</h1>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {generatedLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Actualizar
          </button>
          <Link href="/admin/pedidos?status=nuevo" className="inline-flex h-10 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Aprobar pendientes ({data.tiles[0].value})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {data.tiles.map(t => (
          <Link key={t.key} href={t.href} className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="text-xs font-semibold text-muted-foreground">{t.label}</div>
            <div className={cn('mt-1 text-3xl font-bold leading-none', t.tone === 'danger' && 'text-destructive', t.tone === 'success' && typeof t.value === 'string' && 'text-emerald-600')}>{t.value}</div>
            <div className={cn('mt-2 text-xs font-medium', toneStyles[t.tone])}>{t.detail}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" />Requiere acción</h2>
              <span className="text-xs text-muted-foreground">{data.actions.length ? 'ordenado por urgencia' : 'nada pendiente'}</span>
            </div>
            {data.actions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Todo al día: ningún pedido esperando una decisión.</p>
            ) : (
              <ul className="space-y-2">
                {data.actions.map((a, i) => (
                  <li key={i}>
                    <Link
                      href={a.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/60',
                        a.severity === 'alta' ? 'border-orange-200 bg-orange-50' : 'border-border bg-muted/30'
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', a.severity === 'alta' ? 'bg-orange-500' : 'bg-blue-500')} />
                      <span className="min-w-0 flex-1 text-foreground">
                        <strong>{a.orderNumber}</strong>{a.client ? ` · ${a.client}` : ''} · {a.text}
                      </span>
                      <span className="flex-shrink-0 text-xs font-semibold text-primary">{a.cta}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Scissors className="h-4 w-4 text-primary" />Planta ahora</h2>
              <span className="text-xs text-muted-foreground">
                {data.planta.activeOperators} operario{data.planta.activeOperators === 1 ? '' : 's'} activo{data.planta.activeOperators === 1 ? '' : 's'} · último movimiento {timeAgo(data.planta.lastCutAt)}
              </span>
            </div>
            {data.planta.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay órdenes abiertas en planta.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Pedido</th>
                      <th className="py-2 pr-3 font-semibold">Producto</th>
                      <th className="py-2 pr-3 font-semibold">Material</th>
                      <th className="py-2 pr-3 font-semibold">Operario</th>
                      <th className="py-2 pr-3 font-semibold">Progreso</th>
                      <th className="py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.planta.rows.map(r => (
                      <tr key={r.reference} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3"><Link href={`/admin/pedidos/${r.orderId}`} className="font-semibold text-foreground hover:text-primary">{r.orderNumber}</Link><div className="text-xs text-muted-foreground">{r.reference}</div></td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{r.product}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{r.material}</td>
                        <td className="py-2.5 pr-3">{r.operator}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${r.total ? Math.min(100, (r.done / r.total) * 100) : 0}%` }} /></div>
                            <span className="text-xs text-muted-foreground">{r.done}/{r.total}</span>
                          </div>
                        </td>
                        <td className="py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', stateLabel[r.state].className)}>{stateLabel[r.state].label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Activity className="h-4 w-4 text-primary" />Unidades cortadas y preparadas · últimos 14 días</h2>
              <span className="text-xs text-muted-foreground">media {fmt(avgDaily)}/día · hoy {today}</span>
            </div>
            <div className="flex h-28 items-end gap-1.5">
              {data.daily.map((d, i) => (
                <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.units}`}>
                  <div className={cn('w-full rounded-t', i === data.daily.length - 1 ? 'bg-primary' : d.units ? 'bg-primary/40' : 'bg-muted')} style={{ height: `${Math.max(4, (d.units / maxDaily) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{shortDate(data.daily[0]?.date)}</span><span>{shortDate(data.daily[6]?.date)}</span><span>hoy</span>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Package className="h-4 w-4 text-primary" />Stock comprometido</h2>
              <Link href="/admin/stock" className="text-xs font-semibold text-primary">Ver inventario</Link>
            </div>
            {data.stock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Ningún pedido abierto necesita stock.</p>
            ) : (
              <div className="space-y-3">
                {data.stock.map(s => {
                  const pct = s.available > 0 ? Math.min(100, ((s.reserved + s.pendingApproval) / (s.available + s.reserved)) * 100) : 100
                  return (
                    <div key={s.productId}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-foreground">{s.code}</span>
                        <span className={cn('text-xs font-semibold', s.missing ? 'text-orange-700' : s.coverageMonths != null && s.coverageMonths < 1 ? 'text-amber-700' : 'text-emerald-700')}>
                          {s.missing ? `faltan ${fmt(s.missing)}${s.alternative === 'mismo largo' ? ' · hay stock sin asignar' : s.alternative ? ` · cortar de ${s.alternative}` : ''}` : s.coverageMonths != null ? (s.coverageMonths > 36 ? 'cubre más de 3 años' : `cubre ${fmt(s.coverageMonths)} meses`) : 'sin histórico de ventas'}
                        </span>
                      </div>
                      <div className={cn('mt-1 h-2 overflow-hidden rounded-full', s.missing ? 'bg-red-100' : 'bg-muted')}><div className={cn('h-full', s.missing ? 'bg-red-500' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>
                      <div className="mt-1 text-xs text-muted-foreground">disponible {fmt(s.available)} · reservado {fmt(s.reserved)} · pendiente de aprobar {fmt(s.pendingApproval)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground"><Truck className="h-4 w-4 text-primary" />Integración EVO · 24 h</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Pedidos recibidos', data.evo.inbound],
                ['Remitos recibidos', data.evo.deliveries],
                ['Movimientos enviados', data.evo.outbound],
                ['Confirmación media', data.evo.avgConfirmSeconds == null ? '—' : `${data.evo.avgConfirmSeconds} s`],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-muted/50 p-3">
                  <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <p className={cn('mt-3 flex items-center gap-2 text-sm', data.evo.failed ? 'text-destructive' : data.evo.pending ? 'text-amber-700' : 'text-emerald-700')}>
              <span className={cn('h-2 w-2 rounded-full', data.evo.failed ? 'bg-destructive' : data.evo.pending ? 'bg-amber-500' : 'bg-emerald-600')} />
              {data.evo.failed ? `${data.evo.failed} evento(s) fallidos` : data.evo.pending ? `${data.evo.pending} evento(s) esperando confirmación` : 'Sin eventos fallidos ni pendientes'}
              <Link href="/admin/logs" className="ml-auto text-xs font-semibold text-primary">Logs</Link>
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">Esta semana</h2>
            <dl className="space-y-2 text-sm">
              {[
                ['Pedidos entregados', `${data.week.delivered} (${deltaWeek >= 0 ? '+' : ''}${deltaWeek} vs anterior)`],
                ['Aprobar → finalizado', data.week.avgApproveToFinishDays == null ? 'sin datos' : `${fmt(data.week.avgApproveToFinishDays)} días`],
                ['Finalizado → remito', data.week.avgFinishToDeliveryDays == null ? 'sin datos' : `${fmt(data.week.avgFinishToDeliveryDays)} días`],
                ['Chapas cortadas', `${fmt(data.week.sheetsCut)} uds`],
                ['Remanentes generados', `${fmt(data.week.remnantSheets)} uds`],
                ['Cambios de tamaño', data.week.sizeChanges],
                ['Reasignaciones', data.week.reassignments],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
