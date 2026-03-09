'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { startCutOrder, finishCutOrder } from '@/app/actions/cut-orders'
import { Package, User, CheckCircle, Clock } from 'lucide-react'

export default function CutOrderCard({ cutOrder }: { cutOrder: any }) {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Obtener ID del operario del localStorage
    const storedOperatorId = localStorage.getItem('operatorId')
    setOperatorId(storedOperatorId)
  }, [])

  async function handleStartCut() {
    if (!operatorId) {
      alert('No se pudo identificar el operario')
      return
    }

    setLoading(true)
    try {
      // Iniciar el corte directamente sin ir a detalle
      await startCutOrder(cutOrder.id, operatorId)
      router.refresh()
      alert('Corte iniciado correctamente')
    } catch (error) {
      console.error('Error starting cut:', error)
      alert('Error al iniciar el corte')
    } finally {
      setLoading(false)
    }
  }

  function handleFinishCut() {
    // Ir al detalle para finalizar el corte
    router.push(`/planta/ordenes/${cutOrder.id}`)
  }

  const statusConfig: any = {
    lanzada: {
      color: 'border-yellow-300 bg-yellow-50',
      badge: 'bg-yellow-500 text-white',
      text: 'Pendiente',
      icon: Package
    },
    en_proceso: {
      color: 'border-blue-300 bg-blue-50',
      badge: 'bg-blue-500 text-white',
      text: 'En Proceso',
      icon: Clock
    },
    completada: {
      color: 'border-green-300 bg-green-50',
      badge: 'bg-green-500 text-white',
      text: 'Completada',
      icon: CheckCircle
    }
  }

  const config = statusConfig[cutOrder.status] || statusConfig.lanzada
  const StatusIcon = config.icon

  return (
    <div className={`rounded-lg border-2 ${config.color} p-4 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm">
            {cutOrder.cut_number}
          </h4>
        </div>
        <span className={`${config.badge} px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {config.text}
        </span>
      </div>

      {/* Producto */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900">
            {cutOrder.product?.name}
          </span>
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-semibold">{cutOrder.quantity_requested} kg</span> solicitados
        </div>
      </div>

      {/* Operario asignado */}
      {cutOrder.assigned_operator && (
        <div className="mb-4 p-2 bg-white rounded border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <User className="w-3.5 h-3.5" />
            <span className="font-semibold">{cutOrder.assigned_operator.full_name}</span>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="space-y-2">
        {cutOrder.status === 'lanzada' && (
          <button
            onClick={handleStartCut}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Iniciando...' : '▶ Iniciar Corte'}
          </button>
        )}

        {cutOrder.status === 'en_proceso' && (
          <button
            onClick={handleFinishCut}
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors text-sm"
          >
            ✓ Finalizar Corte
          </button>
        )}

        {cutOrder.status === 'completada' && (
          <div className="text-center py-2 text-sm text-green-700 font-semibold">
            ✓ Corte Completado
          </div>
        )}
      </div>
    </div>
  )
}
