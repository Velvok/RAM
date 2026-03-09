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
  let orders = []
  let cutOrders = []
  let inventory = []
  let incidents = []

  try {
    const supabase = await createClient()

    const ordersResult = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    orders = ordersResult.data || []

    const cutOrdersResult = await supabase
      .from('cut_orders')
      .select('*')
      .in('status', ['lanzada', 'en_proceso'])
    cutOrders = cutOrdersResult.data || []

    const inventoryResult = await supabase
      .from('inventory')
      .select('*, products(*)')
    inventory = inventoryResult.data || []

    const incidentsResult = await supabase
      .from('incidents')
      .select('*')
      .is('resolved_at', null)
    incidents = incidentsResult.data || []
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  }

  const totalOrders = orders?.length || 0
  const activeOrders = cutOrders?.length || 0
  const lowStock = inventory?.filter((i: any) => i.stock_disponible < 100).length || 0
  const openIncidents = incidents?.length || 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-600 mt-1">Vista general del sistema de gestión</p>
      </div>

      {totalOrders === 0 && activeOrders === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Base de datos no configurada
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Parece que la base de datos aún no está configurada o no hay datos. 
                  Verifica que las variables de entorno estén correctas y que hayas ejecutado las migraciones de Supabase.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
