import { createClient } from '@/lib/supabase/server'
import OrdersGridWithFilters from '@/components/orders-grid-with-filters'
import GenerateTestOrderButton from './generate-test-order-button'

// Deshabilitar caché para esta página
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PedidosPage() {
  let orders = []

  try {
    const supabase = await createClient()
    
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        lines:order_lines(*, product:products(*)),
        cut_orders(*)
      `)
      .order('created_at', { ascending: false })
    
    orders = data || []
  } catch (error) {
    console.error('Error loading orders:', error)
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
