import { getInventory } from '@/app/actions/inventory'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

// Deshabilitar caché para esta página
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StockPage() {
  const inventory = await getInventory()

  return (
    <div className="space-y-6">
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Producto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Stock Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Reservado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                En Proceso
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Disponible
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {inventory?.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                  {item.product?.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {item.product?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {item.stock_total?.toFixed(2)} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                  {item.stock_reservado?.toFixed(2)} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                  {item.stock_en_proceso?.toFixed(2)} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                  {item.stock_disponible?.toFixed(2)} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.stock_disponible <= 0 ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Sin stock
                    </span>
                  ) : item.stock_disponible < 100 ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Stock bajo
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Disponible
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
