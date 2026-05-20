'use client'

import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Package, Undo2, CheckCircle2 } from 'lucide-react'

interface DeliveryHistoryPanelProps {
  deliveryHistory: any[]
  onUndoDelivery: (deliveryHistoryId: string) => Promise<void>
}

export default function DeliveryHistoryPanel({
  deliveryHistory,
  onUndoDelivery
}: DeliveryHistoryPanelProps) {
  if (!deliveryHistory || deliveryHistory.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Historial de Entregas</h3>
        <p className="text-slate-500 text-sm">No hay entregas registradas para este pedido</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Package className="w-5 h-5" />
        Historial de Entregas
      </h3>

      <div className="space-y-4">
        {deliveryHistory.map((delivery) => {
          const deliveredAt = new Date(delivery.delivered_at)
          const now = new Date()
          const hoursDiff = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60)
          const canUndo = delivery.is_active && hoursDiff <= 24

          return (
            <div
              key={delivery.id}
              className={`border rounded-lg p-4 ${
                delivery.is_active ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Tipo y estado */}
                  <div className="flex items-center gap-2 mb-2">
                    {delivery.is_active ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Undo2 className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-semibold">
                      {delivery.delivery_type === 'partial' ? 'Retirada Parcial' : 'Entrega Completa'}
                    </span>
                    {!delivery.is_active && (
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">
                        Deshecha
                      </span>
                    )}
                  </div>

                  {/* Fecha */}
                  <div className="text-sm text-slate-600 mb-2">
                    {formatDate(delivery.delivered_at)}
                  </div>

                  {/* Items entregados */}
                  {delivery.items_delivered && delivery.items_delivered.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-slate-700 mb-1">
                        Items retirados:
                      </div>
                      <ul className="text-sm text-slate-600 space-y-1">
                        {delivery.items_delivered.map((item: any, idx: number) => {
                          // Usar el código/nombre guardado directamente en items_delivered
                          const productDisplay = item.product_name || item.product_code || 'Producto desconocido'
                          return (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              <span>{item.quantity} ud de {productDisplay}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Stock consumido */}
                  <div className="text-xs text-slate-500 mt-2">
                    Stock consumido: {delivery.stock_consumed?.length || 0} registros
                  </div>
                </div>

                {/* Botón deshacer */}
                {canUndo && delivery.delivery_type === 'partial' && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUndoDelivery(delivery.id)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <Undo2 className="w-4 h-4 mr-1" />
                      Deshacer
                    </Button>
                    <div className="text-xs text-slate-500 mt-1 text-center">
                      {(24 - hoursDiff).toFixed(0)}h restantes
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
