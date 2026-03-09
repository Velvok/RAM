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

// Aprobar pedido y generar órdenes de corte
export async function approveOrder(orderId: string) {
  const supabase = await createClient()

  // Obtener usuario actual (admin)
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener el pedido con sus líneas
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_lines(*, product:products(*))')
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError

  // Verificar que el pedido esté en estado 'nuevo'
  if (order.status !== 'nuevo') {
    throw new Error('Solo se pueden aprobar pedidos en estado "nuevo"')
  }

  // Crear una orden de corte por cada línea
  // Las órdenes se crean en estado "lanzada" para que estén disponibles en tablets
  for (const line of order.order_lines) {
    const cutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    await supabase
      .from('cut_orders')
      .insert({
        cut_number: cutNumber,
        order_id: orderId,
        product_id: line.product_id,
        quantity_requested: line.quantity,
        status: 'lanzada',
      })
  }

  // Actualizar estado del pedido a "aprobado"
  await supabase
    .from('orders')
    .update({ 
      status: 'aprobado',
      approved_at: new Date().toISOString(),
      approved_by: user?.id || null
    })
    .eq('id', orderId)

  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/cortes', 'page')
  revalidatePath('/planta/ordenes', 'page')
  return { success: true }
}

// Mantener función legacy para compatibilidad (ahora llama a approveOrder)
export async function generateCutOrders(orderId: string) {
  return approveOrder(orderId)
}

// Actualizar estado del pedido basado en el estado de sus órdenes de corte
export async function updateOrderStatus(orderId: string) {
  const supabase = await createClient()

  // Obtener todas las órdenes de corte del pedido
  const { data: cutOrders, error } = await supabase
    .from('cut_orders')
    .select('status')
    .eq('order_id', orderId)

  if (error) throw error

  if (!cutOrders || cutOrders.length === 0) {
    // Si no hay órdenes de corte, el pedido debe estar en 'nuevo'
    return
  }

  const totalOrders = cutOrders.length
  const completedOrders = cutOrders.filter(co => co.status === 'completada').length
  const inProgressOrders = cutOrders.filter(co => co.status === 'en_proceso').length

  let newStatus = 'aprobado'

  if (completedOrders === totalOrders) {
    // Todas las órdenes completadas
    newStatus = 'finalizado'
  } else if (inProgressOrders > 0 || completedOrders > 0) {
    // Al menos una orden en proceso o completada
    newStatus = 'en_corte'
  }

  // Actualizar estado del pedido
  await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  revalidatePath('/admin/pedidos', 'page')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/planta/ordenes', 'page')
}
