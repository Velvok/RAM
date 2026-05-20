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

async function approveAndCompleteCutOrders() {
  const orderNumber = 'PED-TEST-1779180755902'

  console.log(`🔄 Procesando pedido ${orderNumber}...`)

  // 1. Obtener el pedido
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, cut_orders:cut_orders!cut_orders_order_id_fkey(id, status, quantity_requested, quantity_cut)')
    .eq('order_number', orderNumber)
    .single()

  if (fetchError || !order) {
    console.error('❌ Error obteniendo pedido:', fetchError)
    process.exit(1)
  }

  console.log(`✅ Pedido encontrado:`, {
    id: order.id,
    status: order.status,
    cut_orders: order.cut_orders?.length || 0
  })

  // 2. Si está en estado 'nuevo', aprobarlo
  if (order.status === 'nuevo') {
    console.log(`📝 Pedido en estado 'nuevo', aprobando...`)
    
    const { error: approveError } = await supabase
      .from('orders')
      .update({ status: 'aprobado' })
      .eq('id', order.id)

    if (approveError) {
      console.error('❌ Error aprobando pedido:', approveError)
      process.exit(1)
    }

    console.log(`✅ Pedido aprobado`)
  }

  // 3. Completar todas las cut_orders (marcar como cortadas)
  if (order.cut_orders && order.cut_orders.length > 0) {
    console.log(`📋 Completando ${order.cut_orders.length} cut_orders...`)

    for (const cutOrder of order.cut_orders) {
      const { error: updateError } = await supabase
        .from('cut_orders')
        .update({
          quantity_cut: cutOrder.quantity_requested,
          status: 'completada',
          finished_at: new Date().toISOString()
        })
        .eq('id', cutOrder.id)

      if (updateError) {
        console.error(`❌ Error completando cut_order ${cutOrder.id}:`, updateError)
      } else {
        console.log(`   ✅ Cut order ${cutOrder.id}: ${cutOrder.quantity_requested} unidades cortadas`)
      }
    }
  }

  // 4. Actualizar estado del pedido a 'finalizado'
  const { error: finalizeError } = await supabase
    .from('orders')
    .update({ status: 'finalizado' })
    .eq('id', order.id)

  if (finalizeError) {
    console.error('❌ Error finalizando pedido:', finalizeError)
    process.exit(1)
  }

  console.log(`\n🎉 Pedido ${orderNumber} completado!`)
  console.log(`   Estado: finalizado`)
  console.log(`   Cut orders completadas: ${order.cut_orders?.length || 0}`)
  console.log(`\n   Ahora debería aparecer en la lista de reasignación`)
}

approveAndCompleteCutOrders().catch(console.error)
