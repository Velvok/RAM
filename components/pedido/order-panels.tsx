'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { extractSizeFromCode } from '@/lib/product-utils'
import { cutPlan, formatMeters, productLength, sortByRemnant } from '@/lib/planta-tasks'
import { userMessage } from '@/lib/user-error'
import { cutOutcome, proposePlan, round2 } from '@/lib/sheet-plan'

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
    <section data-reload-guard className="flex flex-col gap-4 rounded-xl border border-primary/60 bg-card p-5 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]">
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

/** Dibujo de una chapa partida en sus piezas y lo que sobra. */
function SheetBar({ sheetLength, pieceLength, pieces }: { sheetLength: number; pieceLength: number; pieces: number }) {
  const rest = round2(sheetLength - pieces * pieceLength)
  return (
    <div className="flex h-5 overflow-hidden rounded border border-border text-[10px] font-semibold leading-none" aria-hidden>
      {Array.from({ length: pieces }, (_, i) => (
        <span key={i} style={{ flex: pieceLength }} className="flex min-w-0 items-center justify-center border-r border-card bg-primary/80 text-primary-foreground">{pieces <= 6 ? formatMeters(pieceLength) : ''}</span>
      ))}
      {rest > 0.009 && <span style={{ flex: rest }} className="flex min-w-0 items-center justify-center whitespace-nowrap bg-warning/20 px-1 text-warning">sobra {formatMeters(rest)}</span>}
    </div>
  )
}

/**
 * Asignar o cambiar las chapas de una orden de corte. De cada chapa salen todas
 * las piezas que caben; aquí se elige cuántas chapas de cada tipo se usan y se
 * ve qué cubren y qué sobra (reglas en lib/sheet-plan.ts).
 */
function AssignSheetsPanel({ order, item, onClose, onDone }: { order: any; item: any; onClose: () => void; onDone: () => Promise<void> | void }) {
  const code: string = item.product?.code || ''
  const pieceLength = productLength(item.product)
  const remaining = n(item.quantity_requested) - n(item.quantity_cut)
  const currentProductId: string | null = item.material_base_id || null
  const currentCode: string | null = item.material_base?.code || null

  const [rows, setRows] = useState<any[] | null>(null)
  const [use, setUse] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('@/app/actions/get-available-stock')
      .then(({ getAvailableStock }) => getAvailableStock(code))
      .then(data => {
        if (cancelled) return
        const list = (data || [])
          .map((r: any) => ({ ...r, code: r.product?.code || '', stock_disponible: n(r.stock_disponible), length: extractSizeFromCode(r.product?.code || '') }))
          .filter((r: any) => cutPlan(r.length, pieceLength).piecesPerSheet > 0)
        const sorted = sortByRemnant(list, pieceLength, remaining)
        setRows(sorted)
        // Propuesta del sistema: exactas primero y luego la que menos sobra
        const plan = proposePlan(remaining, pieceLength, sorted.filter((r: any) => r.product_id !== currentProductId).map((r: any) => ({ id: r.id, length: r.length, available: r.stock_disponible })))
        setUse(Object.fromEntries(plan.parts.map(p => [p.id, p.sheets])))
      })
      .catch(e => {
        console.error('Error cargando stock:', e)
        if (!cancelled) setRows([])
      })
    return () => { cancelled = true }
  }, [code, pieceLength, remaining, currentProductId])

  // Reparto: cada tipo de chapa cubre piezas en el orden de la lista
  const alloc = useMemo(() => {
    let left = remaining
    const parts = (rows || []).map(r => {
      const pps = cutPlan(r.length, pieceLength).piecesPerSheet
      const sheets = r.product_id === currentProductId ? 0 : Math.min(use[r.id] || 0, Math.floor(r.stock_disponible))
      const pieces = Math.min(left, sheets * pps)
      left -= pieces
      const out = cutOutcome(r.length, pieceLength, pieces)
      return { row: r, pps, sheets: out.sheets, pieces, leftover: out.leftoverMeters }
    })
    return { parts, left }
  }, [rows, use, remaining, pieceLength, currentProductId])

  const chosen = alloc.parts.filter(p => p.pieces > 0)
  const covered = remaining - alloc.left
  const totalLeftover = round2(chosen.reduce((s, p) => s + p.leftover, 0))
  const pending = unassignedLines(order).filter(l => l.id !== item.id)
  if (!currentProductId && alloc.left > 0) pending.push({ id: item.id, code })
  const willActivate = order.status === 'aprobado_en_pausa' && !currentProductId && alloc.left === 0 && pending.length === 0

  async function submit() {
    if (!chosen.length) return
    setBusy(true)
    try {
      const { reassignStock } = await import('@/app/actions/reassign-stock')
      for (const p of chosen) {
        const res = await reassignStock(item.id, p.row.id, p.row.product_id, p.row.length, p.pieces)
        if (!res?.success) throw new Error('No se pudo asignar la chapa')
      }
      toast.success(`${covered} × ${code}: ${chosen.map(p => `${p.sheets} × ${p.row.code}`).join(' + ')}`)
      await onDone()
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo asignar la chapa'))
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  const summary: { label: string; value: ReactNode; tone?: 'ok' | 'warn' }[] = []
  if (chosen.length) {
    summary.push({ label: 'Piezas cubiertas', value: `${covered} de ${remaining}`, tone: alloc.left === 0 ? 'ok' : 'warn' })
    summary.push({ label: 'Chapas que se reservan', value: chosen.map(p => `${p.sheets} × ${p.row.code}`).join(' + ') })
    summary.push({ label: 'Sobrante previsto', value: totalLeftover > 0 ? `${formatMeters(totalLeftover)} (vuelve al stock)` : 'ninguno', tone: totalLeftover > 0 ? undefined : 'ok' })
    if (alloc.left > 0) summary.push({ label: 'El resto', value: `${alloc.left} ${currentCode ? `siguen con ${currentCode}` : 'quedan sin asignar'}`, tone: 'warn' })
    if (order.status === 'aprobado_en_pausa') {
      summary.push(willActivate
        ? { label: 'Estado del pedido', value: 'sale de la pausa: la planta puede empezar', tone: 'ok' }
        : { label: 'Estado del pedido', value: `sigue en pausa${pending.length ? `: falta ${pending.map(p => p.code).join(', ')}` : ''}`, tone: 'warn' })
    }
  }

  return (
    <PanelShell
      eyebrow={currentProductId ? 'Cambiar chapa' : 'Asignar chapa'}
      title={`${code} × ${remaining}`}
      subtitle={`${currentCode ? `Ahora se corta de ${currentCode}; solo cambia lo que falta por cortar. ` : ''}Elige cuántas chapas de cada tipo se usan${pieceLength ? ` para piezas de ${formatMeters(pieceLength)}` : ''}.`}
      onClose={onClose}
      footer={
        <Button onClick={submit} disabled={!chosen.length || busy || remaining <= 0} className="w-full">
          {busy ? 'Guardando…' : !chosen.length ? 'Elige las chapas' : `Asignar ${chosen.reduce((s, p) => s + p.sheets, 0)} chapa${chosen.reduce((s, p) => s + p.sheets, 0) !== 1 ? 's' : ''} para ${covered} pieza${covered !== 1 ? 's' : ''}`}
        </Button>
      }
    >
      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
        {rows === null && <div className="py-6 text-center text-sm text-muted-foreground">Buscando stock…</div>}
        {rows?.length === 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm text-warning">
            No hay chapa disponible de esta familia. Si hay chapas cortadas en otro pedido, usa «Reasignar»; si no, el pedido sigue en pausa hasta que EVO actualice el stock.
          </div>
        )}
        {alloc.parts.map(p => {
          const r = p.row
          const plan = cutPlan(r.length, pieceLength)
          const isCurrent = r.product_id === currentProductId
          const coveredByOthers = covered - p.pieces
          const max = isCurrent ? 0 : Math.max(0, Math.min(Math.floor(r.stock_disponible), Math.ceil(Math.max(0, remaining - coveredByOthers) / p.pps)))
          const sheets = use[r.id] || 0
          return (
            <div key={r.id} className={cn('flex flex-col gap-2 rounded-lg border bg-card px-3.5 py-3', p.pieces > 0 ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.15)]' : 'border-border')}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">{r.code}{isCurrent ? <Pill>actual</Pill> : plan.exact ? <Pill tone="ok">exacta</Pill> : null}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat('es-AR').format(Math.floor(r.stock_disponible))} disponibles · {plan.exact ? 'no hay que cortar' : `salen ${p.pps} por chapa · ${plan.remnant > 0 ? `sobra ${formatMeters(plan.remnant)}` : 'sin sobrante'}`}
                  </div>
                </div>
                {!isCurrent && <Stepper value={Math.min(sheets, Math.max(max, 0))} onChange={v => setUse(u => ({ ...u, [r.id]: v }))} min={0} max={max} />}
              </div>
              {!plan.exact && <SheetBar sheetLength={r.length} pieceLength={pieceLength} pieces={p.pps} />}
              {p.pieces > 0 && <div className="text-xs font-medium text-foreground">{p.sheets} chapa{p.sheets !== 1 ? 's' : ''} → {p.pieces} pieza{p.pieces !== 1 ? 's' : ''}{p.leftover > 0 ? ` · sobran ${formatMeters(p.leftover)}` : ''}</div>}
            </div>
          )
        })}
      </div>

      {summary.length > 0 && <Summary rows={summary} />}
    </PanelShell>
  )
}

