'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateOrderStatus } from './orders'

export async function getCutOrders(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders(*, client:clients(*)),
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
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders(*, client:clients(*)),
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
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .update({ assigned_to: operatorId })
    .eq('id', cutOrderId)
    .select()
    .single()

  if (error) throw error

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
  revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
  return data
}

export async function startCutOrder(cutOrderId: string, operatorId: string) {
  const supabase = await createClient()

  // Al iniciar el corte, asignar automáticamente al operario
  const { data, error } = await supabase
    .from('cut_orders')
    .update({
      status: 'en_proceso',
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

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
  revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
  return data
}

export async function pauseCutOrder(cutOrderId: string) {
  const supabase = await createClient()

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

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
  revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
  return data
}

export async function finishCutOrder(
  cutOrderId: string,
  quantityCut: number,
  materialUsedId: string,
  quantityUsed: number,
  remnantGenerated: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cutOrder, error: cutOrderError } = await supabase
    .from('cut_orders')
    .select(`
      *,
      product:products!cut_orders_product_id_fkey(*),
      material_base:products!cut_orders_material_base_id_fkey(*)
    `)
    .eq('id', cutOrderId)
    .single()

  if (cutOrderError) throw cutOrderError

  const { error: updateError } = await supabase
    .from('cut_orders')
    .update({
      status: 'completada',
      quantity_cut: quantityCut,
      finished_at: new Date().toISOString(),
    })
    .eq('id', cutOrderId)

  if (updateError) throw updateError

  const { error: cutLineError } = await supabase
    .from('cut_lines')
    .insert({
      cut_order_id: cutOrderId,
      material_used_id: materialUsedId,
      quantity_used: quantityUsed,
      quantity_produced: quantityCut,
      remnant_generated: remnantGenerated,
      is_scrap: remnantGenerated < (cutOrder.product.min_remnant_threshold || 500),
    })

  if (cutLineError) throw cutLineError

  // NOTA: El consumo de stock ahora se maneja en stock-management.ts
  // con las funciones releaseToInProcess() y consumeStock()
  // Esta sección se mantiene comentada para evitar duplicación
  
  // const { data: stockBefore } = await supabase
  //   .from('inventory')
  //   .select('stock_total, stock_en_proceso')
  //   .eq('product_id', materialUsedId)
  //   .single()

  // await supabase
  //   .from('inventory')
  //   .update({ 
  //     stock_total: (stockBefore?.stock_total || 0) - quantityUsed,
  //     stock_en_proceso: Math.max(0, (stockBefore?.stock_en_proceso || 0) - cutOrder.quantity_requested)
  //   })
  //   .eq('product_id', materialUsedId)

  // await supabase
  //   .from('stock_movements')
  //   .insert({
  //     product_id: materialUsedId,
  //     movement_type: 'corte',
  //     quantity: -quantityUsed,
  //     stock_before: stockBefore?.stock_total || 0,
  //     stock_after: (stockBefore?.stock_total || 0) - quantityUsed,
  //     reference_id: cutOrderId,
  //     reference_type: 'cut_order',
  //     user_id: user?.id,
  //   })

  if (remnantGenerated >= (cutOrder.product.min_remnant_threshold || 500)) {
    await supabase
      .from('remnants')
      .insert({
        product_id: materialUsedId,
        cut_order_id: cutOrderId,
        quantity: remnantGenerated,
        status: 'disponible',
      })
  }

  await supabase
    .from('stock_reservations')
    .update({ is_active: false, released_at: new Date().toISOString() })
    .eq('cut_order_id', cutOrderId)
    .eq('is_active', true)

  // Actualizar estado del pedido
  await updateOrderStatus(cutOrder.order_id)

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${cutOrder.order_id}`, 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/admin/recortes', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
  revalidatePath(`/planta/ordenes/${cutOrderId}`, 'page')
  
  return { success: true }
}
