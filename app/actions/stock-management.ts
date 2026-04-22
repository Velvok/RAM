'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Registrar actividad en el log de pedidos
 */
async function logOrderActivity(
  orderId: string,
  activityType: string,
  description: string,
  metadata?: any,
  cutOrderId?: string
) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.log('📝 Logging activity:', { orderId, activityType, description })

  const { data, error } = await supabase.from('order_activity_log').insert({
    order_id: orderId,
    cut_order_id: cutOrderId,
    activity_type: activityType,
    description,
    metadata,
    user_id: user?.id,
  })

  if (error) {
    console.error('❌ Error logging activity:', error)
    throw error
  }

  console.log('✅ Activity logged successfully')
  
  // Revalidar la página del pedido
  revalidatePath(`/admin/pedidos/${orderId}`)
}

/**
 * Extraer código base del producto (sin el tamaño)
 * Ejemplo: AC25110.0,5 → AC25110
 * Ejemplo: AC25110.9,5 → AC25110
 */
function extractBaseCode(code: string): string {
  // Buscar el último punto seguido de números
  // AC25110.0,5 → AC25110
  const match = code.match(/^([A-Z0-9]+)\./i)
  return match ? match[1] : code
}

/**
 * Extraer tamaño del código del producto
 * Ejemplo: AC25110.0,5 → 0.5
 * Ejemplo: AC25110.5,0 → 5.0
 * Ejemplo: AC25110.12,0 → 12.0
 */
function extractSizeFromCode(code: string): number {
  // Buscar el patrón después del punto: número,número
  const match = code.match(/\.(\d+),(\d+)$/)
  if (match) {
    // Convertir "5,0" a 5.0
    return parseFloat(`${match[1]}.${match[2]}`)
  }
  return 0
}

/**
 * Buscar la mejor pieza de stock disponible para una orden de corte
 * Lógica: 
 * 1. Busca por código base del producto (ej: AC25110)
 * 2. Si hay pieza exacta del tamaño → usar esa
 * 3. Si no → usar la más pequeña que sea mayor
 * 
 * NOTA: Cada registro en inventory representa UNA pieza física
 * stock_total es el tamaño de esa pieza (ej: 0.5m, 5m, 9.5m)
 * stock_disponible indica si está disponible (total - reservado)
 */
export async function findBestStockMatch(
  productId: string,
  quantityNeeded: number
) {
  const supabase = createAdminClient()

  // Primero obtener el producto solicitado para extraer su código base
  const { data: requestedProduct } = await supabase
    .from('products')
    .select('code, name')
    .eq('id', productId)
    .single()

  if (!requestedProduct) {
    return null
  }

  // Extraer código base (ej: AC25110.0,5 → AC25110)
  const baseCode = extractBaseCode(requestedProduct.code)
  console.log(`🔍 Buscando stock para código base: ${baseCode}, tamaño: ${quantityNeeded}m`)

  // Obtener todas las piezas disponibles del mismo tipo de producto
  // Buscamos por código que empiece con el código base
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, code, name')
    .ilike('code', `${baseCode}.%`)

  if (!allProducts || allProducts.length === 0) {
    console.log(`⚠️ No se encontraron productos con código base ${baseCode}`)
    return null
  }

  const productIds = allProducts.map(p => p.id)

  // Buscar stock disponible de cualquiera de estos productos
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .in('product_id', productIds)
    .gt('stock_disponible', 0)
    .order('stock_total', { ascending: true })

  if (error) throw error

  if (!inventory || inventory.length === 0) {
    console.log(`⚠️ No hay stock disponible para ${baseCode}`)
    return null // No hay stock disponible
  }

  // Agregar el tamaño extraído del código a cada item
  const inventoryWithSize = inventory.map(item => ({
    ...item,
    size: extractSizeFromCode(item.product?.code || '')
  }))

  console.log(`📦 Stock disponible encontrado:`, inventoryWithSize.map(i => `${i.product?.code} (${i.size}m, ${i.stock_total} unidades)`))

  // Buscar pieza exacta del tamaño solicitado
  const exactMatch = inventoryWithSize.find(
    (item) => item.size === quantityNeeded && item.stock_disponible > 0
  )
  if (exactMatch) {
    console.log(`✅ Match exacto: ${exactMatch.product?.code} (${exactMatch.size}m)`)
    return {
      inventory_id: exactMatch.id,
      product_id: exactMatch.product_id,
      product_code: exactMatch.product?.code,
      product_name: exactMatch.product?.name,
      quantity: exactMatch.size,
      isExact: true,
    }
  }

  // Buscar la más pequeña que sea mayor
  const nextBigger = inventoryWithSize
    .filter(item => item.size > quantityNeeded && item.stock_disponible > 0)
    .sort((a, b) => a.size - b.size)[0]
    
  if (nextBigger) {
    console.log(`✅ Match aproximado: ${nextBigger.product?.code} (${nextBigger.size}m para ${quantityNeeded}m)`)
    return {
      inventory_id: nextBigger.id,
      product_id: nextBigger.product_id,
      product_code: nextBigger.product?.code,
      product_name: nextBigger.product?.name,
      quantity: nextBigger.size,
      isExact: false,
    }
  }

  console.log(`⚠️ No hay piezas suficientemente grandes para ${quantityNeeded}m`)
  // No hay ninguna pieza suficientemente grande
  return null
}

