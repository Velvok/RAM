'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Confirmar que el operario recogió la pieza reasignada
 * Marca la orden como completada
 */
export async function confirmReassignmentPickup(cutOrderId: string) {
  const supabase = await createClient()

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

  // Marcar como completada
  const { error: updateError } = await supabase
    .from('cut_orders')
    .update({
      status: 'completada',
      quantity_cut: cutOrder.quantity_requested,
      finished_at: new Date().toISOString(),
    })
    .eq('id', cutOrderId)

  if (updateError) throw updateError

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

  // Revalidar rutas
  revalidatePath('/planta/pedidos')
  revalidatePath(`/planta/pedidos/${orderData.id}`)
  revalidatePath('/admin/pedidos')
  revalidatePath(`/admin/pedidos/${orderData.id}`)

  return { success: true }
}
