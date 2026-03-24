'use client'

import { useState, useMemo } from 'react'
import { StockFilters } from './stock-filters'
import { QuickAdjustModal } from './quick-adjust-modal'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface StockTableClientProps {
  inventory: any[]
}

export function StockTableClient({ inventory }: StockTableClientProps) {
  const [filters, setFilters] = useState({ search: '', category: 'todas' })
  const [currentPage, setCurrentPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  // Filtrar inventario basado en los filtros activos
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Filtro por búsqueda (código, nombre o cliente)
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = !filters.search || 
        item.product?.code?.toLowerCase().includes(searchLower) ||
        item.product?.name?.toLowerCase().includes(searchLower) ||
        // Buscar en clientes de pedidos relacionados
        item.related_orders?.some((orderLine: any) => 
          orderLine.order?.client?.name?.toLowerCase().includes(searchLower) ||
          orderLine.order?.client?.business_name?.toLowerCase().includes(searchLower)
        )

      // Filtro por categoría
      const matchesCategory = filters.category === 'todas' || 
        item.product?.category === filters.category

      return matchesSearch && matchesCategory
    })
  }, [inventory, filters])

  // Aplicar paginación
  const paginatedInventory = useMemo(() => {
    const startIndex = currentPage * rowsPerPage
    return filteredInventory.slice(startIndex, startIndex + rowsPerPage)
  }, [filteredInventory, currentPage, rowsPerPage])

  // Calcular total de páginas
  const totalPages = Math.ceil(filteredInventory.length / rowsPerPage)

  // Resetear a página 0 cuando cambian los filtros
  const handleFilterChange = (newFilters: { search: string; category: string }) => {
    setFilters(newFilters)
    setCurrentPage(0)
  }

  // Cambiar filas por página
  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value)
    setCurrentPage(0)
  }

  return (
    <>
      <StockFilters onFilterChange={handleFilterChange} />

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
                Generado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Disponible
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginatedInventory.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                  No se encontraron productos que coincidan con los filtros
                </td>
              </tr>
            ) : (
              paginatedInventory.map((item: any) => {
                const hasRelatedOrders = item.related_orders && item.related_orders.length > 0
                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50 relative ${hasRelatedOrders ? 'cursor-help' : ''}`}
                    onMouseEnter={() => hasRelatedOrders && setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {item.product?.code}
                      {hasRelatedOrders && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.related_orders.length}
                        </span>
                      )}
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {item.product?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {item.stock_total?.toFixed(0)} unidades
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                    {item.stock_reservado?.toFixed(0)} unidades
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {item.stock_generado?.toFixed(0) || 0} unidades
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                    {item.stock_disponible?.toFixed(0)} unidades
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <QuickAdjustModal inventoryItem={item} />
                  </td>

                  {/* Tooltip con información de pedidos */}
                  {hoveredRow === item.id && hasRelatedOrders && (
                    <td className="absolute left-0 top-full mt-1 z-50 w-full pointer-events-none">
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 ml-6 mr-6">
                        <p className="text-sm font-semibold text-slate-900 mb-2">
                          Mercadería comprometida en {item.related_orders.length} pedido{item.related_orders.length > 1 ? 's' : ''}:
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {item.related_orders.map((orderLine: any, idx: number) => (
                            <div key={idx} className="text-xs border-l-2 border-blue-400 pl-3 py-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-slate-900">
                                  Pedido #{orderLine.order?.order_number}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  orderLine.order?.status === 'aprobado' ? 'bg-green-100 text-green-800' :
                                  orderLine.order?.status === 'en_corte' ? 'bg-blue-100 text-blue-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {orderLine.order?.status?.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-slate-600">
                                <p>Cliente: <span className="font-medium">{orderLine.order?.client?.business_name || orderLine.order?.client?.name}</span></p>
                                <p>Cantidad: <span className="font-medium">{orderLine.quantity} unidades</span></p>
                                <p>Fecha: <span className="font-medium">{new Date(orderLine.order?.created_at).toLocaleDateString('es-AR')}</span></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de paginación */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Selector de filas por página */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Mostrar:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
              className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-slate-600">filas</span>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-slate-600">
            Mostrando {currentPage * rowsPerPage + 1} - {Math.min((currentPage + 1) * rowsPerPage, filteredInventory.length)} de {filteredInventory.length} productos
          </div>
        </div>

        {/* Navegación de páginas */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i).map(page => {
                // Mostrar solo algunas páginas alrededor de la actual
                if (
                  page === 0 ||
                  page === totalPages - 1 ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded text-sm ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {page + 1}
                    </button>
                  )
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="text-slate-400">...</span>
                }
                return null
              })}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