/**
 * Asignar stock a una orden de corte
 * Guarda el product_id de la pieza asignada en cut_orders.material_base_id
 * Y la cantidad de esa pieza en material_base_quantity
 */
export async function assignStockToCutOrder(
  cutOrderId: string,
  inventoryId: string,
  productId: string,
  quantity: number
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .update({ 
      material_base_id: productId,  // ID del producto (ej: AC25110.5,0)
      material_base_quantity: quantity  // Tamaño de la pieza (ej: 5m)
    })
    .eq('id', cutOrderId)
    .select('*, order:orders!cut_orders_order_id_fkey(id, status)')
    .single()

  if (error) throw error
  
  // Si el pedido está en pausa, verificar si todas las órdenes tienen stock asignado
  if (data.order?.status === 'aprobado_en_pausa') {
    await checkAndActivateOrderOnHold(data.order.id)
  }
  
  // Revalidar todas las rutas relevantes de forma agresiva
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath('/planta', 'layout')
  
  // También revalidar las páginas específicas
  revalidatePath('/admin')
  revalidatePath('/admin/stock')
  revalidatePath('/admin/pedidos')
  
  return data
}

/**
 * Verificar si todas las órdenes de corte tienen stock asignado
 * Si es así, cambiar el estado del pedido de 'aprobado_en_pausa' a 'aprobado'
 */
async function checkAndActivateOrderOnHold(orderId: string) {
  const supabase = createAdminClient()
  
  console.log(`🔍 Verificando si pedido ${orderId} puede activarse...`)
  
  // Obtener todas las órdenes de corte del pedido
  const { data: cutOrders, error } = await supabase
    .from('cut_orders')
    .select('id, material_base_id')
    .eq('order_id', orderId)
  
  if (error) {
    console.error('❌ Error checking cut orders:', error)
    return
  }
  
  console.log(`📋 Órdenes de corte encontradas: ${cutOrders?.length || 0}`)
  console.log(`📊 Órdenes con stock:`, cutOrders?.filter(co => co.material_base_id !== null).length)
  
  // Verificar si TODAS tienen stock asignado (material_base_id no es null)
  const allHaveStock = cutOrders?.every(co => co.material_base_id !== null)
  
  if (allHaveStock && cutOrders && cutOrders.length > 0) {
    console.log(`✅ Todas las órdenes tienen stock asignado. Activando pedido...`)
    
    // Cambiar estado del pedido a 'aprobado'
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'aprobado' })
      .eq('id', orderId)
    
    if (updateError) {
      console.error('❌ Error activating order:', updateError)
    } else {
      console.log(`✅ Pedido ${orderId} activado correctamente`)
      
      // Revalidar rutas de forma agresiva
      revalidatePath('/admin', 'layout')
      revalidatePath('/admin/pedidos', 'layout')
      revalidatePath('/planta', 'layout')
      revalidatePath(`/admin/pedidos/${orderId}`)
      
      const { revalidateOrders } = await import('@/lib/revalidate')
      revalidateOrders(orderId)
    }
  } else {
    console.log(`⏸️ Pedido aún en pausa: faltan ${cutOrders?.filter(co => co.material_base_id === null).length} órdenes por asignar stock`)
  }
}

