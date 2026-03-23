import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

interface EvoWebhookPayload {
  event_type: 'order_created' | 'order_updated' | 'dispatch_created'
  order_id: string
  client_id: string
  order_number: string
  client_data: {
    business_name: string
    tax_id?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
  }
  order_lines: Array<{
    product_id: string
    product_code: string
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
  total_amount: number
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const webhookSecret = headersList.get('x-evo-webhook-secret')

    if (webhookSecret !== process.env.EVO_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload: EvoWebhookPayload = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    let clientId: string

    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('evo_client_id', payload.client_id)
      .single()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          evo_client_id: payload.client_id,
          business_name: payload.client_data.business_name,
          tax_id: payload.client_data.tax_id,
          contact_name: payload.client_data.contact_name,
          contact_phone: payload.client_data.contact_phone,
          contact_email: payload.client_data.contact_email,
        })
        .select('id')
        .single()

      if (clientError || !newClient) {
        throw new Error('Error creating client')
      }

      clientId = newClient.id
    }

    const productIds = new Map<string, string>()
    for (const line of payload.order_lines) {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('evo_product_id', line.product_id)
        .single()

      if (product) {
        productIds.set(line.product_id, product.id)
      } else {
        const { data: newProduct } = await supabase
          .from('products')
          .insert({
            evo_product_id: line.product_id,
            code: line.product_code,
            name: line.product_name,
          })
          .select('id')
          .single()

        if (newProduct) {
          productIds.set(line.product_id, newProduct.id)
        }
      }
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        evo_order_id: payload.order_id,
        order_number: payload.order_number,
        client_id: clientId,
        status: 'ingresado',
        total_amount: payload.total_amount,
        notes: payload.notes,
        evo_data: payload as any,
        created_by: user?.id,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      throw new Error('Error creating order')
    }

    const orderLines = payload.order_lines.map(line => ({
      order_id: order.id,
      product_id: productIds.get(line.product_id)!,
      quantity: line.quantity,
      unit_price: line.unit_price,
      subtotal: line.subtotal,
    }))

    const { error: linesError } = await supabase
      .from('order_lines')
      .insert(orderLines)

    if (linesError) {
      throw new Error('Error creating order lines')
    }

    for (const line of payload.order_lines) {
      const productId = productIds.get(line.product_id)!
      
      const cutNumber = `CUT-${payload.order_number}-${line.product_code}`
      
      const { data: cutOrder, error: cutError } = await supabase
        .from('cut_orders')
        .insert({
          order_id: order.id,
          cut_number: cutNumber,
          product_id: productId,
          quantity_requested: line.quantity,
          status: 'generada',
        })
        .select('id')
        .single()

      if (!cutError && cutOrder) {
        await supabase
          .from('stock_reservations')
          .insert({
            product_id: productId,
            order_id: order.id,
            cut_order_id: cutOrder.id,
            quantity_reserved: line.quantity,
            is_active: true,
          })

        await supabase
          .from('stock_movements')
          .insert({
            product_id: productId,
            movement_type: 'reserva',
            quantity: line.quantity,
            reference_id: order.id,
            reference_type: 'order',
            notes: `Reserva automática para pedido ${payload.order_number}`,
          })
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      message: 'Order processed successfully',
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
