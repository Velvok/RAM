'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AssignOperatorModalProps {
  isOpen: boolean
  numOrders: number
  onConfirm: (operatorId: string | null) => void
  onCancel: () => void
}

export default function AssignOperatorModal({
  isOpen,
  numOrders,
  onConfirm,
  onCancel
}: AssignOperatorModalProps) {
  const [operators, setOperators] = useState<any[]>([])
  const [selectedOperator, setSelectedOperator] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadOperators()
    }
  }, [isOpen])

  async function loadOperators() {
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'operator')
      .eq('is_active', true)
    
    if (data) setOperators(data)
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900">
                Asignar Operario
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Se generarán <span className="font-semibold">{numOrders} orden(es) de corte</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Seleccionar operario (opcional):
          </label>
          
          {loading ? (
            <div className="text-center py-4 text-slate-500">
              Cargando operarios...
            </div>
          ) : operators.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              No hay operarios disponibles
            </div>
          ) : (
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            >
              <option value="">No asignar ahora (asignar después en Cortes)</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name}
                </option>
              ))}
            </select>
          )}

          <p className="mt-3 text-xs text-slate-500">
            {selectedOperator 
              ? `Todas las órdenes se asignarán a este operario. Puedes reasignarlas después en la sección de Cortes.`
              : `Las órdenes quedarán sin asignar. Deberás asignarlas manualmente desde la sección de Cortes.`
            }
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 rounded-b-2xl flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selectedOperator || null)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {selectedOperator ? 'Asignar y Lanzar' : 'Lanzar sin Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}
