'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

export interface IntegrationLog {
  id: string
  order_id?: string | null
  order_number?: string | null
  direction: 'inbound' | 'outbound'
  event_type: string
  source: string
  status: 'success' | 'failed' | 'pending' | 'processing' | 'cancelled'
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
  await requireAdmin()

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
    // Sin caracteres que rompan la sintaxis de filtros de PostgREST
    const q = filters.search.replace(/[,()*%\\]/g, ' ').trim()
    if (q) query = query.or(`event_type.ilike.%${q}%,error_message.ilike.%${q}%,payload->>id_pedido.ilike.%${q}%`)
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

  // Pedido de cada evento: los entrantes lo traen en related_entity_id y todos
  // (entrantes y salientes) llevan id_pedido en el payload
  const logs = (data || []) as IntegrationLog[]
  const numbers = [...new Set(logs.map(l => l.payload?.id_pedido).filter(Boolean).map(String))]
  const ids = [...new Set(logs.filter(l => l.direction === 'inbound' && l.related_entity_id).map(l => l.related_entity_id as string))]
  const orderMap = new Map<string, { id: string; order_number: string }>()
  if (numbers.length || ids.length) {
    const ors = [numbers.length ? `order_number.in.(${numbers.map(x => `"${x.replace(/"/g, '')}"`).join(',')})` : '', ids.length ? `id.in.(${ids.join(',')})` : ''].filter(Boolean).join(',')
    const { data: orders } = await supabase.from('orders').select('id, order_number').or(ors)
    for (const o of orders || []) { orderMap.set(o.id, o); orderMap.set(o.order_number, o) }
  }

  return {
    logs: logs.map(l => {
      const o = (l.direction === 'inbound' && l.related_entity_id && orderMap.get(l.related_entity_id)) || (l.payload?.id_pedido && orderMap.get(String(l.payload.id_pedido))) || null
      return { ...l, order_id: o?.id || null, order_number: o?.order_number || (l.payload?.id_pedido ? String(l.payload.id_pedido) : null) }
    }),
    total: count || 0,
  }
}

/** Salud de la integración para la cabecera de la pantalla Integración EVO. */
export async function getIntegrationHealth() {
  await requireAdmin()
  const supabase = createAdminClient()
  const now = Date.now()
  const h24 = new Date(now - 24 * 3600 * 1000).toISOString()
  const d30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString()
  const min10 = new Date(now - 10 * 60 * 1000).toISOString()

  const [inRes, outRes, queueRes, stuckRes, lastInRes, lastOkRes, out30Res] = await Promise.all([
    supabase.from('evo_events').select('tipo_evento, success').gte('created_at', h24),
    supabase.from('outbound_events').select('event_type, status, created_at, completed_at').gte('created_at', h24),
    supabase.from('outbound_events').select('status').in('status', ['pending', 'processing', 'failed']),
    supabase.from('outbound_events').select('id', { count: 'exact', head: true }).eq('status', 'processing').lte('created_at', min10),
    supabase.from('evo_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('outbound_events').select('completed_at').eq('status', 'success').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('outbound_events').select('status').gte('created_at', d30).in('status', ['success', 'failed']),
  ])

  const inbound = inRes.data || []
  const outbound = outRes.data || []
  const byType = (rows: { t: string }[]) => rows.reduce<Record<string, number>>((acc, r) => { acc[r.t] = (acc[r.t] || 0) + 1; return acc }, {})
  const confirmed = outbound.filter(o => o.status === 'success')
  const secs = confirmed.filter(o => o.completed_at).map(o => (new Date(o.completed_at!).getTime() - new Date(o.created_at).getTime()) / 1000).filter(x => x >= 0)
  const queue = queueRes.data || []
  const out30 = out30Res.data || []

  return {
    inbound24: inbound.length,
    inboundByType: byType(inbound.map(i => ({ t: i.tipo_evento }))),
    inboundFailed24: inbound.filter(i => i.success === false).length,
    outbound24: outbound.length,
    outboundByType: byType(outbound.map(o => ({ t: o.event_type }))),
    confirmed24: confirmed.length,
    avgConfirmSeconds: secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : null,
    pending: queue.filter(q => q.status === 'pending' || q.status === 'processing').length,
    failed: queue.filter(q => q.status === 'failed').length,
    unconfirmed10m: stuckRes.count || 0,
    lastInboundAt: lastInRes.data?.created_at || null,
    lastConfirmedAt: lastOkRes.data?.completed_at || null,
    confirmRate30d: out30.length ? Math.round((out30.filter(o => o.status === 'success').length / out30.length) * 100) : null,
  }
}

export async function getEventTypes() {
  await requireAdmin()

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
  await requireAdmin()

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

  // Procesar inmediatamente con triggeredBy: 'manual'
  const { processOutboundEvent } = await import('@/lib/ram-outbound')
  const result = await processOutboundEvent(eventId, 'manual')

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
  await requireAdmin()

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
  await requireAdmin()

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
  await requireAdmin()

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
  await requireAdmin()

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

/** Ficha de solo lectura de la conexión con EVO (sin valores de secretos). */
export async function getEvoConnectionInfo() {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data: last } = await supabase.from('evo_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()
  return {
    apiConfigured: !!process.env.EVO_API_URL,
    webhookSecretConfigured: !!process.env.EVO_WEBHOOK_SECRET,
    region: process.env.VERCEL_REGION || null,
    webhooks: ['pedidos/nuevo', 'pedidos/entregado', 'stock/actualizado', 'evo/confirmacion'],
    lastInboundAt: last?.created_at || null,
  }
}
