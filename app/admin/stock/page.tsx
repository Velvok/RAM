import { getInventory } from '@/app/actions/inventory'
import { StockTableClient } from '@/components/stock/stock-table-client'

// Deshabilitar caché para esta página
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata() {
  return {
    other: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    }
  }
}

export default async function StockPage() {
  const inventory = await getInventory()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Inventario</h2>
        <p className="text-slate-600">Gestión de stock y disponibilidad</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">Total Productos</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{inventory?.length || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">Stock Bajo</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">
            {inventory?.filter((i: any) => i.stock_disponible < 100).length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">Sin Stock</div>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {inventory?.filter((i: any) => i.stock_disponible <= 0).length || 0}
          </div>
        </div>
      </div>

      <StockTableClient inventory={inventory || []} />
    </div>
  )
}
