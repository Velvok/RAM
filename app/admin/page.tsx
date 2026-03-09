import { createClient } from '@/lib/supabase/server'
import { MetricCard } from '@/components/metric-card'
import { Package, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import DashboardOrdersList from '@/components/dashboard-orders-list'

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

    // Obtener pedidos con toda la información necesaria
    const ordersResult = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        lines:order_lines(*, product:products(*)),
        cut_orders(*)
      `)
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

      {/* Lista de Pedidos Recientes */}
      <DashboardOrdersList orders={orders} />
    </div>
  )
}
