import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

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

async function checkReassignmentOrders() {
  const orderNumber = 'PED-TEST-1779180755902'
  const productCode = 'A*G25110.8,0'

  console.log(`🔍 Verificando pedido ${orderNumber} para producto ${productCode}\n`)

  // Obtener el pedido
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    console.error('❌ Pedido no encontrado')
    return
  }

  console.log(`📦 Pedido: ${order.order_number}`)
  console.log(`   Estado: ${order.status}\n`)

  // Obtener cut_orders de este producto
  const { data: cutOrders } = await supabase
    .from('cut_orders')
    .select(`
      id,
      cut_number,
      status,
      quantity_requested,
      quantity_cut,
      product:products!cut_orders_product_id_fkey(code, name)
    `)
    .eq('order_id', order.id)

  if (!cutOrders || cutOrders.length === 0) {
    console.log('ℹ️  No hay cut_orders')
    return
  }

  console.log(`📋 Cut Orders encontradas: ${cutOrders.length}\n`)

  const targetCutOrders = cutOrders.filter(co => {
    const product = Array.isArray(co.product) ? co.product[0] : co.product
    return product?.code === productCode
  })

  if (targetCutOrders.length === 0) {
    console.log(`⚠️  No hay cut_orders del producto ${productCode}`)
    return
  }

  console.log(`🎯 Cut Orders de ${productCode}: ${targetCutOrders.length}\n`)

  targetCutOrders.forEach(co => {
    const product = Array.isArray(co.product) ? co.product[0] : co.product
    console.log(`📌 ${co.cut_number}`)
    console.log(`   Producto: ${product?.code}`)
    console.log(`   Estado: ${co.status}`)
    console.log(`   Cortadas: ${co.quantity_cut}/${co.quantity_requested}`)
    console.log(`   ¿Disponible para reasignación? ${co.quantity_cut > 0 ? '✅ SÍ' : '❌ NO'}`)
    console.log()
  })
}

checkReassignmentOrders().catch(console.error)
