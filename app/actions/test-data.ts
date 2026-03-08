'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function generateTestOrder(status: string = 'ingresado', numLines: number = 1) {
  const supabase = await createClient()

  // Obtener un cliente aleatorio
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .limit(1)
    .single()

  if (!clients) {
    return { error: 'No hay clientes disponibles' }
  }

  // Obtener múltiples productos aleatorios
  const { data: products } = await supabase
    .from('products')
    .select('id, name, code')
    .limit(numLines)

  if (!products || products.length === 0) {
    return { error: 'No hay productos disponibles' }
  }

  // Generar número de pedido único
  const orderNumber = `PED-TEST-${Date.now()}`
  
  // Calcular totales del pedido
  let totalWeight = 0
  let totalAmount = 0
  const orderLines = []
  
  for (const product of products) {
    const quantity = Math.floor(Math.random() * 500) + 100 // Entre 100 y 600 kg
    const unitPrice = Math.floor(Math.random() * 2000) + 1000 // Entre 1000 y 3000
    totalWeight += quantity
    totalAmount += quantity * unitPrice
    orderLines.push({
      product_id: product.id,
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice
    })
  }

  // Crear pedido
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      client_id: clients.id,
      status: status,
      total_weight: totalWeight,
      total_amount: totalAmount,
      payment_verified: status !== 'ingresado',
      notes: `Pedido de prueba con ${numLines} línea(s)`,
    })
    .select()
    .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    return { error: orderError.message }
  }

  // Crear líneas de pedido
  const linesToInsert = orderLines.map(line => ({
    order_id: order.id,
    product_id: line.product_id,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    subtotal: line.subtotal,
  }))

  const { error: lineError } = await supabase
    .from('order_lines')
    .insert(linesToInsert)

  if (lineError) {
    console.error('Error creating order lines:', lineError)
    return { error: lineError.message }
  }

  // Si el estado es "lanzado", crear órdenes de corte
  if (status === 'lanzado') {
    const cutOrdersToInsert = orderLines.map((line, index) => ({
      cut_number: `CUT-${Date.now()}-${index}`,
      order_id: order.id,
      product_id: line.product_id,
      quantity_requested: line.quantity,
      status: 'generada',
    }))
    
    const { error: cutError } = await supabase
      .from('cut_orders')
      .insert(cutOrdersToInsert)

    if (cutError) {
      console.error('Error creating cut orders:', cutError)
    }
  }

  // Revalidar múltiples rutas
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin', 'page')
  
  return { success: true, order }
}
