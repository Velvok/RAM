'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { updateOrderStatus } from './orders'
import { revalidateCuts, revalidateOrders, revalidateStock } from '@/lib/revalidate'

export async function getCutOrders(status?: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders!cut_orders_order_id_fkey(*, client:clients(*)),
      product:products!cut_orders_product_id_fkey(*),
      material_base:products!cut_orders_material_base_id_fkey(*),
      assigned_operator:users!cut_orders_assigned_to_fkey(*)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching cut orders:', error)
    throw error
  }
  
  console.log('getCutOrders - Fetched:', data?.length, 'orders')
  return data
}

export async function getCutOrderById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders!cut_orders_order_id_fkey(*, client:clients(*)),
      product:products!cut_orders_product_id_fkey(*),
      material_base:products!cut_orders_material_base_id_fkey(*),
      assigned_operator:users!cut_orders_assigned_to_fkey(*),
      cut_lines(*, material:products!cut_lines_material_used_id_fkey(*))
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function assignCutOrder(cutOrderId: string, operatorId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .update({ assigned_to: operatorId })
    .eq('id', cutOrderId)
    .select()
    .single()

  if (error) throw error

  // Revalidar cortes
  revalidateCuts(cutOrderId)
  return data
}

export async function startCutOrder(cutOrderId: string, operatorId: string) {
  const supabase = createAdminClient()

  // Guard: no se puede (re)iniciar una orden ya completada
  const { data: existing, error: fetchError } = await supabase
    .from('cut_orders')
    .select('status')
    .eq('id', cutOrderId)
    .single()

  if (fetchError) throw fetchError
  if (existing.status === 'completada') {
    throw new Error('No se puede iniciar: esta orden de corte ya está completada')
  }

  // Al iniciar el corte, asignar automáticamente al operario
  const { data, error } = await supabase
    .from('cut_orders')
    .update({
      status: 'pendiente',
      assigned_to: operatorId,
      started_at: new Date().toISOString(),
    })
    .eq('id', cutOrderId)
    .select()
    .single()

  if (error) throw error

  const cutOrder = data
  await supabase
    .from('inventory')
    .update({ stock_en_proceso: supabase.rpc('increment', { x: cutOrder.quantity_requested }) })
    .eq('product_id', cutOrder.product_id)

  // Actualizar estado del pedido
  await updateOrderStatus(cutOrder.order_id)

  // Revalidar de forma agresiva para actualizar la tablet inmediatamente
  revalidatePath('/planta', 'layout')
  revalidatePath('/admin', 'layout')
  revalidatePath(`/planta/pedidos/${cutOrder.order_id}`)
  revalidatePath(`/admin/pedidos/${cutOrder.order_id}`)
  
  // También revalidar las rutas estándar
  revalidateCuts(cutOrderId)
  return data
}

export async function pauseCutOrder(cutOrderId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .update({
      status: 'pausada',
      paused_at: new Date().toISOString(),
    })
    .eq('id', cutOrderId)
    .select()
    .single()

  if (error) throw error

  // Revalidar cortes
  revalidateCuts(cutOrderId)
  return data
}

