import { Suspense } from 'react'
import { getOrders } from '@/app/actions/orders'
import OrdersGridWithFilters from '@/components/orders-grid-with-filters'
import GenerateTestOrderButton from './generate-test-order-button'
import { PageHeader } from '@/components/page-header'
import { testOrdersEnabled } from '@/lib/test-orders'

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
        actions={testOrdersEnabled() ? <GenerateTestOrderButton /> : undefined}
      />

      <Suspense fallback={null}>
        <OrdersGridWithFilters orders={orders} />
      </Suspense>
    </div>
  )
}
