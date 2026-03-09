'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OrderDetailModal from './order-detail-modal'
import { generateCutOrders } from '@/app/actions/orders'
import { Package, Calendar, User, DollarSign, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'

interface OrdersKanbanProps {
  orders: any[]
}

export default function OrdersKanban({ orders }: OrdersKanbanProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)
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

  // Agrupar pedidos por estado
  const ordersByStatus = {
    ingresado: orders.filter(o => getOrderRealStatus(o) === 'ingresado'),
    lanzado: orders.filter(o => getOrderRealStatus(o) === 'lanzado'),
    en_proceso: orders.filter(o => getOrderRealStatus(o) === 'en_proceso'),
    completado: orders.filter(o => getOrderRealStatus(o) === 'completado')
  }

  const columns = [
    {
      id: 'ingresado',
      title: 'Ingresados',
      color: 'bg-slate-500',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-300',
      icon: AlertCircle,
      orders: ordersByStatus.ingresado
    },
    {
      id: 'lanzado',
      title: 'Lanzados',
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      icon: Package,
      orders: ordersByStatus.lanzado
    },
    {
      id: 'en_proceso',
      title: 'En Proceso',
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      icon: Clock,
      orders: ordersByStatus.en_proceso
    },
    {
      id: 'completado',
      title: 'Completados',
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300',
      icon: CheckCircle,
      orders: ordersByStatus.completado
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {columns.map((column) => {
          const ColumnIcon = column.icon
          
          return (
            <div key={column.id} className="flex flex-col h-full">
              {/* Header de Columna */}
              <div className={`${column.bgColor} border-2 ${column.borderColor} rounded-t-lg px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ColumnIcon className={`w-5 h-5 ${column.color.replace('bg-', 'text-')}`} />
                    <h3 className="font-bold text-slate-900">{column.title}</h3>
                  </div>
                  <span className={`${column.color} text-white px-2.5 py-1 rounded-full text-sm font-bold`}>
                    {column.orders.length}
                  </span>
                </div>
              </div>

              {/* Tarjetas */}
              <div className="flex-1 bg-slate-50 border-x-2 border-b-2 border-slate-200 rounded-b-lg p-3 space-y-3 min-h-[600px] max-h-[calc(100vh-250px)] overflow-y-auto">
                {column.orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <ColumnIcon className="w-12 h-12 mb-2 opacity-30" />
                    <p className="text-sm">No hay pedidos</p>
                  </div>
                ) : (
                  column.orders.map((order) => {
                    const cutOrders = order.cut_orders || []
                    const completedCutOrders = cutOrders.filter((co: any) => co.status === 'completada').length
                    const progress = cutOrders.length > 0 
                      ? Math.round((completedCutOrders / cutOrders.length) * 100) 
                      : 0

                    return (
                      <div
                        key={order.id}
                        onClick={() => handleOrderClick(order)}
                        className={`bg-white rounded-lg border-2 ${column.borderColor} p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5`}
                      >
                        {/* Header de Tarjeta */}
                        <div className="mb-3">
                          <h4 className="font-bold text-slate-900 text-lg mb-1">
                            {order.order_number}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(order.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>

                        {/* Información */}
                        <div className="space-y-2 mb-3">
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
                        </div>

                        {/* Progreso */}
                        {cutOrders.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                              <span>Órdenes: {completedCutOrders}/{cutOrders.length}</span>
                              <span className="font-bold">{progress}%</span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${column.color} transition-all duration-500`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Acción */}
                        {column.id === 'ingresado' && (
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
            </div>
          )
        })}
      </div>
    </>
  )
}
