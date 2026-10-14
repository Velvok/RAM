'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X, Search, ArrowRight, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CutOrder {
  id: string
  cut_number: string
  quantity_requested: number
  status: string
  product: {
    id: string
    name: string
    code: string
  }
}

interface Order {
  id: string
  order_number: string
  client: {
    business_name: string
  }
  created_at: string
  status: string
  cut_orders: CutOrder[]
}

interface ReassignmentModalProps {
  isOpen: boolean
  onClose: () => void
  targetCutOrder: CutOrder | null // El corte que necesita material
  onReassign: (fromCutOrderId: string, toCutOrderId: string) => Promise<void>
}

export default function ReassignmentModal({
  isOpen,
  onClose,
  targetCutOrder,
  onReassign
}: ReassignmentModalProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCutOrder, setSelectedCutOrder] = useState<CutOrder | null>(null)

  useEffect(() => {
    if (isOpen && targetCutOrder) {
      loadAvailableOrders()
    }
  }, [isOpen, targetCutOrder])

  useEffect(() => {
    filterOrders()
  }, [searchTerm, orders])

  async function loadAvailableOrders() {
    setLoading(true)
    try {
      const { getAvailableOrdersForReassignment } = await import('@/app/actions/dashboard-data')
      const orders = await getAvailableOrdersForReassignment('', targetCutOrder?.quantity_requested || 0)

      // Filtrar por cortes completados o entregados
      const filtered = orders?.filter(order => 
        order.cut_orders?.some((cutOrder: any) => cutOrder.status === 'completada' || cutOrder.status === 'entregado')
      ) || []

      // Normalizar datos de Supabase (convierte arrays a objetos simples)
      const normalizedOrders = (filtered || []).map((order: any) => ({
        ...order,
        client: Array.isArray(order.client) ? order.client[0] : order.client,
        cut_orders: Array.isArray(order.cut_orders) ? order.cut_orders.map((co: any) => ({
          ...co,
          product: Array.isArray(co.product) ? co.product[0] : co.product
        })) : []
      }))

      // Filtrar solo pedidos que tengan cortes completados válidos
      const validOrders = normalizedOrders.filter((order: any) => 
        order.cut_orders && order.cut_orders.length > 0
      )

      setOrders(validOrders)
      setFilteredOrders(validOrders)
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterOrders() {
    if (!searchTerm) {
      setFilteredOrders(orders)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = orders.filter(order =>
      order.order_number.toLowerCase().includes(term) ||
      order.client.business_name.toLowerCase().includes(term)
    )
    setFilteredOrders(filtered)
  }

  async function handleReassign() {
    if (!selectedCutOrder || !targetCutOrder) return

    setProcessing(true)
    try {
      await onReassign(selectedCutOrder.id, targetCutOrder.id)
      onClose()
    } catch (error) {
      console.error('Error reassigning:', error)
      toast.error('Error al reasignar material')
    } finally {
      setProcessing(false)
    }
  }

  if (!isOpen || !targetCutOrder) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-6xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-start">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Reasignar Material
            </h2>
            <div className="text-sm text-muted-foreground">
              <p><strong>Necesita:</strong> {targetCutOrder.product.name}</p>
              <p><strong>Cantidad:</strong> {targetCutOrder.quantity_requested}m</p>
              <p><strong>Para:</strong> {targetCutOrder.cut_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X size={20} strokeWidth={1.75} className="text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por número de pedido o cliente..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Cargando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No hay material disponible para reasignar</p>
              <p className="text-muted-foreground text-sm mt-2">
                No se encontraron cortes completados con las características necesarias
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Order Header */}
                  <div className="bg-muted px-4 py-3 border-b border-border">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-foreground">{order.order_number}</h3>
                        <p className="text-sm text-muted-foreground">{order.client.business_name}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'aprobado' ? 'bg-green-100 text-green-800' :
                        order.status === 'desarmado' ? 'bg-red-100 text-red-800' :
                        'bg-muted text-foreground'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Cut Orders */}
                  <div className="divide-y divide-slate-200">
                    {order.cut_orders.map(cutOrder => (
                      <div
                        key={cutOrder.id}
                        onClick={() => setSelectedCutOrder(cutOrder)}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedCutOrder?.id === cutOrder.id
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{cutOrder.cut_number}</p>
                            <p className="text-sm text-muted-foreground">{cutOrder.product.name}</p>
                          </div>
                          <div className="text-right mr-4">
                            <p className="font-bold text-foreground">{cutOrder.quantity_requested}m</p>
                            <p className="text-xs text-green-600">✓ Completado</p>
                          </div>
                          {selectedCutOrder?.id === cutOrder.id && (
                            <div className="flex items-center gap-2 text-blue-600">
                              <ArrowRight className="w-5 h-5" />
                              <span className="text-sm font-semibold">Seleccionado</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted">
          {selectedCutOrder && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ Esto desarmará el pedido origen</p>
                  <p>
                    El pedido <strong>{orders.find(o => o.cut_orders.some(c => c.id === selectedCutOrder.id))?.order_number}</strong> quedará 
                    en estado <strong>DESARMADO</strong> y necesitará re-aprobación.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={processing}
              className="px-6 py-3 bg-card border border-slate-300 text-foreground rounded-lg font-semibold hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleReassign}
              disabled={!selectedCutOrder || processing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Reasignando...' : 'Confirmar Reasignación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
