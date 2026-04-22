'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Confirmar que el operario recogió la pieza reasignada
 * Marca la orden como completada
 */
export async function confirmReassignmentPickup(cutOrderId: string) {
  const supabase = createAdminClient()

  // Obtener información de la orden
  const { data: cutOrder, error: fetchError } = await supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders!cut_orders_order_id_fkey(id, order_number),
      reassigned_from_order:orders!cut_orders_reassigned_from_order_id_fkey(order_number)
    `)
    .eq('id', cutOrderId)
    .single()

  if (fetchError) throw fetchError

  if (cutOrder.status !== 'pendiente_confirmacion') {
    throw new Error('Esta orden no está pendiente de confirmación')
  }

  // Obtener información del producto y material asignado
  const { data: materialInfo, error: materialError } = await supabase
    .from('products')
    .select('id, code, name, length_meters')
    .eq('id', cutOrder.material_base_id)
    .single()

  if (materialError) throw materialError

  const chapaSize = materialInfo.length_meters
  const productSize = cutOrder.quantity_requested
  const remnantSize = chapaSize - productSize

  console.log(`📏 Confirmando reasignación: Chapa ${chapaSize}m → Corte ${productSize}m → Recorte ${remnantSize}m`)

  // NUEVO: Incrementar quantity_cut según la cantidad reasignada
  const quantityToAdd = cutOrder.reassigned_quantity || 1
  const newQuantityCut = (cutOrder.quantity_cut || 0) + quantityToAdd
  const isCompleted = newQuantityCut >= cutOrder.quantity_requested
  
  console.log(`📊 Incrementando quantity_cut: ${cutOrder.quantity_cut || 0} + ${quantityToAdd} = ${newQuantityCut}/${cutOrder.quantity_requested}`)
  
  const { error: updateError } = await supabase
    .from('cut_orders')
    .update({
      quantity_cut: newQuantityCut,
      status: isCompleted ? 'completada' : 'pendiente',
      finished_at: isCompleted ? new Date().toISOString() : null,
      // Limpiar campos de reasignación
      reassigned_from_order_id: null,
      reassigned_from_cut_order_id: null,
      reassigned_quantity: null,
    })
    .eq('id', cutOrderId)

  if (updateError) throw updateError
  
  console.log(`✅ Orden confirmada: ${newQuantityCut}/${cutOrder.quantity_requested} → estado: ${isCompleted ? 'completada' : 'pendiente'}`)

  // NUEVO: Si la chapa es mayor, generar recorte
  if (remnantSize > 0) {
    console.log(`✂️ Generando recorte de ${remnantSize}m...`)
    
    const { generateRemnantStock } = await import('./stock-management')
    
    try {
      // generateRemnantStock espera el código completo del producto (ej: AC25110.5,0)
      // y calcula el código del recorte automáticamente
      await generateRemnantStock(
        materialInfo.code,
        remnantSize
      )
      console.log(`✅ Recorte de ${remnantSize}m agregado al stock`)
    } catch (error) {
      console.error('Error generando recorte:', error)
      // No fallar la confirmación si falla el recorte
    }
  }

  // Registrar en el log
  const orderData = Array.isArray(cutOrder.order) ? cutOrder.order[0] : cutOrder.order
  const fromOrderData = Array.isArray(cutOrder.reassigned_from_order) 
    ? cutOrder.reassigned_from_order[0] 
    : cutOrder.reassigned_from_order

  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('order_activity_log').insert({
    order_id: orderData.id,
    cut_order_id: cutOrderId,
    activity_type: 'reassignment_confirmed',
    description: `Operario confirmó recogida de pieza reasignada desde pedido ${fromOrderData?.order_number}`,
    metadata: {
      reassigned_from_order_id: cutOrder.reassigned_from_order_id,
      reassigned_from_cut_order_id: cutOrder.reassigned_from_cut_order_id,
    },
    user_id: user?.id,
  })

  // NUEVO: Actualizar estado del pedido destino (puede pasar a finalizado)
  const { updateOrderStatus } = await import('./orders')
  await updateOrderStatus(orderData.id)
  
  // También actualizar el pedido origen si existe
  if (cutOrder.reassigned_from_order_id) {
    await updateOrderStatus(cutOrder.reassigned_from_order_id)
  }

  // Revalidar rutas
  revalidatePath('/planta/pedidos')
  revalidatePath(`/planta/pedidos/${orderData.id}`)
  revalidatePath('/admin/pedidos')
  revalidatePath(`/admin/pedidos/${orderData.id}`)
  if (cutOrder.reassigned_from_order_id) {
    revalidatePath(`/admin/pedidos/${cutOrder.reassigned_from_order_id}`)
  }

  return { success: true }
}
