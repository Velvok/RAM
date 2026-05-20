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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function duplicateOrder() {
  const originalOrderNumber = 'PED-TEST-1779180554506'
  const timestamp = Date.now()
  const newOrderNumber = `PED-TEST-${timestamp}`

  console.log(`🔄 Duplicando pedido ${originalOrderNumber} como ${newOrderNumber}...`)

  // 1. Obtener el pedido original
  const { data: originalOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', originalOrderNumber)
    .single()

  if (fetchError || !originalOrder) {
    console.error('❌ Error obteniendo pedido original:', fetchError)
    process.exit(1)
  }

  console.log(`✅ Pedido original encontrado: ${originalOrder.id}`)

  // 2. Obtener las líneas del pedido original
  const { data: originalLines, error: linesError } = await supabase
    .from('order_lines')
    .select('*')
    .eq('order_id', originalOrder.id)

  if (linesError) {
    console.error('❌ Error obteniendo líneas del pedido:', linesError)
    process.exit(1)
  }

  console.log(`✅ Líneas del pedido: ${originalLines?.length || 0}`)

  // 3. Crear el nuevo pedido
  const { data: newOrder, error: createError } = await supabase
    .from('orders')
    .insert({
      evo_order_id: newOrderNumber,
      order_number: newOrderNumber,
      client_id: originalOrder.client_id,
      status: 'nuevo',
      notes: `Pedido duplicado de ${originalOrderNumber} para pruebas`,
      evo_data: originalOrder.evo_data,
      ref_evo: originalOrder.ref_evo,
    })
    .select('id')
    .single()

  if (createError || !newOrder) {
    console.error('❌ Error creando nuevo pedido:', createError)
    process.exit(1)
  }

  console.log(`✅ Nuevo pedido creado: ${newOrder.id}`)

  // 4. Duplicar las líneas del pedido
  if (originalLines && originalLines.length > 0) {
    const newLines = originalLines.map(line => ({
      order_id: newOrder.id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      subtotal: line.subtotal,
      units: line.units,
      length_meters: line.length_meters,
    }))

    const { error: insertLinesError } = await supabase
      .from('order_lines')
      .insert(newLines)

    if (insertLinesError) {
      console.error('❌ Error creando líneas del pedido:', insertLinesError)
      process.exit(1)
    }

    console.log(`✅ ${newLines.length} líneas del pedido creadas`)
  }

  console.log(`\n🎉 Pedido duplicado exitosamente!`)
  console.log(`   Número original: ${originalOrderNumber}`)
  console.log(`   Número nuevo: ${newOrderNumber}`)
  console.log(`   ID nuevo: ${newOrder.id}`)
  console.log(`   Estado: nuevo`)
  console.log(`\n   URL: http://localhost:3000/admin/pedidos/${newOrder.id}`)
}

duplicateOrder().catch(console.error)
