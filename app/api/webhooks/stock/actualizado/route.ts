import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

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
    // TEMPORAL: Sin validación de headers para pruebas con EVO
    // const headersList = await headers()
    // const webhookSecret = headersList.get('x-evo-webhook-secret')
    // const envSecret = process.env.EVO_WEBHOOK_SECRET

    console.log('🔍 Webhook Debug: MODO TEST - Sin validación de headers')

    // TEMPORAL: Comentar validación para pruebas
    // if (!webhookSecret) {
    //   return NextResponse.json({ error: 'Missing webhook secret header' }, { status: 401 })
    // }
    // if (webhookSecret !== envSecret) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const payload: StockActualizadoPayload = await request.json()
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
        // Buscar producto por evo_product_id
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('evo_product_id', item.id_articulo)
          .single()

        if (!product) {
          errors.push(`Product ${item.id_articulo} not found`)
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
