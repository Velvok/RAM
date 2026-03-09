'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OrderDetailModal from './order-detail-modal'
import { generateCutOrders } from '@/app/actions/orders'
import { Package, Calendar, User, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface DashboardOrdersListProps {
  orders: any[]
}

export default function DashboardOrdersList({ orders }: DashboardOrdersListProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  // Función para obtener info de estado
  function getOrderStatusInfo(status: string) {
    const statusMap: any = {
      nuevo: {
        color: 'bg-slate-500',
        textColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        text: 'Nuevo Pedido',
        icon: AlertCircle
      },
      aprobado: {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        text: 'Aprobado',
        icon: Package
      },
      en_corte: {
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        text: 'En Corte',
        icon: Clock
      },
      finalizado: {
        color: 'bg-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        text: 'Finalizado',
        icon: CheckCircle
      },
      cancelado: {
        color: 'bg-red-500',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        text: 'Cancelado',
        icon: AlertCircle
      }
    }
    return statusMap[status] || statusMap.nuevo
  }

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

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Pedidos Recientes
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Últimos 10 pedidos ordenados por fecha
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay pedidos recientes</p>
            </div>
          ) : (
            orders.map((order) => {
              const statusInfo = getOrderStatusInfo(order.status)
              const StatusIcon = statusInfo.icon

              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderClick(order)}
                  className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors border-l-4 ${statusInfo.borderColor}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Información Principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-slate-900">
                          {order.order_number}
                        </h4>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${statusInfo.color} text-white rounded-full text-xs font-semibold`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.text}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(order.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4" />
                          <span className="truncate">{order.client?.business_name}</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-semibold text-slate-900">
                            {order.total_amount?.toLocaleString('es-ES', {
                              style: 'currency',
                              currency: 'EUR',
                              minimumFractionDigits: 0
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600">
                          <Package className="w-4 h-4" />
                          <span>{order.total_weight} kg</span>
                        </div>
                      </div>

                    </div>

                    {/* Acciones */}
                    <div className="flex-shrink-0">
                      {order.status === 'nuevo' && (
                        <button
                          onClick={(e) => handleGenerateCutOrders(e, order.id)}
                          disabled={loading === order.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {loading === order.id ? 'Aprobando...' : '✓ Aprobar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
