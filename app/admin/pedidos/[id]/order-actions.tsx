'use client'

import { useState, useEffect } from 'react'
import { verifyPayment, generateCutOrders, approveOrder, getOrderById } from '@/app/actions/orders'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/confirm-modal'
import { useError } from '@/components/error-modal'
import AssignOperatorModal from '@/components/assign-operator-modal'

export default function OrderActions({ 
  order: initialOrder, 
  onUpdate 
}: { 
  order: any
  onUpdate?: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(initialOrder)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirm()
  const { showError, ErrorDialog } = useError()

  // Actualizar order cuando cambie initialOrder
  useEffect(() => {
    setOrder(initialOrder)
  }, [initialOrder])

  // Función para recargar datos del pedido
  async function reloadOrder() {
    if (onUpdate) {
      await onUpdate()
    } else {
      try {
        const updated = await getOrderById(order.id)
        setOrder(updated)
        router.refresh()
      } catch (error) {
        console.error('Error reloading order:', error)
      }
    }
  }

  async function handleVerifyPayment() {
    const confirmed = await confirm(
      'Verificar Pago',
      '¿Confirmar que el pago ha sido verificado?',
      { variant: 'success', confirmText: 'Sí, verificar' }
    )
    
    if (!confirmed) return
    
    setLoading(true)
    try {
      await verifyPayment(order.id)
      await reloadOrder()
    } catch (error: any) {
      showError(error?.message || 'No se pudo verificar el pago', 'Error al Verificar')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateCutOrders() {
    const confirmed = await confirm(
      'Generar Órdenes de Corte',
      '¿Generar órdenes de corte para este pedido? Se creará una orden por cada línea del pedido.',
      { variant: 'info', confirmText: 'Sí, generar' }
    )
    
    if (!confirmed) return
    
    setLoading(true)
    try {
      await generateCutOrders(order.id)
      await reloadOrder()
    } catch (error: any) {
      showError(error?.message || 'No se pudieron generar las órdenes de corte', 'Error al Generar')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    // Primero verificar que haya órdenes de corte generadas
    if (!order.cut_orders || order.cut_orders.length === 0) {
      showError('Primero debes generar las órdenes de corte', 'Órdenes Requeridas')
      return
    }

    // Mostrar modal de asignación
    setShowAssignModal(true)
  }

  async function handleConfirmApprove(operatorId: string | null) {
    setShowAssignModal(false)
    setLoading(true)
    
    try {
      await approveOrder(order.id, operatorId)
      await reloadOrder()
    } catch (error: any) {
      showError(error?.message || 'No se pudo aprobar el pedido', 'Error al Aprobar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ConfirmDialog />
      <ErrorDialog />
      <AssignOperatorModal
        isOpen={showAssignModal}
        numOrders={order.cut_orders?.length || 0}
        onConfirm={handleConfirmApprove}
        onCancel={() => setShowAssignModal(false)}
      />
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Acciones
        </h3>
      
      <div className="space-y-3">
        {/* Verificar Pago */}
        {!order.payment_verified && (
          <button
            onClick={handleVerifyPayment}
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Verificar Pago
          </button>
        )}

        {order.payment_verified && (
          <div className="px-4 py-3 bg-green-100 text-green-800 rounded-lg font-semibold text-center">
            ✓ Pago Verificado
          </div>
        )}

        {/* Generar Órdenes de Corte */}
        {order.status === 'ingresado' && order.payment_verified && (
          <button
            onClick={handleGenerateCutOrders}
            disabled={loading}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📋 Generar Órdenes de Corte
          </button>
        )}

        {/* Aprobar y Lanzar */}
        {(order.status === 'generado' || order.status === 'pendiente_aprobacion') && order.payment_verified && (
          <button
            onClick={handleApprove}
            disabled={loading}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Aprobar y Lanzar Pedido
          </button>
        )}

        {order.status === 'lanzado' && (
          <div className="px-4 py-3 bg-green-100 text-green-800 rounded-lg font-semibold text-center">
            ✓ Pedido Lanzado
          </div>
        )}
      </div>

      {/* Información de Estado */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">
          Estado del Pedido
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Pago:</span>
            <span className={order.payment_verified ? 'text-green-600 font-semibold' : 'text-red-600'}>
              {order.payment_verified ? 'Verificado' : 'Pendiente'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Órdenes de Corte:</span>
            <span className="text-slate-900 font-semibold">
              {order.cut_orders?.length || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Estado:</span>
            <span className="text-slate-900 font-semibold capitalize">
              {order.status}
            </span>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
