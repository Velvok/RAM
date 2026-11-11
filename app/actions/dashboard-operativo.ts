'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { extractFamilyCode, extractSizeFromCode } from '@/lib/product-utils'
import { lineUnits } from '@/lib/order-modification'
import { getPlantaAlerts } from '@/lib/planta-status'

// Dashboard operativo: qué hay que hacer ahora, qué pasa en planta y qué
// stock comprometen los pedidos abiertos. Todo sale de tablas existentes.

const OPEN_STATUSES = ['nuevo', 'aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'modificado', 'parcialmente_entregado']

export interface DashboardTile {
  key: 'por_aprobar' | 'en_pausa' | 'en_corte' | 'listos' | 'entregados' | 'evo'
  label: string
  value: number | string
  detail: string
  tone: 'default' | 'warning' | 'success' | 'danger'
  href: string
}

export interface ActionItem {
  severity: 'alta' | 'media'
  orderId: string | null
  orderNumber: string
  client: string
  text: string
  cta: string
  href: string
  ageHours: number
}

export interface PlantaRow {
  orderId: string
  orderNumber: string
  reference: string
  product: string
  material: string
  operator: string
  done: number
  total: number
  state: 'cortando' | 'pendiente' | 'sin_stock' | 'confirmar' | 'preparando'
  lastActivity: string | null
}

export interface StockRow {
  productId: string
  code: string
  name: string
  available: number
  reserved: number
  pendingApproval: number
  missing: number
  coverageMonths: number | null
  alternative: string | null
}

export interface OperationalDashboard {
  generatedAt: string
  tiles: DashboardTile[]
  actions: ActionItem[]
  planta: { rows: PlantaRow[]; activeOperators: number; lastCutAt: string | null }
  daily: Array<{ date: string; units: number }>
  stock: StockRow[]
  evo: { inbound: number; deliveries: number; outbound: number; failed: number; pending: number; avgConfirmSeconds: number | null }
  week: {
    delivered: number
    deliveredPrevWeek: number
    avgApproveToFinishDays: number | null
    avgFinishToDeliveryDays: number | null
    /** Chapas cortadas en la semana (unidades) */
    sheetsCut: number
    /** Chapas de las que salió sobrante al estante de remanentes */
    remnantSheets: number
    sizeChanges: number
    reassignments: number
  }
}

const HOURS = 3600 * 1000
const DAYS = 24 * HOURS

function startOfWeek(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // lunes = 0
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export async function getOperationalDashboard(): Promise<OperationalDashboard> {
  await requireAdmin()
  const supabase = createAdminClient()

  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * HOURS).toISOString()
  const since14d = new Date(now.getTime() - 14 * DAYS).toISOString()
  const weekStart = startOfWeek(now)
  const prevWeekStart = new Date(weekStart.getTime() - 7 * DAYS)

  const [ordersRes, deliveredRes, cutsRes, prepsRes, activityRes, outboundRes, inboundRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, order_number, status, status_before_modification, created_at, approved_at, delivered_at,
        client:clients(business_name),
        lines:order_lines(product_id, quantity, units, quantity_pending_approval, product:products(code, name, category, length_meters))
      `)
      .in('status', OPEN_STATUSES),
    supabase
      .from('orders')
      .select('id, approved_at, delivered_at, cut_orders!cut_orders_order_id_fkey(finished_at), preparation_items(finished_at)')
      .eq('status', 'entregado')
      .gte('delivered_at', prevWeekStart.toISOString()),
    supabase
      .from('cut_orders')
      .select(`
        id, order_id, cut_number, status, product_id, quantity_requested, quantity_cut, material_base_id, parent_cut_order_id,
        reassigned_from_order_id, created_at, updated_at, finished_at,
        product:products!cut_orders_product_id_fkey(code, name, length_meters),
        material:products!cut_orders_material_base_id_fkey(code, length_meters),
        order:orders!cut_orders_order_id_fkey(status, order_number)
      `)
      .in('status', ['pendiente', 'pendiente_confirmacion']),
    supabase
      .from('preparation_items')
      .select('id, order_id, product_id, status, quantity_requested, quantity_prepared, assigned_inventory_id, updated_at, product:products(code, name), order:orders!preparation_items_order_id_fkey(status, order_number)')
      .in('status', ['pendiente', 'en_proceso']),
    supabase
      .from('order_activity_log')
      .select('activity_type, cut_order_id, metadata, description, created_at')
      .gte('created_at', since14d)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('outbound_events')
      .select('status, created_at, completed_at')
      .gte('created_at', since24h),
    supabase
      .from('evo_events')
      .select('tipo_evento, success')
      .gte('created_at', since24h),
  ])

  const orders = (ordersRes.data || []) as any[]
  // Lo pendiente de pedidos ya cerrados (cancelados) no es trabajo de planta
  const openOrder = (x: any) => !['cancelado', 'entregado'].includes((Array.isArray(x.order) ? x.order[0] : x.order)?.status)
  const cuts = ((cutsRes.data || []) as any[]).filter(openOrder)
  const preps = ((prepsRes.data || []) as any[]).filter(openOrder)
  const activity = (activityRes.data || []) as any[]
  const outbound = outboundRes.data || []
  const inbound = inboundRes.data || []
  const delivered = (deliveredRes.data || []) as any[]

  const clientName = (o: any) => (Array.isArray(o.client) ? o.client[0] : o.client)?.business_name || 'Sin cliente'
  const realStatus = (o: any) => (o.status === 'modificado' ? o.status_before_modification || 'aprobado' : o.status)

  // ---------- Tarjetas ----------
  const nuevos = orders.filter(o => o.status === 'nuevo')
  const enPausa = orders.filter(o => o.status === 'aprobado_en_pausa')
  const enCorte = orders.filter(o => ['aprobado', 'en_corte', 'parcialmente_entregado'].includes(realStatus(o)) && o.status !== 'nuevo')
  const listos = orders.filter(o => realStatus(o) === 'finalizado')
  const deliveredThisWeek = delivered.filter(o => new Date(o.delivered_at) >= weekStart)
  const deliveredPrevWeek = delivered.filter(o => new Date(o.delivered_at) < weekStart)

  // Stock por producto (solo lo que necesitan los pedidos abiertos)
  const productIds = new Set<string>()
  for (const o of orders) for (const l of o.lines || []) productIds.add(l.product_id)
  for (const c of cuts) if (c.material_base_id) productIds.add(c.material_base_id)

  const { data: inventoryRows } = productIds.size
    ? await supabase.from('inventory').select('product_id, stock_total, stock_reservado, stock_disponible').in('product_id', [...productIds])
    : { data: [] as any[] }
  const inventoryByProduct = new Map((inventoryRows || []).map((i: any) => [i.product_id, i]))

  // Ventas medias mensuales (últimos 12 meses) para la cobertura
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const { data: history } = productIds.size
    ? await supabase
        .from('annual_history')
        .select('product_id, year, month, sales_units')
        .in('product_id', [...productIds])
        .or(`year.gt.${twelveMonthsAgo.getFullYear()},and(year.eq.${twelveMonthsAgo.getFullYear()},month.gte.${twelveMonthsAgo.getMonth() + 1})`)
    : { data: [] as any[] }
  const monthlySales = new Map<string, number>()
  for (const h of history || []) monthlySales.set(h.product_id, (monthlySales.get(h.product_id) || 0) + (h.sales_units || 0))

  const productById = new Map<string, any>()
  for (const o of orders) for (const l of o.lines || []) if (l.product) productById.set(l.product_id, l.product)
  for (const c of cuts) { if (c.product) productById.set(c.product_id, c.product); if (c.material && c.material_base_id) productById.set(c.material_base_id, c.material) }

  // Alternativas de corte: inventario de toda la familia de los productos abiertos
  const families = new Set<string>()
  for (const id of productIds) { const p = productById.get(id); if (p?.category === 'chapa' || /^[A-Z]/.test(p?.code || '')) families.add(extractFamilyCode(p.code)) }
  const familyStock: Array<{ code: string; available: number }> = []
  if (families.size) {
    const { data: famProducts } = await supabase
      .from('products')
      .select('id, code')
      .or([...families].map(f => `code.ilike.${f.replace(/[%_]/g, c => '\\' + c)}%`).join(','))
    const famById = new Map((famProducts || []).map((p: any) => [p.id, p.code]))
    if (famById.size) {
      const { data: famInv } = await supabase
        .from('inventory')
        .select('product_id, stock_disponible')
        .in('product_id', [...famById.keys()])
        .gt('stock_disponible', 0)
      for (const row of famInv || []) familyStock.push({ code: famById.get(row.product_id)!, available: Number(row.stock_disponible) })
    }
  }
  // Devuelve "mismo largo" si hay stock del producto exacto, o el largo mayor más
  // cercano con stock suficiente para cortar, o null
  function findAlternative(code: string | undefined, qty: number): string | null {
    if (!code) return null
    const family = extractFamilyCode(code)
    const size = extractSizeFromCode(code)
    const exact = familyStock.find(f => f.code === code)
    if (exact && exact.available >= qty) return 'mismo largo'
    const options = familyStock
      .filter(f => extractFamilyCode(f.code) === family && extractSizeFromCode(f.code) > size && f.available >= qty)
      .sort((a, b) => extractSizeFromCode(a.code) - extractSizeFromCode(b.code))
    return options.length ? `${extractSizeFromCode(options[0].code)} m` : null
  }

  const unitsWithoutStock = (o: any) =>
    o.lines?.reduce((sum: number, l: any) => {
      const inv = inventoryByProduct.get(l.product_id)
      const need = lineUnits(l) + (l.quantity_pending_approval || 0)
      return sum + (inv && Number(inv.stock_disponible) >= need ? 0 : need)
    }, 0) || 0

  const nuevosSinStock = nuevos.filter(o => unitsWithoutStock(o) > 0).length
  const pausaUnidades = cuts.filter(c => !c.material_base_id).reduce((s, c) => s + Number(c.quantity_requested), 0)
    + preps.filter(p => !p.assigned_inventory_id).reduce((s, p) => s + Number(p.quantity_requested), 0)
  const enCorteUnidades = cuts.filter(c => c.material_base_id && c.status === 'pendiente').reduce((s, c) => s + (Number(c.quantity_requested) - Number(c.quantity_cut || 0)), 0)
    + preps.filter(p => p.assigned_inventory_id).reduce((s, p) => s + (Number(p.quantity_requested) - Number(p.quantity_prepared || 0)), 0)

  const finishedAt = (o: any) => {
    const times = [...(o.cut_orders || []), ...(o.preparation_items || [])].map((x: any) => x.finished_at).filter(Boolean).map((t: string) => new Date(t).getTime())
    return times.length ? new Date(Math.max(...times)) : null
  }
  const cutsByOrder = new Map<string, any[]>()
  for (const c of cuts) cutsByOrder.set(c.order_id, [...(cutsByOrder.get(c.order_id) || []), c])

  const listosViejos = listos.filter(o => {
    const t = finishedAtFromOpen(o.id)
    return t && now.getTime() - t.getTime() > 3 * DAYS
  })
  function finishedAtFromOpen(orderId: string): Date | null {
    // Para pedidos abiertos no cargamos cortes completados: usamos la actividad
    const last = activity.find(a => a.cut_order_id && (cutsByOrder.get(orderId) || []).some(c => c.id === a.cut_order_id))
    return last ? new Date(last.created_at) : null
  }

  const outboundFailed = outbound.filter(e => e.status === 'failed').length
  const outboundPending = outbound.filter(e => e.status === 'pending' || e.status === 'processing').length

  const tiles: DashboardTile[] = [
    { key: 'por_aprobar', label: 'Por aprobar', value: nuevos.length, detail: nuevosSinStock ? `${nuevosSinStock} sin stock suficiente` : 'todos con stock', tone: nuevosSinStock ? 'warning' : 'default', href: '/admin/pedidos?status=nuevo' },
    { key: 'en_pausa', label: 'En pausa', value: enPausa.length, detail: `${pausaUnidades} unidades sin stock asignado`, tone: enPausa.length ? 'warning' : 'default', href: '/admin/pedidos?status=aprobado_en_pausa' },
    { key: 'en_corte', label: 'En corte', value: enCorte.length, detail: `${enCorteUnidades} unidades pendientes`, tone: 'default', href: '/admin/pedidos?status=en_corte' },
    { key: 'listos', label: 'Listos para remito', value: listos.length, detail: listosViejos.length ? `${listosViejos.length} llevan más de 3 días` : 'esperando remito de EVO', tone: listosViejos.length ? 'warning' : 'default', href: '/admin/pedidos?status=finalizado' },
    { key: 'entregados', label: 'Entregados esta semana', value: deliveredThisWeek.length, detail: `${deliveredThisWeek.length - deliveredPrevWeek.length >= 0 ? '+' : ''}${deliveredThisWeek.length - deliveredPrevWeek.length} respecto a la anterior`, tone: 'success', href: '/admin/pedidos?status=entregado' },
    { key: 'evo', label: 'Cola EVO', value: outboundFailed ? `${outboundFailed} fallos` : outboundPending ? `${outboundPending} pend.` : 'OK', detail: `${outboundPending} pendientes · ${outboundFailed} fallos en 24 h`, tone: outboundFailed ? 'danger' : outboundPending ? 'warning' : 'success', href: '/admin/logs' },
  ]

  // ---------- Requiere acción ----------
  const actions: ActionItem[] = []
  for (const o of nuevos) {
    const age = (now.getTime() - new Date(o.created_at).getTime()) / HOURS
    if (age >= 24) actions.push({ severity: 'alta', orderId: o.id, orderNumber: o.order_number, client: clientName(o), text: `nuevo desde hace ${Math.floor(age)} h sin aprobar`, cta: 'Aprobar', href: `/admin/pedidos/${o.id}`, ageHours: age })
  }
  for (const o of orders.filter(x => x.status === 'modificado')) {
    const pending = (o.lines || []).filter((l: any) => l.quantity_pending_approval > 0).map((l: any) => `+${l.quantity_pending_approval} ${l.product?.code}`).join(', ')
    actions.push({ severity: 'alta', orderId: o.id, orderNumber: o.order_number, client: clientName(o), text: `EVO amplió el pedido: ${pending} pendientes de aprobar`, cta: 'Revisar', href: `/admin/pedidos/${o.id}`, ageHours: 0 })
  }
  for (const o of enPausa) {
    const missing = (cutsByOrder.get(o.id) || []).filter(c => !c.material_base_id)
    for (const c of missing) {
      const alt = findAlternative(c.product?.code, Number(c.quantity_requested))
      actions.push({ severity: 'media', orderId: o.id, orderNumber: o.order_number, client: clientName(o), text: `en pausa: ${c.quantity_requested} × ${c.product?.code} sin stock asignado${alt === 'mismo largo' ? '. Hay stock de ese largo' : alt ? `. Hay ${alt} para cortar` : '. Sin stock en la familia'}`, cta: 'Asignar stock', href: `/admin/pedidos/${o.id}`, ageHours: (now.getTime() - new Date(o.created_at).getTime()) / HOURS })
    }
  }
  for (const o of listosViejos) {
    const t = finishedAtFromOpen(o.id)
    const days = t ? Math.floor((now.getTime() - t.getTime()) / DAYS) : 0
    actions.push({ severity: 'media', orderId: o.id, orderNumber: o.order_number, client: clientName(o), text: `finalizado hace ${days} días, EVO aún no envió el remito`, cta: 'Ver', href: `/admin/pedidos/${o.id}`, ageHours: days * 24 })
  }
  for (const c of cuts.filter(x => x.status === 'pendiente_confirmacion')) {
    actions.push({ severity: 'media', orderId: c.order_id, orderNumber: c.order?.order_number || '', client: '', text: `reasignación de ${c.quantity_requested} × ${c.product?.code}: esperando confirmación de recogida en planta`, cta: 'Ver', href: `/admin/pedidos/${c.order_id}`, ageHours: (now.getTime() - new Date(c.updated_at).getTime()) / HOURS })
  }
  if (outboundFailed) {
    actions.push({ severity: 'alta', orderId: null, orderNumber: 'EVO', client: '', text: `${outboundFailed} evento(s) hacia EVO fallidos en las últimas 24 h`, cta: 'Ver logs', href: '/admin/logs', ageHours: 0 })
  }
  // Tablets de planta: acciones no registradas, sin conexión con acciones guardadas, sincronizaciones tardías
  for (const a of await getPlantaAlerts(supabase, now).catch(() => [])) {
    actions.push({ ...a, client: '', cta: a.orderId ? 'Ver pedido' : 'Ver', href: a.orderId ? `/admin/pedidos/${a.orderId}` : '/admin' })
  }
  actions.sort((a, b) => (a.severity === b.severity ? b.ageHours - a.ageHours : a.severity === 'alta' ? -1 : 1))

  // ---------- Planta ahora ----------

  const lastCutActivity = new Map<string, any>()
  for (const a of activity) if (a.cut_order_id && a.activity_type === 'cut_completed' && !lastCutActivity.has(a.cut_order_id)) lastCutActivity.set(a.cut_order_id, a)

  const plantaRows: PlantaRow[] = []
  for (const c of cuts) {
    const done = Number(c.quantity_cut || 0), total = Number(c.quantity_requested)
    const last = lastCutActivity.get(c.id)
    const state: PlantaRow['state'] = c.status === 'pendiente_confirmacion' ? 'confirmar' : !c.material_base_id ? 'sin_stock' : done > 0 ? 'cortando' : 'pendiente'
    plantaRows.push({
      orderId: c.order_id, orderNumber: c.order?.order_number || '', reference: c.cut_number, product: c.product?.code || '',
      material: c.material?.code ? (c.material.code === c.product?.code ? 'exacta' : `desde ${c.material.code}`) : '—',
      operator: last?.metadata?.operator_name || '—', done, total, state, lastActivity: last?.created_at || null,
    })
  }
  for (const p of preps) {
    const done = Number(p.quantity_prepared || 0), total = Number(p.quantity_requested)
    plantaRows.push({
      orderId: p.order_id, orderNumber: p.order?.order_number || '', reference: `PREP ${p.product?.code || ''}`, product: p.product?.code || '',
      material: p.assigned_inventory_id ? 'preparación' : '—', operator: '—', done, total,
      state: !p.assigned_inventory_id ? 'sin_stock' : done > 0 ? 'preparando' : 'pendiente', lastActivity: done > 0 ? p.updated_at : null,
    })
  }
  const stateOrder = { cortando: 0, preparando: 0, confirmar: 1, pendiente: 2, sin_stock: 3 }
  plantaRows.sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || (b.lastActivity || '').localeCompare(a.lastActivity || ''))

  const activeOperators = new Set(activity.filter(a => a.activity_type === 'cut_completed' && new Date(a.created_at).getTime() > now.getTime() - 8 * HOURS).map(a => a.metadata?.operator_name).filter(Boolean)).size
  const lastCut = activity.find(a => a.activity_type === 'cut_completed' || a.activity_type === 'item_prepared')

  // ---------- Unidades por día (14 días) ----------
  const daily: Array<{ date: string; units: number }> = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    daily.push({ date: d.toISOString().slice(0, 10), units: 0 })
  }
  const dailyIndex = new Map(daily.map((d, i) => [d.date, i]))
  for (const a of activity) {
    const units = a.activity_type === 'cut_completed' ? Number(a.metadata?.quantity_cut || 0) : a.activity_type === 'item_prepared' ? Number(a.metadata?.quantity || 0) : 0
    if (!units) continue
    const idx = dailyIndex.get(a.created_at.slice(0, 10))
    if (idx != null) daily[idx].units += units
  }

  // ---------- Stock comprometido ----------
  // Demanda aún sin stock: líneas por aprobar, ampliaciones pendientes y cortes /
  // preparaciones en pausa sin material asignado
  const demand = new Map<string, { reserved: number; pending: number }>()
  const addDemand = (productId: string, units: number) => {
    const d = demand.get(productId) || { reserved: 0, pending: 0 }
    d.pending += units
    demand.set(productId, d)
  }
  for (const o of orders) for (const l of o.lines || []) {
    addDemand(l.product_id, (o.status === 'nuevo' ? lineUnits(l) : 0) + (l.quantity_pending_approval || 0))
  }
  for (const c of cuts) if (!c.material_base_id && c.product_id) addDemand(c.product_id, Number(c.quantity_requested))
  for (const p of preps) if (!p.assigned_inventory_id && p.product_id) addDemand(p.product_id, Number(p.quantity_requested))
  const stock: StockRow[] = []
  for (const [productId, d] of demand) {
    const inv = inventoryByProduct.get(productId)
    const p = productById.get(productId)
    if (!p) continue
    const available = Number(inv?.stock_disponible ?? 0), reserved = Number(inv?.stock_reservado ?? 0)
    const monthly = (monthlySales.get(productId) || 0) / 12
    stock.push({
      productId, code: p.code, name: p.name, available, reserved, pendingApproval: d.pending,
      missing: Math.max(0, d.pending - Math.max(0, available)),
      coverageMonths: monthly > 0 ? round1(available / monthly) : null,
      alternative: d.pending > Math.max(0, available) ? findAlternative(p.code, d.pending - Math.max(0, available)) : null,
    })
  }
  stock.sort((a, b) => b.missing - a.missing || (a.coverageMonths ?? 99) - (b.coverageMonths ?? 99) || b.pendingApproval - a.pendingApproval)

  // ---------- EVO 24 h ----------
  const confirmTimes = outbound.filter(e => e.status === 'success' && e.completed_at).map(e => (new Date(e.completed_at!).getTime() - new Date(e.created_at).getTime()) / 1000)
  const evo = {
    inbound: inbound.filter(e => e.tipo_evento === 'pedido_creado').length,
    deliveries: inbound.filter(e => e.tipo_evento === 'pedido_entregado').length,
    outbound: outbound.length,
    failed: outboundFailed,
    pending: outboundPending,
    avgConfirmSeconds: confirmTimes.length ? Math.round(confirmTimes.reduce((a, b) => a + b, 0) / confirmTimes.length) : null,
  }

  // ---------- Semana ----------
  const approveToFinish: number[] = [], finishToDelivery: number[] = []
  for (const o of deliveredThisWeek) {
    const f = finishedAt(o)
    if (f && o.approved_at) approveToFinish.push((f.getTime() - new Date(o.approved_at).getTime()) / DAYS)
    if (f && o.delivered_at) finishToDelivery.push((new Date(o.delivered_at).getTime() - f.getTime()) / DAYS)
  }
  const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const weekActivity = activity.filter(a => new Date(a.created_at) >= weekStart)
  // RAM trabaja en unidades: se cuentan chapas, no metros
  let sheetsCut = 0, remnantSheets = 0
  for (const a of weekActivity.filter(x => x.activity_type === 'cut_completed')) {
    const m = a.metadata || {}
    sheetsCut += Number(m.quantity_cut || 0)
    if (Number(m.remnant_per_sheet || 0) > 0) remnantSheets += Number(m.sheets_used || 0)
  }
  const { count: sizeChanges } = await supabase.from('cut_orders').select('id', { count: 'exact', head: true }).not('parent_cut_order_id', 'is', null).gte('created_at', weekStart.toISOString())

  return {
    generatedAt: now.toISOString(),
    tiles,
    actions,
    planta: { rows: plantaRows.slice(0, 10), activeOperators, lastCutAt: lastCut?.created_at || null },
    daily,
    stock: stock.slice(0, 8),
    evo,
    week: {
      delivered: deliveredThisWeek.length,
      deliveredPrevWeek: deliveredPrevWeek.length,
      avgApproveToFinishDays: avg(approveToFinish),
      avgFinishToDeliveryDays: avg(finishToDelivery),
      sheetsCut,
      remnantSheets,
      sizeChanges: sizeChanges || 0,
      reassignments: weekActivity.filter(x => x.activity_type === 'reassignment_confirmed').length,
    },
  }
}
