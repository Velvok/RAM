'use server'

import { createAdminClient } from '@/lib/supabase/server'

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
      cut_orders(
        *,
        product:products(*),
        assigned_inventory:inventory(*),
        operator:users(id, name, email),
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
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(name),
      cut_orders(
        id,
        status,
        quantity_requested,
        quantity_cut
      )
    `)
    .in('status', ['aprobado', 'en_corte', 'finalizado'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
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
