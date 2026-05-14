'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Eliminar todas las cut_orders de un pedido específico
 * Solo para limpieza manual de pedidos creados antes del fix
 */
export async function deleteCutOrdersForOrder(orderId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('cut_orders')
    .delete()
    .eq('order_id', orderId)

  if (error) {
    throw new Error(`Error deleting cut_orders: ${error.message}`)
  }

  console.log(`✅ Deleted all cut_orders for order ${orderId}`)
  return { success: true }
}
