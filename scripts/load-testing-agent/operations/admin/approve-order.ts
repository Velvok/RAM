/**
 * Operation: Approve Order (Admin)
 */

import { SimulationContext } from '../../core/orchestrator'

export async function approveOrder(
  context: SimulationContext,
  orderId: string
): Promise<boolean> {
  const { logger, supabase } = context
  
  const startTime = Date.now()
  
  try {
    // Get current order state
    const { data: beforeOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    // Approve the order
    const { error } = await supabase
      .from('orders')
      .update({ status: 'aprobado' })
      .eq('id', orderId)
    
    if (error) throw error
    
    // Generate cut orders automatically
    const { generateCutOrders } = await import('@/app/actions/orders')
    await generateCutOrders(orderId)
    
    // Get after state
    const { data: afterOrder } = await supabase
      .from('orders')
      .select('*, cut_orders(*)')
      .eq('id', orderId)
      .single()
    
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'APPROVE_ORDER',
      actor: 'admin',
      entityType: 'order',
      entityId: orderId,
      beforeState: beforeOrder,
      afterState: afterOrder,
      payload: { orderId },
      result: 'success',
      durationMs: duration,
      relatedEntities: {
        orders: [orderId],
        cutOrders: afterOrder?.cut_orders?.map((co: any) => co.id) || []
      }
    })
    
    return true
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'APPROVE_ORDER',
      actor: 'admin',
      entityType: 'order',
      entityId: orderId,
      beforeState: null,
      afterState: null,
      payload: { orderId },
      result: 'error',
      errorDetails: error.message,
      durationMs: duration
    })
    
    return false
  }
}
