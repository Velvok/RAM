import { getRemnants, getRemnantStats } from '@/app/actions/remnants'
import { formatDate } from '@/lib/utils'
import { Scissors, Package, Clock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'

// Deshabilitar caché
export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'destructive' }> = {
  disponible: { label: 'Disponible', variant: 'success' },
  reservado: { label: 'Reservado', variant: 'warning' },
  consumido: { label: 'Consumido', variant: 'info' },
  descartado: { label: 'Descartado', variant: 'destructive' },
}

export default async function RecortesPage() {
  const remnants = await getRemnants()
  const stats = await getRemnantStats()

  return (
    <div className="space-y-6">
      <PageHeader title="Recortes" subtitle="Gestión de sobrantes y material reutilizable" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Total" value={stats.total} icon={Scissors} />
        <MetricCard title="Disponibles" value={stats.disponible} icon={CheckCircle2} variant="success" />
        <MetricCard title="Reservados" value={stats.reservado} icon={Clock} variant="warning" />
        <MetricCard title="Consumidos" value={stats.consumido} icon={Package} />
        <MetricCard title="Descartados" value={stats.descartado} icon={XCircle} variant="danger" />
      </div>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground mb-1">Cantidad Total</div>
        <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
          {stats.totalQuantity.toFixed(2)} m
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!remnants || remnants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={Scissors} title="No hay recortes registrados" />
                </TableCell>
              </TableRow>
            ) : (
              remnants.map((remnant: any) => {
                const statusBadge = STATUS_BADGE[remnant.status] ?? { label: remnant.status, variant: 'info' as const }
                return (
                  <TableRow key={remnant.id}>
                    <TableCell className="font-medium text-foreground">{remnant.product?.name || 'N/A'}</TableCell>
                    <TableCell className="font-mono tabular-nums text-foreground">{remnant.quantity} m</TableCell>
                    <TableCell className="text-muted-foreground">{remnant.cut_order?.cut_number || 'N/A'}</TableCell>
                    <TableCell><Badge variant={statusBadge.variant}>{statusBadge.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(remnant.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/recortes/${remnant.id}`} className="text-primary hover:text-primary/80 font-medium">
                        Ver detalle
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
