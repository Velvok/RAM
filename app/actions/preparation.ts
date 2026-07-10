'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidateOrders, revalidateStock } from '@/lib/revalidate'
import { notifyChapaPreparada } from '@/lib/ram-outbound'

/**
 * Crear preparation_item para un artículo que no requiere corte
 * @param reserveStock - Si es false, crea el item sin reservar stock (para aprobación en pausa)
 */
export async function createPreparationItem(
  orderId: string,
  orderLineId: string,
  productId: string,
  quantityRequested: number,
  reserveStock: boolean = true,
  evoItemNumber?: string | null
) {
  // Usar admin client para bypass RLS
  const { createAdminClient } = await import('@/lib/supabase/server')
  const supabase = createAdminClient()

  let selectedInventory: any = null

  if (reserveStock) {
    // 1. Buscar stock exacto del producto (match por product_id)
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, product_id, stock_disponible')
      .eq('product_id', productId)
      .gt('stock_disponible', 0)
      .limit(1)
    
    if (inventoryError || !inventory || inventory.length === 0) {
      const { data: product } = await supabase
        .from('products')
        .select('name, code')
        .eq('id', productId)
        .single()
      
      throw new Error(`No hay stock disponible de ${product?.name || productId}. Sugiero aprobar el pedido en pausa.`)
    }

    selectedInventory = inventory[0]

    // 2. Verificar que hay suficiente stock
    if (selectedInventory.stock_disponible < quantityRequested) {
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .single()
      
      throw new Error(
        `Stock insuficiente de ${product?.name}. Disponible: ${selectedInventory.stock_disponible}, Solicitado: ${quantityRequested}. Sugiero aprobar el pedido en pausa.`
      )
    }
  }

  // 3. Crear preparation_item
  const { data: prepItem, error: prepError } = await supabase
    .from('preparation_items')
    .insert({
      order_id: orderId,
      order_line_id: orderLineId,
      product_id: productId,
      quantity_requested: quantityRequested,
      assigned_inventory_id: selectedInventory?.id || null,
      status: 'pendiente',
      evo_item_number: evoItemNumber || null
    })
    .select()
    .single()

  if (prepError) {
    console.error('❌ Error creando preparation_item:', prepError)
    throw prepError
  }

  // 4. Reservar stock solo si reserveStock es true
  if (reserveStock && selectedInventory) {
    const { reserveStockBatch } = await import('@/app/actions/stock-management')
    await reserveStockBatch(selectedInventory.id, quantityRequested)
  }

  return prepItem
}

/**
 * Marcar artículo como preparado (total o parcialmente)
 */
