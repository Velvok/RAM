'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { adjustStock } from '@/app/actions/inventory'
import { getAllProducts } from '@/app/actions/client-queries'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ProductOption {
  id: string
  code: string
  name: string
}

export default function AjustesStockPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    type: 'entrada' as 'entrada' | 'salida' | 'correccion',
    notes: '',
  })

  useEffect(() => {
    getAllProducts()
      .then((data) => setProducts(data as ProductOption[]))
      .catch((error) => console.error('Error cargando productos:', error))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const quantity =
        formData.type === 'salida'
          ? -Math.abs(parseFloat(formData.quantity))
          : parseFloat(formData.quantity)

      await adjustStock(formData.productId, quantity, formData.notes)

      toast.success('El stock ha sido actualizado correctamente', { description: 'Ajuste realizado' })

      router.push('/admin/stock')
    } catch (error) {
      toast.error('No se pudo realizar el ajuste de stock')
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
          <h2 className="text-2xl font-bold text-foreground">
            Ajuste de Stock
          </h2>
          <p className="text-muted-foreground">
            Registrar entrada, salida o corrección de inventario
          </p>
        </div>
      </div>

      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="productId">Producto</Label>
            <Select
              id="productId"
              required
              value={formData.productId}
              onChange={(e) =>
                setFormData({ ...formData, productId: e.target.value })
              }
            >
              <option value="" disabled>
                {products.length === 0 ? 'Cargando productos...' : 'Selecciona un producto'}
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} — {product.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Ajuste</Label>
            <Select
              id="type"
              required
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'entrada' | 'salida' | 'correccion',
                })
              }
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="correccion">Corrección</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad (unidades)</Label>
            <Input
              id="quantity"
              type="number"
              step="1"
              required
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Motivo del ajuste..."
              rows={3}
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
      </Card>
    </div>
  )
}
