import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

interface RefEvo {
  codtipmov: string
  nromov: string
  a_b_c: string
  codter: string
}

interface PedidoNuevoPayload {
  id_evento: string
  tipo_evento: 'pedido_creado'
  id_pedido: string
  ref_evo: RefEvo
  fecha: string
  cliente: {
    nombre: string
    id_cliente: string
  }
  items: Array<{
    id_articulo: string
    cantidad: number
  }>
  estado?: 'nuevo' | 'pendiente'
}

export async function POST(request: NextRequest) {
  try {
    // TEMPORAL: Sin validación de headers para pruebas con EVO
    console.log('🔍 Pedidos Webhook Debug: MODO TEST - Sin validación de headers')

    // TEMPORAL: Comentar validación para pruebas
    // const headersList = await headers()
    // const webhookSecret = headersList.get('x-evo-webhook-secret')
    // if (webhookSecret !== process.env.EVO_WEBHOOK_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const payload: PedidoNuevoPayload = await request.json()
    const supabase = createAdminClient()

    // Validar estructura básica
    if (!payload.id_evento || !payload.id_pedido || !payload.ref_evo || !payload.items) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Validar ref_evo
    const { ref_evo } = payload
    if (!ref_evo.codtipmov || !ref_evo.nromov || !ref_evo.a_b_c || !ref_evo.codter) {
      return NextResponse.json(
        { error: 'Invalid ref_evo structure' },
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

    // Verificar si el pedido ya existe
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('evo_order_id', payload.id_pedido)
      .single()

    if (existingOrder) {
      return NextResponse.json({
        success: true,
        message: 'Order already exists',
        id_pedido: payload.id_pedido
      })
    }

    // Crear o obtener cliente
    let clientId: string
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('evo_client_id', payload.cliente.id_cliente)
      .single()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          evo_client_id: payload.cliente.id_cliente,
          business_name: payload.cliente.nombre,
          is_active: true
        })
        .select('id')
        .single()

      if (clientError || !newClient) {
        throw new Error('Error creating client')
      }
      clientId = newClient.id
    }

    // Mapear productos
    const productIds = new Map<string, string>()
    const errors: string[] = []

    for (const item of payload.items) {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('evo_product_id', item.id_articulo)
        .single()

      if (product) {
        productIds.set(item.id_articulo, product.id)
      } else {
        errors.push(`Product ${item.id_articulo} not found`)
      }
    }

    if (productIds.size === 0) {
      return NextResponse.json(
        { error: 'No valid products found', errors },
        { status: 400 }
      )
    }

    // Determinar estado inicial
    const initialStatus = payload.estado || 'pendiente'

    // Crear pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        evo_order_id: payload.id_pedido,
        order_number: payload.id_pedido,
        client_id: clientId,
        status: initialStatus,
        notes: `Pedido recibido desde EVO - ${ref_evo.codtipmov} ${ref_evo.nromov}`,
        evo_data: {
          ...payload,
          ref_evo,
          received_at: new Date().toISOString()
        },
        created_by: null,
        ref_evo: ref_evo
      })
      .select('id')
      .single()

    if (orderError || !order) {
      throw new Error('Error creating order')
    }

    // Crear líneas del pedido
    const orderLines = payload.items
      .filter(item => productIds.has(item.id_articulo))
      .map(item => ({
        order_id: order.id,
        product_id: productIds.get(item.id_articulo)!,
        quantity: item.cantidad,
        unit_price: 0,
        subtotal: 0
      }))

    const { error: linesError } = await supabase
      .from('order_lines')
      .insert(orderLines)

    if (linesError) {
      throw new Error('Error creating order lines')
    }

    // Crear órdenes de corte para productos que lo requieren
    for (const item of payload.items) {
      const productId = productIds.get(item.id_articulo)
      if (!productId) continue

      // Verificar si el producto requiere corte
      const { data: product } = await supabase
        .from('products')
        .select('category')
        .eq('id', productId)
        .single()

      const requiresCut = product?.category === 'chapa' || product?.category?.includes('chapa')

      if (requiresCut) {
        const cutNumber = `CUT-${payload.id_pedido}-${item.id_articulo}`
        
        const { data: cutOrder, error: cutError } = await supabase
          .from('cut_orders')
          .insert({
            order_id: order.id,
            cut_number: cutNumber,
            product_id: productId,
            quantity_requested: item.cantidad,
            status: 'generada',
            ref_evo: ref_evo
          })
          .select('id')
          .single()

        if (!cutError && cutOrder) {
          // Reservar stock
          await supabase
            .from('stock_reservations')
            .insert({
              product_id: productId,
              order_id: order.id,
              cut_order_id: cutOrder.id,
              quantity_reserved: item.cantidad,
              is_active: true
            })

          // Movimiento de stock
          await supabase
            .from('stock_movements')
            .insert({
              product_id: productId,
              movement_type: 'reserva',
              quantity: item.cantidad,
              reference_id: order.id,
              reference_type: 'order',
              notes: `Reserva automática para pedido ${payload.id_pedido}`
            })
        }
      } else {
        // Productos de preparación
        await supabase
          .from('preparation_items')
          .insert({
            order_id: order.id,
            product_id: productId,
            quantity_requested: item.cantidad,
            status: 'pendiente',
            ref_evo: ref_evo
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
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : null
      })

    return NextResponse.json({
      success: true,
      message: 'Order processed successfully',
      id_evento: payload.id_evento,
      id_pedido: payload.id_pedido,
      order_id: order.id,
      status: initialStatus,
      items_processed: productIds.size,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Pedido webhook error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
