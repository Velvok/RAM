'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { extractSizeFromCode } from '@/lib/product-utils'
import { cutPlan, formatMeters, productLength, sortByRemnant } from '@/lib/planta-tasks'

// Paneles laterales del detalle de pedido: asignar o cambiar la chapa/stock de
// una línea y traer chapas cortadas de otro pedido. Sustituyen a los modales
// antiguos y siempre enseñan, antes del botón, qué va a pasar.

const n = (v: unknown) => Number(v) || 0

export type PanelLine = { kind: 'cut'; item: any } | { kind: 'prep'; item: any }

/** Líneas del pedido que siguen sin stock (para saber si el pedido saldrá de la pausa). */
export function unassignedLines(order: any) {
  const cuts = (order.cut_orders || []).filter((c: any) => !c.material_base_id && c.status === 'pendiente')
  const preps = (order.preparation_items || []).filter((p: any) => !p.assigned_inventory_id && n(p.quantity_prepared) < n(p.quantity_requested))
  return [...cuts.map((c: any) => ({ id: c.id, code: c.product?.code })), ...preps.map((p: any) => ({ id: p.id, code: p.product?.code }))]
}

export function PanelShell({ eyebrow, title, subtitle, onClose, children, footer }: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/60 bg-card p-5 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{eyebrow}</div>}
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar panel" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
      {footer}
    </section>
  )
}

export function Stepper({ value, onChange, min = 1, max }: { value: number; onChange: (v: number) => void; min?: number; max: number }) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" aria-label="Una menos" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="flex h-9 w-9 items-center justify-center hover:bg-muted disabled:opacity-30"><Minus className="h-4 w-4" /></button>
      <span className="w-12 text-center text-base font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label="Una más" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="flex h-9 w-9 items-center justify-center hover:bg-muted disabled:opacity-30"><Plus className="h-4 w-4" /></button>
    </span>
  )
}

export function Summary({ rows }: { rows: { label: string; value: ReactNode; tone?: 'ok' | 'warn' }[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[13px]">
      {rows.map(r => (
        <div key={r.label} className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">{r.label}</span>
          <strong className={cn('text-right font-semibold', r.tone === 'ok' && 'text-success', r.tone === 'warn' && 'text-warning')}>{r.value}</strong>
        </div>
      ))}
    </div>
  )
}

function OptionRow({ active, onClick, title, badge, detail, rightLabel, right, rightTone }: {
  active: boolean
  onClick: () => void
  title: string
  badge?: ReactNode
  detail: ReactNode
  rightLabel: string
  right: ReactNode
  rightTone?: 'ok'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors', active ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.15)]' : 'border-border hover:border-primary/40')}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">{title}{badge}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rightLabel}</div>
        <div className={cn('text-sm font-bold', rightTone === 'ok' && 'text-success')}>{right}</div>
      </div>
    </button>
  )
}

const Pill = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' }) => (
  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', tone === 'ok' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>{children}</span>
)

