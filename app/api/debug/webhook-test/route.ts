import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createWebhookVerifier } from '@/lib/webhook-security'

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const body = await request.text()
    
    console.log('🔍 DEBUG: Webhook test started')
    console.log('🔍 DEBUG: Headers:', JSON.stringify(Object.fromEntries(headersList), null, 2))
    console.log('🔍 DEBUG: Body:', body)
    
    // Configuración de seguridad
    const webhookSecret = process.env.EVO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('❌ DEBUG: EVO_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Verificar autenticación
    const verifyWebhook = createWebhookVerifier({
      secret: webhookSecret,
      enableHmac: false,
      enableBearerToken: true
    })

    const verification = await verifyWebhook(headersList, body)
    console.log('🔍 DEBUG: Verification result:', verification)
    
    if (!verification.valid) {
      console.error('❌ DEBUG: Webhook authentication failed:', verification.error)
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: verification.error 
        },
        { status: 401 }
      )
    }

    console.log('✅ DEBUG: Webhook authentication successful')

    // Parsear el payload
    const payload = JSON.parse(body)
    console.log('🔍 DEBUG: Parsed payload:', payload)

    const supabase = createAdminClient()
    console.log('🔍 DEBUG: Supabase client created')

    // Validar estructura básica
    if (!payload.id_evento || !payload.version || !payload.items) {
      console.log('❌ DEBUG: Invalid payload structure')
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Verificar idempotencia
    console.log('🔍 DEBUG: Checking idempotency for id_evento:', payload.id_evento)
    const { data: existingEvent, error: existingError } = await supabase
      .from('evo_events')
      .select('id')
      .eq('id_evento', payload.id_evento)
      .single()

    console.log('🔍 DEBUG: Existing event check:', { existingEvent, existingError })

    if (existingEvent) {
      console.log('🔍 DEBUG: Event already processed, returning')
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        id_evento: payload.id_evento
      })
    }

    console.log('🔍 DEBUG: Processing items (no version check)')

    // Procesar actualizaciones de stock
    let updatedCount = 0
    const errors: string[] = []

    for (const item of payload.items) {
      console.log('🔍 DEBUG: Processing item:', item)
      
      try {
        // Buscar producto
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, code, name')
          .eq('code', item.id_articulo)
          .single()

        console.log('🔍 DEBUG: Product search result:', { product, productError })

        if (!product) {
          errors.push(`Product ${item.id_articulo} not found`)
          console.log(`❌ DEBUG: Product ${item.id_articulo} not found`)
          continue
        }

        // Actualizar stock
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

        console.log('🔍 DEBUG: Update result:', { updateError })

        if (updateError) {
          errors.push(`Error updating ${item.id_articulo}: ${updateError.message}`)
        } else {
          updatedCount++
        }

      } catch (error) {
        const errorMsg = `Error processing ${item.id_articulo}: ${error instanceof Error ? error.message : 'Unknown'}`
        errors.push(errorMsg)
        console.log('❌ DEBUG:', errorMsg)
      }
    }

    console.log('🔍 DEBUG: Processing complete. Updated:', updatedCount, 'Errors:', errors.length)

    // Registrar evento procesado
    console.log('🔍 DEBUG: Inserting event into evo_events')
    const { data: eventData, error: eventError } = await supabase
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
      .select()

    console.log('🔍 DEBUG: Event insert result:', { eventData, eventError })

    const response = {
      success: true,
      message: 'Stock updated successfully',
      id_evento: payload.id_evento,
      updated_count: updatedCount,
      errors_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      debug: {
        event_inserted: !!eventData
      }
    }

    console.log('🔍 DEBUG: Final response:', response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ DEBUG: Webhook error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        debug: 'Error caught in try-catch'
      },
      { status: 500 }
    )
  }
}