/**
 * Reservar stock (total → reservado)
 * Se llama al aprobar un pedido
 * NOTA: Reserva UNA UNIDAD completa (la pieza entera)
 */
export async function reserveStock(inventoryId: string) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener stock actual de esta pieza específica
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('id', inventoryId)
    .single()

  if (fetchError) throw fetchError

  const stockBefore = current.stock_reservado || 0
  const stockAfter = stockBefore + 1 // Reservamos 1 unidad (la pieza completa)

  console.log(`🔒 Reservando stock:`)
  console.log(`   Producto: ${current.product?.code}`)
  console.log(`   Stock total: ${current.stock_total} (sin cambios)`)
  console.log(`   Stock reservado: ${stockBefore} → ${stockAfter}`)
  console.log(`   Stock disponible: ${current.stock_disponible} → ${current.stock_disponible - 1}`)

  // Usar RPC para reservar (NO disminuye stock_total)
  const { error } = await supabase.rpc('reserve_stock', {
    p_inventory_id: inventoryId
  })

  if (error) {
    console.error(`❌ Error reservando stock:`, error)
    throw error
  }

  // Obtener datos actualizados
  const { data } = await supabase
    .from('inventory')
    .select()
    .eq('id', inventoryId)
    .single()

  console.log(`✅ Stock reservado correctamente`)

  // Registrar movimiento
  await supabase.from('stock_movements').insert({
    product_id: current.product_id,
    movement_type: 'reserva',
    quantity: 1,
    stock_before: stockBefore,
    stock_after: stockAfter,
    user_id: user?.id,
    notes: `Reserva de ${current.product?.name || 'pieza'} (${current.stock_total}m)`,
  })

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/admin/pedidos', 'page')
  return data
}

/**
 * Liberar stock reservado (reservado → disponible)
 * Se llama cuando se cambia de material asignado
 */
export async function unreserveStock(inventoryId: string, quantity: number) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener stock actual de esta pieza específica
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('id', inventoryId)
    .single()

  if (fetchError) throw fetchError

  const newReservado = Math.max(0, (current.stock_reservado || 0) - quantity)

  // Usar RPC para liberar reserva (NO aumenta stock_total)
  const { error } = await supabase.rpc('unreserve_stock', {
    p_inventory_id: inventoryId,
    p_quantity: quantity
  })

  if (error) throw error

  // Obtener datos actualizados
  const { data } = await supabase
    .from('inventory')
    .select()
    .eq('id', inventoryId)
    .single()

  // Registrar movimiento
  await supabase.from('stock_movements').insert({
    product_id: current.product_id,
    movement_type: 'liberacion',
    quantity: -quantity,
    stock_before: current.stock_reservado,
    stock_after: newReservado,
    user_id: user?.id,
    notes: `Reserva liberada de ${current.product?.name || 'pieza'}`,
  })

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/admin/pedidos', 'page')
  return data
}

/**
 * Liberar stock reservado y moverlo a en_proceso
 * Se llama al iniciar un corte
 */
export async function releaseToInProcess(inventoryId: string, quantity: number) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener stock actual de esta pieza específica
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('id', inventoryId)
    .single()

  if (fetchError) throw fetchError

  const newReservado = (current.stock_reservado || 0) - quantity
  const newEnProceso = (current.stock_en_proceso || 0) + quantity

  // Actualizar ambos campos
  const { data, error } = await supabase
    .from('inventory')
    .update({
      stock_reservado: newReservado,
      stock_en_proceso: newEnProceso,
    })
    .eq('id', inventoryId)
    .select()
    .single()

  if (error) throw error

  // Registrar movimiento
  await supabase.from('stock_movements').insert({
    product_id: current.product_id,
    movement_type: 'proceso',
    quantity: quantity,
    stock_before: current.stock_reservado,
    stock_after: newReservado,
    user_id: user?.id,
    notes: `Stock movido a en proceso (${current.product?.name})`,
  })

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/admin/pedidos', 'page')
  return data
}

