'use server'

import { revalidatePath } from 'next/cache'
import { unstable_noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidateOrders, revalidateStock, revalidateOrderStatus } from '@/lib/revalidate'
import { notifyPedidoCompletado } from '@/lib/ram-outbound'
import { extractSizeFromCode } from '@/lib/product-utils'

export async function getOrders() {
  // Deshabilitar caché del servidor para obtener siempre datos frescos
  unstable_noStore()
  
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(*),
      lines:order_lines(*, product:products(*))
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getOrderById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(*),
      lines:order_lines(*, product:products(*)),
      cut_orders:cut_orders!cut_orders_order_id_fkey(
        *,
        product:products!cut_orders_product_id_fkey(*),
        material_base:products!cut_orders_material_base_id_fkey(*),
        assigned_operator:users!cut_orders_assigned_to_fkey(*)
      ),
      preparation_items(
        *,
        product:products(*),
        assigned_inventory:inventory(*, product:products(*)),
        assigned_operator:users(*)
      )
    `)
    .eq('id', id)
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return null
  
  return data[0]
}

export async function cancelOrder(orderId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelado' })
    .eq('id', orderId)
    .select()

  if (error) throw error

  await supabase
    .from('stock_reservations')
    .update({ is_active: false, released_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('is_active', true)

  // Cancelar cut_orders pendientes (nuevo modelo simplificado)
  await supabase
    .from('cut_orders')
    .update({ status: 'completada' }) // Marcamos como completada aunque sea cancelación
    .eq('order_id', orderId)
    .eq('status', 'pendiente')

  // Revalidar rutas de pedidos y stock
  revalidateOrders(orderId)
  revalidateStock()
  return data
}

// verifyPayment eliminada - Los pedidos ya vienen con pago verificado

// Aprobar pedido EN PAUSA (sin asignar stock automáticamente)
export async function approveOrderOnHold(orderId: string) {
  const supabase = createAdminClient()

  // Obtener usuario actual (admin)
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener el pedido con sus líneas
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*, order_lines(*, product:products(*))')
    .eq('id', orderId)
    .limit(1)

  if (orderError) throw orderError
  if (!orderData || orderData.length === 0) {
    throw new Error('Pedido no encontrado')
  }
  const order = orderData[0]

  // Verificar que el pedido esté en estado 'nuevo'
  if (order.status !== 'nuevo') {
    throw new Error('Solo se pueden aprobar pedidos en estado "nuevo"')
  }

  const errors: string[] = []

  // Crear órdenes de corte para CHAPAS y preparation_items para ARTÍCULOS NORMALES (SIN asignar stock)
  for (const line of order.order_lines) {
    // Cantidad de unidades que pide el cliente
    const units = line.units || Math.ceil(line.quantity) || 1

    // Identificar si es chapa usando la tabla de productos de corte (isChapaProduct)
    const { isChapaProduct } = await import('@/lib/product-utils')
    const isChapa = isChapaProduct(
      line.product?.code || '',
      line.product?.category,
      line.product?.name
    )

    console.log(`\n🔍 Procesando línea (EN PAUSA):`, {
      product_name: line.product?.name,
      product_code: line.product?.code,
      product_category: line.product?.category,
      isChapa,
      units
    })
    
    if (isChapa) {
      // ========== CHAPAS: Crear orden de corte SIN asignar stock ==========
      console.log(`📋 Línea (CHAPA - EN PAUSA): ${line.product?.name}, Unidades: ${units}`)
      
      // Tamaño de cada pieza (extraído del código del producto)
      const productSize = extractSizeFromCode(line.product?.code || '') ||
                         line.product?.length_meters ||
                         line.length_meters ||
                         line.quantity
      
      // Crear UNA orden de corte agrupada para todas las unidades
      const cutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Crear la orden de corte AGRUPADA (SIN STOCK ASIGNADO)
      const { data: cutOrderData, error: cutError } = await supabase
        .from('cut_orders')
        .insert({
          cut_number: cutNumber,
          order_id: orderId,
          order_line_id: line.id,
          product_id: line.product_id,
          quantity_requested: units,
          quantity_cut: 0,
          status: 'pendiente',
          evo_item_number: line.evo_item_number || null,
          // NO asignamos material_base_id ni material_base_quantity
        })
        .select()
      
      if (cutError) {
        console.error('Error creando orden de corte:', cutError)
        errors.push(`Error creando orden de corte: ${cutError.message}`)
        continue
      }

      console.log(`✅ Orden de corte creada EN PAUSA: ${cutNumber} - ${units} unidades de ${productSize}m (sin stock asignado)`)
      
    } else {
      // ========== ARTÍCULOS NORMALES: Crear preparation_item SIN reservar stock ==========
      console.log(`📦 Línea (ARTÍCULO NORMAL - EN PAUSA): ${line.product?.name}, Unidades: ${units}`)
      console.log(`   → Código: ${line.product?.code}`)
      console.log(`   → Product ID: ${line.product_id}`)
      console.log(`   → Order Line ID: ${line.id}`)
      
      try {
        const { createPreparationItem } = await import('./preparation')
        console.log(`   → Llamando a createPreparationItem...`)
        const result = await createPreparationItem(orderId, line.id, line.product_id, units, false) // false = no reservar stock
        console.log(`✅ Preparation item creado (sin stock reservado):`, result)
      } catch (prepError: any) {
        console.error('❌ Error creando preparation_item:', prepError)
        console.error('   Stack:', prepError.stack)
        errors.push(`Error creando preparation_item para ${line.product?.name}: ${prepError.message}`)
      }
    }
    
    // Pequeño delay para evitar duplicados en el timestamp
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  // Actualizar estado del pedido a "aprobado_en_pausa"
  await supabase
    .from('orders')
    .update({ 
      status: 'aprobado_en_pausa',
      approved_at: new Date().toISOString(),
      approved_by: user?.id || null
    })
    .eq('id', orderId)

  // Revalidar rutas de pedidos y stock
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`)
  revalidateOrders(orderId)
  
  return { 
    success: true,
    message: 'Pedido aprobado en pausa. El stock deberá asignarse manualmente.'
  }
}

