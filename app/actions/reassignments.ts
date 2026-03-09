'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Reasigna un corte completado de un pedido a otro
 * Esto "desarma" el pedido origen y asigna el material al pedido destino
 */
export async function reassignCutOrder(
  fromCutOrderId: string,
  toCutOrderId: string,
  reason?: string
) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuario no autenticado')

  // 1. Obtener información del corte origen (debe estar completado)
  const { data: fromCutOrder, error: fromError } = await supabase
    .from('cut_orders')
    .select('*, order:orders(*), product:products(*)')
    .eq('id', fromCutOrderId)
    .single()

  if (fromError) throw fromError
  if (fromCutOrder.status !== 'completada') {
    throw new Error('Solo se pueden reasignar cortes completados')
  }

  // 2. Obtener información del corte destino (debe estar pendiente)
  const { data: toCutOrder, error: toError } = await supabase
    .from('cut_orders')
    .select('*, order:orders(*), product:products(*)')
    .eq('id', toCutOrderId)
    .single()

  if (toError) throw toError
  if (toCutOrder.status !== 'pendiente') {
    throw new Error('Solo se puede reasignar a cortes pendientes')
  }

  // 3. Validar que sean del mismo producto y cantidad compatible
  if (fromCutOrder.product_id !== toCutOrder.product_id) {
    throw new Error('Los cortes deben ser del mismo producto')
  }
  if (fromCutOrder.quantity_requested < toCutOrder.quantity_requested) {
    throw new Error('El corte origen debe tener cantidad suficiente')
  }

  // 4. Registrar la reasignación en historial
  const { error: reassignmentError } = await supabase
    .from('stock_reassignments')
    .insert({
      product_id: fromCutOrder.product_id,
      quantity: toCutOrder.quantity_requested,
      from_order_id: fromCutOrder.order_id,
      from_cut_order_id: fromCutOrderId,
      to_order_id: toCutOrder.order_id,
      to_cut_order_id: toCutOrderId,
      reassigned_by: user.id,
      reason: reason || 'Reasignación manual',
    })

  if (reassignmentError) throw reassignmentError

  // 5. Marcar el corte destino como completado (usando el material del origen)
  const { error: updateToError } = await supabase
    .from('cut_orders')
    .update({
      status: 'completada',
      quantity_cut: toCutOrder.quantity_requested,
      // Copiar datos del corte origen si existen
      material_base_id: fromCutOrder.material_base_id,
      material_base_quantity: fromCutOrder.material_base_quantity,
    })
    .eq('id', toCutOrderId)

  if (updateToError) throw updateToError

  // 6. Marcar el pedido origen como que tiene material reasignado
  const { error: updateFromOrderError } = await supabase
    .from('orders')
    .update({ has_reassigned_stock: true })
    .eq('id', fromCutOrder.order_id)

  if (updateFromOrderError) throw updateFromOrderError

  // 7. Verificar si el pedido origen quedó completamente desarmado
  const { data: remainingCuts, error: remainingError } = await supabase
    .from('cut_orders')
    .select('id, status')
    .eq('order_id', fromCutOrder.order_id)

  if (remainingError) throw remainingError

  const allReassigned = remainingCuts.every(cut => 
    cut.id === fromCutOrderId || cut.status === 'completada'
  )

  // Si todas las órdenes fueron reasignadas o completadas, marcar como desarmado
  if (allReassigned) {
    const { error: disassembleError } = await supabase
      .from('orders')
      .update({
        status: 'desarmado',
        is_disassembled: true,
        disassembled_at: new Date().toISOString(),
        disassembled_by: user.id,
        disassembly_reason: `Material reasignado a pedido ${toCutOrder.order.order_number}`,
      })
      .eq('id', fromCutOrder.order_id)

    if (disassembleError) throw disassembleError
  }

  // 8. Actualizar estado del pedido destino
  await updateOrderStatus(toCutOrder.order_id)

  // 9. Revalidar rutas
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath(`/admin/pedidos/${fromCutOrder.order_id}`, 'page')
  revalidatePath(`/admin/pedidos/${toCutOrder.order_id}`, 'page')
  revalidatePath('/planta/pedidos', 'page')
  revalidatePath(`/planta/pedidos/${toCutOrder.order_id}`, 'page')

  return {
    success: true,
    message: `Material reasignado correctamente`,
    fromOrder: fromCutOrder.order.order_number,
    toOrder: toCutOrder.order.order_number,
    wasDisassembled: allReassigned,
  }
}

/**
 * Actualizar estado del pedido basado en sus cut_orders
 */
async function updateOrderStatus(orderId: string) {
  const supabase = await createClient()

  const { data: cutOrders, error } = await supabase
    .from('cut_orders')
    .select('status')
    .eq('order_id', orderId)

  if (error) throw error
  if (!cutOrders || cutOrders.length === 0) return

  const totalOrders = cutOrders.length
  const completedOrders = cutOrders.filter(co => co.status === 'completada').length

  let newStatus = 'aprobado'
  if (completedOrders === totalOrders) {
    newStatus = 'finalizado'
  } else if (completedOrders > 0) {
    newStatus = 'en_corte'
  }

  await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
}

/**
 * Revertir una reasignación (solo Master Admin)
 */
export async function revertReassignment(reassignmentId: string) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuario no autenticado')

  // TODO: Verificar que el usuario sea Master Admin

  // 1. Obtener la reasignación
  const { data: reassignment, error: reassignmentError } = await supabase
    .from('stock_reassignments')
    .select('*')
    .eq('id', reassignmentId)
    .single()

  if (reassignmentError) throw reassignmentError
  if (reassignment.is_reversed) {
    throw new Error('Esta reasignación ya fue revertida')
  }

  // 2. Marcar como revertida
  const { error: updateError } = await supabase
    .from('stock_reassignments')
    .update({
      is_reversed: true,
      reversed_by: user.id,
      reversed_at: new Date().toISOString(),
    })
    .eq('id', reassignmentId)

  if (updateError) throw updateError

  // 3. Volver el corte destino a pendiente
  const { error: revertToError } = await supabase
    .from('cut_orders')
    .update({
      status: 'pendiente',
      quantity_cut: null,
      material_base_id: null,
      material_base_quantity: null,
    })
    .eq('id', reassignment.to_cut_order_id)

  if (revertToError) throw revertToError

  // 4. Actualizar estados de pedidos
  await updateOrderStatus(reassignment.from_order_id)
  await updateOrderStatus(reassignment.to_order_id)

  // 5. Revalidar rutas
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath(`/admin/pedidos/${reassignment.from_order_id}`, 'page')
  revalidatePath(`/admin/pedidos/${reassignment.to_order_id}`, 'page')

  return { success: true, message: 'Reasignación revertida correctamente' }
}
