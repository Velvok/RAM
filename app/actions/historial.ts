'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

// Historial anual sobre product_movements: matriz producto × mes, comparación
// con años anteriores, previsión por estacionalidad y cobertura de stock.

/** RAM trabaja siempre en unidades (ni metros ni kilos) */
export type HistorialUnit = 'units'
export type HistorialMovement = 'entrega' | 'compra' | 'corte' | 'remanente'

export interface HistorialFilters {
  year: number
  compare: number | 'avg3' | null
  family: string | null
  productId: string | null
  clientId: string | null
  unit: HistorialUnit
  movement: HistorialMovement
}

export interface HistorialRow {
  productId: string
  code: string
  name: string
  months: number[]            // 12 valores del año elegido
  total: number
  compareTotal: number | null
  deltaPct: number | null
  available: number | null
  coverageMonths: number | null
}

export interface HistorialData {
  filters: HistorialFilters
  options: {
    years: number[]
    families: string[]
    products: Array<{ id: string; code: string; name: string }>
    clients: Array<{ id: string; name: string }>
  }
  kpis: {
    total: number
    compareTotal: number | null
    deltaPct: number | null
    monthlyAvg12: number
    forecast3: number
    coverageMonths: number | null
    lowCoverageProducts: number
    bestMonth: { month: number; value: number } | null
  }
  monthly: Array<{ month: number; current: number; compare: number | null; forecast: number | null }>
  rows: HistorialRow[]
  forecast: Array<{ productId: string; code: string; months: number[]; available: number | null; toReplenish: number | null; openDemand: number }>
  clients: Array<{ name: string; value: number; pct: number }>
  extras: { cuts: number; exactPieces: number; remnantUnits: number }
  unitLabel: string
}

const TZ = 'America/Argentina/Buenos_Aires'
const MONTHS_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function localYearMonth(iso: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric' }).formatToParts(new Date(iso))
  return { year: Number(parts.find(p => p.type === 'year')!.value), month: Number(parts.find(p => p.type === 'month')!.value) }
}

