import { getInventory } from '@/app/actions/inventory'
import { StockTableClient } from '@/components/stock/stock-table-client'
import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { Package, AlertTriangle, PackageX } from 'lucide-react'

// Deshabilitar caché COMPLETAMENTE
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function generateMetadata() {
  return {
    other: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  }
}

export default async function StockPage() {
  const inventory = await getInventory()

  return (
    <div className="space-y-6">
      <PageHeader title="Inventario" subtitle="Gestión de stock y disponibilidad" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Total Productos" value={inventory?.length || 0} icon={Package} />
        <MetricCard
          title="Stock Bajo"
          value={inventory?.filter((i: any) => i.stock_disponible < 100).length || 0}
          icon={AlertTriangle}
          variant="warning"
        />
        <MetricCard
          title="Sin Stock"
          value={inventory?.filter((i: any) => i.stock_disponible <= 0).length || 0}
          icon={PackageX}
          variant="danger"
        />
      </div>

      <StockTableClient inventory={inventory || []} />
    </div>
  )
}
