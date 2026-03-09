'use client'

import { useState } from 'react'
import { finishCutOrder } from '@/app/actions/cut-orders'
import { useError } from '@/components/error-modal'

export default function FinishCutModal({ order, onClose, onSuccess }: any) {
  const [loading, setLoading] = useState(false)
  const { showError, ErrorDialog } = useError()
  const [formData, setFormData] = useState({
    quantityCut: order.quantity_requested || '',
    quantityUsed: '',
    remnantGenerated: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const quantityCut = parseFloat(formData.quantityCut)
    const quantityUsed = parseFloat(formData.quantityUsed)
    const remnantGenerated = parseFloat(formData.remnantGenerated) || 0
    
    if (!quantityCut || !quantityUsed) {
      showError('Debes ingresar las cantidades requeridas', 'Datos Incompletos')
      return
    }

    if (quantityCut <= 0 || quantityUsed <= 0) {
      showError('Las cantidades deben ser mayores a cero', 'Valores Inválidos')
      return
    }

    setLoading(true)
    try {
      const materialUsedId = order.material_base_id || order.product_id
      await finishCutOrder(order.id, quantityCut, materialUsedId, quantityUsed, remnantGenerated)
      onSuccess()
    } catch (error: any) {
      console.error('Error finishing order:', error)
      showError(
        error?.message || 'No se pudo finalizar el corte. Por favor, verifica los datos e intenta nuevamente.',
        'Error al Finalizar'
      )
      setLoading(false)
    }
  }

  return (
    <>
      <ErrorDialog />
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full border-2 border-slate-600 shadow-2xl">
          <h2 className="text-4xl font-bold text-white mb-8 text-center">Finalizar Corte</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xl font-bold text-slate-200 mb-3">
              Cantidad Cortada (kg) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.quantityCut}
              onChange={(e) => setFormData({ ...formData, quantityCut: e.target.value })}
              className="w-full px-6 py-5 bg-slate-700 border-2 border-slate-600 rounded-xl text-white text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: 498.50"
              required
              autoFocus
            />
            <p className="text-base text-slate-300 mt-2 font-semibold">
              📋 Solicitado: {order.quantity_requested} m
            </p>
          </div>

          <div>
            <label className="block text-xl font-bold text-slate-200 mb-3">
              Material Usado (kg) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.quantityUsed}
              onChange={(e) => setFormData({ ...formData, quantityUsed: e.target.value })}
              className="w-full px-6 py-5 bg-slate-700 border-2 border-slate-600 rounded-xl text-white text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: 520.00"
              required
            />
          </div>

          <div>
            <label className="block text-xl font-bold text-slate-200 mb-3">
              Sobrante Generado (kg)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.remnantGenerated}
              onChange={(e) => setFormData({ ...formData, remnantGenerated: e.target.value })}
              className="w-full px-6 py-5 bg-slate-700 border-2 border-slate-600 rounded-xl text-white text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: 22.00"
            />
            <p className="text-sm text-slate-400 mt-2">
              💡 Opcional - Se registrará como recorte
            </p>
          </div>

          <div className="flex space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xl transition-colors disabled:opacity-50 border-2 border-slate-600"
            >
              ✕ Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xl transition-colors disabled:opacity-50 shadow-lg"
            >
              {loading ? '⏳ Finalizando...' : '✓ Finalizar Corte'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
