// Script de prueba para probar diferentes formas de enviar a EVO
// Este script prueba el mismo payload con diferentes configuraciones

const RAM_API_KEY = process.env.RAM_API_KEY || process.env.EVO_API_KEY || ''
const EVO_ENDPOINT = 'http://186.138.17.53:8083/api-evo-velvokp/api/v1/stock/movimientos'

const payload = {
  ref_evo: {
    a_b_c: "I",
    codter: "17997",
    nromov: "100042873",
    codtipmov: "PEDIDO"
  },
  operario: "a39c495a-7d5b-4666-adf2-4402388a94f0",
  id_evento: `prep_test_${Date.now()}`,
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

// Método 1: fetch estándar con Connection: close
async function testMethod1() {
  console.log('\n=== MÉTODO 1: fetch estándar con Connection: close ===')
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
    console.log('Response:', body)
    return { method: 1, status: response.status, body }
  } catch (error) {
    console.error('Error:', error)
    return { method: 1, error: error instanceof Error ? error.message : String(error) }
  }
}

// Método 2: fetch sin Connection header
async function testMethod2() {
  console.log('\n=== MÉTODO 2: fetch sin Connection header ===')
  try {
    const response = await fetch(EVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAM_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    console.log(`Status: ${response.status}`)
    const body = await response.json()
    console.log('Response:', body)
    return { method: 2, status: response.status, body }
  } catch (error) {
    console.error('Error:', error)
    return { method: 2, error: error instanceof Error ? error.message : String(error) }
  }
}

// Método 3: fetch con headers adicionales únicos
async function testMethod3() {
  console.log('\n=== MÉTODO 3: fetch con headers únicos ===')
  try {
    const response = await fetch(EVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAM_API_KEY}`,
        'X-Request-ID': `${Date.now()}`,
        'X-Request-Timestamp': new Date().toISOString(),
        'X-Cache-Control': 'no-cache',
      },
      body: JSON.stringify(payload),
    })
    console.log(`Status: ${response.status}`)
    const body = await response.json()
    console.log('Response:', body)
    return { method: 3, status: response.status, body }
  } catch (error) {
    console.error('Error:', error)
    return { method: 3, error: error instanceof Error ? error.message : String(error) }
  }
}

// Método 4: fetch con User-Agent aleatorio
async function testMethod4() {
  console.log('\n=== MÉTODO 4: fetch con User-Agent aleatorio ===')
  try {
    const response = await fetch(EVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAM_API_KEY}`,
        'User-Agent': `Velvok-Test-${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify(payload),
    })
    console.log(`Status: ${response.status}`)
    const body = await response.json()
    console.log('Response:', body)
    return { method: 4, status: response.status, body }
  } catch (error) {
    console.error('Error:', error)
    return { method: 4, error: error instanceof Error ? error.message : String(error) }
  }
}

// Ejecutar pruebas
async function runTests() {
  console.log('Iniciando pruebas de envío a EVO...')
  console.log('API Key:', RAM_API_KEY ? `${RAM_API_KEY.substring(0, 10)}...` : 'NO CONFIGURADA')
  console.log('Endpoint:', EVO_ENDPOINT)
  
  const results = []
  
  // Prueba 1
  await new Promise(r => setTimeout(r, 1000))
  results.push(await testMethod1())
  
  // Prueba 2
  await new Promise(r => setTimeout(r, 1000))
  results.push(await testMethod2())
  
  // Prueba 3
  await new Promise(r => setTimeout(r, 1000))
  results.push(await testMethod3())
  
  // Prueba 4
  await new Promise(r => setTimeout(r, 1000))
  results.push(await testMethod4())
  
  console.log('\n=== RESUMEN DE RESULTADOS ===')
  results.forEach(r => {
    console.log(`Método ${r.method}: ${r.status || 'ERROR'} - ${r.error || 'OK'}`)
  })
}

runTests().catch(console.error)
