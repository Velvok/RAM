import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createWebhookVerifier } from '@/lib/webhook-security'

interface PedidoEntregadoPayload {
  id_evento: string
  tipo_evento: 'pedido_entregado'
  id_pedido: string
  remito: {
    numero: string
    fecha: string
  }
  articulos: Array<{
    id_articulo: string
    cantidad: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const body = await request.text()
    
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
    const supabase = createAdminClient()

    // Validar estructura básica
    if (!payload.id_evento || !payload.id_pedido || !payload.remito || !payload.articulos) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Verificar idempotencia
    const { data: existingEvent } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', payload.id_evento)
      .single()

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        id_evento: payload.id_evento
      })
    }

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
        cut_orders(
          id,
          status,
          quantity_requested,
          quantity_cut,
          product:products(evo_product_id, code, name)
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
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Validar que el pedido esté en estado "preparado"
    if (order.status !== 'preparado') {
      return NextResponse.json(
        { error: 'Order must be in "preparado" status to be delivered' },
        { status: 400 }
      )
    }

    // Validar artículos entregados vs artículos del pedido
    const errors: string[] = []
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
      return NextResponse.json(
        { error: 'Validation errors', errors },
        { status: 400 }
      )
    }

    // Actualizar estado del pedido a "entregado"
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'entregado',
        delivered_at: new Date().toISOString(),
        evo_data: {
          delivery: {
            remito: payload.remito,
            delivered_at: new Date().toISOString(),
            articulos: payload.articulos
          }
        }
      })
      .eq('id', order.id)

    if (updateError) {
      throw new Error('Error updating order status')
    }

    // Crear registro de despacho
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

    // Liberar reservas de stock
    await supabase
      .from('stock_reservations')
      .update({ is_active: false })
      .eq('order_id', order.id)
      .eq('is_active', true)

    // Crear movimientos de stock de salida
    for (const articulo of payload.articulos) {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('evo_product_id', articulo.id_articulo)
        .single()

      if (product) {
        await supabase
          .from('stock_movements')
          .insert({
            product_id: product.id,
            movement_type: 'salida',
            quantity: articulo.cantidad,
            reference_id: order.id,
            reference_type: 'order',
            notes: `Salida por entrega - Remito ${payload.remito.numero}`
          })
      }
    }

    // Registrar evento procesado
    await supabase
      .from('evo_events')
      .insert({
        id_evento: payload.id_evento,
        tipo_evento: payload.tipo_evento,
        payload: payload,
        processed_at: new Date().toISOString(),
        success: true,
        order_id: order.id
      })

    return NextResponse.json({
      success: true,
      message: 'Order marked as delivered successfully',
      id_evento: payload.id_evento,
      id_pedido: payload.id_pedido,
      order_id: order.id,
      remito: payload.remito.numero,
      articulos_entregados: payload.articulos.length
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
