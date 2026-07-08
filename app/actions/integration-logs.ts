'use server'

import { createAdminClient } from '@/lib/supabase/server'

export interface IntegrationLog {
  id: string
  direction: 'inbound' | 'outbound'
  event_type: string
  source: string
  status: 'success' | 'failed' | 'pending' | 'processing'
  http_status: number | null
  payload: any
  response_body: any | null
  error_message: string | null
  attempts: number
  related_entity_type: string | null
  related_entity_id: string | null
  created_at: string
  completed_at: string | null
}

export interface LogsFilters {
  direction?: 'inbound' | 'outbound' | 'all'
  status?: 'success' | 'failed' | 'pending' | 'all'
  eventType?: string
  search?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export async function getIntegrationLogs(filters: LogsFilters = {}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('v_integration_logs')
    .select('*', { count: 'exact' })

  if (filters.direction && filters.direction !== 'all') {
    query = query.eq('direction', filters.direction)
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType)
  }

  if (filters.search) {
    query = query.or(`event_type.ilike.%${filters.search}%,error_message.ilike.%${filters.search}%`)
  }

  if (filters.fromDate) {
    query = query.gte('created_at', filters.fromDate)
  }

  if (filters.toDate) {
    query = query.lte('created_at', filters.toDate)
  }

  const limit = filters.limit ?? 100
  const offset = filters.offset ?? 0

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching integration logs:', error)
    throw error
  }

  return {
    logs: (data || []) as IntegrationLog[],
    total: count || 0,
  }
}

export async function getLogsStats() {
  const supabase = createAdminClient()

  // Estadísticas últimas 24h
  const yesterday = new Date()
  yesterday.setHours(yesterday.getHours() - 24)

  const { data: recent } = await supabase
    .from('v_integration_logs')
    .select('direction, status')
    .gte('created_at', yesterday.toISOString())

  const stats = {
    inbound_24h: 0,
    outbound_24h: 0,
    success_24h: 0,
    failed_24h: 0,
    pending: 0,
  }

  recent?.forEach((log: any) => {
    if (log.direction === 'inbound') stats.inbound_24h++
    if (log.direction === 'outbound') stats.outbound_24h++
    if (log.status === 'success') stats.success_24h++
    if (log.status === 'failed') stats.failed_24h++
    if (log.status === 'pending') stats.pending++
  })

  // Pendientes globales (no solo 24h)
  const { count: pendingCount } = await supabase
    .from('outbound_events')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'failed'])

  stats.pending = pendingCount || 0

  return stats
}

export async function getEventTypes() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('v_integration_logs')
    .select('event_type')
    .limit(1000)

  const types = new Set<string>()
  data?.forEach((row: any) => {
    if (row.event_type) types.add(row.event_type)
  })

  return Array.from(types).sort()
}

export async function retryOutboundEvent(eventId: string) {
  console.log(`🔄 === MANUAL RETRY INITIATED ===`)
  console.log(`🆔 Event ID: ${eventId}`)
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`)

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('outbound_events')
    .update({
      status: 'pending',
      next_retry_at: new Date().toISOString(),
      attempts: 0,
      error_message: null,
      response_body: null,
      http_status: null,
    })
    .eq('id', eventId)

  if (error) throw error

  console.log(`✅ Event reset to pending status`)

  // Procesar inmediatamente
  const { processOutboundEvent } = await import('@/lib/ram-outbound')
  const result = await processOutboundEvent(eventId)

  console.log(`🔄 === MANUAL RETRY COMPLETED ===`)
  console.log(`📊 Result: ${JSON.stringify(result)}`)

  return result
}

/**
 * Procesa automáticamente el siguiente evento pending.
 * Se puede llamar desde cualquier acción de usuario para procesar
 * eventos pending automáticamente sin cron job.
 */
export async function processNextPendingEventAuto() {
  const supabase = createAdminClient()

  try {
    // Buscar el siguiente evento pending que esté listo para procesar
    const { data: pendingEvent, error } = await supabase
      .from('outbound_events')
      .select('*')
      .eq('status', 'pending')
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !pendingEvent) {
      return { success: true, message: 'No pending events to process' }
    }

    console.log(`🔄 Procesando evento pending automáticamente: ${pendingEvent.id}`)

    // Procesar el evento igual que reintento manual
    const { processOutboundEvent } = await import('@/lib/ram-outbound')
    const result = await processOutboundEvent(pendingEvent.id)

    return { success: true, message: 'Event processed', result }
  } catch (error) {
    console.error('Error procesando evento pending automáticamente:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendTestEvent() {
  const { enqueueOutboundEvent } = await import('@/lib/ram-outbound')

  const eventId = await enqueueOutboundEvent({
    eventType: 'test_ping',
    payload: {
      timestamp: new Date().toISOString(),
      message: 'Ping de prueba desde Velvok',
      test: true,
    },
    maxAttempts: 1,
  })

  return { success: true, eventId }
}

/**
 * Devuelve eventos recientes (entrada y salida) para notificaciones del cliente.
 * Bypassa RLS usando admin client. Usado por el provider de notificaciones en polling.
 */
export async function getRecentEventsForNotifications(sinceIso?: string) {
  const supabase = createAdminClient()
  const since = sinceIso || new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const [inboundResult, outboundResult] = await Promise.all([
    supabase
      .from('evo_events')
      .select('id, tipo_evento, success, errors, payload, created_at, processed_at')
      .gte('processed_at', since)
      .not('success', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(20),
    supabase
      .from('outbound_events')
      .select('id, event_type, status, error_message, completed_at, created_at')
      .gte('updated_at', since)
      .in('status', ['success', 'failed'])
      .order('updated_at', { ascending: false })
      .limit(20)
  ])

  return {
    inbound: inboundResult.data || [],
    outbound: outboundResult.data || [],
  }
}

export async function markEventsAsViewed() {
  const supabase = createAdminClient()

  // Marcar todos los eventos outbound fallidos como vistos
  const { error } = await supabase
    .from('outbound_events')
    .update({ viewed_at: new Date().toISOString() })
    .in('status', ['failed', 'pending'])
    .is('viewed_at', null)

  if (error) throw error

  // Marcar eventos evo fallidos como vistos (no tienen columna viewed_at, usamos otro mecanismo)
  // Por ahora, no hacemos nada con evo_events porque no tienen esa columna

  return { success: true }
}
