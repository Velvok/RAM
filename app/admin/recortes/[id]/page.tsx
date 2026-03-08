import { getRemnantById, markAsScrap } from '@/app/actions/remnants'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { MarkAsScrapButton } from './mark-as-scrap-button'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RemnantDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const remnant = await getRemnantById(id)

  if (!remnant) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Recorte no encontrado
          </h2>
          <Link href="/admin/recortes">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a recortes
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
          <Link href="/admin/recortes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Recorte #{remnant.id.slice(0, 8)}
            </h2>
            <p className="text-slate-600">
              Producto: {remnant.product?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              remnant.status === 'disponible'
                ? 'bg-green-100 text-green-800'
                : remnant.status === 'reservado'
                ? 'bg-yellow-100 text-yellow-800'
                : remnant.status === 'consumido'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {remnant.status}
          </span>
          {remnant.status === 'disponible' && (
            <MarkAsScrapButton remnantId={remnant.id} />
          )}
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Cantidad
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {remnant.quantity} kg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">
            Fecha de Creación
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatDate(remnant.created_at)}
          </div>
        </div>
      </div>

      {/* Información del Producto */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Información del Producto
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-slate-600">Código</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {remnant.product?.code}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-600">Nombre</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {remnant.product?.name}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-600">Categoría</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {remnant.product?.category}
            </dd>
          </div>
          {remnant.product?.thickness_mm && (
            <div>
              <dt className="text-sm font-medium text-slate-600">Espesor</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {remnant.product.thickness_mm} mm
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Información del Origen */}
      {remnant.cut_order && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Orden de Corte de Origen
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-slate-600">
                Número de Orden
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                <Link
                  href={`/admin/cortes/${remnant.cut_order.id}`}
                  className="text-blue-600 hover:text-blue-900"
                >
                  {remnant.cut_order.cut_number}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Pedido</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {remnant.cut_order.order ? (
                  <Link
                    href={`/admin/pedidos/${remnant.cut_order.order.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {remnant.cut_order.order.order_number}
                  </Link>
                ) : (
                  'N/A'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Cliente</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {remnant.cut_order.order?.client?.business_name || 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">
                Producto Cortado
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {remnant.cut_order.product?.name || 'N/A'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Notas */}
      {remnant.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Notas</h3>
          <p className="text-sm text-slate-700">{remnant.notes}</p>
        </div>
      )}

      {/* Sugerencias de Uso (futuro) */}
      {remnant.status === 'disponible' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            💡 Sugerencias de Uso
          </h3>
          <p className="text-sm text-blue-700">
            Este recorte puede ser utilizado para pedidos que requieran{' '}
            {remnant.product?.name} en cantidades menores a {remnant.quantity}{' '}
            kg.
          </p>
          <p className="text-sm text-blue-600 mt-2">
            <strong>Próximamente:</strong> Matching automático con pedidos
            pendientes usando IA.
          </p>
        </div>
      )}
    </div>
  )
}
