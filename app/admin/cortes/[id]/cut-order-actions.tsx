'use client'

import { useState, useEffect } from 'react'
import { assignCutOrder, startCutOrder, getCutOrderById } from '@/app/actions/cut-orders'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/confirm-modal'
import { useError } from '@/components/error-modal'

export default function CutOrderActions({ cutOrder: initialCutOrder }: { cutOrder: any }) {
  const [loading, setLoading] = useState(false)
  const [cutOrder, setCutOrder] = useState(initialCutOrder)
  const [operators, setOperators] = useState<any[]>([])
  const [selectedOperator, setSelectedOperator] = useState(cutOrder.assigned_to || '')
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirm()
  const { showError, ErrorDialog } = useError()

  useEffect(() => {
    loadOperators()
  }, [])

  useEffect(() => {
    setCutOrder(initialCutOrder)
    setSelectedOperator(initialCutOrder.assigned_to || '')
  }, [initialCutOrder])

  async function reloadCutOrder() {
    try {
      const updated = await getCutOrderById(cutOrder.id)
      setCutOrder(updated)
      setSelectedOperator(updated.assigned_to || '')
      router.refresh()
    } catch (error) {
      console.error('Error reloading cut order:', error)
    }
  }

  async function loadOperators() {
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'operator')
      .eq('is_active', true)
    
    if (data) setOperators(data)
  }

  async function handleAssign() {
    if (!selectedOperator) {
      showError('Debes seleccionar un operario', 'Operario Requerido')
      return
    }

    setLoading(true)
    try {
      await assignCutOrder(cutOrder.id, selectedOperator)
      await reloadCutOrder()
    } catch (error: any) {
      showError(error?.message || 'No se pudo asignar el operario', 'Error al Asignar')
    } finally {
      setLoading(false)
    }
  }

  async function handleLaunch() {
    if (!cutOrder.assigned_to) {
      showError('Primero debes asignar un operario a esta orden', 'Operario Requerido')
      return
    }

    const confirmed = await confirm(
      'Lanzar Orden de Corte',
      '¿Lanzar esta orden? El operario podrá verla en su tablet y comenzar a trabajar.',
      { variant: 'success', confirmText: 'Sí, lanzar' }
    )
    
    if (!confirmed) return

    setLoading(true)
    try {
      // Cambiar estado a "lanzada"
      const supabase = createClient()
      await supabase
        .from('cut_orders')
        .update({ status: 'lanzada' })
        .eq('id', cutOrder.id)
      
      await reloadCutOrder()
    } catch (error: any) {
      showError(error?.message || 'No se pudo lanzar la orden', 'Error al Lanzar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ConfirmDialog />
      <ErrorDialog />
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Gestión de Orden
        </h3>

      <div className="space-y-4">
        {/* Asignar Operario - Disponible para generada y lanzada */}
        {(cutOrder.status === 'generada' || cutOrder.status === 'lanzada') && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {cutOrder.assigned_to ? 'Reasignar Operario:' : 'Asignar Operario:'}
            </label>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            >
              <option value="">Seleccionar operario...</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={loading || !selectedOperator}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Asignando...' : cutOrder.assigned_to ? 'Reasignar Operario' : 'Asignar Operario'}
            </button>
          </div>
        )}

        {/* Lanzar Orden - Solo si está generada y tiene operario */}
        {cutOrder.status === 'generada' && cutOrder.assigned_to && (
          <button
            onClick={handleLaunch}
            disabled={loading}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            🚀 Lanzar Orden
          </button>
        )}

        {cutOrder.status === 'lanzada' && (
          <div className="px-4 py-3 bg-green-100 text-green-800 rounded-lg">
            <div className="font-semibold text-center">✓ Orden Lanzada</div>
            <div className="text-sm font-normal mt-2 text-center">
              Visible para: <span className="font-semibold">{cutOrder.assigned_operator?.full_name || 'Sin asignar'}</span>
            </div>
            {cutOrder.assigned_to && (
              <div className="text-xs mt-2 text-center opacity-75">
                Puedes reasignar el operario usando el selector arriba
              </div>
            )}
          </div>
        )}

        {cutOrder.status === 'en_proceso' && (
          <div className="px-4 py-3 bg-yellow-100 text-yellow-800 rounded-lg font-semibold text-center">
            ⚙️ En Proceso
            <div className="text-sm font-normal mt-1">
              Operario: {cutOrder.assigned_operator?.full_name}
            </div>
          </div>
        )}

        {cutOrder.status === 'finalizada' && (
          <div className="px-4 py-3 bg-slate-100 text-slate-800 rounded-lg font-semibold text-center">
            ✓ Finalizada
            <div className="text-sm font-normal mt-1">
              Cortado: {cutOrder.quantity_cut} kg
            </div>
          </div>
        )}
      </div>

      {/* Información */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">
          Estado de la Orden
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Estado:</span>
            <span className="text-slate-900 font-semibold capitalize">
              {cutOrder.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Operario:</span>
            <span className="text-slate-900 font-semibold">
              {cutOrder.assigned_operator?.full_name || 'Sin asignar'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Cantidad:</span>
            <span className="text-slate-900 font-semibold">
              {cutOrder.quantity_requested} kg
            </span>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
