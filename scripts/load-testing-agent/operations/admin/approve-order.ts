/**
 * Operation: Approve Order (Admin)
 * Simula la aprobación de pedido y creación de órdenes de corte
 */

import { SimulationContext } from '../../core/orchestrator'
import { extractSizeFromCode, isChapaProduct } from '@/lib/product-utils'

export async function approveOrder(
  context: SimulationContext,
  orderId: string
): Promise<boolean> {
  const { logger, supabase } = context
  
  const startTime = Date.now()
  
  try {
    // Get current order state with lines
    const { data: beforeOrder } = await supabase
      .from('orders')
      .select('*, order_lines(*, product:products(*))')
      .eq('id', orderId)
      .single()
    
    if (!beforeOrder) throw new Error('Order not found')
    
    // Update order status to 'aprobado'
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'aprobado' })
      .eq('id', orderId)
    
    if (updateError) throw updateError
    
    // Create cut_orders for each order line (chapas)
    const cutOrderIds: string[] = []
    
    for (const line of beforeOrder.order_lines) {
      const product = line.product
      if (!product) continue
      
      // Check if it's a chapa product
      const isChapa = isChapaProduct(product.code || '', product.category, product.name)
      
      if (isChapa) {
        // Create cut order for chapa
        const units = Math.ceil(line.quantity) || 1
        const cutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        const { data: cutOrder, error: cutError } = await supabase
          .from('cut_orders')
          .insert({
            cut_number: cutNumber,
            order_id: orderId,
            order_line_id: line.id,
            product_id: line.product_id,
            quantity_requested: units,
            quantity_cut: 0,
            status: 'pendiente'
          })
          .select('id')
          .single()
        
        if (cutError) {
          console.error('Error creating cut order:', cutError.message)
          continue
        }
        
        if (cutOrder) {
          cutOrderIds.push(cutOrder.id)
        }
      }
    }
    
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
      payload: { orderId, cutOrdersCreated: cutOrderIds.length },
      result: 'success',
      durationMs: duration,
      relatedEntities: {
        orders: [orderId],
        cutOrders: cutOrderIds
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
    
    console.error('   ❌ Failed to approve order:', error.message)
    return false
  }
}
