'use client'

import { useState, useEffect } from 'react'
import { generateCutOrders, getOrderById, approveOrderOnHold, undoOrderDelivery } from '@/app/actions/orders'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/confirm-modal'
import { useError } from '@/components/error-modal'
import { useSuccess } from '@/components/success-modal'

export default function OrderActions({ 
  order: initialOrder, 
  onUpdate,
  isHeaderMode = false
}: { 
  order: any
  onUpdate?: () => Promise<void>
  isHeaderMode?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [undoingDelivery, setUndoingDelivery] = useState(false)
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
      await generateCutOrders(order.id)
      await reloadOrder()
      
      // Revalidar para sincronizar con tablet
      try {
        await fetch(`/api/revalidate?path=/admin/pedidos/${order.id}`, { method: 'POST' })
        await fetch(`/api/revalidate?path=/planta/pedidos/${order.id}`, { method: 'POST' })
      } catch (e) {
        console.log('Revalidación fallida')
      }
      
      showSuccess(
        'Pedido aprobado. Órdenes de corte creadas y stock asignado correctamente.',
        'Pedido Aprobado'
      )
    } catch (error: any) {
      console.error('🔴 Error en handleGenerateCutOrders:', error)
      showError(error?.message || 'No se pudo aprobar el pedido', 'Error al Aprobar')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveOnHold() {
    const confirmed = await confirm(
      'Aprobar Pedido en Pausa',
      '¿Aprobar este pedido en pausa? Se crearán órdenes de corte pero NO se asignará stock automáticamente. Útil cuando se espera la llegada de material.',
      { variant: 'warning', confirmText: 'Sí, aprobar en pausa' }
    )
    
    if (!confirmed) return
    
    setLoading(true)
    try {
      const result = await approveOrderOnHold(order.id)
      await reloadOrder()
      
      // Revalidar para sincronizar con tablet
      try {
        await fetch(`/api/revalidate?path=/admin/pedidos/${order.id}`, { method: 'POST' })
        await fetch(`/api/revalidate?path=/planta/pedidos/${order.id}`, { method: 'POST' })
      } catch (e) {
        console.log('Revalidación fallida')
      }
      
      showSuccess(
        result.message || 'Pedido aprobado en pausa. El stock deberá asignarse manualmente desde el detalle del pedido.',
        'Pedido Aprobado en Pausa'
      )
    } catch (error: any) {
      showError(error?.message || 'No se pudo aprobar el pedido en pausa', 'Error al Aprobar')
    } finally {
      setLoading(false)
    }
  }


  async function handleUndoDelivery() {
    const confirmed = await confirm(
      '¿Estás seguro de deshacer esta entrega?',
      'Esta acción restaurará el stock consumido y revertirá el estado del pedido.'
    )
    
    if (!confirmed) return
    
    setUndoingDelivery(true)
    try {
      await undoOrderDelivery(order.id)
      await reloadOrder()
      
      // Revalidar para sincronizar con tablet
      try {
        await fetch(`/api/revalidate?path=/admin/pedidos/${order.id}`, { method: 'POST' })
        await fetch(`/api/revalidate?path=/planta/pedidos/${order.id}`, { method: 'POST' })
      } catch (e) {
        console.log('Revalidación fallida')
      }
      
      showSuccess(
        'Entrega deshecha correctamente. El stock ha sido restaurado.',
        '✓ Entrega Deshecha'
      )
    } catch (error: any) {
      showError(error?.message || 'No se pudo deshacer la entrega', 'Error al Deshacer')
    } finally {
      setUndoingDelivery(false)
    }
  }

  // Verificar si se puede deshacer la entrega (dentro de 24h y estado entregado)
  const canUndoDelivery = order.status === 'entregado'

  // Verificar si el pedido en pausa tiene stock parcialmente asignado
  const hasPartialStock = order.status === 'aprobado_en_pausa' && (
    (order.cut_orders?.some((co: any) => co.material_base_id) || false) ||
    (order.preparation_items?.some((pi: any) => pi.assigned_inventory_id) || false)
  )

  // Modo header: solo botones sin cuadro
  if (isHeaderMode) {
    return (
      <>
        <ConfirmDialog />
        <ErrorDialog />
        <SuccessDialog />
        <div className="flex items-center gap-2">
          {/* Aprobar Pedido - DOS OPCIONES */}
          {order.status === 'nuevo' && (
            <>
              <button
                onClick={handleGenerateCutOrders}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprobar Pedido
              </button>
              <button
                onClick={handleApproveOnHold}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprobar en Pausa
              </button>
            </>
          )}

          {/* Estado Aprobado en Pausa */}
          {order.status === 'aprobado_en_pausa' && (
            <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm font-semibold">
              ⏸️ En Pausa - {hasPartialStock ? 'Parcialmente asignado' : 'Sin stock asignado'}
            </div>
          )}


          {/* Deshacer Entrega */}
          {canUndoDelivery && (
            <button
              onClick={handleUndoDelivery}
              disabled={undoingDelivery}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {undoingDelivery ? 'Deshaciendo...' : 'Deshacer Entrega'}
            </button>
          )}
        </div>
      </>
    )
  }

  // Modo normal: cuadro completo (no se usa más pero lo mantenemos por compatibilidad)
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
          {/* Aprobar Pedido - DOS OPCIONES */}
          {order.status === 'nuevo' && (
            <>
              <button
                onClick={handleGenerateCutOrders}
                disabled={loading}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprobar Pedido y Asignar Stock
              </button>
              <button
                onClick={handleApproveOnHold}
                disabled={loading}
                className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprobar en Pausa (sin stock)
              </button>
            </>
          )}

          {order.status === 'aprobado' && (
            <div className="px-4 py-3 bg-green-100 text-green-800 rounded-lg font-semibold text-center">
              Pedido Aprobado - Stock asignado
            </div>
          )}

          {order.status === 'aprobado_en_pausa' && (
            <div className="px-4 py-3 bg-orange-100 text-orange-800 rounded-lg font-semibold text-center">
              ⏸️ Pedido en Pausa - {hasPartialStock ? 'Parcialmente asignado' : 'Sin stock asignado'}
            </div>
          )}


          {order.status === 'entregado' && (
            <div className="space-y-3">
              <div className="px-4 py-3 bg-blue-100 text-blue-800 rounded-lg font-semibold text-center">
                Pedido Entregado
              </div>
              
              {/* Deshacer Entrega */}
              {canUndoDelivery && (
                <button
                  onClick={handleUndoDelivery}
                  disabled={undoingDelivery}
                  className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {undoingDelivery ? 'Deshaciendo...' : 'Deshacer Entrega'}
                </button>
              )}
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
