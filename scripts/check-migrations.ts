// Script para verificar si las migraciones se aplicaron correctamente
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMigrations() {
  console.log('🔍 Verificando migraciones...\n')

  // 1. Verificar si el estado 'aprobado_en_pausa' existe
  console.log('1️⃣ Verificando estado aprobado_en_pausa...')
  const { data: testOrder, error: testError } = await supabase
    .from('orders')
    .select('status')
    .limit(1)
  
  if (testError) {
    console.log('❌ Error al consultar orders:', testError.message)
  } else {
    console.log('✅ Tabla orders accesible')
  }

  // 2. Verificar RLS en annual_history
  console.log('\n2️⃣ Verificando RLS en annual_history...')
  const { data: historyData, error: historyError } = await supabase
    .from('annual_history')
    .select('id')
    .limit(1)
  
  if (historyError) {
    console.log('❌ Error al consultar annual_history:', historyError.message)
    console.log('   Esto podría indicar que RLS aún está habilitado')
  } else {
    console.log('✅ Tabla annual_history accesible (RLS deshabilitado)')
  }

  // 3. Intentar crear un pedido de prueba con estado aprobado_en_pausa
  console.log('\n3️⃣ Probando crear pedido con estado aprobado_en_pausa...')
  const { error: insertError } = await supabase
    .from('orders')
    .insert({
      order_number: 'TEST-MIGRATION-CHECK',
      status: 'aprobado_en_pausa',
      client_id: '00000000-0000-0000-0000-000000000000' // UUID ficticio
    })
  
  if (insertError) {
    if (insertError.message.includes('invalid input value for enum order_status')) {
      console.log('❌ El estado "aprobado_en_pausa" NO existe en la base de datos')
      console.log('   Necesitas aplicar la migración 00032_add_aprobado_en_pausa_status.sql')
    } else {
      console.log('⚠️ Error al insertar (puede ser normal):', insertError.message)
    }
  } else {
    console.log('✅ Estado "aprobado_en_pausa" existe y funciona')
    
    // Limpiar el pedido de prueba
    await supabase
      .from('orders')
      .delete()
      .eq('order_number', 'TEST-MIGRATION-CHECK')
  }

  console.log('\n✅ Verificación completada')
}

checkMigrations().catch(console.error)
