import { getOrders } from '@/app/actions/orders'
import OrdersGridWithFilters from '@/components/orders-grid-with-filters'
import GenerateTestOrderButton from './generate-test-order-button'
import { PageHeader } from '@/components/page-header'

// Deshabilitar caché COMPLETAMENTE
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function generateMetadata() {
  return {
    other: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  }
}

export default async function PedidosPage() {
  let orders = []

  try {
    orders = await getOrders()
  } catch (error) {
    console.error('❌ Error fatal loading orders:', error)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Gestión de pedidos ordenados por fecha de entrada"
        actions={<GenerateTestOrderButton />}
      />

      <OrdersGridWithFilters orders={orders} />
    </div>
  )
}
