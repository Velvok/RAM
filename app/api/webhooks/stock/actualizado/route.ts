import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createWebhookVerifier } from '@/lib/webhook-security'

interface StockActualizadoPayload {
  id_evento: string
  tipo_evento: 'stock_actualizado'
  version: number
  timestamp: string
  items: Array<{
    id_articulo: string
    nombre?: string
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

    console.log('✅ Webhook authentication successful')

    // Parsear el payload del body que ya leímos
    const payload: StockActualizadoPayload = JSON.parse(body)
    const supabase = createAdminClient()

    // Validar estructura básica
    if (!payload.id_evento || !payload.version || !payload.items) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Verificar idempotencia (rápido, indexado)
    const { data: existingEvent } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', payload.id_evento)
      .maybeSingle()

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        id_evento: payload.id_evento
      })
    }

    // Responder inmediatamente antes de procesar para evitar timeout de EVO
    // Procesar en background
    processStockUpdate(payload).catch(error => {
      console.error('Error processing stock update in background:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Stock update accepted for processing',
      id_evento: payload.id_evento,
      version: payload.version
    })

  } catch (error) {
    console.error('Stock webhook error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Función auxiliar para procesar en background
async function processStockUpdate(payload: StockActualizadoPayload) {
  const supabase = createAdminClient()

  try {
    // Obtener versión actual del stock
    const { data: lastSync } = await supabase
      .from('stock_sync_log')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentVersion = lastSync?.version || 0

    // Solo procesar si la versión es superior
    if (payload.version <= currentVersion) {
      console.log(`Skipping older version: ${payload.version} <= ${currentVersion}`)
      return
    }

    // Procesar actualizaciones de stock en batch (más eficiente)
    const productUpdates: Array<{ id: string; nombre?: string; cantidad: number }> = []
    const errors: string[] = []

    // Primero, buscar o crear todos los productos
    for (const item of payload.items) {
      const productId = item.id_articulo

      // Generar variaciones del ID
      const searchVariations = [
        productId,
        productId.replace('*', ''),
        productId.replace(/[^A-Z0-9,]/g, ''),
        productId.replace(',', '.'),
        productId.replace('*', '').replace(',', '.'),
        productId.replace(/[^A-Z0-9]/g, ''),
      ]

      const { data: products } = await supabase
        .from('products')
        .select('id, code, name, evo_product_id')
        .or(searchVariations.map(v => `code.eq.${v},evo_product_id.eq.${v}`).join(','))
        .limit(1)

      let product = products && products.length > 0 ? products[0] : null

      // Si no existe el producto, crearlo
      if (!product) {
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            code: productId,
            evo_product_id: productId,
            name: item.nombre || `Producto ${productId}`,
            category: 'chapa',
            unit: 'kg',
            is_active: true
          })
          .select('id, code, name, evo_product_id')
          .single()

        if (createError || !newProduct) {
          errors.push(`Error creating product ${item.id_articulo}: ${createError?.message || 'Unknown'}`)
          continue
        }

        product = newProduct
      } else if (item.nombre && item.nombre !== product.name) {
        // Actualizar nombre si es diferente
        await supabase
          .from('products')
          .update({ name: item.nombre })
          .eq('id', product.id)
      }

      productUpdates.push({
        id: product.id,
        cantidad: item.cantidad
      })
    }

    // Actualizar stock en batch (más eficiente)
    for (const update of productUpdates) {
      const { error: updateError } = await supabase
        .from('inventory')
        .upsert({
          product_id: update.id,
          stock_total: update.cantidad,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'product_id'
        })

      if (updateError) {
        errors.push(`Error updating product ${update.id}: ${updateError.message}`)
      }
    }

    // Registrar evento procesado
    await supabase
      .from('evo_events')
      .insert({
        id_evento: payload.id_evento,
        tipo_evento: payload.tipo_evento,
        version: payload.version,
        payload: payload,
        processed_at: new Date().toISOString(),
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : null
      })

    // Registrar sincronización
    await supabase
      .from('stock_sync_log')
      .insert({
        version: payload.version,
        timestamp: payload.timestamp,
        items_count: payload.items.length,
        updated_count: productUpdates.length,
        errors_count: errors.length,
        errors: errors.length > 0 ? errors : null
      })

    console.log(`✅ Stock update processed: ${productUpdates.length} items, ${errors.length} errors`)

  } catch (error) {
    console.error('Error in background stock processing:', error)
  }
}
