'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { finishCutOrder } from '@/app/actions/cut-orders'
import { getMaterialSuggestions, type MaterialSuggestion } from '@/app/actions/material-suggestions'
import { CheckCircle2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

export default function PlantaPedidoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string

  const [operator, setOperator] = useState<any>(null)
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCutId, setExpandedCutId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, any>>({})
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, MaterialSuggestion>>({})
  const [remnantInputs, setRemnantInputs] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedido()
  }, [router, pedidoId])

  async function loadPedido() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          cut_orders(
            *,
            product:products!cut_orders_product_id_fkey(*),
            assigned_operator:users!cut_orders_assigned_to_fkey(*)
          )
        `)
        .eq('id', pedidoId)
        .single()

      if (error) throw error
      setPedido(data)
    } catch (error) {
      console.error('Error loading pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleCutOrder(cutOrderId: string, productId: string, lengthNeeded: number) {
    if (expandedCutId === cutOrderId) {
      setExpandedCutId(null)
      return
    }

    setExpandedCutId(cutOrderId)

    // Cargar sugerencias si no las tenemos
    if (!suggestions[cutOrderId]) {
      const result = await getMaterialSuggestions(productId, lengthNeeded)
      setSuggestions(prev => ({ ...prev, [cutOrderId]: result }))
      if (result.best) {
        setSelectedMaterials(prev => ({ ...prev, [cutOrderId]: result.best! }))
      }
    }
  }

  async function handleConfirmCut(cutOrder: any) {
    const cutId = cutOrder.id
    const selectedMaterial = selectedMaterials[cutId]
    const remnantLength = remnantInputs[cutId] || '0'

    if (!selectedMaterial) {
      alert('Por favor selecciona un material')
      return
    }

    setProcessing(prev => ({ ...prev, [cutId]: true }))
    
    try {
      await finishCutOrder(
        cutId,
        cutOrder.quantity_requested,
        selectedMaterial.id,
        selectedMaterial.length,
        parseFloat(remnantLength)
      )
      
      setExpandedCutId(null)
      await loadPedido()
    } catch (error) {
      console.error('Error finishing cut:', error)
      alert('Error al finalizar corte')
    } finally {
      setProcessing(prev => ({ ...prev, [cutId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Pedido no encontrado</h2>
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
          >
            Volver a pedidos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header Sticky */}
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Volver</span>
          </button>
          
          <h1 className="text-2xl font-bold text-white mb-1">{pedido.order_number}</h1>
          {operator && (
            <p className="text-slate-400">Operario: <span className="text-white font-semibold">{operator.full_name}</span></p>
          )}
        </div>
      </div>

      {/* Lista de Órdenes de Corte */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {pedido.cut_orders && pedido.cut_orders.length > 0 ? (
          pedido.cut_orders.map((cutOrder: any) => {
            const isExpanded = expandedCutId === cutOrder.id
            const isPending = cutOrder.status === 'pendiente'
            const isCompleted = cutOrder.status === 'completada'
            const cutSuggestions = suggestions[cutOrder.id]
            const selectedMaterial = selectedMaterials[cutOrder.id]
            const isProcessing = processing[cutOrder.id]

            return (
              <div
                key={cutOrder.id}
                className={`rounded-lg border-2 transition-all ${
                  isCompleted
                    ? 'bg-slate-800/50 border-green-500'
                    : isExpanded
                    ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/70 border-slate-600'
                }`}
              >
                {/* Header de la tarjeta */}
                <button
                  onClick={() => isPending && toggleCutOrder(cutOrder.id, cutOrder.product_id, cutOrder.quantity_requested)}
                  disabled={isCompleted}
                  className={`w-full p-4 flex items-center justify-between ${
                    isPending ? 'cursor-pointer hover:bg-slate-700/50' : 'cursor-default'
                  } transition-colors`}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {cutOrder.product?.name || 'Producto'}
                      </h3>
                      {isPending && (
                        isExpanded ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{cutOrder.cut_number}</p>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                      isCompleted
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Completada
                        </>
                      ) : (
                        '🟡 Pendiente'
                      )}
                    </span>
                  </div>
                </button>

                {/* Contenido expandido */}
                {isExpanded && isPending && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-700 pt-4">
                    {/* Sugerencia del Sistema */}
                    {cutSuggestions?.best && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">💡</span>
                          <h4 className="font-bold text-white">SUGERENCIA DEL SISTEMA</h4>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{cutSuggestions.best.type === 'remnant' ? '🔵' : '🟢'}</span>
                            <span className="font-semibold text-white">{cutSuggestions.best.name}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-400">Longitud:</span>
                              <span className="font-semibold ml-2 text-white">{cutSuggestions.best.length}m</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Desperdicio:</span>
                              <span className="font-semibold ml-2 text-orange-400">
                                {cutSuggestions.best.waste.toFixed(2)}m
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-slate-400">Ubicación:</span>
                              <span className="font-semibold ml-2 text-white">{cutSuggestions.best.location}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedMaterials(prev => ({ ...prev, [cutOrder.id]: cutSuggestions.best }))}
                          className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                            selectedMaterial?.id === cutSuggestions.best.id
                              ? 'bg-green-600 text-white'
                              : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          }`}
                        >
                          {selectedMaterial?.id === cutSuggestions.best.id ? '✓ Material Seleccionado' : '✓ Usar Este Material'}
                        </button>
                      </div>
                    )}

                    {/* Alternativas */}
                    {cutSuggestions?.alternatives && cutSuggestions.alternatives.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-white mb-2">Alternativas:</h5>
                        <ul className="space-y-1 text-sm">
                          {cutSuggestions.alternatives.map((alt: MaterialSuggestion) => (
                            <li key={alt.id} className="flex items-center gap-2 text-slate-300">
                              <span>{alt.type === 'remnant' ? '🔵' : '🟢'}</span>
                              <span>{alt.name}: {alt.length}m</span>
                              <span className="text-slate-500">(desperdicio: {alt.waste.toFixed(2)}m)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Selección Manual */}
                    <div className="border-t border-slate-700 pt-4">
                      <label className="block font-semibold text-white mb-2">
                        ✋ O selecciona manualmente:
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        value={selectedMaterial?.id || ''}
                        onChange={(e) => {
                          const selected = cutSuggestions?.all.find((s: MaterialSuggestion) => s.id === e.target.value)
                          if (selected) {
                            setSelectedMaterials(prev => ({ ...prev, [cutOrder.id]: selected }))
                          }
                        }}
                      >
                        <option value="">Seleccionar material...</option>
                        {cutSuggestions?.all.map((s: MaterialSuggestion) => (
                          <option key={s.id} value={s.id}>
                            {s.name} - {s.length}m (desperdicio: {s.waste.toFixed(2)}m)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Recorte Generado */}
                    <div>
                      <label className="block font-semibold text-white mb-2">
                        Recorte generado (opcional):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0 m"
                        value={remnantInputs[cutOrder.id] || ''}
                        onChange={(e) => setRemnantInputs(prev => ({ ...prev, [cutOrder.id]: e.target.value }))}
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                    </div>

                    {/* Botón Confirmar */}
                    <button
                      onClick={() => handleConfirmCut(cutOrder)}
                      disabled={!selectedMaterial || isProcessing}
                      className="w-full px-6 py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-colors"
                    >
                      {isProcessing ? 'Procesando...' : '✓ Confirmar Corte y Finalizar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-12 border border-slate-700 text-center">
            <p className="text-slate-400 text-lg">
              No hay órdenes de corte para este pedido
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
