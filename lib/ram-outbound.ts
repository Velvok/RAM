/**
 * Sistema de envío de eventos hacia RAM (EVO)
 *
 * Funcionalidad:
 * - Encola eventos en la tabla outbound_events
 * - Reintentos automáticos con backoff exponencial
 * - Idempotencia mediante ID único
 * - Logs detallados de cada intento
 */

import { createAdminClient } from '@/lib/supabase/server'

// ============================================
// CONFIGURACIÓN
// ============================================

const RAM_BASE_URL = process.env.RAM_API_URL || process.env.EVO_API_URL || ''
const RAM_API_KEY_RAW = process.env.RAM_API_KEY || process.env.EVO_API_KEY || ''
// Limpiar el token de espacios extra que puedan venir del .env
const RAM_API_KEY = RAM_API_KEY_RAW.trim()
const RAM_TIMEOUT_MS = 30000

// Log de inicialización para debug
if (RAM_API_KEY_RAW !== RAM_API_KEY) {
  console.warn(`⚠️ RAM_API_KEY tenía espacios extra - se limpiaron automáticamente`)
  console.warn(`   Original length: ${RAM_API_KEY_RAW.length}, Limpio: ${RAM_API_KEY.length}`)
}

// Tipos de eventos que enviamos a RAM/EVO
export type OutboundEventType =
  | 'corte_realizado'     // Operario completó un corte (BAJA/ALTA en EVO)
  | 'producto_usado'      // Iniciamos un corte (descontamos material)
  | 'stock_generado'      // Terminamos un corte (generamos producto)
  | 'excedente_creado'    // Generamos un recorte reutilizable
  | 'pedido_completado'   // Entregamos un pedido completo
  | 'pedido_parcialmente_entregado'  // Retirada parcial de un pedido
  | 'pedido_iniciado'     // Iniciamos preparación
  | 'stock_ajustado'      // Ajuste manual de stock
  | 'chapa_preparada'     // Operario confirmó recogida de chapa del mismo tamaño (PREP)
  | 'test_ping'           // Para health checks

// Mapeo de tipo de evento → endpoint en RAM/EVO
const ENDPOINT_MAP: Record<OutboundEventType, string> = {
  corte_realizado: '/api/v1/stock/movimientos',
  producto_usado: '/api/velvok/producto-usado',
  stock_generado: '/api/velvok/stock-generado',
  excedente_creado: '/api/velvok/excedente',
  pedido_completado: '/api/velvok/pedido-completado',
  pedido_parcialmente_entregado: '/api/velvok/pedido-parcialmente-entregado',
  pedido_iniciado: '/api/velvok/pedido-iniciado',
  stock_ajustado: '/api/velvok/stock-ajustado',
  chapa_preparada: '/api/v1/stock/movimientos',
  test_ping: '/api/velvok/ping',
}

// ============================================
// ENCOLAR EVENTO
// ============================================

export interface EnqueueEventParams {
  eventType: OutboundEventType
  payload: Record<string, any>
  relatedEntityType?: string
  relatedEntityId?: string
  customEndpoint?: string
  maxAttempts?: number
}

/**
 * Encola un evento para ser enviado a RAM.
 * Retorna el ID del evento creado.
 */
