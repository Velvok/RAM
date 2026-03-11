'use client'

import { useState, useEffect } from 'react'
import { getOrderById } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, Clock, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import OrderActions from './order-actions'
import ReassignStockModal from '@/components/reassign-stock-modal'

export default function OrderDetailClient({ initialOrder }: { initialOrder: any }) {
  const [order, setOrder] = useState(initialOrder)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [selectedCutOrder, setSelectedCutOrder] = useState<any>(null)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)

  // Función para recargar el pedido completo
  async function reloadOrder() {
    try {
      const updated = await getOrderById(order.id)
      setOrder(updated)
      setRefreshKey(prev => prev + 1)
      await loadActivityLog()
    } catch (error) {
      console.error('Error reloading order:', error)
    }
  }

  // Cargar log de actividades
  async function loadActivityLog() {
    setLoadingLog(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('order_activity_log')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setActivityLog(data || [])
    } catch (error) {
      console.error('Error loading activity log:', error)
    } finally {
      setLoadingLog(false)
    }
  }

  // Cargar log al montar
  useEffect(() => {
    loadActivityLog()
  }, [order.id])

  function openReassignModal(cutOrder: any) {
    setSelectedCutOrder(cutOrder)
    setReassignModalOpen(true)
  }

  async function handleReassign(fromCutOrderId: string) {
    try {
      const { reassignStock } = await import('@/app/actions/stock-management')
      const result = await reassignStock(fromCutOrderId, selectedCutOrder.id)
      alert(`✅ Chapa reasignada correctamente\n\nDesde: ${result.fromOrder}\nA: ${result.toOrder}\nChapa: ${result.productCode}`)
      setReassignModalOpen(false)
      await reloadOrder()
    } catch (error: any) {
      console.error('Error reassigning:', error)
      alert('❌ Error al reasignar: ' + (error.message || 'Error desconocido'))
      throw error
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/pedidos">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {order.order_number}
            </h2>
            <p className="text-slate-600">
              Cliente: {order.client?.business_name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              order.status === 'ingresado'
                ? 'bg-blue-100 text-blue-800'
                : order.status === 'lanzado'
                ? 'bg-green-100 text-green-800'
                : order.status === 'generado'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Total
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {order.total_weight} m
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Monto Total
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(order.total_amount)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Fecha de Creación
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatDate(order.created_at)}
          </div>
        </div>
      </div>

      {/* Líneas del Pedido */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Líneas del Pedido
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Precio Unit.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {order.lines?.map((line: any) => (
                <tr key={line.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {line.product?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <span className="font-semibold">
                      {line.units || Math.ceil(line.quantity) || 1} unidades
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatCurrency(line.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {formatCurrency(line.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Órdenes de Corte */}
      {order.cut_orders && order.cut_orders.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">
              Órdenes de Corte
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Stock Asignado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {order.cut_orders.map((cutOrder: any) => (
                  <tr key={cutOrder.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {cutOrder.cut_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {cutOrder.product?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {cutOrder.material_base_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">
                            ✓ {cutOrder.material_base_quantity}m
                          </span>
                          {cutOrder.stock_disponible < 0 && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Sin stock
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-yellow-600">
                          Sin asignar
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cutOrder.status === 'pendiente' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completada
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cutOrder.status === 'pendiente' && (
                        <button
                          onClick={() => openReassignModal(cutOrder)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          <ArrowRightLeft className="w-3 h-3 mr-1" />
                          Reasignar
                        </button>
                      )}
                      {cutOrder.status === 'completada' && (
                        <span className="text-xs text-slate-400">Completado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid con Cliente y Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del Cliente */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Información del Cliente
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-slate-600">
                Razón Social
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {order.client?.business_name}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">CUIT</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {order.client?.tax_id}
              </dd>
            </div>
            {order.client?.contact_name && (
              <div>
                <dt className="text-sm font-medium text-slate-600">Contacto</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {order.client.contact_name}
                </dd>
              </div>
            )}
            {order.client?.contact_phone && (
              <div>
                <dt className="text-sm font-medium text-slate-600">Teléfono</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {order.client.contact_phone}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Acciones - Pasar función de recarga */}
        <OrderActions key={refreshKey} order={order} onUpdate={reloadOrder} />
      </div>

      {/* Log de Actividades */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            📋 Historial de Actividades
          </h3>
        </div>
        <div className="p-6">
          {loadingLog ? (
            <div className="text-center py-8 text-slate-400">
              Cargando historial...
            </div>
          ) : activityLog.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No hay actividades registradas
            </div>
          ) : (
            <div className="space-y-3">
              {activityLog.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    {activity.activity_type === 'reassign' ? (
                      <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(activity.created_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reasignación */}
      {selectedCutOrder && (
        <ReassignStockModal
          isOpen={reassignModalOpen}
          cutOrderId={selectedCutOrder.id}
          productSize={selectedCutOrder.quantity_requested}
          onClose={() => setReassignModalOpen(false)}
          onConfirm={handleReassign}
        />
      )}
    </div>
  )
}
