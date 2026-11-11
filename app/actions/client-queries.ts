'use server'

import { requireAdmin, requireStaff } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { unstable_noStore } from 'next/cache'

// Deshabilitar caché en todas las queries
unstable_noStore()

/**
 * Server actions para queries que se ejecutan desde componentes cliente
 * Usan createAdminClient() para bypassear RLS
 */

// =====================================================
// PEDIDOS
// =====================================================

export async function getOrderById(orderId: string) {
  await requireStaff()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(*),
      order_lines(
        *,
        product:products(*)
      ),
      cut_orders!cut_orders_order_id_fkey(
        *,
        product:products!cut_orders_product_id_fkey(*),
        material_base:products!cut_orders_material_base_id_fkey(id, code, name),
        material_product:products!cut_orders_material_base_id_fkey(id, code, name, length_meters),
        operator:users!cut_orders_assigned_to_fkey(id, full_name, email),
        reassigned_from_order:orders!cut_orders_reassigned_from_order_id_fkey(id, order_number),
        cut_lines(*)
      ),
      preparation_items(
        *,
        product:products(*),
        assigned_inventory:inventory(*)
      )
    `)
    .eq('id', orderId)
    .single()

  if (error) throw error

  return data
}

export async function getOrdersForPlanta() {
  await requireStaff()

  const supabase = createAdminClient()

  // Pedidos activos: aprobados, en corte, finalizados y modificados (ampliación de
  // EVO sin aprobar: la planta sigue trabajando lo ya aprobado)
  // Y los aprobados en pausa (falta asignar stock a alguna línea)
  const { data: activeOrders, error: activeError } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(business_name),
      cut_orders!cut_orders_order_id_fkey(
        id,
        status,
        quantity_requested,
        quantity_cut,
        material_base_id,
        product:products!cut_orders_product_id_fkey(code)
      ),
      preparation_items!preparation_items_order_id_fkey(
        id,
        status,
        quantity_requested,
        quantity_prepared,
        assigned_inventory_id,
        product:products(code)
      )
    `)
    .in('status', ['aprobado', 'en_corte', 'finalizado', 'modificado', 'parcialmente_entregado'])
    .order('created_at', { ascending: false })

  if (activeError) throw activeError

  const { data: onHoldOrders, error: onHoldError } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(business_name),
      cut_orders!cut_orders_order_id_fkey(
        id,
        status,
        quantity_requested,
        quantity_cut,
        material_base_id,
        product:products!cut_orders_product_id_fkey(code)
      ),
      preparation_items!preparation_items_order_id_fkey(
        id,
        status,
        quantity_requested,
        quantity_prepared,
        assigned_inventory_id,
        product:products(code)
      )
    `)
    .eq('status', 'aprobado_en_pausa')
    .order('created_at', { ascending: false })

  if (onHoldError) throw onHoldError

  // Todos los pedidos en pausa: lo que no tiene stock asignado lo puede
  // asignar el operario desde la tablet (elegir chapa)
  return [...(activeOrders || []), ...(onHoldOrders || [])]
}

// =====================================================
// ACTIVITY LOG
// =====================================================

export async function getOrderActivityLog(orderId: string) {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('order_activity_log')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// =====================================================
// STOCK
// =====================================================

export async function getAvailableStockForProduct(productId: string, minLength?: number) {
  await requireAdmin()

  const supabase = createAdminClient()
  
  let query = supabase
    .from('inventory')
    .select(`
      *,
      product:products(*)
    `)
    .eq('product_id', productId)
    .gt('stock_disponible', 0)
    .order('stock_disponible', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function getStockSuggestions(productId: string, quantityNeeded: number) {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      *,
      product:products(*)
    `)
    .eq('product_id', productId)
    .gte('stock_disponible', quantityNeeded)
    .order('stock_disponible', { ascending: true })
    .limit(5)

  if (error) throw error
  return data || []
}

export async function checkStockAvailability(productId: string) {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('inventory')
    .select('stock_disponible, stock_total')
    .eq('product_id', productId)
    .single()

  if (error) throw error
  return data
}

// =====================================================
// CUT ORDERS
// =====================================================

export async function getCutOrderById(cutOrderId: string) {
  await requireStaff()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('cut_orders')
    .select(`
      *,
      product:products(*),
      assigned_inventory:inventory(*),
      operator:users(id, name, email),
      cut_lines(*)
    `)
    .eq('id', cutOrderId)
    .single()

  if (error) throw error
  return data
}

// =====================================================
// CLIENTS
// =====================================================

export async function getAllClients() {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export async function getClientById(clientId: string) {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error) throw error
  return data
}

// =====================================================
// PRODUCTS
// =====================================================

export async function getAllProducts() {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('code')

  if (error) throw error
  return data || []
}

export async function getProductById(productId: string) {
  await requireAdmin()

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (error) throw error
  return data
}

/**
 * Para la tablet: últimos movimientos del pedido y estado de sus envíos a EVO.
 * Se usa en el detalle de planta (bloque "último movimiento" y aviso de cola).
 */
export async function getPlantaOrderActivity(orderId: string) {
  await requireStaff()
  const supabase = createAdminClient()
  const [activityRes, cutsRes, prepsRes] = await Promise.all([
    supabase
      .from('order_activity_log')
      .select('activity_type, description, metadata, created_at')
      .eq('order_id', orderId)
      .in('activity_type', ['cut_completed', 'item_prepared', 'reassignment_confirmed', 'reassign_in', 'stock_assigned'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('cut_orders').select('id').eq('order_id', orderId),
    supabase.from('preparation_items').select('id').eq('order_id', orderId),
  ])
  // Los eventos salientes no llevan order_id: se filtran por las órdenes de corte
  // y los artículos a preparar del pedido
  const ids = [...(cutsRes.data || []), ...(prepsRes.data || [])].map(r => r.id)
  const { data: related } = ids.length
    ? await supabase.from('outbound_events').select('status').in('related_entity_id', ids).in('status', ['pending', 'processing', 'failed'])
    : { data: [] as any[] }
  return {
    activity: activityRes.data || [],
    evo: {
      pending: (related || []).filter(e => e.status === 'pending' || e.status === 'processing').length,
      failed: (related || []).filter(e => e.status === 'failed').length,
    },
  }
}