export async function enqueueOutboundEvent({
  eventType,
  payload,
  relatedEntityType,
  relatedEntityId,
  customEndpoint,
  maxAttempts = 5,
}: EnqueueEventParams): Promise<string> {
  const supabase = createAdminClient()

  const endpoint = customEndpoint || `${RAM_BASE_URL}${ENDPOINT_MAP[eventType]}`

  const { data, error } = await supabase
    .from('outbound_events')
    .insert({
      event_type: eventType,
      endpoint,
      payload,
      status: 'pending',
      max_attempts: maxAttempts,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      next_retry_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error encolando evento outbound:', error)
    throw error
  }

  // Solo procesar inmediatamente si NO hay otro evento en processing
  // Esto implementa la cola secuencial para evitar saturar a EVO
  // El worker independiente procesará eventos pending
  const { data: processingEvents } = await supabase
    .from('outbound_events')
    .select('id')
    .eq('status', 'processing')
    .limit(1)

  if (!processingEvents || processingEvents.length === 0) {
    // Pequeño delay para evitar race conditions con eventos creados casi simultáneamente
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Verificar nuevamente justo antes de procesar
    const { data: recheck } = await supabase
      .from('outbound_events')
      .select('id')
      .eq('status', 'processing')
      .limit(1)
    
    if (!recheck || recheck.length === 0) {
      // No hay eventos en proceso, podemos procesar este inmediatamente
      console.log(`🚀 No hay eventos en proceso, procesando ${data.id} inmediatamente`)
      processOutboundEvent(data.id).catch(err => {
        console.error('Error procesando evento inmediatamente:', err)
      })
    } else {
      console.log(`⏸️ Evento ${data.id} encolado (detectado evento en proceso en recheck)`)
    }
  } else {
    console.log(`⏸️ Evento ${data.id} encolado, esperando worker`)
  }

  return data.id
}

// ============================================
// PROCESAR EVENTO INDIVIDUAL
// ============================================

/**
 * Procesa un evento outbound: envía a RAM y actualiza el estado.
 * Implementa retry con backoff exponencial.
 */
export async function processOutboundEvent(eventId: string): Promise<{
  success: boolean
  status: number
  error?: string
}> {
  const supabase = createAdminClient()

  // 1. Obtener el evento
  const { data: event, error: fetchError } = await supabase
    .from('outbound_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (fetchError || !event) {
    console.error('Evento no encontrado:', eventId)
    return { success: false, status: 0, error: 'Evento no encontrado' }
  }

  // 2. Si ya está completado, no hacer nada
  if (event.status === 'success') {
    return { success: true, status: event.http_status || 200 }
  }

  // 3. Si superó max_attempts, marcar como permanently_failed
  if (event.attempts >= event.max_attempts) {
    await supabase
      .from('outbound_events')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', eventId)
    return { success: false, status: 0, error: 'Max attempts exceeded' }
  }

  // 4. Marcar como processing
  const currentAttempt = event.attempts + 1
  await supabase
    .from('outbound_events')
    .update({
      status: 'processing',
      attempts: currentAttempt,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  // 5. Hacer el request HTTP
  let httpStatus = 0
  let responseBody: any = null
  let errorMessage: string | null = null
  let success = false

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), RAM_TIMEOUT_MS)

    console.log(`\n=== 📤 ENVIANDO A EVO ===`)
    console.log(`🆔 Event ID: ${event.id}`)
    console.log(`📍 Endpoint: ${event.endpoint}`)
    console.log(`🏷️ Evento: ${event.event_type}`)
    console.log(`🔢 Intento: ${currentAttempt}/${event.max_attempts}`)
    console.log(`🔑 Token presente: ${RAM_API_KEY ? 'SÍ (primeros 10 chars: ' + RAM_API_KEY.substring(0, 10) + '...)' : 'NO'}`)
    console.log(`📦 Payload enviado:`, JSON.stringify(event.payload, null, 2))
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': RAM_API_KEY ? `Bearer ${RAM_API_KEY}` : '',
      'X-Velvok-Event-Id': event.id,
      'X-Velvok-Event-Type': event.event_type,
      'X-Velvok-Attempt': String(currentAttempt),
    }
    
    console.log(`📋 Headers enviados:`, {
      'Content-Type': headers['Content-Type'],
      'Authorization': headers['Authorization'] ? `Bearer ${headers['Authorization'].substring(7, 17)}...` : 'none',
      'X-Velvok-Event-Id': headers['X-Velvok-Event-Id'],
      'X-Velvok-Event-Type': headers['X-Velvok-Event-Type'],
      'X-Velvok-Attempt': headers['X-Velvok-Attempt'],
    })
    
    // Debug detallado del Authorization header para validación exacta de EVO
    if (headers['Authorization']) {
      const authHeader = headers['Authorization']
      console.log(`🔍 Authorization DEBUG:`)
      console.log(`   Longitud total: ${authHeader.length} caracteres`)
      console.log(`   Primeros 20 chars: "${authHeader.substring(0, 20)}"`)
      console.log(`   Últimos 10 chars: "${authHeader.substring(authHeader.length - 10)}"`)
      console.log(`   Tiene espacios extra al inicio: ${authHeader !== authHeader.trimStart()}`)
      console.log(`   Tiene espacios extra al final: ${authHeader !== authHeader.trimEnd()}`)
    }

    // Enviar request a EVO
    const response = await fetch(event.endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Connection': 'close',
        'X-Request-Timestamp': new Date().toISOString(),
        'X-Request-ID': `${event.id}-${currentAttempt}-${Date.now()}`,
      },
      body: JSON.stringify(event.payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    httpStatus = response.status
    
    console.log(`📨 Respuesta recibida:`)
    console.log(`   HTTP Status: ${httpStatus}`)
    console.log(`   Status Text: ${response.statusText}`)
    
    // Capturar headers de respuesta
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    console.log(`   Response Headers:`, responseHeaders)
    
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      responseBody = await response.json().catch(() => null)
    } else {
      responseBody = { raw: await response.text().catch(() => '') }
    }

    console.log(`📄 Response Body:`, JSON.stringify(responseBody, null, 2))
    console.log(`=== FIN COMUNICACION EVO ===\n`)

    if (response.ok) {
      success = true
    } else {
      errorMessage = `HTTP ${response.status}: ${responseBody?.error || responseBody?.message || 'Error desconocido'}`
      console.log(`❌ Request falló: HTTP ${response.status}, currentAttempt: ${currentAttempt}`)
    }
  } catch (err: any) {
    errorMessage = err.name === 'AbortError'
      ? `Timeout después de ${RAM_TIMEOUT_MS}ms`
      : (err.message || 'Error de red')
    console.error(`Error en comunicacion con EVO:`, errorMessage)
  }

  // 6. Actualizar el evento con el resultado
  const isLastAttempt = currentAttempt >= event.max_attempts
  
  // Si el envío fue exitoso, dejarlo en 'processing' esperando confirmación de EVO
  // Solo se marcará como 'success' cuando EVO envíe la confirmación vía webhook
  const nextStatus = success
    ? 'processing'  // Esperando confirmación de EVO
    : (isLastAttempt ? 'failed' : 'failed') // 'failed' permite reintentos via cron
  
  const nextRetryAt = success
    ? null
    : calculateNextRetryTime(currentAttempt)

  await supabase
    .from('outbound_events')
    .update({
      status: nextStatus,
      http_status: httpStatus,
      response_body: responseBody,
      error_message: errorMessage,
      next_retry_at: nextRetryAt,
      completed_at: isLastAttempt && !success ? new Date().toISOString() : null,
    })
    .eq('id', eventId)

  console.log(`📊 Evento ${eventId} actualizado a estado: ${nextStatus}${success ? ' (esperando confirmación de EVO)' : ''}`)

  return { success, status: httpStatus, error: errorMessage || undefined }
}

