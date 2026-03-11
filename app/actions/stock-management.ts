'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const supabase = await createClient()

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
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cut_orders')
    .update({ 
      material_base_id: productId,  // ID del producto (ej: AC25110.5,0)
      material_base_quantity: quantity  // Tamaño de la pieza (ej: 5m)
    })
    .eq('id', cutOrderId)
    .select()
    .single()

  if (error) throw error
  
  revalidatePath('/admin/stock')
  revalidatePath('/admin/pedidos')
  return data
}

/**
 * Reservar stock (total → reservado)
 * Se llama al aprobar un pedido
 * NOTA: Reserva UNA UNIDAD completa (la pieza entera)
 */
export async function reserveStock(inventoryId: string) {
  const supabase = await createClient()
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
  console.log(`   Stock reservado: ${stockBefore} → ${stockAfter}`)
  console.log(`   Stock disponible: ${current.stock_disponible} → ${current.stock_disponible - 1}`)

  // Actualizar stock reservado
  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_reservado: stockAfter })
    .eq('id', inventoryId)
    .select()
    .single()

  if (error) {
    console.error(`❌ Error reservando stock:`, error)
    throw error
  }

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

  revalidatePath('/admin/stock')
  return data
}

/**
 * Liberar stock reservado (reservado → disponible)
 * Se llama cuando se cambia de material asignado
 */
export async function unreserveStock(inventoryId: string, quantity: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener stock actual de esta pieza específica
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('id', inventoryId)
    .single()

  if (fetchError) throw fetchError

  const newReservado = Math.max(0, (current.stock_reservado || 0) - quantity)

  // Actualizar stock reservado
  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_reservado: newReservado })
    .eq('id', inventoryId)
    .select()
    .single()

  if (error) throw error

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

  revalidatePath('/admin/stock')
  return data
}

/**
 * Liberar stock reservado y moverlo a en_proceso
 * Se llama al iniciar un corte
 */
export async function releaseToInProcess(inventoryId: string, quantity: number) {
  const supabase = await createClient()
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

  revalidatePath('/admin/stock')
  return data
}

/**
 * Consumir stock (total y en_proceso)
 * Se llama al finalizar un corte
 */
export async function consumeStock(inventoryId: string, quantity: number) {
  const supabase = await createClient()
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

  revalidatePath('/admin/stock')
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
  const supabase = await createClient()
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
    
    revalidatePath('/admin/stock')
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
    
    revalidatePath('/admin/stock')
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
  const supabase = await createClient()

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
  const supabase = await createClient()

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
