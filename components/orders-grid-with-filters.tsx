'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OrderDetailModal from './order-detail-modal'
import { generateCutOrders } from '@/app/actions/orders'
import { Package, Calendar, User, DollarSign, CheckCircle, Clock, AlertCircle, Loader2, Filter } from 'lucide-react'

interface OrdersGridWithFiltersProps {
  orders: any[]
}

export default function OrdersGridWithFilters({ orders }: OrdersGridWithFiltersProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const router = useRouter()

  // Función para calcular el estado real basado en órdenes de corte
  function getOrderRealStatus(order: any) {
    const cutOrders = order.cut_orders || []
    const totalCutOrders = cutOrders.length
    
    if (totalCutOrders === 0) {
      return 'ingresado'
    }

    const completedCutOrders = cutOrders.filter((co: any) => co.status === 'completada').length
    const inProgressCutOrders = cutOrders.filter((co: any) => co.status === 'en_proceso').length

    if (completedCutOrders === totalCutOrders) {
      return 'completado'
    } else if (inProgressCutOrders > 0 || completedCutOrders > 0) {
      return 'en_proceso'
    } else {
      return 'lanzado'
    }
  }

  // Función para obtener info de estado
  function getStatusInfo(status: string) {
    const statusMap: any = {
      ingresado: {
        color: 'bg-slate-500',
        textColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        text: 'Ingresado',
        icon: AlertCircle
      },
      lanzado: {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        text: 'Lanzado',
        icon: Package
      },
      en_proceso: {
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        text: 'En Proceso',
        icon: Clock
      },
      completado: {
        color: 'bg-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        text: 'Completado',
        icon: CheckCircle
      }
    }
    return statusMap[status] || statusMap.ingresado
  }

  // Filtrar pedidos
  const filteredOrders = statusFilter === 'todos' 
    ? orders 
    : orders.filter(o => getOrderRealStatus(o) === statusFilter)

  // Contar por estado
  const statusCounts = {
    todos: orders.length,
    ingresado: orders.filter(o => getOrderRealStatus(o) === 'ingresado').length,
    lanzado: orders.filter(o => getOrderRealStatus(o) === 'lanzado').length,
    en_proceso: orders.filter(o => getOrderRealStatus(o) === 'en_proceso').length,
    completado: orders.filter(o => getOrderRealStatus(o) === 'completado').length
  }

  const filters = [
    { id: 'todos', label: 'Todos', count: statusCounts.todos, color: 'bg-slate-600' },
    { id: 'ingresado', label: 'Ingresados', count: statusCounts.ingresado, color: 'bg-slate-500' },
    { id: 'lanzado', label: 'Lanzados', count: statusCounts.lanzado, color: 'bg-yellow-500' },
    { id: 'en_proceso', label: 'En Proceso', count: statusCounts.en_proceso, color: 'bg-blue-500' },
    { id: 'completado', label: 'Completados', count: statusCounts.completado, color: 'bg-green-500' }
  ]

  async function handleGenerateCutOrders(e: React.MouseEvent, orderId: string) {
    e.stopPropagation()
    setLoading(orderId)
    try {
      await generateCutOrders(orderId)
      router.refresh()
    } catch (error) {
      console.error('Error generating cut orders:', error)
      alert('Error al generar órdenes de corte')
    } finally {
      setLoading(null)
    }
  }

  function handleOrderClick(order: any) {
    setSelectedOrder(order)
  }

  function handleCloseModal() {
    setSelectedOrder(null)
  }

  async function handleModalUpdate() {
    router.refresh()
  }

  return (
    <>
      <OrderDetailModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={handleCloseModal}
        onUpdate={handleModalUpdate}
      />

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filtrar por estado</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                statusFilter === filter.id
                  ? `${filter.color} text-white shadow-lg scale-105`
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filter.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                statusFilter === filter.id
                  ? 'bg-white/20'
                  : 'bg-slate-200'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">No hay pedidos con este filtro</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const realStatus = getOrderRealStatus(order)
            const statusInfo = getStatusInfo(realStatus)
            const StatusIcon = statusInfo.icon

            return (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className={`bg-white rounded-lg border-2 ${statusInfo.borderColor} p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-lg mb-1">
                      {order.order_number}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${statusInfo.color} text-white rounded-lg text-xs font-bold`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusInfo.text}
                  </span>
                </div>

                {/* Información */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 font-medium line-clamp-1">
                      {order.client?.business_name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-900">
                        {order.total_amount?.toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                          minimumFractionDigits: 0
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Package className="w-3.5 h-3.5" />
                      {order.total_weight} kg
                    </div>
                  </div>

                  {/* Contador de órdenes de corte */}
                  {order.cut_orders && order.cut_orders.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <Package className="w-3.5 h-3.5" />
                      <span>{order.cut_orders.length} órdenes de corte</span>
                    </div>
                  )}
                </div>

                {/* Acción */}
                {realStatus === 'ingresado' && (
                  <button
                    onClick={(e) => handleGenerateCutOrders(e, order.id)}
                    disabled={loading === order.id}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading === order.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      '🚀 Generar Órdenes'
                    )}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
