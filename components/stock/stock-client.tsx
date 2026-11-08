'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField, FIELD_CLS } from '@/components/ui/select-field'
import { SortableTh, useTableSort } from '@/components/ui/sortable-table'
import { cn } from '@/lib/utils'
import { extractFamilyCode, extractSizeFromCode } from '@/lib/product-utils'
import { cutPlan, formatMeters } from '@/lib/planta-tasks'
import type { StockDemand } from '@/app/actions/inventory'

type Item = {
  id: string; productId: string; code: string; name: string; category: string | null
  total: number; reserved: number; available: number; updatedAt: string | null
}
type Row = Item & {
  family: string; demand: StockDemand[]; orders: number; missing: number; monthly: number
  state: 'faltan' | 'negativo' | 'bajo' | 'sin_stock' | 'ok'
}
type Chip = 'todos' | 'pedidos' | 'faltan' | 'bajo' | 'negativos'

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const fmt = (v: number) => nf.format(v)
const PAGE = 100

const STATE: Record<Row['state'], { label: (r: Row) => string; cls: string }> = {
  faltan: { label: r => `Faltan ${fmt(r.missing)}`, cls: 'bg-destructive/10 text-destructive' },
  negativo: { label: () => 'Negativo en EVO', cls: 'bg-destructive/10 text-destructive' },
  bajo: { label: r => `Bajo · ${fmt(r.monthly ? r.available / r.monthly : 0)} meses`, cls: 'bg-warning/10 text-warning' },
  sin_stock: { label: () => 'Sin stock', cls: 'bg-muted text-muted-foreground' },
  ok: { label: () => 'Disponible', cls: 'bg-success/10 text-success' },
}

function Kpi({ label, value, detail, tone, active, onClick }: { label: string; value: ReactNode; detail: ReactNode; tone?: 'bad' | 'warn'; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40', active ? 'border-primary' : 'border-border')}
    >
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={cn('text-[28px] font-bold leading-none', tone === 'bad' && 'text-destructive')}>{value}</span>
      <span className={cn('text-xs', tone === 'warn' || tone === 'bad' ? 'font-medium text-warning' : 'text-muted-foreground')}>{detail}</span>
    </button>
  )
}

