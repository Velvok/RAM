'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function generateTestOrder(status: string = 'nuevo', numLines: number = 1) {
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
    // Generar UNIDADES de chapas de diferentes longitudes
    // Ejemplo: 5 chapas de 6m, 3 chapas de 8m, etc.
    const possibleLengths = [6, 8, 10, 12] // metros
    const randomLength = possibleLengths[Math.floor(Math.random() * possibleLengths.length)]
    const units = Math.floor(Math.random() * 10) + 1 // Entre 1 y 10 unidades
    const quantity = units * randomLength // Total en metros
    
    const unitPrice = Math.floor(Math.random() * 2000) + 1000 // Entre 1000 y 3000 por metro
    totalWeight += quantity
    totalAmount += quantity * unitPrice
    orderLines.push({
      product_id: product.id,
      quantity, // metros totales
      units, // cantidad de chapas
      length: randomLength, // metros por chapa
      unitPrice,
      subtotal: quantity * unitPrice
    })
  }

  // Crear pedido - SIEMPRE en estado 'nuevo'
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      client_id: clients.id,
      status: 'nuevo', // Siempre nuevo, independiente del parámetro
      total_weight: totalWeight,
      total_amount: totalAmount,
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
    quantity: line.quantity, // metros totales
    units: line.units, // cantidad de chapas
    length_meters: line.length, // metros por chapa
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

  // NO crear órdenes de corte automáticamente
  // Las órdenes de corte se crean solo cuando el admin aprueba el pedido

  // Revalidar múltiples rutas
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin', 'page')
  revalidatePath('/admin', 'layout')
  
  return { success: true, order }
}