// Aprobar pedido y generar órdenes de corte CON asignación automática de stock
export async function approveOrder(orderId: string) {
  const supabase = createAdminClient()

  // Obtener usuario actual (admin)
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener el pedido con sus líneas
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*, order_lines(*, product:products(*))')
    .eq('id', orderId)
    .limit(1)

  if (orderError) throw orderError
  if (!orderData || orderData.length === 0) {
    throw new Error('Pedido no encontrado')
  }
  const order = orderData[0]

  // Verificar que el pedido esté en estado 'nuevo'
  if (order.status !== 'nuevo') {
    throw new Error('Solo se pueden aprobar pedidos en estado "nuevo"')
  }

  const errors: string[] = []

  // Importar isChapaProduct para verificar stock
  const { isChapaProduct } = await import('@/lib/product-utils')

  // PRIMERO: Verificar stock disponible para todos los productos antes de crear items
  console.log(`\n🔍 Verificando stock disponible para todas las líneas...`)
  for (const line of order.order_lines || []) {
    const units = Number(line.quantity) || 0
    const isChapa = isChapaProduct(
      line.product?.code || '',
      line.product?.category,
      line.product?.name
    )

    if (isChapa) {
      // Para chapas, verificar que hay stock disponible del producto exacto
      const { data: inventory } = await supabase
        .from('inventory')
        .select('stock_total, stock_reservado, stock_en_proceso')
        .eq('product_id', line.product_id)
        .limit(1)
        .maybeSingle()

      const stockDisponible = inventory ? (inventory.stock_total || 0) - (inventory.stock_reservado || 0) - (inventory.stock_en_proceso || 0) : 0
      
      if (!inventory || stockDisponible < units) {
        errors.push(`No hay stock suficiente para ${line.product?.name} (${line.product?.code}). Disponible: ${stockDisponible}, Solicitado: ${units}. Sugiero aprobar el pedido en pausa.`)
      }
    } else {
      // Para artículos normales, verificar que hay stock disponible del producto exacto
      const { data: inventory } = await supabase
        .from('inventory')
        .select('stock_disponible')
        .eq('product_id', line.product_id)
        .gt('stock_disponible', 0)
        .limit(1)
        .maybeSingle()

      if (!inventory || inventory.stock_disponible < units) {
        errors.push(`No hay stock suficiente para ${line.product?.name} (${line.product?.code}). Disponible: ${inventory?.stock_disponible || 0}, Solicitado: ${units}. Sugiero aprobar el pedido en pausa.`)
      }
    }
  }

  // Si hay errores de stock, no procesar y retornar error
  if (errors.length > 0) {
    return { 
      success: false,
      errors: errors
    }
  }

  console.log(`✅ Stock verificado correctamente para todas las líneas`)

  // NUEVO: Crear órdenes de corte para CHAPAS y preparation_items para ARTÍCULOS NORMALES
  for (const line of order.order_lines) {
    // Cantidad de unidades que pide el cliente
    const units = line.units || Math.ceil(line.quantity) || 1

    // Identificar si es chapa usando la tabla de productos de corte (isChapaProduct)
    const { isChapaProduct } = await import('@/lib/product-utils')
    const isChapa = isChapaProduct(
      line.product?.code || '',
      line.product?.category,
      line.product?.name
    )

    console.log(`\n🔍 Procesando línea:`, {
      product_name: line.product?.name,
      product_code: line.product?.code,
      product_category: line.product?.category,
      isChapa,
      units
    })
    
    if (isChapa) {
      // ========== CHAPAS: Crear orden de corte ==========
      console.log(`📋 Línea (CHAPA): ${line.product?.name}, Unidades: ${units}`)
      
      // Tamaño de cada pieza (extraído del código del producto)
      const productSize = extractSizeFromCode(line.product?.code || '') ||
                         line.product?.length_meters ||
                         line.length_meters ||
                         line.quantity
      
      // Crear UNA orden de corte agrupada para todas las unidades
      const cutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Crear la orden de corte AGRUPADA
      const { data: cutOrderData, error: cutError } = await supabase
        .from('cut_orders')
        .insert({
          cut_number: cutNumber,
          order_id: orderId,
          order_line_id: line.id,
          product_id: line.product_id,
          quantity_requested: units,
          quantity_cut: 0,
          status: 'pendiente',
          evo_item_number: line.evo_item_number || null,
        })
        .select()
      
      if (cutError) {
        console.error('Error creando orden de corte:', cutError)
        errors.push(`Error creando orden de corte: ${cutError.message}`)
        continue
      }

      if (!cutOrderData || cutOrderData.length === 0) {
        console.error('No se devolvió ninguna orden de corte después del insert')
        errors.push('Error: No se pudo crear la orden de corte')
        continue
      }

      const cutOrder = cutOrderData[0]

      console.log(`✅ Orden de corte creada: ${cutNumber} - ${units} unidades de ${productSize}m`)
      
      // ASIGNACIÓN AUTOMÁTICA DE STOCK
      // Buscar stock disponible del tamaño exacto o mayor
      try {
        const { findBestStockMatch, assignStockToCutOrder, reserveStock } = await import('./stock-management')
        
        // Buscar stock para el tamaño del producto
        const bestMatch = await findBestStockMatch(line.product_id, productSize)
        
        if (bestMatch) {
          // Asignar el stock a la orden de corte
          await assignStockToCutOrder(
            cutOrder.id, 
            bestMatch.inventory_id,
            bestMatch.product_id,  // ID del producto de la pieza asignada
            bestMatch.quantity     // Tamaño de la pieza
          )
          
          // Reservar stock (optimizado - una sola query)
          const { data: currentStock } = await supabase
            .from('inventory')
            .select('stock_reservado')
            .eq('id', bestMatch.inventory_id)
            .single()

          const newReservado = (currentStock?.stock_reservado || 0) + units

          await supabase
            .from('inventory')
            .update({ stock_reservado: newReservado })
            .eq('id', bestMatch.inventory_id)

          // Registrar movimiento único
          await supabase.from('stock_movements').insert({
            product_id: bestMatch.product_id,
            movement_type: 'reserva',
            quantity: units,
            stock_before: currentStock?.stock_reservado || 0,
            stock_after: newReservado,
            user_id: user?.id,
            notes: `Reserva de ${units} unidades de ${bestMatch.product_code}`,
          })
          
          console.log(`✅ Stock asignado: ${bestMatch.product_code} ${bestMatch.quantity}m × ${units} unidades (${bestMatch.isExact ? 'exacto' : 'aproximado'})`)
        } else {
          errors.push(`⚠️ No hay stock disponible para ${line.product?.name} (${productSize}m × ${units})`)
          console.warn(`⚠️ No hay stock disponible para ${cutNumber}`)
        }
      } catch (stockError: any) {
        errors.push(`Error asignando stock a ${cutNumber}: ${stockError.message}`)
        console.error('Error asignando stock:', stockError)
      }
      
    } else {
      // ========== ARTÍCULOS NORMALES: Crear preparation_item ==========
      console.log(`📦 Línea (ARTÍCULO NORMAL): ${line.product?.name}, Unidades: ${units}`)
      console.log(`   → Código: ${line.product?.code}`)
      console.log(`   → Product ID: ${line.product_id}`)
      console.log(`   → Order Line ID: ${line.id}`)
      
      // Fallback: Si el producto no es reconocido como chapa ni accesorio, generar preparation_item por defecto
      if (line.product?.category !== 'accesorios' && !line.product?.category?.includes('accesorio')) {
        console.warn(`⚠️ Producto ${line.product?.code} (${line.product?.name}) no reconocido como chapa ni accesorio, generando preparation_item por defecto`)
      }
      
      try {
        const { createPreparationItem } = await import('./preparation')
        console.log(`   → Llamando a createPreparationItem...`)
        const result = await createPreparationItem(orderId, line.id, line.product_id, units, true, line.evo_item_number || null)
        console.log(`✅ Preparation item creado:`, result)
        console.log(`✅ Stock reservado: ${units} unidades`)
      } catch (prepError: any) {
        console.error('❌ Error creando preparation_item:', prepError)
        console.error('   Stack:', prepError.stack)
        errors.push(`Error creando preparation_item para ${line.product?.name}: ${prepError.message}`)
      }
    }
    
    // Pequeño delay para evitar duplicados en el timestamp
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  // Validación post-aprobación: verificar que todos los items generaron algo
  const { data: validation } = await supabase
    .from('orders')
    .select(`
      order_lines(id),
      cut_orders(id),
      preparation_items(id)
    `)
    .eq('id', orderId)
    .single()

  if (validation) {
    const totalLines = validation.order_lines?.length || 0
    const totalGenerated = (validation.cut_orders?.length || 0) + (validation.preparation_items?.length || 0)
    
    if (totalLines !== totalGenerated) {
      const warning = `⚠️ DISCREPANCIA: ${totalLines} items vs ${totalGenerated} generados (${validation.cut_orders?.length || 0} cortes + ${validation.preparation_items?.length || 0} preparaciones)`
      console.warn(warning)
      errors.push(warning)
      
      // Agregar warning a las notas del pedido
      await supabase
        .from('orders')
        .update({
          notes: `DISCREPANCIA DETECTADA: ${totalLines} items en pedido vs ${totalGenerated} generados. Revisar manualmente.`
        })
        .eq('id', orderId)
    } else {
      console.log(`✅ Validación OK: ${totalLines} items = ${totalGenerated} generados`)
    }
  }

  // Si hay errores de stock, no aprobar el pedido y retornar error
  if (errors.length > 0) {
    return { 
      success: false,
      errors: errors
    }
  }

  // Actualizar estado del pedido a "aprobado"
  await supabase
    .from('orders')
    .update({ 
      status: 'aprobado',
      approved_at: new Date().toISOString(),
      approved_by: user?.id || null
    })
    .eq('id', orderId)

  // Revalidar rutas de pedidos y stock
  revalidateOrders(orderId)
  revalidateStock()
  
  return { 
    success: true
  }
}

// Mantener función legacy para compatibilidad (ahora llama a approveOrder)
export async function generateCutOrders(orderId: string) {
  return approveOrder(orderId)
}

// Actualizar estado del pedido basado en el estado de sus órdenes de corte Y preparation_items
export async function updateOrderStatus(orderId: string) {
  const supabase = createAdminClient()

  // Obtener todas las órdenes de corte del pedido
  const { data: cutOrders, error: cutError } = await supabase
    .from('cut_orders')
    .select('status, quantity_requested, quantity_cut')
    .eq('order_id', orderId)

  if (cutError) throw cutError

  // Obtener todos los preparation_items del pedido
  const { data: prepItems, error: prepError } = await supabase
    .from('preparation_items')
    .select('status, quantity_requested, quantity_prepared')
    .eq('order_id', orderId)

  if (prepError) throw prepError

  // Si no hay ni órdenes de corte ni preparation_items, el pedido debe estar en 'nuevo'
  if ((!cutOrders || cutOrders.length === 0) && (!prepItems || prepItems.length === 0)) {
    return
  }

  // Contar items completados
  const completedCutOrders = (cutOrders || []).filter(co => 
    (co.quantity_cut || 0) >= co.quantity_requested
  ).length
  
  const completedPrepItems = (prepItems || []).filter(pi => 
    (pi.quantity_prepared || 0) >= pi.quantity_requested
  ).length

  const totalItems = (cutOrders?.length || 0) + (prepItems?.length || 0)
  const completedItems = completedCutOrders + completedPrepItems
  
  // Verificar si hay items en proceso
  const inProgressCutOrders = (cutOrders || []).filter(co => co.status === 'pendiente').length
  const inProgressPrepItems = (prepItems || []).filter(pi => pi.status === 'en_proceso').length
  
  // Verificar si hay trabajos parciales
  const partialCuts = (cutOrders || []).filter(co => 
    (co.quantity_cut || 0) > 0 && (co.quantity_cut || 0) < co.quantity_requested
  ).length
  
  const partialPreps = (prepItems || []).filter(pi => 
    (pi.quantity_prepared || 0) > 0 && (pi.quantity_prepared || 0) < pi.quantity_requested
  ).length

  let newStatus = 'aprobado'

  if (completedItems === totalItems) {
    // Todos los items completados
    newStatus = 'finalizado'
  } else if (completedItems > 0 || inProgressCutOrders > 0 || inProgressPrepItems > 0 || partialCuts > 0 || partialPreps > 0) {
    // Si hay algún item completado, en proceso, o parcial → está en corte
    newStatus = 'en_corte'
  }

  console.log(`📊 Estado del pedido ${orderId}: ${completedItems}/${totalItems} completados (${completedCutOrders} cortes + ${completedPrepItems} preparados) → ${newStatus}`)

  // Actualizar estado del pedido
  await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  // Revalidar de forma agresiva para actualizar la tablet inmediatamente
  revalidatePath('/planta', 'layout')
  revalidatePath('/admin', 'layout')
  revalidatePath(`/planta/pedidos/${orderId}`)
  revalidatePath(`/admin/pedidos/${orderId}`)
  
  // Revalidar estado del pedido
  revalidateOrderStatus(orderId)
}

/**
 * Marcar pedido como entregado
 * Consume el stock reservado de todas las órdenes completadas
 */
export async function markOrderAsDelivered(orderId: string) {
  const supabase = createAdminClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  // Verificar que todas las órdenes de corte estén completadas
  const { data: cutOrders, error: cutOrdersError } = await supabase
    .from('cut_orders')
    .select('id, status, material_base_id, quantity_requested, quantity_cut')
    .eq('order_id', orderId)

  if (cutOrdersError) throw cutOrdersError

  // Verificar que todos los preparation_items estén completados
  const { data: prepItems, error: prepItemsError } = await supabase
    .from('preparation_items')
    .select('id, status, assigned_inventory_id, quantity_requested, quantity_prepared')
    .eq('order_id', orderId)

  if (prepItemsError) throw prepItemsError

  // Verificar que todas las órdenes de corte tengan quantity_cut >= quantity_requested
  const allCutOrdersCompleted = cutOrders?.every(co => (co.quantity_cut || 0) >= co.quantity_requested) ?? true
  
  // Verificar que todos los preparation_items tengan quantity_prepared >= quantity_requested
  const allPrepItemsCompleted = prepItems?.every(pi => (pi.quantity_prepared || 0) >= pi.quantity_requested) ?? true
  
  if (!allCutOrdersCompleted || !allPrepItemsCompleted) {
    throw new Error('No se puede marcar como entregado: hay items pendientes de completar')
  }

  // Obtener estado anterior del pedido
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('status, order_number')
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError

  // Preparar información del stock para historial (sin consumir localmente)
  const stockConsumed = []
  const previousStatus = orderData.status

  // Guardar información del stock para historial (EVO actualizará vía webhook)
  for (const cutOrder of cutOrders || []) {
    if (cutOrder.material_base_id) {
      // Obtener el inventory_id del producto asignado
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('id')
        .eq('product_id', cutOrder.material_base_id)
        .limit(1)

      if (invError || !inventoryData || inventoryData.length === 0) {
        console.error('Error finding inventory:', invError)
        continue
      }

      const inventory = inventoryData[0]

      console.log(`📦 Registrando ${cutOrder.quantity_requested} unidades de stock para orden de corte ${cutOrder.id} (EVO actualizará)`)

      // Guardar información del stock para historial
      stockConsumed.push({
        cut_order_id: cutOrder.id,
        inventory_id: inventory.id,
        quantity: cutOrder.quantity_requested
      })
    }
  }

  // Guardar información del stock de preparation_items para historial
  for (const prepItem of prepItems || []) {
    if (prepItem.assigned_inventory_id) {
      console.log(`📦 Registrando ${prepItem.quantity_requested} unidades de stock para preparation_item ${prepItem.id} (EVO actualizará)`)

      // Guardar información del stock para historial
      stockConsumed.push({
        preparation_item_id: prepItem.id,
        inventory_id: prepItem.assigned_inventory_id,
        quantity: prepItem.quantity_requested
      })
    }
  }

  // Marcar todos los cut_orders como 'entregado'
  for (const cutOrder of cutOrders || []) {
    const { error: updateError } = await supabase
      .from('cut_orders')
      .update({ status: 'entregado' })
      .eq('id', cutOrder.id)
    
    if (updateError) {
      console.error(`Error actualizando estado de cut_order ${cutOrder.id}:`, updateError)
    } else {
      console.log(`✅ Cut order ${cutOrder.id} marcado como entregado`)
    }
  }

  // Marcar todos los preparation_items como 'entregado'
  for (const prepItem of prepItems || []) {
    const { error: updateError } = await supabase
      .from('preparation_items')
      .update({ status: 'entregado' })
      .eq('id', prepItem.id)
    
    if (updateError) {
      console.error(`Error actualizando estado de preparation_item ${prepItem.id}:`, updateError)
    } else {
      console.log(`✅ Preparation item ${prepItem.id} marcado como entregado`)
    }
  }

  // Actualizar estado del pedido
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'entregado' })
    .eq('id', orderId)

  if (updateError) throw updateError

  // NUEVO: Guardar en historial de entregas para poder deshacer
  console.log('📝 Guardando en delivery_history...', {
    order_id: orderId,
    delivered_by: user?.id,
    previous_status: previousStatus,
    stock_consumed_count: stockConsumed.length,
    stock_consumed: stockConsumed
  })

  const { data: historyData, error: historyError } = await supabase
    .from('delivery_history')
    .insert({
      order_id: orderId,
      delivered_by: user?.id,
      previous_status: previousStatus,
      stock_consumed: stockConsumed
    })
    .select()

  if (historyError) {
    console.error('❌ Error guardando historial de entrega:', historyError)
    console.error('❌ Detalles:', {
      code: historyError.code,
      message: historyError.message,
      details: historyError.details,
      hint: historyError.hint
    })
    // No lanzar error, la entrega ya se completó
  } else if (historyData && historyData.length > 0) {
    console.log('✅ delivery_history guardado correctamente:', historyData[0].id)
  } else {
    console.error('❌ No se devolvieron datos después de insertar en delivery_history')
  }

  // Registrar en el log
  if (orderData) {
    await supabase.from('order_activity_log').insert({
      order_id: orderId,
      activity_type: 'delivered',
      description: `Pedido ${orderData.order_number} marcado como entregado`,
      metadata: {
        cut_orders_count: cutOrders?.length || 0,
        previous_status: previousStatus,
        stock_consumed_count: stockConsumed.length
      }
    })
  }

  // Notificar a RAM que el pedido fue entregado
  try {
    const { data: orderFull } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        evo_order_id,
        ref_evo,
        lines:order_lines(
          quantity,
          product:products(id, code, unit, evo_product_id)
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderFull) {
      const items = (orderFull.lines || []).map((line: any) => {
        const product = Array.isArray(line.product) ? line.product[0] : line.product
        return {
          product_id: product?.id,
          product_code: product?.code,
          evo_product_id: product?.evo_product_id,
          quantity: line.quantity,
          unit: product?.unit || 'm',
        }
      })

      await notifyPedidoCompletado({
        orderId,
        orderNumber: orderFull.order_number,
        evoOrderId: orderFull.evo_order_id || orderFull.ref_evo?.id_pedido,
        items,
      })
    }
  } catch (notifyError) {
    console.error('Error notificando pedido completado a RAM:', notifyError)
  }

  // Revalidar pedidos y stock
  revalidateOrders(orderId)
  revalidateStock()

  return { success: true }
}

