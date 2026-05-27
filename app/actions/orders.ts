'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidateOrders, revalidateStock, revalidateOrderStatus } from '@/lib/revalidate'
import { notifyPedidoCompletado } from '@/lib/ram-outbound'
import { extractSizeFromCode } from '@/lib/product-utils'

export async function getOrders() {
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
  
  console.log(`📋 getOrderById(${id}):`, {
    cut_orders_count: data[0].cut_orders?.length || 0,
    preparation_items_count: data[0].preparation_items?.length || 0,
    preparation_items: data[0].preparation_items
  })
  
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

    // Identificar si es chapa usando la función isChapaProduct
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
          product_id: line.product_id,
          quantity_requested: units,
          quantity_cut: 0,
          status: 'pendiente',
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

  // NUEVO: Crear órdenes de corte para CHAPAS y preparation_items para ARTÍCULOS NORMALES
  for (const line of order.order_lines) {
    // Cantidad de unidades que pide el cliente
    const units = line.units || Math.ceil(line.quantity) || 1

    // Identificar si es chapa usando la función isChapaProduct
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
          product_id: line.product_id,
          quantity_requested: units,
          quantity_cut: 0,
          status: 'pendiente',
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
      
      try {
        const { createPreparationItem } = await import('./preparation')
        console.log(`   → Llamando a createPreparationItem...`)
        const result = await createPreparationItem(orderId, line.id, line.product_id, units)
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
    success: true,
    warnings: errors.length > 0 ? errors : undefined
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

  // Preparar información del stock consumido para historial
  const stockConsumed = []
  const previousStatus = orderData.status

  // Consumir stock reservado de cut_orders
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

      console.log(`📦 Consumiendo ${cutOrder.quantity_requested} unidades de stock para orden de corte ${cutOrder.id}`)
      
      // Guardar información del stock consumido para historial
      stockConsumed.push({
        cut_order_id: cutOrder.id,
        inventory_id: inventory.id,
        quantity: cutOrder.quantity_requested
      })
      
      for (let i = 0; i < cutOrder.quantity_requested; i++) {
        const { error: stockError } = await supabase.rpc('consume_reserved_stock', {
          p_inventory_id: inventory.id
        })

        if (stockError) {
          console.error(`Error consuming reserved stock (unit ${i + 1}/${cutOrder.quantity_requested}):`, stockError)
          // Continuar con las demás unidades
        }
      }
      
      console.log(`✅ ${cutOrder.quantity_requested} unidades consumidas`)
    }
  }

  // NUEVO: Consumir stock reservado de preparation_items
  for (const prepItem of prepItems || []) {
    if (prepItem.assigned_inventory_id) {
      console.log(`📦 Consumiendo ${prepItem.quantity_requested} unidades de stock para preparation_item ${prepItem.id}`)
      
      // Guardar información del stock consumido para historial
      stockConsumed.push({
        preparation_item_id: prepItem.id,
        inventory_id: prepItem.assigned_inventory_id,
        quantity: prepItem.quantity_requested
      })
      
      for (let i = 0; i < prepItem.quantity_requested; i++) {
        const { error: stockError } = await supabase.rpc('consume_reserved_stock', {
          p_inventory_id: prepItem.assigned_inventory_id
        })

        if (stockError) {
          console.error(`Error consuming reserved stock (unit ${i + 1}/${prepItem.quantity_requested}):`, stockError)
          // Continuar con las demás unidades
        }
      }
      
      console.log(`✅ ${prepItem.quantity_requested} unidades consumidas`)
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

  // 1. Restaurar el stock consumido
  for (const stockItem of deliveryHistory.stock_consumed) {
    console.log(`📦 Restaurando ${stockItem.quantity} unidades de stock para inventory ${stockItem.inventory_id}`)
    
    for (let i = 0; i < stockItem.quantity; i++) {
      // Crear función para restaurar stock (opuesto de consume_reserved_stock)
      const { error: restoreError } = await supabase.rpc('restore_reserved_stock', {
        p_inventory_id: stockItem.inventory_id
      })

      if (restoreError) {
        console.error(`Error restaurando stock (unit ${i + 1}/${stockItem.quantity}):`, restoreError)
      }
    }
  }

  // Revertir estado de items de 'entregado' a 'completada'
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

/**
 * Marcar retirada parcial de un pedido
 * Permite al cliente retirar solo algunos items o cantidades parciales
 */
export async function markPartialDelivery(
  orderId: string,
  itemsToDeliver: Array<{
    cutOrderId?: string
    preparationItemId?: string
    quantity: number
  }>
) {
  const supabase = createAdminClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener el pedido con sus cut_orders y preparation_items
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      cut_orders:cut_orders!cut_orders_order_id_fkey(
        id,
        status,
        material_base_id,
        quantity_requested,
        quantity_cut,
        product:products!cut_orders_product_id_fkey(*)
      ),
      preparation_items(
        id,
        status,
        assigned_inventory_id,
        quantity_requested,
        quantity_prepared,
        product:products(*)
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError
  if (!orderData) throw new Error('Pedido no encontrado')

  // Validar que el pedido esté en un estado válido para retirada parcial
  const validStatuses = ['aprobado', 'en_corte', 'finalizado', 'parcialmente_entregado']
  if (!validStatuses.includes(orderData.status)) {
    throw new Error(`El pedido debe estar en estado aprobado, en_corte, finalizado o parcialmente_entregado para realizar retiradas parciales. Estado actual: ${orderData.status}`)
  }

  // Obtener historial de entregas previas para calcular lo ya retirado
  const { data: previousDeliveries } = await supabase
    .from('delivery_history')
    .select('items_delivered')
    .eq('order_id', orderId)
    .eq('is_active', true)

  // Calcular cantidades ya retiradas
  const alreadyDelivered: Record<string, number> = {}
  if (previousDeliveries) {
    for (const delivery of previousDeliveries) {
      if (delivery.items_delivered) {
        for (const item of delivery.items_delivered) {
          const key = item.cut_order_id || item.preparation_item_id
          alreadyDelivered[key] = (alreadyDelivered[key] || 0) + item.quantity
        }
      }
    }
  }

  // Validar cada item a retirar
  const stockConsumed = []
  const itemsDeliveredForHistory = []

  for (const itemToDeliver of itemsToDeliver) {
    if (itemToDeliver.quantity <= 0) {
      throw new Error('La cantidad a retirar debe ser mayor a 0')
    }

    if (itemToDeliver.cutOrderId) {
      // Validar cut_order
      const cutOrder = orderData.cut_orders?.find((co: any) => co.id === itemToDeliver.cutOrderId)
      if (!cutOrder) {
        throw new Error(`Orden de corte ${itemToDeliver.cutOrderId} no encontrada`)
      }

      const quantityCut = cutOrder.quantity_cut || 0
      const alreadyDeliveredQty = alreadyDelivered[itemToDeliver.cutOrderId] || 0
      const availableToDeliver = quantityCut - alreadyDeliveredQty

      if (quantityCut === 0) {
        throw new Error(`La orden de corte ${itemToDeliver.cutOrderId} no tiene unidades completadas`)
      }

      if (itemToDeliver.quantity > availableToDeliver) {
        throw new Error(`No se puede retirar ${itemToDeliver.quantity} unidades de la orden de corte ${itemToDeliver.cutOrderId}. Disponible para retirar: ${availableToDeliver}`)
      }

      // Obtener inventory_id del material asignado
      if (!cutOrder.material_base_id) {
        throw new Error(`La orden de corte ${itemToDeliver.cutOrderId} no tiene material asignado`)
      }

      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('id')
        .eq('product_id', cutOrder.material_base_id)
        .limit(1)

      if (invError || !inventoryData || inventoryData.length === 0) {
        throw new Error(`No se encontró inventario para el material asignado a la orden de corte ${itemToDeliver.cutOrderId}`)
      }

      const inventory = inventoryData[0]

      // Guardar para consumir stock después
      stockConsumed.push({
        cut_order_id: itemToDeliver.cutOrderId,
        inventory_id: inventory.id,
        quantity: itemToDeliver.quantity
      })

      itemsDeliveredForHistory.push({
        cut_order_id: itemToDeliver.cutOrderId,
        quantity: itemToDeliver.quantity,
        product_code: cutOrder.product?.code || null,
        product_name: cutOrder.product?.name || null
      })

    } else if (itemToDeliver.preparationItemId) {
      // Validar preparation_item
      const prepItem = orderData.preparation_items?.find((pi: any) => pi.id === itemToDeliver.preparationItemId)
      if (!prepItem) {
        throw new Error(`Preparation item ${itemToDeliver.preparationItemId} no encontrado`)
      }

      const quantityPrepared = prepItem.quantity_prepared || 0
      const alreadyDeliveredQty = alreadyDelivered[itemToDeliver.preparationItemId] || 0
      const availableToDeliver = quantityPrepared - alreadyDeliveredQty

      if (quantityPrepared === 0) {
        throw new Error(`El preparation item ${itemToDeliver.preparationItemId} no tiene unidades preparadas`)
      }

      if (itemToDeliver.quantity > availableToDeliver) {
        throw new Error(`No se puede retirar ${itemToDeliver.quantity} unidades del preparation item ${itemToDeliver.preparationItemId}. Disponible para retirar: ${availableToDeliver}`)
      }

      if (!prepItem.assigned_inventory_id) {
        throw new Error(`El preparation item ${itemToDeliver.preparationItemId} no tiene inventario asignado`)
      }

      // Guardar para consumir stock después
      stockConsumed.push({
        preparation_item_id: itemToDeliver.preparationItemId,
        inventory_id: prepItem.assigned_inventory_id,
        quantity: itemToDeliver.quantity
      })

      itemsDeliveredForHistory.push({
        preparation_item_id: itemToDeliver.preparationItemId,
        quantity: itemToDeliver.quantity,
        product_code: prepItem.product?.code || null,
        product_name: prepItem.product?.name || null
      })
    } else {
      throw new Error('Debe especificar cutOrderId o preparationItemId')
    }
  }

  console.log(`📦 Procesando retirada parcial del pedido ${orderId}`)
  console.log(`   Items a retirar: ${itemsToDeliver.length}`)

  // Consumir stock reservado
  for (const stockItem of stockConsumed) {
    console.log(`📦 Consumiendo ${stockItem.quantity} unidades de stock para inventory ${stockItem.inventory_id}`)

    for (let i = 0; i < stockItem.quantity; i++) {
      const { error: stockError } = await supabase.rpc('consume_reserved_stock', {
        p_inventory_id: stockItem.inventory_id
      })

      if (stockError) {
        console.error(`Error consuming reserved stock (unit ${i + 1}/${stockItem.quantity}):`, stockError)
        throw new Error(`Error consumiendo stock: ${stockError.message}`)
      }
    }

    console.log(`✅ ${stockItem.quantity} unidades consumidas`)
  }

  // Actualizar estado de items a 'entregado' si se entregaron completamente
  for (const item of itemsToDeliver) {
    if (item.cutOrderId) {
      const cutOrder = orderData.cut_orders?.find((co: any) => co.id === item.cutOrderId)
      if (cutOrder) {
        const quantityCut = cutOrder.quantity_cut || 0
        const alreadyDeliveredQty = alreadyDelivered[item.cutOrderId] || 0
        const totalDelivered = alreadyDeliveredQty + item.quantity
        
        // Si se entregó todo lo cortado, cambiar estado a 'entregado'
        if (totalDelivered >= quantityCut && quantityCut > 0) {
          const { error: updateError } = await supabase
            .from('cut_orders')
            .update({ status: 'entregado' })
            .eq('id', item.cutOrderId)
          
          if (updateError) {
            console.error(`Error actualizando estado de cut_order ${item.cutOrderId}:`, updateError)
          } else {
            console.log(`✅ Cut order ${item.cutOrderId} marcado como entregado`)
          }
        }
      }
    } else if (item.preparationItemId) {
      const prepItem = orderData.preparation_items?.find((pi: any) => pi.id === item.preparationItemId)
      if (prepItem) {
        const quantityPrepared = prepItem.quantity_prepared || 0
        const alreadyDeliveredQty = alreadyDelivered[item.preparationItemId] || 0
        const totalDelivered = alreadyDeliveredQty + item.quantity
        
        // Si se entregó todo lo preparado, cambiar estado a 'entregado'
        if (totalDelivered >= quantityPrepared && quantityPrepared > 0) {
          const { error: updateError } = await supabase
            .from('preparation_items')
            .update({ status: 'entregado' })
            .eq('id', item.preparationItemId)
          
          if (updateError) {
            console.error(`Error actualizando estado de preparation_item ${item.preparationItemId}:`, updateError)
          } else {
            console.log(`✅ Preparation item ${item.preparationItemId} marcado como entregado`)
          }
        }
      }
    }
  }

  // Guardar en delivery_history
  const { data: historyData, error: historyError } = await supabase
    .from('delivery_history')
    .insert({
      order_id: orderId,
      delivered_by: user?.id,
      previous_status: orderData.status,
      stock_consumed: stockConsumed,
      delivery_type: 'partial',
      items_delivered: itemsDeliveredForHistory
    })
    .select()

  if (historyError) {
    console.error('❌ Error guardando historial de retirada parcial:', historyError)
    throw new Error(`Error guardando historial: ${historyError.message}`)
  }

  console.log('✅ Historial de retirada parcial guardado:', historyData[0].id)

  // Calcular si todos los items ya están completamente retirados
  let allItemsDelivered = true
  let totalItemsCompleted = 0
  let totalItemsDelivered = 0
  
  // Verificar cut_orders
  for (const cutOrder of orderData.cut_orders || []) {
    const quantityCut = cutOrder.quantity_cut || 0
    const delivered = (alreadyDelivered[cutOrder.id] || 0) + 
      (itemsDeliveredForHistory.find(i => i.cut_order_id === cutOrder.id)?.quantity || 0)
    
    console.log(`   Cut Order ${cutOrder.id}: cortado=${quantityCut}, entregado=${delivered}`)
    
    // Solo contar items que tienen algo cortado
    if (quantityCut > 0) {
      totalItemsCompleted += quantityCut
      totalItemsDelivered += delivered
      
      if (delivered < quantityCut) {
        allItemsDelivered = false
      }
    }
  }
  
  // Verificar preparation_items
  for (const prepItem of orderData.preparation_items || []) {
    const quantityPrepared = prepItem.quantity_prepared || 0
    const delivered = (alreadyDelivered[prepItem.id] || 0) + 
      (itemsDeliveredForHistory.find(i => i.preparation_item_id === prepItem.id)?.quantity || 0)
    
    console.log(`   Prep Item ${prepItem.id}: preparado=${quantityPrepared}, entregado=${delivered}`)
    
    // Solo contar items que tienen algo preparado
    if (quantityPrepared > 0) {
      totalItemsCompleted += quantityPrepared
      totalItemsDelivered += delivered
      
      if (delivered < quantityPrepared) {
        allItemsDelivered = false
      }
    }
  }
  
  // Si no hay items completados, no puede estar todo entregado
  if (totalItemsCompleted === 0) {
    allItemsDelivered = false
  }
  
  console.log(`   Total completado: ${totalItemsCompleted}, Total entregado: ${totalItemsDelivered}, Todo entregado: ${allItemsDelivered}`)

  // En una retirada PARCIAL, NUNCA marcar como 'entregado'
  // El estado 'entregado' solo se usa con el botón "Marcar como Entregado"
  // Aquí solo calculamos el estado según el progreso de producción
  
  const cutOrders = orderData.cut_orders || []
  const prepItems = orderData.preparation_items || []
  
  let newStatus = orderData.status
  
  if (cutOrders.length === 0 && prepItems.length === 0) {
    // No hay items de producción, mantener estado actual (probablemente 'aprobado')
    newStatus = orderData.status
  } else {
    // Verificar estado de cut_orders
    const hasCutOrdersInCorte = cutOrders.some((co: any) => 
      ['pendiente', 'en_corte', 'pendiente_confirmacion'].includes(co.status)
    )
    const allCutOrdersCompleted = cutOrders.every((co: any) => 
      co.status === 'completada' || co.status === 'completado' || co.status === 'entregado'
    )
    
    // Verificar estado de preparation_items
    const hasPrepItemsInProgress = prepItems.some((pi: any) => 
      ['pendiente', 'en_preparacion'].includes(pi.status)
    )
    const allPrepItemsCompleted = prepItems.every((pi: any) => 
      pi.status === 'completada' || pi.status === 'completado' || pi.status === 'entregado'
    )
    
    if (hasCutOrdersInCorte || hasPrepItemsInProgress) {
      newStatus = 'en_corte'
    } else if (allCutOrdersCompleted && allPrepItemsCompleted) {
      newStatus = 'finalizado'
    } else {
      // Mantener estado actual si no se puede determinar
      newStatus = orderData.status
    }
  }
  
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  if (updateError) throw updateError

  console.log(`✅ Estado del pedido actualizado a: ${newStatus}`)

  // Construir descripción detallada para el log
  const itemDescriptions = []
  for (const item of itemsDeliveredForHistory) {
    if (item.cut_order_id) {
      const cutOrder = orderData.cut_orders?.find((co: any) => co.id === item.cut_order_id)
      const product = Array.isArray(cutOrder?.product) ? cutOrder.product[0] : cutOrder?.product
      itemDescriptions.push(`${item.quantity} ud de ${product?.name || product?.code || 'producto'}`)
    } else if (item.preparation_item_id) {
      const prepItem = orderData.preparation_items?.find((pi: any) => pi.id === item.preparation_item_id)
      const product = Array.isArray(prepItem?.product) ? prepItem.product[0] : prepItem?.product
      itemDescriptions.push(`${item.quantity} ud de ${product?.name || product?.code || 'producto'}`)
    }
  }
  const detailedDescription = `Retirada parcial: ${itemDescriptions.join(', ')}`

  // Registrar en el log
  await supabase.from('order_activity_log').insert({
    order_id: orderId,
    activity_type: 'partial_delivery',
    description: detailedDescription,
    metadata: {
      items_count: itemsToDeliver.length,
      previous_status: orderData.status,
      new_status: newStatus,
      stock_consumed_count: stockConsumed.length,
      items_delivered: itemsDeliveredForHistory
    }
  })

  // Notificar a Evo
  try {
    const { notifyPedidoParcialmenteEntregado } = await import('@/lib/ram-outbound')
    
    // Preparar items entregados para Evo
    const itemsDelivered = []
    const remainingItems = []
    
    for (const item of itemsDeliveredForHistory) {
      if (item.cut_order_id) {
        const cutOrder = orderData.cut_orders?.find((co: any) => co.id === item.cut_order_id)
        const product = Array.isArray(cutOrder?.product) ? cutOrder.product[0] : cutOrder?.product
        
        itemsDelivered.push({
          product_id: product?.id,
          product_code: product?.code,
          evo_product_id: product?.evo_product_id,
          quantity: item.quantity,
          unit: product?.unit || 'm'
        })
        
        // Calcular restante
        const totalDelivered = (alreadyDelivered[item.cut_order_id] || 0) + item.quantity
        const remaining = (cutOrder?.quantity_cut || 0) - totalDelivered
        if (remaining > 0) {
          remainingItems.push({
            product_id: product?.id,
            product_code: product?.code,
            evo_product_id: product?.evo_product_id,
            quantity: remaining,
            unit: product?.unit || 'm'
          })
        }
      } else if (item.preparation_item_id) {
        const prepItem = orderData.preparation_items?.find((pi: any) => pi.id === item.preparation_item_id)
        const product = Array.isArray(prepItem?.product) ? prepItem.product[0] : prepItem?.product
        
        itemsDelivered.push({
          product_id: product?.id,
          product_code: product?.code,
          evo_product_id: product?.evo_product_id,
          quantity: item.quantity,
          unit: product?.unit || 'ud'
        })
        
        // Calcular restante
        const totalDelivered = (alreadyDelivered[item.preparation_item_id] || 0) + item.quantity
        const remaining = (prepItem?.quantity_prepared || 0) - totalDelivered
        if (remaining > 0) {
          remainingItems.push({
            product_id: product?.id,
            product_code: product?.code,
            evo_product_id: product?.evo_product_id,
            quantity: remaining,
            unit: product?.unit || 'ud'
          })
        }
      }
    }
    
    await notifyPedidoParcialmenteEntregado({
      orderId,
      orderNumber: orderData.order_number,
      evoOrderId: orderData.evo_order_id || orderData.ref_evo?.id_pedido,
      itemsDelivered,
      remainingItems: remainingItems.length > 0 ? remainingItems : undefined
    })
  } catch (notifyError) {
    console.error('Error notificando retirada parcial a Evo:', notifyError)
    // No lanzar error, la retirada ya se completó
  }

  // Revalidar rutas
  revalidateOrders(orderId)
  revalidateStock()

  return { 
    success: true, 
    newStatus,
    deliveryHistoryId: historyData[0].id
  }
}

/**
 * Deshacer retirada parcial de un pedido
 * Restaura el stock y revierte el estado del pedido
 */
export async function undoPartialDelivery(deliveryHistoryId: string) {
  const supabase = createAdminClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  // Buscar el registro de delivery_history
  const { data: deliveryHistory, error: historyError } = await supabase
    .from('delivery_history')
    .select('*')
    .eq('id', deliveryHistoryId)
    .single()

  if (historyError) {
    if (historyError.code === 'PGRST116') {
      throw new Error('No se encontró el historial de retirada')
    }
    throw historyError
  }

  // Validar que sea una retirada parcial
  if (deliveryHistory.delivery_type !== 'partial') {
    throw new Error('Solo se pueden deshacer retiradas parciales con esta función')
  }

  // Validar que esté activa
  if (!deliveryHistory.is_active) {
    throw new Error('Esta retirada ya fue deshecha')
  }

  console.log(`🔄 Deshaciendo retirada parcial ${deliveryHistoryId}`)

  // Restaurar el stock consumido
  for (const stockItem of deliveryHistory.stock_consumed) {
    console.log(`📦 Restaurando ${stockItem.quantity} unidades de stock para inventory ${stockItem.inventory_id}`)
    
    for (let i = 0; i < stockItem.quantity; i++) {
      const { error: restoreError } = await supabase.rpc('restore_reserved_stock', {
        p_inventory_id: stockItem.inventory_id
      })

      if (restoreError) {
        console.error(`Error restaurando stock (unit ${i + 1}/${stockItem.quantity}):`, restoreError)
        throw new Error(`Error restaurando stock: ${restoreError.message}`)
      }
    }
    
    console.log(`✅ ${stockItem.quantity} unidades restauradas`)
  }

  // Revertir estado de items de 'entregado' a 'completada'
  if (deliveryHistory.items_delivered) {
    for (const item of deliveryHistory.items_delivered) {
      if (item.cut_order_id) {
        const { error: updateError } = await supabase
          .from('cut_orders')
          .update({ status: 'completada' })
          .eq('id', item.cut_order_id)
        
        if (updateError) {
          console.error(`Error revirtiendo estado de cut_order ${item.cut_order_id}:`, updateError)
        } else {
          console.log(`✅ Cut order ${item.cut_order_id} revertido a completada`)
        }
      } else if (item.preparation_item_id) {
        const { error: updateError } = await supabase
          .from('preparation_items')
          .update({ status: 'completada' })
          .eq('id', item.preparation_item_id)
        
        if (updateError) {
          console.error(`Error revirtiendo estado de preparation_item ${item.preparation_item_id}:`, updateError)
        } else {
          console.log(`✅ Preparation item ${item.preparation_item_id} revertido a completada`)
        }
      }
    }
  }

  // Revertir el estado del pedido
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: deliveryHistory.previous_status })
    .eq('id', deliveryHistory.order_id)

  if (updateError) throw updateError

  // Marcar el historial como inactivo
  const { error: deactivateError } = await supabase
    .from('delivery_history')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', deliveryHistoryId)

  if (deactivateError) {
    console.error('Error desactivando historial:', deactivateError)
  }

  // Construir descripción detallada para el log
  const { data: orderData } = await supabase
    .from('orders')
    .select(`
      order_number,
      cut_orders(id, product:products(*)),
      preparation_items(id, product:products(*))
    `)
    .eq('id', deliveryHistory.order_id)
    .single()

  let detailedDescription = `Retirada parcial deshecha`
  
  if (deliveryHistory.items_delivered && deliveryHistory.items_delivered.length > 0) {
    const itemDescriptions = []
    for (const item of deliveryHistory.items_delivered) {
      if (item.cut_order_id) {
        const cutOrder = orderData?.cut_orders?.find((co: any) => co.id === item.cut_order_id)
        const product = Array.isArray(cutOrder?.product) ? cutOrder.product[0] : cutOrder?.product
        itemDescriptions.push(`${item.quantity} ud de ${product?.name || product?.code || 'producto'}`)
      } else if (item.preparation_item_id) {
        const prepItem = orderData?.preparation_items?.find((pi: any) => pi.id === item.preparation_item_id)
        const product = Array.isArray(prepItem?.product) ? prepItem.product[0] : prepItem?.product
        itemDescriptions.push(`${item.quantity} ud de ${product?.name || product?.code || 'producto'}`)
      }
    }
    if (itemDescriptions.length > 0) {
      detailedDescription = `Retirada parcial deshecha: ${itemDescriptions.join(', ')}`
    }
  }

  if (orderData) {
    await supabase.from('order_activity_log').insert({
      order_id: deliveryHistory.order_id,
      activity_type: 'partial_delivery_undone',
      description: detailedDescription,
      metadata: {
        delivery_history_id: deliveryHistoryId,
        delivered_at: deliveryHistory.delivered_at,
        undone_by: user?.id,
        restored_status: deliveryHistory.previous_status,
        stock_restored_count: deliveryHistory.stock_consumed.length
      }
    })
  }

  // Revalidar pedidos y stock
  revalidateOrders(deliveryHistory.order_id)
  revalidateStock()

  console.log(`✅ Retirada parcial ${deliveryHistoryId} deshecha correctamente`)
  return { success: true }
}
