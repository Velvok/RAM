'use client'

import { useState, useEffect } from 'react'
import { generateCutOrders, getOrderById } from '@/app/actions/orders'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/confirm-modal'
import { useError } from '@/components/error-modal'
import { useSuccess } from '@/components/success-modal'

export default function OrderActions({ 
  order: initialOrder, 
  onUpdate 
}: { 
  order: any
  onUpdate?: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(initialOrder)
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirm()
  const { showError, ErrorDialog } = useError()
  const { showSuccess, SuccessDialog } = useSuccess()

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

  async function handleGenerateCutOrders() {
    const confirmed = await confirm(
      'Aprobar Pedido y Asignar Stock',
      '¿Aprobar este pedido? Se crearán órdenes de corte y se asignará stock automáticamente.',
      { variant: 'success', confirmText: 'Sí, aprobar' }
    )
    
    if (!confirmed) return
    
    setLoading(true)
    try {
      const result = await generateCutOrders(order.id)
      await reloadOrder()
      
      if (result.warnings && result.warnings.length > 0) {
        // Mostrar advertencias si hay problemas de stock
        showError(
          `Pedido aprobado con advertencias:\n\n${result.warnings.join('\n')}`,
          'Advertencias de Stock'
        )
      } else {
        showSuccess(
          'Pedido aprobado. Órdenes de corte creadas y stock asignado correctamente.',
          'Pedido Aprobado'
        )
      }
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
      <SuccessDialog />
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Acciones
        </h3>
      
        <div className="space-y-3">
          {/* Aprobar Pedido */}
          {order.status === 'nuevo' && (
            <button
              onClick={handleGenerateCutOrders}
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ Aprobar Pedido y Asignar Stock
            </button>
          )}

          {order.status === 'aprobado' && (
            <div className="px-4 py-3 bg-green-100 text-green-800 rounded-lg font-semibold text-center">
              ✓ Pedido Aprobado - Stock asignado
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
