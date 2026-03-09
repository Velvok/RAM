import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package, Calendar, Layers } from 'lucide-react'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PlantaPedidosPage() {
  const supabase = await createClient()

  // Obtener pedidos aprobados y en corte con sus órdenes de corte
  const { data: orders, error } = await supabase
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
    .in('status', ['aprobado', 'en_corte'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading orders:', error)
  }

  const pedidos = orders || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pedidos Disponibles</h2>
        <p className="text-slate-600 mt-1">
          Selecciona un pedido para ver sus órdenes de corte
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">No hay pedidos disponibles</p>
          <p className="text-slate-400 text-sm mt-2">
            Los pedidos aparecerán aquí cuando el admin los apruebe
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidos.map((order) => {
            const totalCutOrders = order.cut_orders?.length || 0
            const completedCutOrders = order.cut_orders?.filter((co: any) => co.status === 'completada').length || 0
            const inProgressCutOrders = order.cut_orders?.filter((co: any) => co.status === 'en_proceso').length || 0
            const pendingCutOrders = totalCutOrders - completedCutOrders - inProgressCutOrders

            return (
              <Link
                key={order.id}
                href={`/planta/pedidos/${order.id}`}
                className="bg-white rounded-lg border-2 border-slate-200 hover:border-blue-400 p-5 transition-all hover:shadow-lg"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {order.order_number}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    order.status === 'en_corte' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.status === 'en_corte' ? 'En Corte' : 'Aprobado'}
                  </span>
                </div>

                {/* Órdenes de Corte */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Layers className="w-4 h-4" />
                    Órdenes de Corte
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="text-2xl font-bold text-slate-900">{totalCutOrders}</p>
                      <p className="text-xs text-slate-600">Total</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-2xl font-bold text-blue-600">{inProgressCutOrders}</p>
                      <p className="text-xs text-slate-600">En Proceso</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-2">
                      <p className="text-2xl font-bold text-yellow-600">{pendingCutOrders}</p>
                      <p className="text-xs text-slate-600">Pendientes</p>
                    </div>
                  </div>
                </div>

                {/* Indicador de acción */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm text-blue-600 font-semibold text-center">
                    Toca para ver órdenes →
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
