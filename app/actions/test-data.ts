'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { revalidateAll } from '@/lib/revalidate'

export async function generateTestOrder(status: string = 'nuevo', numLines: number = 1) {
  console.log('🎲 Generando pedido de prueba...', { status, numLines })
  const supabase = await createClient()

  // Obtener un cliente aleatorio
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .limit(1)

  if (clientError) {
    console.error('❌ Error obteniendo cliente:', clientError)
    return { error: 'Error obteniendo cliente: ' + clientError.message }
  }

  if (!clientData || clientData.length === 0) {
    console.error('❌ No se encontraron clientes')
    return { error: 'No se encontraron clientes' }
  }

  const clients = clientData[0]

  if (!clients) {
    console.error('❌ No hay clientes disponibles')
    return { error: 'No hay clientes disponibles' }
  }

  console.log('✅ Cliente encontrado:', clients.id)

  // Obtener productos que tengan stock disponible (SOLO CHAPAS)
  const { data: inventoryItems } = await supabase
    .from('inventory')
    .select(`
      id,
      stock_disponible,
      product:products(id, name, code, category)
    `)
    .gt('stock_disponible', 0)
    .order('stock_disponible', { ascending: false })

  if (!inventoryItems || inventoryItems.length === 0) {
    return { error: 'No hay productos con stock disponible' }
  }

  // Extraer productos únicos (puede haber varios inventory del mismo producto)
  // FILTRAR SOLO CHAPAS
  const uniqueProducts = Array.from(
    new Map(
      inventoryItems
        .map(item => Array.isArray(item.product) ? item.product[0] : item.product)
        .filter(p => p != null && p.category === 'chapas') // SOLO CHAPAS
        .map(p => [p.id, p])
    ).values()
  )

  if (uniqueProducts.length === 0) {
    return { error: 'No hay chapas disponibles en stock' }
  }

  console.log(`✅ Chapas disponibles encontradas: ${uniqueProducts.length}`)

  // Seleccionar productos aleatorios (sin repetir)
  const selectedProducts = []
  const availableProducts = [...uniqueProducts]
  
  for (let i = 0; i < Math.min(numLines, availableProducts.length); i++) {
    const randomIndex = Math.floor(Math.random() * availableProducts.length)
    selectedProducts.push(availableProducts[randomIndex])
    availableProducts.splice(randomIndex, 1) // Eliminar para no repetir
  }

  const products = selectedProducts

  // Generar número de pedido único
  const orderNumber = `PED-TEST-${Date.now()}`
  
  // Calcular totales del pedido
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
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      client_id: clients.id,
      status: 'nuevo', // Siempre nuevo, independiente del parámetro
      total_amount: totalAmount,
      notes: `Pedido de prueba con ${numLines} línea(s)`,
    })
    .select()

  if (orderError) {
    console.error('❌ Error creating order:', orderError)
    return { error: orderError.message }
  }

  if (!orderData || orderData.length === 0) {
    console.error('❌ No se devolvió ningún pedido después del insert')
    return { error: 'No se pudo crear el pedido' }
  }

  const order = orderData[0]

  console.log('✅ Pedido creado:', order.id, order.order_number)

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
    console.error('❌ Error creating order lines:', lineError)
    return { error: lineError.message }
  }

  console.log('✅ Líneas de pedido creadas:', linesToInsert.length)

  // NO crear órdenes de corte automáticamente
  // Las órdenes de corte se crean solo cuando el admin aprueba el pedido

  // Revalidar de forma ultra agresiva para que aparezca inmediatamente
  console.log('🔄 Revalidando TODAS las rutas...')
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/planta', 'layout')
  revalidatePath('/planta/pedidos', 'layout')
  
  // Revalidar tags si existen (comentado por compatibilidad con build)
  // try {
  //   revalidateTag('orders', 'invalidate')
  //   revalidateTag('pedidos', 'invalidate')
  //   revalidateTag('admin', 'invalidate')
  // } catch (e) {
  //   // Ignorar errores de tags si no existen
  // }
  
  // También revalidar todo
  revalidateAll()
  
  // Forzar revalidación de la página específica
  revalidatePath(`/admin/pedidos/${order.id}`, 'page')
  revalidatePath(`/planta/pedidos/${order.id}`, 'page')
  
  console.log('✅ Pedido de prueba generado exitosamente:', order.order_number)
  
  return { success: true, order }
}
