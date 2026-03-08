'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustStock } from '@/app/actions/inventory'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AjustesStockPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    type: 'entrada' as 'entrada' | 'salida' | 'correccion',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const quantity =
        formData.type === 'salida'
          ? -Math.abs(parseFloat(formData.quantity))
          : parseFloat(formData.quantity)

      await adjustStock(formData.productId, quantity, formData.notes)

      toast({
        title: 'Ajuste realizado',
        description: 'El stock ha sido actualizado correctamente',
      })

      router.push('/admin/stock')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo realizar el ajuste de stock',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin/stock">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Ajuste de Stock
          </h2>
          <p className="text-slate-600">
            Registrar entrada, salida o corrección de inventario
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="productId">Producto (ID)</Label>
            <Input
              id="productId"
              required
              value={formData.productId}
              onChange={(e) =>
                setFormData({ ...formData, productId: e.target.value })
              }
              placeholder="ID del producto"
            />
            <p className="text-xs text-slate-500">
              Ingresa el ID del producto de la tabla de stock
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Ajuste</Label>
            <select
              id="type"
              required
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'entrada' | 'salida' | 'correccion',
                })
              }
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="correccion">Corrección</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad (kg)</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              required
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Motivo del ajuste..."
              rows={3}
              className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            />
          </div>

          <div className="flex space-x-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Ajuste'}
            </Button>
            <Link href="/admin/stock">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
