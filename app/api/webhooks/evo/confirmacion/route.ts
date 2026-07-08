import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { createWebhookVerifier } from '@/lib/webhook-security'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface ConfirmacionPayload {
  id_evento: string
  estado: 'completado' | 'error'
  timestamp: string
  error_message?: string
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const body = await request.text()
    const contentType = headersList.get('content-type') || ''

    console.log('📥 Webhook de confirmación EVO recibido')
    console.log('📥 Body:', body.substring(0, 500))

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

    console.log('✅ Webhook de confirmación autenticado')

    // Parsear payload
    let payload: ConfirmacionPayload
    if (contentType.includes('application/json')) {
      payload = JSON.parse(body)
    } else {
      try {
        payload = JSON.parse(body)
      } catch (e) {
        console.error('❌ Error parseando JSON:', e)
        return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
      }
    }

    console.log('\n=== � WEBHOOK CONFIRMACIÓN EVO ===')
    console.log('� Payload:', JSON.stringify(payload, null, 2))
    console.log('🔑 Auth header:', request.headers.get('authorization') ? 'Bearer ***' : 'none')

    // Validación
    if (!payload.id_evento || !payload.estado || !payload.timestamp) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Buscar el outbound_event correspondiente
    // El id_evento viene en el payload que enviamos a EVO
    console.log(`🔍 Buscando outbound_event con id_evento: ${payload.id_evento}`)
    const { data: outboundEvent, error: fetchError } = await supabase
      .from('outbound_events')
      .select('*')
      .eq('payload->>id_evento', payload.id_evento)
      .single()

    if (fetchError || !outboundEvent) {
      console.error('❌ Outbound event not found for id_evento:', payload.id_evento, fetchError)
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    console.log(`✅ Found outbound event:`, {
      id: outboundEvent.id,
      event_type: outboundEvent.event_type,
      status: outboundEvent.status,
      created_at: outboundEvent.created_at
    })

    // Verificar que el evento esté en estado 'processing' (esperando confirmación)
    if (outboundEvent.status !== 'processing') {
      console.log(`⚠️ Event ${outboundEvent.id} is not in 'processing' state (current: ${outboundEvent.status}), skipping update`)
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        id_evento: payload.id_evento
      })
    }

    // Actualizar el estado del evento
    const updateData: any = {
      status: payload.estado === 'completado' ? 'success' : 'failed',
      completed_at: new Date().toISOString(),
      response_body: {
        evo_confirmation: payload
      }
    }

    if (payload.estado === 'error' && payload.error_message) {
      updateData.error_message = payload.error_message
    }

    const { error: updateError } = await supabase
      .from('outbound_events')
      .update(updateData)
      .eq('id', outboundEvent.id)

    if (updateError) {
      console.error('❌ Error updating outbound event:', updateError)
      return NextResponse.json({ error: 'Error updating event' }, { status: 500 })
    }

    console.log(`✅ Outbound event updated to: ${updateData.status}`)

    // Registrar el evento de confirmación en evo_events para que aparezca en /admin/logs
    try {
      // Solo incluir order_id si el evento está relacionado con un order
      const insertData: any = {
        id_evento: `confirm_${payload.id_evento}`,
        tipo_evento: 'evo_confirmacion',
        payload: payload,
        processed_at: new Date().toISOString(),
        success: payload.estado === 'completado',
        errors: payload.estado === 'error' && payload.error_message ? [payload.error_message] : null
      }

      // Si el evento está relacionado con un order, incluir order_id
      if (outboundEvent.related_entity_type === 'order' && outboundEvent.related_entity_id) {
        insertData.order_id = outboundEvent.related_entity_id
      }

      const { error: insertError } = await supabase
        .from('evo_events')
        .insert(insertData)

      if (insertError) {
        console.error('⚠️ Error inserting confirmation in evo_events:', insertError)
      } else {
        console.log('✅ Confirmation event logged in evo_events')
      }
    } catch (logError) {
      console.error('⚠️ Exception logging confirmation in evo_events:', logError)
      // No fallar el flujo principal si falla el log
    }

    // Esperar un poco antes de procesar el siguiente evento
    // Esto da tiempo a EVO para terminar de procesar el evento anterior internamente
    console.log('⏳ Esperando 2 segundos antes de procesar siguiente evento...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Procesar el siguiente evento pendiente
    console.log('🔄 Intentando procesar siguiente evento pendiente...')
    const nextEventResult = await processNextPendingEvent(supabase)
    console.log('📊 Resultado procesamiento siguiente evento:', nextEventResult)
    console.log('=== FIN WEBHOOK CONFIRMACIÓN ===\n')

    return NextResponse.json({
      success: true,
      message: 'Confirmation processed',
      id_evento: payload.id_evento,
      next_event_processed: nextEventResult
    })

  } catch (error) {
    console.error('❌ Webhook de confirmación error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Procesa el siguiente evento pendiente de la cola.
 * Solo procesa uno a la vez para mantener el orden secuencial.
 */
async function processNextPendingEvent(supabase: ReturnType<typeof createAdminClient>) {
  try {
    console.log('🔍 Buscando siguiente evento pendiente...')
    
    // Buscar el evento más antiguo en estado 'pending'
    const { data: nextEvent, error: fetchError } = await supabase
      .from('outbound_events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Error fetching next pending event:', fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!nextEvent) {
      console.log('ℹ️ No hay eventos pendientes para procesar')
      return { success: true, message: 'No pending events' }
    }

    console.log(`� Procesando siguiente evento pendiente:`, {
      id: nextEvent.id,
      event_type: nextEvent.event_type,
      created_at: nextEvent.created_at,
      payload_operario: nextEvent.payload?.operario
    })

    // Importar processOutboundEvent dinámicamente para evitar dependencias circulares
    const { processOutboundEvent } = await import('@/lib/ram-outbound')
    
    const result = await processOutboundEvent(nextEvent.id)
    
    console.log(`✅ Resultado del procesamiento:`, {
      success: result.success,
      status: result.status,
      error: result.error
    })

    return {
      success: true,
      event_id: nextEvent.id,
      event_type: nextEvent.event_type,
      result
    }

  } catch (error) {
    console.error('❌ Error processing next pending event:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
