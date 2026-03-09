'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, ArrowLeft } from 'lucide-react'

export default function PlantaPedidoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string

  const [operator, setOperator] = useState<any>(null)
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)

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

  function toggleOrderSelection(orderId: string) {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  async function handleConfirmCuts() {
    if (selectedOrders.size === 0) return
    
    // TODO: Abrir modal para ingresar datos de cada corte
    alert('Función en desarrollo: Se necesita un modal para ingresar cantidad cortada, material usado y recorte para cada orden seleccionada')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/planta/pedidos')}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {pedido.order_number}
              </h1>
              <p className="text-slate-300 mt-1">
                Operario: {operator?.full_name}
              </p>
            </div>
          </div>
          <span className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-semibold">
            {pedido.cut_orders?.length || 0} órdenes de corte
          </span>
        </div>

        {/* Órdenes de Corte */}
        <div className="space-y-3">
          {pedido.cut_orders && pedido.cut_orders.length > 0 ? (
            pedido.cut_orders.map((cutOrder: any) => (
              <div
                key={cutOrder.id}
                onClick={() => toggleOrderSelection(cutOrder.id)}
                className={`p-5 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedOrders.has(cutOrder.id)
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <div className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedOrders.has(cutOrder.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-slate-500'
                    }`}>
                      {selectedOrders.has(cutOrder.id) && (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-xl font-bold text-white">
                          {cutOrder.cut_number}
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          {cutOrder.product?.name}
                        </p>
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        cutOrder.status === 'lanzada'
                          ? 'bg-blue-500/20 text-blue-400'
                          : cutOrder.status === 'en_proceso'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {cutOrder.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-700/30 rounded-lg">
                        <span className="text-slate-400 text-sm block mb-1">Cantidad:</span>
                        <span className="text-white font-bold text-lg">
                          {cutOrder.quantity_requested} kg
                        </span>
                      </div>
                      {cutOrder.assigned_operator && (
                        <div className="p-3 bg-slate-700/30 rounded-lg">
                          <span className="text-slate-400 text-sm block mb-1">Asignado:</span>
                          <span className="text-yellow-400 font-bold">
                            {cutOrder.assigned_operator.full_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-slate-800/50 rounded-lg p-12 border border-slate-700 text-center">
              <p className="text-slate-400 text-lg">
                No hay órdenes de corte para este pedido
              </p>
            </div>
          )}
        </div>

        {/* Botón de Confirmar Flotante */}
        {selectedOrders.size > 0 && (
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
            <button
              onClick={handleConfirmCuts}
              disabled={processing}
              className="px-10 py-5 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded-xl font-bold text-xl shadow-2xl transition-all flex items-center gap-4 transform hover:scale-105"
            >
              <CheckCircle2 className="w-7 h-7" />
              {processing 
                ? 'Procesando...' 
                : `Confirmar ${selectedOrders.size} corte${selectedOrders.size > 1 ? 's' : ''}`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
