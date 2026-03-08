import { createClient } from '@/lib/supabase/server'
import { MetricCard } from '@/components/metric-card'
import { Package, TrendingUp, AlertTriangle, Clock } from 'lucide-react'

import { getOrders } from '@/app/actions/orders'
import { getCutOrders } from '@/app/actions/cut-orders'
import { getInventory } from '@/app/actions/inventory'

// Deshabilitar caché para esta página
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: cutOrders } = await supabase
    .from('cut_orders')
    .select('*')
    .in('status', ['lanzada', 'en_proceso'])

  const { data: inventory } = await supabase
    .from('inventory')
    .select('*, products(*)')

  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .is('resolved_at', null)

  const totalOrders = orders?.length || 0
  const activeOrders = cutOrders?.length || 0
  const lowStock = inventory?.filter(i => i.stock_disponible < 100).length || 0
  const openIncidents = incidents?.length || 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-600 mt-1">Vista general del sistema de gestión</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Pedidos Recientes"
          value={totalOrders}
          icon={Package}
          trend="+12%"
        />
        <MetricCard
          title="Órdenes Activas"
          value={activeOrders}
          icon={Clock}
          trend="+5%"
        />
        <MetricCard
          title="Stock Bajo"
          value={lowStock}
          icon={AlertTriangle}
          variant="warning"
        />
        <MetricCard
          title="Incidencias"
          value={openIncidents}
          icon={TrendingUp}
          variant={openIncidents > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Pedidos Recientes
          </h3>
          <div className="space-y-3">
            {orders?.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-slate-900">{order.order_number}</p>
                  <p className="text-sm text-slate-600">
                    {new Date(order.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  order.status === 'lanzado' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'en_corte' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'despachado' ? 'bg-green-100 text-green-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Órdenes de Corte Activas
          </h3>
          <div className="space-y-3">
            {cutOrders?.slice(0, 5).map((cutOrder) => (
              <div
                key={cutOrder.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-slate-900">{cutOrder.cut_number}</p>
                  <p className="text-sm text-slate-600">
                    {cutOrder.quantity_requested} kg solicitados
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  cutOrder.status === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {cutOrder.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
