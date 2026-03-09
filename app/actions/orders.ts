'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getOrders() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(*),
      lines:order_lines(*, product:products(*))
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getOrderById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(*),
      lines:order_lines(*, product:products(*)),
      cut_orders(
        *,
        product:products!cut_orders_product_id_fkey(*),
        material_base:products!cut_orders_material_base_id_fkey(*),
        assigned_operator:users!cut_orders_assigned_to_fkey(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelado' })
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('stock_reservations')
    .update({ is_active: false, released_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('is_active', true)

  await supabase
    .from('cut_orders')
    .update({ status: 'cancelada' })
    .eq('order_id', orderId)
    .in('status', ['generada', 'lanzada'])

  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/cortes', 'page')
  return data
}

// verifyPayment eliminada - Los pedidos ya vienen con pago verificado

export async function generateCutOrders(orderId: string) {
  const supabase = await createClient()

  // Obtener el pedido con sus líneas
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_lines(*, product:products(*))')
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError

  // Crear una orden de corte por cada línea
  // Las órdenes se crean directamente en estado "lanzada" 
  // para que estén disponibles inmediatamente en las tablets
  for (const line of order.order_lines) {
    const cutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    await supabase
      .from('cut_orders')
      .insert({
        cut_number: cutNumber,
        order_id: orderId,
        product_id: line.product_id,
        quantity_requested: line.quantity,
        status: 'lanzada', // Auto-lanzar al generar
      })
  }

  // Actualizar estado del pedido a "lanzado"
  await supabase
    .from('orders')
    .update({ status: 'lanzado' })
    .eq('id', orderId)

  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/cortes', 'page')
  revalidatePath('/planta/ordenes', 'page')
  return { success: true }
}
