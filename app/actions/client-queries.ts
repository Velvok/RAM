'use server'

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
  const supabase = createAdminClient()

  // Pedidos activos: aprobados, en corte, finalizados
  // Y pedidos aprobados en pausa que tengan al menos una línea con stock asignado
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
        material_base_id
      ),
      preparation_items!preparation_items_order_id_fkey(
        id,
        assigned_inventory_id
      )
    `)
    .in('status', ['aprobado', 'en_corte', 'finalizado'])
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
        material_base_id
      ),
      preparation_items!preparation_items_order_id_fkey(
        id,
        assigned_inventory_id
      )
    `)
    .eq('status', 'aprobado_en_pausa')
    .order('created_at', { ascending: false })

  if (onHoldError) throw onHoldError

  // Filtrar pedidos en pausa: solo aquellos con cut_orders con material_base_id
  // o preparation_items con assigned_inventory_id
  const onHoldWithStock = (onHoldOrders || []).filter((order: any) => {
    const hasCutOrderWithStock = order.cut_orders?.some((co: any) => co.material_base_id)
    const hasPrepItemWithStock = order.preparation_items?.some((pi: any) => pi.assigned_inventory_id)
    return hasCutOrderWithStock || hasPrepItemWithStock
  })

  return [...(activeOrders || []), ...onHoldWithStock]
}

// =====================================================
// ACTIVITY LOG
// =====================================================

export async function getOrderActivityLog(orderId: string) {
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
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export async function getClientById(clientId: string) {
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
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (error) throw error
  return data
}
