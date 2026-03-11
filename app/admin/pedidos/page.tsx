import { createClient } from '@/lib/supabase/server'
import OrdersGridWithFilters from '@/components/orders-grid-with-filters'
import GenerateTestOrderButton from './generate-test-order-button'

// Deshabilitar caché COMPLETAMENTE
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function generateMetadata() {
  return {
    other: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    }
  }
}

export default async function PedidosPage() {
  let orders = []

  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        lines:order_lines(*, product:products(*)),
        cut_orders:cut_orders!cut_orders_order_id_fkey(*)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Error loading orders:', error)
      throw error
    }
    
    console.log('✅ Pedidos cargados:', data?.length || 0)
    orders = data || []
  } catch (error) {
    console.error('❌ Error fatal loading orders:', error)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pedidos</h2>
          <p className="text-slate-600">Gestión de pedidos ordenados por fecha de entrada</p>
        </div>
        <GenerateTestOrderButton />
      </div>

      <OrdersGridWithFilters orders={orders} />
    </div>
  )
}
