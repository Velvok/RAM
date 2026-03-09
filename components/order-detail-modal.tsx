'use client'

import { useState } from 'react'
import { generateCutOrders } from '@/app/actions/orders'
import { useRouter } from 'next/navigation'
import { X, Package, Calendar, User, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface OrderDetailModalProps {
  order: any
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
}

export default function OrderDetailModal({ order, isOpen, onClose, onUpdate }: OrderDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!isOpen || !order) return null

  // Calcular estado real basado en órdenes de corte
  const cutOrders = order.cut_orders || []
  const totalCutOrders = cutOrders.length
  const completedCutOrders = cutOrders.filter((co: any) => co.status === 'completada').length
  const inProgressCutOrders = cutOrders.filter((co: any) => co.status === 'en_proceso').length
  const pendingCutOrders = cutOrders.filter((co: any) => co.status === 'lanzada').length

  let realStatus = 'ingresado'
  let statusColor = 'bg-slate-500'
  let statusText = 'Ingresado'

  if (totalCutOrders > 0) {
    if (completedCutOrders === totalCutOrders) {
      realStatus = 'completado'
      statusColor = 'bg-green-500'
      statusText = 'Completado'
    } else if (inProgressCutOrders > 0 || completedCutOrders > 0) {
      realStatus = 'en_proceso'
      statusColor = 'bg-blue-500'
      statusText = 'En Proceso'
    } else {
      realStatus = 'lanzado'
      statusColor = 'bg-yellow-500'
      statusText = 'Lanzado'
    }
  }

  async function handleGenerateCutOrders() {
    setLoading(true)
    try {
      await generateCutOrders(order.id)
      if (onUpdate) await onUpdate()
      router.refresh()
    } catch (error) {
      console.error('Error generating cut orders:', error)
      alert('Error al generar órdenes de corte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{order.order_number}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {new Date(order.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Estado */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <span className="text-sm font-medium text-slate-700">Estado del Pedido</span>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 ${statusColor} text-white rounded-full text-sm font-semibold`}>
                {statusText}
              </span>
            </div>
          </div>

          {/* Información Principal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <User className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Cliente</p>
                <p className="font-semibold text-slate-900">{order.client?.business_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Importe Total</p>
                <p className="font-semibold text-slate-900">
                  {order.total_amount?.toLocaleString('es-ES', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <Package className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Peso Total</p>
                <p className="font-semibold text-slate-900">{order.total_weight} kg</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <Calendar className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Fecha Entrega</p>
                <p className="font-semibold text-slate-900">
                  {order.delivery_date 
                    ? new Date(order.delivery_date).toLocaleDateString('es-ES')
                    : 'No especificada'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Resumen de Órdenes de Corte */}
          {totalCutOrders > 0 && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Órdenes de Corte
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{totalCutOrders}</p>
                  <p className="text-xs text-slate-600">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{completedCutOrders}</p>
                  <p className="text-xs text-slate-600">Completadas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{inProgressCutOrders}</p>
                  <p className="text-xs text-slate-600">En Proceso</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{pendingCutOrders}</p>
                  <p className="text-xs text-slate-600">Pendientes</p>
                </div>
              </div>
            </div>
          )}

          {/* Líneas del Pedido */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Líneas del Pedido</h3>
            <div className="space-y-2">
              {order.lines?.map((line: any) => (
                <div key={line.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{line.product?.name}</p>
                    <p className="text-xs text-slate-500">{line.product?.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{line.quantity} kg</p>
                    <p className="text-xs text-slate-500">
                      {line.unit_price?.toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR'
                      })}/kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notas */}
          {order.notes && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">Notas</p>
              <p className="text-sm text-blue-700">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer - Acciones */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
          {order.status === 'ingresado' && (
            <button
              onClick={handleGenerateCutOrders}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generando...' : '🚀 Generar y Lanzar Órdenes'}
            </button>
          )}
          
          <button
            onClick={() => router.push(`/admin/pedidos/${order.id}`)}
            className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition-colors"
          >
            Ver Detalle Completo
          </button>
        </div>
      </div>
    </div>
  )
}
