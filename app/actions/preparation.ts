'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidateOrders, revalidateStock } from '@/lib/revalidate'

/**
 * Crear preparation_item para un artículo que no requiere corte
 */
export async function createPreparationItem(
  orderId: string,
  orderLineId: string,
  productId: string,
  quantityRequested: number
) {
  // Usar admin client para bypass RLS
  const { createAdminClient } = await import('@/lib/supabase/server')
  const supabase = createAdminClient()

  console.log(`\n📦 === CREANDO PREPARATION_ITEM ===`)
  console.log(`   Order ID: ${orderId}`)
  console.log(`   Order Line ID: ${orderLineId}`)
  console.log(`   Product ID: ${productId}`)
  console.log(`   Quantity Requested: ${quantityRequested}`)

  // 1. Buscar stock exacto del producto (match por product_id)
  console.log(`   → Buscando stock disponible...`)
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory')
    .select('id, product_id, stock_disponible')
    .eq('product_id', productId)
    .gt('stock_disponible', 0)
    .limit(1)
  
  console.log(`   → Resultado búsqueda:`, { inventory, inventoryError })

  if (inventoryError || !inventory || inventory.length === 0) {
    const { data: product } = await supabase
      .from('products')
      .select('name, code')
      .eq('id', productId)
      .single()
    
    throw new Error(`No hay stock disponible de ${product?.name || productId}`)
  }

  const selectedInventory = inventory[0]
  console.log(`   → Inventario seleccionado:`, selectedInventory)

  // 2. Verificar que hay suficiente stock
  console.log(`   → Verificando stock suficiente (${selectedInventory.stock_disponible} >= ${quantityRequested})...`)
  if (selectedInventory.stock_disponible < quantityRequested) {
    const { data: product } = await supabase
      .from('products')
      .select('name')
      .eq('id', productId)
      .single()
    
    throw new Error(
      `Stock insuficiente de ${product?.name}. Disponible: ${selectedInventory.stock_disponible}, Solicitado: ${quantityRequested}`
    )
  }

  // 3. Crear preparation_item
  console.log(`   → Insertando preparation_item en BD...`)
  const { data: prepItem, error: prepError } = await supabase
    .from('preparation_items')
    .insert({
      order_id: orderId,
      order_line_id: orderLineId,
      product_id: productId,
      quantity_requested: quantityRequested,
      assigned_inventory_id: selectedInventory.id,
      status: 'pendiente'
    })
    .select()
    .single()

  if (prepError) {
    console.error('❌ Error creando preparation_item:', prepError)
    throw prepError
  }
  
  console.log(`   ✅ Preparation_item insertado:`, prepItem)

  // 4. Reservar stock
  console.log(`   → Reservando stock (${quantityRequested} unidades)...`)
  const { reserveStock } = await import('@/app/actions/stock-management')
  for (let i = 0; i < quantityRequested; i++) {
    console.log(`      Reservando unidad ${i + 1}/${quantityRequested}...`)
    await reserveStock(selectedInventory.id)
  }

  console.log(`✅ === PREPARATION_ITEM COMPLETADO ===`)
  console.log(`   ID: ${prepItem.id}`)
  console.log(`   Stock reservado: ${quantityRequested} unidades\n`)

  return prepItem
}

/**
 * Marcar artículo como preparado (total o parcialmente)
 */
export async function prepareItem(
  itemId: string,
  quantityPrepared: number
) {
  // Usar admin client para bypass RLS
  const { createAdminClient } = await import('@/lib/supabase/server')
  const supabase = createAdminClient()

  console.log(`\n📦 Preparando artículo ${itemId}: ${quantityPrepared} unidades`)

  // 1. Obtener preparation_item
  const { data: item, error: itemError } = await supabase
    .from('preparation_items')
    .select('*, product:products(*)')
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

  // 4. Actualizar preparation_item
  const isCompleted = newTotal === item.quantity_requested
  const { error: updateError } = await supabase
    .from('preparation_items')
    .update({
      quantity_prepared: newTotal,
      status: isCompleted ? 'completada' : 'en_proceso',
      // assigned_to se puede dejar null o asignar desde el cliente si es necesario
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

  // 5. Registrar actividad
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

  // 6. Actualizar estado del pedido
  const { updateOrderStatus } = await import('@/app/actions/orders')
  await updateOrderStatus(item.order_id)

  // 7. Revalidar
  revalidateOrders(item.order_id)

  return { success: true, isCompleted, newTotal }
}

/**
 * Obtener preparation_items de un pedido
 */
export async function getPreparationItemsByOrder(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('preparation_items')
    .select(`
      *,
      product:products(*),
      assigned_inventory:inventory(*),
      assigned_operator:users(*)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}
