/**
 * Sistema de envío de eventos hacia RAM (EVO)
 *
 * Funcionalidad:
 * - Encola eventos en la tabla outbound_events
 * - Reintentos automáticos con backoff exponencial
 * - Idempotencia mediante ID único
 * - Logs detallados de cada intento
 * - Lock interno para evitar envíos secuenciales en mismo request
 */

import { createAdminClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// ============================================
// CONFIGURACIÓN
// ============================================

const RAM_BASE_URL = process.env.RAM_API_URL || process.env.EVO_API_URL || ''
const RAM_API_KEY_RAW = process.env.RAM_API_KEY || process.env.EVO_API_KEY || ''
// Limpiar el token de espacios extra que puedan venir del .env
const RAM_API_KEY = RAM_API_KEY_RAW.trim()
const RAM_TIMEOUT_MS = 30000

// Log de inicialización para debug
console.log(`🔑 EVO Token Initialization:`)
console.log(`   RAM_API_KEY exists: ${!!process.env.RAM_API_KEY}`)
console.log(`   EVO_API_KEY exists: ${!!process.env.EVO_API_KEY}`)
console.log(`   Using: ${process.env.RAM_API_KEY ? 'RAM_API_KEY' : 'EVO_API_KEY'}`)
console.log(`   Token length: ${RAM_API_KEY.length}`)
console.log(`   Token SHA256: ${createHash('sha256').update(RAM_API_KEY).digest('hex')}`)

if (RAM_API_KEY_RAW !== RAM_API_KEY) {
  console.warn(`⚠️ RAM_API_KEY tenía espacios extra - se limpiaron automáticamente`)
  console.warn(`   Original length: ${RAM_API_KEY_RAW.length}, Limpio: ${RAM_API_KEY.length}`)
}

// Función para obtener información del token sin exponerlo
function getTokenInfo(token: string) {
  const cleanToken = token.trim()
  return {
    length: token.length,
    cleanLength: cleanToken.length,
    startsWith: token.slice(0, 8),
    endsWith: token.slice(-8),
    sha256: createHash('sha256').update(token).digest('hex'),
    hasSpaces: /\s/.test(token),
    hasLineBreaks: /[\r\n]/.test(token),
    hasBearerInside: /^Bearer\s+/i.test(token),
    hasDoubleBearer: /^Bearer\s+Bearer/i.test(token),
    hasQuotes: /^["']|["']$/.test(token),
    isUndefined: token === 'undefined',
    isNull: token === 'null',
    isEmpty: token === '',
    // Detectar espacios extra (más de un espacio consecutivo)
    hasMultipleSpaces: /\s{2,}/.test(token),
    // Detectar espacios al inicio (después de "Bearer " si es Authorization header)
    hasLeadingSpaces: token !== token.trimStart(),
    // Detectar espacios al final
    hasTrailingSpaces: token !== token.trimEnd(),
  }
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

  // NO procesar inmediatamente - arquitectura Outbox
  // El evento se guardará en cola y será procesado por processOnePendingPrep()
  console.log(`📝 Evento ${data.id} guardado en cola (arquitectura Outbox)`)

  // Intentar procesar un evento pending (puede ser este u otro)
  // Esto se ejecuta en background para no bloquear el request
  processOnePendingPrep().catch(err => {
    console.error('Error en processOnePendingPrep background:', err)
  })

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
    console.log(`🔑 Token presente: ${RAM_API_KEY ? 'SÍ' : 'NO'}`)
    
    // Logging detallado del token sin exponerlo
    if (RAM_API_KEY) {
      const tokenInfo = getTokenInfo(RAM_API_KEY)
      console.log(`🔍 Token INFO:`)
      console.log(`   Length: ${tokenInfo.length}`)
      console.log(`   Clean Length: ${tokenInfo.cleanLength}`)
      console.log(`   Starts with: "${tokenInfo.startsWith}"`)
      console.log(`   Ends with: "${tokenInfo.endsWith}"`)
      console.log(`   SHA256: ${tokenInfo.sha256}`)
      console.log(`   Has spaces: ${tokenInfo.hasSpaces}`)
      console.log(`   Has line breaks: ${tokenInfo.hasLineBreaks}`)
      console.log(`   Has Bearer inside: ${tokenInfo.hasBearerInside}`)
      console.log(`   Has double Bearer: ${tokenInfo.hasDoubleBearer}`)
      console.log(`   Has quotes: ${tokenInfo.hasQuotes}`)
      console.log(`   Is undefined: ${tokenInfo.isUndefined}`)
      console.log(`   Is null: ${tokenInfo.isNull}`)
      console.log(`   Is empty: ${tokenInfo.isEmpty}`)
    }
    
    // Logging del payload
    const payloadString = JSON.stringify(event.payload)
    const payloadSha256 = createHash('sha256').update(payloadString).digest('hex')
    console.log(`📦 Payload INFO:`)
    console.log(`   Length: ${payloadString.length}`)
    console.log(`   SHA256: ${payloadSha256}`)
    console.log(`   Payload:`, JSON.stringify(event.payload, null, 2))
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': RAM_API_KEY ? `Bearer ${RAM_API_KEY.trim()}` : '',
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
      const authInfo = getTokenInfo(authHeader)
      console.log(`🔍 Authorization Header INFO:`)
      console.log(`   Length: ${authInfo.length}`)
      console.log(`   Clean Length: ${authInfo.cleanLength}`)
      console.log(`   Starts with: "${authInfo.startsWith}"`)
      console.log(`   Ends with: "${authInfo.endsWith}"`)
      console.log(`   SHA256: ${authInfo.sha256}`)
      console.log(`   Has spaces: ${authInfo.hasSpaces} (espacio entre "Bearer" y token es normal)`)
      console.log(`   Has multiple spaces: ${authInfo.hasMultipleSpaces} (anómalo)`)
      console.log(`   Has leading spaces: ${authInfo.hasLeadingSpaces} (anómalo)`)
      console.log(`   Has trailing spaces: ${authInfo.hasTrailingSpaces} (anómalo)`)
      console.log(`   Has line breaks: ${authInfo.hasLineBreaks}`)
      console.log(`   Has double Bearer: ${authInfo.hasDoubleBearer}`)
      console.log(`   Has quotes: ${authInfo.hasQuotes}`)
    }
    
    // Logging del runtime
    console.log(`🖥️ Runtime INFO:`)
    console.log(`   Node version: ${process.version}`)
    console.log(`   Platform: ${process.platform}`)
    console.log(`   Architecture: ${process.arch}`)
    console.log(`   Environment: ${process.env.NODE_ENV}`)
    console.log(`   Vercel region: ${process.env.VERCEL_REGION || 'unknown'}`)

    // Enviar request a EVO
    const requestStartTime = Date.now()
    const requestId = `${event.id}-${currentAttempt}-${Date.now()}`
    
    console.log(`🚀 Iniciando request HTTP a EVO:`)
    console.log(`   Request ID: ${requestId}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)
    console.log(`   Endpoint: ${event.endpoint}`)
    console.log(`   Connection header: close`)
    console.log(`   keepalive: false`)
    
    const response = await fetch(event.endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Connection': 'close',
        'X-Request-Timestamp': new Date().toISOString(),
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(event.payload),
      signal: controller.signal,
      // Forzar cierre de conexión TCP para evitar reuso en Vercel
      keepalive: false,
    })

    clearTimeout(timeoutId)

    const requestDuration = Date.now() - requestStartTime
    httpStatus = response.status
    
    console.log(`📨 Respuesta recibida:`)
    console.log(`   Request ID: ${requestId}`)
    console.log(`   HTTP Status: ${httpStatus}`)
    console.log(`   Status Text: ${response.statusText}`)
    console.log(`   Duration: ${requestDuration}ms`)
    
    // Capturar headers de respuesta
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    console.log(`   Response Headers:`, responseHeaders)
    console.log(`   Connection header en respuesta: ${responseHeaders['connection'] || 'no presente'}`)
    
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

// ============================================
// PROCESAR UN SOLO EVENTO PENDING CON LOCK
// ============================================

/**
 * Procesa un solo evento pending con lock interno.
 * Regla: Nunca enviar dos PREP en la misma ejecución de Vercel.
 * Regla: Nunca enviar un PREP nuevo hasta que el anterior esté confirmado.
 */
export async function processOnePendingPrep() {
  const supabase = createAdminClient()

  try {
    console.log('=== 🔄 PROCESS ONE PENDING PREP ===')

    // 1. Intentar adquirir lock
    const lockName = 'evo_prep_dispatcher'
    const lockTimeout = 60 // segundos

    const { data: currentLock } = await supabase
      .from('evo_locks')
      .select('*')
      .eq('name', lockName)
      .single()

    if (currentLock && currentLock.locked_until && new Date(currentLock.locked_until) > new Date()) {
      console.log('⏸️ Lock activo, no se puede procesar evento')
      return { success: true, message: 'Lock active, skipping' }
    }

    // Adquirir lock
    const lockedUntil = new Date(Date.now() + lockTimeout * 1000).toISOString()
    await supabase
      .from('evo_locks')
      .update({
        locked_until: lockedUntil,
        locked_by: 'processOnePendingPrep',
        updated_at: new Date().toISOString()
      })
      .eq('name', lockName)

    console.log('🔒 Lock adquirido')

    try {
      // 2. Verificar si hay un evento enviado esperando confirmación
      const { data: activeEvent } = await supabase
        .from('outbound_events')
        .select('*')
        .eq('status', 'processing')
        .limit(1)
        .maybeSingle()

      if (activeEvent) {
        console.log('⏸️ Hay un evento activo esperando confirmación, no enviar otro')
        return { success: true, message: 'Active event waiting for confirmation' }
      }

      // 3. Buscar el evento pending más antiguo
      const { data: pendingEvent, error } = await supabase
        .from('outbound_events')
        .select('*')
        .eq('status', 'pending')
        .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error || !pendingEvent) {
        console.log('ℹ️ No hay eventos pending para procesar')
        return { success: true, message: 'No pending events' }
      }

      console.log(`📋 Procesando evento: ${pendingEvent.id}`)
      console.log(`🆔 ID Evento EVO: ${pendingEvent.payload?.id_evento}`)

      // 4. Procesar el evento
      const result = await processOutboundEvent(pendingEvent.id)

      console.log(`📊 Resultado: ${result.success ? '✅ Success' : '❌ Failed'}`)
      console.log('=== FIN PROCESS ONE PENDING PREP ===\n')

      return { success: true, message: 'Event processed', result }

    } finally {
      // 5. Liberar lock
      await supabase
        .from('evo_locks')
        .update({
          locked_until: null,
          locked_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('name', lockName)

      console.log('🔓 Lock liberado')
    }

  } catch (error) {
    console.error('❌ Error en processOnePendingPrep:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
