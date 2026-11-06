'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getOrderById } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, Clock, ArrowRightLeft, AlertTriangle, Info, Package, Undo2 } from 'lucide-react'
import Link from 'next/link'
import OrderActions from './order-actions'
import ReassignStockModal from '@/components/reassign-stock-modal'
import { useSuccess } from '@/components/success-modal'
import { useError } from '@/components/error-modal'
import { extractSizeFromName, extractSizeFromCode } from '@/lib/product-utils'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import OrderNotesAdmin from '@/components/order-notes-admin'
import { OrderStatusBadge } from '@/components/order-status-badge'

export default function OrderDetailClient({ initialOrder }: { initialOrder: any }) {
  const [order, setOrder] = useState(initialOrder)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [changeStockModalOpen, setChangeStockModalOpen] = useState(false)
  const [selectedCutOrder, setSelectedCutOrder] = useState<any>(null)
  const [selectedPreparationItem, setSelectedPreparationItem] = useState<any>(null)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [showCutOrdersInfo, setShowCutOrdersInfo] = useState(false)
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

  // Auto-refresh para detectar cambios desde tablet
  useAutoRefresh(order.id, () => getOrderById(order.id), {
    enabled: true,
    interval: 10, // Verificar cada 10 segundos
    // Aplicar los cambios sin recargar la página entera
    onChange: (updated) => {
      setOrder(updated)
      setRefreshKey(prev => prev + 1)
      loadActivityLog()
    },
  })

  // Cargar log de actividades
  async function loadActivityLog() {
    setLoadingLog(true)
    try {
      const { getOrderActivityLog } = await import('@/app/actions/client-queries')
      const data = await getOrderActivityLog(order.id)
      
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

      showSuccess(`Desde: ${result.fromOrder} · A: ${result.toOrder} · Producto: ${result.productCode} · Cantidad: ${quantity} unidad${quantity !== 1 ? 'es' : ''}`, 'Producto reasignado correctamente')

      setReassignModalOpen(false)

      // Recargar pedido y log
      await reloadOrder()

      // Forzar recarga del log después de un delay
      setTimeout(async () => {
        await loadActivityLog()
      }, 500)
    } catch (error: any) {
      console.error('Error reassigning:', error)
      showError(error.message || 'Error desconocido al reasignar stock', 'Error al reasignar')
      throw error
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/admin/pedidos" className="mt-0.5">
            <Button variant="outline" size="icon" aria-label="Volver a pedidos">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{order.order_number}</h1>
              <OrderStatusBadge status={order.status} size="md" />
              {order.status === 'modificado' && <span className="text-xs font-medium text-warning">ampliación de EVO pendiente de aprobar</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.client?.business_name || 'Sin cliente'} · entró el {formatDate(order.created_at)}
              {order.evo_order_id && order.evo_order_id !== order.order_number ? ` · EVO ${order.evo_order_id}` : ''}
              {order.delivered_at ? ` · entregado el ${formatDate(order.delivered_at)}` : ''}
            </p>
          </div>
        </div>
        <OrderActions
          key={refreshKey}
          order={order}
          onUpdate={reloadOrder}
          isHeaderMode={true}
        />
      </div>

      {/* Resumen */}
      {(() => {
        const cuts = order.cut_orders || []
        const preps = order.preparation_items || []
        const units = (order.lines || []).reduce((s: number, l: any) => s + (l.units || Math.ceil(Number(l.quantity)) || 0), 0)
        const pending = (order.lines || []).reduce((s: number, l: any) => s + (l.quantity_pending_approval || 0), 0)
        const done = cuts.reduce((s: number, c: any) => s + Number(c.quantity_cut || 0), 0) + preps.reduce((s: number, p: any) => s + Number(p.quantity_prepared || 0), 0)
        const total = cuts.reduce((s: number, c: any) => s + Number(c.quantity_requested || 0), 0) + preps.reduce((s: number, p: any) => s + Number(p.quantity_requested || 0), 0)
        const delivered = cuts.reduce((s: number, c: any) => s + Number(c.quantity_delivered || 0), 0) + preps.reduce((s: number, p: any) => s + Number(p.quantity_delivered || 0), 0)
        const withoutStock = cuts.filter((c: any) => !c.material_base_id).length + preps.filter((p: any) => !p.assigned_inventory_id).length
        const tiles = [
          { label: 'Cliente', value: order.client?.business_name || 'Sin cliente', detail: order.client?.tax_id ? `CUIT ${order.client.tax_id}` : order.client?.contact_name || '' },
          { label: 'Unidades pedidas', value: `${units}${pending ? ` +${pending}` : ''}`, detail: pending ? `${pending} pendientes de aprobar` : `${(order.lines || []).length} línea${(order.lines || []).length === 1 ? '' : 's'}` },
          { label: 'Planta', value: total ? `${done}/${total}` : '—', detail: total ? (withoutStock ? `${withoutStock} sin stock asignado` : done >= total ? 'todo cortado y preparado' : `${total - done} por hacer`) : 'sin órdenes todavía' },
          { label: 'Entregado', value: delivered ? `${delivered}/${total}` : '—', detail: order.delivered_at ? formatDate(order.delivered_at) : delivered ? 'entrega parcial' : 'sin remito de EVO' },
        ]
        return (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {tiles.map(t => (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-semibold text-muted-foreground">{t.label}</div>
                <div className="mt-1 truncate text-xl font-bold text-foreground" title={String(t.value)}>{t.value}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{t.detail}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Notas para Operario */}
      <div className="col-span-2">
        <OrderNotesAdmin orderId={order.id} />
      </div>

      {/* Pedido (Líneas del Pedido) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Pedido
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Producto
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Cantidad
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Precio Unit.
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {order.lines?.map((line: any) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                    {line.product?.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    <span className="font-semibold">
                      {line.units || Math.ceil(line.quantity) || (line.quantity_pending_approval ? 0 : 1)} unidades
                    </span>
                    {line.quantity_pending_approval > 0 && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        +{line.quantity_pending_approval} pendientes de aprobar
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {formatCurrency(line.unit_price)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
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
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Órdenes de Corte
              </h2>
              <div className="relative">
                <button
                  onMouseEnter={() => setShowCutOrdersInfo(true)}
                  onMouseLeave={() => setShowCutOrdersInfo(false)}
                  className="text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  <Info className="w-4 h-4" />
                </button>
                
                {/* Tooltip */}
                {showCutOrdersInfo && (
                  <div className="absolute left-0 top-full mt-2 w-80 bg-card rounded-lg shadow-xl border border-border p-4 z-50">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground mb-1">Acciones disponibles:</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="text-blue-600 font-medium min-w-[70px]">Cambiar:</span>
                          <span className="text-muted-foreground">Permite cambiar la chapa asignada por otra de tamaño suficiente disponible en stock.</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <span className="text-yellow-600 font-medium min-w-[70px]">Estado:</span>
                          <span className="text-muted-foreground">Indica si la orden está pendiente, en proceso o completada por el operario.</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <span className="text-blue-600 font-medium min-w-[70px]">Reasignar:</span>
                          <span className="text-muted-foreground">Transfiere chapas ya cortadas de otros pedidos a esta orden cuando no hay stock disponible o cuando quieres armar un pedido para que salga lo antes posible.</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Flecha del tooltip */}
                    <div className="absolute -top-2 left-4 w-4 h-4 bg-card border-l border-t border-border transform rotate-45"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Número
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Código Producto
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Producto
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cantidad
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Stock Asignado
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {order.cut_orders.map((cutOrder: any) => (
                  <tr key={cutOrder.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                      {cutOrder.cut_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground font-mono">
                      {cutOrder.product?.code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      {cutOrder.product?.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col gap-1">
                        <span className={(cutOrder.quantity_cut - (cutOrder.quantity_delivered || 0)) >= (cutOrder.quantity_requested - (cutOrder.quantity_delivered || 0)) ? 'text-green-600' : 'text-foreground'}>
                          Cortadas: {(cutOrder.quantity_cut || 0) - (cutOrder.quantity_delivered || 0)}/{cutOrder.quantity_requested - (cutOrder.quantity_delivered || 0)}
                        </span>
                        {(cutOrder.quantity_delivered || 0) > 0 && (
                          <span className="text-xs text-blue-600">
                            Entregadas: {cutOrder.quantity_delivered || 0}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {cutOrder.material_base_id ? (
                          <>
                            {(() => {
                              const size = Number(cutOrder.material_base_quantity || 0)
                              return (
                                <span className="text-green-600 font-medium">
                                  ✓ {size > 0 ? `${size.toFixed(1)}m` : cutOrder.material_base?.code || 'Stock asignado'}
                                </span>
                              )
                            })()}
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
                        {cutOrder.status === 'pendiente' && (
                          <button
                            onClick={() => {
                              setSelectedCutOrder(cutOrder)
                              setChangeStockModalOpen(true)
                            }}
                            className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {cutOrder.material_base_id ? 'Cambiar' : 'Asignar'}
                            {(cutOrder.quantity_cut || 0) < cutOrder.quantity_requested && ` (${cutOrder.quantity_requested - (cutOrder.quantity_cut || 0)} restantes)`}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {cutOrder.status === 'pendiente' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </span>
                      ) : cutOrder.status === 'pendiente_confirmacion' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente Operario
                        </span>
                      ) : cutOrder.status === 'entregado' ? (
                        <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Entregado
                        </span>
                      ) : (
                        <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {cutOrder.status === 'pendiente' && (
                        <button
                          onClick={() => openReassignModal(cutOrder)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          <ArrowRightLeft className="w-3 h-3 mr-1" />
                          Reasignar
                        </button>
                      )}
                      {(cutOrder.status === 'completada' || cutOrder.status === 'entregado') && (
                        <span className="text-xs text-muted-foreground">{cutOrder.status === 'entregado' ? 'Entregado' : 'Completado'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Artículos a Preparar */}
      {order.preparation_items && order.preparation_items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-base font-semibold text-foreground">
              Artículos a Preparar
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Código Producto
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Producto
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cantidad
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Stock Asignado
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {order.preparation_items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground font-mono">
                      {item.product?.code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      {item.product?.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col gap-1">
                        <span className={(item.quantity_prepared - (item.quantity_delivered || 0)) >= (item.quantity_requested - (item.quantity_delivered || 0)) ? 'text-green-600' : 'text-foreground'}>
                          Preparadas: {(item.quantity_prepared || 0) - (item.quantity_delivered || 0)}/{item.quantity_requested - (item.quantity_delivered || 0)}
                        </span>
                        {(item.quantity_delivered || 0) > 0 && (
                          <span className="text-xs text-blue-600">
                            Entregadas: {item.quantity_delivered || 0}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {item.assigned_inventory ? (
                          <span className="text-green-600 font-medium">
                            ✓ {item.assigned_inventory.product?.code || 'Stock asignado'}
                          </span>
                        ) : (
                          <span className="text-yellow-600">
                            Sin asignar
                          </span>
                        )}
                        {item.status === 'pendiente' && (
                          <button
                            onClick={() => {
                              setSelectedPreparationItem(item)
                              setChangeStockModalOpen(true)
                            }}
                            className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {item.assigned_inventory ? 'Cambiar' : 'Asignar'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'entregado'
                          ? 'bg-blue-100 text-blue-800'
                          : item.status === 'completada'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'en_proceso'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status === 'entregado' ? 'Entregado' : item.status === 'completada' ? 'Completada' : item.status === 'en_proceso' ? 'En Proceso' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log de Actividades */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Historial de Actividades
          </h2>
        </div>
        <div className="p-6">
          {loadingLog ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando historial...
            </div>
          ) : activityLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay actividades registradas
            </div>
          ) : (
            <div className="space-y-3">
              {activityLog.map((activity) => {
                // Determinar colores según el tipo de actividad
                let bgColor = 'bg-muted'
                let borderColor = 'border-border'
                let iconBgColor = 'bg-blue-100'
                let iconColor = 'text-blue-600'
                let icon = <Clock className="w-5 h-5" />

                if (activity.activity_type === 'reassign_out') {
                  bgColor = 'bg-blue-50'
                  borderColor = 'border-blue-200'
                  iconBgColor = 'bg-blue-100'
                  iconColor = 'text-blue-600'
                  icon = <ArrowRightLeft className="w-5 h-5" />
                } else if (activity.activity_type === 'reassign_in') {
                  bgColor = 'bg-green-50'
                  borderColor = 'border-green-200'
                  iconBgColor = 'bg-green-100'
                  iconColor = 'text-green-600'
                  icon = <CheckCircle2 className="w-5 h-5" />
                } else if (activity.activity_type === 'reassign') {
                  bgColor = 'bg-blue-50'
                  borderColor = 'border-blue-200'
                  iconBgColor = 'bg-blue-100'
                  iconColor = 'text-blue-600'
                  icon = <ArrowRightLeft className="w-5 h-5" />
                } else if (activity.activity_type === 'partial_delivery') {
                  bgColor = 'bg-purple-50'
                  borderColor = 'border-purple-200'
                  iconBgColor = 'bg-purple-100'
                  iconColor = 'text-purple-600'
                  icon = <Package className="w-5 h-5" />
                } else if (activity.activity_type === 'partial_delivery_undone') {
                  bgColor = 'bg-orange-50'
                  borderColor = 'border-orange-200'
                  iconBgColor = 'bg-orange-100'
                  iconColor = 'text-orange-600'
                  icon = <Undo2 className="w-5 h-5" />
                }

                return (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${bgColor} ${borderColor}`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBgColor} ${iconColor}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {activity.description}
                      </p>
                      {activity.metadata && (
                        <div className="mt-2 text-xs text-muted-foreground bg-card/50 rounded p-2 border border-border">
                          <p><strong>Acción:</strong> {activity.metadata.action}</p>
                          {activity.metadata.product_code && (
                            <p><strong>Chapa:</strong> {activity.metadata.product_code}</p>
                          )}
                          {activity.metadata.from_order_number && activity.metadata.to_order_number && (
                            <p><strong>Transferencia:</strong> {activity.metadata.from_order_number} → {activity.metadata.to_order_number}</p>
                          )}
                          {activity.metadata.items_delivered && (
                            <p><strong>Items entregados:</strong> {activity.metadata.items_delivered.length}</p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
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
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reasignación */}
      {selectedCutOrder && (
        <ReassignStockModal
          isOpen={reassignModalOpen}
          cutOrderId={selectedCutOrder.id}
          productCode={selectedCutOrder.product?.code || ''}
          productSize={selectedCutOrder.product?.length_meters || selectedCutOrder.quantity_requested}
          currentOrderId={order.id}
          onClose={() => setReassignModalOpen(false)}
          onConfirm={handleReassign}
        />
      )}

      {/* Modal de Cambio de Stock */}
      {changeStockModalOpen && (selectedCutOrder || selectedPreparationItem) && (
        <ChangeStockModal
          cutOrder={selectedCutOrder}
          preparationItem={selectedPreparationItem}
          onClose={() => {
            setChangeStockModalOpen(false)
            setSelectedCutOrder(null)
            setSelectedPreparationItem(null)
          }}
          onSuccess={async () => {
            setChangeStockModalOpen(false)
            setSelectedCutOrder(null)
            setSelectedPreparationItem(null)
            await reloadOrder()
            showSuccess('Stock actualizado correctamente', 'Stock Cambiado')
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
function ChangeStockModal({ cutOrder, preparationItem, onClose, onSuccess }: any) {
  const [availableStock, setAvailableStock] = useState<any[]>([])
  const [selectedStock, setSelectedStock] = useState<any>(null)
  const [quantityForNewMaterial, setQuantityForNewMaterial] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  const item = cutOrder || preparationItem
  const isCutOrder = !!cutOrder

  useEffect(() => {
    loadAvailableStock()
  }, [])

  async function loadAvailableStock() {
    try {
      console.log('🚀 Iniciando loadAvailableStock...')
      const { getAvailableStock } = await import('@/app/actions/get-available-stock')
      const { extractSizeFromCode } = await import('@/lib/product-utils')

      const productCode = item.product?.code || ''
      const productSize = extractSizeFromCode(productCode)
      console.log('🔍 Buscando stock para:', { productCode, productSize, isCutOrder })

      const filtered = await getAvailableStock(productCode)

      // Ordenar para que el stock actualmente asignado vaya primero
      const sorted = filtered.sort((a, b) => {
        const currentId = isCutOrder ? cutOrder.material_base_id : preparationItem.assigned_inventory_id
        const aIsCurrent = a.product_id === currentId
        const bIsCurrent = b.product_id === currentId

        if (aIsCurrent && !bIsCurrent) return -1
        if (!aIsCurrent && bIsCurrent) return 1

        return 0
      })

      console.log('Stock filtrado (mismo producto, tamaño suficiente):', sorted.length)
      setAvailableStock(sorted)

      // Pre-seleccionar el stock del producto exacto
      if (sorted.length > 0) {
        // Primero buscar por product_id exacto (para artículos normales)
        const exactProductMatch = sorted.find(stockItem => 
          stockItem.product_id === item.product_id
        )

        if (exactProductMatch) {
          setSelectedStock(exactProductMatch)
        } else {
          // Si no hay match exacto de producto, buscar por tamaño exacto (para chapas)
          const exactSizeMatch = sorted.find(stockItem => {
            const product = stockItem.product
            const itemSize = extractSizeFromCode(product?.code || '')
            return itemSize === productSize
          })

          // Si hay match de tamaño, seleccionarlo; si no, seleccionar el primero
          setSelectedStock(exactSizeMatch || sorted[0])
        }
      }
    } catch (error) {
      console.error('Error loading stock:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeStock() {
    if (!selectedStock) return

    // Validar cantidad
    if (!quantityForNewMaterial || quantityForNewMaterial < 1) {
      toast.error('Por favor ingresa una cantidad válida de unidades')
      return
    }

    const quantityRequested = isCutOrder ? cutOrder.quantity_requested : preparationItem.quantity_requested
    if (quantityForNewMaterial > quantityRequested) {
      toast.error(`La cantidad no puede exceder lo solicitado (${quantityRequested})`)
      return
    }

    try {
      setLoading(true)
      const product = Array.isArray(selectedStock.product) ? selectedStock.product[0] : selectedStock.product
      if (!product) {
        toast.error('Error: producto no encontrado')
        return
      }

      if (isCutOrder) {
        // Asignar stock a cut_order
        const { reassignStock } = await import('@/app/actions/reassign-stock')

        const result = await reassignStock(
          cutOrder.id,
          selectedStock.id,
          product.id,
          extractSizeFromCode(product.code || ''),
          quantityForNewMaterial
        )

        if (result.success) {
          toast.success(result.message)
          onSuccess()
        } else {
          toast.error('Error reasignando stock')
        }
      } else {
        // Asignar stock a preparation_item
        const { assignStockToPreparationItem } = await import('@/app/actions/preparation')

        await assignStockToPreparationItem(
          preparationItem.id,
          selectedStock.id,
          quantityForNewMaterial
        )

        toast.success('Stock asignado correctamente')
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error asignando stock:', error)
      toast.error(`Error asignando stock: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground mb-2">Seleccionar Stock</h3>
          <p className="text-sm text-muted-foreground">
            {isCutOrder ? (
              <>Orden: <strong>{cutOrder.cut_number}</strong> - {cutOrder.product?.name}</>
            ) : (
              <>Artículo: <strong>{preparationItem.product?.name}</strong></>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Mostrando stock disponible de {item.product?.code}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando stock disponible...</p>
            </div>
          ) : availableStock.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
              </div>
              <p className="text-foreground font-medium mb-2">Chapa actual es la única opción disponible</p>
              <p className="text-sm text-muted-foreground">
                No hay otras chapas de tamaño suficiente en stock para cambiar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableStock.map((item) => {
                const product = Array.isArray(item.product) ? item.product[0] : item.product
                const isSelected = selectedStock?.id === item.id
                const currentId = isCutOrder ? cutOrder?.material_base_id : preparationItem?.assigned_inventory_id
                const isCurrentlyAssigned = item.product_id === currentId
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedStock(item)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isCurrentlyAssigned
                        ? 'border-green-500 bg-green-50'
                        : 'border-border hover:border-blue-300 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-foreground">{product?.name}</h4>
                        <p className="text-sm text-muted-foreground">{product?.code}</p>
                      </div>
                      {(() => {
                        const size = extractSizeFromCode(product?.code || '')
                        return size > 0 ? (
                          <span className="text-2xl font-bold text-blue-600">
                            {size}m
                          </span>
                        ) : null
                      })()}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Disponible</p>
                        <p className="font-bold text-green-600">{item.stock_disponible}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reservado</p>
                        <p className="font-bold text-yellow-600">{item.stock_reservado}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-bold text-foreground">{item.stock_total}</p>
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
        <div className="p-6 border-t bg-muted">
          {/* Input de cantidad de unidades */}
          {selectedStock && (
            <div className="mb-4 p-4 bg-card border border-border rounded-lg">
              <label className="block text-sm font-medium text-foreground mb-2">
                {isCutOrder ? '¿Cuántas unidades vas a cortar con este material?' : '¿Cuántas unidades asignar?'}
              </label>
              <input
                type="number"
                min="1"
                max={item.quantity_requested}
                value={quantityForNewMaterial}
                onChange={(e) => setQuantityForNewMaterial(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isCutOrder 
                  ? 'Se creará una nueva orden de corte con esta cantidad. La orden original se reducirá.'
                  : `Máximo: ${item.quantity_requested} unidades solicitadas`
                }
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-card transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleChangeStock}
              disabled={!selectedStock || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Cambiando...' : selectedStock ? (() => {
                const size = extractSizeFromCode(selectedStock.product?.code || '')
                return size > 0 ? `Asignar ${size}m` : 'Asignar'
              })() : 'Seleccionar Stock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
