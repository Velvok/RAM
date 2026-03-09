'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { finishCutOrder } from '@/app/actions/cut-orders'
import { reassignCutOrder } from '@/app/actions/reassignments'
import { CheckCircle2, ArrowLeft, X, ArrowRightLeft } from 'lucide-react'
import ReassignmentModal from '@/components/stock/reassignment-modal'

export default function PlantaPedidoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string

  const [operator, setOperator] = useState<any>(null)
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [selectedCutOrder, setSelectedCutOrder] = useState<any>(null)
  const [formData, setFormData] = useState({
    quantityCut: '',
    materialUsedId: '',
    quantityUsed: '',
    remnantGenerated: ''
  })
  const [processing, setProcessing] = useState(false)
  const [materials, setMaterials] = useState<any[]>([])

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
      
      // Cargar pedido
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

      // Cargar materiales disponibles
      const { data: materialsData } = await supabase
        .from('products')
        .select('*')
        .order('name')
      
      setMaterials(materialsData || [])
    } catch (error) {
      console.error('Error loading pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  function openFinishModal(cutOrder: any) {
    setSelectedCutOrder(cutOrder)
    setFormData({
      quantityCut: cutOrder.quantity_requested.toString(),
      materialUsedId: '',
      quantityUsed: '',
      remnantGenerated: '0'
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedCutOrder(null)
    setFormData({
      quantityCut: '',
      materialUsedId: '',
      quantityUsed: '',
      remnantGenerated: ''
    })
  }

  async function handleFinishCut() {
    if (!selectedCutOrder) return
    
    setProcessing(true)
    try {
      await finishCutOrder(
        selectedCutOrder.id,
        parseFloat(formData.quantityCut),
        formData.materialUsedId,
        parseFloat(formData.quantityUsed),
        parseFloat(formData.remnantGenerated)
      )
      
      closeModal()
      await loadPedido() // Recargar datos
    } catch (error) {
      console.error('Error finishing cut:', error)
      alert('Error al finalizar corte')
    } finally {
      setProcessing(false)
    }
  }

  function openReassignModal(cutOrder: any) {
    setSelectedCutOrder(cutOrder)
    setReassignModalOpen(true)
  }

  async function handleReassign(fromCutOrderId: string, toCutOrderId: string) {
    try {
      const result = await reassignCutOrder(fromCutOrderId, toCutOrderId, 'Reasignación desde planta')
      alert(`Material reasignado correctamente. ${result.wasDisassembled ? 'Pedido origen desarmado.' : ''}`)
      await loadPedido()
    } catch (error: any) {
      console.error('Error reassigning:', error)
      alert(error.message || 'Error al reasignar material')
      throw error
    }
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
                className="p-5 rounded-lg border-2 border-slate-600 bg-slate-800/50"
              >
                <div className="flex items-center justify-between gap-4">
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
                        cutOrder.status === 'pendiente'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {cutOrder.status === 'pendiente' ? 'Pendiente' : 'Completada'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-700/30 rounded-lg">
                        <span className="text-slate-400 text-sm block mb-1">Cantidad:</span>
                        <span className="text-white font-bold text-lg">
                          {cutOrder.quantity_requested} m
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

                  {/* Botones a la derecha */}
                  <div className="flex-shrink-0 flex gap-2">
                    {cutOrder.status === 'pendiente' && (
                      <>
                        <button
                          onClick={() => openReassignModal(cutOrder)}
                          className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                          title="Reasignar material de otro pedido"
                        >
                          <ArrowRightLeft className="w-5 h-5" />
                          Reasignar
                        </button>
                        <button
                          onClick={() => openFinishModal(cutOrder)}
                          className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Confirmar
                        </button>
                      </>
                    )}
                    {cutOrder.status === 'completada' && (
                      <div className="px-6 py-3 bg-green-500/20 text-green-400 rounded-lg font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Completado
                      </div>
                    )}
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

        {/* Modal de Finalización */}
        {modalOpen && selectedCutOrder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl max-w-md w-full border-2 border-slate-700">
              {/* Header */}
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                  Finalizar Corte
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Orden de Corte:</p>
                  <p className="text-lg font-bold text-white">{selectedCutOrder.cut_number}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Cantidad Cortada (m) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantityCut}
                    onChange={(e) => setFormData({ ...formData, quantityCut: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ej: 250.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Material Usado *
                  </label>
                  <select
                    value={formData.materialUsedId}
                    onChange={(e) => setFormData({ ...formData, materialUsedId: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar material...</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Cantidad de Material Usado (m) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantityUsed}
                    onChange={(e) => setFormData({ ...formData, quantityUsed: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ej: 300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Recorte Generado (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.remnantGenerated}
                    onChange={(e) => setFormData({ ...formData, remnantGenerated: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ej: 49.5"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-700 flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={processing}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFinishCut}
                  disabled={processing || !formData.quantityCut || !formData.materialUsedId || !formData.quantityUsed}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {processing ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Reasignación */}
        <ReassignmentModal
          isOpen={reassignModalOpen}
          onClose={() => setReassignModalOpen(false)}
          targetCutOrder={selectedCutOrder}
          onReassign={handleReassign}
        />
      </div>
    </div>
  )
}
