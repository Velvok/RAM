import { getRemnantById, markAsScrap } from '@/app/actions/remnants'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { MarkAsScrapButton } from './mark-as-scrap-button'

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'destructive' }> = {
  disponible: { label: 'Disponible', variant: 'success' },
  reservado: { label: 'Reservado', variant: 'warning' },
  consumido: { label: 'Consumido', variant: 'info' },
  descartado: { label: 'Descartado', variant: 'destructive' },
}

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
          <h2 className="text-2xl font-bold text-foreground mb-2">
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
            <h2 className="text-2xl font-bold text-foreground">
              Recorte #{remnant.id.slice(0, 8)}
            </h2>
            <p className="text-muted-foreground">
              Producto: {remnant.product?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={(STATUS_BADGE[remnant.status] ?? { variant: 'info' as const }).variant} className="px-3 py-1 text-sm">
            {STATUS_BADGE[remnant.status]?.label ?? remnant.status}
          </Badge>
          {remnant.status === 'disponible' && (
            <MarkAsScrapButton remnantId={remnant.id} />
          )}
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Cantidad
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
            {remnant.quantity} m
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Fecha de Creación
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatDate(remnant.created_at)}
          </div>
        </Card>
      </div>

      {/* Información del Producto */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Información del Producto
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Código</dt>
            <dd className="mt-1 text-sm text-foreground">
              {remnant.product?.code}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Nombre</dt>
            <dd className="mt-1 text-sm text-foreground">
              {remnant.product?.name}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Categoría</dt>
            <dd className="mt-1 text-sm text-foreground">
              {remnant.product?.category}
            </dd>
          </div>
          {remnant.product?.thickness_mm && (
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Espesor</dt>
              <dd className="mt-1 text-sm text-foreground">
                {remnant.product.thickness_mm} mm
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Información del Origen */}
      {remnant.cut_order && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Orden de Corte de Origen
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Número de Orden
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                <Link
                  href={`/planta/ordenes/${remnant.cut_order.id}`}
                  className="text-blue-600 hover:text-blue-900"
                >
                  {remnant.cut_order.cut_number}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Pedido</dt>
              <dd className="mt-1 text-sm text-foreground">
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
              <dt className="text-sm font-medium text-muted-foreground">Cliente</dt>
              <dd className="mt-1 text-sm text-foreground">
                {remnant.cut_order.order?.client?.business_name || 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Producto Cortado
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {remnant.cut_order.product?.name || 'N/A'}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Notas */}
      {remnant.notes && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Notas</h3>
          <p className="text-sm text-foreground">{remnant.notes}</p>
        </Card>
      )}

      {/* Sugerencias de Uso */}
      {remnant.status === 'disponible' && (
        <Card className="p-6 border-info/30 bg-info/5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-info mb-2">
            <Lightbulb size={16} />
            Sugerencia de uso
          </h3>
          <p className="text-sm text-info/90">
            Este recorte puede ser utilizado para pedidos que requieran{' '}
            {remnant.product?.name} en cantidades menores a {remnant.quantity}{' '}
            m.
          </p>
        </Card>
      )}
    </div>
  )
}
