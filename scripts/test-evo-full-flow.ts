// Script que replica exactamente el flujo del sistema:
// 1. Enviar evento 1
// 2. Encolar evento 2
// 3. Esperar confirmación (simulada)
// 4. Procesar evento 2 encolado

import { config } from 'dotenv'
config({ path: '.env.local' })

const RAM_API_KEY = process.env.RAM_API_KEY || process.env.EVO_API_KEY || ''
const EVO_ENDPOINT = 'http://186.138.17.53:8083/api-evo-velvokp/api/v1/stock/movimientos'

const queue: any[] = []

async function enqueueEvent(payload: any) {
  console.log(`\n📥 Encolando evento ${payload.id_evento}`)
  queue.push(payload)
  console.log(`✅ Evento encolado. Cola: ${queue.length} eventos`)
}

async function sendEvent(payload: any) {
  console.log(`\n📤 Enviando evento ${payload.id_evento}`)
  console.log('Payload:', JSON.stringify(payload, null, 2))

  try {
    const response = await fetch(EVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAM_API_KEY}`,
        'Connection': 'close',
        'X-Request-Timestamp': new Date().toISOString(),
        'X-Request-ID': `${payload.id_evento}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    })
    console.log(`Status: ${response.status}`)
    const body = await response.json()
    console.log('Response:', JSON.stringify(body, null, 2))
    return { status: response.status, body }
  } catch (error) {
    console.error('Error:', error)
    return { status: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

async function processNextPending() {
  if (queue.length === 0) {
    console.log('\nℹ️ No hay eventos pendientes en la cola')
    return null
  }

  const nextEvent = queue.shift()
  console.log(`\n🔄 Procesando siguiente evento pendiente: ${nextEvent.id_evento}`)
  
  // Delay de 2 segundos (como el webhook)
  console.log('⏳ Esperando 2 segundos antes de procesar...')
  await new Promise(r => setTimeout(r, 2000))
  
  const result = await sendEvent(nextEvent)
  return result
}

async function simulateConfirmation() {
  console.log('\n📨 Simulando confirmación de EVO...')
  console.log('⏳ Esperando 2 segundos antes de procesar siguiente evento...')
  await new Promise(r => setTimeout(r, 2000))
}

async function runFullFlow() {
  console.log('=== TEST: Flujo completo del sistema ===\n')
  console.log('API Key:', RAM_API_KEY ? `${RAM_API_KEY.substring(0, 10)}...` : 'NO CONFIGURADA')
  console.log('Endpoint:', EVO_ENDPOINT)

  // Paso 1: Enviar evento 1
  const event1 = {
    ref_evo: {
      a_b_c: "I",
      codter: "17997",
      nromov: "100042873",
      codtipmov: "PEDIDO"
    },
    operario: "a39c495a-7d5b-4666-adf2-4402388a94f0",
    id_evento: `prep_flow_1_${Date.now()}`,
    id_pedido: "100042873",
    timestamp: new Date().toISOString(),
    movimientos: [{
      tipo: "PREP",
      cantidad: 1,
      nro_item: "2",
      id_articulo: "TH2"
    }],
    tipo_evento: "corte_realizado"
  }

  const result1 = await sendEvent(event1)

  // Paso 2: Encolar evento 2
  const event2 = {
    ref_evo: {
      a_b_c: "I",
      codter: "17997",
      nromov: "100042873",
      codtipmov: "PEDIDO"
    },
    operario: "a39c495a-7d5b-4666-adf2-4402388a94f0",
    id_evento: `prep_flow_2_${Date.now()}`,
    id_pedido: "100042873",
    timestamp: new Date().toISOString(),
    movimientos: [{
      tipo: "PREP",
      cantidad: 1,
      nro_item: "2",
      id_articulo: "TH2"
    }],
    tipo_evento: "corte_realizado"
  }

  await enqueueEvent(event2)

  // Paso 3: Simular confirmación de EVO
  await simulateConfirmation()

  // Paso 4: Procesar evento 2 encolado
  const result2 = await processNextPending()

  console.log('\n=== RESUMEN ===')
  console.log('Evento 1:', result1.status === 200 ? '✅ OK' : '❌ ERROR')
  console.log('Evento 2:', result2?.status === 200 ? '✅ OK' : '❌ ERROR')
  
  if (result2?.status === 401) {
    console.log('\n🔴 REPLICADO: El segundo evento da 401 (como en Vercel)')
  } else if (result2?.status === 200) {
    console.log('\n🟢 DIFERENTE: El segundo evento funciona correctamente (como local)')
  }
}

runFullFlow().catch(console.error)
