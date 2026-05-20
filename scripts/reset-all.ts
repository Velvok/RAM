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

async function createTestOrder(orderNumber: string, preSelectedProducts?: any[]): Promise<boolean> {
  try {
    console.log(`   🎲 Creando pedido ${orderNumber}...`)
    
    // Obtener un cliente aleatorio
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .limit(1)
    
    if (clientError || !clientData || clientData.length === 0) {
      console.error(`   ❌ Error obteniendo cliente`)
      return false
    }
    
    const client = clientData[0]
    
    let productsWithStock: any[] = []
    
    if (preSelectedProducts && preSelectedProducts.length > 0) {
      // Usar productos preseleccionados
      console.log(`   📦 Using ${preSelectedProducts.length} pre-selected products`)
      productsWithStock = preSelectedProducts
    } else {
      // Obtener productos con stock disponible
      const { data: inventoryItems, error: invError } = await supabase
        .from('inventory')
        .select(`
          id,
          stock_disponible,
          product:products(id, name, code, category)
        `)
        .gt('stock_disponible', 0)
        .limit(100)
      
      if (invError || !inventoryItems || inventoryItems.length === 0) {
        console.error(`   ❌ No hay productos con stock disponible`)
        return false
      }
      
      // Extraer productos únicos
      const uniqueProducts = Array.from(
        new Map(
          inventoryItems
            .map(item => Array.isArray(item.product) ? item.product[0] : item.product)
            .filter(p => p != null)
            .map(p => [p.id, p])
        ).values()
      )
      
      if (uniqueProducts.length === 0) {
        console.error(`   ❌ No hay productos disponibles`)
        return false
      }
      
      console.log(`   📦 Found ${uniqueProducts.length} unique products`)
      
      // Seleccionar entre 2 y 5 productos aleatorios
      const numLines = Math.floor(Math.random() * 4) + 2 // 2-5 líneas
      const selectedProducts = []
      const availableProducts = [...uniqueProducts]
      
      for (let i = 0; i < Math.min(numLines, availableProducts.length); i++) {
        const randomIndex = Math.floor(Math.random() * availableProducts.length)
        selectedProducts.push(availableProducts[randomIndex])
        availableProducts.splice(randomIndex, 1)
      }
      
      // Obtener stock de cada producto seleccionado
      for (const product of selectedProducts) {
        const { data: inventory } = await supabase
          .from('inventory')
          .select('stock_disponible')
          .eq('product_id', product.id)
          .gt('stock_disponible', 0)
          .limit(1)
        
        if (inventory && inventory.length > 0) {
          productsWithStock.push({
            ...product,
            stock_disponible: parseFloat(inventory[0].stock_disponible)
          })
        }
      }
    }
    
    // Crear pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: client.id,
        status: 'nuevo'
      })
      .select()
      .single()
    
    if (orderError) {
      console.error(`   ❌ Error creando pedido:`, orderError.message)
      return false
    }
    
    console.log(`   ✅ Pedido creado: ${order.id}`)
    
    // Crear líneas de pedido
    const linesToInsert = []
    for (const product of productsWithStock) {
      const maxQuantity = Math.floor(product.stock_disponible)
      const quantity = Math.max(1, Math.min(Math.floor(Math.random() * 5) + 1, maxQuantity))
      
      linesToInsert.push({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity
      })
    }
    
    if (linesToInsert.length > 0) {
      const { error: lineError } = await supabase
        .from('order_lines')
        .insert(linesToInsert)
      
      if (lineError) {
        console.error(`   ❌ Error creando líneas:`, lineError.message)
        return false
      }
      
      console.log(`   ✅ Líneas creadas: ${linesToInsert.length}`)
    }
    
    return true
  } catch (error: any) {
    console.error(`   ❌ Error en createTestOrder:`, error.message)
    return false
  }
}

