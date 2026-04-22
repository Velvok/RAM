'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidateOrders, revalidateStock, revalidateOrderStatus } from '@/lib/revalidate'

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
        assigned_inventory:inventory(*),
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

  // Crear órdenes de corte SIN asignar stock
  for (const line of order.order_lines) {
    // FILTRO: Solo procesar chapas
    if (line.product?.category !== 'chapas') {
      console.log(`⏭️ Saltando ${line.product?.name} - No es una chapa (categoría: ${line.product?.category})`)
      continue
    }
    
    // Cantidad de unidades que pide el cliente
    const units = line.units || Math.ceil(line.quantity) || 1
    
    // Tamaño de cada pieza (extraído del código del producto)
    const productSize = line.product?.length_meters || 
                       parseFloat(line.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                       line.length_meters || 
                       line.quantity
    
    console.log(`📋 Línea (CHAPA - EN PAUSA): ${line.product?.name}, Unidades: ${units}, Tamaño: ${productSize}m`)
    
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
      console.error(`Error creando orden de corte: ${cutError.message}`)
      continue
    }

    console.log(`✅ Orden de corte creada EN PAUSA: ${cutNumber} - ${units} unidades de ${productSize}m (sin stock asignado)`)
    
    // Pequeño delay para evitar duplicados en el timestamp
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  // Actualizar estado del pedido a "aprobado_en_pausa"
  const { error: updateError } = await supabase
    .from('orders')
    .update({ 
      status: 'aprobado_en_pausa',
      approved_at: new Date().toISOString(),
      approved_by: user?.id || null
    })
    .eq('id', orderId)

  if (updateError) {
    console.error('Error actualizando estado del pedido:', updateError)
    throw new Error(`No se pudo actualizar el estado del pedido: ${updateError.message}`)
  }

  console.log(`✅ Pedido ${orderId} actualizado a estado 'aprobado_en_pausa'`)

  // Revalidar rutas de pedidos de forma agresiva
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
    
    // Identificar si es chapa (código empieza con "AC")
    const isChapa = line.product?.code?.startsWith('AC') || false
    
    console.log(`\n🔍 Procesando línea:`, {
      product_name: line.product?.name,
      product_code: line.product?.code,
      isChapa,
      units
    })
    
    if (isChapa) {
      // ========== CHAPAS: Crear orden de corte ==========
      console.log(`📋 Línea (CHAPA): ${line.product?.name}, Unidades: ${units}`)
      
      // Tamaño de cada pieza (extraído del código del producto)
      const productSize = line.product?.length_meters || 
                         parseFloat(line.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
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
          
          // Reservar tantas unidades como se solicitan
          for (let i = 0; i < units; i++) {
            await reserveStock(bestMatch.inventory_id)
          }
          
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
  const inProgressCutOrders = (cutOrders || []).filter(co => co.status === 'en_proceso').length
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
    newStatus = 'preparado'
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

  // Verificar que esté dentro de las 24 horas
  const deliveredAt = new Date(deliveryHistory.delivered_at)
  const now = new Date()
  const hoursDiff = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60)

  if (hoursDiff > 24) {
    throw new Error('Solo se puede deshacer una entrega dentro de las primeras 24 horas')
  }

  console.log(`🔄 Deshaciendo entrega del pedido ${orderId} (${hoursDiff.toFixed(1)}h después)`)

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
