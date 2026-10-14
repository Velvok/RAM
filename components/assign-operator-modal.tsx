'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCog } from 'lucide-react'

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
    try {
      const { getAvailableOperators } = await import('@/app/actions/dashboard-data')
      const data = await getAvailableOperators()
      setOperators(data || [])
    } catch (error) {
      console.error('Error loading operators:', error)
      setOperators([])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center">
              <UserCog size={20} strokeWidth={1.75} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                Asignar Operario
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Se generarán <span className="font-medium text-foreground">{numOrders} orden(es) de corte</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-foreground mb-2">
            Seleccionar operario (opcional):
          </label>
          
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Cargando operarios...
            </div>
          ) : operators.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
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

          <p className="mt-3 text-xs text-muted-foreground">
            {selectedOperator 
              ? `Todas las órdenes se asignarán a este operario. Puedes reasignarlas después en la sección de Cortes.`
              : `Las órdenes quedarán sin asignar. Deberás asignarlas manualmente desde la sección de Cortes.`
            }
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg font-medium hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selectedOperator || null)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {selectedOperator ? 'Asignar y Lanzar' : 'Lanzar sin Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}
