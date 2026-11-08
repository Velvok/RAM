'use client'

import { useParams, useRouter } from 'next/navigation'
import { PedidoDetalle } from '@/components/planta/pedido-detalle'

export default function PlantaPedidoDetallePage() {
  const router = useRouter()
  const params = useParams()
  return <PedidoDetalle pedidoId={params.id as string} onBack={() => router.push('/planta/pedidos')} />
}