// ============================================
// BACKOFF EXPONENCIAL
// ============================================

/**
 * Calcula el próximo momento para reintentar.
 * Backoff exponencial: 30s, 2min, 5min, 15min, 1h
 */
function calculateNextRetryTime(attemptNumber: number): string {
  const delays = [30, 120, 300, 900, 3600] // segundos
  const delaySeconds = delays[Math.min(attemptNumber - 1, delays.length - 1)]
  return new Date(Date.now() + delaySeconds * 1000).toISOString()
}

// ============================================
// PROCESAR COLA PENDIENTE (para cron)
// ============================================

export async function processPendingQueue(maxEvents = 20): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const supabase = createAdminClient()

  // Obtener eventos pendientes cuyo next_retry_at ya pasó
  const { data: events } = await supabase
    .from('outbound_events')
    .select('id')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(maxEvents)

  if (!events || events.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const event of events) {
    const result = await processOutboundEvent(event.id)
    if (result.success) succeeded++
    else failed++
  }

  return { processed: events.length, succeeded, failed }
}

// ============================================
// HELPERS DE ALTO NIVEL
// ============================================

/**
 * Notifica a RAM que un producto fue usado en un corte
 */
export async function notifyProductoUsado(params: {
  cutOrderId: string
  productId: string
  productCode: string
  quantityUsed: number
  unit: string
  orderId?: string
}) {
  return enqueueOutboundEvent({
    eventType: 'producto_usado',
    payload: {
      timestamp: new Date().toISOString(),
      cut_order_id: params.cutOrderId,
      product_id: params.productId,
      product_code: params.productCode,
      quantity_used: params.quantityUsed,
      unit: params.unit,
      order_id: params.orderId,
    },
    relatedEntityType: 'cut_order',
    relatedEntityId: params.cutOrderId,
  })
}

/**
 * Notifica a RAM que se generó stock nuevo (producto del corte)
 */
export async function notifyStockGenerado(params: {
  cutOrderId: string
  productId: string
  productCode: string
  quantityGenerated: number
  unit: string
}) {
  return enqueueOutboundEvent({
    eventType: 'stock_generado',
    payload: {
      timestamp: new Date().toISOString(),
      cut_order_id: params.cutOrderId,
      product_id: params.productId,
      product_code: params.productCode,
      quantity_generated: params.quantityGenerated,
      unit: params.unit,
    },
    relatedEntityType: 'cut_order',
    relatedEntityId: params.cutOrderId,
  })
}

/**
 * Notifica a RAM que se generó un excedente (recorte reutilizable)
 */
