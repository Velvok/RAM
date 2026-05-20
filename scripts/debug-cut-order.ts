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

async function debugCutOrder() {
  // El cut_number de la imagen
  const cutNumber = 'CUT-1779207714301-cunwge5l9'

  console.log(`🔍 Buscando cut_order: ${cutNumber}\n`)

  const { data: cutOrder, error } = await supabase
    .from('cut_orders')
    .select('*')
    .eq('cut_number', cutNumber)
    .single()

  if (error || !cutOrder) {
    console.error('❌ Error:', error)
    return
  }

  console.log('📋 Cut Order encontrada:')
  console.log('   ID:', cutOrder.id)
  console.log('   product_id:', cutOrder.product_id)
  console.log('   material_base_id:', cutOrder.material_base_id)
  console.log('   material_base_quantity:', cutOrder.material_base_quantity)
  console.log('   status:', cutOrder.status)

  // Verificar si material_base_id es un product
  if (cutOrder.material_base_id) {
    console.log('\n🔍 Verificando material_base_id...')
    
    const { data: product } = await supabase
      .from('products')
      .select('id, code, name')
      .eq('id', cutOrder.material_base_id)
      .single()

    if (product) {
      console.log('✅ material_base_id ES un product_id:')
      console.log('   Código:', product.code)
      console.log('   Nombre:', product.name)

      // Buscar inventory de este producto
      const { data: inventories } = await supabase
        .from('inventory')
        .select('id, stock_total, stock_disponible, stock_reservado')
        .eq('product_id', cutOrder.material_base_id)

      console.log(`\n📦 Inventories de este producto: ${inventories?.length || 0}`)
      if (inventories && inventories.length > 0) {
        inventories.forEach((inv, i) => {
          console.log(`   [${i + 1}] ID: ${inv.id}`)
          console.log(`       Total: ${inv.stock_total}, Disponible: ${inv.stock_disponible}, Reservado: ${inv.stock_reservado}`)
        })
      }
    } else {
      console.log('⚠️ material_base_id NO es un product_id')
    }
  }

  // Simular lo que hace getCutOrderWithAssignment
  console.log('\n🧪 Simulando getCutOrderWithAssignment...')
  if (cutOrder.material_base_id) {
    const { data: inventories, error: invError } = await supabase
      .from('inventory')
      .select('*, product:products(*)')
      .eq('product_id', cutOrder.material_base_id)
      .gt('stock_disponible', 0)
      .limit(1)

    console.log('   Query: .eq(product_id, material_base_id).gt(stock_disponible, 0).limit(1)')
    console.log('   Error:', invError || 'ninguno')
    console.log('   Resultados:', inventories?.length || 0)
    
    if (inventories && inventories.length > 0) {
      console.log('   ✅ assigned_inventory encontrado:')
      console.log('      ID:', inventories[0].id)
      console.log('      Producto:', inventories[0].product?.code)
      console.log('      Stock disponible:', inventories[0].stock_disponible)
    } else {
      console.log('   ❌ NO se encontró assigned_inventory')
    }
  }
}

debugCutOrder().catch(console.error)
