'use client'

import { useState } from 'react'
import { generateTestOrder } from '@/app/actions/test-data'
import { useRouter } from 'next/navigation'
import ErrorAlertModal from '@/components/error-alert-modal'

export default function GenerateTestOrderButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [numLines, setNumLines] = useState(1)
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })
  const router = useRouter()

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await generateTestOrder('nuevo', numLines)
      
      if (result.error) {
        // Cerrar modal de generar y mostrar error
        setIsOpen(false)
        
        const errorMessage = result.error.includes('order_status') || result.error.includes('nuevo')
          ? 'Primero debes ejecutar la migración de estados en Supabase.\n\nPasos:\n1. Ve a Supabase Dashboard → SQL Editor\n2. Ejecuta el archivo:\n   supabase/migrations/00003_update_order_states.sql\n3. Intenta generar el pedido nuevamente'
          : result.error
        
        setErrorModal({ isOpen: true, message: errorMessage })
      } else {
        setIsOpen(false)
        // Forzar refresh múltiple para evitar caché
        router.refresh()
        setTimeout(() => {
          router.refresh()
        }, 50)
        setTimeout(() => {
          router.refresh()
        }, 200)
      }
    } catch (error: any) {
      console.error('Error generating test order:', error)
      setIsOpen(false)
      const errorMessage = error?.message || 'Error desconocido al generar pedido de prueba'
      setErrorModal({ isOpen: true, message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ErrorAlertModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
        title="Error al Generar Pedido"
        message={errorModal.message}
      />

      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
      >
        🧪 Generar Pedido de Prueba
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              Generar Pedido de Prueba
            </h3>
            
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> El pedido se creará en estado <strong>"Nuevo Pedido"</strong> 
                y deberás aprobarlo desde el dashboard para generar las órdenes de corte.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Número de líneas (productos):
              </label>
              <select
                value={numLines}
                onChange={(e) => setNumLines(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 línea</option>
                <option value={2}>2 líneas</option>
                <option value={3}>3 líneas</option>
                <option value={4}>4 líneas</option>
                <option value={5}>5 líneas</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Cada línea se convertirá en una orden de corte al aprobar el pedido
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Generando...' : 'Generar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
