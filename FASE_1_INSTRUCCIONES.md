# 🚀 FASE 1 - INSTRUCCIONES COMPLETAS

## ✅ LO QUE YA ESTÁ HECHO

### 1. Dependencias agregadas a package.json ✅
- @radix-ui/* (componentes UI)
- class-variance-authority
- clsx y tailwind-merge
- react-hook-form
- zod
- date-fns

### 2. Componentes UI creados ✅
- `/components/ui/button.tsx`
- `/components/ui/input.tsx`
- `/components/ui/label.tsx`
- `/components/ui/toast.tsx`
- `/components/ui/toaster.tsx`
- `/components/ui/use-toast.ts`

### 3. Utilidades creadas ✅
- `/lib/utils.ts` (cn, formatCurrency, formatDate, formatDateTime)

### 4. Toaster agregado al layout ✅
- Sistema de notificaciones global

### 5. Server Action agregado ✅
- `getOrderById()` en `/app/actions/orders.ts`

---

## 📋 PASO 1: INSTALAR DEPENDENCIAS

**IMPORTANTE:** Debes ejecutar esto primero para que desaparezcan los errores de TypeScript.

```bash
cd /Users/alvaropons/Desktop/ALVARO/VELVOK/RAM
npm install
```

Esto instalará todas las dependencias que agregué al `package.json`.

---

## 📋 PASO 2: CREAR PÁGINAS FALTANTES

### 2.1 Detalle de Pedido

Crear: `/app/admin/pedidos/[id]/page.tsx`

```typescript
import { getOrderById } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PedidoDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const order = await getOrderById(params.id)

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Pedido no encontrado
          </h2>
          <Link href="/admin/pedidos">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a pedidos
            </Button>
          </Link>
        </div>
      </div>
    )
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
                : order.status === 'aprobado'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Peso Total
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {order.total_weight} kg
          </div>
        </div>
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
                    {line.quantity} kg
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

      {/* Órdenes de Corte Generadas */}
      {order.cut_orders && order.cut_orders.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">
              Órdenes de Corte Generadas
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
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Asignado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {order.cut_orders.map((cutOrder: any) => (
                  <tr key={cutOrder.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      <Link
                        href={`/admin/cortes/${cutOrder.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {cutOrder.cut_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {cutOrder.product?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {cutOrder.quantity_requested} kg
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {cutOrder.assigned_operator?.full_name || 'Sin asignar'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          cutOrder.status === 'generada'
                            ? 'bg-slate-100 text-slate-800'
                            : cutOrder.status === 'lanzada'
                            ? 'bg-blue-100 text-blue-800'
                            : cutOrder.status === 'en_proceso'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {cutOrder.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Información del Cliente */}
      <div className="bg-white rounded-lg shadow p-6">
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
    </div>
  )
}
```

---

### 2.2 Detalle de Orden de Corte

Crear: `/app/admin/cortes/[id]/page.tsx`

```typescript
import { getCutOrderById } from '@/app/actions/cut-orders'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CutOrderDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const cutOrder = await getCutOrderById(params.id)

  if (!cutOrder) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Orden de corte no encontrada
          </h2>
          <Link href="/admin/cortes">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a órdenes de corte
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/cortes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {cutOrder.cut_number}
            </h2>
            <p className="text-slate-600">
              Pedido: {cutOrder.order?.order_number}
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            cutOrder.status === 'generada'
              ? 'bg-slate-100 text-slate-800'
              : cutOrder.status === 'lanzada'
              ? 'bg-blue-100 text-blue-800'
              : cutOrder.status === 'en_proceso'
              ? 'bg-yellow-100 text-yellow-800'
              : cutOrder.status === 'finalizada'
              ? 'bg-green-100 text-green-800'
              : 'bg-orange-100 text-orange-800'
          }`}
        >
          {cutOrder.status}
        </span>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Producto
          </div>
          <div className="text-lg font-bold text-slate-900">
            {cutOrder.product?.name}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Cantidad Solicitada
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {cutOrder.quantity_requested} kg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Cantidad Cortada
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {cutOrder.quantity_cut || 0} kg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Asignado a
          </div>
          <div className="text-lg font-bold text-slate-900">
            {cutOrder.assigned_operator?.full_name || 'Sin asignar'}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-slate-400"></div>
            <div>
              <div className="text-sm font-medium text-slate-900">Creada</div>
              <div className="text-sm text-slate-500">
                {formatDate(cutOrder.created_at)}
              </div>
            </div>
          </div>
          {cutOrder.started_at && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-400"></div>
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Iniciada
                </div>
                <div className="text-sm text-slate-500">
                  {formatDate(cutOrder.started_at)}
                </div>
              </div>
            </div>
          )}
          {cutOrder.paused_at && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-orange-400"></div>
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Pausada
                </div>
                <div className="text-sm text-slate-500">
                  {formatDate(cutOrder.paused_at)}
                </div>
              </div>
            </div>
          )}
          {cutOrder.finished_at && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-400"></div>
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Finalizada
                </div>
                <div className="text-sm text-slate-500">
                  {formatDate(cutOrder.finished_at)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Información del Pedido */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Información del Pedido
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-slate-600">
              Número de Pedido
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              <Link
                href={`/admin/pedidos/${cutOrder.order?.id}`}
                className="text-blue-600 hover:text-blue-900"
              >
                {cutOrder.order?.order_number}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-600">Cliente</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {cutOrder.order?.client?.business_name}
            </dd>
          </div>
        </dl>
      </div>

      {/* Notas */}
      {cutOrder.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Notas</h3>
          <p className="text-sm text-slate-700">{cutOrder.notes}</p>
        </div>
      )}
    </div>
  )
}
```

---

### 2.3 Ajustes de Stock

Crear: `/app/admin/stock/ajustes/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustStock, getInventory } from '@/app/actions/inventory'
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
            <Label htmlFor="productId">Producto</Label>
            <Input
              id="productId"
              required
              value={formData.productId}
              onChange={(e) =>
                setFormData({ ...formData, productId: e.target.value })
              }
              placeholder="ID del producto"
            />
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
```

---

## 📋 PASO 3: ACTUALIZAR NAVEGACIÓN

Agregar enlace a ajustes en `/app/admin/stock/page.tsx`:

```typescript
// Al inicio del return, después del header
<div className="flex justify-between items-center">
  <div>
    <h2 className="text-2xl font-bold text-slate-900">Inventario</h2>
    <p className="text-slate-600">Gestión de stock y disponibilidad</p>
  </div>
  <Link href="/admin/stock/ajustes">
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Ajustar Stock
    </Button>
  </Link>
</div>
```

---

## 📋 PASO 4: PROBAR EL SISTEMA

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor:**
   ```bash
   npm run dev
   ```

3. **Probar páginas:**
   - http://localhost:3000/admin/pedidos/[id] (usar ID real de la BD)
   - http://localhost:3000/admin/cortes/[id] (usar ID real de la BD)
   - http://localhost:3000/admin/stock/ajustes

---

## ✅ CHECKLIST FASE 1

- [x] Dependencias agregadas a package.json
- [x] Componentes UI base creados
- [x] Sistema de toasts implementado
- [x] Utilidades de formato creadas
- [ ] **npm install ejecutado** ← HACER ESTO PRIMERO
- [ ] Página de detalle de pedido creada
- [ ] Página de detalle de orden de corte creada
- [ ] Página de ajustes de stock creada
- [ ] Navegación actualizada
- [ ] Todo probado y funcionando

---

## 🎯 PRÓXIMOS PASOS (FASE 2)

Una vez que completes la Fase 1 y pruebes que todo funciona:

1. Módulo de Recortes
2. Módulo de Incidencias
3. Reportes básicos
4. Dashboard mejorado con gráficos
5. Configuración del sistema

---

**¿Listo para empezar? Ejecuta `npm install` y crea las páginas según las instrucciones.** 🚀
