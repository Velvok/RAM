'use client'

import { useState, useEffect } from 'react'
import { X, Package, ArrowRight } from 'lucide-react'

interface CompletedCutOrder {
  id: string
  cut_number: string
  quantity_requested: number
  product: {
    code: string
    name: string
  }
  assigned_inventory: {
    product: {
      code: string
      name: string
    }
  }
}

interface OrderWithCutOrders {
  id: string
  order_number: string
  customer_name: string
  cut_orders: CompletedCutOrder[]
}

interface ReassignStockModalProps {
  isOpen: boolean
  cutOrderId: string
  productSize: number
  currentOrderId: string
  onClose: () => void
  onConfirm: (fromCutOrderId: string) => Promise<void>
}

export default function ReassignStockModal({
  isOpen,
  cutOrderId,
  productSize,
  currentOrderId,
  onClose,
  onConfirm
}: ReassignStockModalProps) {
  const [ordersWithCutOrders, setOrdersWithCutOrders] = useState<OrderWithCutOrders[]>([])
  const [selectedCutOrderId, setSelectedCutOrderId] = useState<string>('')
  const [expandedOrderId, setExpandedOrderId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAvailableOrders()
      setSelectedCutOrderId('')
      setExpandedOrderId('')
    }
  }, [isOpen, productSize])

  async function loadAvailableOrders() {
    setLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      // Obtener todas las órdenes de corte completadas con stock asignado
      // Incluimos material_base para obtener el producto de la chapa asignada
      const { data: cutOrders, error } = await supabase
        .from('cut_orders')
        .select(`
          id,
          cut_number,
          quantity_requested,
          order_id,
          material_base_id,
          product:products!cut_orders_product_id_fkey(code, name),
          material_base:products!cut_orders_material_base_id_fkey(code, name),
          order:orders!cut_orders_order_id_fkey(id, order_number, client:clients(business_name))
        `)
        .eq('status', 'completada')
        .not('material_base_id', 'is', null)

      if (error) throw error

      console.log('📦 Órdenes completadas encontradas:', cutOrders?.length)
      console.log('🔍 Buscando chapas para tamaño:', productSize)

      // Filtrar por tamaño de la CHAPA ASIGNADA (usando material_base)
      const filtered = (cutOrders || []).filter((co: any) => {
        try {
          // Obtener el producto de material_base
          const materialBase = Array.isArray(co.material_base) 
            ? co.material_base[0] 
            : co.material_base
          
          if (!materialBase?.code) {
            console.log(`  ⚠️ Orden ${co.cut_number}: Sin material_base`)
            return false
          }
          
          const chapaSize = extractSizeFromCode(materialBase.code)
          console.log(`  - Orden ${co.cut_number}: Chapa ${materialBase.code} = ${chapaSize}m`)
          return chapaSize >= productSize
        } catch (err) {
          console.error(`Error processing order ${co.cut_number}:`, err)
          return false
        }
      })

      console.log('✅ Órdenes filtradas:', filtered.length)

      // Agrupar por pedido
      const grouped: Record<string, OrderWithCutOrders> = {}
      
      filtered.forEach((co: any) => {
        const order = Array.isArray(co.order) ? co.order[0] : co.order
        const product = Array.isArray(co.product) ? co.product[0] : co.product
        const materialBase = Array.isArray(co.material_base)
          ? co.material_base[0]
          : co.material_base

        // Obtener client
        const client = Array.isArray(order.client) ? order.client[0] : order.client
        const customerName = client?.business_name || 'Cliente desconocido'

        const orderId = order.id
        if (!grouped[orderId]) {
          grouped[orderId] = {
            id: orderId,
            order_number: order.order_number,
            customer_name: customerName,
            cut_orders: []
          }
        }
        grouped[orderId].cut_orders.push({
          id: co.id,
          cut_number: co.cut_number,
          quantity_requested: co.quantity_requested,
          product: product,
          assigned_inventory: {
            product: materialBase
          }
        })
      })

      // Filtrar para excluir el pedido actual
      const filteredOrders = Object.values(grouped).filter(order => order.id !== currentOrderId)
      setOrdersWithCutOrders(filteredOrders)
    } catch (error) {
      console.error('Error loading available orders:', error)
    } finally {
      setLoading(false)
    }
  }

  function extractSizeFromCode(code: string): number {
    const match = code.match(/\.(\d+),(\d+)$/)
    if (match) {
      return parseFloat(`${match[1]}.${match[2]}`)
    }
    return 0
  }

  async function handleConfirm() {
    if (!selectedCutOrderId) return

    setSubmitting(true)
    try {
      await onConfirm(selectedCutOrderId)
      onClose()
    } catch (error) {
      console.error('Error reassigning stock:', error)
      alert('Error al reasignar: ' + (error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function getSelectedCutOrder() {
    for (const order of ordersWithCutOrders) {
      const cutOrder = order.cut_orders.find(co => co.id === selectedCutOrderId)
      if (cutOrder) return cutOrder
    }
    return null
  }

  if (!isOpen) return null

  const selectedCutOrder = getSelectedCutOrder()
  const selectedSize = selectedCutOrder ? extractSizeFromCode(selectedCutOrder.assigned_inventory.product.code) : 0
  const willGenerateRemnant = selectedSize > productSize

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              🔄 Reasignar chapa de otro pedido
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Necesita: {productSize}m • Mostrando chapas de {productSize}m o mayores
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Cargando pedidos disponibles...</p>
              </div>
            </div>
          ) : ordersWithCutOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">No hay chapas disponibles</p>
                <p className="text-sm mt-2">No se encontraron órdenes completadas con chapas de {productSize}m o mayores</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {ordersWithCutOrders.map((order) => (
                  <div key={order.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Pedido Header */}
                    <button
                      onClick={() => setExpandedOrderId(expandedOrderId === order.id ? '' : order.id)}
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-slate-600" />
                        <div className="text-left">
                          <div className="font-semibold text-slate-900">
                            {order.order_number}
                          </div>
                          <div className="text-sm text-slate-600">
                            {order.customer_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                          {order.cut_orders.length} {order.cut_orders.length === 1 ? 'chapa' : 'chapas'} disponible{order.cut_orders.length === 1 ? '' : 's'}
                        </span>
                        <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform ${expandedOrderId === order.id ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {/* Órdenes de Corte */}
                    {expandedOrderId === order.id && (
                      <div className="bg-white">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="w-12 px-4 py-2"></th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Orden</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Chapa Asignada</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Tamaño</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {order.cut_orders.map((cutOrder) => {
                              const chapaSize = extractSizeFromCode(cutOrder.assigned_inventory.product.code)
                              const isExact = chapaSize === productSize
                              const isBigger = chapaSize > productSize
                              
                              return (
                                <tr
                                  key={cutOrder.id}
                                  onClick={() => setSelectedCutOrderId(cutOrder.id)}
                                  className={`cursor-pointer transition-colors ${
                                    selectedCutOrderId === cutOrder.id
                                      ? 'bg-blue-50 border-l-4 border-blue-500'
                                      : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="radio"
                                      name="cutOrder"
                                      checked={selectedCutOrderId === cutOrder.id}
                                      onChange={() => setSelectedCutOrderId(cutOrder.id)}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                    {cutOrder.cut_number}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    {cutOrder.product.name}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                                    {cutOrder.assigned_inventory.product.code}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                    {chapaSize}m
                                  </td>
                                  <td className="px-4 py-3">
                                    {isExact ? (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                        ✓ Exacta
                                      </span>
                                    ) : isBigger ? (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                        ⚡ Sobra {(chapaSize - productSize).toFixed(1)}m
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
          {selectedCutOrder && willGenerateRemnant && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚡ <strong>Chapa más grande seleccionada:</strong> Al cortar esta orden, se generará un recorte de {(selectedSize - productSize).toFixed(1)}m que se sumará al stock.
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-white border-2 border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedCutOrderId || submitting}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
            >
              {submitting ? 'Reasignando...' : 'Confirmar reasignación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
