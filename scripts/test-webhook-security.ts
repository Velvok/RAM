#!/usr/bin/env ts-node

/**
 * Script para probar webhooks con seguridad completa
 * Genera headers válidos para autenticación
 */

import { WebhookSecurity } from '../lib/webhook-security'

// Configuración
const WEBHOOK_SECRET = 'evo_ram_webhook_2026_05_07_secure_token_kj8x9m2n3p4q5r6s7t8u9v0w1x2y3z4'
const WEBHOOK_URL = 'https://comercial-ram.vercel.app/api/webhooks/stock/actualizado'

// Crear instancia de seguridad
const security = new WebhookSecurity({
  secret: WEBHOOK_SECRET,
  enableHmac: true,
  enableBearerToken: true
})

// Payload de prueba
const testPayload = {
  id_evento: "test_security_" + Date.now(),
  tipo_evento: "stock_actualizado",
  version: 999999999,
  timestamp: new Date().toISOString(),
  items: [
    { id_articulo: "PUA", cantidad: 100 },
    { id_articulo: "AC25110.0,5", cantidad: 50 }
  ]
}

// Generar headers
const body = JSON.stringify(testPayload)
const headers = security.generateTestHeaders(body)

console.log('🔐 Headers generados para prueba:')
console.log('=====================================')
console.log('URL:', WEBHOOK_URL)
console.log('Method: POST')
console.log('')
console.log('Headers:')
Object.entries(headers).forEach(([key, value]) => {
  console.log(`${key}: ${value}`)
})
console.log('')
console.log('Body:')
console.log(JSON.stringify(testPayload, null, 2))
console.log('')
console.log('=====================================')
console.log('📋 Comando curl para probar:')
console.log('=====================================')

const curlCommand = `curl -X POST ${WEBHOOK_URL} \\
  ${Object.entries(headers).map(([key, value]) => `-H "${key}: ${value}"`).join(' \\\n  ')} \\
  -d '${JSON.stringify(testPayload)}'`

console.log(curlCommand)

// También generar comando para probar con errores (sin headers)
console.log('')
console.log('❌ Comando para probar SIN autenticación (debe dar 401):')
console.log('=====================================')
console.log(`curl -X POST ${WEBHOOK_URL} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testPayload)}'`)
