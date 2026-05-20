import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar variables de entorno desde .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    envVars[key] = value
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL!,
  envVars.SUPABASE_SERVICE_ROLE_KEY!,
)

async function createTestOrders() {
  console.log('🔄 Creando pedidos de prueba...')

  // Obtener el cliente de prueba
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .limit(1)

  if (clientError || !clients || clients.length === 0) {
    console.error('❌ No se encontraron clientes')
    return
  }

  const clientId = clients[0].id

  // Obtener productos de prueba
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, code, name, category, unit, length_meters, evo_product_id')
    .limit(5)

  if (productsError || !products || products.length === 0) {
    console.error('❌ No se encontraron productos')
    return
  }

  const testOrderNumbers = ['PED-TEST-1779180554506', 'PED-TEST-1779180755902']

  for (const orderNumber of testOrderNumbers) {
    console.log(`📦 Creando pedido ${orderNumber}...`)

    // Crear el pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: clientId,
        status: 'nuevo',
        total_amount: 0,
        notes: 'Pedido de prueba para retiradas parciales'
      })
      .select()
      .single()

    if (orderError) {
      console.error(`❌ Error creando pedido ${orderNumber}:`, orderError)
      continue
    }

    console.log(`✅ Pedido creado: ${order.id}`)

    // Crear líneas del pedido
    for (let i = 0; i < 3; i++) {
      const product = products[i % products.length]
      
      const { error: lineError } = await supabase
        .from('order_lines')
        .insert({
          order_id: order.id,
          product_id: product.id,
          quantity: (i + 1) * 5,
          units: i + 1
        })

      if (lineError) {
        console.error(`❌ Error creando línea ${i}:`, lineError)
      }
    }

    console.log(`✅ Líneas creadas para ${orderNumber}`)
  }

  console.log('🎉 Pedidos de prueba creados exitosamente!')
}

createTestOrders().catch(console.error)
