// Script para replicar exactamente el problema:
// Enviar 2 eventos PREP del mismo nro_item con diferentes id_evento

import { config } from 'dotenv'
config({ path: '.env.local' })

const RAM_API_KEY = process.env.RAM_API_KEY || process.env.EVO_API_KEY || ''
const EVO_ENDPOINT = 'http://186.138.17.53:8083/api-evo-velvokp/api/v1/stock/movimientos'

async function sendEvent(id_evento: string, delay: number = 0) {
  if (delay > 0) {
    console.log(`Esperando ${delay}ms antes de enviar...`)
    await new Promise(r => setTimeout(r, delay))
  }

  const payload = {
    ref_evo: {
      a_b_c: "I",
      codter: "17997",
      nromov: "100042873",
      codtipmov: "PEDIDO"
    },
    operario: "a39c495a-7d5b-4666-adf2-4402388a94f0",
    id_evento,
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

  console.log(`\n=== Enviando evento ${id_evento} ===`)
  console.log('Payload:', JSON.stringify(payload, null, 2))

  try {
    const response = await fetch(EVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAM_API_KEY}`,
        'Connection': 'close',
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

async function runTest() {
  console.log('=== TEST: Enviar 2 eventos PREP del mismo nro_item ===\n')
  console.log('API Key:', RAM_API_KEY ? `${RAM_API_KEY.substring(0, 10)}...` : 'NO CONFIGURADA')
  console.log('Endpoint:', EVO_ENDPOINT)

  // Evento 1
  const result1 = await sendEvent(`prep_test_1_${Date.now()}`)
  
  // SIN ESPERA - enviar inmediatamente
  // Evento 2 con diferente id_evento pero mismo nro_item
  const result2 = await sendEvent(`prep_test_2_${Date.now()}`)

  console.log('\n=== RESUMEN ===')
  console.log('Evento 1:', result1.status === 200 ? '✅ OK' : '❌ ERROR')
  console.log('Evento 2:', result2.status === 200 ? '✅ OK' : '❌ ERROR')
  
  if (result2.status === 401) {
    console.log('\n🔴 REPLICADO: El segundo evento da 401')
  } else if (result2.status === 200 && result2.body?.mensaje?.includes('ya recibido')) {
    console.log('\n🟡 DIFERENTE: El segundo evento da 200 pero dice "ya recibido"')
  } else {
    console.log('\n🟢 DIFERENTE: El segundo evento funciona correctamente')
  }
}

runTest().catch(console.error)