export async function notifyExcedente(params: {
  cutOrderId: string
  remnantId: string
  productId: string
  productCode: string
  quantityRemnant: number
  unit: string
}) {
  return enqueueOutboundEvent({
    eventType: 'excedente_creado',
    payload: {
      timestamp: new Date().toISOString(),
      cut_order_id: params.cutOrderId,
      remnant_id: params.remnantId,
      product_id: params.productId,
      product_code: params.productCode,
      quantity_remnant: params.quantityRemnant,
      unit: params.unit,
    },
    relatedEntityType: 'remnant',
    relatedEntityId: params.remnantId,
  })
}

/**
 * Notifica a RAM que un pedido fue completado/entregado
 */
export async function notifyPedidoCompletado(params: {
  orderId: string
  orderNumber: string
  evoOrderId?: string
  items: Array<{
    product_id: string
    product_code: string
    quantity: number
    unit: string
  }>
}) {
  return enqueueOutboundEvent({
    eventType: 'pedido_completado',
    payload: {
      timestamp: new Date().toISOString(),
      order_id: params.orderId,
      order_number: params.orderNumber,
      evo_order_id: params.evoOrderId,
      items: params.items,
    },
    relatedEntityType: 'order',
    relatedEntityId: params.orderId,
  })
}

/**
 * Notifica a RAM que se realizó una retirada parcial de un pedido
 */
export async function notifyPedidoParcialmenteEntregado(params: {
  orderId: string
  orderNumber: string
  evoOrderId?: string
  itemsDelivered: Array<{
    product_id: string
    product_code: string
    evo_product_id?: string
    quantity: number
    unit: string
  }>
  remainingItems?: Array<{
    product_id: string
    product_code: string
    evo_product_id?: string
    quantity: number
    unit: string
  }>
}) {
  return enqueueOutboundEvent({
    eventType: 'pedido_parcialmente_entregado',
    payload: {
      timestamp: new Date().toISOString(),
      order_id: params.orderId,
      order_number: params.orderNumber,
      evo_order_id: params.evoOrderId,
      items_delivered: params.itemsDelivered,
      remaining_items: params.remainingItems,
    },
    relatedEntityType: 'order',
    relatedEntityId: params.orderId,
  })
}

/**
 * Notifica a EVO que se realizó un corte físico.
 * Envía BAJA del material consumido y ALTA del/los producto(s) generado(s).
 * Endpoint: /api/v1/stock/movimientos
 */
export interface CorteMovimiento {
  tipo: 'BAJA' | 'ALTA' | 'PREP'
  nro_item?: number
  id_articulo: string
  cantidad: number
}

export async function notifyCorteRealizado(params: {
  cutOrderId: string
  orderId: string
  idPedido: string                        // evo_order_id (e.g. "100042647")
  refEvo: Record<string, any>             // ref_evo guardado del pedido original
  operario: string                        // código/nombre del operario
  movimientos: CorteMovimiento[]
}) {
  return enqueueOutboundEvent({
    eventType: 'corte_realizado',
    payload: {
      id_evento: `corte_${params.cutOrderId}_${Date.now()}`,
      tipo_evento: 'corte_realizado',
      id_pedido: params.idPedido,
      ref_evo: params.refEvo,
      operario: params.operario,
      movimientos: params.movimientos,
    },
    relatedEntityType: 'cut_order',
    relatedEntityId: params.cutOrderId,
  })
}

/**
 * Notifica a EVO que se preparó una chapa del mismo tamaño (PREP)
 * Se usa cuando el operario confirma la recogida de una chapa que no requiere corte
 * Internamente usamos 'chapa_preparada' pero enviamos 'corte_realizado' a EVO
 */
export async function notifyChapaPreparada(params: {
  cutOrderId: string
  orderId: string
  idPedido: string                        // evo_order_id (e.g. "100042647")
  refEvo: Record<string, any>             // ref_evo guardado del pedido original
  operario: string                        // código/nombre del operario
  movimientos: CorteMovimiento[]
}) {
  // Generar UUID completamente único para evitar duplicados
  // EVO rechaza eventos con el mismo id_evento
  const { randomUUID } = await import('crypto')
  const uniqueId = randomUUID()
  
  return enqueueOutboundEvent({
    eventType: 'chapa_preparada',
    payload: {
      id_evento: `prep_${uniqueId}`,
      tipo_evento: 'corte_realizado', // EVO espera corte_realizado
      id_pedido: params.idPedido,
      ref_evo: params.refEvo,
      operario: params.operario,
      movimientos: params.movimientos,
      timestamp: new Date().toISOString(), // Timestamp único para cada evento
    },
    relatedEntityType: 'cut_order',
    relatedEntityId: params.cutOrderId,
  })
}
