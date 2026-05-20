/**
 * Operation: Create Order (Admin)
 * Based on test-data.ts generateTestOrder function
 */

import { SimulationContext } from '../../core/orchestrator'

export interface CreateOrderParams {
  orderNumber: string
  productCount: number
}

export async function createOrder(
  context: SimulationContext,
  params: CreateOrderParams
): Promise<string | null> {
  const { logger, supabase } = context
  
  const startTime = Date.now()
  
  try {
    // Get random test client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .limit(5)
    
    if (clientError || !clientData || clientData.length === 0) {
      throw new Error('No test clients found')
    }
    
    const client = clientData[0]
    
    // Get products from inventory with stock
    const { data: inventoryItems, error: invError } = await supabase
      .from('inventory')
      .select(`
        id,
        stock_disponible,
        product:products(id, name, code, category)
      `)
      .gt('stock_disponible', 0)
      .limit(100)
    
    if (invError) {
      throw new Error(`Inventory query failed: ${invError.message}`)
    }
    
    if (!inventoryItems || inventoryItems.length === 0) {
      throw new Error('No products with stock available')
    }
    
    // Extract unique products
    const uniqueProducts = Array.from(
      new Map(
        inventoryItems
          .map(item => Array.isArray(item.product) ? item.product[0] : item.product)
          .filter(p => p != null)
          .map(p => [p.id, p])
      ).values()
    )
    
    if (uniqueProducts.length === 0) {
      throw new Error('No unique products available')
    }
    
    console.log(`     Found ${uniqueProducts.length} unique products`)
    
    // Select random products
    const selectedProducts = []
    const availableProducts = [...uniqueProducts]
    
    for (let i = 0; i < Math.min(params.productCount, availableProducts.length); i++) {
      const randomIndex = Math.floor(Math.random() * availableProducts.length)
      selectedProducts.push(availableProducts[randomIndex])
      availableProducts.splice(randomIndex, 1)
    }
    
    // Get stock for each product
    const productsWithStock = []
    for (const product of selectedProducts) {
      const { data: inventory } = await supabase
        .from('inventory')
        .select('stock_disponible')
        .eq('product_id', product.id)
        .gt('stock_disponible', 0)
        .limit(1)
      
      if (inventory && inventory.length > 0) {
        productsWithStock.push({
          ...product,
          stock_disponible: parseFloat(inventory[0].stock_disponible)
        })
      }
    }
    
    // Generate order number
    const orderNumber = params.orderNumber || `LOAD-TEST-${Date.now()}`
    
    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: client.id,
        status: 'nuevo'
      })
      .select()
      .single()
    
    if (orderError) throw orderError
    
    // Create order lines
    const linesToInsert = []
    let totalQuantity = 0
    
    for (const product of productsWithStock) {
      const maxQuantity = Math.floor(product.stock_disponible)
      const quantity = Math.max(1, Math.min(Math.floor(Math.random() * 5) + 1, maxQuantity))
      
      linesToInsert.push({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity
      })
      
      totalQuantity += quantity
    }
    
    if (linesToInsert.length > 0) {
      const { error: lineError } = await supabase
        .from('order_lines')
        .insert(linesToInsert)
      
      if (lineError) throw lineError
    }
    
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'CREATE_ORDER',
      actor: 'admin',
      entityType: 'order',
      entityId: order.id,
      beforeState: null,
      afterState: { id: order.id, order_number: orderNumber, status: 'nuevo', lines: linesToInsert.length },
      payload: { orderNumber, productCount: params.productCount, clientId: client.id },
      result: 'success',
      durationMs: duration,
      relatedEntities: {
        orders: [order.id]
      }
    })
    
    return order.id
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    logger.logTransaction({
      operation: 'CREATE_ORDER',
      actor: 'admin',
      entityType: 'order',
      entityId: 'failed',
      beforeState: null,
      afterState: null,
      payload: { orderNumber: params.orderNumber, productCount: params.productCount },
      result: 'error',
      errorDetails: error.message,
      durationMs: duration
    })
    
    console.error('   ❌ Failed to create order:', error.message)
    return null
  }
}
