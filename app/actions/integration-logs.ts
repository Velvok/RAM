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

  // Procesar inmediatamente
  const { processOutboundEvent } = await import('@/lib/ram-outbound')
  const result = await processOutboundEvent(eventId)

  return result
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
