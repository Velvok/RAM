import { getCutOrderById } from '@/app/actions/cut-orders'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import CutOrderActions from './cut-order-actions'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CutOrderDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cutOrder = await getCutOrderById(id)

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

      {/* Grid con Pedido y Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del Pedido */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
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

          {/* Notas */}
          {cutOrder.notes && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Notas</h4>
              <p className="text-sm text-slate-700">{cutOrder.notes}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <CutOrderActions cutOrder={cutOrder} />
      </div>
    </div>
  )
}
