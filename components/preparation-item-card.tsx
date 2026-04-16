'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Package, CheckCircle2, Circle } from 'lucide-react'
import { prepareItem } from '@/app/actions/preparation'
import { toast } from 'sonner'

interface PreparationItemCardProps {
  item: {
    id: string
    product_id: string
    quantity_requested: number
    quantity_prepared: number
    status: string
    product: {
      name: string
      code: string
    }
    assigned_inventory?: {
      stock_disponible: number
    }
  }
  onUpdate?: () => void
}

export function PreparationItemCard({ item, onUpdate }: PreparationItemCardProps) {
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const remaining = item.quantity_requested - item.quantity_prepared
  const progress = (item.quantity_prepared / item.quantity_requested) * 100
  const isCompleted = item.status === 'completada'

  const handlePrepare = async () => {
    if (quantity <= 0 || quantity > remaining) {
      toast.error('Cantidad inválida')
      return
    }

    setIsLoading(true)
    try {
      await prepareItem(item.id, quantity)
      toast.success(`${quantity} unidades preparadas correctamente`)
      setQuantity(1)
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Error al preparar artículo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={`${isCompleted ? 'border-green-500 bg-green-50' : 'border-blue-500'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Package className={`h-5 w-5 ${isCompleted ? 'text-green-600' : 'text-blue-600'}`} />
            <div>
              <CardTitle className="text-lg">{item.product.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{item.product.code}</p>
            </div>
          </div>
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <Circle className="h-6 w-6 text-blue-600" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progreso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progreso</span>
            <span className="text-muted-foreground">
              {item.quantity_prepared} / {item.quantity_requested} unidades
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stock disponible */}
        {item.assigned_inventory && (
          <div className="text-sm text-muted-foreground">
            Stock disponible: {item.assigned_inventory.stock_disponible} unidades
          </div>
        )}

        {/* Selector de cantidad y botón */}
        {!isCompleted && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                Cantidad a preparar:
              </label>
              <Input
                type="number"
                min={1}
                max={remaining}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-20"
                disabled={isLoading}
              />
              <span className="text-sm text-muted-foreground">
                de {remaining} restantes
              </span>
            </div>

            <Button
              onClick={handlePrepare}
              disabled={isLoading || quantity <= 0 || quantity > remaining}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Preparando...' : 'Marcar como Preparado'}
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="text-center py-2 text-green-600 font-medium">
            ✓ Artículo completamente preparado
          </div>
        )}
      </CardContent>
    </Card>
  )
}
