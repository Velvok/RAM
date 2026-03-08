import { getOrderById } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import OrderDetailClient from './order-detail-client'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Pedido no encontrado
          </h2>
          <Link href="/admin/pedidos">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a pedidos
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <OrderDetailClient initialOrder={order} />
}
