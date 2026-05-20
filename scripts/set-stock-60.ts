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

async function setStock60() {
  console.log('🔄 Estableciendo stock a 60 para todos los inventarios...')

  const { data: inventories, error } = await supabase
    .from('inventory')
    .select('id, product_id, stock_total')
    .gt('stock_total', 0)

  if (error) {
    console.error('❌ Error obteniendo inventarios:', error)
    return
  }

  console.log(`📦 Encontrados ${inventories?.length || 0} inventarios con stock > 0`)

  for (const inv of inventories || []) {
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        stock_total: 60,
        stock_generado: 0,
        stock_reservado: 0,
        stock_en_proceso: 0
      })
      .eq('id', inv.id)

    if (updateError) {
      console.error(`❌ Error actualizando inventory ${inv.id}:`, updateError)
    } else {
      console.log(`✅ Inventory ${inv.id} actualizado a 60`)
    }
  }

  console.log('🎉 Stock actualizado a 60 para todos los inventarios')
}

setStock60().catch(console.error)
