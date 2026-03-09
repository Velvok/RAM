import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Layers } from 'lucide-react'
import CutOrderCard from './cut-order-card'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PlantaPedidoDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      client:clients(*),
      cut_orders(
        *,
        product:products!cut_orders_product_id_fkey(*),
        assigned_operator:users!cut_orders_assigned_to_fkey(*)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !order) {
    notFound()
  }

  const cutOrders = order.cut_orders || []
  const pendingOrders = cutOrders.filter((co: any) => co.status === 'lanzada')
  const inProgressOrders = cutOrders.filter((co: any) => co.status === 'en_proceso')
  const completedOrders = cutOrders.filter((co: any) => co.status === 'completada')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/planta/pedidos"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a pedidos
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{order.order_number}</h2>
            <p className="text-slate-600 mt-1">
              Pedido del {new Date(order.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          <span className={`px-4 py-2 rounded-lg text-sm font-bold ${
            order.status === 'en_corte' 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {order.status === 'en_corte' ? 'En Corte' : 'Aprobado'}
          </span>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen del Pedido</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-3xl font-bold text-slate-900">{cutOrders.length}</p>
            <p className="text-sm text-slate-600 mt-1">Total Órdenes</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{pendingOrders.length}</p>
            <p className="text-sm text-slate-600 mt-1">Pendientes</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{inProgressOrders.length}</p>
            <p className="text-sm text-slate-600 mt-1">En Proceso</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{completedOrders.length}</p>
            <p className="text-sm text-slate-600 mt-1">Completadas</p>
          </div>
        </div>
      </div>

      {/* Órdenes de Corte */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">Órdenes de Corte</h3>
        </div>

        {cutOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay órdenes de corte</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pendientes */}
            {pendingOrders.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-yellow-700 mb-3 uppercase tracking-wide">
                  Pendientes ({pendingOrders.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingOrders.map((cutOrder: any) => (
                    <CutOrderCard key={cutOrder.id} cutOrder={cutOrder} />
                  ))}
                </div>
              </div>
            )}

            {/* En Proceso */}
            {inProgressOrders.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-700 mb-3 uppercase tracking-wide">
                  En Proceso ({inProgressOrders.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inProgressOrders.map((cutOrder: any) => (
                    <CutOrderCard key={cutOrder.id} cutOrder={cutOrder} />
                  ))}
                </div>
              </div>
            )}

            {/* Completadas */}
            {completedOrders.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-3 uppercase tracking-wide">
                  Completadas ({completedOrders.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedOrders.map((cutOrder: any) => (
                    <CutOrderCard key={cutOrder.id} cutOrder={cutOrder} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
