'use client'

import { useState, useEffect } from 'react'
import { getOrderById } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, Clock, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import OrderActions from './order-actions'
import ReassignStockModal from '@/components/reassign-stock-modal'
import { useSuccess } from '@/components/success-modal'
import { useError } from '@/components/error-modal'

export default function OrderDetailClient({ initialOrder }: { initialOrder: any }) {
  const [order, setOrder] = useState(initialOrder)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [changeStockModalOpen, setChangeStockModalOpen] = useState(false)
  const [selectedCutOrder, setSelectedCutOrder] = useState<any>(null)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const { showSuccess, SuccessDialog } = useSuccess()
  const { showError, ErrorDialog } = useError()

  // Auto-refresh si hay órdenes pendientes de confirmación
  useEffect(() => {
    const hasPendingConfirmation = order.cut_orders?.some(
      (co: any) => co.status === 'pendiente_confirmacion'
    )
    
    if (hasPendingConfirmation) {
      const interval = setInterval(async () => {
        console.log('🔄 Auto-refresh: Verificando cambios...')
        try {
          const updated = await getOrderById(order.id)
          // Solo actualizar si hay cambios en los estados
          const hasChanges = updated.cut_orders?.some((newCo: any) => {
            const oldCo = order.cut_orders?.find((co: any) => co.id === newCo.id)
            return oldCo && oldCo.status !== newCo.status
          })
          
          if (hasChanges) {
            console.log('✅ Cambios detectados, actualizando...')
            setOrder(updated)
            setRefreshKey(prev => prev + 1)
            await loadActivityLog()
          }
        } catch (error) {
          console.error('Error en auto-refresh:', error)
        }
      }, 5000) // Cada 5 segundos
      
      return () => clearInterval(interval)
    }
  }, [order.cut_orders])

  // Función para recargar el pedido completo
  async function reloadOrder() {
    try {
      // Agregar timestamp para evitar caché
      const timestamp = Date.now()
      const updated = await getOrderById(order.id)
      setOrder(updated)
      setRefreshKey(prev => prev + 1)
      await loadActivityLog()
    } catch (error) {
      console.error('Error reloading order:', error)
    }
  }

  // Cargar log de actividades
  async function loadActivityLog() {
    setLoadingLog(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('order_activity_log')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      console.log('📋 Activity log loaded:', data)
      setActivityLog(data || [])
    } catch (error) {
      console.error('Error loading activity log:', error)
    } finally {
      setLoadingLog(false)
    }
  }

  // Cargar log al montar
  useEffect(() => {
    loadActivityLog()
  }, [order.id])

  function openReassignModal(cutOrder: any) {
    setSelectedCutOrder(cutOrder)
    setReassignModalOpen(true)
  }

  async function handleReassign(fromCutOrderId: string, quantity: number) {
    try {
      const { reassignStock } = await import('@/app/actions/stock-management')
      const result = await reassignStock(fromCutOrderId, selectedCutOrder.id, quantity)
      
      showSuccess(
        `Desde: ${result.fromOrder}\nA: ${result.toOrder}\nChapa: ${result.productCode}`,
        '✅ Chapa Reasignada'
      )
      
      setReassignModalOpen(false)
      
      // Recargar pedido y log
      await reloadOrder()
      
      // Forzar recarga del log después de un delay
      setTimeout(async () => {
        await loadActivityLog()
      }, 500)
    } catch (error: any) {
      console.error('Error reassigning:', error)
      showError(
        error.message || 'Error desconocido al reasignar stock',
        '❌ Error al Reasignar'
      )
      throw error
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/pedidos">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {order.order_number}
            </h2>
            <p className="text-slate-600">
              Cliente: {order.client?.business_name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              order.status === 'ingresado'
                ? 'bg-blue-100 text-blue-800'
                : order.status === 'lanzado'
                ? 'bg-green-100 text-green-800'
                : order.status === 'generado'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Monto Total
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(order.total_amount)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Fecha de Creación
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatDate(order.created_at)}
          </div>
        </div>
      </div>

      {/* Líneas del Pedido */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Líneas del Pedido
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Precio Unit.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {order.lines?.map((line: any) => (
                <tr key={line.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {line.product?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <span className="font-semibold">
                      {line.units || Math.ceil(line.quantity) || 1} unidades
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {formatCurrency(line.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {formatCurrency(line.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Órdenes de Corte */}
      {order.cut_orders && order.cut_orders.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">
              Órdenes de Corte
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Código Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Stock Asignado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {order.cut_orders.map((cutOrder: any) => (
                  <tr key={cutOrder.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {cutOrder.cut_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                      {cutOrder.product?.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {cutOrder.product?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={cutOrder.quantity_cut >= cutOrder.quantity_requested ? 'text-green-600' : 'text-slate-900'}>
                        {cutOrder.quantity_cut || 0}/{cutOrder.quantity_requested}
                      </span>
                      {cutOrder.quantity_cut > 0 && cutOrder.quantity_cut < cutOrder.quantity_requested && (
                        <span className="ml-2 text-xs text-yellow-600">
                          ({cutOrder.quantity_requested - cutOrder.quantity_cut} pendientes)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        {cutOrder.material_base_id ? (
                          <>
                            <span className="text-green-600 font-medium">
                              ✓ {cutOrder.material_base_quantity}m
                            </span>
                            {cutOrder.stock_disponible < 0 && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Sin stock
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-yellow-600">
                            Sin asignar
                          </span>
                        )}
                        {cutOrder.status === 'pendiente' && (cutOrder.quantity_cut || 0) < cutOrder.quantity_requested && (
                          <button
                            onClick={() => {
                              setSelectedCutOrder(cutOrder)
                              setChangeStockModalOpen(true)
                            }}
                            className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {cutOrder.material_base_id ? 'Cambiar' : 'Asignar'}
                            {(cutOrder.quantity_cut || 0) > 0 && ` (${cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)} restantes)`}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cutOrder.status === 'pendiente' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </span>
                      ) : cutOrder.status === 'pendiente_confirmacion' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente Operario
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completada
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cutOrder.status === 'pendiente' && (
                        <button
                          onClick={() => openReassignModal(cutOrder)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          <ArrowRightLeft className="w-3 h-3 mr-1" />
                          Reasignar
                        </button>
                      )}
                      {cutOrder.status === 'completada' && (
                        <span className="text-xs text-slate-400">Completado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid con Cliente y Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del Cliente */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Información del Cliente
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-slate-600">
                Razón Social
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {order.client?.business_name}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">CUIT</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {order.client?.tax_id}
              </dd>
            </div>
            {order.client?.contact_name && (
              <div>
                <dt className="text-sm font-medium text-slate-600">Contacto</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {order.client.contact_name}
                </dd>
              </div>
            )}
            {order.client?.contact_phone && (
              <div>
                <dt className="text-sm font-medium text-slate-600">Teléfono</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {order.client.contact_phone}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Acciones - Pasar función de recarga */}
        <OrderActions key={refreshKey} order={order} onUpdate={reloadOrder} />
      </div>

      {/* Log de Actividades */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            📋 Historial de Actividades
          </h3>
        </div>
        <div className="p-6">
          {loadingLog ? (
            <div className="text-center py-8 text-slate-400">
              Cargando historial...
            </div>
          ) : activityLog.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No hay actividades registradas
            </div>
          ) : (
            <div className="space-y-3">
              {activityLog.map((activity) => (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    activity.activity_type === 'reassign_out' 
                      ? 'bg-orange-50 border-orange-200' 
                      : activity.activity_type === 'reassign_in'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.activity_type === 'reassign_out'
                      ? 'bg-orange-100'
                      : activity.activity_type === 'reassign_in'
                      ? 'bg-green-100'
                      : 'bg-blue-100'
                  }`}>
                    {activity.activity_type === 'reassign_out' ? (
                      <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                    ) : activity.activity_type === 'reassign_in' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : activity.activity_type === 'reassign' ? (
                      <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {activity.description}
                    </p>
                    {activity.metadata && (
                      <div className="mt-2 text-xs text-slate-600 bg-white/50 rounded p-2 border border-slate-200">
                        <p><strong>Acción:</strong> {activity.metadata.action}</p>
                        {activity.metadata.product_code && (
                          <p><strong>Chapa:</strong> {activity.metadata.product_code}</p>
                        )}
                        {activity.metadata.from_order_number && activity.metadata.to_order_number && (
                          <p><strong>Transferencia:</strong> {activity.metadata.from_order_number} → {activity.metadata.to_order_number}</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(activity.created_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reasignación */}
      {selectedCutOrder && (
        <ReassignStockModal
          isOpen={reassignModalOpen}
          cutOrderId={selectedCutOrder.id}
          productSize={selectedCutOrder.product?.length_meters || selectedCutOrder.quantity_requested}
          currentOrderId={order.id}
          onClose={() => setReassignModalOpen(false)}
          onConfirm={handleReassign}
        />
      )}

      {/* Modal de Cambio de Stock */}
      {changeStockModalOpen && selectedCutOrder && (
        <ChangeStockModal
          cutOrder={selectedCutOrder}
          onClose={() => {
            setChangeStockModalOpen(false)
            setSelectedCutOrder(null)
          }}
          onSuccess={async () => {
            setChangeStockModalOpen(false)
            setSelectedCutOrder(null)
            await reloadOrder()
            showSuccess('Stock actualizado correctamente', '✅ Stock Cambiado')
          }}
        />
      )}

      {/* Diálogos de notificación */}
      <SuccessDialog />
      <ErrorDialog />
    </div>
  )
}

// Modal completo para cambiar stock (tipo grid como /stock)
function ChangeStockModal({ cutOrder, onClose, onSuccess }: any) {
  const [availableStock, setAvailableStock] = useState<any[]>([])
  const [selectedStock, setSelectedStock] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAvailableStock()
  }, [])

  async function loadAvailableStock() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Obtener el tamaño del producto solicitado
      const productSize = cutOrder.product?.length_meters || cutOrder.quantity_requested
      
      // Extraer el código base del producto (sin el tamaño)
      // Ejemplo: "AC25110.3,0" -> "AC25110"
      const productCode = cutOrder.product?.code || ''
      const baseCode = productCode.split('.')[0] // Obtener solo "AC25110"
      
      console.log('Buscando stock para:', { productCode, baseCode, productSize })

      // Buscar TODO el stock disponible
      const { data, error } = await supabase
        .from('inventory')
        .select('id, product_id, stock_disponible, stock_reservado, stock_total, product:products!inventory_product_id_fkey(id, code, name, length_meters)')
        .gt('stock_disponible', 0)

      if (error) {
        console.error('Error en consulta:', error)
        throw error
      }
      
      console.log('Stock total encontrado:', data?.length)
      
      // Filtrar por:
      // 1. Mismo tipo de producto (mismo código base)
      // 2. Tamaño >= solicitado
      // Y ordenar por tamaño
      const filtered = (data || [])
        .filter(item => {
          const product = Array.isArray(item.product) ? item.product[0] : item.product
          if (!product) return false
          
          // Verificar que sea el mismo tipo de producto
          const itemBaseCode = product.code?.split('.')[0]
          const isSameProduct = itemBaseCode === baseCode
          
          // Verificar que sea de tamaño suficiente
          const isSufficientSize = product.length_meters >= productSize
          
          return isSameProduct && isSufficientSize
        })
        .sort((a, b) => {
          const prodA = Array.isArray(a.product) ? a.product[0] : a.product
          const prodB = Array.isArray(b.product) ? b.product[0] : b.product
          return (prodA?.length_meters || 0) - (prodB?.length_meters || 0)
        })
      
      console.log('Stock filtrado (mismo producto, tamaño suficiente):', filtered.length, filtered)
      setAvailableStock(filtered)
    } catch (error) {
      console.error('Error loading stock:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeStock() {
    if (!selectedStock) return

    try {
      setLoading(true)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const product = Array.isArray(selectedStock.product) ? selectedStock.product[0] : selectedStock.product
      if (!product) {
        alert('Error: producto no encontrado')
        return
      }

      // Calcular cuántas unidades quedan pendientes (no cortadas)
      const quantityPending = cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)
      console.log(`📊 Pendientes de cortar: ${quantityPending} de ${cutOrder.quantity_requested}`)

      // 1. Si había stock anterior asignado, liberar las reservas PENDIENTES
      if (cutOrder.material_base_id) {
        console.log('Liberando reservas del stock anterior...')
        
        // Obtener inventory_id del stock anterior
        const { data: oldInventory } = await supabase
          .from('inventory')
          .select('id')
          .eq('product_id', cutOrder.material_base_id)
          .single()

        if (oldInventory) {
          // Liberar solo las unidades PENDIENTES (no las ya cortadas)
          const { unreserveStock } = await import('@/app/actions/stock-management')
          await unreserveStock(oldInventory.id, quantityPending)
          console.log(`✅ Liberadas ${quantityPending} reservas del stock anterior (${cutOrder.quantity_cut || 0} ya cortadas se mantienen)`)
        }
      }

      // 2. Reservar en el nuevo stock solo las PENDIENTES
      console.log('Reservando en el nuevo stock...')
      const { reserveStock } = await import('@/app/actions/stock-management')
      
      for (let i = 0; i < quantityPending; i++) {
        await reserveStock(selectedStock.id)
      }
      console.log(`✅ Reservadas ${quantityPending} unidades en el nuevo stock`)

      // 3. Actualizar la asignación en cut_orders
      const { error } = await supabase
        .from('cut_orders')
        .update({
          material_base_id: product.id,
          material_base_quantity: product.length_meters
        })
        .eq('id', cutOrder.id)

      if (error) throw error

      onSuccess()
    } catch (error) {
      console.error('Error changing stock:', error)
      alert('Error al cambiar stock: ' + (error as any).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold mb-2">Seleccionar Stock</h3>
          <p className="text-sm text-slate-600">
            Orden: <strong>{cutOrder.cut_number}</strong> - {cutOrder.product?.name}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Mostrando chapas de {cutOrder.product?.length_meters || cutOrder.quantity_requested}m o superiores
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Cargando stock disponible...</p>
            </div>
          ) : availableStock.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium">No hay stock disponible</p>
              <p className="text-sm text-slate-500 mt-2">
                No hay chapas de tamaño suficiente en stock
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableStock.map((item) => {
                const product = Array.isArray(item.product) ? item.product[0] : item.product
                const isSelected = selectedStock?.id === item.id
                const isCurrentlyAssigned = item.product_id === cutOrder.material_base_id
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedStock(item)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isCurrentlyAssigned
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-slate-900">{product?.name}</h4>
                        <p className="text-sm text-slate-600">{product?.code}</p>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">
                        {product?.length_meters}m
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <p className="text-slate-500">Disponible</p>
                        <p className="font-bold text-green-600">{item.stock_disponible}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reservado</p>
                        <p className="font-bold text-yellow-600">{item.stock_reservado}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total</p>
                        <p className="font-bold text-slate-700">{item.stock_total}</p>
                      </div>
                    </div>
                    
                    {isCurrentlyAssigned && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-green-600 font-medium">✓ Asignado actualmente</p>
                      </div>
                    )}
                    
                    {isSelected && !isCurrentlyAssigned && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-xs text-blue-600 font-medium">✓ Seleccionado</p>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleChangeStock}
            disabled={!selectedStock || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Cambiando...' : selectedStock ? `Asignar ${(Array.isArray(selectedStock.product) ? selectedStock.product[0] : selectedStock.product)?.length_meters}m` : 'Seleccionar Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}
