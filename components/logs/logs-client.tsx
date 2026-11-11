'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField, FIELD_CLS } from '@/components/ui/select-field'
import { useConfirm } from '@/components/confirm-modal'
import { cn } from '@/lib/utils'
import {
  getIntegrationHealth, getIntegrationLogs, retryOutboundEvent, sendTestEvent,
  type IntegrationLog, type LogsFilters,
} from '@/app/actions/integration-logs'

type Health = Awaited<ReturnType<typeof getIntegrationHealth>>
type Log = IntegrationLog
type StatusChip = 'all' | 'failed' | 'pending' | 'success'
type Period = '24h' | '7d' | '30d' | 'all'

const PERIOD_MS: Record<Period, number | null> = { '24h': 24 * 3600e3, '7d': 7 * 24 * 3600e3, '30d': 30 * 24 * 3600e3, all: null }
const TYPE_LABEL: Record<string, string> = {
  pedido_creado: 'pedido creado', pedido_modificado: 'pedido modificado', pedido_entregado: 'pedido entregado',
  stock_actualizado: 'stock actualizado', evo_confirmacion: 'confirmación', corte_realizado: 'corte realizado',
  chapa_preparada: 'chapa preparada', pedido_completado: 'pedido completado', test_ping: 'prueba',
}

function hora(iso: string) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...(today ? {} : { day: '2-digit', month: '2-digit' }), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}
function hace(iso: string | null) {
  if (!iso) return 'nunca'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
}
function statusPill(l: Log): { label: string; cls: string } {
  if (l.status === 'failed') return { label: 'Fallido', cls: 'bg-destructive/10 text-destructive' }
  if (l.status === 'cancelled') return { label: 'Descartado', cls: 'bg-muted text-muted-foreground' }
  if (l.status === 'pending') return { label: 'En cola', cls: 'bg-warning/10 text-warning' }
  if (l.status === 'processing') return { label: l.direction === 'outbound' ? 'Esperando a EVO' : 'Procesando', cls: 'bg-warning/10 text-warning' }
  return { label: l.direction === 'outbound' ? 'Confirmado' : 'Procesado', cls: 'bg-success/10 text-success' }
}
function summarize(l: Log): string {
  const p = l.payload || {}
  if (Array.isArray(p.items)) return `${p.items.length} ${p.items.length === 1 ? 'línea' : 'líneas'}${p.cliente?.nombre ? ` · ${p.cliente.nombre}` : ''}`
  if (Array.isArray(p.movimientos)) return p.movimientos.map((m: any) => `${m.cantidad} × ${m.codart || m.id_articulo || ''}`.trim()).slice(0, 2).join(' · ')
  if (p.codart || p.id_articulo) return `${p.codart || p.id_articulo}${p.stock != null ? ` → ${p.stock}` : ''}`
  if (p.estado) return `estado ${p.estado}`
  return ''
}