export function StockClient({ inventory, demand, delivered90, generatedAt }: {
  inventory: Item[]
  demand: Record<string, StockDemand[]>
  delivered90: Record<string, number>
  generatedAt: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('todas')
  const [view, setView] = useState<'familia' | 'lista'>('familia')
  const [chip, setChip] = useState<Chip>('pedidos')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // EVO actualiza el stock por webhook: refresco suave cada minuto
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh() }, 60000)
    return () => clearInterval(t)
  }, [router])

  const rows: Row[] = useMemo(() => inventory.map(i => {
    const d = demand[i.productId] || []
    const missing = d.reduce((s, x) => s + x.unassigned, 0)
    const monthly = (delivered90[i.productId] || 0) / 3
    const state: Row['state'] = missing > 0 ? 'faltan'
      : i.available < 0 ? 'negativo'
      : i.available === 0 ? 'sin_stock'
      : monthly > 0 && i.available < monthly ? 'bajo'
      : 'ok'
    return { ...i, family: extractFamilyCode(i.code) || i.code, demand: d, orders: new Set(d.map(x => x.orderId)).size, missing, monthly, state }
  }), [inventory, demand, delivered90])

  const counts = useMemo(() => ({
    todos: rows.length,
    pedidos: rows.filter(r => r.orders > 0).length,
    faltan: rows.filter(r => r.missing > 0).length,
    bajo: rows.filter(r => r.state === 'bajo').length,
    negativos: rows.filter(r => r.available < 0).length,
    familias: new Set(rows.map(r => r.family)).size,
  }), [rows])

  const families = useMemo(() => [...new Set(rows.map(r => r.family))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (family !== 'todas' && r.family !== family) return false
      if (chip === 'pedidos' && r.orders === 0) return false
      if (chip === 'faltan' && r.missing === 0) return false
      if (chip === 'bajo' && r.state !== 'bajo') return false
      if (chip === 'negativos' && r.available >= 0) return false
      if (q && !r.code.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !r.demand.some(d => d.orderNumber?.toLowerCase().includes(q) || d.client.toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, search, family, chip])

  const { sorted, sort } = useTableSort(filtered, {
    code: r => r.code,
    name: r => r.name,
    total: r => r.total,
    reserved: r => r.reserved,
    available: r => r.available,
    orders: r => r.orders,
  })

  // Vista por familia: grupos con totales; dentro, por largo
  const groups = useMemo(() => {
    if (view !== 'familia') return null
    const map = new Map<string, Row[]>()
    for (const r of sorted) {
      if (!map.has(r.family)) map.set(r.family, [])
      map.get(r.family)!.push(r)
    }
    return [...map.entries()]
      .map(([fam, items]) => ({
        fam,
        items: sort.key ? items : [...items].sort((a, b) => extractSizeFromCode(a.code) - extractSizeFromCode(b.code) || a.code.localeCompare(b.code)),
        total: items.reduce((s, r) => s + r.total, 0),
        reserved: items.reduce((s, r) => s + r.reserved, 0),
        available: items.reduce((s, r) => s + r.available, 0),
        orders: new Set(items.flatMap(r => r.demand.map(d => d.orderId))).size,
        missing: items.filter(r => r.missing > 0).length,
      }))
      .sort((a, b) => b.missing - a.missing || b.orders - a.orders || a.fam.localeCompare(b.fam, 'es', { numeric: true }))
  }, [sorted, view, sort.key])

  const selected = rows.find(r => r.id === selectedId) || null

  function exportCsv() {
    const head = ['codigo', 'producto', 'familia', 'total_evo', 'reservado', 'disponible', 'pedidos', 'faltan', 'consumo_mensual_90d']
    const lines = filtered.map(r => [r.code, r.name, r.family, r.total, r.reserved, r.available, r.orders, r.missing, r.monthly.toFixed(1)]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `stock-ram-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const th = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
  const td = 'px-3 py-2.5 text-[13px] whitespace-nowrap tabular-nums'
  const syncedAt = new Date(generatedAt).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  const renderRow = (r: Row) => (
    <tr
      key={r.id}
      onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
      className={cn('cursor-pointer transition-colors hover:bg-muted/40', r.id === selectedId && 'bg-primary/5', r.missing > 0 && r.id !== selectedId && 'bg-destructive/5')}
    >
      <td className={cn(td, 'font-semibold text-foreground')}>{r.code}</td>
      <td className={cn(td, 'max-w-[240px] truncate text-muted-foreground')} title={r.name}>{r.name}</td>
      <td className={cn(td, 'text-right', r.total < 0 && 'text-destructive')}>{fmt(r.total)}</td>
      <td className={cn(td, 'text-right')}>{fmt(r.reserved)}</td>
      <td className={cn(td, 'text-right font-bold', r.available < 0 && 'text-destructive')}>{fmt(r.available)}</td>
      <td className={cn(td, 'text-right')}>{r.orders ? <span className="font-semibold text-primary">{r.orders} {r.orders === 1 ? 'pedido' : 'pedidos'}</span> : <span className="text-muted-foreground">—</span>}</td>
      <td className={td}><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATE[r.state].cls)}>{STATE[r.state].label(r)}</span></td>
    </tr>
  )

  let shown = 0
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-foreground">Stock</h1>
          <p className="text-sm text-muted-foreground">Solo lectura: el saldo lo fija EVO y RAM muestra qué reservan los pedidos abiertos · actualizado {syncedAt}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />Exportar CSV</Button>
          <Link href="/admin/historial"><Button variant="outline">Historial anual</Button></Link>
        </div>
      </div>

      <div className="admin-kpis">
        <Kpi label="Productos" value={fmt(counts.todos)} detail={`${counts.familias} familias`} active={chip === 'todos'} onClick={() => { setChip('todos'); setLimit(PAGE) }} />
        <Kpi label="Con demanda abierta" value={counts.pedidos} detail="productos que piden los pedidos activos" active={chip === 'pedidos'} onClick={() => { setChip('pedidos'); setLimit(PAGE) }} />
        <Kpi label="Faltan para servir" value={counts.faltan} tone={counts.faltan ? 'bad' : undefined} detail={counts.faltan ? rows.filter(r => r.missing > 0).slice(0, 3).map(r => r.code).join(' · ') : 'todo lo pedido tiene stock'} active={chip === 'faltan'} onClick={() => { setChip('faltan'); setLimit(PAGE) }} />
        <Kpi label="Stock bajo" value={counts.bajo} detail="menos de 1 mes de consumo (90 días)" active={chip === 'bajo'} onClick={() => { setChip('bajo'); setLimit(PAGE) }} />
        <Kpi label="Negativos en EVO" value={counts.negativos} detail="saldo que EVO reporta en negativo" active={chip === 'negativos'} onClick={() => { setChip('negativos'); setLimit(PAGE) }} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Buscar
          <input value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE) }} placeholder="Código, nombre, pedido o cliente…" className={cn(FIELD_CLS, 'pr-3')} />
        </label>
        <label className="flex w-48 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Familia
          <SelectField value={family} onChange={e => { setFamily(e.target.value); setLimit(PAGE) }}>
            <option value="todas">Todas</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </SelectField>
        </label>
        <label className="flex w-40 flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Vista
          <SelectField value={view} onChange={e => setView(e.target.value as 'familia' | 'lista')}>
            <option value="familia">Por familia</option>
            <option value="lista">Lista</option>
          </SelectField>
        </label>
        <div className="flex flex-wrap gap-2">
          {([['todos', 'Todos'], ['pedidos', 'Con pedidos'], ['faltan', 'Faltan'], ['bajo', 'Bajo'], ['negativos', 'Negativos']] as [Chip, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setChip(k); setLimit(PAGE) }}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                chip === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-primary/40',
                chip !== k && k === 'faltan' && 'text-destructive', chip !== k && k === 'bajo' && 'text-warning')}
            >
              {label} <span className="opacity-70">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-split" style={{ ['--aside-w' as string]: 'clamp(300px, 24vw, 340px)' }}>
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <h2 className="text-base font-semibold text-foreground">Inventario</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} productos · clic en una fila para ver su ficha</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-y border-border bg-muted/40">
                <tr>
                  <SortableTh sort={sort} sortKey="code" className={cn(th, 'text-left')}>Código</SortableTh>
                  <SortableTh sort={sort} sortKey="name" className={cn(th, 'text-left')}>Producto</SortableTh>
                  <SortableTh sort={sort} sortKey="total" className={cn(th, 'text-right')}>Total EVO</SortableTh>
                  <SortableTh sort={sort} sortKey="reserved" className={cn(th, 'text-right')}>Reservado</SortableTh>
                  <SortableTh sort={sort} sortKey="available" className={cn(th, 'text-right')}>Disponible</SortableTh>
                  <SortableTh sort={sort} sortKey="orders" className={cn(th, 'text-right')}>Pedidos</SortableTh>
                  <th className={cn(th, 'text-left')}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">Nada con estos filtros.</td></tr>
                )}
                {groups
                  ? groups.map(g => {
                    if (shown >= limit) return null
                    const items = g.items.slice(0, limit - shown)
                    shown += items.length
                    return (
                      <Fragment key={g.fam}>
                        <tr className="bg-muted/50">
                          <td colSpan={2} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.fam} · {g.items.length} {g.items.length === 1 ? 'producto' : 'productos'}</td>
                          <td className={cn(td, 'py-2 text-right text-xs text-muted-foreground')}>{fmt(g.total)}</td>
                          <td className={cn(td, 'py-2 text-right text-xs text-muted-foreground')}>{fmt(g.reserved)}</td>
                          <td className={cn(td, 'py-2 text-right text-xs text-muted-foreground')}>{fmt(g.available)}</td>
                          <td className={cn(td, 'py-2 text-right text-xs text-muted-foreground')}>{g.orders || ''}</td>
                          <td className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.missing ? <span className="text-destructive">{g.missing} con faltas</span> : g.orders ? 'cubierto' : ''}</td>
                        </tr>
                        {items.map(renderRow)}
                      </Fragment>
                    )
                  })
                  : sorted.slice(0, limit).map(renderRow)}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span>Mostrando {limit} de {filtered.length}</span>
              <button type="button" onClick={() => setLimit(l => l + PAGE * 2)} className="font-semibold text-primary hover:underline">Ver más</button>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5 ">
          {selected ? <ProductSheet row={selected} rows={rows} onClose={() => setSelectedId(null)} /> : (
            <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Ficha de producto</h2>
              <p className="text-sm text-muted-foreground">Pulsa una fila para ver su saldo en EVO, quién lo pide y de qué chapas se puede cortar.</p>
              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                El stock no se edita en RAM. Si no cuadra con lo físico, se corrige en EVO y RAM lo recibe solo.
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ProductSheet({ row, rows, onClose }: { row: Row; rows: Row[]; onClose: () => void }) {
  const size = extractSizeFromCode(row.code)
  const sources = size > 0
    ? rows
      .filter(r => r.family === row.family && r.id !== row.id && r.available > 0 && extractSizeFromCode(r.code) > size)
      .map(r => ({ r, plan: cutPlan(extractSizeFromCode(r.code), size) }))
      .sort((a, b) => a.plan.remnant - b.plan.remnant)
      .slice(0, 4)
    : []
  const tile = 'flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3'
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{row.code}</h2>
          <p className="text-xs text-muted-foreground">{row.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', STATE[row.state].cls)}>{STATE[row.state].label(row)}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar ficha" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={tile}><span className="text-[11px] font-semibold text-muted-foreground">Total según EVO</span><span className={cn('text-xl font-bold', row.total < 0 && 'text-destructive')}>{fmt(row.total)}</span></div>
        <div className={tile}><span className="text-[11px] font-semibold text-muted-foreground">Reservado por pedidos</span><span className="text-xl font-bold">{fmt(row.reserved)}</span></div>
        <div className={tile}><span className="text-[11px] font-semibold text-muted-foreground">Disponible</span><span className={cn('text-xl font-bold', row.available < 0 && 'text-destructive')}>{fmt(row.available)}</span></div>
        <div className={tile}><span className="text-[11px] font-semibold text-muted-foreground">Consumo · 90 días</span><span className="text-base font-bold leading-7">{row.monthly ? `${fmt(row.monthly)} / mes` : 'sin entregas'}</span></div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pedidos que lo piden</span>
        {row.demand.length === 0 && <span className="text-sm text-muted-foreground">Ningún pedido abierto.</span>}
        {row.demand.map(d => (
          <div key={`${d.orderId}-${d.asMaterialFor || ''}`} className="flex justify-between gap-3 text-[13px]">
            <Link href={`/admin/pedidos/${d.orderId}`} className="truncate hover:underline"><strong>{d.orderNumber}</strong> · {d.client}</Link>
            <span className={cn('shrink-0', d.unassigned ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              {d.asMaterialFor ? `chapa para ${d.asMaterialFor} · ${d.units}` : d.unassigned ? `${d.unassigned} sin asignar` : `${d.units} reservadas`}
            </span>
          </div>
        ))}
      </div>

      {sources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Se puede cortar de</span>
          {sources.map(({ r, plan }) => (
            <div key={r.id} className="flex justify-between gap-3 text-[13px]">
              <span><strong>{r.code}</strong> <span className="text-muted-foreground">· {fmt(r.available)} disp.</span></span>
              <span className="text-muted-foreground">sobrante {formatMeters(plan.remnant)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        El saldo lo manda EVO: si no cuadra con lo físico, se corrige en EVO y RAM lo recibe solo. Aquí no se edita.
      </div>
      {row.updatedAt && <span className="text-xs text-muted-foreground">Última actualización desde EVO: {new Date(row.updatedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span>}
    </section>
  )
}
