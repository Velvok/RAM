'use client'

import { useState, useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getHistorial, type HistorialData, type HistorialFilters } from '@/app/actions/historial'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmt(n: number | null | undefined, d = 0) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n)
}

function heat(value: number, max: number) {
  if (!value || !max) return 'bg-transparent'
  const r = value / max
  if (r > 0.75) return 'bg-blue-300/70'
  if (r > 0.5) return 'bg-blue-200/70'
  if (r > 0.25) return 'bg-blue-100'
  return 'bg-blue-50'
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>
  return <span className={cn('font-semibold', pct > 0 ? 'text-emerald-700' : pct < 0 ? 'text-red-700' : 'text-muted-foreground')}>{pct > 0 ? '+' : ''}{pct} %</span>
}

const selectClass = 'h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground'

export function HistorialClient({ initial }: { initial: HistorialData }) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()

  function update(patch: Partial<HistorialFilters>) {
    const next = { ...data.filters, ...patch }
    startTransition(async () => {
      try {
        setData(await getHistorial(next))
      } catch (e) {
        console.error('Error cargando el historial:', e)
      }
    })
  }

  function exportCsv() {
    const head = ['Producto', 'Nombre', ...MONTHS, 'Total', 'Comparación', 'Variación %', 'Stock', 'Cobertura meses']
    const lines = data.rows.map(r => [r.code, r.name, ...r.months, r.total, r.compareTotal ?? '', r.deltaPct ?? '', r.available ?? '', r.coverageMonths ?? ''])
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `historial-${data.filters.movement}-${data.filters.year}${data.filters.family ? '-' + data.filters.family : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const f = data.filters
  const maxMonthly = Math.max(1, ...data.monthly.flatMap(m => [m.current, m.compare ?? 0, m.forecast ?? 0]))
  const maxCell = Math.max(1, ...data.rows.flatMap(r => r.months))
  const movementLabel = { entrega: 'Entregas a cliente', compra: 'Compras a proveedor', corte: 'Cortes en planta', remanente: 'Remanentes' }[f.movement]
  const compareLabel = f.compare === null ? null : f.compare === 'avg3' ? 'media 3 años' : String(f.compare)
  const nextMonthLabels = [1, 2, 3].map(i => MONTHS[(new Date().getMonth() + i) % 12])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial anual</h1>
          <p className="text-sm text-muted-foreground">Lo entregado, lo comprado, lo cortado y la previsión, por producto y familia</p>
        </div>
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
          <Download className="h-4 w-4" />Exportar CSV
        </button>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Año
          <select className={selectClass} value={f.year} onChange={e => update({ year: Number(e.target.value), compare: Number(e.target.value) - 1 })}>
            {data.options.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Comparar con
          <select className={selectClass} value={f.compare === null ? 'none' : String(f.compare)} onChange={e => update({ compare: e.target.value === 'none' ? null : e.target.value === 'avg3' ? 'avg3' : Number(e.target.value) })}>
            <option value={f.year - 1}>{f.year - 1}</option>
            <option value="avg3">Media 3 años</option>
            <option value="none">Nada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Familia
          <select className={selectClass} value={f.family ?? ''} onChange={e => update({ family: e.target.value || null, productId: null })}>
            <option value="">Todas</option>
            {data.options.families.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Producto
          <select className={selectClass} value={f.productId ?? ''} onChange={e => update({ productId: e.target.value || null })}>
            <option value="">Todos</option>
            {data.options.products.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Cliente
          <select className={selectClass} value={f.clientId ?? ''} onChange={e => update({ clientId: e.target.value || null })}>
            <option value="">Todos</option>
            {data.options.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Unidad
          <select className={selectClass} value={f.unit} onChange={e => update({ unit: e.target.value as HistorialFilters['unit'] })}>
            <option value="units">Unidades</option><option value="meters">Metros</option><option value="kg">Kilos</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Movimiento
          <select className={selectClass} value={f.movement} onChange={e => update({ movement: e.target.value as HistorialFilters['movement'] })}>
            <option value="entrega">Entregas a cliente</option><option value="compra">Compras a proveedor</option><option value="corte">Cortes en planta</option><option value="remanente">Remanentes</option>
          </select>
        </label>
        {pending && <Loader2 className="mb-2 h-5 w-5 animate-spin text-muted-foreground" />}
      </Card>

      <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 transition-opacity', pending && 'opacity-60')}>
        <Card className="p-4"><div className="text-xs font-semibold text-muted-foreground">{movementLabel} {f.year}</div><div className="mt-1 text-2xl font-bold">{fmt(data.kpis.total)} {data.unitLabel}</div><div className="mt-1 text-xs"><Delta pct={data.kpis.deltaPct} />{compareLabel ? <span className="text-muted-foreground"> vs {compareLabel}, mismo periodo</span> : null}</div></Card>
        <Card className="p-4"><div className="text-xs font-semibold text-muted-foreground">Media mensual</div><div className="mt-1 text-2xl font-bold">{fmt(data.kpis.monthlyAvg12)} {data.unitLabel}</div><div className="mt-1 text-xs text-muted-foreground">últimos 12 meses</div></Card>
        <Card className="p-4"><div className="text-xs font-semibold text-muted-foreground">Previsión {nextMonthLabels.join(' – ')}</div><div className="mt-1 text-2xl font-bold">{fmt(data.kpis.forecast3)} {data.unitLabel}</div><div className="mt-1 text-xs text-muted-foreground">mismo mes de años anteriores × tendencia</div></Card>
        <Card className="p-4"><div className="text-xs font-semibold text-muted-foreground">Cobertura de stock</div><div className="mt-1 text-2xl font-bold">{data.kpis.coverageMonths == null ? '—' : data.kpis.coverageMonths > 36 ? '> 3 años' : `${fmt(data.kpis.coverageMonths, 1)} meses`}</div><div className={cn('mt-1 text-xs', data.kpis.lowCoverageProducts ? 'font-medium text-amber-700' : 'text-muted-foreground')}>{data.kpis.lowCoverageProducts ? `${data.kpis.lowCoverageProducts} producto(s) por debajo de 1 mes` : f.unit === 'units' ? 'stock disponible / media mensual' : 'solo en unidades'}</div></Card>
        <Card className="p-4"><div className="text-xs font-semibold text-muted-foreground">Mejor mes</div><div className="mt-1 text-2xl font-bold">{data.kpis.bestMonth ? MONTHS[data.kpis.bestMonth.month - 1] : '—'}</div><div className="mt-1 text-xs text-muted-foreground">{data.kpis.bestMonth ? `${fmt(data.kpis.bestMonth.value)} ${data.unitLabel}` : 'sin datos'}</div></Card>
      </div>

      <Card className={cn('p-5 transition-opacity', pending && 'opacity-60')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{movementLabel} por mes · {f.family || 'todas las familias'} · {data.unitLabel}</h2>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" />{f.year}</span>
            {compareLabel && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-slate-300" />{compareLabel}</span>}
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-dashed border-orange-500" />previsión</span>
          </div>
        </div>
        <div className="grid h-44 grid-cols-12 items-end gap-2">
          {data.monthly.map(m => (
            <div key={m.month} className="flex h-full items-end gap-0.5" title={`${MONTHS[m.month - 1]}: ${fmt(m.current)}${m.compare != null ? ` · ${compareLabel}: ${fmt(m.compare)}` : ''}${m.forecast != null ? ` · previsión ${fmt(m.forecast)}` : ''}`}>
              {m.forecast != null && m.current === 0
                ? <div className="flex-1 rounded-t border-2 border-dashed border-orange-500" style={{ height: `${Math.max(2, (m.forecast / maxMonthly) * 100)}%` }} />
                : <div className="flex-1 rounded-t bg-primary" style={{ height: `${Math.max(2, (m.current / maxMonthly) * 100)}%` }} />}
              {m.compare != null && <div className="flex-1 rounded-t bg-slate-300" style={{ height: `${Math.max(2, (m.compare / maxMonthly) * 100)}%` }} />}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-12 gap-2 text-center text-[11px] text-muted-foreground">{MONTHS.map(m => <span key={m}>{m}</span>)}</div>
      </Card>

      <Card className={cn('p-5 transition-opacity', pending && 'opacity-60')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Producto × mes · {f.year} · {data.unitLabel}</h2>
          <span className="text-xs text-muted-foreground">fondo más oscuro = más volumen · {data.rows.length} productos</span>
        </div>
        {data.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-2 text-left font-semibold">Producto</th>
                  {MONTHS.map(m => <th key={m} className="px-1.5 py-2 text-right font-semibold">{m}</th>)}
                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                  <th className="px-2 py-2 text-right font-semibold">vs {compareLabel ?? '—'}</th>
                  <th className="px-2 py-2 text-right font-semibold">Stock</th>
                  <th className="px-2 py-2 text-right font-semibold">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.productId} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-2 font-semibold text-foreground" title={r.name}>{r.code}</td>
                    {r.months.map((v, i) => <td key={i} className={cn('px-1.5 py-1.5 text-right', heat(v, maxCell))}>{v ? fmt(v) : <span className="text-muted-foreground/50">·</span>}</td>)}
                    <td className="px-2 py-1.5 text-right font-bold">{fmt(r.total)}</td>
                    <td className="px-2 py-1.5 text-right"><Delta pct={r.deltaPct} /></td>
                    <td className={cn('px-2 py-1.5 text-right', r.available != null && r.available < 0 && 'font-semibold text-red-700')}>{fmt(r.available)}</td>
                    <td className={cn('px-2 py-1.5 text-right', r.coverageMonths != null && (r.coverageMonths < 1 ? 'font-semibold text-red-700' : r.coverageMonths < 3 ? 'font-semibold text-amber-700' : 'text-emerald-700'))}>{r.coverageMonths == null ? '—' : r.coverageMonths > 36 ? '> 36 m' : `${fmt(r.coverageMonths, 1)} m`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className={cn('grid gap-5 xl:grid-cols-2 transition-opacity', pending && 'opacity-60')}>
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground">Previsión y reposición · próximos 3 meses</h2>
          <p className="mt-1 text-xs text-muted-foreground">Demanda esperada = media del mismo mes en años anteriores × tendencia del año. Reponer = demanda + pedidos abiertos − stock disponible.</p>
          {data.forecast.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin histórico suficiente para prever.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 text-left font-semibold">Producto</th>{nextMonthLabels.map(m => <th key={m} className="py-2 text-right font-semibold">{m}</th>)}<th className="py-2 text-right font-semibold">Abiertos</th><th className="py-2 text-right font-semibold">Stock</th><th className="py-2 text-right font-semibold">Reponer</th></tr></thead>
                <tbody>
                  {data.forecast.map(r => (
                    <tr key={r.productId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-semibold">{r.code}</td>
                      {r.months.map((v, i) => <td key={i} className="py-2 text-right">{fmt(v)}</td>)}
                      <td className="py-2 text-right">{fmt(r.openDemand)}</td>
                      <td className={cn('py-2 text-right', r.available != null && r.available < 0 && 'font-semibold text-red-700')}>{fmt(r.available)}</td>
                      <td className={cn('py-2 text-right font-bold', r.toReplenish ? 'text-red-700' : 'text-emerald-700')}>{r.toReplenish == null ? '—' : r.toReplenish ? `${fmt(r.toReplenish)} ud` : 'cubierto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground">Quién compra · {f.year}</h2>
          {data.clients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin entregas con cliente en este año.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {data.clients.map(c => (
                <div key={c.name}>
                  <div className="flex justify-between text-sm"><span className="font-semibold text-foreground">{c.name}</span><span>{fmt(c.value)} {data.unitLabel} · {c.pct} %</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${c.pct}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Cortes reales vs piezas exactas</dt><dd className="font-semibold">{fmt(data.extras.cuts)} · {fmt(data.extras.exactPieces)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Remanentes generados en el año</dt><dd className="font-semibold">{fmt(data.extras.remnantUnits)} chapas · {fmt(data.extras.remnantMeters)} m</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
