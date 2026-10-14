'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Package, CheckCircle2 } from 'lucide-react'

interface PartialDeliveryModalProps {
  open: boolean
  onClose: () => void
  order: any
  deliveryHistory: any[]
  onConfirm: (itemsToDeliver: Array<{
    cutOrderId?: string
    preparationItemId?: string
    quantity: number
  }>) => Promise<void>
}

export default function PartialDeliveryModal({
  open,
  onClose,
  order,
  deliveryHistory,
  onConfirm
}: PartialDeliveryModalProps) {
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [processing, setProcessing] = useState(false)

  // Calcular cantidades ya retiradas (solo entregas activas)
  const alreadyDelivered: Record<string, number> = {}
  if (deliveryHistory) {
    for (const delivery of deliveryHistory) {
      // Solo contar entregas activas (no deshechas)
      if (delivery.is_active && delivery.items_delivered) {
        for (const item of delivery.items_delivered) {
          const key = item.cut_order_id || item.preparation_item_id
          alreadyDelivered[key] = (alreadyDelivered[key] || 0) + item.quantity
        }
      }
    }
  }

  // Filtrar items completados con stock disponible para retirar
  const availableCutOrders = (order.cut_orders || []).filter((co: any) => {
    const quantityCut = co.quantity_cut || 0
    const delivered = alreadyDelivered[co.id] || 0
    return quantityCut > delivered
  })

  const availablePrepItems = (order.preparation_items || []).filter((pi: any) => {
    const quantityPrepared = pi.quantity_prepared || 0
    const delivered = alreadyDelivered[pi.id] || 0
    return quantityPrepared > delivered
  })

  const hasAvailableItems = availableCutOrders.length > 0 || availablePrepItems.length > 0

  // Resetear cantidades cuando se abre el modal
  useEffect(() => {
    if (open) {
      const initialQuantities: Record<string, number> = {}
      
      // Inicializar en 0 para cada item
      availableCutOrders.forEach((co: any) => {
        initialQuantities[co.id] = 0
      })
      
      availablePrepItems.forEach((pi: any) => {
        initialQuantities[pi.id] = 0
      })
      
      setSelectedQuantities(initialQuantities)
    }
  }, [open])

  async function handleConfirm() {
    // Construir array de items a entregar
    const itemsToDeliver = []
    
    for (const [id, quantity] of Object.entries(selectedQuantities)) {
      if (quantity > 0) {
        const cutOrder = availableCutOrders.find((co: any) => co.id === id)
        const prepItem = availablePrepItems.find((pi: any) => pi.id === id)
        
        if (cutOrder) {
          itemsToDeliver.push({
            cutOrderId: id,
            quantity
          })
        } else if (prepItem) {
          itemsToDeliver.push({
            preparationItemId: id,
            quantity
          })
        }
      }
    }

    if (itemsToDeliver.length === 0) {
      toast.error('Debes seleccionar al menos un item para retirar')
      return
    }

    setProcessing(true)
    try {
      await onConfirm(itemsToDeliver)
      onClose()
    } catch (error) {
      console.error('Error en retirada parcial:', error)
    } finally {
      setProcessing(false)
    }
  }

  function updateQuantity(id: string, value: number, max: number) {
    const newValue = Math.min(Math.max(0, value), max)
    setSelectedQuantities(prev => ({ ...prev, [id]: newValue }))
  }

  // Calcular totales para el resumen
  const totalItemsToDeliver = Object.values(selectedQuantities).reduce((sum, qty) => sum + (qty > 0 ? 1 : 0), 0)
  const totalUnitsToDeliver = Object.values(selectedQuantities).reduce((sum, qty) => sum + qty, 0)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
            <Package size={18} strokeWidth={1.75} />
            Retirada Parcial de Pedido
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6">

        {!hasAvailableItems ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No hay items disponibles para retirar</p>
            <p className="text-sm mt-2">Todos los items ya han sido completamente retirados</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cut Orders */}
            {availableCutOrders.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">Órdenes de Corte</h3>
                <div className="space-y-3">
                  {availableCutOrders.map((cutOrder: any) => {
                    const product = Array.isArray(cutOrder.product) ? cutOrder.product[0] : cutOrder.product
                    const quantityCut = cutOrder.quantity_cut || 0
                    const delivered = alreadyDelivered[cutOrder.id] || 0
                    const available = quantityCut - delivered
                    
                    return (
                      <div key={cutOrder.id} className="border rounded-lg p-4 bg-muted">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">{product?.name || product?.code}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Completadas: {quantityCut} | Ya retiradas: {delivered} | Disponibles: {available}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium whitespace-nowrap">Cantidad a retirar:</label>
                            <Input
                              type="number"
                              min={0}
                              max={available}
                              value={selectedQuantities[cutOrder.id] || 0}
                              onChange={(e) => updateQuantity(cutOrder.id, parseInt(e.target.value) || 0, available)}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">/ {available}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Preparation Items */}
            {availablePrepItems.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">Artículos de Preparación</h3>
                <div className="space-y-3">
                  {availablePrepItems.map((prepItem: any) => {
                    const product = Array.isArray(prepItem.product) ? prepItem.product[0] : prepItem.product
                    const quantityPrepared = prepItem.quantity_prepared || 0
                    const delivered = alreadyDelivered[prepItem.id] || 0
                    const available = quantityPrepared - delivered
                    
                    return (
                      <div key={prepItem.id} className="border rounded-lg p-4 bg-muted">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">{product?.name || product?.code}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Preparadas: {quantityPrepared} | Ya retiradas: {delivered} | Disponibles: {available}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium whitespace-nowrap">Cantidad a retirar:</label>
                            <Input
                              type="number"
                              min={0}
                              max={available}
                              value={selectedQuantities[prepItem.id] || 0}
                              onChange={(e) => updateQuantity(prepItem.id, parseInt(e.target.value) || 0, available)}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">/ {available}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Resumen */}
            <div className="border-t pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Resumen de Retirada
                </h4>
                <div className="text-sm space-y-1">
                  <p>Items a retirar: <strong>{totalItemsToDeliver}</strong></p>
                  <p>Unidades totales: <strong>{totalUnitsToDeliver}</strong></p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={processing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={processing || totalUnitsToDeliver === 0}
              >
                {processing ? 'Procesando...' : 'Confirmar Retirada Parcial'}
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
