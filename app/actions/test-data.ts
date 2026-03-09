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
    // El producto YA tiene la longitud en su nombre (ej: "Chapa 3mm de 12m")
    // Extraer longitud del nombre del producto
    const lengthMatch = product.name.match(/(\d+)m/)
    const lengthPerUnit = lengthMatch ? parseInt(lengthMatch[1]) : 6
    
    // Generar cantidad de unidades (entre 1 y 10)
    const units = Math.floor(Math.random() * 10) + 1
    const quantity = units * lengthPerUnit // Total en metros (para cálculos de precio)
    
    const unitPrice = Math.floor(Math.random() * 2000) + 1000 // Entre 1000 y 3000 por metro
    totalWeight += quantity
    totalAmount += quantity * unitPrice
    orderLines.push({
      product_id: product.id,
      quantity, // metros totales (solo para precio)
      units, // cantidad de chapas (LO IMPORTANTE)
      length_meters: lengthPerUnit, // metros por chapa
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
    length_meters: line.length_meters, // metros por chapa
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
