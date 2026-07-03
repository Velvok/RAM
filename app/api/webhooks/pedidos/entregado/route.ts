import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createWebhookVerifier } from '@/lib/webhook-security'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface RefEvo {
  codtipmov: string
  nromov: string
  a_b_c: string
  codter: string
}

interface PedidoEntregadoPayload {
  tipo_evento: 'pedido_entregado'
  ref_evo: RefEvo
  fecha: string
  estado: string
  articulos?: Array<{
    codart: string
    item: number
    cantidad: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const body = await request.text()

    console.log('📥 Entregas webhook received')
    console.log('📥 Body:', body.substring(0, 500))

    // Configuración de seguridad
    const webhookSecret = process.env.EVO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('❌ EVO_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Verificar autenticación (solo Bearer token para facilitar integración con EVO)
    const verifyWebhook = createWebhookVerifier({
      secret: webhookSecret,
      enableHmac: false,  // Desactivar HMAC temporalmente
      enableBearerToken: true
    })

    const verification = await verifyWebhook(headersList, body)

    if (!verification.valid) {
      console.error('❌ Webhook authentication failed:', verification.error)
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: verification.error
        },
        { status: 401 }
      )
    }

    console.log('✅ Entregas webhook authentication successful')

    // Parsear el payload del body que ya leímos
    const payload: PedidoEntregadoPayload = JSON.parse(body)
    console.log('📦 Payload:', JSON.stringify(payload, null, 2))

    // Generar id_evento único para idempotencia (ya no viene en el payload)
    const id_evento = `pedido_entregado_${payload.ref_evo.nromov}_${payload.fecha}_${Date.now()}`

    // Validar estructura básica
    if (!payload.ref_evo || !payload.ref_evo.nromov) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    const { ref_evo } = payload
    if (!ref_evo.codtipmov || !ref_evo.nromov || !ref_evo.a_b_c || !ref_evo.codter) {
      return NextResponse.json(
        { error: 'Invalid ref_evo structure' },
        { status: 400 }
      )
    }

