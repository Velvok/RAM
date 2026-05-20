import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractSizeFromCode, extractFamilyCode } from '../lib/product-utils'

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

async function testFindStock() {
  // Producto solicitado: A*G25110.8,0 (8 metros)
  const productId = '044bdbf8-e6a1-4a35-9edf-2f8ea9cdcdea'
  const quantityNeeded = 8

  console.log('🧪 Simulando findBestStockMatch...\n')
  console.log(`Producto solicitado: A*G25110.8,0`)
  console.log(`Cantidad necesaria: ${quantityNeeded}m\n`)

  // Obtener el producto
  const { data: requestedProduct } = await supabase
    .from('products')
    .select('code, name')
    .eq('id', productId)
    .single()

  if (!requestedProduct) {
    console.error('❌ Producto no encontrado')
    return
  }

  const baseCode = extractFamilyCode(requestedProduct.code)
  console.log(`Código de familia: ${baseCode}\n`)

  // Buscar productos de la misma familia
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, code, name')
    .or(`code.ilike.${baseCode}.%,code.ilike.${baseCode.replace(/\s/g, '')}.%`)

  console.log(`Productos de la familia encontrados: ${allProducts?.length || 0}`)

  if (!allProducts || allProducts.length === 0) {
    return
  }

  const productIds = allProducts.map(p => p.id)

  // Buscar stock disponible
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .in('product_id', productIds)
    .gt('stock_total', 0)
    .order('stock_total', { ascending: true })

  console.log(`Stock encontrado: ${inventory?.length || 0}\n`)

  if (!inventory || inventory.length === 0) {
    console.log('❌ No hay stock disponible')
    return
  }

  // Agregar tamaño extraído
  const inventoryWithSize = inventory.map(item => ({
    ...item,
    size: extractSizeFromCode(item.product?.code || '')
  }))

  console.log('📦 Stock con tamaños:')
  inventoryWithSize.forEach(item => {
    console.log(`   ${item.product?.code} → ${item.size}m (${item.stock_total} unidades)`)
  })

  // Buscar match exacto
  const exactMatch = inventoryWithSize.find(
    (item) => item.size === quantityNeeded && item.stock_total > 0
  )

  if (exactMatch) {
    console.log(`\n✅ Match exacto encontrado:`)
    console.log(`   Código: ${exactMatch.product?.code}`)
    console.log(`   Tamaño: ${exactMatch.size}m`)
    console.log(`   quantity que se devolvería: ${exactMatch.size}`)
    return
  }

  // Buscar siguiente más grande
  const nextBigger = inventoryWithSize
    .filter(item => item.size > quantityNeeded && item.stock_total > 0)
    .sort((a, b) => a.size - b.size)[0]

  if (nextBigger) {
    console.log(`\n✅ Match aproximado (siguiente más grande):`)
    console.log(`   Código: ${nextBigger.product?.code}`)
    console.log(`   Tamaño: ${nextBigger.size}m`)
    console.log(`   quantity que se devolvería: ${nextBigger.size}`)
  } else {
    console.log(`\n❌ No hay piezas suficientemente grandes`)
  }
}

testFindStock().catch(console.error)