export async function prepareItem(
  itemId: string,
  quantityPrepared: number,
  operatorId?: string
) {
  // Usar admin client para bypass RLS
  const { createAdminClient } = await import('@/lib/supabase/server')
  const supabase = createAdminClient()

  console.log(`\n📦 Preparando artículo ${itemId}: ${quantityPrepared} unidades`)

  // 1. Obtener preparation_item con información del pedido
  const { data: item, error: itemError } = await supabase
    .from('preparation_items')
    .select(`
      *,
      product:products(*),
      order:orders!preparation_items_order_id_fkey(id, order_number, evo_order_id, ref_evo)
    `)
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    throw new Error('Preparation item no encontrado')
  }

  // 2. Obtener operario desde localStorage (ya no necesitamos auth)
  // El operario se pasa desde el cliente, no lo obtenemos aquí

  // 3. Validar cantidad
  const newTotal = item.quantity_prepared + quantityPrepared
  if (newTotal > item.quantity_requested) {
    throw new Error(
      `Cantidad excede lo solicitado. Preparadas: ${item.quantity_prepared}, Intentando añadir: ${quantityPrepared}, Total solicitado: ${item.quantity_requested}`
    )
  }

  // 4. Preparar datos para EVO ANTES de actualizar la BD
  console.log(`📤 Preparando evento PREP para EVO (artículo preparado)`)
  
  const orderData = Array.isArray(item.order) ? item.order[0] : item.order
  
  // Obtener nro_item desde ref_evo o evo_item_number del preparation_item
  const refEvo = orderData.ref_evo || {}
  const nroItem = item.evo_item_number || refEvo.nro_item || refEvo.item_number || 1
  
  // Construir movimiento PREP con la cantidad preparada en esta operación
  const movimientos = [{
    tipo: 'PREP' as const,
    nro_item: nroItem,
    id_articulo: item.product.code,
    cantidad: quantityPrepared,
  }]
  
  // Obtener código del operario si se proporcionó
  let operario = operatorId || 'operario' // Fallback si no se proporciona operatorId
  if (operatorId) {
    const { data: opData } = await supabase
      .from('plant_operators')
      .select('name, code')
      .eq('id', operatorId)
      .single()
    
    operario = (opData as any)?.code || opData?.name || operatorId
  }
  
  // 5. Encolar evento a EVO PRIMERO (antes de actualizar BD)
  // Si esto falla, no se actualiza el preparation_item
  try {
    await notifyChapaPreparada({
      cutOrderId: itemId, // Usamos el preparation_item_id como referencia
      orderId: orderData.id,
      idPedido: orderData.evo_order_id || orderData.order_number,
      refEvo: refEvo,
      operario,
      movimientos,
    })
    console.log(`✅ Evento PREP encolado para EVO`)
  } catch (error) {
    console.error('❌ Error encolando evento PREP a EVO:', error)
    throw new Error(`No se pudo encolar el evento a EVO: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }

  // 6. Actualizar preparation_item (si llegamos aquí, el evento se encoló correctamente)
  const isCompleted = newTotal === item.quantity_requested
  const { error: updateError } = await supabase
    .from('preparation_items')
    .update({
      quantity_prepared: newTotal,
      status: isCompleted ? 'completada' : 'en_proceso',
      started_at: item.started_at || new Date().toISOString(),
      finished_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)

  if (updateError) {
    console.error('Error actualizando preparation_item:', updateError)
    throw updateError
  }

  console.log(`✅ Artículo actualizado: ${newTotal}/${item.quantity_requested} preparadas`)

  // 6. Registrar actividad
  await supabase.from('order_activity_log').insert({
    order_id: item.order_id,
    activity_type: 'item_prepared',
    description: `Operario preparó ${quantityPrepared} unidades de ${item.product.name}`,
    metadata: {
      preparation_item_id: itemId,
      quantity: quantityPrepared,
      is_completed: isCompleted
    }
  })

  // 7. Actualizar estado del pedido
  const { updateOrderStatus } = await import('@/app/actions/orders')
  await updateOrderStatus(item.order_id)

  // 8. Revalidar
  revalidateOrders(item.order_id)

  return { success: true, isCompleted, newTotal }
}

/**
 * Asignar stock a un preparation_item (para aprobación en pausa)
 */
export async function assignStockToPreparationItem(
  itemId: string,
  inventoryId: string,
  quantityToReserve: number
) {
  const supabase = createAdminClient()

  console.log(`\n📦 === ASIGNANDO STOCK A PREPARATION_ITEM ===`)
  console.log(`   Item ID: ${itemId}`)
  console.log(`   Inventory ID: ${inventoryId}`)
  console.log(`   Quantity to Reserve: ${quantityToReserve}`)

  // 1. Verificar que el item existe
  const { data: item, error: itemError } = await supabase
    .from('preparation_items')
    .select('*, product:products(*)')
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    throw new Error('Preparation item no encontrado')
  }

  // 2. Verificar stock disponible
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('id', inventoryId)
    .single()

  if (invError || !inventory) {
    throw new Error('Inventario no encontrado')
  }

  if (inventory.stock_disponible < quantityToReserve) {
    throw new Error(
      `Stock insuficiente. Disponible: ${inventory.stock_disponible}, Solicitado: ${quantityToReserve}`
    )
  }

  // 3. Asignar inventario al item
  const { error: updateError } = await supabase
    .from('preparation_items')
    .update({
      assigned_inventory_id: inventoryId
    })
    .eq('id', itemId)

  if (updateError) {
    throw new Error(`Error asignando inventario: ${updateError.message}`)
  }

  // 4. Reservar stock (optimizado - una sola query)
  const { data: currentStock } = await supabase
    .from('inventory')
    .select('stock_reservado')
    .eq('id', inventoryId)
    .single()

  const newReservado = (currentStock?.stock_reservado || 0) + quantityToReserve

  const { error: reserveError } = await supabase
    .from('inventory')
    .update({ stock_reservado: newReservado })
    .eq('id', inventoryId)

  if (reserveError) {
    throw new Error(`Error reservando stock: ${reserveError.message}`)
  }

  // Registrar movimiento único
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('stock_movements').insert({
    product_id: inventory.product_id,
    movement_type: 'reserva',
    quantity: quantityToReserve,
    stock_before: currentStock?.stock_reservado || 0,
    stock_after: newReservado,
    user_id: user?.id,
    notes: `Reserva de ${quantityToReserve} unidades de ${inventory.product?.name || 'producto'}`,
  })

  console.log(`✅ Stock asignado y reservado: ${quantityToReserve} unidades (optimizado)`)

  // 5. Registrar actividad
  await supabase.from('order_activity_log').insert({
    order_id: item.order_id,
    activity_type: 'stock_assigned',
    description: `Stock asignado manualmente: ${inventory.product?.code} para ${item.product?.name}`,
    metadata: {
      preparation_item_id: itemId,
      inventory_id: inventoryId,
      quantity: quantityToReserve
    }
  })

  revalidateOrders(item.order_id)
  revalidateStock()

  return { success: true }
}

/**
 * Obtener preparation_items de un pedido
 */
export async function getPreparationItemsByOrder(orderId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('preparation_items')
    .select(`
      *,
      product:products(*),
      assigned_inventory:inventory(*, product:products(*)),
      assigned_operator:users(*)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}
