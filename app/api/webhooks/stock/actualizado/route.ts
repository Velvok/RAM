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
        let productId = item.id_articulo
        
        // Intentar múltiples variaciones del ID (priorizar formato exacto)
        const searchVariations = [
          productId,                           // Original: AC25110.0,5 (formato correcto)
          productId.replace('*', ''),          // Sin asterisco: AC25110.0,5
          productId.replace(/[^A-Z0-9,]/g, ''), // Solo alfanumérico y coma: AC25110.0,5
          productId.replace(',', '.'),         // Coma por punto: AC25110.0.5
          productId.replace('*', '').replace(',', '.'), // Sin asterisco y coma por punto: AC25110.0.5
          productId.replace(/[^A-Z0-9]/g, ''), // Solo alfanumérico: AC2511005
        ]

        let product = null
        
        // Buscar primero por code (ya que evo_product_id es null)
        console.log(`🔍 Searching for product: ${item.id_articulo}`)
        console.log(`🔍 Variations to try: ${searchVariations.join(', ')}`)
        
        for (const variation of searchVariations) {
          console.log(`🔍 Trying variation: "${variation}"`)
          const { data: foundProduct, error: searchError } = await supabase
            .from('products')
            .select('id, code, name')
            .eq('code', variation)
            .single()
          
          console.log(`🔍 Search result for "${variation}":`, { foundProduct, searchError })
          
          if (foundProduct) {
            product = foundProduct
            console.log(`✅ Found product ${item.id_articulo} by code as ${variation}`)
            break
          }
        }

        // Si no se encuentra por code, buscar por evo_product_id
        if (!product) {
          console.log(`🔍 Trying evo_product_id search...`)
          for (const variation of searchVariations) {
            const { data: foundProduct, error: searchError } = await supabase
              .from('products')
              .select('id, code, name')
              .eq('evo_product_id', variation)
              .single()
            
            console.log(`🔍 EVO search result for "${variation}":`, { foundProduct, searchError })
            
            if (foundProduct) {
              product = foundProduct
              console.log(`✅ Found product ${item.id_articulo} by evo_product_id as ${variation}`)
              break
            }
          }
        }

        if (!product) {
          errors.push(`Product ${item.id_articulo} not found (tried: ${searchVariations.join(', ')})`)
          console.log(`❌ Product ${item.id_articulo} not found after all variations`)
          continue
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
