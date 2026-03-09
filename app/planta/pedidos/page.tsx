'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { finishCutOrder } from '@/app/actions/cut-orders'
import { CheckCircle2 } from 'lucide-react'

export default function PlantaPedidosPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
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
    loadPedidos()
  }, [router])

  async function loadPedidos() {
    try {
      const supabase = createClient()
      
      // Obtener pedidos aprobados con sus órdenes de corte
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
        .eq('status', 'aprobado')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setPedidos(data || [])
    } catch (error) {
      console.error('Error loading pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('operator')
    router.push('/')
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
    
    // TODO: Aquí deberías abrir un modal para pedir los datos de cada corte
    // Por ahora solo mostramos un alert
    alert('Función en desarrollo: Se necesita un modal para ingresar cantidad cortada, material usado y recorte para cada orden seleccionada')
    
    /* Implementación futura:
    setProcessing(true)
    try {
      for (const orderId of selectedOrders) {
        await finishCutOrder(
          orderId,
          quantityCut,      // Pedir al usuario
          materialUsedId,   // Pedir al usuario
          quantityUsed,     // Pedir al usuario
          remnantGenerated  // Pedir al usuario
        )
      }
      
      setSelectedOrders(new Set())
      await loadPedidos()
    } catch (error) {
      console.error('Error finishing cuts:', error)
      alert('Error al finalizar cortes')
    } finally {
      setProcessing(false)
    }
    */
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Órdenes de Corte</h1>
            <p className="text-slate-300 mt-1">
              Operario: {operator?.full_name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>

        {pedidos.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-12 border border-slate-700 text-center">
            <svg className="mx-auto h-16 w-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">
              No hay pedidos disponibles
            </h3>
            <p className="text-slate-400">
              No hay pedidos aprobados en este momento
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700"
              >
                {/* Header del Pedido */}
                <div className="p-6 border-b border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Pedido: {pedido.order_number}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {new Date(pedido.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-semibold">
                      {pedido.cut_orders?.length || 0} órdenes
                    </span>
                  </div>
                </div>

                {/* Órdenes de Corte */}
                <div className="p-6 space-y-3">
                  {pedido.cut_orders && pedido.cut_orders.length > 0 ? (
                    pedido.cut_orders.map((cutOrder: any) => (
                      <div
                        key={cutOrder.id}
                        onClick={() => toggleOrderSelection(cutOrder.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedOrders.has(cutOrder.id)
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <div className="pt-1">
                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                              selectedOrders.has(cutOrder.id)
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-slate-500'
                            }`}>
                              {selectedOrders.has(cutOrder.id) && (
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </div>

                          {/* Contenido */}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="text-lg font-bold text-white">
                                  {cutOrder.cut_number}
                                </h4>
                                <p className="text-sm text-slate-400">
                                  {cutOrder.product?.name}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                cutOrder.status === 'lanzada'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : cutOrder.status === 'en_proceso'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-green-500/20 text-green-400'
                              }`}>
                                {cutOrder.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-400">Cantidad:</span>
                                <span className="text-white font-semibold ml-2">
                                  {cutOrder.quantity_requested} kg
                                </span>
                              </div>
                              {cutOrder.assigned_operator && (
                                <div>
                                  <span className="text-slate-400">Asignado:</span>
                                  <span className="text-yellow-400 font-semibold ml-2">
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
                    <p className="text-slate-400 text-center py-4">
                      No hay órdenes de corte para este pedido
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Botón de Confirmar */}
            {selectedOrders.size > 0 && (
              <div className="fixed bottom-6 left-0 right-0 flex justify-center">
                <button
                  onClick={handleConfirmCuts}
                  disabled={processing}
                  className="px-8 py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded-lg font-bold text-lg shadow-2xl transition-colors flex items-center gap-3"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  {processing 
                    ? 'Procesando...' 
                    : `Confirmar ${selectedOrders.size} corte${selectedOrders.size > 1 ? 's' : ''}`
                  }
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