function round(n: number, d = 1) {
  const f = 10 ** d
  return Math.round(n * f) / f
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function getHistorial(input: Partial<HistorialFilters> = {}): Promise<HistorialData> {
  await requireAdmin()
  const supabase = createAdminClient()

  const now = new Date()
  const { year: currentYear, month: currentMonth } = localYearMonth(now.toISOString())
  const filters: HistorialFilters = {
    year: input.year ?? currentYear,
    compare: input.compare === undefined ? (input.year ?? currentYear) - 1 : input.compare,
    family: input.family ?? null,
    productId: input.productId ?? null,
    clientId: input.clientId ?? null,
    unit: 'units',
    movement: input.movement ?? 'entrega',
  }
  const valueOf = (r: any) => Number(r.units) || 0
  const unitLabel = 'uds'

  // Tipos que cuentan para la vista: las entregas incluyen el histórico cargado
  const types = filters.movement === 'entrega' ? ['entrega', 'historico'] : [filters.movement]
  const fromYear = filters.year - 3
  const since = new Date(Date.UTC(fromYear, 0, 1)).toISOString()
  const until = new Date(Date.UTC(filters.year + 1, 0, 2)).toISOString()

  const [movements, optionYears, famRows, clientRows] = await Promise.all([
    fetchAll<any>((from, to) => {
      let q = supabase
        .from('product_movements')
        .select('product_id, family_code, movement_type, units, client_id, occurred_at, product:products(code, name)')
        .in('movement_type', types)
        .gte('occurred_at', since)
        .lt('occurred_at', until)
        .order('occurred_at', { ascending: true })
        .range(from, to)
      if (filters.family) q = q.eq('family_code', filters.family)
      if (filters.productId) q = q.eq('product_id', filters.productId)
      if (filters.clientId) q = q.eq('client_id', filters.clientId)
      return q
    }),
    fetchAll<any>((from, to) => supabase.from('product_movements').select('occurred_at').order('occurred_at', { ascending: true }).range(from, to)),
    fetchAll<any>((from, to) => supabase.from('product_movements').select('family_code').range(from, to)),
    supabase.from('clients').select('id, business_name').order('business_name'),
  ])

  const years = [...new Set(optionYears.map(r => localYearMonth(r.occurred_at).year))].sort((a, b) => b - a)
  if (!years.includes(currentYear)) years.unshift(currentYear)
  const families = [...new Set(famRows.map(r => r.family_code))].sort()

  // Productos disponibles para el filtro (de la familia elegida, o todos los con movimientos)
  const { data: productRows } = await (filters.family
    ? supabase.from('product_movements').select('product_id, product:products(code, name)').eq('family_code', filters.family).limit(1000)
    : supabase.from('product_movements').select('product_id, product:products(code, name)').limit(1000))
  const productOptions = new Map<string, { id: string; code: string; name: string }>()
  for (const r of productRows || []) {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    if (p && !productOptions.has(r.product_id)) productOptions.set(r.product_id, { id: r.product_id, code: p.code, name: p.name })
  }

  // ---- Agregación por producto / año / mes ----
  type Agg = Map<string, number> // clave `${year}-${month}` → valor
  const byProduct = new Map<string, { code: string; name: string; agg: Agg }>()
  const byClient = new Map<string, number>()
  const totalsByYearMonth = new Map<string, number>()
  for (const m of movements) {
    const { year, month } = localYearMonth(m.occurred_at)
    const v = valueOf(m)
    const p = Array.isArray(m.product) ? m.product[0] : m.product
    const entry = byProduct.get(m.product_id) || { code: p?.code || '?', name: p?.name || '', agg: new Map() }
    const k = `${year}-${month}`
    entry.agg.set(k, (entry.agg.get(k) || 0) + v)
    byProduct.set(m.product_id, entry)
    totalsByYearMonth.set(k, (totalsByYearMonth.get(k) || 0) + v)
    if (year === filters.year && m.client_id) byClient.set(m.client_id, (byClient.get(m.client_id) || 0) + v)
  }

  const sumYear = (agg: Agg, y: number, upToMonth = 12) => {
    let s = 0
    for (let mo = 1; mo <= upToMonth; mo++) s += agg.get(`${y}-${mo}`) || 0
    return s
  }
  const compareValue = (agg: Agg, month: number): number | null => {
    if (filters.compare === null) return null
    if (filters.compare === 'avg3') {
      const vals = [1, 2, 3].map(i => agg.get(`${filters.year - i}-${month}`)).filter((x): x is number => x != null)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }
    return agg.get(`${filters.compare}-${month}`) || 0
  }

  // Meses del año elegido hasta hoy (si es el actual)
  const monthsElapsed = filters.year === currentYear ? currentMonth : filters.year < currentYear ? 12 : 0

  // Inventario de los productos de la vista
  const productIds = [...byProduct.keys()]
  const { data: inventory } = productIds.length
    ? await supabase.from('inventory').select('product_id, stock_disponible').in('product_id', productIds)
    : { data: [] as any[] }
  const availableByProduct = new Map((inventory || []).map((i: any) => [i.product_id, Number(i.stock_disponible)]))

  // Demanda abierta (pedidos sin entregar) para la reposición
  const { data: openLines } = productIds.length
    ? await supabase
        .from('order_lines')
        .select('product_id, quantity, units, quantity_pending_approval, order:orders!inner(status)')
        .in('product_id', productIds)
        .in('order.status', ['nuevo', 'aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'modificado'])
    : { data: [] as any[] }
  const openDemand = new Map<string, number>()
  for (const l of openLines || []) {
    const u = (l.units || Math.ceil(Number(l.quantity)) || 0) + (l.quantity_pending_approval || 0)
    openDemand.set(l.product_id, (openDemand.get(l.product_id) || 0) + u)
  }

  // ---- Previsión: media del mismo mes en los 3 años anteriores × tendencia ----
  const forecastFor = (agg: Agg, month: number, targetYear = filters.year): number => {
    const prior = [1, 2, 3].map(i => agg.get(`${filters.year - i}-${month}`)).filter((x): x is number => x != null && x > 0)
    const thisYearToDate = sumYear(agg, filters.year, monthsElapsed)
    const priorToDate = sumYear(agg, filters.year - 1, monthsElapsed)
    let trend = thisYearToDate > 0 && priorToDate > 0 ? thisYearToDate / priorToDate : 1
    trend = Math.min(2, Math.max(0.5, trend))
    if (prior.length) return (prior.reduce((a, b) => a + b, 0) / prior.length) * trend
    // Sin histórico de ese mes: media de los últimos 3 meses con datos
    const recent: number[] = []
    for (let i = 1; i <= 12 && recent.length < 3; i++) {
      let y = targetYear, mo = month - i
      while (mo <= 0) { mo += 12; y -= 1 }
      const v = agg.get(`${y}-${mo}`)
      if (v) recent.push(v)
    }
    return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  }
  const nextMonths: Array<{ year: number; month: number }> = []
  for (let i = 1; i <= 3; i++) {
    let mo = currentMonth + i, y = currentYear
    while (mo > 12) { mo -= 12; y += 1 }
    nextMonths.push({ year: y, month: mo })
  }

  // ---- Filas de la matriz ----
  const rows: HistorialRow[] = []
  const forecastRows: HistorialData['forecast'] = []
  for (const [productId, entry] of byProduct) {
    const months = MONTHS_LABELS.map((_, i) => round(entry.agg.get(`${filters.year}-${i + 1}`) || 0))
    const total = round(months.reduce((a, b) => a + b, 0))
    const compareTotal = filters.compare === null ? null : round(MONTHS_LABELS.reduce((s, _, i) => s + (i < monthsElapsed || filters.year < currentYear ? compareValue(entry.agg, i + 1) || 0 : 0), 0))
    const deltaPct = compareTotal && compareTotal > 0 ? round(((total - compareTotal) / compareTotal) * 100, 0) : null
    const last12 = (() => { let s = 0; for (let i = 0; i < 12; i++) { let mo = currentMonth - i, y = currentYear; while (mo <= 0) { mo += 12; y -= 1 } s += entry.agg.get(`${y}-${mo}`) || 0 } return s / 12 })()
    const available = availableByProduct.has(productId) ? availableByProduct.get(productId)! : null
    const coverage = available != null && last12 > 0 ? round(Math.max(0, available) / last12) : null
    rows.push({ productId, code: entry.code, name: entry.name, months, total, compareTotal, deltaPct, available, coverageMonths: coverage })

    const f = nextMonths.map(nm => round(forecastFor(entry.agg, nm.month, nm.year)))
    const demand = f.reduce((a, b) => a + b, 0) + (openDemand.get(productId) || 0)
    forecastRows.push({
      productId, code: entry.code, months: f, available,
      toReplenish: available != null ? Math.max(0, round(demand - Math.max(0, available), 0)) : null,
      openDemand: openDemand.get(productId) || 0,
    })
  }
  rows.sort((a, b) => b.total - a.total)
  forecastRows.sort((a, b) => (b.toReplenish ?? -1) - (a.toReplenish ?? -1) || b.months[0] - a.months[0])

  // ---- Serie mensual total ----
  const totalAgg: Agg = totalsByYearMonth
  const monthly = MONTHS_LABELS.map((_, i) => {
    const month = i + 1
    const isFuture = filters.year > currentYear || (filters.year === currentYear && month > currentMonth)
    return {
      month,
      current: round(totalAgg.get(`${filters.year}-${month}`) || 0),
      compare: filters.compare === null ? null : round(compareValue(totalAgg, month) || 0),
      forecast: isFuture && filters.year === currentYear ? round(forecastFor(totalAgg, month)) : null,
    }
  })

  // ---- KPIs ----
  const total = round(monthly.reduce((s, m) => s + m.current, 0))
  const compareTotal = filters.compare === null ? null : round(monthly.reduce((s, m, i) => s + (i < monthsElapsed || filters.year < currentYear ? m.compare || 0 : 0), 0))
  const last12Total = (() => { let s = 0; for (let i = 0; i < 12; i++) { let mo = currentMonth - i, y = currentYear; while (mo <= 0) { mo += 12; y -= 1 } s += totalAgg.get(`${y}-${mo}`) || 0 } return s })()
  const forecast3 = round(nextMonths.reduce((s, nm) => s + forecastFor(totalAgg, nm.month, nm.year), 0))
  const totalAvailable = rows.reduce((s, r) => s + Math.max(0, r.available ?? 0), 0)
  const coverageMonths = last12Total > 0 ? round(totalAvailable / (last12Total / 12)) : null
  const best = monthly.reduce<{ month: number; value: number } | null>((b, m) => (m.current > 0 && (!b || m.current > b.value) ? { month: m.month, value: m.current } : b), null)

  // ---- Clientes ----
  const clientNames = new Map((clientRows.data || []).map(c => [c.id, c.business_name || 'Sin nombre']))
  const clientTotal = [...byClient.values()].reduce((a, b) => a + b, 0)
  const clients = [...byClient.entries()]
    .map(([id, value]) => ({ name: clientNames.get(id) || 'Cliente', value: round(value), pct: clientTotal ? round((value / clientTotal) * 100, 0) : 0 }))
    .sort((a, b) => b.value - a.value)
  const topClients = clients.slice(0, 4)
  if (clients.length > 4) {
    const rest = clients.slice(4)
    topClients.push({ name: `Otros ${rest.length} clientes`, value: round(rest.reduce((s, c) => s + c.value, 0)), pct: rest.reduce((s, c) => s + c.pct, 0) })
  }

  // ---- Cortes y remanentes del año (siempre en unidades/metros) ----
  const yearStart = new Date(Date.UTC(filters.year, 0, 1)).toISOString(), yearEnd = new Date(Date.UTC(filters.year + 1, 0, 2)).toISOString()
  let extrasQ = supabase.from('product_movements').select('movement_type, units').in('movement_type', ['corte', 'remanente']).gte('occurred_at', yearStart).lt('occurred_at', yearEnd)
  if (filters.family) extrasQ = extrasQ.eq('family_code', filters.family)
  if (filters.productId) extrasQ = extrasQ.eq('product_id', filters.productId)
  const { data: extrasRows } = await extrasQ.limit(5000)
  const cuts = (extrasRows || []).filter(r => r.movement_type === 'corte').reduce((s, r) => s + Number(r.units), 0)
  const remnantUnits = (extrasRows || []).filter(r => r.movement_type === 'remanente').reduce((s, r) => s + Number(r.units), 0)
  const deliveredUnits = filters.movement === 'entrega' ? total : movements.filter(m => localYearMonth(m.occurred_at).year === filters.year).reduce((s, m) => s + Number(m.units), 0)

  return {
    filters,
    options: {
      years,
      families,
      products: [...productOptions.values()].sort((a, b) => a.code.localeCompare(b.code)),
      clients: (clientRows.data || []).map(c => ({ id: c.id, name: c.business_name || 'Sin nombre' })),
    },
    kpis: {
      total, compareTotal,
      deltaPct: compareTotal && compareTotal > 0 ? round(((total - compareTotal) / compareTotal) * 100, 0) : null,
      monthlyAvg12: round(last12Total / 12),
      forecast3,
      coverageMonths,
      lowCoverageProducts: rows.filter(r => r.coverageMonths != null && r.coverageMonths < 1).length,
      bestMonth: best,
    },
    monthly,
    rows,
    forecast: forecastRows.slice(0, 12),
    clients: topClients,
    extras: { cuts: round(cuts, 0), exactPieces: Math.max(0, round(deliveredUnits - cuts, 0)), remnantUnits: round(remnantUnits, 0) },
    unitLabel,
  }
}
