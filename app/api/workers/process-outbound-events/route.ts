import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processOutboundEvent } from '@/lib/ram-outbound'

/**
 * Worker que procesa eventos pending cada X segundos.
 * Se ejecuta vía Vercel Cron Jobs para evitar el problema de contexto
 * del webhook (que causa HTTP 401 en Vercel).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key'

  // Verificar autenticación para evitar llamadas no autorizadas
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    console.log('=== 🔄 WORKER: Procesando eventos pending ===')
    const startTime = Date.now()

    // Buscar el siguiente evento pending que esté listo para procesar
    const { data: pendingEvent, error } = await supabase
      .from('outbound_events')
      .select('*')
      .eq('status', 'pending')
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !pendingEvent) {
      console.log('ℹ️ No hay eventos pending listos para procesar')
      return NextResponse.json({
        success: true,
        message: 'No pending events to process',
        processed: 0,
        duration_ms: Date.now() - startTime
      })
    }

    console.log(`📋 Procesando evento: ${pendingEvent.id}`)
    console.log(`🆔 ID Evento EVO: ${pendingEvent.payload?.id_evento}`)
    console.log(`🏷️ Tipo: ${pendingEvent.event_type}`)

    // Procesar el evento igual que reintento manual
    // Esto funciona porque el contexto del worker es similar al del usuario
    const result = await processOutboundEvent(pendingEvent.id)

    console.log(`📊 Resultado: ${result.success ? '✅ Success' : '❌ Failed'}`)
    console.log(`⏱️ Duración: ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      message: 'Event processed',
      event_id: pendingEvent.id,
      result,
      duration_ms: Date.now() - startTime
    })

  } catch (error) {
    console.error('❌ Worker error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