function Kpi({ label, value, detail, tone }: { label: string; value: ReactNode; detail: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={cn('text-[26px] font-bold leading-none', tone === 'ok' && 'text-success', tone === 'warn' && 'text-warning', tone === 'bad' && 'text-destructive')}>{value}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}

export function LogsClient({ initialLogs, totalLogs, eventTypes, initialHealth }: {
  initialLogs: Log[]
  totalLogs: number
  eventTypes: string[]
  initialHealth: Health
}) {
  const [logs, setLogs] = useState<Log[]>(initialLogs)
  const [total, setTotal] = useState(totalLogs)
  const [health, setHealth] = useState<Health>(initialHealth)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [eventType, setEventType] = useState('')
  const [period, setPeriod] = useState<Period>('7d')
  const [chip, setChip] = useState<StatusChip>('all')
  const [limit, setLimit] = useState(100)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const my = ++seq.current
    const ms = PERIOD_MS[period]
    const filters: LogsFilters = {
      direction, eventType: eventType || undefined, search: search || undefined, limit,
      status: chip === 'all' || chip === 'pending' ? 'all' : chip,
      fromDate: ms ? new Date(Date.now() - ms).toISOString() : undefined,
    }
    try {
      const [res, h] = await Promise.all([getIntegrationLogs(filters), getIntegrationHealth()])
      if (my !== seq.current) return
      // "En cola" incluye los que esperan confirmación de EVO
      const list = chip === 'pending' ? (res.logs as Log[]).filter(l => l.status === 'pending' || l.status === 'processing') : (res.logs as Log[])
      setLogs(list)
      setTotal(chip === 'pending' ? list.length : res.total)
      setHealth(h)
    } catch (e) {
      console.error('Error cargando eventos:', e)
    }
  }, [direction, eventType, search, limit, chip, period])

  useEffect(() => {
    const t = setTimeout(refresh, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [refresh, search])

  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) refresh() }, 15000)
    return () => clearInterval(t)
  }, [refresh])

  const selected = logs.find(l => l.id === selectedId) || null

  async function retry(log: Log) {
    const ok = await confirm(
      '¿Reenviar este evento a EVO?',
      `Se vuelve a enviar «${TYPE_LABEL[log.event_type] || log.event_type}»${log.order_number ? ` del pedido ${log.order_number}` : ''} tal cual se generó. En RAM ya está registrado; esto solo avisa a EVO.`,
      { variant: 'warning', confirmText: 'Sí, reenviar' },
    )
    if (!ok) return
    setBusy(true)
    try {
      const res: any = await retryOutboundEvent(log.id)
      if (res?.success) toast.success('Evento reenviado a EVO')
      else toast.error('EVO no lo aceptó', { description: res?.error })
      await refresh()
    } catch (e: any) {
      toast.error('No se pudo reenviar', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  async function sendPing() {
    const ok = await confirm('¿Enviar un ping de prueba a EVO?', 'Se encola un evento de prueba sin datos reales para comprobar que EVO responde.', { variant: 'info', confirmText: 'Enviar' })
    if (!ok) return
    try {
      await sendTestEvent()
      toast.success('Ping encolado', { description: 'El resultado aparece en la lista en unos segundos' })
      setTimeout(refresh, 1500)
    } catch (e: any) {
      toast.error('No se pudo enviar el ping', { description: e?.message })
    }
  }

  const queueTone = health.failed ? 'bad' : health.pending || health.unconfirmed10m ? 'warn' : 'ok'
  const queueValue = health.failed ? `${health.failed} ${health.failed === 1 ? 'fallo' : 'fallos'}` : health.pending ? `${health.pending} en cola` : 'Al día'
  const typeLine = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, c]) => `${c} ${TYPE_LABEL[t] || t}`).join(' · ') || 'nada'

  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
  const td = 'px-3 py-2.5 text-[13px] align-middle'

  return (
    <div className="space-y-5">
      <ConfirmDialog />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-foreground">Integración EVO</h1>
          <p className="text-sm text-muted-foreground">Todo lo que entra desde el ERP y todo lo que RAM le envía · la cola manda un evento cada vez</p>
        </div>
        <Button variant="outline" onClick={sendPing}>Enviar ping de prueba</Button>
      </div>

      <div className="admin-kpis">
        <Kpi label="Estado de la cola" value={queueValue} tone={queueTone} detail={`último confirmado ${hace(health.lastConfirmedAt)}`} />
        <Kpi label="Recibidos · 24 h" value={health.inbound24} detail={typeLine(health.inboundByType)} />
        <Kpi label="Enviados · 24 h" value={health.outbound24} detail={typeLine(health.outboundByType)} />
        <Kpi label="Confirmados por EVO" value={`${health.confirmed24} / ${health.outbound24}`} tone={health.outbound24 && health.confirmed24 === health.outbound24 ? 'ok' : undefined} detail={health.avgConfirmSeconds != null ? `confirmación media ${health.avgConfirmSeconds} s` : health.outbound24 ? 'ninguno confirmado todavía' : 'sin envíos en 24 h'} />
        <Kpi label="Sin confirmar > 10 min" value={health.unconfirmed10m} tone={health.unconfirmed10m ? 'warn' : undefined} detail="EVO suele tardar 15–45 s" />
        <Kpi label="Fallos al procesar · 24 h" value={health.inboundFailed24} tone={health.inboundFailed24 ? 'bad' : undefined} detail="mensajes de EVO que RAM no pudo aplicar" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Buscar
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pedido, tipo de evento o texto del error…" className={cn(FIELD_CLS, 'pr-3')} />
        </label>
        <label className="flex w-36 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Dirección
          <SelectField value={direction} onChange={e => setDirection(e.target.value as any)}>
            <option value="all">Ambas</option>
            <option value="inbound">EVO → RAM</option>
            <option value="outbound">RAM → EVO</option>
          </SelectField>
        </label>
        <label className="flex w-44 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Tipo
          <SelectField value={eventType} onChange={e => setEventType(e.target.value)}>
            <option value="">Todos</option>
            {eventTypes.map(t => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}
          </SelectField>
        </label>
        <label className="flex w-36 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Periodo
          <SelectField value={period} onChange={e => setPeriod(e.target.value as Period)}>
            <option value="24h">Últimas 24 h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="all">Todo</option>
          </SelectField>
        </label>
        <div className="flex flex-wrap gap-2">
          {([['all', 'Todos'], ['failed', 'Fallidos'], ['pending', 'En cola'], ['success', 'Correctos']] as [StatusChip, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setChip(k)}
              className={cn('inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                chip === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-primary/40',
                chip !== k && k === 'failed' && 'text-destructive', chip !== k && k === 'pending' && 'text-warning')}
            >
              {label}{k === 'failed' && health.failed ? ` · ${health.failed}` : ''}{k === 'pending' && health.pending ? ` · ${health.pending}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-split" style={{ ['--aside-w' as string]: 'clamp(320px, 26vw, 380px)' }}>
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <h2 className="text-base font-semibold text-foreground">Eventos</h2>
            <span className="text-xs text-muted-foreground">{total} en el periodo · clic en una fila para ver el detalle</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-y border-border bg-muted/40">
                <tr><th className={th}></th><th className={th}>Hora</th><th className={th}>Evento</th><th className={th}>Pedido · contenido</th><th className={th}>Estado</th><th className={th}>Detalle</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No hay eventos con estos filtros.</td></tr>}
                {logs.map(l => {
                  const st = statusPill(l)
                  const secs = l.direction === 'outbound' && l.status === 'success' && l.completed_at ? Math.round((new Date(l.completed_at).getTime() - new Date(l.created_at).getTime()) / 1000) : null
                  return (
                    <tr
                      key={`${l.direction}-${l.id}`}
                      onClick={() => setSelectedId(l.id === selectedId ? null : l.id)}
                      className={cn('cursor-pointer transition-colors hover:bg-muted/40', l.id === selectedId && 'bg-primary/5', l.status === 'failed' && l.id !== selectedId && 'bg-destructive/5')}
                    >
                      <td className={td}>
                        <span title={l.direction === 'inbound' ? 'EVO → RAM' : 'RAM → EVO'} className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', l.direction === 'inbound' ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary')}>
                          {l.direction === 'inbound' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                        </span>
                      </td>
                      <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{hora(l.created_at)}</td>
                      <td className={cn(td, 'whitespace-nowrap font-medium')}>{TYPE_LABEL[l.event_type] || l.event_type}</td>
                      <td className={cn(td, 'max-w-[320px] truncate')}>
                        {l.order_number && (l.order_id
                          ? <Link onClick={e => e.stopPropagation()} href={`/admin/pedidos/${l.order_id}`} className="font-semibold text-primary hover:underline">{l.order_number}</Link>
                          : <strong>{l.order_number}</strong>)}
                        {summarize(l) && <span className="text-muted-foreground">{l.order_number ? ' · ' : ''}{summarize(l)}</span>}
                      </td>
                      <td className={td}><span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', st.cls)}>{st.label}</span></td>
                      <td className={cn(td, 'max-w-[220px] truncate text-muted-foreground')} title={l.error_message || ''}>
                        {l.status === 'failed' ? (l.error_message || `${l.attempts} intentos`) : secs != null ? `confirmado en ${secs} s` : l.http_status ? `HTTP ${l.http_status}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {total > logs.length && chip !== 'pending' && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span>Mostrando {logs.length} de {total}</span>
              <button type="button" onClick={() => setLimit(l => l + 100)} className="font-semibold text-primary hover:underline">Cargar anteriores</button>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5 ">
          {selected ? (
            <section className="flex flex-col gap-4 rounded-xl border border-primary/60 bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">{TYPE_LABEL[selected.event_type] || selected.event_type}{selected.order_number ? ` · ${selected.order_number}` : ''}</h2>
                  <p className="text-xs text-muted-foreground">{selected.direction === 'inbound' ? 'EVO → RAM' : 'RAM → EVO'} · {new Date(selected.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', statusPill(selected).cls)}>{statusPill(selected).label}</span>
                  <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar detalle" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {selected.direction === 'outbound' && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Intentos</span><strong>{selected.attempts}</strong></div>}
                {selected.http_status != null && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Respuesta HTTP</span><strong>{selected.http_status}</strong></div>}
                {selected.completed_at && <div className="flex justify-between gap-3"><span className="text-muted-foreground">{selected.direction === 'outbound' ? 'Confirmado' : 'Procesado'}</span><strong>{new Date(selected.completed_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23' })}</strong></div>}
                {selected.order_id && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Pedido</span><Link href={`/admin/pedidos/${selected.order_id}`} className="font-semibold text-primary hover:underline">{selected.order_number}</Link></div>}
              </div>
              {selected.error_message && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs leading-relaxed text-destructive">{selected.error_message}</div>
              )}
              {selected.direction === 'outbound' && selected.status === 'failed' && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-xs leading-relaxed text-warning">
                  El movimiento ya está registrado en RAM. Solo falta avisar a EVO: reenvíalo cuando el ERP vuelva a responder.
                </div>
              )}
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-200">{JSON.stringify(selected.payload, null, 2)}</pre>
              {selected.response_body != null && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-muted-foreground">Respuesta de EVO</summary>
                  <pre className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-mono text-[11px]">{typeof selected.response_body === 'string' ? selected.response_body : JSON.stringify(selected.response_body, null, 2)}</pre>
                </details>
              )}
              <div className="flex gap-2">
                {selected.direction === 'outbound' && selected.status === 'failed' && (
                  <Button className="flex-1" disabled={busy} onClick={() => retry(selected)}>{busy ? 'Reenviando…' : 'Reenviar a EVO'}</Button>
                )}
                <Button variant="outline" className={selected.direction === 'outbound' && selected.status === 'failed' ? '' : 'flex-1'} onClick={() => { navigator.clipboard?.writeText(JSON.stringify(selected.payload, null, 2)); toast.success('Payload copiado') }}>
                  <Copy className="h-4 w-4" />Copiar payload
                </Button>
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Salud de la conexión</h2>
              <div className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Último mensaje de EVO</span><strong>{hace(health.lastInboundAt)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Último envío confirmado</span><strong>{hace(health.lastConfirmedAt)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Confirmados · 30 días</span><strong>{health.confirmRate30d != null ? `${health.confirmRate30d} %` : '—'}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Pendientes en cola</span><strong>{health.pending}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Fallidos sin reenviar</span><strong className={health.failed ? 'text-destructive' : ''}>{health.failed}</strong></div>
              </div>
              <p className="text-xs text-muted-foreground">Pulsa un evento para ver su contenido y, si falló, reenviarlo.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
