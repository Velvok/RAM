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

async function fixTestStock() {
  console.log('🔄 Arreglando stock de los 5 inventarios de prueba...')

  const inventoryIds = [
    '0d433e71-7502-4fb7-b819-7a596ba6bd3f',
    '650d3ec7-d405-4002-8a02-7f6ed971950b',
    '1c6ef8a4-dd67-4683-8906-45c9a1aff34d',
    '0cf1c158-c432-4b1f-9de4-51b19d5ceddc',
    '2ffc8d94-6923-47b9-abee-b847594ff3c7'
  ]

  for (const invId of inventoryIds) {
    const { error } = await supabase
      .from('inventory')
      .update({
        stock_total: 60,
        stock_generado: 0,
        stock_reservado: 0,
        stock_en_proceso: 0
      })
      .eq('id', invId)

    if (error) {
      console.error(`❌ Error actualizando inventory ${invId}:`, error)
    } else {
      console.log(`✅ Inventory ${invId} actualizado a 60`)
    }
  }

  console.log('🎉 Stock de prueba actualizado')
}

fixTestStock().catch(console.error)