/** Asignar o cambiar el stock de una orden de corte o de un artículo a preparar. */
export function AssignStockPanel({ order, line, onClose, onDone }: { order: any; line: PanelLine; onClose: () => void; onDone: () => Promise<void> | void }) {
  const isCut = line.kind === 'cut'
  const item = line.item
  const code: string = item.product?.code || ''
  const pieceLength = productLength(item.product)
  const remaining = isCut ? n(item.quantity_requested) - n(item.quantity_cut) : n(item.quantity_requested) - n(item.quantity_prepared)
  const currentProductId: string | null = isCut ? item.material_base_id : item.assigned_inventory?.product_id || null
  const currentCode: string | null = isCut ? item.material_base?.code || null : item.assigned_inventory?.product?.code || null

  const [rows, setRows] = useState<any[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(Math.max(1, remaining))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('@/app/actions/get-available-stock')
      .then(({ getAvailableStock }) => getAvailableStock(code))
      .then(data => {
        if (cancelled) return
        const list = (data || []).map((r: any) => ({ ...r, code: r.product?.code || '', stock_disponible: n(r.stock_disponible) }))
        const sorted = isCut
          ? sortByRemnant(list, pieceLength)
          : [...list].sort((a, b) => Number(b.product_id === item.product_id) - Number(a.product_id === item.product_id) || b.stock_disponible - a.stock_disponible)
        setRows(sorted)
        const firstOther = sorted.find(r => r.product_id !== currentProductId)
        setSelectedId((firstOther || sorted[0])?.id || null)
      })
      .catch(e => {
        console.error('Error cargando stock:', e)
        if (!cancelled) setRows([])
      })
    return () => { cancelled = true }
  }, [code, isCut, pieceLength, currentProductId, item.product_id])

  const selected = rows?.find(r => r.id === selectedId) || null
  const selectedLength = selected ? extractSizeFromCode(selected.code) : 0
  const plan = isCut && selected ? cutPlan(selectedLength, pieceLength) : null
  const isSame = !!selected && selected.product_id === currentProductId
  const maxQty = Math.max(1, Math.min(remaining, selected ? Math.max(1, Math.floor(selected.stock_disponible)) : remaining))
  const q = Math.min(qty, maxQty)

  const pending = unassignedLines(order).filter(l => l.id !== item.id)
  // Si se asigna solo una parte, lo que queda de esta línea también sigue sin stock
  if (!currentProductId && q < remaining) pending.push({ id: item.id, code })
  const willActivate = order.status === 'aprobado_en_pausa' && !currentProductId && q >= remaining && pending.length === 0

  async function submit() {
    if (!selected) return
    setBusy(true)
    try {
      if (isCut) {
        const { reassignStock } = await import('@/app/actions/reassign-stock')
        const res = await reassignStock(item.id, selected.id, selected.product_id, selectedLength, q)
        if (!res?.success) throw new Error('No se pudo asignar la chapa')
        toast.success(`${q} × ${code} se cortarán de ${selected.code}`)
      } else {
        const { assignStockToPreparationItem } = await import('@/app/actions/preparation')
        await assignStockToPreparationItem(item.id, selected.id, q)
        toast.success(`${q} × ${selected.code} reservadas para ${code}`)
      }
      await onDone()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo asignar el stock')
    } finally {
      setBusy(false)
    }
  }

  const summary: { label: string; value: ReactNode; tone?: 'ok' | 'warn' }[] = []
  if (selected) {
    summary.push({ label: 'Se reserva', value: `${q} × ${selected.code}` })
    if (currentCode && !isSame) summary.push({ label: 'Se libera', value: `${q} × ${currentCode}` })
    if (isCut && plan) {
      summary.push({ label: 'La planta verá', value: plan.exact ? `coger ${q} × ${selected.code} (exacta)` : `cortar ${q} × ${formatMeters(pieceLength)} de ${selected.code}` })
      summary.push({ label: 'Sobrante previsto', value: plan.exact ? 'ninguno' : `${q} × ${formatMeters(plan.remnant)}`, tone: plan.exact ? 'ok' : undefined })
    }
    if (q < remaining) summary.push({ label: 'La línea', value: `se parte: ${q} con ${selected.code} y ${remaining - q} ${currentCode ? `siguen con ${currentCode}` : 'quedan sin asignar'}`, tone: 'warn' })
    if (order.status === 'aprobado_en_pausa') {
      summary.push(willActivate
        ? { label: 'Estado del pedido', value: 'sale de la pausa: la planta puede empezar', tone: 'ok' }
        : { label: 'Estado del pedido', value: `sigue en pausa${pending.length ? `: falta ${pending.map(p => p.code).join(', ')}` : ''}`, tone: 'warn' })
    }
  }

  return (
    <PanelShell
      eyebrow={currentProductId ? (isCut ? 'Cambiar chapa' : 'Cambiar stock') : 'Asignar stock'}
      title={`${code} × ${remaining}`}
      subtitle={isCut
        ? (currentCode ? `Ahora se corta de ${currentCode}. Solo cambia lo que falta por cortar.` : `Elige de qué chapa se corta${pieceLength ? ` (${formatMeters(pieceLength)})` : ''}. Ordenadas por menos sobrante.`)
        : (currentCode ? `Ahora reservado de ${currentCode}.` : 'Elige de qué stock se prepara.')}
      onClose={onClose}
      footer={
        <Button onClick={submit} disabled={!selected || busy || remaining <= 0 || isSame} className="w-full">
          {busy ? 'Guardando…' : !selected ? 'Elige una opción' : isSame ? 'Ya es la asignada' : isCut ? `Asignar ${q} × ${selected.code}` : `Reservar ${q} × ${selected.code}`}
        </Button>
      }
    >
      <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
        {rows === null && <div className="py-6 text-center text-sm text-muted-foreground">Buscando stock…</div>}
        {rows?.length === 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm text-warning">
            {isCut
              ? 'No hay chapa disponible de esta familia. Si hay chapas cortadas en otro pedido, usa «Reasignar»; si no, el pedido sigue en pausa hasta que EVO actualice el stock.'
              : 'No hay stock disponible de este artículo según EVO. El pedido sigue en pausa hasta que EVO actualice el stock.'}
          </div>
        )}
        {rows?.map(r => {
          const len = extractSizeFromCode(r.code)
          const p = isCut ? cutPlan(len, pieceLength) : null
          return (
            <OptionRow
              key={r.id}
              active={r.id === selectedId}
              onClick={() => setSelectedId(r.id)}
              title={r.code}
              badge={r.product_id === currentProductId ? <Pill>actual</Pill> : p?.exact ? <Pill tone="ok">exacta</Pill> : undefined}
              detail={`${new Intl.NumberFormat('es-AR').format(r.stock_disponible)} disponibles${n(r.stock_reservado) ? ` · ${n(r.stock_reservado)} reservadas` : ''}`}
              rightLabel={isCut ? 'Sobrante' : 'Libre'}
              right={isCut ? (p?.exact ? 'Ninguno' : len ? formatMeters(p!.remnant) : '—') : new Intl.NumberFormat('es-AR').format(r.stock_disponible)}
              rightTone={p?.exact ? 'ok' : undefined}
            />
          )
        })}
      </div>

      {selected && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted-foreground">{isCut ? 'Piezas con esta chapa' : 'Unidades a reservar'}</span>
            <Stepper value={q} onChange={setQty} max={maxQty} />
          </div>
          <span className="text-right text-xs text-muted-foreground">de {remaining} pendientes{q < remaining ? <><br />el resto {currentCode ? 'sigue como está' : 'queda sin asignar'}</> : null}</span>
        </div>
      )}

      {summary.length > 0 && <Summary rows={summary} />}
    </PanelShell>
  )
}

