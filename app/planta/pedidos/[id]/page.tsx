'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { finishCutOrder } from '@/app/actions/cut-orders'
import { useMaterial, type MaterialSuggestion as MaterialSuggestionType } from '@/app/actions/material-suggestions'
import { CheckCircle2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import MaterialSuggestion from '@/components/planta/material-suggestion'

export default function PlantaPedidoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string

  const [operator, setOperator] = useState<any>(null)
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCutOrders, setExpandedCutOrders] = useState<Set<string>>(new Set())
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, MaterialSuggestionType>>({})
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
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('orders')
        .select(\`
          *,
          client:clients(*),
          cut_orders(
            *,
            product:products(*),
            assigned_operator:users(*)
          )
        \`)
        .eq('id', pedidoId)
        .single()

      if (pedidoError) throw pedidoError
      setPedido(pedidoData)
    } catch (error) {
      console.error('Error loading pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleCutOrder(cutOrderId: string) {
    setExpandedCutOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(cutOrderId)) {
        newSet.delete(cutOrderId)
      } else {
        newSet.add(cutOrderId)
      }
      return newSet
    })
  }

  function handleMaterialSelected(cutOrderId: string, material: MaterialSuggestionType) {
    setSelectedMaterials(prev => ({
      ...prev,
      [cutOrderId]: material
    }))
  }

  function handleRemnantChange(cutOrderId: string, value: string) {
    setRemnantInputs(prev => ({
      ...prev,
      [cutOrderId]: value
    }))
  }

  async function handleFinishCut(cutOrder: any) {
    const selectedMaterial = selectedMaterials[cutOrder.id]
    
    if (!selectedMaterial) {
      alert('Por favor selecciona un material')
      return
    }
    
    setProcessing(prev => ({ ...prev, [cutOrder.id]: true }))
    try {
      await useMaterial(
        selectedMaterial.id,
        selectedMaterial.type,
        cutOrder.id,
        cutOrder.quantity_requested
      )

      const remnant = parseFloat(remnantInputs[cutOrder.id] || '0')
      await finishCutOrder(
        cutOrder.id,
        cutOrder.quantity_requested,
        selectedMaterial.id,
        selectedMaterial.length,
        remnant
      )
      
      setExpandedCutOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(cutOrder.id)
        return newSet
      })
      
      await loadPedido()
    } catch (error) {
      console.error('Error finishing cut:', error)
      alert('Error al finalizar corte')
    } finally {
      setProcessing(prev => ({ ...prev, [cutOrder.id]: false }))
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
    <div className="min-h-screen bg-slate-900 p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 sticky top-4 z-10">
          <button
            onClick={() => router.push('/planta/pedidos')}
            className="mb-3 flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver</span>
          </button>
          <h1 className="text-2xl font-bold text-white mb-1">
            {pedido.order_number}
          </h1>
          <p className="text-slate-400 text-sm">
            Operario: {operator?.full_name}
          </p>
        </div>

        <div className="space-y-4">
          {pedido.cut_orders && pedido.cut_orders.length > 0 ? (
            pedido.cut_orders.map((cutOrder: any) => {
              const isExpanded = expandedCutOrders.has(cutOrder.id)
              const isCompleted = cutOrder.status === 'completada'
              const isProcessing = processing[cutOrder.id]

              return (
                <div
                  key={cutOrder.id}
                  className={\`rounded-lg border-2 overflow-hidden transition-all \${
                    isCompleted 
                      ? 'border-green-500 bg-green-900/10' 
                      : isExpanded
                      ? 'border-blue-500 bg-slate-800'
                      : 'border-slate-600 bg-slate-800/50'
                  }\`}
                >
                  <div 
                    className={\`p-4 \${!isCompleted && 'cursor-pointer hover:bg-slate-700/30'} transition-colors\`}
                    onClick={() => !isCompleted && toggleCutOrder(cutOrder.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-white">
                            Orden de Corte: {cutOrder.product?.name}
                          </h3>
                        </div>
                        <p className="text-slate-400 text-sm">
                          {cutOrder.cut_number}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {isCompleted ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-bold">Completada</span>
                          </div>
                        ) : (
                          <>
                            <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold">
                              Pendiente
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-6 h-6 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-6 h-6 text-slate-400" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && !isCompleted && (
                    <div className="border-t border-slate-700 p-4 space-y-4">
                      <MaterialSuggestion 
                        cutOrder={cutOrder}
                        onMaterialSelected={(material) => handleMaterialSelected(cutOrder.id, material)}
                      />

                      <div className="bg-slate-700/30 rounded-lg p-4">
                        <label className="block text-sm font-semibold text-white mb-2">
                          Recorte Generado (opcional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={remnantInputs[cutOrder.id] || ''}
                          onChange={(e) => handleRemnantChange(cutOrder.id, e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                          placeholder="0.00 m"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Si sobra material, indica cuántos metros
                        </p>
                      </div>

                      <button
                        onClick={() => handleFinishCut(cutOrder)}
                        disabled={isProcessing || !selectedMaterials[cutOrder.id]}
                        className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          'Procesando...'
                        ) : (
                          <>
                            <CheckCircle2 className="w-6 h-6" />
                            Confirmar Corte y Finalizar
                          </>
                        )}
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
    </div>
  )
}