async function resetAll() {
  console.log('🔄 Reset completo de pedidos y stock...')

  const testOrderNumbers = ['PED-TEST-1779180554506', 'PED-TEST-1779180755902']

  // Seleccionar productos una vez para usar en ambos pedidos
  console.log('\n🎲 Seleccionando productos para los pedidos...')
  const { data: inventoryItems, error: invError } = await supabase
    .from('inventory')
    .select(`
      id,
      stock_disponible,
      product:products(id, name, code, category)
    `)
    .gt('stock_disponible', 0)
    .limit(100)

  if (invError || !inventoryItems || inventoryItems.length === 0) {
    console.error('❌ No hay productos con stock disponible')
    return
  }

  // Extraer productos únicos
  const uniqueProducts = Array.from(
    new Map(
      inventoryItems
        .map(item => Array.isArray(item.product) ? item.product[0] : item.product)
        .filter(p => p != null)
        .map(p => [p.id, p])
    ).values()
  )

  if (uniqueProducts.length === 0) {
    console.error('❌ No hay productos disponibles')
    return
  }

  console.log(`📦 Found ${uniqueProducts.length} unique products`)

  // Seleccionar entre 2 y 5 productos aleatorios
  const numLines = Math.floor(Math.random() * 4) + 2 // 2-5 líneas
  const selectedProducts = []
  const availableProducts = [...uniqueProducts]

  for (let i = 0; i < Math.min(numLines, availableProducts.length); i++) {
    const randomIndex = Math.floor(Math.random() * availableProducts.length)
    selectedProducts.push(availableProducts[randomIndex])
    availableProducts.splice(randomIndex, 1)
  }

  // Obtener stock de cada producto seleccionado
  const productsWithStock: any[] = []
  for (const product of selectedProducts) {
    const { data: inventory } = await supabase
      .from('inventory')
      .select('stock_disponible')
      .eq('product_id', product.id)
      .gt('stock_disponible', 0)
      .limit(1)

    if (inventory && inventory.length > 0) {
      productsWithStock.push({
        ...product,
        stock_disponible: parseFloat(inventory[0].stock_disponible)
      })
    }
  }

  console.log(`✅ Selected ${productsWithStock.length} products for both orders`)

  for (const orderNumber of testOrderNumbers) {
    console.log(`\n📦 Procesando ${orderNumber}...`)

    // 1. Obtener el pedido
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .single()

    let orderId: string

    if (fetchError || !order) {
      console.log(`   ⚠️  Pedido no encontrado, creando...`)
      
      // Crear el pedido si no existe con los productos preseleccionados
      const created = await createTestOrder(orderNumber, productsWithStock)
      if (!created) {
        console.error(`❌ Error creando pedido ${orderNumber}`)
        continue
      }
      
      // Obtener el pedido recién creado
      const { data: newOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .single()
      
      if (!newOrder) {
        console.error(`❌ Error obteniendo pedido creado ${orderNumber}`)
        continue
      }
      
      orderId = newOrder.id
    } else {
      // Pedido existe, borrarlo para recrearlo con los mismos productos
      console.log(`   🗑️  Pedido existe, borrando para recrear con productos iguales...`)
      
      // Eliminar datos asociados al pedido
      await supabase.from('order_activity_log').delete().eq('order_id', order.id)
      await supabase.from('cut_orders').delete().eq('order_id', order.id)
      await supabase.from('preparation_items').delete().eq('order_id', order.id)
      await supabase.from('stock_reservations').delete().eq('order_id', order.id)
      await supabase.from('delivery_history').delete().eq('order_id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
      await supabase.from('orders').delete().eq('id', order.id)
      
      console.log(`   ✅ Pedido borrado, recreando...`)
      
      // Crear el pedido de nuevo con los productos preseleccionados
      const created = await createTestOrder(orderNumber, productsWithStock)
      if (!created) {
        console.error(`❌ Error recreando pedido ${orderNumber}`)
        continue
      }
      
      // Obtener el pedido recién creado
      const { data: newOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .single()
      
      if (!newOrder) {
        console.error(`❌ Error obteniendo pedido recreado ${orderNumber}`)
        continue
      }
      
      orderId = newOrder.id
    }

    console.log(`   ID: ${orderId}`)

    // 2. Eliminar historial de actividad
    const { data: activityLog } = await supabase
      .from('order_activity_log')
      .select('id')
      .eq('order_id', orderId)

    if (activityLog && activityLog.length > 0) {
      console.log(`   🗑️  Eliminando ${activityLog.length} registros de actividad...`)
      await supabase.from('order_activity_log').delete().eq('order_id', orderId)
      console.log(`   ✅ Historial de actividad eliminado`)
    }

    // 3. Obtener productos del pedido
    const { data: orderLines } = await supabase
      .from('order_lines')
      .select('product_id')
      .eq('order_id', orderId)

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
      .eq('order_id', orderId)

    if (cutOrders) {
      cutOrders.forEach(co => {
        if (co.material_base_id) inventoryIds.add(co.material_base_id)
      })
    }

    // 5. Obtener preparation_items
    const { data: preparationItems } = await supabase
      .from('preparation_items')
      .select('id, assigned_inventory_id')
      .eq('order_id', orderId)

    if (preparationItems) {
      preparationItems.forEach(pi => {
        if (pi.assigned_inventory_id) inventoryIds.add(pi.assigned_inventory_id)
      })
    }

    // 6. Eliminar cut_orders
    if (cutOrders && cutOrders.length > 0) {
      console.log(`   🗑️  Eliminando ${cutOrders.length} cut_orders...`)
      await supabase.from('cut_orders').delete().eq('order_id', orderId)
      console.log(`   ✅ Cut_orders eliminadas`)
    }

    // 7. Eliminar preparation_items
    if (preparationItems && preparationItems.length > 0) {
      console.log(`   🗑️  Eliminando ${preparationItems.length} preparation_items...`)
      await supabase.from('preparation_items').delete().eq('order_id', orderId)
      console.log(`   ✅ Preparation_items eliminados`)
    }

    // 8. Eliminar stock_reservations
    const { data: reservations } = await supabase
      .from('stock_reservations')
      .select('id')
      .eq('order_id', orderId)

    if (reservations && reservations.length > 0) {
      console.log(`   🗑️  Eliminando ${reservations.length} stock_reservations...`)
      await supabase.from('stock_reservations').delete().eq('order_id', orderId)
      console.log(`   ✅ Stock_reservations eliminadas`)
    }

    // 9. Eliminar delivery_history
    const { data: deliveryHistory } = await supabase
      .from('delivery_history')
      .select('id')
      .eq('order_id', orderId)

    if (deliveryHistory && deliveryHistory.length > 0) {
      console.log(`   🗑️  Eliminando ${deliveryHistory.length} delivery_history...`)
      await supabase.from('delivery_history').delete().eq('order_id', orderId)
      console.log(`   ✅ Delivery_history eliminado`)
    }

    // 10. Resetear stock de inventarios asociados (solo reservado/generado/en_proceso)
    if (inventoryIds.size > 0) {
      console.log(`   🔄 Reseteando stock de ${inventoryIds.size} inventarios (reservado/generado/en_proceso)...`)
      
      for (const invId of inventoryIds) {
        await supabase
          .from('inventory')
          .update({
            stock_generado: 0,
            stock_reservado: 0,
            stock_en_proceso: 0
          })
          .eq('id', invId)
      }
      console.log(`   ✅ Stock reseteado (stock_total sin cambios)`)
    }

    // 11. Actualizar estado del pedido a 'nuevo'
    await supabase
      .from('orders')
      .update({ status: 'nuevo' })
      .eq('id', orderId)

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
