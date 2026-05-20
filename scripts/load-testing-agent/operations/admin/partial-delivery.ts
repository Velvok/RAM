/**
 * Operation: Partial Delivery (Admin)
 */

import { SimulationContext } from '../../core/orchestrator'

export async function partialDelivery(
  context: SimulationContext,
  orderId: string,
  items: { cutOrderId?: string; preparationItemId?: string; quantity: number }[]
): Promise<boolean> {
  const { logger, supabase } = context
  
  const startTime = Date.now()
  
  try {
    // Get current state
    const { data: beforeOrder } = await supabase
      .from('orders')
      .select('*, cut_orders(*), preparation_items(*)')
      .eq('id', orderId)
      .single()
    
    // Perform partial delivery
    const { markPartialDelivery } = await import('@/app/actions/orders')
    
    const itemsToDeliver = items.map(item => ({
      cutOrderId: item.cutOrderId,
      preparationItemId: item.preparationItemId,
      quantity: item.quantity
    }))
    
    await markPartialDelivery(orderId, itemsToDeliver)
    
    // Get after state
    const { data: afterOrder } = await supabase
      .from('orders')
      .select('*, cut_orders(*), preparation_items(*), delivery_history(*)')
      .eq('id', orderId)
      .single()
    
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'PARTIAL_DELIVERY',
      actor: 'admin',
      entityType: 'order',
      entityId: orderId,
      beforeState: beforeOrder,
      afterState: afterOrder,
      payload: { orderId, items },
      result: 'success',
      durationMs: duration,
      relatedEntities: {
        orders: [orderId],
        cutOrders: items.filter(i => i.cutOrderId).map(i => i.cutOrderId!)
      }
    })
    
    return true
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'PARTIAL_DELIVERY',
      actor: 'admin',
      entityType: 'order',
      entityId: orderId,
      beforeState: null,
      afterState: null,
      payload: { orderId, items },
      result: 'error',
      errorDetails: error.message,
      durationMs: duration
    })
    
    return false
  }
}
