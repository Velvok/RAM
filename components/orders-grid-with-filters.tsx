'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { generateCutOrders } from '@/app/actions/orders'
import { Package, Calendar, User, DollarSign, CheckCircle, Clock, AlertCircle, Loader2, Filter, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react'

interface OrdersGridWithFiltersProps {
  orders: any[]
}

export default function OrdersGridWithFilters({ orders }: OrdersGridWithFiltersProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'rows'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pedidos-view-mode') as 'cards' | 'rows') || 'cards'
    }
    return 'cards'
  })
  const [currentPage, setCurrentPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const router = useRouter()

  // Guardar preferencia de vista en localStorage
  const handleViewModeChange = (mode: 'cards' | 'rows') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('pedidos-view-mode', mode)
    }
  }


  // Función para obtener info de estado
  function getStatusInfo(status: string) {
    const statusMap: any = {
      nuevo: {
        color: 'bg-slate-500',
        textColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        text: 'Nuevo Pedido',
        icon: AlertCircle
      },
      aprobado: {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        text: 'Aprobado',
        icon: Package
      },
      en_corte: {
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        text: 'En Corte',
        icon: Clock
      },
      finalizado: {
        color: 'bg-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        text: 'Finalizado',
        icon: CheckCircle
      },
      entregado: {
        color: 'bg-slate-800',
        textColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        text: 'Entregado',
        icon: CheckCircle
      },
      cancelado: {
        color: 'bg-red-500',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        text: 'Cancelado',
        icon: AlertCircle
      }
    }
    return statusMap[status] || statusMap.nuevo
  }

  // Filtrar pedidos por estado y búsqueda
  const filteredOrders = useMemo(() => {
    let filtered = orders
    
    // Filtro por estado
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }
    
    // Filtro por búsqueda (nombre de cliente o número de pedido)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(o => 
        o.order_number?.toLowerCase().includes(searchLower) ||
        o.client?.business_name?.toLowerCase().includes(searchLower) ||
        o.client?.name?.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  }, [orders, statusFilter, searchQuery])

  // Aplicar paginación para vista de filas
  const paginatedOrders = useMemo(() => {
    if (viewMode === 'cards') return filteredOrders
    const startIndex = currentPage * rowsPerPage
    return filteredOrders.slice(startIndex, startIndex + rowsPerPage)
  }, [filteredOrders, currentPage, rowsPerPage, viewMode])

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage)

  // Resetear página al cambiar filtro
  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter)
    setCurrentPage(0)
  }

  // Resetear página al buscar
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(0)
  }

  // Contar por estado
  const statusCounts = {
    todos: orders.length,
    nuevo: orders.filter(o => o.status === 'nuevo').length,
    aprobado: orders.filter(o => o.status === 'aprobado').length,
    en_corte: orders.filter(o => o.status === 'en_corte').length,
    finalizado: orders.filter(o => o.status === 'finalizado').length,
    entregado: orders.filter(o => o.status === 'entregado').length
  }

  const filters = [
    { id: 'todos', label: 'Todos', count: statusCounts.todos, color: 'bg-slate-600' },
    { id: 'nuevo', label: 'Nuevos', count: statusCounts.nuevo, color: 'bg-slate-500' },
    { id: 'aprobado', label: 'Aprobados', count: statusCounts.aprobado, color: 'bg-yellow-500' },
    { id: 'en_corte', label: 'En Corte', count: statusCounts.en_corte, color: 'bg-blue-500' },
    { id: 'finalizado', label: 'Finalizados', count: statusCounts.finalizado, color: 'bg-green-500' },
    { id: 'entregado', label: 'Entregados', count: statusCounts.entregado, color: 'bg-slate-800' }
  ]

  async function handleGenerateCutOrders(e: React.MouseEvent, orderId: string) {
    e.stopPropagation()
    setLoading(orderId)
    try {
      await generateCutOrders(orderId)
      router.refresh()
    } catch (error) {
      console.error('Error generating cut orders:', error)
      alert('Error al generar órdenes de corte')
    } finally {
      setLoading(null)
    }
  }

  function handleOrderClick(order: any) {
    // Ir directamente al detalle del pedido
    router.push(`/admin/pedidos/${order.id}`)
  }

  return (
    <>
      {/* Filtros con estética integrada */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
        {/* Primera fila: Título y estados */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-600">Estado del pedido</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === filter.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {filter.label}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  statusFilter === filter.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Segunda fila: Buscador y toggle */}
        <div className="flex items-center justify-between gap-4">
          {/* Buscador semántico */}
          <div className="relative flex-1 max-w-md">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente o número de pedido..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Toggle Vista */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('cards')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('rows')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'rows'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista de filas"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Vista de Tarjetas */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">No hay pedidos con este filtro</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusInfo = getStatusInfo(order.status)
            const StatusIcon = statusInfo.icon

            return (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className="bg-white rounded-lg border border-slate-200 p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-lg mb-1">
                      {order.order_number}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1.5 ${statusInfo.color} text-white rounded-lg text-xs font-bold`}>
                    {statusInfo.text}
                  </span>
                </div>

                {/* Información */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 font-medium line-clamp-1">
                      {order.client?.business_name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-900">
                        {order.total_amount?.toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                          minimumFractionDigits: 0
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Package className="w-3.5 h-3.5" />
                      {order.lines?.reduce((sum: number, line: any) => sum + (line.units || 0), 0) || 0} unidades
                    </div>
                  </div>

                  {/* Contador de órdenes de corte */}
                  {order.cut_orders && order.cut_orders.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <Package className="w-3.5 h-3.5" />
                      <span>{order.cut_orders.length} órdenes de corte</span>
                    </div>
                  )}
                </div>

                {/* Acción */}
                {order.status === 'nuevo' && (
                  <button
                    onClick={(e) => handleGenerateCutOrders(e, order.id)}
                    disabled={loading === order.id}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading === order.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Aprobando...
                      </>
                    ) : (
                      '✓ Aprobar Pedido'
                    )}
                  </button>
                )}
                {order.status === 'finalizado' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/admin/pedidos/${order.id}`)
                    }}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    Marcar como Entregado
                  </button>
                )}
              </div>
            )
          })
        )}
        </div>
      )}

      {/* Vista de Filas */}
      {viewMode === 'rows' && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Unidades
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
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                      No se encontraron pedidos que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const statusInfo = getStatusInfo(order.status)
                    const StatusIcon = statusInfo.icon
                    
                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => handleOrderClick(order)}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {order.order_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {order.client?.business_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(order.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                          {order.total_amount?.toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                            minimumFractionDigits: 0
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {order.lines?.reduce((sum: number, line: any) => sum + (line.units || 0), 0) || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 ${statusInfo.color} text-white rounded-lg text-xs font-medium`}>
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {order.status === 'nuevo' && (
                            <button
                              onClick={(e) => handleGenerateCutOrders(e, order.id)}
                              disabled={loading === order.id}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {loading === order.id ? 'Aprobando...' : 'Aprobar'}
                            </button>
                          )}
                          {order.status === 'finalizado' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/admin/pedidos/${order.id}`)
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                              Marcar como Entregado
                            </button>
                          )}
                        </td>
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
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value))
                    setCurrentPage(0)
                  }}
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
                Mostrando {currentPage * rowsPerPage + 1} - {Math.min((currentPage + 1) * rowsPerPage, filteredOrders.length)} de {filteredOrders.length} pedidos
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
      )}
    </>
  )
}
