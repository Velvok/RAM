'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCutOrderById } from '@/app/actions/cut-orders'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoader } from '@/components/ui/spinner'
import { getCutOrderStatusConfig } from '@/lib/cut-order-status'

export default function OrdenDetallePage() {
  const router = useRouter()
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    loadOrder()
  }, [params.id])

  async function loadOrder() {
    try {
      const data = await getCutOrderById(params.id as string)
      setOrder(data)
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader label="Cargando orden..." />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground text-xl">Orden no encontrada</div>
      </div>
    )
  }

  const statusConfig = getCutOrderStatusConfig(order.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-6 h-6" />
            <span>Volver</span>
          </button>
          <Badge variant={statusConfig.badgeVariant} className="px-4 py-2 text-sm">
            <StatusIcon className="w-4 h-4" />
            {statusConfig.label}
          </Badge>
        </div>

        <Card className="p-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">{order.cut_number}</h1>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Pedido</div>
              <div className="text-lg font-semibold text-foreground">{order.order?.order_number}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Cliente</div>
              <div className="text-lg font-semibold text-foreground">{order.order?.client?.business_name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Producto</div>
              <div className="text-lg font-semibold text-foreground">{order.product?.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Cantidad Solicitada</div>
              <div className="text-lg font-semibold text-foreground">{order.quantity_requested} m</div>
            </div>
            {order.material_base && (
              <>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Material Base</div>
                  <div className="text-lg font-semibold text-foreground">{order.material_base?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Cantidad Material</div>
                  <div className="text-lg font-semibold text-foreground">{order.material_base_quantity} m</div>
                </div>
              </>
            )}
          </div>

          {order.notes && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Notas</div>
              <div className="text-foreground">{order.notes}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
