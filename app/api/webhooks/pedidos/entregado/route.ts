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
  id_evento: string
  tipo_evento: 'pedido_entregado'
  id_pedido: string
  ref_evo: RefEvo
  remito?: {
    numero: string
    fecha: string
  }
  articulos?: Array<{
    id_articulo: string
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

    // Validar estructura básica
    if (!payload.id_evento || !payload.id_pedido || !payload.ref_evo) {
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
        await processPedidoEntregado(payload)
      } catch (error) {
        console.error('Error in after() processing:', error)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Delivery accepted for processing',
      id_evento: payload.id_evento,
      id_pedido: payload.id_pedido
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

async function processPedidoEntregado(payload: PedidoEntregadoPayload) {
  console.log('🔄 Processing pedido entregado:', payload.id_pedido)
  const supabase = createAdminClient()
  const errors: string[] = []

  try {
    // Verificar idempotencia
    const { data: existingEvent } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', payload.id_evento)
      .maybeSingle()

    if (existingEvent) {
      console.log('⏭️ Event already processed:', payload.id_evento)
      return
    }

    // Registrar evento inmediatamente
    await supabase
      .from('evo_events')
      .insert({
        id_evento: payload.id_evento,
        tipo_evento: payload.tipo_evento,
        payload: payload,
        processed_at: new Date().toISOString(),
        success: null,
        errors: null
      })

    console.log('🔍 Looking for order:', payload.id_pedido)

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
          product:products!cut_orders_product_id_fkey(evo_product_id, code, name)
        ),
        preparation_items(
          id,
          quantity_requested,
          quantity_prepared,
          status,
          product:products(evo_product_id, code, name)
        )
      `)
      .eq('evo_order_id', payload.id_pedido)
      .maybeSingle()

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError)
      errors.push('Order not found')
      await updateEventStatus(supabase, payload.id_evento, false, errors)
      return
    }

    console.log('✅ Order found:', order.id, 'status:', order.status)

    // Validar que el pedido esté en estado "finalizado"
    if (order.status !== 'finalizado') {
      console.log('❌ Order status is not finalizado:', order.status)
      errors.push(`Order must be in "finalizado" status to be delivered, current status: ${order.status}`)
      await updateEventStatus(supabase, payload.id_evento, false, errors)
      return
    }

    console.log('✅ Order status is finalizado, proceeding with delivery')

    // Validar artículos entregados vs artículos del pedido (si se proporcionan)
    if (payload.articulos && payload.articulos.length > 0) {
      const deliveredItems = new Map<string, number>()

      for (const articulo of payload.articulos) {
        deliveredItems.set(articulo.id_articulo, articulo.cantidad)
      }

      // Validar cantidades
      for (const line of order.order_lines || []) {
        const product = Array.isArray(line.product) ? line.product[0] : line.product
        if (!product || !product.evo_product_id) continue

        const deliveredQty = deliveredItems.get(product.evo_product_id) || 0
        const requestedQty = line.quantity

        if (deliveredQty !== requestedQty) {
          errors.push(`Quantity mismatch for ${product.code}: requested ${requestedQty}, delivered ${deliveredQty}`)
        }
      }

      if (errors.length > 0) {
        await updateEventStatus(supabase, payload.id_evento, false, errors)
        return
      }
    }

    // Actualizar estado del pedido a "entregado"
    console.log('🔄 Updating order status to entregado...')
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'entregado',
        delivered_at: new Date().toISOString(),
        evo_data: {
          delivery: {
            remito: payload.remito || null,
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
      await updateEventStatus(supabase, payload.id_evento, false, errors)
      return
    }

    console.log('✅ Order status updated successfully')

    // Crear registro de despacho (solo si hay remito)
    if (payload.remito) {
      const { error: dispatchError } = await supabase
        .from('dispatches')
        .insert({
          order_id: order.id,
          evo_dispatch_id: payload.remito.numero,
          dispatch_number: payload.remito.numero,
          dispatch_date: payload.remito.fecha,
          status: 'entregado',
          notes: `Despacho confirmado por EVO - Remito ${payload.remito.numero}`
        })

      if (dispatchError) {
        console.error('Error creating dispatch record:', dispatchError)
      }
    }

    // Liberar stock reservado (stock_total lo actualiza EVO vía stock_actualizado)
    // IMPORTANTE: NO modificamos stock_total aquí - EVO es la fuente de verdad
    // y enviará stock_actualizado en tiempo real con el valor correcto
    console.log('🔄 Processing stock reservation release...')
    const itemsToProcess = payload.articulos || (order.order_lines || []).map((line: any) => ({
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
              notes: `Salida por entrega${payload.remito ? ` - Remito ${payload.remito.numero}` : ''} - stock_total actualizado por EVO`
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

    console.log(`✅ Pedido ${payload.id_pedido} processed: ${errors.length} errors`)

    await updateEventStatus(
      supabase,
      payload.id_evento,
      errors.length === 0,
      errors.length > 0 ? errors : null,
      order.id
    )

  } catch (error) {
    console.error('❌ Error processing pedido entregado:', error)
    await updateEventStatus(
      supabase,
      payload.id_evento,
      false,
      [error instanceof Error ? error.message : 'Unknown error']
    )
  }
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
