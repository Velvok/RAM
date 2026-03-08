'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getCutOrderById, startCutOrder, pauseCutOrder } from '@/app/actions/cut-orders'
import FinishCutModal from './finish-cut-modal'
import { useSuccess } from '@/components/success-modal'
import { useError } from '@/components/error-modal'

export default function OrdenDetallePage() {
  const router = useRouter()
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const { showSuccess, SuccessDialog } = useSuccess()
  const { showError, ErrorDialog } = useError()

  useEffect(() => {
    loadOrder()
  }, [params.id])

  async function loadOrder() {
    try {
      const data = await getCutOrderById(params.id as string)
      setOrder(data)
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    setProcessing(true)
    try {
      await startCutOrder(order.id)
      await loadOrder()
    } catch (error: any) {
      console.error('Error starting order:', error)
      showError(error?.message || 'No se pudo iniciar la orden', 'Error al Iniciar')
    } finally {
      setProcessing(false)
    }
  }

  async function handlePause() {
    setProcessing(true)
    try {
      await pauseCutOrder(order.id)
      await loadOrder()
    } catch (error: any) {
      console.error('Error pausing order:', error)
      showError(error?.message || 'No se pudo pausar la orden', 'Error al Pausar')
    } finally {
      setProcessing(false)
    }
  }

  function handleFinish() {
    setShowFinishModal(true)
  }

  function handleFinishSuccess() {
    setShowFinishModal(false)
    showSuccess(
      'El corte ha sido finalizado exitosamente. Los datos han sido registrados correctamente.',
      '¡Corte Finalizado!'
    )
    setTimeout(() => {
      router.push('/planta/ordenes')
    }, 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Orden no encontrada</div>
      </div>
    )
  }

  return (
    <>
      <SuccessDialog />
      <ErrorDialog />
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-blue-400 hover:text-blue-300"
            >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver</span>
          </button>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
            order.status === 'lanzada' ? 'bg-blue-500/20 text-blue-400' :
            order.status === 'en_proceso' ? 'bg-yellow-500/20 text-yellow-400' :
            order.status === 'pausada' ? 'bg-orange-500/20 text-orange-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {order.status}
          </span>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-8 border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-6">{order.cut_number}</h1>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <div className="text-sm text-slate-400 mb-1">Pedido</div>
              <div className="text-lg font-semibold text-white">{order.order?.order_number}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Cliente</div>
              <div className="text-lg font-semibold text-white">{order.order?.client?.business_name}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Producto</div>
              <div className="text-lg font-semibold text-white">{order.product?.name}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Cantidad Solicitada</div>
              <div className="text-lg font-semibold text-white">{order.quantity_requested} kg</div>
            </div>
            {order.material_base && (
              <>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Material Base</div>
                  <div className="text-lg font-semibold text-white">{order.material_base?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Cantidad Material</div>
                  <div className="text-lg font-semibold text-white">{order.material_base_quantity} kg</div>
                </div>
              </>
            )}
          </div>

          {order.notes && (
            <div className="mb-8 p-4 bg-slate-700/50 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">Notas</div>
              <div className="text-white">{order.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {order.status === 'lanzada' && (
              <button
                onClick={handleStart}
                disabled={processing}
                className="py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50"
              >
                {processing ? 'Procesando...' : 'Iniciar Corte'}
              </button>
            )}

            {order.status === 'en_proceso' && (
              <>
                <button
                  onClick={handlePause}
                  disabled={processing}
                  className="py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Procesando...' : 'Pausar'}
                </button>
                <button
                  onClick={handleFinish}
                  disabled={processing}
                  className="py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 md:col-span-2"
                >
                  {processing ? 'Procesando...' : 'Finalizar Corte'}
                </button>
              </>
            )}

            {order.status === 'pausada' && (
              <button
                onClick={handleStart}
                disabled={processing}
                className="py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-lg transition-colors disabled:opacity-50 md:col-span-3"
              >
                {processing ? 'Procesando...' : 'Reanudar Corte'}
              </button>
            )}
          </div>
        </div>

        {showFinishModal && (
          <FinishCutModal
            order={order}
            onClose={() => setShowFinishModal(false)}
            onSuccess={handleFinishSuccess}
          />
        )}
      </div>
    </div>
    </>
  )
}
