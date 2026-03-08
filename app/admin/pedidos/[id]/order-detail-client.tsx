'use client'

import { useState, useEffect } from 'react'
import { getOrderById } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import OrderActions from './order-actions'

export default function OrderDetailClient({ initialOrder }: { initialOrder: any }) {
  const [order, setOrder] = useState(initialOrder)
  const [refreshKey, setRefreshKey] = useState(0)

  // Función para recargar el pedido completo
  async function reloadOrder() {
    try {
      const updated = await getOrderById(order.id)
      setOrder(updated)
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error reloading order:', error)
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
    </div>
  )
}