/**
 * Consumir stock (total y en_proceso)
 * Se llama al finalizar un corte
 */
export async function consumeStock(inventoryId: string, quantity: number) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener stock actual de esta pieza específica
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('id', inventoryId)
    .single()

  if (fetchError) throw fetchError

  const newTotal = (current.stock_total || 0) - quantity
  const newEnProceso = (current.stock_en_proceso || 0) - quantity
  
  // IMPORTANTE: Consumir primero del stock generado (FIFO)
  // Si hay stock_generado, disminuirlo hasta que llegue a 0
  const currentGenerado = current.stock_generado || 0
  const quantityFromGenerated = Math.min(quantity, currentGenerado)
  const newGenerado = currentGenerado - quantityFromGenerated

  console.log(`📊 Consumo de stock:`)
  console.log(`   Stock total: ${current.stock_total} → ${newTotal}`)
  console.log(`   Stock generado: ${currentGenerado} → ${newGenerado}`)
  console.log(`   Consumido de generado: ${quantityFromGenerated}`)

  // Actualizar todos los campos
  const { data, error } = await supabase
    .from('inventory')
    .update({
      stock_total: newTotal,
      stock_en_proceso: newEnProceso,
      stock_generado: newGenerado,
    })
    .eq('id', inventoryId)
    .select()
    .single()

  if (error) throw error

  // Registrar movimiento
  const notes = quantityFromGenerated > 0
    ? `Consumo de stock generado (${quantityFromGenerated} de ${quantity}) - ${current.product?.name}`
    : `Consumo de stock virgen (${current.product?.name})`
    
  await supabase.from('stock_movements').insert({
    product_id: current.product_id,
    movement_type: 'consumo',
    quantity: -quantity,
    stock_before: current.stock_total,
    stock_after: newTotal,
    user_id: user?.id,
    notes,
  })

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/admin/pedidos', 'page')
  return data
}

/**
 * Generar stock de recorte
 * Busca el producto del tamaño del recorte y aumenta stock_total y stock_generado
 * Si no existe el producto, lanza error
 */
export async function generateRemnantStock(
  baseProductCode: string,
  remnantSize: number
) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Extraer código base (ej: AC25110.5,0 → AC25110)
  const baseCode = baseProductCode.match(/^([A-Z0-9]+)\./i)?.[1]
  
  if (!baseCode) {
    throw new Error(`Código de producto inválido: ${baseProductCode}`)
  }

  // Formatear el tamaño del recorte (ej: 4.5 → 4,5 o 4.0 → 4,0)
  // Asegurar que siempre tenga un decimal
  const sizeStr = remnantSize.toFixed(1) // 4.5 → "4.5" o 4 → "4.0"
  const sizeFormatted = sizeStr.replace('.', ',') // "4.5" → "4,5" o "4.0" → "4,0"
  const remnantProductCode = `${baseCode}.${sizeFormatted}`

  console.log(`🔍 Buscando producto para recorte: ${remnantProductCode} (${remnantSize}m)`)

  // Buscar el producto del tamaño del recorte
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, code, name')
    .eq('code', remnantProductCode)
    .single()

  if (productError || !product) {
    throw new Error(
      `❌ No existe el producto ${remnantProductCode} para el recorte de ${remnantSize}m. ` +
      `Debe crear el producto primero en el catálogo.`
    )
  }

  console.log(`✅ Producto encontrado: ${product.name}`)

  // Buscar o crear el registro de inventory para este producto
  const { data: existingInventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', product.id)
    .single()

  if (existingInventory) {
    // Actualizar inventory existente
    const newTotal = (existingInventory.stock_total || 0) + 1
    const newGenerado = (existingInventory.stock_generado || 0) + 1

    const { data, error } = await supabase
      .from('inventory')
      .update({
        stock_total: newTotal,
        stock_generado: newGenerado,
      })
      .eq('id', existingInventory.id)
      .select()
      .single()

    if (error) throw error

    // Registrar movimiento
    await supabase.from('stock_movements').insert({
      product_id: product.id,
      movement_type: 'generacion',
      quantity: 1,
      stock_before: existingInventory.stock_total,
      stock_after: newTotal,
      user_id: user?.id,
      notes: `Recorte generado de ${remnantSize}m`,
    })

    console.log(`✅ Stock generado: ${product.code} +1 unidad (total: ${newTotal})`)
    
    // Revalidar todas las rutas relevantes
    revalidatePath('/admin', 'page')
    revalidatePath('/admin/stock', 'page')
    revalidatePath('/admin/stock', 'layout')
    revalidatePath('/admin/pedidos', 'page')
    revalidatePath('/admin/recortes', 'page')
    return data
  } else {
    // Crear nuevo registro de inventory
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        product_id: product.id,
        stock_total: 1,
        stock_generado: 1,
        stock_reservado: 0,
        stock_en_proceso: 0,
      })
      .select()
      .single()

    if (error) throw error

    // Registrar movimiento
    await supabase.from('stock_movements').insert({
      product_id: product.id,
      movement_type: 'generacion',
      quantity: 1,
      stock_before: 0,
      stock_after: 1,
      user_id: user?.id,
      notes: `Primer recorte generado de ${remnantSize}m`,
    })

    console.log(`✅ Inventory creado: ${product.code} con 1 unidad generada`)
    
    // Revalidar todas las rutas relevantes
    revalidatePath('/admin', 'page')
    revalidatePath('/admin/stock', 'page')
    revalidatePath('/admin/stock', 'layout')
    revalidatePath('/admin/pedidos', 'page')
    revalidatePath('/admin/recortes', 'page')
    return data
  }
}