    // Procesar en background con after()
    after(async () => {
      try {
        await processPedidoEntregado(payload, id_evento)
      } catch (error) {
        console.error('Error in after() processing:', error)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Delivery accepted for processing',
      id_evento: id_evento,
      id_pedido: payload.ref_evo.nromov
    })

  } catch (error) {
    console.error('Delivery webhook error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function processPedidoEntregado(payload: PedidoEntregadoPayload, id_evento: string) {
  console.log('🔄 Processing pedido entregado:', payload.ref_evo.nromov)
  const supabase = createAdminClient()
  const errors: string[] = []

  try {
    // Verificar idempotencia
    const { data: existingEvent } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', id_evento)
      .maybeSingle()

    if (existingEvent) {
      console.log('⏭️ Event already processed:', id_evento)
      return
    }

    // Registrar evento inmediatamente
    await supabase
      .from('evo_events')
      .insert({
        id_evento: id_evento,
        tipo_evento: payload.tipo_evento,
        payload: payload,
        processed_at: new Date().toISOString(),
        success: null,
        errors: null
      })

    console.log('🔍 Looking for order:', payload.ref_evo.nromov)

    // Buscar el pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        client_id,
        ref_evo,
        order_lines(
          id,
          quantity,
          product:products(evo_product_id, code, name)
        ),
        cut_orders!cut_orders_order_id_fkey(
          id,
          status,
          quantity_requested,
          quantity_cut,
          quantity_delivered,
          assigned_inventory_id,
          product:products!cut_orders_product_id_fkey(evo_product_id, code, name)
        ),
        preparation_items(
          id,
          quantity_requested,
          quantity_prepared,
          quantity_delivered,
          assigned_inventory_id,
          status,
          product:products(evo_product_id, code, name)
        )
      `)
      .eq('evo_order_id', payload.ref_evo.nromov)
      .maybeSingle()

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError)
      errors.push('Order not found')
      await updateEventStatus(supabase, id_evento, false, errors)
      return
    }

    console.log('✅ Order found:', order.id, 'status:', order.status)

    // Validar que el pedido esté en estado "en_corte" o "finalizado"
    if (order.status !== 'en_corte' && order.status !== 'finalizado') {
      console.log('❌ Order status is not en_corte or finalizado:', order.status)
      errors.push(`Order must be in "en_corte" or "finalizado" status to be delivered, current status: ${order.status}`)
      await updateEventStatus(supabase, id_evento, false, errors)
      return
    }

    console.log('✅ Order status is valid, proceeding with delivery')

    // Determinar si es entrega completa o parcial
    let isCompleteDelivery = true
    let isPartialDelivery = false

    if (payload.articulos && payload.articulos.length > 0) {
      const deliveredItems = new Map<string, number>()

      for (const articulo of payload.articulos) {
        deliveredItems.set(articulo.codart, articulo.cantidad)
      }

      // Verificar si es entrega completa o parcial
      for (const line of order.order_lines || []) {
        const product = Array.isArray(line.product) ? line.product[0] : line.product
        if (!product || !product.evo_product_id) continue

        const deliveredQty = deliveredItems.get(product.evo_product_id) || 0
        const requestedQty = line.quantity

        if (deliveredQty !== requestedQty) {
          isCompleteDelivery = false
          if (deliveredQty > 0) {
            isPartialDelivery = true
          }
        }
      }

      console.log(`📦 Delivery type: ${isCompleteDelivery ? 'COMPLETA' : (isPartialDelivery ? 'PARCIAL' : 'SIN ARTÍCULOS')}`)
    } else {
      // Si no se proporcionan artículos, asumimos entrega completa
      console.log('📦 No articles provided, assuming complete delivery')
    }

    // Si es entrega parcial, procesar con lógica de retirada parcial
    if (isPartialDelivery) {
      console.log('🔄 Processing partial delivery...')
      const articlesForPartial = payload.articulos?.map(a => ({ id_articulo: a.codart, cantidad: a.cantidad })) || []
      await processPartialDelivery(supabase, order, articlesForPartial, payload, errors)
      await updateEventStatus(supabase, id_evento, errors.length === 0, errors.length > 0 ? errors : null, order.id)
      return
    }

    // Si es entrega completa, continuar con la lógica actual
    console.log('🔄 Processing complete delivery...')

    // Actualizar estado del pedido a "entregado"
    console.log('🔄 Updating order status to entregado...')
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'entregado',
        delivered_at: new Date().toISOString(),
        evo_data: {
          delivery: {
            delivered_at: new Date().toISOString(),
            articulos: payload.articulos || null,
            ref_evo: payload.ref_evo
          }
        }
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('❌ Error updating order status:', updateError)
      errors.push(`Error updating order status: ${updateError.message}`)
      await updateEventStatus(supabase, id_evento, false, errors)
      return
    }

    console.log('✅ Order status updated successfully')

    // Liberar stock reservado (stock_total lo actualiza EVO vía stock_actualizado)
    // IMPORTANTE: NO modificamos stock_total aquí - EVO es la fuente de verdad
    // y enviará stock_actualizado en tiempo real con el valor correcto
    console.log('🔄 Processing stock reservation release...')
    const itemsToProcess = payload.articulos?.map(a => ({ id_articulo: a.codart, cantidad: a.cantidad })) || 
      (order.order_lines || []).map((line: any) => ({
        id_articulo: Array.isArray(line.product) ? line.product[0]?.evo_product_id : line.product?.evo_product_id,
        cantidad: line.quantity
      }))

    console.log('📦 Items to process:', itemsToProcess.length)

    for (const articulo of itemsToProcess) {
      if (!articulo.id_articulo) continue

      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('evo_product_id', articulo.id_articulo)
        .maybeSingle()

      if (product) {
        // Liberar stock reservado (stock_total lo actualiza EVO vía stock_actualizado)
        const { data: inventory } = await supabase
          .from('inventory')
          .select('id, stock_total, stock_reservado, product:products(code)')
          .eq('product_id', product.id)
          .maybeSingle()

        if (inventory) {
          const newReservado = Math.max(0, (inventory.stock_reservado || 0) - articulo.cantidad)
          const productCode = (inventory.product as any)?.code || 'Unknown'

          await supabase
            .from('inventory')
            .update({
              stock_reservado: newReservado
              // NO tocar stock_total - EVO lo actualizará vía stock_actualizado
            })
            .eq('id', inventory.id)

          // Validar consistencia
          if (newReservado > inventory.stock_total) {
            console.error(`⚠️ INCONSISTENCIA DETECTADA: ${productCode}`)
            console.error(`   stock_reservado (${newReservado}) > stock_total (${inventory.stock_total})`)
            console.error(`   Esto indica un problema en la sincronización o reservas duplicadas`)
          }

          // Log detallado
          console.log(`📦 Entrega procesada: ${productCode}`)
          console.log(`   Cantidad entregada: ${articulo.cantidad}`)
          console.log(`   stock_reservado: ${inventory.stock_reservado} → ${newReservado}`)
          console.log(`   stock_total: ${inventory.stock_total} (sin cambios - EVO lo actualizará)`)

          // Crear movimiento de stock de salida (solo para auditoría)
          await supabase
            .from('stock_movements')
            .insert({
              product_id: product.id,
              movement_type: 'salida',
              quantity: articulo.cantidad,
              reference_id: order.id,
              reference_type: 'order',
              notes: `Salida por entrega - stock_total actualizado por EVO`
            })
        }
      }
    }

    console.log('✅ Stock reservation release completed')

    // Marcar reservas de stock como inactivas
    console.log('🔄 Marking stock reservations as inactive...')
    await supabase
      .from('stock_reservations')
      .update({ is_active: false })
      .eq('order_id', order.id)
      .eq('is_active', true)

    console.log('✅ Stock reservations marked as inactive')

    console.log(`✅ Pedido ${payload.ref_evo.nromov} processed: ${errors.length} errors`)

    await updateEventStatus(
      supabase,
      id_evento,
      errors.length === 0,
      errors.length > 0 ? errors : null,
      order.id
    )

  } catch (error) {
    console.error('❌ Error processing pedido entregado:', error)
    await updateEventStatus(
      supabase,
      id_evento,
      false,
      [error instanceof Error ? error.message : 'Unknown error']
    )
  }
}

/**
 * Procesa una entrega parcial de un pedido.
 * Actualiza quantity_delivered y consume stock reservado.
 */
async function processPartialDelivery(
  supabase: ReturnType<typeof createAdminClient>,
  order: any,
  deliveredArticles: Array<{ id_articulo: string; cantidad: number }>,
  payload: any,
  errors: string[]
) {
  console.log(`🔄 Processing partial delivery for order ${order.id}`)

  // Crear mapa de artículos entregados
  const deliveredItems = new Map<string, number>()
  for (const articulo of deliveredArticles) {
    deliveredItems.set(articulo.id_articulo, articulo.cantidad)
  }

  // Procesar cada artículo entregado
  for (const [idArticulo, cantidadEntregada] of deliveredItems) {
    console.log(`\n📦 Processing article: ${idArticulo} x ${cantidadEntregada}`)

    try {
      // Buscar el producto
      const { data: product } = await supabase
        .from('products')
        .select('id, code, name')
        .eq('evo_product_id', idArticulo)
        .maybeSingle()

      if (!product) {
        errors.push(`Product not found: ${idArticulo}`)
        console.error(`❌ Product not found: ${idArticulo}`)
        continue
      }

      console.log(`   Found product: ${product.code} - ${product.name}`)

      // Buscar cut_orders con unidades cortadas de este pedido y producto
      const { data: cutOrders } = await supabase
        .from('cut_orders')
        .select('id, quantity_cut, quantity_delivered, assigned_inventory_id, status')
        .eq('order_id', order.id)
        .eq('product_id', product.id)
        .gt('quantity_cut', 0)
        .order('created_at', { ascending: true })

      // Buscar preparation_items con unidades preparadas
      const { data: prepItems } = await supabase
        .from('preparation_items')
        .select('id, quantity_prepared, quantity_delivered, assigned_inventory_id, status')
        .eq('order_id', order.id)
        .eq('product_id', product.id)
        .gt('quantity_prepared', 0)
        .order('created_at', { ascending: true })

      console.log(`   Found ${cutOrders?.length || 0} cut_orders, ${prepItems?.length || 0} preparation_items`)

      // Marcar como entregadas las unidades
      let remainingToDeliver = cantidadEntregada

      // Primero procesar cut_orders
      if (cutOrders && cutOrders.length > 0) {
        for (const co of cutOrders) {
          if (remainingToDeliver <= 0) break

          const available = (co.quantity_cut || 0) - (co.quantity_delivered || 0)
          if (available <= 0) continue

          const toDeliver = Math.min(available, remainingToDeliver)
          const newDelivered = (co.quantity_delivered || 0) + toDeliver

          const { error: updateError } = await supabase
            .from('cut_orders')
            .update({ quantity_delivered: newDelivered })
            .eq('id', co.id)

          if (updateError) {
            errors.push(`Error updating cut_order ${co.id}: ${updateError.message}`)
          } else {
            console.log(`   ✅ Cut order ${co.id}: delivered ${toDeliver} (${newDelivered}/${co.quantity_cut})`)
            remainingToDeliver -= toDeliver

            // Consumir stock reservado
            if (co.assigned_inventory_id) {
              for (let i = 0; i < toDeliver; i++) {
                const { error: consumeError } = await supabase.rpc('consume_reserved_stock', {
                  p_inventory_id: co.assigned_inventory_id
                })
                if (consumeError) {
                  console.error(`   ❌ Error consuming stock: ${consumeError.message}`)
                  errors.push(`Error consuming stock for cut_order ${co.id}: ${consumeError.message}`)
                } else {
                  console.log(`   📦 Stock consumed for unit ${i + 1}/${toDeliver}`)
                }
              }
            }
          }
        }
      }

      // Luego procesar preparation_items
      if (prepItems && prepItems.length > 0 && remainingToDeliver > 0) {
        for (const pi of prepItems) {
          if (remainingToDeliver <= 0) break

          const available = (pi.quantity_prepared || 0) - (pi.quantity_delivered || 0)
          if (available <= 0) continue

          const toDeliver = Math.min(available, remainingToDeliver)
          const newDelivered = (pi.quantity_delivered || 0) + toDeliver

          const { error: updateError } = await supabase
            .from('preparation_items')
            .update({ quantity_delivered: newDelivered })
            .eq('id', pi.id)

          if (updateError) {
            errors.push(`Error updating preparation_item ${pi.id}: ${updateError.message}`)
          } else {
            console.log(`   ✅ Prep item ${pi.id}: delivered ${toDeliver} (${newDelivered}/${pi.quantity_prepared})`)
            remainingToDeliver -= toDeliver

            // Consumir stock reservado
            if (pi.assigned_inventory_id) {
              for (let i = 0; i < toDeliver; i++) {
                const { error: consumeError } = await supabase.rpc('consume_reserved_stock', {
                  p_inventory_id: pi.assigned_inventory_id
                })
                if (consumeError) {
                  console.error(`   ❌ Error consuming stock: ${consumeError.message}`)
                  errors.push(`Error consuming stock for preparation_item ${pi.id}: ${consumeError.message}`)
                } else {
                  console.log(`   📦 Stock consumed for unit ${i + 1}/${toDeliver}`)
                }
              }
            }
          }
        }
      }

      // Advertir si no se pudo entregar todo
      if (remainingToDeliver > 0) {
        const warning = `⚠️ Could not deliver ${remainingToDeliver} units of ${idArticulo} - not enough prepared items`
        console.warn(warning)
        errors.push(warning)
      }

    } catch (error) {
      const errorMsg = `Error processing article ${idArticulo}: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(`❌ ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  // Registrar actividad en el historial
  const totalDelivered = payload.articulos.reduce((sum: number, art: any) => sum + art.cantidad, 0)
  await logPartialDeliveryActivity(supabase, order.id, payload.articulos, totalDelivered)

  // Actualizar estado del pedido si es necesario (no cambiar a 'entregado' en parcial)
  // Mantener 'finalizado' o cambiar a 'parcialmente_entregado' si tiene sentido
  console.log(`✅ Partial delivery processed with ${errors.length} errors`)
}

async function updateEventStatus(
  supabase: ReturnType<typeof createAdminClient>,
  idEvento: string,
  success: boolean,
  errors: string[] | null,
  orderId?: string
) {
  try {
    const update: any = {
      success,
      errors,
      processed_at: new Date().toISOString()
    }
    if (orderId) update.order_id = orderId

    await supabase
      .from('evo_events')
      .update(update)
      .eq('id_evento', idEvento)
  } catch (error) {
    console.error('Failed to update event status:', error)
  }
}

async function logPartialDeliveryActivity(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  articles: any[],
  totalDelivered: number
) {
  try {
    const itemsDelivered = articles.map(art => ({
      product_code: art.codart,
      quantity: art.cantidad
    }))

    await supabase
      .from('order_activity_log')
      .insert({
        order_id: orderId,
        activity_type: 'partial_delivery',
        description: `Retirada parcial desde EVO: ${totalDelivered} unidades entregadas`,
        metadata: {
          action: 'partial_delivery_from_evo',
          items_delivered: itemsDelivered,
          total_delivered: totalDelivered,
          source: 'evo_webhook'
        }
      })

    console.log('✅ Activity logged for partial delivery')
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
