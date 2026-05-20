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
  console.log('🔄 Reseteando pedidos de prueba...')

  const testOrderNumbers = ['PED-TEST-1779180554506', 'PED-TEST-1779180755902']

  for (const orderNumber of testOrderNumbers) {
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

    // 3. Obtener los productos del pedido desde order_lines
    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('product_id')
      .eq('order_id', order.id)

    // Recolectar todos los inventory_ids asociados a los productos del pedido
    const inventoryIds = new Set<string>()
    if (orderLines && orderLines.length > 0) {
      console.log(`   🔍 Buscando inventarios para ${orderLines.length} productos...`)
      
      for (const line of orderLines) {
        const { data: inventories } = await supabase
          .from('inventory')
          .select('id')
          .eq('product_id', line.product_id)
        
        if (inventories) {
          inventories.forEach(inv => inventoryIds.add(inv.id))
        }
      }
    }

    // 4. Obtener cut_orders con sus inventory_ids antes de eliminar
    const { data: cutOrders } = await supabase
      .from('cut_orders')
      .select('id, material_base_id')
      .eq('order_id', order.id)

    // Obtener preparation_items con sus inventory_ids
    const { data: preparationItems } = await supabase
      .from('preparation_items')
      .select('id, assigned_inventory_id')
      .eq('order_id', order.id)

    // Agregar inventarios de cut_orders y preparation_items
    if (cutOrders) {
      cutOrders.forEach(co => {
        if (co.material_base_id) inventoryIds.add(co.material_base_id)
      })
    }
    if (preparationItems) {
      preparationItems.forEach(pi => {
        if (pi.assigned_inventory_id) inventoryIds.add(pi.assigned_inventory_id)
      })
    }

    // Eliminar todas las cut_orders
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

    // 5. Eliminar preparation_items
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

    // 5. Resetear stock de los inventarios asociados a este pedido
    if (inventoryIds.size > 0) {
      console.log(`   🔄 Reseteando stock de ${inventoryIds.size} inventarios asociados...`)
      
      for (const invId of inventoryIds) {
        const { error: resetStockError } = await supabase
          .from('inventory')
          .update({
            stock_total: 0,
            stock_generado: 0,
            stock_reservado: 0
          })
          .eq('id', invId)

        if (resetStockError) {
          console.error(`   ❌ Error reseteando stock para inventory ${invId}:`, resetStockError)
        } else {
          console.log(`   ✅ Stock reseteado para inventory ${invId}`)
        }
      }
    }

    // 6. Eliminar stock_reservations
    const { data: reservations } = await supabase
      .from('stock_reservations')
      .select('id, inventory_id')
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

    // 7. Eliminar delivery_history (historial de entregas)
    const { data: deliveryHistory } = await supabase
      .from('delivery_history')
      .select('id, stock_consumed')
      .eq('order_id', order.id)

    if (deliveryHistory && deliveryHistory.length > 0) {
      console.log(`   🗑️  Eliminando ${deliveryHistory.length} registros de delivery_history...`)
      
      const { error: deleteHistoryError } = await supabase
        .from('delivery_history')
        .delete()
        .eq('order_id', order.id)

      if (deleteHistoryError) {
        console.error(`   ❌ Error eliminando delivery_history:`, deleteHistoryError)
      } else {
        console.log(`   ✅ Delivery_history eliminado`)
      }
    }

    // 8. Actualizar estado del pedido a 'nuevo'
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
  console.log(`\nAhora ambos pedidos están en estado 'nuevo' sin cut_orders, reservas ni entregas.`)
  console.log(`El stock de los inventarios asociados ha sido reseteado a 0.`)
  console.log(`\nPuedes aprobarlos de nuevo para hacer las pruebas.`)
}

resetTestOrders().catch(console.error)
