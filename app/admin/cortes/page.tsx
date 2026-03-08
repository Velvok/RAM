import { getCutOrders } from '@/app/actions/cut-orders'
import Link from 'next/link'

// Deshabilitar caché para esta página
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function CortesPage() {
  const timestamp = new Date().toISOString()
  console.log('CortesPage rendered at:', timestamp)
  
  const cutOrders = await getCutOrders()
  
  console.log('Cut Orders:', cutOrders)
  console.log('Cut Orders length:', cutOrders?.length)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Órdenes de Corte</h2>
          <p className="text-slate-600">Gestión de órdenes de corte y producción</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">Generadas</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {cutOrders?.filter((o: any) => o.status === 'generada').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">Lanzadas</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {cutOrders?.filter((o: any) => o.status === 'lanzada').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">En Proceso</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">
            {cutOrders?.filter((o: any) => o.status === 'en_proceso').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-slate-600">Finalizadas</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {cutOrders?.filter((o: any) => o.status === 'finalizada').length || 0}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Número
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Pedido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Producto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Cantidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Asignado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {!cutOrders || cutOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  No hay órdenes de corte disponibles
                </td>
              </tr>
            ) : (
              cutOrders.map((cutOrder: any) => (
                <tr key={cutOrder.id} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    <Link 
                      href={`/admin/cortes/${cutOrder.id}`}
                      className="text-blue-600 hover:text-blue-900 hover:underline"
                    >
                      {cutOrder.cut_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {cutOrder.order?.order_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {cutOrder.product?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {cutOrder.quantity_requested} kg
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {cutOrder.assigned_operator?.full_name || 'Sin asignar'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      cutOrder.status === 'generada' ? 'bg-slate-100 text-slate-800' :
                      cutOrder.status === 'lanzada' ? 'bg-blue-100 text-blue-800' :
                      cutOrder.status === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                      cutOrder.status === 'finalizada' ? 'bg-green-100 text-green-800' :
                      cutOrder.status === 'pausada' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {cutOrder.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(cutOrder.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/cortes/${cutOrder.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
