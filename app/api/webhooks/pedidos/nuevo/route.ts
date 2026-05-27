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
    nro_item?: number
  }>
  estado?: 'nuevo' | 'pendiente'
}

// Función para parsear formato PHP array (print_r)
function parsePhpArrayFormat(text: string): PedidoNuevoPayload {
  const result: Record<string, any> = {}
  const lines = text.split('\n')
  const stack: Array<{ obj: Record<string, any>, key: string | null }> = [{ obj: result, key: null }]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line === 'Array' || line === '(' || line === ')') {
      if (line === 'Array') {
        // Nueva array
        const current = stack[stack.length - 1]
        if (current.key !== null) {
          const newArray: any[] = []
          current.obj[current.key] = newArray
          stack.push({ obj: newArray, key: null })
        }
      } else if (line === ')') {
        // Cerrar array
        stack.pop()
      }
      continue
    }

    // Parsear líneas tipo [key] => value
    const match = line.match(/^\[([^\]]+)\]\s*=>\s*(.*)$/)
    if (match) {
      const key = match[1]
      const value = match[2].trim()

      const current = stack[stack.length - 1]

      if (value === 'Array') {
        // El valor es un array, se procesará en la siguiente línea
        stack.push({ obj: current.obj, key })
      } else {
        // Valor simple
        // Convertir a número si es posible
        const numValue = parseFloat(value)
        current.obj[key] = !isNaN(numValue) && value === numValue.toString() ? numValue : value
      }
    }
  }

  return result as PedidoNuevoPayload
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const body = await request.text()
    const contentType = headersList.get('content-type') || ''

    console.log('📥 Webhook recibido, Content-Type:', contentType)
    console.log('📥 Body recibido:', body.substring(0, 500))

    // Configuración de seguridad
    const webhookSecret = process.env.EVO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('❌ EVO_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const verifyWebhook = createWebhookVerifier({
      secret: webhookSecret,
      enableHmac: false,
      enableBearerToken: true
    })

    const verification = await verifyWebhook(headersList, body)

    if (!verification.valid) {
      console.error('❌ Webhook authentication failed:', verification.error)
      return NextResponse.json(
        { error: 'Unauthorized', details: verification.error },
        { status: 401 }
      )
    }

    console.log('✅ Pedidos webhook authentication successful')

    // Intentar parsear el payload: JSON o PHP array format
    let payload: PedidoNuevoPayload

    if (contentType.includes('application/json')) {
      payload = JSON.parse(body)
    } else {
      // Intentar parsear como PHP array format (print_r)
      try {
        payload = parsePhpArrayFormat(body)
      } catch (e) {
        console.error('❌ Error parseando PHP array format:', e)
        // Si falla, intentar como JSON por defecto
        try {
          payload = JSON.parse(body)
        } catch (jsonError) {
          console.error('❌ Error parseando JSON:', jsonError)
          return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
        }
      }
    }

    console.log('📦 Payload parseado:', JSON.stringify(payload, null, 2))

    const supabase = createAdminClient()

    // Validación
    if (!payload.id_evento || !payload.id_pedido || !payload.ref_evo || !payload.items) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 })
    }

    const { ref_evo } = payload
    if (!ref_evo.codtipmov || !ref_evo.nromov || !ref_evo.a_b_c || !ref_evo.codter) {
      return NextResponse.json({ error: 'Invalid ref_evo structure' }, { status: 400 })
    }

    // Idempotencia
    const { data: existingEvent } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', payload.id_evento)
      .maybeSingle()

    if (existingEvent) {
      console.log(`⏭️ Event ${payload.id_evento} already processed`)
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        id_evento: payload.id_evento
      })
    }

    // Registrar evento inmediatamente
    const { error: insertEventError } = await supabase
      .from('evo_events')
      .insert({
        id_evento: payload.id_evento,
        tipo_evento: payload.tipo_evento,
        payload: payload,
        processed_at: new Date().toISOString(),
        success: null,
        errors: null
      })

    if (insertEventError) {
      console.error('❌ Error inserting evo_event:', insertEventError)
      return NextResponse.json(
        { error: 'Error registering event', details: insertEventError.message },
        { status: 500 }
      )
    }

    console.log(`📥 Event ${payload.id_evento} registered for order ${payload.id_pedido}`)

    // Procesar en background con after()
    after(async () => {
      try {
        await processPedidoNuevo(payload)
      } catch (error) {
        console.error('Error in after() processing:', error)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pedido accepted for processing',
      id_evento: payload.id_evento,
      id_pedido: payload.id_pedido
    })

  } catch (error) {
    console.error('Pedido webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processPedidoNuevo(payload: PedidoNuevoPayload) {
  console.log(`🔄 Processing pedido ${payload.id_pedido}...`)
  const supabase = createAdminClient()
  const errors: string[] = []
  const { ref_evo } = payload

  try {
    // Verificar si el pedido ya existe → MODIFICACIÓN DE PEDIDO
    // RAM envía modificaciones con el mismo id_pedido. Hacemos rollback completo
    // del pedido viejo (devolver stock, eliminar cuts/prep/lines) y creamos uno nuevo.
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, status')
      .eq('evo_order_id', payload.id_pedido)
      .maybeSingle()

    if (existingOrder) {
      console.log(`🔄 Order ${payload.id_pedido} already exists (status: ${existingOrder.status}). Rolling back to recreate as new...`)

      const { data: rollbackResult, error: rollbackError } = await supabase
        .rpc('rollback_order', { p_order_id: existingOrder.id })

      if (rollbackError) {
        throw new Error(`Error rolling back existing order: ${rollbackError.message}`)
      }

      console.log(`✅ Rollback complete:`, rollbackResult)
    }

    // Crear o obtener cliente
    let clientId: string

    // Si EVO envía datos del cliente, usarlos
    if (payload.cliente.id_cliente) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('evo_client_id', payload.cliente.id_cliente)
        .maybeSingle()

      if (existingClient) {
        clientId = existingClient.id
        console.log(`✅ Found existing client by evo_client_id: ${clientId}`)
      } else {
        const clientName = payload.cliente.nombre || `Cliente ${ref_evo.codter}`
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            evo_client_id: payload.cliente.id_cliente,
            business_name: clientName,
            is_active: true
          })
          .select('id')
          .single()

        if (clientError || !newClient) {
          throw new Error(`Error creating client: ${clientError?.message}`)
        }
        clientId = newClient.id
        console.log(`➕ Created new client: ${clientId}`)
      }
    } else {
      // Si EVO no envía datos del cliente, usar el código de tercero
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('evo_client_id', ref_evo.codter)
        .maybeSingle()

      if (existingClient) {
        clientId = existingClient.id
        console.log(`✅ Found existing client by codter: ${clientId}`)
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            evo_client_id: ref_evo.codter,
            business_name: `Cliente ${ref_evo.codter}`,
            is_active: true
          })
          .select('id')
          .single()

        if (clientError || !newClient) {
          throw new Error(`Error creating client: ${clientError?.message}`)
        }
        clientId = newClient.id
        console.log(`➕ Created new client from codter: ${clientId}`)
      }
    }

    // Mapear productos en bulk
    const allEvoIds = payload.items.map(i => i.id_articulo)
    console.log(`🔍 Fetching ${allEvoIds.length} products...`)

    const productIds = new Map<string, { id: string; category: string | null }>()

    const FETCH_BATCH = 200
    for (let i = 0; i < allEvoIds.length; i += FETCH_BATCH) {
      const batch = allEvoIds.slice(i, i + FETCH_BATCH)
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, evo_product_id, category')
        .in('evo_product_id', batch)

      if (fetchError) {
        throw new Error(`Error fetching products: ${fetchError.message}`)
      }

      for (const p of products || []) {
        if (p.evo_product_id) {
          productIds.set(p.evo_product_id, { id: p.id, category: p.category })
        }
      }
    }

    // Productos no encontrados
    for (const item of payload.items) {
      if (!productIds.has(item.id_articulo)) {
        errors.push(`Product ${item.id_articulo} not found`)
      }
    }
    console.log(`   Found ${productIds.size}/${allEvoIds.length} products`)

    if (productIds.size === 0) {
      await updateEventStatus(supabase, payload.id_evento, false, ['No valid products found', ...errors])
      return
    }

    // Crear pedido siempre con status 'nuevo'
    // Las cut_orders se crean solo al aprobar el pedido
    const initialStatus = 'nuevo'
    console.log(`➕ Creating order with status ${initialStatus}...`)

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
      throw new Error(`Error creating order: ${orderError?.message}`)
    }
    console.log(`✅ Order created: ${order.id}`)

    // Crear líneas del pedido en bulk
    const orderLines = payload.items
      .filter(item => productIds.has(item.id_articulo))
      .map(item => ({
        order_id: order.id,
        product_id: productIds.get(item.id_articulo)!.id,
        quantity: item.cantidad,
        unit_price: 0,
        subtotal: 0,
        evo_item_number: item.nro_item != null ? String(item.nro_item) : null
      }))

    if (orderLines.length > 0) {
      const { error: linesError } = await supabase
        .from('order_lines')
        .insert(orderLines)

      if (linesError) {
        throw new Error(`Error creating order lines: ${linesError.message}`)
      }
      console.log(`✅ Created ${orderLines.length} order lines`)
    }

    // NOTA: Las cut_orders se crean solo cuando se acepta el pedido, no al recibirlo
    // Crear preparation_items en bulk (para accesorios)
    const preparationItems: any[] = []

    for (const item of payload.items) {
      const product = productIds.get(item.id_articulo)
      if (!product) continue

      const requiresPreparation = product.category === 'accesorios' || (product.category?.includes('accesorio') ?? false)

      if (requiresPreparation) {
        preparationItems.push({
          order_id: order.id,
          product_id: product.id,
          quantity_requested: item.cantidad,
          status: 'pendiente',
          ref_evo: ref_evo
        })
      }
    }

    if (preparationItems.length > 0) {
      const { error: prepError } = await supabase
        .from('preparation_items')
        .insert(preparationItems)

      if (prepError) {
        console.error('Error creating preparation_items:', prepError)
        errors.push(`Error creating preparation_items: ${prepError.message}`)
      } else {
        console.log(`✅ Created ${preparationItems.length} preparation_items`)
      }
    }

    console.log(`\n✅ Pedido ${payload.id_pedido} processed: ${errors.length} errors`)

    await updateEventStatus(
      supabase,
      payload.id_evento,
      errors.length === 0,
      errors.length > 0 ? errors : null,
      order.id
    )

  } catch (error) {
    console.error('❌ Error processing pedido:', error)
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
