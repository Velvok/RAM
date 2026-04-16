import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProducts() {
  console.log('🔍 Verificando productos...\n')
  
  // Productos que son chapas (AC*)
  const { data: chapas } = await supabase
    .from('products')
    .select('code, name')
    .like('code', 'AC%')
    .limit(5)
  
  console.log('📦 Chapas (AC*):')
  chapas?.forEach(p => console.log(`  - ${p.code}: ${p.name}`))
  
  // Productos que NO son chapas
  const { data: articulos } = await supabase
    .from('products')
    .select('code, name')
    .not('code', 'like', 'AC%')
    .limit(5)
  
  console.log('\n📦 Artículos normales (NO AC*):')
  if (articulos && articulos.length > 0) {
    articulos.forEach(p => console.log(`  - ${p.code}: ${p.name}`))
  } else {
    console.log('  ⚠️ No hay artículos normales en la base de datos')
  }
  
  // Contar totales
  const { count: totalChapas } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .like('code', 'AC%')
  
  const { count: totalArticulos } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .not('code', 'like', 'AC%')
  
  console.log(`\n📊 Total: ${totalChapas} chapas, ${totalArticulos} artículos normales`)
}

checkProducts()
