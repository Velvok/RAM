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

    // Obtener versión actual del stock
    const { data: lastSync } = await supabase
      .from('stock_sync_log')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const currentVersion = lastSync?.version || 0

    // Solo procesar si la versión es superior
    if (payload.version <= currentVersion) {
      return NextResponse.json({
        success: true,
        message: 'Older version, ignoring',
        current_version: currentVersion,
        received_version: payload.version
      })
    }

    // Procesar actualizaciones de stock
    let updatedCount = 0
    const errors: string[] = []

    for (const item of payload.items) {
      try {
        // Normalizar ID de producto para buscar coincidencias
        const productId = item.id_articulo
        
        // Generar variaciones del ID
        const searchVariations = [
          productId,                                        // Original: A*B25110.2,5
          productId.replace('*', ''),                       // Sin asterisco: AB25110.2,5
          productId.replace(/[^A-Z0-9,]/g, ''),            // Solo alfanumérico y coma: AB251102,5
          productId.replace(',', '.'),                      // Coma por punto: A*B25110.2.5
          productId.replace('*', '').replace(',', '.'),    // Sin asterisco y coma por punto: AB25110.2.5
          productId.replace(/[^A-Z0-9]/g, ''),             // Solo alfanumérico: AB2511025
        ]

        console.log(`🔍 Searching for product: ${item.id_articulo}`)
        
        // Buscar con una sola consulta usando OR para todas las variaciones
        const { data: products } = await supabase
          .from('products')
          .select('id, code, name, evo_product_id')
          .or(searchVariations.map(v => `code.eq.${v},evo_product_id.eq.${v}`).join(','))
          .limit(1)

        let product = products && products.length > 0 ? products[0] : null

        // Si no existe el producto, crearlo automáticamente
        if (!product) {
          console.log(`📦 Creating new product: ${item.id_articulo}`)

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
            console.log(`❌ Error creating product ${item.id_articulo}`)
            continue
          }

          product = newProduct
          console.log(`✅ Created product ${item.id_articulo}`)
        } else {
          console.log(`✅ Found product ${item.id_articulo} as ${product.code}`)

          // Si viene un nombre en el payload y es diferente, actualizar el producto
          if (item.nombre && item.nombre !== product.name) {
            console.log(`📝 Updating product name: ${product.name} → ${item.nombre}`)
            const { error: updateNameError } = await supabase
              .from('products')
              .update({ name: item.nombre })
              .eq('id', product.id)

            if (updateNameError) {
              console.error(`❌ Error updating product name: ${updateNameError.message}`)
            } else {
              product.name = item.nombre
              console.log(`✅ Updated product name`)
            }
          }
        }

        // Actualizar stock en inventory
        const { error: updateError } = await supabase
          .from('inventory')
          .upsert({
            product_id: product.id,
            stock_total: item.cantidad,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'product_id'
          })

        if (updateError) {
          errors.push(`Error updating ${item.id_articulo}: ${updateError.message}`)
        } else {
          updatedCount++
        }

      } catch (error) {
        errors.push(`Error processing ${item.id_articulo}: ${error instanceof Error ? error.message : 'Unknown'}`)
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
        updated_count: updatedCount,
        errors_count: errors.length,
        errors: errors.length > 0 ? errors : null
      })

    return NextResponse.json({
      success: true,
      message: 'Stock updated successfully',
      id_evento: payload.id_evento,
      version: payload.version,
      updated_count: updatedCount,
      errors_count: errors.length,
      errors: errors.length > 0 ? errors : undefined
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
