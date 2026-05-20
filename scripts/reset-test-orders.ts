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

async function resetTestOrders() {
  const orderNumbers = ['PED-TEST-1779180554506', 'PED-TEST-1779180755902']

  console.log(`🔄 Reseteando pedidos de prueba...`)

  for (const orderNumber of orderNumbers) {
    console.log(`\n📦 Procesando ${orderNumber}...`)

    // 1. Obtener el pedido
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('order_number', orderNumber)
      .single()

    if (fetchError || !order) {
      console.error(`❌ Error obteniendo pedido ${orderNumber}:`, fetchError)
      continue
    }

    console.log(`   ID: ${order.id}`)
    console.log(`   Estado actual: ${order.status}`)

    // 2. Eliminar historial de actividad
    const { data: activityLog } = await supabase
      .from('order_activity_log')
      .select('id')
      .eq('order_id', order.id)

    if (activityLog && activityLog.length > 0) {
      console.log(`   🗑️  Eliminando ${activityLog.length} registros de actividad...`)
      
      const { error: deleteLogError } = await supabase
        .from('order_activity_log')
        .delete()
        .eq('order_id', order.id)

      if (deleteLogError) {
        console.error(`   ❌ Error eliminando actividad:`, deleteLogError)
      } else {
        console.log(`   ✅ Historial de actividad eliminado`)
      }
    }

    // 3. Eliminar todas las cut_orders
    const { data: cutOrders } = await supabase
      .from('cut_orders')
      .select('id')
      .eq('order_id', order.id)

    if (cutOrders && cutOrders.length > 0) {
      console.log(`   🗑️  Eliminando ${cutOrders.length} cut_orders...`)
      
      const { error: deleteError } = await supabase
        .from('cut_orders')
        .delete()
        .eq('order_id', order.id)

      if (deleteError) {
        console.error(`   ❌ Error eliminando cut_orders:`, deleteError)
      } else {
        console.log(`   ✅ Cut_orders eliminadas`)
      }
    } else {
      console.log(`   ℹ️  No hay cut_orders para eliminar`)
    }

    // 4. Eliminar preparation_items
    const { data: preparationItems } = await supabase
      .from('preparation_items')
      .select('id')
      .eq('order_id', order.id)

    if (preparationItems && preparationItems.length > 0) {
      console.log(`   🗑️  Eliminando ${preparationItems.length} preparation_items...`)
      
      const { error: deletePrepError } = await supabase
        .from('preparation_items')
        .delete()
        .eq('order_id', order.id)

      if (deletePrepError) {
        console.error(`   ❌ Error eliminando preparation_items:`, deletePrepError)
      } else {
        console.log(`   ✅ Preparation_items eliminados`)
      }
    }

    // 5. Eliminar stock_reservations
    const { data: reservations } = await supabase
      .from('stock_reservations')
      .select('id')
      .eq('order_id', order.id)

    if (reservations && reservations.length > 0) {
      console.log(`   🗑️  Eliminando ${reservations.length} stock_reservations...`)
      
      const { error: deleteReservationsError } = await supabase
        .from('stock_reservations')
        .delete()
        .eq('order_id', order.id)

      if (deleteReservationsError) {
        console.error(`   ❌ Error eliminando reservations:`, deleteReservationsError)
      } else {
        console.log(`   ✅ Stock_reservations eliminadas`)
      }
    }

    // 6. Resetear stock_reservado en inventory (poner a 0)
    console.log(`   🔄 Reseteando stock_reservado...`)
    const { error: resetStockError } = await supabase
      .from('inventory')
      .update({ stock_reservado: 0 })
      .gt('stock_reservado', 0)

    if (resetStockError) {
      console.error(`   ❌ Error reseteando stock:`, resetStockError)
    } else {
      console.log(`   ✅ Stock_reservado reseteado`)
    }

    // 7. Actualizar estado del pedido a 'nuevo'
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'nuevo' })
      .eq('id', order.id)

    if (updateError) {
      console.error(`   ❌ Error actualizando estado:`, updateError)
    } else {
      console.log(`   ✅ Estado actualizado a 'nuevo'`)
    }
  }

  console.log(`\n🎉 Pedidos reseteados exitosamente!`)
  console.log(`\nAhora ambos pedidos están en estado 'nuevo' sin cut_orders ni reservas de stock.`)
  console.log(`\nPuedes aprobarlos de nuevo para hacer las pruebas.`)
}

resetTestOrders().catch(console.error)
