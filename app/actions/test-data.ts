'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidateAll } from '@/lib/revalidate'

export async function generateTestOrder(status: string = 'nuevo', numLines: number = 1) {
  console.log('🎲 Generando pedido de prueba...', { status, numLines })
  const supabase = createAdminClient()

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

  // Obtener productos que tengan stock disponible (CHAPAS Y ARTÍCULOS NORMALES)
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
  // INCLUIR TANTO CHAPAS COMO ARTÍCULOS NORMALES
  const uniqueProducts = Array.from(
    new Map(
      inventoryItems
        .map(item => Array.isArray(item.product) ? item.product[0] : item.product)
        .filter(p => p != null) // Todos los productos con stock
        .map(p => [p.id, p])
    ).values()
  )

  if (uniqueProducts.length === 0) {
    return { error: 'No hay productos disponibles en stock' }
  }

  // Separar chapas y artículos normales usando isChapaProduct
  const { isChapaProduct } = await import('@/lib/product-utils')
  const chapas = uniqueProducts.filter(p => isChapaProduct(p.code || '', p.category, p.name))
  const articulos = uniqueProducts.filter(p => !isChapaProduct(p.code || '', p.category, p.name))

  console.log(`✅ Productos disponibles: ${uniqueProducts.length} (${chapas.length} chapas, ${articulos.length} artículos)`)

  // Seleccionar productos aleatorios (sin repetir)
  const selectedProducts = []
  const availableProducts = [...uniqueProducts]

  for (let i = 0; i < Math.min(numLines, availableProducts.length); i++) {
    const randomIndex = Math.floor(Math.random() * availableProducts.length)
    selectedProducts.push(availableProducts[randomIndex])
    availableProducts.splice(randomIndex, 1) // Eliminar para no repetir
  }

  // Obtener stock disponible de cada producto seleccionado
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

  const products = productsWithStock

  // Generar número de pedido único
  const orderNumber = `PED-TEST-${Date.now()}`
  
  // Calcular totales del pedido
  let totalAmount = 0
  const orderLines = []
  
  for (const product of products) {
    const isChapa = isChapaProduct(product.code || '', product.category, product.name)
    const stockDisponible = product.stock_disponible || 1

    if (isChapa) {
      // CHAPAS: Extraer longitud del nombre del producto
      const lengthMatch = product.name.match(/(\d+)m/)
      const lengthPerUnit = lengthMatch ? parseInt(lengthMatch[1]) : 6

      // Generar cantidad de unidades (no exceder stock disponible)
      const maxUnits = Math.min(Math.floor(stockDisponible), 10)
      const units = Math.floor(Math.random() * maxUnits) + 1
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
    } else {
      // ARTÍCULOS NORMALES: Solo cantidad de unidades (no exceder stock disponible)
      const maxUnits = Math.floor(stockDisponible)
      const units = Math.floor(Math.random() * maxUnits) + 1 // Entre 1 y stock disponible
      const unitPrice = Math.floor(Math.random() * 5000) + 500 // Entre 500 y 5500 por unidad
      const quantity = units // Para artículos normales, quantity = units

      totalAmount += quantity * unitPrice
      orderLines.push({
        product_id: product.id,
        quantity, // cantidad de unidades
        units, // cantidad de unidades (igual que quantity)
        length_meters: null, // No aplica para artículos normales
        unitPrice,
        subtotal: quantity * unitPrice
      })
    }
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