/** Traer chapas ya cortadas de otro pedido a esta orden de corte. */
export function ReassignPanel({ order, cut, onClose, onDone }: { order: any; cut: any; onClose: () => void; onDone: () => Promise<void> | void }) {
  const code: string = cut.product?.code || ''
  const remaining = n(cut.quantity_requested) - n(cut.quantity_cut)
  const [sources, setSources] = useState<any[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('@/app/actions/order-detail')
      .then(({ getReassignmentSources }) => getReassignmentSources(code, order.id))
      .then(data => {
        if (cancelled) return
        setSources(data)
        if (data[0]) {
          setSelectedId(data[0].cutOrderId)
          setQty(Math.max(1, Math.min(remaining, data[0].available)))
        }
      })
      .catch(e => {
        console.error('Error cargando pedidos origen:', e)
        if (!cancelled) setSources([])
      })
    return () => { cancelled = true }
  }, [code, order.id, remaining])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (sources || []).filter(s => !q || s.orderNumber?.toLowerCase().includes(q) || s.client.toLowerCase().includes(q))
  }, [sources, search])
  const selected = sources?.find(s => s.cutOrderId === selectedId) || null
  const maxQty = Math.max(1, Math.min(remaining, selected?.available || 1))
  const q = Math.min(qty, maxQty)

  async function submit() {
    if (!selected) return
    setBusy(true)
    try {
      const { reassignStock } = await import('@/app/actions/stock-management')
      const res = await reassignStock(selected.cutOrderId, cut.id, q)
      toast.success(`${q} × ${code} reasignadas desde ${res.fromOrder}. La planta tiene que confirmar la recogida.`)
      await onDone()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo reasignar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelShell
      eyebrow="Reasignar chapas ya cortadas"
      title={`Traer ${code} de otro pedido`}
      subtitle={`Faltan ${remaining}. Solo salen pedidos con ${code} cortadas y sin entregar.`}
      onClose={onClose}
      footer={
        <Button onClick={submit} disabled={!selected || busy} className="w-full">
          {busy ? 'Reasignando…' : selected ? `Reasignar ${q} desde ${selected.orderNumber}` : 'Elige un pedido origen'}
        </Button>
      }
    >
      {(sources?.length || 0) > 4 && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número o cliente…" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
      )}
      <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
        {sources === null && <div className="py-6 text-center text-sm text-muted-foreground">Buscando pedidos…</div>}
        {sources?.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground">Ningún otro pedido tiene {code} cortadas sin entregar.</div>
        )}
        {visible.map(s => (
          <OptionRow
            key={s.cutOrderId}
            active={s.cutOrderId === selectedId}
            onClick={() => { setSelectedId(s.cutOrderId); setQty(Math.max(1, Math.min(remaining, s.available))) }}
            title={s.orderNumber}
            badge={<Pill>{s.orderStatus === 'finalizado' ? 'Finalizado' : s.orderStatus === 'en_corte' ? 'En corte' : s.orderStatus}</Pill>}
            detail={`${s.client}${s.operator ? ` · cortó ${s.operator}` : ''}`}
            rightLabel="Cortadas"
            right={`${s.available} de ${s.requested}`}
          />
        ))}
      </div>

      {selected && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted-foreground">Cuántas traer</span>
              <Stepper value={q} onChange={setQty} max={maxQty} />
            </div>
            <span className="text-right text-xs text-muted-foreground">máximo {maxQty}{remaining - q > 0 ? <><br />quedarán {remaining - q} por cubrir aquí</> : null}</span>
          </div>
          <Summary rows={[
            { label: 'Este pedido', value: `recibe ${q} × ${code} ya cortadas; la planta confirma la recogida` },
            { label: `Pedido ${selected.orderNumber}`, value: `al confirmar la recogida le faltarán ${q} por cortar`, tone: 'warn' },
            { label: 'EVO', value: 'se avisa al confirmar la recogida en planta' },
          ]} />
        </>
      )}
    </PanelShell>
  )
}