/** Asignar o cambiar el stock de una orden de corte o de un artículo a preparar. */
export function AssignStockPanel(props: { order: any; line: PanelLine; onClose: () => void; onDone: () => Promise<void> | void }) {
  return props.line.kind === 'cut'
    ? <AssignSheetsPanel order={props.order} item={props.line.item} onClose={props.onClose} onDone={props.onDone} />
    : <AssignUnitsPanel {...props} />
}

function AssignUnitsPanel({ order, line, onClose, onDone }: { order: any; line: PanelLine; onClose: () => void; onDone: () => Promise<void> | void }) {
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
      toast.error(userMessage(e, 'No se pudo asignar el stock'))
    } finally {
      setBusy(false)
    }
  }

  const summary: { label: string; value: ReactNode; tone?: 'ok' | 'warn' }[] = []
  if (selected) {
    summary.push({ label: 'Se reserva', value: `${q} × ${selected.code}` })
    if (currentCode && !isSame) summary.push({ label: 'Se libera', value: `${q} × ${currentCode}` })
    if (isCut && plan) {
      summary.push({ label: 'La planta verá', value: plan.exact ? `chapa asignada: ${q} × ${selected.code} (exacta)` : `cortar ${q} × ${formatMeters(pieceLength)} de ${selected.code}` })
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
      toast.success(`${q} × ${code} reasignadas desde ${res.fromOrder}. La planta tiene que confirmar la reasignación.`)
      await onDone()
    } catch (e: any) {
      toast.error(userMessage(e, 'No se pudo reasignar'))
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
            { label: 'Este pedido', value: `recibe ${q} × ${code} ya cortadas; la planta confirma la reasignación` },
            { label: `Pedido ${selected.orderNumber}`, value: `al confirmar la reasignación le faltarán ${q} por cortar`, tone: 'warn' },
            { label: 'EVO', value: 'se avisa al confirmar la reasignación en planta' },
          ]} />
        </>
      )}
    </PanelShell>
  )
}
