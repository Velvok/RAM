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

async function checkCutOrder() {
  const orderNumber = 'PED-TEST-1779180554506'

  console.log(`🔍 Verificando pedido ${orderNumber}...\n`)

  // Obtener el pedido
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    console.error('❌ Pedido no encontrado')
    return
  }

  // Obtener cut_orders
  const { data: cutOrders } = await supabase
    .from('cut_orders')
    .select(`
      id,
      cut_number,
      material_base_id,
      material_base_quantity,
      product:products!cut_orders_product_id_fkey(code, name)
    `)
    .eq('order_id', order.id)

  if (!cutOrders || cutOrders.length === 0) {
    console.log('ℹ️  No hay cut_orders')
    return
  }

  console.log(`📦 Cut Orders encontradas: ${cutOrders.length}\n`)

  for (const co of cutOrders) {
    console.log(`\n🔹 ${co.cut_number}`)
    const product = Array.isArray(co.product) ? co.product[0] : co.product
    console.log(`   Producto: ${product?.code} - ${product?.name}`)
    console.log(`   material_base_id: ${co.material_base_id || 'NULL'}`)
    console.log(`   material_base_quantity: ${co.material_base_quantity || 'NULL'}`)

    if (co.material_base_id) {
      // Primero verificar si es un product_id
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, code, name')
        .eq('id', co.material_base_id)
        .single()

      if (!productError && product) {
        console.log(`   ✅ material_base_id es un PRODUCT_ID:`)
        console.log(`      Producto: ${product.code} - ${product.name}`)
        
        // Buscar inventory de este producto
        const { data: inventories } = await supabase
          .from('inventory')
          .select('id, stock_total, stock_disponible')
          .eq('product_id', co.material_base_id)
        
        console.log(`      Inventories encontrados: ${inventories?.length || 0}`)
      } else {
        // Intentar como inventory_id
        const { data: inventory, error } = await supabase
          .from('inventory')
          .select('id, product:products(code, name)')
          .eq('id', co.material_base_id)
          .single()

        if (error) {
          console.log(`   ❌ No es product_id ni inventory_id: ${error.message}`)
        } else if (inventory) {
          console.log(`   ✅ material_base_id es un INVENTORY_ID:`)
          console.log(`      ID: ${inventory.id}`)
          const invProduct = Array.isArray(inventory.product) ? inventory.product[0] : inventory.product
          console.log(`      Producto: ${invProduct?.code}`)
        }
      }
    }
  }
}

checkCutOrder().catch(console.error)
