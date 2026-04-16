'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Package, CheckCircle2 } from 'lucide-react'
import { prepareItem } from '@/app/actions/preparation'

interface PreparationItemCardProps {
  item: any
  onUpdate?: () => void
}

export function PreparationItemCard({ item, onUpdate }: PreparationItemCardProps) {
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  const isCompleted = item.status === 'completada'
  const progress = (item.quantity_prepared / item.quantity_requested) * 100
  const remaining = item.quantity_requested - item.quantity_prepared

  async function handlePrepare() {
    if (quantity > remaining) return
    
    setIsLoading(true)
    try {
      await prepareItem(item.id, quantity)
      setQuantity(1)
      onUpdate?.()
    } catch (error: any) {
      console.error('Error al preparar artículo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isCompleted ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Package className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{item.product?.name}</h4>
            <p className="text-sm text-slate-500 font-mono">{item.product?.code}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-slate-900">
            {item.quantity_prepared}/{item.quantity_requested}
          </div>
          <div className="text-xs text-slate-500">
            {remaining > 0 ? `${remaining} pendientes` : 'Completado'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>Progreso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              isCompleted ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stock Info */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Stock asignado:</span>
            <span className="text-green-600">
              {item.assigned_inventory ? 'Sí' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Estado:</span>
            <span className={`font-medium ${
              item.status === 'completada' ? 'text-green-600' : 
              item.status === 'en_proceso' ? 'text-blue-600' : 'text-yellow-600'
            }`}>
              {item.status === 'completada' ? 'Completado' : 
               item.status === 'en_proceso' ? 'En proceso' : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isCompleted && remaining > 0 && (
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            max={remaining}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(remaining, parseInt(e.target.value) || 1)))}
            className="w-20"
            disabled={isLoading}
          />
          <Button 
            onClick={handlePrepare}
            disabled={isLoading || quantity > remaining}
            className="flex-1"
          >
            {isLoading ? 'Preparando...' : `Preparar ${quantity}`}
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>Artículo completado</span>
        </div>
      )}
    </div>
  )
}
