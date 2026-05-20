import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar variables de entorno
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

async function resetAll() {
  console.log('🔄 Reset completo de pedidos y stock...')

  const testOrderNumbers = ['PED-TEST-1779180554506', 'PED-TEST-1779180755902']

  for (const orderNumber of testOrderNumbers) {
    console.log(`\n📦 Procesando ${orderNumber}...`)

    // 1. Obtener el pedido
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .single()

    if (fetchError || !order) {
      console.error(`❌ Error obteniendo pedido ${orderNumber}:`, fetchError)
      continue
    }

    console.log(`   ID: ${order.id}`)

    // 2. Eliminar historial de actividad
    const { data: activityLog } = await supabase
      .from('order_activity_log')
      .select('id')
      .eq('order_id', order.id)

    if (activityLog && activityLog.length > 0) {
      console.log(`   🗑️  Eliminando ${activityLog.length} registros de actividad...`)
      await supabase.from('order_activity_log').delete().eq('order_id', order.id)
      console.log(`   ✅ Historial de actividad eliminado`)
    }

    // 3. Obtener productos del pedido
    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('product_id')
      .eq('order_id', order.id)

    // Recolectar inventarios
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

    // 4. Obtener cut_orders
    const { data: cutOrders } = await supabase
      .from('cut_orders')
      .select('id, material_base_id')
      .eq('order_id', order.id)

    if (cutOrders) {
      cutOrders.forEach(co => {
        if (co.material_base_id) inventoryIds.add(co.material_base_id)
      })
    }

    // 5. Obtener preparation_items
    const { data: preparationItems } = await supabase
      .from('preparation_items')
      .select('id, assigned_inventory_id')
      .eq('order_id', order.id)

    if (preparationItems) {
      preparationItems.forEach(pi => {
        if (pi.assigned_inventory_id) inventoryIds.add(pi.assigned_inventory_id)
      })
    }

    // 6. Eliminar cut_orders
    if (cutOrders && cutOrders.length > 0) {
      console.log(`   🗑️  Eliminando ${cutOrders.length} cut_orders...`)
      await supabase.from('cut_orders').delete().eq('order_id', order.id)
      console.log(`   ✅ Cut_orders eliminadas`)
    }

    // 7. Eliminar preparation_items
    if (preparationItems && preparationItems.length > 0) {
      console.log(`   🗑️  Eliminando ${preparationItems.length} preparation_items...`)
      await supabase.from('preparation_items').delete().eq('order_id', order.id)
      console.log(`   ✅ Preparation_items eliminados`)
    }

    // 8. Eliminar stock_reservations
    const { data: reservations } = await supabase
      .from('stock_reservations')
      .select('id')
      .eq('order_id', order.id)

    if (reservations && reservations.length > 0) {
      console.log(`   🗑️  Eliminando ${reservations.length} stock_reservations...`)
      await supabase.from('stock_reservations').delete().eq('order_id', order.id)
      console.log(`   ✅ Stock_reservations eliminadas`)
    }

    // 9. Eliminar delivery_history
    const { data: deliveryHistory } = await supabase
      .from('delivery_history')
      .select('id')
      .eq('order_id', order.id)

    if (deliveryHistory && deliveryHistory.length > 0) {
      console.log(`   🗑️  Eliminando ${deliveryHistory.length} delivery_history...`)
      await supabase.from('delivery_history').delete().eq('order_id', order.id)
      console.log(`   ✅ Delivery_history eliminado`)
    }

    // 10. Resetear stock de inventarios asociados a 60
    if (inventoryIds.size > 0) {
      console.log(`   🔄 Reseteando stock de ${inventoryIds.size} inventarios a 60...`)
      
      for (const invId of inventoryIds) {
        await supabase
          .from('inventory')
          .update({
            stock_total: 60,
            stock_generado: 0,
            stock_reservado: 0,
            stock_en_proceso: 0
          })
          .eq('id', invId)
      }
      console.log(`   ✅ Stock reseteado a 60`)
    }

    // 11. Actualizar estado del pedido a 'nuevo'
    await supabase
      .from('orders')
      .update({ status: 'nuevo' })
      .eq('id', order.id)

    console.log(`   ✅ Estado actualizado a 'nuevo'`)
  }

  // 12. Resetear stock_generado y stock_reservado de TODOS los inventarios a 0
  console.log(`\n🔄 Reseteando stock_generado y stock_reservado de TODOS los inventarios a 0...`)
  
  const { error: resetAllError } = await supabase
    .from('inventory')
    .update({
      stock_generado: 0,
      stock_reservado: 0,
      stock_en_proceso: 0
    })
    .neq('id', '00000000-0000-0000-0000-000000000000') // Actualizar todos

  if (resetAllError) {
    console.error(`❌ Error reseteando inventarios:`, resetAllError)
  } else {
    console.log(`✅ Todos los inventarios reseteados (generado=0, reservado=0, en_proceso=0)`)
  }

  console.log(`\n🎉 Reset completo exitoso!`)
  console.log(`\nPedidos en estado 'nuevo' con stock a 60.`)
  console.log(`Todos los inventarios con generado=0, reservado=0, en_proceso=0.`)
  console.log(`Listo para hacer pruebas.`)
}

resetAll().catch(console.error)
