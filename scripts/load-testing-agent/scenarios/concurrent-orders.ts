/**
 * Scenario: Concurrent Orders
 * Creates multiple orders and processes them with full flow
 */

import { SimulationContext } from '../core/orchestrator'

export async function runConcurrentOrders(context: SimulationContext): Promise<void> {
  console.log('   📦 Scenario: Concurrent Orders (20 pedidos)')
  
  const { config, logger, dashboard, supabase, state } = context
  
  // Create 20 orders with various products
  const ordersToCreate = config.totalOrders
  
  console.log(`   Creating ${ordersToCreate} orders...`)
  
  // Import admin operations
  const { createOrder } = await import('../operations/admin/create-order')
  const { approveOrder } = await import('../operations/admin/approve-order')
  // partialDelivery eliminado - ahora se hace vía webhook de EVO
  
  // Create orders in batches
  const batchSize = config.concurrentOrders
  for (let i = 0; i < ordersToCreate; i += batchSize) {
    const batch = []
    for (let j = i; j < Math.min(i + batchSize, ordersToCreate); j++) {
      batch.push(createOrder(context, {
        orderNumber: `LOAD-TEST-${String(j + 1).padStart(3, '0')}`,
        productCount: Math.floor(Math.random() * 3) + 2 // 2-4 products
      }))
    }
    
    const orderIds = await Promise.all(batch)
    state.orders.push(...orderIds.filter(id => id !== null) as string[])
    
    console.log(`   Created batch ${Math.floor(i/batchSize) + 1}: ${orderIds.filter(Boolean).length} orders`)
  }
  
  console.log(`   ✅ Created ${state.orders.length} orders total`)
  
  // Process first 5 orders to completion
  const ordersToProcess = Math.min(5, state.orders.length)
  console.log(`   Processing ${ordersToProcess} orders to completion...`)
  
  for (let i = 0; i < ordersToProcess; i++) {
    const orderId = state.orders[i]
    
    // Step 1: Approve order (generates cut_orders)
    console.log(`   [Order ${i + 1}/${ordersToProcess}] Approving...`)
    await approveOrder(context, orderId)
    
    // Step 2: Complete cuts
    console.log(`   [Order ${i + 1}/${ordersToProcess}] Processing cuts...`)
    
    // Small delay for Supabase consistency
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Get cut orders for this order (fresh query)
    const { data: cutOrders, error: cutError } = await supabase
      .from('cut_orders')
      .select('*, product:products!cut_orders_product_id_fkey(*)')
      .eq('order_id', orderId)
    
    if (cutError) {
      console.error(`      Error fetching cut orders: ${cutError.message}`)
      continue
    }
    
    if (cutOrders && cutOrders.length > 0) {
      const { completeCut } = await import('../operations/operator/complete-cut')
      
      for (const cutOrder of cutOrders.slice(0, 2)) { // Process up to 2 cut orders
        // Find stock for this product
        const { data: inventoryItems } = await supabase
          .from('inventory')
          .select('*, product:products(*)')
          .eq('product_id', cutOrder.product_id)
          .gt('stock_disponible', 0)
          .limit(5)
        
        if (inventoryItems && inventoryItems.length > 0) {
          // Use first available inventory
          const inventory = inventoryItems[0]
          
          // Assign material_base to cut_order first
          await supabase
            .from('cut_orders')
            .update({
              material_base_id: inventory.product_id,
              material_base_quantity: inventory.stock_total
            })
            .eq('id', cutOrder.id)
          
          const quantityToCut = Math.min(3, cutOrder.quantity_requested)
          
          await completeCut(context, cutOrder.id, quantityToCut, {
            id: inventory.id,
            quantity: inventory.stock_total
          })

          // Step 3: Partial delivery eliminado - ahora se hace vía webhook de EVO
          // La entrega parcial ya no se simula en load testing
        }
      }
    }
    
    // Update dashboard
    dashboard.updateState({
      counts: {
        orders: { created: state.orders.length, delivered: i + 1, partial: 0, byStatus: {} },
        cutOrders: { total: cutOrders?.length || 0, byStatus: {} },
        inventory: { consumed: 0, generated: 0 }
      }
    })
  }
  
  console.log('   ✅ Concurrent orders scenario completed')
}
