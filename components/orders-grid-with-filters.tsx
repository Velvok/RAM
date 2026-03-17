'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateCutOrders } from '@/app/actions/orders'
import { Package, Calendar, User, DollarSign, CheckCircle, Clock, AlertCircle, Loader2, Filter } from 'lucide-react'

interface OrdersGridWithFiltersProps {
  orders: any[]
}

export default function OrdersGridWithFilters({ orders }: OrdersGridWithFiltersProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const router = useRouter()


  // Función para obtener info de estado
  function getStatusInfo(status: string) {
    const statusMap: any = {
      nuevo: {
        color: 'bg-slate-500',
        textColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        text: 'Nuevo Pedido',
        icon: AlertCircle
      },
      aprobado: {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        text: 'Aprobado',
        icon: Package
      },
      en_corte: {
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        text: 'En Corte',
        icon: Clock
      },
      finalizado: {
        color: 'bg-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        text: 'Finalizado',
        icon: CheckCircle
      },
      entregado: {
        color: 'bg-purple-600',
        textColor: 'text-purple-700',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-300',
        text: 'Entregado',
        icon: CheckCircle
      },
      cancelado: {
        color: 'bg-red-500',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        text: 'Cancelado',
        icon: AlertCircle
      }
    }
    return statusMap[status] || statusMap.nuevo
  }

  // Filtrar pedidos
  const filteredOrders = statusFilter === 'todos' 
    ? orders 
    : orders.filter(o => o.status === statusFilter)

  // Contar por estado
  const statusCounts = {
    todos: orders.length,
    nuevo: orders.filter(o => o.status === 'nuevo').length,
    aprobado: orders.filter(o => o.status === 'aprobado').length,
    en_corte: orders.filter(o => o.status === 'en_corte').length,
    finalizado: orders.filter(o => o.status === 'finalizado').length,
    entregado: orders.filter(o => o.status === 'entregado').length
  }

  const filters = [
    { id: 'todos', label: 'Todos', count: statusCounts.todos, color: 'bg-slate-600' },
    { id: 'nuevo', label: 'Nuevos', count: statusCounts.nuevo, color: 'bg-slate-500' },
    { id: 'aprobado', label: 'Aprobados', count: statusCounts.aprobado, color: 'bg-yellow-500' },
    { id: 'en_corte', label: 'En Corte', count: statusCounts.en_corte, color: 'bg-blue-500' },
    { id: 'finalizado', label: 'Finalizados', count: statusCounts.finalizado, color: 'bg-green-500' },
    { id: 'entregado', label: 'Entregados', count: statusCounts.entregado, color: 'bg-purple-500' }
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
    // Ir directamente al detalle del pedido
    router.push(`/admin/pedidos/${order.id}`)
  }

  return (
    <>

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
            const statusInfo = getStatusInfo(order.status)
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
                      {order.lines?.reduce((sum: number, line: any) => sum + (line.units || 0), 0) || 0} unidades
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
                {order.status === 'nuevo' && (
                  <button
                    onClick={(e) => handleGenerateCutOrders(e, order.id)}
                    disabled={loading === order.id}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading === order.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Aprobando...
                      </>
                    ) : (
                      '✓ Aprobar Pedido'
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