/**
 * Deshacer entrega de un pedido (solo dentro de 24 horas)
 * Restaura el stock consumido y revierte el estado del pedido
 */
export async function undoOrderDelivery(orderId: string) {
  const supabase = createAdminClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  // Buscar historial activo de esta entrega (el más reciente)
  const { data: deliveryHistory, error: historyError } = await supabase
    .from('delivery_history')
    .select('*')
    .eq('order_id', orderId)
    .eq('is_active', true)
    .order('delivered_at', { ascending: false })
    .limit(1)
    .single()

  if (historyError) {
    if (historyError.code === 'PGRST116') {
      throw new Error('No se encontró historial de entrega para este pedido')
    }
    throw historyError
  }

  console.log(`🔄 Deshaciendo entrega del pedido ${orderId}`)

  // 1. Revertir estado de items de 'entregado' a 'completada'
  // NOTA: NO restauramos stock local - EVO actualizará vía webhook
  const { data: cutOrders } = await supabase
    .from('cut_orders')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'entregado')
  
  if (cutOrders) {
    for (const cutOrder of cutOrders) {
      const { error: updateError } = await supabase
        .from('cut_orders')
        .update({ status: 'completada' })
        .eq('id', cutOrder.id)
      
      if (updateError) {
        console.error(`Error revirtiendo estado de cut_order ${cutOrder.id}:`, updateError)
      } else {
        console.log(`✅ Cut order ${cutOrder.id} revertido a completada`)
      }
    }
  }

  const { data: prepItems } = await supabase
    .from('preparation_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'entregado')
  
  if (prepItems) {
    for (const prepItem of prepItems) {
      const { error: updateError } = await supabase
        .from('preparation_items')
        .update({ status: 'completada' })
        .eq('id', prepItem.id)
      
      if (updateError) {
        console.error(`Error revirtiendo estado de preparation_item ${prepItem.id}:`, updateError)
      } else {
        console.log(`✅ Preparation item ${prepItem.id} revertido a completada`)
      }
    }
  }

  // 2. Revertir el estado del pedido
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: deliveryHistory.previous_status })
    .eq('id', orderId)

  if (updateError) throw updateError

  // 3. Marcar el historial como inactivo
  const { error: deactivateError } = await supabase
    .from('delivery_history')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', deliveryHistory.id)

  if (deactivateError) {
    console.error('Error desactivando historial:', deactivateError)
  }

  // 4. Registrar en el log
  const { data: orderData } = await supabase
    .from('orders')
    .select('order_number')
    .eq('id', orderId)
    .limit(1)

  if (orderData && orderData.length > 0) {
    const order = orderData[0]
    await supabase.from('order_activity_log').insert({
      order_id: orderId,
      activity_type: 'delivery_undone',
      description: `Entrega del pedido ${order.order_number} deshecha`,
      metadata: {
        delivered_at: deliveryHistory.delivered_at,
        undone_by: user?.id,
        restored_status: deliveryHistory.previous_status,
        stock_restored_count: deliveryHistory.stock_consumed.length
      }
    })
  }

  // Revalidar pedidos y stock
  revalidateOrders(orderId)
  revalidateStock()

  console.log(`✅ Entrega del pedido ${orderId} deshecha correctamente`)
  return { success: true }
}
