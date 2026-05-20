'use client'

import { useState, useEffect } from 'react'
import { X, Package, ArrowRight } from 'lucide-react'
import { extractSizeFromCode } from '@/lib/product-utils'

interface CompletedCutOrder {
  id: string
  cut_number: string
  quantity_requested: number
  quantity_cut: number
  product: {
    code: string
    name: string
  }
  assigned_inventory: {
    product: {
      code: string
      name: string
    }
  } | null
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
  productCode: string
  productSize: number
  currentOrderId: string
  onClose: () => void
  onConfirm: (fromCutOrderId: string, quantity: number) => Promise<void>
}

export default function ReassignStockModal({
  isOpen,
  cutOrderId,
  productCode,
  productSize,
  currentOrderId,
  onClose,
  onConfirm
}: ReassignStockModalProps) {
  const [ordersWithCutOrders, setOrdersWithCutOrders] = useState<OrderWithCutOrders[]>([])
  const [selectedCutOrderId, setSelectedCutOrderId] = useState<string>('')
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1)
  const [expandedOrderId, setExpandedOrderId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAvailableOrders()
      setSelectedCutOrderId('')
      setExpandedOrderId('')
    }
  }, [isOpen, productCode, productSize])

  async function loadAvailableOrders() {
    setLoading(true)
    try {
      const { getAvailableOrdersForReassignment } = await import('@/app/actions/dashboard-data')
      const orders = await getAvailableOrdersForReassignment(productCode, productSize)

      console.log('📦 Órdenes recibidas:', orders?.length)
      console.log('🔍 Buscando producto:', productCode, 'con tamaño:', productSize)

      // Procesar órdenes - ahora vienen como { id, order_number, status, cut_orders: [...] }
      const processedOrders: OrderWithCutOrders[] = []

      for (const order of orders || []) {
        // Filtrar cut_orders que:
        // 1. Tengan unidades cortadas
        // 2. Sean del MISMO producto (código exacto)
        const validCutOrders = (order.cut_orders || [])
          .filter((co: any) => {
            const product = Array.isArray(co.product) ? co.product[0] : co.product
            const hasCutUnits = (co.quantity_cut || 0) > 0
            const isSameProduct = product?.code === productCode
            
            if (!isSameProduct) {
              console.log(`   ⏭️  Ignorando cut_order: producto ${product?.code} != ${productCode}`)
            }
            
            return hasCutUnits && isSameProduct
          })
          .map((co: any) => {
            const product = Array.isArray(co.product) ? co.product[0] : co.product
            
            return {
              id: co.id,
              cut_number: `${order.order_number}-${co.id.substring(0, 8)}`,
              quantity_requested: co.quantity_requested,
              quantity_cut: co.quantity_cut || 0,
              product: product,
              assigned_inventory: null // No necesitamos material_base aquí
            }
          })

        if (validCutOrders.length > 0 && order.id !== currentOrderId) {
          processedOrders.push({
            id: order.id,
            order_number: order.order_number,
            customer_name: 'Cliente', // No tenemos client en la query
            cut_orders: validCutOrders
          })
        }
      }

      console.log('✅ Órdenes procesadas:', processedOrders.length)
      console.log('   Cut orders disponibles:', processedOrders.reduce((sum, o) => sum + o.cut_orders.length, 0))

      setOrdersWithCutOrders(processedOrders)
    } catch (error) {
      console.error('Error loading available orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!selectedCutOrderId) return
    if (selectedQuantity <= 0) {
      alert('Debe seleccionar al menos 1 unidad')
      return
    }

    setSubmitting(true)
    try {
      await onConfirm(selectedCutOrderId, selectedQuantity)
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Reasignar producto de otro pedido
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Producto: {productCode} • Solo se muestran unidades del mismo producto
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
                <p className="text-lg font-medium">No hay unidades disponibles</p>
                <p className="text-sm mt-2">No se encontraron órdenes completadas del producto {productCode}</p>
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
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Disponibles</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Código</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {order.cut_orders.map((cutOrder) => {
                              const productCode = cutOrder.assigned_inventory?.product.code || cutOrder.product.code || ''
                              
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
                                  <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                    {cutOrder.quantity_cut || 0} unidad{(cutOrder.quantity_cut || 0) !== 1 ? 'es' : ''}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                                    {productCode}
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
          {selectedCutOrder && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ¿Cuántas unidades reasignar?
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max={selectedCutOrder.quantity_cut}
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(Math.min(parseInt(e.target.value) || 1, selectedCutOrder.quantity_cut))}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-center font-bold text-lg"
                />
                <span className="text-sm text-slate-600">
                  de {selectedCutOrder.quantity_cut} disponibles
                </span>
              </div>
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
              {submitting ? 'Reasignando...' : `Reasignar ${selectedQuantity} unidad${selectedQuantity !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