/**
 * Obtener opciones de stock disponible para selección manual
 * Retorna solo piezas del mismo producto, ordenadas por tamaño
 */
export async function getAvailableStockOptions(
  productId: string,
  minQuantity: number
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('product_id', productId)
    .gte('stock_disponible', 1)
    .gte('stock_total', minQuantity)
    .order('stock_total', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Obtener información del stock asignado a una orden de corte
 */
export async function getAssignedStock(cutOrderId: string) {
  const supabase = createAdminClient()

  const { data: cutOrder, error } = await supabase
    .from('cut_orders')
    .select(`
      *,
      assigned_stock:inventory!cut_orders_material_base_id_fkey(
        id,
        stock_total,
        product:products(*)
      )
    `)
    .eq('id', cutOrderId)
    .single()

  if (error) throw error
  return cutOrder
}

/**
 * Reasignar stock de una orden completada/parcial a una orden pendiente
 * NUEVO: Adaptado al modelo agrupado - reasigna N unidades de una orden
 * Permite stock negativo si no hay disponibilidad
 */
export async function reassignStock(fromCutOrderId: string, toCutOrderId: string, quantityToReassign: number = 1) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.log(`🔄 Iniciando reasignación: ${fromCutOrderId} → ${toCutOrderId}`)

  // 1. Obtener información de ambas órdenes
  const { data: fromOrder, error: fromError } = await supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders!cut_orders_order_id_fkey(id, order_number),
      product:products!cut_orders_product_id_fkey(id, code, name),
      material_base:products!cut_orders_material_base_id_fkey(id, code, name)
    `)
    .eq('id', fromCutOrderId)
    .single()

  if (fromError) throw fromError
  if (!fromOrder.material_base_id) {
    throw new Error('La orden origen no tiene stock asignado')
  }
  
  // NUEVO: Verificar que tenga suficientes unidades cortadas para reasignar
  if ((fromOrder.quantity_cut || 0) === 0) {
    throw new Error('La orden origen no tiene unidades cortadas para reasignar')
  }
  
  if ((fromOrder.quantity_cut || 0) < quantityToReassign) {
    throw new Error(`La orden origen solo tiene ${fromOrder.quantity_cut} unidades cortadas, no se pueden reasignar ${quantityToReassign}`)
  }

  // Obtener el inventory que tiene este producto asignado
  const { data: assignedInventory, error: invError } = await supabase
    .from('inventory')
    .select('id, product_id, product:products(code, name)')
    .eq('product_id', fromOrder.material_base_id)
    .single()

  if (invError) throw invError

  const { data: toOrder, error: toError } = await supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders!cut_orders_order_id_fkey(id, order_number),
      product:products!cut_orders_product_id_fkey(id, code, name)
    `)
    .eq('id', toCutOrderId)
    .single()

  if (toError) throw toError
  if (toOrder.status === 'completada') {
    throw new Error('No se puede reasignar a una orden ya completada')
  }

  const inventoryId = assignedInventory.id
  const productId = assignedInventory.product_id

  // Extraer datos de las órdenes
  const fromOrderData = Array.isArray(fromOrder.order) ? fromOrder.order[0] : fromOrder.order
  const toOrderData = Array.isArray(toOrder.order) ? toOrder.order[0] : toOrder.order

  // 2. NUEVO: Decrementar quantity_cut de la orden origen (reasignamos N unidades)
  const newQuantityCut = (fromOrder.quantity_cut || 0) - quantityToReassign
  const isNowPending = newQuantityCut < fromOrder.quantity_requested
  
  console.log(`📊 Orden origen: ${fromOrder.quantity_cut}/${fromOrder.quantity_requested} → ${newQuantityCut}/${fromOrder.quantity_requested} (reasignando ${quantityToReassign})`)
  
  const { error: updateFromError } = await supabase
    .from('cut_orders')
    .update({
      quantity_cut: newQuantityCut,
      // Si ya no está completada, vuelve a pendiente
      status: newQuantityCut >= fromOrder.quantity_requested ? 'completada' : 'pendiente',
      // Si vuelve a pendiente, quitar finished_at
      finished_at: newQuantityCut >= fromOrder.quantity_requested ? fromOrder.finished_at : null
    })
    .eq('id', fromCutOrderId)

  if (updateFromError) throw updateFromError
  
  console.log(`✅ Orden origen actualizada: estado = ${newQuantityCut >= fromOrder.quantity_requested ? 'completada' : 'pendiente'}`)

  // 3. Asignar a la orden destino (el stock sigue reservado, solo cambia de orden)
  console.log(`📥 Asignando a orden destino...`)
  const assignedProduct = Array.isArray(assignedInventory.product) 
    ? assignedInventory.product[0] 
    : assignedInventory.product
  const assignedSize = extractSizeFromCode(assignedProduct.code)
  await assignStockToCutOrder(toCutOrderId, inventoryId, productId, assignedSize)

  // 4. NUEVO: Marcar orden destino como PENDIENTE DE CONFIRMACIÓN
  // NO incrementar quantity_cut aquí - eso se hace cuando el operario confirme el corte
  console.log(`� Orden destino preparada para corte: ${toOrder.quantity_cut || 0}/${toOrder.quantity_requested} (pendiente confirmación)`)
  
  const { error: completeError } = await supabase
    .from('cut_orders')
    .update({
      status: 'pendiente_confirmacion',
      reassigned_from_order_id: fromOrderData.id,
      reassigned_from_cut_order_id: fromCutOrderId,
      reassigned_quantity: quantityToReassign,
    })
    .eq('id', toCutOrderId)

  if (completeError) throw completeError

  // 5. NUEVO: La orden origen mantiene su asignación (solo decrementamos quantity_cut)
  // El stock sigue reservado para las unidades restantes
  // Solo movemos la reserva de 1 unidad al pedido destino
  console.log(`📌 Orden origen mantiene su stock asignado para las ${fromOrder.quantity_requested - newQuantityCut} unidades restantes`)

  // 8. Actualizar estados de ambos pedidos
  // (fromOrderData y toOrderData ya declarados arriba)
  
  // Actualizar estado del pedido origen
  const { data: fromOrderOrders } = await supabase
    .from('cut_orders')
    .select('status')
    .eq('order_id', fromOrderData.id)

  const fromAllCompleted = fromOrderOrders?.every(o => o.status === 'completada')
  const fromAnyInProgress = fromOrderOrders?.some(o => o.status === 'en_proceso')
  const fromAnyCompleted = fromOrderOrders?.some(o => o.status === 'completada')

  let fromNewStatus = fromOrderData.status
  if (fromAllCompleted) {
    fromNewStatus = 'finalizado'
  } else if (fromAnyInProgress || fromAnyCompleted) {
    // Si hay alguna en proceso O completada, está en corte
    fromNewStatus = 'en_corte'
  } else {
    fromNewStatus = 'aprobado'
  }

  await supabase
    .from('orders')
    .update({ status: fromNewStatus })
    .eq('id', fromOrderData.id)

  // Actualizar estado del pedido destino
  const { data: toOrderOrders } = await supabase
    .from('cut_orders')
    .select('status')
    .eq('order_id', toOrderData.id)

  const toAllCompleted = toOrderOrders?.every(o => o.status === 'completada')
  const toAnyInProgress = toOrderOrders?.some(o => o.status === 'en_proceso')
  const toAnyCompleted = toOrderOrders?.some(o => o.status === 'completada')

  let toNewStatus = toOrderData.status
  if (toAllCompleted) {
    toNewStatus = 'finalizado'
  } else if (toAnyInProgress || toAnyCompleted) {
    // Si hay alguna en proceso O completada, está en corte
    toNewStatus = 'en_corte'
  } else {
    toNewStatus = 'aprobado'
  }

  await supabase
    .from('orders')
    .update({ status: toNewStatus })
    .eq('id', toOrderData.id)

  // 9. Registrar en el log de actividades de AMBOS pedidos
  
  // Log en pedido ORIGEN (de donde sale la chapa)
  await logOrderActivity(
    fromOrderData.id,
    'reassign_out',
    `Chapa cortada ${assignedProduct.code} reasignada desde orden ${fromOrder.cut_number} hacia pedido ${toOrderData.order_number} (orden ${toOrder.cut_number})`,
    {
      from_cut_order_id: fromCutOrderId,
      to_cut_order_id: toCutOrderId,
      from_order_number: fromOrderData.order_number,
      to_order_number: toOrderData.order_number,
      inventory_id: inventoryId,
      product_code: assignedProduct.code,
      action: 'Chapa cortada transferida a otro pedido'
    },
    fromCutOrderId
  )

  // Log en pedido DESTINO (a donde llega la chapa)
  await logOrderActivity(
    toOrderData.id,
    'reassign_in',
    `Chapa cortada ${assignedProduct.code} recibida desde pedido ${fromOrderData.order_number} (orden ${fromOrder.cut_number}). Pendiente de confirmación por operario.`,
    {
      from_cut_order_id: fromCutOrderId,
      to_cut_order_id: toCutOrderId,
      from_order_number: fromOrderData.order_number,
      to_order_number: toOrderData.order_number,
      inventory_id: inventoryId,
      product_code: assignedProduct.code,
      action: 'Chapa cortada recibida de otro pedido - pendiente de confirmación'
    },
    toCutOrderId
  )

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${fromOrderData.id}`, 'page')
  revalidatePath(`/admin/pedidos/${toOrderData.id}`, 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/planta/ordenes', 'page')

  console.log(`✅ Reasignación completada`)

  return {
    success: true,
    fromOrder: fromOrderData.order_number,
    toOrder: toOrderData.order_number,
    productCode: assignedProduct.code,
  }
}

/**
 * Obtener órdenes de corte completadas disponibles para reasignación
 * Filtra por tamaño del producto
 */
export async function getCompletedOrdersForReassignment(productSize: number) {
  const supabase = createAdminClient()

  // Obtener todas las órdenes completadas con stock asignado
  const { data, error } = await supabase
    .from('cut_orders')
    .select(`
      *,
      order:orders(id, order_number, customer_name),
      product:products!cut_orders_product_id_fkey(id, code, name),
      assigned_inventory:inventory!cut_orders_material_base_id_fkey(
        id,
        product:products(code, name)
      )
    `)
    .eq('status', 'completada')
    .not('material_base_id', 'is', null)

  if (error) throw error

  // Filtrar por tamaño
  const filtered = data?.filter(order => {
    const size = extractSizeFromCode(order.product.code)
    return size === productSize
  })

  return filtered || []
}
