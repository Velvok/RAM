'use client'

import { useState } from 'react'
import { generateTestOrder } from '@/app/actions/test-data'
import { useRouter } from 'next/navigation'

export default function GenerateTestOrderButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('ingresado')
  const [numLines, setNumLines] = useState(1)
  const router = useRouter()

  const statuses = [
    { value: 'ingresado', label: 'Ingresado' },
    { value: 'generado', label: 'Generado' },
    { value: 'pendiente_aprobacion', label: 'Pendiente Aprobación' },
    { value: 'lanzado', label: 'Lanzado' },
    { value: 'en_corte', label: 'En Corte' },
    { value: 'preparado_pendiente_retiro', label: 'Preparado' },
    { value: 'despachado', label: 'Despachado' },
  ]

  async function handleGenerate() {
    setLoading(true)
    const result = await generateTestOrder(selectedStatus, numLines)
    
    if (result.error) {
      alert('Error: ' + result.error)
    } else {
      setIsOpen(false)
      // Forzar recarga completa
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <>
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
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Estado del pedido:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
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
                <option value={1}>1 línea (1 orden de corte)</option>
                <option value={2}>2 líneas (2 órdenes de corte)</option>
                <option value={3}>3 líneas (3 órdenes de corte)</option>
                <option value={4}>4 líneas (4 órdenes de corte)</option>
                <option value={5}>5 líneas (5 órdenes de corte)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Cada línea genera una orden de corte diferente
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
