'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustStock } from '@/app/actions/inventory'
import { useRouter } from 'next/navigation'
import { Edit2, X } from 'lucide-react'

interface QuickAdjustModalProps {
  inventoryItem: {
    id: string
    product_id: string
    product: {
      code: string
      name: string
    }
    stock_total: number
  }
}

export function QuickAdjustModal({ inventoryItem }: QuickAdjustModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [newTotal, setNewTotal] = useState(inventoryItem.stock_total.toString())
  const [loading, setLoading] = useState(false)

  async function handleAdjust() {
    setLoading(true)
    try {
      const newTotalValue = parseFloat(newTotal)
      
      await adjustStock(
        inventoryItem.product_id,
        newTotalValue,
        `Ajuste manual de ${inventoryItem.stock_total} a ${newTotalValue} unidades`
      )

      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error al ajustar stock:', error)
      alert('Error al ajustar stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8"
      >
        <Edit2 className="h-3 w-3 mr-1" />
        Ajustar
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Ajustar Stock
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {inventoryItem.product.code} - {inventoryItem.product.name}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="current">Stock Actual</Label>
                <Input
                  id="current"
                  type="text"
                  value={`${inventoryItem.stock_total} unidades`}
                  disabled
                  className="bg-slate-50"
                />
              </div>

              <div>
                <Label htmlFor="new">Nuevo Stock Total</Label>
                <Input
                  id="new"
                  type="number"
                  step="1"
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                  placeholder="Ej: 50"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">
                  Diferencia: {(parseFloat(newTotal) - inventoryItem.stock_total).toFixed(0)} unidades
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAdjust}
                  className="flex-1"
                  disabled={loading || newTotal === inventoryItem.stock_total.toString()}
                >
                  {loading ? 'Ajustando...' : 'Confirmar Ajuste'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
