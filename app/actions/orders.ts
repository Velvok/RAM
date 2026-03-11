'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { revalidateOrders } from '@/lib/revalidate'

export async function getOrders() {
  const supabase = await createClient()

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
  const supabase = await createClient()

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
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelado' })
    .eq('id', orderId)
    .select()
    .single()

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

  // Revalidar todas las rutas de pedidos
  revalidateOrders(orderId)
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
  return data
}

// verifyPayment eliminada - Los pedidos ya vienen con pago verificado

// Aprobar pedido y generar órdenes de corte CON asignación automática de stock
export async function approveOrder(orderId: string) {
  const supabase = await createClient()

  // Obtener usuario actual (admin)
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener el pedido con sus líneas
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_lines(*, product:products(*))')
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError

  // Verificar que el pedido esté en estado 'nuevo'
  if (order.status !== 'nuevo') {
    throw new Error('Solo se pueden aprobar pedidos en estado "nuevo"')
  }

  const errors: string[] = []

  // Crear UNA orden de corte por cada UNIDAD
  // Ejemplo: Cliente pide 4 × Chapa 0.5m → se crean 4 órdenes de corte de 0.5m
  for (const line of order.order_lines) {
    // Cantidad de unidades que pide el cliente
    const units = line.units || Math.ceil(line.quantity) || 1
    
    // Tamaño de cada pieza (extraído del código del producto)
    const productSize = line.product?.length_meters || 
                       parseFloat(line.product?.code?.match(/\.(\d+),(\d+)$/)?.[0]?.replace('.', '')?.replace(',', '.') || '0') ||
                       line.length_meters || 
                       line.quantity
    
    console.log(`📋 Línea: ${line.product?.name}, Unidades: ${units}, Tamaño: ${productSize}m`)
    
    // Crear una orden de corte por cada unidad
    for (let i = 0; i < units; i++) {
      const cutNumber = `CUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Crear la orden de corte
      const { data: cutOrder, error: cutError } = await supabase
        .from('cut_orders')
        .insert({
          cut_number: cutNumber,
          order_id: orderId,
          product_id: line.product_id,
          quantity_requested: productSize, // Tamaño del producto
          status: 'pendiente',
        })
        .select()
        .single()
      
      if (cutError) {
        errors.push(`Error creando orden de corte: ${cutError.message}`)
        continue
      }

      // NUEVO: Buscar y asignar stock automáticamente
      try {
        const { findBestStockMatch, assignStockToCutOrder, reserveStock } = await import('./stock-management')
        
        const bestMatch = await findBestStockMatch(line.product_id, productSize)
        
        if (bestMatch) {
          // Asignar el stock a la orden de corte
          await assignStockToCutOrder(
            cutOrder.id, 
            bestMatch.inventory_id,
            bestMatch.product_id,  // ID del producto de la pieza asignada
            bestMatch.quantity     // Tamaño de la pieza
          )
          
          // Reservar el stock (1 unidad de esta pieza específica)
          await reserveStock(bestMatch.inventory_id)
          
          console.log(`✅ Stock asignado a ${cutNumber}: ${bestMatch.product_code} ${bestMatch.quantity}m (${bestMatch.isExact ? 'exacto' : 'aproximado'})`)
        } else {
          errors.push(`⚠️ No hay stock disponible para ${cutNumber} (${productSize}m)`)
          console.warn(`⚠️ No hay stock disponible para ${cutNumber}`)
        }
      } catch (stockError: any) {
        errors.push(`Error asignando stock a ${cutNumber}: ${stockError.message}`)
        console.error('Error asignando stock:', stockError)
      }
      
      // Pequeño delay para evitar duplicados en el timestamp
      await new Promise(resolve => setTimeout(resolve, 10))
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

  // Revalidar todas las rutas de pedidos
  revalidateOrders(orderId)
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
  
  return { 
    success: true,
    warnings: errors.length > 0 ? errors : undefined
  }
}

// Mantener función legacy para compatibilidad (ahora llama a approveOrder)
export async function generateCutOrders(orderId: string) {
  return approveOrder(orderId)
}

// Actualizar estado del pedido basado en el estado de sus órdenes de corte
export async function updateOrderStatus(orderId: string) {
  const supabase = await createClient()

  // Obtener todas las órdenes de corte del pedido
  const { data: cutOrders, error } = await supabase
    .from('cut_orders')
    .select('status')
    .eq('order_id', orderId)

  if (error) throw error

  if (!cutOrders || cutOrders.length === 0) {
    // Si no hay órdenes de corte, el pedido debe estar en 'nuevo'
    return
  }

  const totalOrders = cutOrders.length
  const completedOrders = cutOrders.filter(co => co.status === 'completada').length
  const inProgressOrders = cutOrders.filter(co => co.status === 'en_proceso').length

  let newStatus = 'aprobado'

  if (completedOrders === totalOrders) {
    // Todas las órdenes completadas
    newStatus = 'finalizado'
  } else if (completedOrders > 0 || inProgressOrders > 0) {
    // Si hay alguna completada O en proceso, está en corte
    newStatus = 'en_corte'
  }

  // Actualizar estado del pedido
  await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')
}

/**
 * Marcar pedido como entregado
 * Consume el stock reservado de todas las órdenes completadas
 */
export async function markOrderAsDelivered(orderId: string) {
  const supabase = await createClient()

  // Verificar que todas las órdenes estén completadas
  const { data: cutOrders, error: cutOrdersError } = await supabase
    .from('cut_orders')
    .select('id, status, material_base_id')
    .eq('order_id', orderId)

  if (cutOrdersError) throw cutOrdersError

  const allCompleted = cutOrders?.every(co => co.status === 'completada')
  if (!allCompleted) {
    throw new Error('No se puede marcar como entregado: hay órdenes pendientes')
  }

  // Consumir stock reservado de cada orden
  for (const cutOrder of cutOrders || []) {
    if (cutOrder.material_base_id) {
      // Consumir stock: stock_reservado -1, stock_total -1
      const { error: stockError } = await supabase.rpc('consume_reserved_stock', {
        p_inventory_id: cutOrder.material_base_id
      })

      if (stockError) {
        console.error('Error consuming reserved stock:', stockError)
        // Continuar con las demás órdenes
      }
    }
  }

  // Actualizar estado del pedido
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'entregado' })
    .eq('id', orderId)

  if (updateError) throw updateError

  // Registrar en el log
  const { data: order } = await supabase
    .from('orders')
    .select('order_number')
    .eq('id', orderId)
    .single()

  if (order) {
    await supabase.from('order_activity_log').insert({
      order_id: orderId,
      activity_type: 'delivered',
      description: `Pedido ${order.order_number} marcado como entregado`,
      metadata: {
        cut_orders_count: cutOrders?.length || 0
      }
    })
  }

  // Revalidar todas las rutas relevantes
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/pedidos', 'page')
  revalidatePath('/admin/pedidos', 'layout')
  revalidatePath(`/admin/pedidos/${orderId}`, 'page')
  revalidatePath('/admin/stock', 'page')
  revalidatePath('/admin/stock', 'layout')
  revalidatePath('/planta/ordenes', 'page')
  revalidatePath('/planta/ordenes', 'layout')

  return { success: true }
}
