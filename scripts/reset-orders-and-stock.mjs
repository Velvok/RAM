// Elimina todos los pedidos actuales del sistema y libera el stock reservado/en proceso.
// stock_total NO se toca: desde el refactor de EVO como fuente de verdad, el flujo de
// corte ya no modifica stock_total (solo stock_reservado hasta la entrega, momento en
// el que consume_reserved_stock resta de stock_total y stock_reservado a la vez).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
})

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

async function del(table, filterFn) {
  const q = supabase.from(table).delete()
  const { error, count } = await (filterFn ? filterFn(q) : q.neq('id', '00000000-0000-0000-0000-000000000000'))
    .select('id', { count: 'exact' })
  if (error) {
    console.error(`❌ ${table}:`, error.message)
    throw error
  }
  console.log(`🗑️  ${table}: ${count ?? 0} filas eliminadas`)
  return count ?? 0
}

async function main() {
  const { data: orders, error: ordersErr } = await supabase.from('orders').select('id')
  if (ordersErr) throw ordersErr
  const orderIds = (orders || []).map(o => o.id)
  console.log(`📦 Pedidos encontrados: ${orderIds.length}`)

  if (orderIds.length === 0) {
    console.log('No hay pedidos que borrar.')
  } else {
    await del('evo_events', q => q.in('order_id', orderIds))
    await del('delivery_history', q => q.in('order_id', orderIds))
    await del('order_activity_log', q => q.in('order_id', orderIds))
    await del('dispatches', q => q.in('order_id', orderIds))
    await del('weighings', q => q.in('order_id', orderIds))
    await del('incidents', q => q.in('order_id', orderIds))
    await del('stock_reservations', q => q.in('order_id', orderIds))
    await del('cut_lines', q => q.not('cut_order_id', 'is', null))
    await del('cut_orders', q => q.in('order_id', orderIds))
    await del('preparation_items', q => q.in('order_id', orderIds))
    await del('order_lines', q => q.in('order_id', orderIds))
    await del('orders', q => q.in('id', orderIds))
  }

  console.log('\n🔄 Reseteando stock_reservado y stock_en_proceso de todo el inventario...')
  const { error: resetErr, count } = await supabase
    .from('inventory')
    .update({ stock_generado: 0, stock_reservado: 0, stock_en_proceso: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id', { count: 'exact' })

  if (resetErr) {
    console.error('❌ Error reseteando inventario:', resetErr.message)
    throw resetErr
  }
  console.log(`✅ Inventario reseteado en ${count ?? 0} filas (stock_total sin cambios)`)
  console.log('\n🎉 Reset completo.')
}

main().catch(err => {
  console.error('\n💥 Falló el reset:', err)
  process.exit(1)
})
