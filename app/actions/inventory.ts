'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

// El stock es de solo lectura en RAM: el saldo lo fija EVO (webhook
// stock_actualizado) y aquí solo se consulta junto con lo que reservan los
// pedidos abiertos. No hay ajuste manual.

const ACTIVE_ORDER_STATUSES = ['aprobado', 'aprobado_en_pausa', 'en_corte', 'finalizado', 'modificado', 'parcialmente_entregado']

export async function getInventory() {
  await requireAdmin()
  const supabase = createAdminClient()

  const { count, error: countError } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
  if (countError) throw countError

  // Por lotes de 1000 (límite de PostgREST)
  const batchSize = 1000
  const all: any[] = []
  for (let offset = 0; offset < (count || 0); offset += batchSize) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, product_id, stock_total, stock_reservado, stock_disponible, updated_at, product:products(id, code, name, category, unit)')
      .order('stock_disponible', { ascending: true })
      .range(offset, offset + batchSize - 1)
    if (error) throw error
    all.push(...(data || []))
  }
  return all
}

export async function getInventoryByProduct(productId: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inventory')
    .select('*, product:products(id, code, name, category, unit, evo_product_id)')
    .eq('product_id', productId)
    .single()
  if (error) throw error
  return data
}

export interface StockDemand {
  orderId: string
  orderNumber: string
  orderStatus: string
  client: string
  /** Unidades de este producto que pide el pedido y faltan por cortar/preparar */
  units: number
  /** De esas, cuántas no tienen stock asignado */
  unassigned: number
  /** Si este producto es la chapa de la que se corta otro producto del pedido */
  asMaterialFor?: string
}

/**
 * Inventario + lo que piden los pedidos abiertos + consumo de los últimos 90
 * días (entregas), para la pantalla de Stock.
 */
export async function getStockOverview() {
  await requireAdmin()
  const supabase = createAdminClient()
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()

  const [inventory, cutsRes, prepsRes, movRes] = await Promise.all([
    getInventory(),
    supabase
      .from('cut_orders')
      .select('product_id, material_base_id, quantity_requested, quantity_cut, status, product:products!cut_orders_product_id_fkey(code), order:orders!cut_orders_order_id_fkey!inner(id, order_number, status, client:clients(business_name))')
      .in('status', ['pendiente', 'pendiente_confirmacion'])
      .in('order.status', ACTIVE_ORDER_STATUSES),
    supabase
      .from('preparation_items')
      .select('product_id, assigned_inventory_id, quantity_requested, quantity_prepared, status, order:orders!preparation_items_order_id_fkey!inner(id, order_number, status, client:clients(business_name))')
      .neq('status', 'entregado')
      .in('order.status', ACTIVE_ORDER_STATUSES),
    supabase
      .from('product_movements')
      .select('product_id, units')
      .eq('movement_type', 'entrega')
      .gte('occurred_at', since),
  ])
  if (cutsRes.error) throw cutsRes.error
  if (prepsRes.error) throw prepsRes.error

  const demand: Record<string, StockDemand[]> = {}
  const add = (productId: string | null, d: StockDemand) => {
    if (!productId) return
    const list = (demand[productId] ||= [])
    const same = list.find(x => x.orderId === d.orderId && x.asMaterialFor === d.asMaterialFor)
    if (same) { same.units += d.units; same.unassigned += d.unassigned } else list.push(d)
  }
  const one = (v: any) => (Array.isArray(v) ? v[0] : v)

  for (const c of cutsRes.data || []) {
    const order = one(c.order)
    const left = Math.max(0, Number(c.quantity_requested || 0) - Number(c.quantity_cut || 0))
    if (!left || !order) continue
    const base = { orderId: order.id, orderNumber: order.order_number, orderStatus: order.status, client: one(order.client)?.business_name || 'Sin cliente' }
    add(c.product_id, { ...base, units: left, unassigned: c.material_base_id ? 0 : left })
    if (c.material_base_id && c.material_base_id !== c.product_id) {
      add(c.material_base_id, { ...base, units: left, unassigned: 0, asMaterialFor: one(c.product)?.code })
    }
  }
  for (const p of prepsRes.data || []) {
    const order = one(p.order)
    const left = Math.max(0, Number(p.quantity_requested || 0) - Number(p.quantity_prepared || 0))
    if (!left || !order) continue
    add(p.product_id, {
      orderId: order.id, orderNumber: order.order_number, orderStatus: order.status,
      client: one(order.client)?.business_name || 'Sin cliente', units: left, unassigned: p.assigned_inventory_id ? 0 : left,
    })
  }

  const delivered90: Record<string, number> = {}
  for (const m of movRes.data || []) {
    if (m.product_id) delivered90[m.product_id] = (delivered90[m.product_id] || 0) + Number(m.units || 0)
  }

  return {
    inventory: inventory.map((i: any) => ({
      id: i.id as string,
      productId: i.product_id as string,
      code: (one(i.product)?.code || '') as string,
      name: (one(i.product)?.name || '') as string,
      category: (one(i.product)?.category || null) as string | null,
      total: Number(i.stock_total || 0),
      reserved: Number(i.stock_reservado || 0),
      available: Number(i.stock_disponible || 0),
      updatedAt: i.updated_at as string | null,
    })),
    demand,
    delivered90,
    generatedAt: new Date().toISOString(),
  }
}
