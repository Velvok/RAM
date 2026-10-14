'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StockFilters } from './stock-filters'
import { QuickAdjustModal } from './quick-adjust-modal'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Package } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'

interface StockTableClientProps {
  inventory: any[]
}

type SortField = 'code' | 'name' | 'stock_total' | 'stock_reservado' | 'stock_generado' | 'stock_disponible' | null
type SortDirection = 'asc' | 'desc' | null

export function StockTableClient({ inventory }: StockTableClientProps) {
  const router = useRouter()
  const [filters, setFilters] = useState({ search: '', categories: [] as string[], stockStatus: 'todos' })
  const [currentPage, setCurrentPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(100)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Auto-refresh cada 30 segundos para asegurar datos frescos
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      router.refresh()
    }, 30000)

    return () => clearInterval(refreshInterval)
  }, [router])

  // Aplicar filtro desde sessionStorage si viene del dashboard
  useEffect(() => {
    const savedFilter = sessionStorage.getItem('stockFilter')
    if (savedFilter) {
      try {
        const filterData = JSON.parse(savedFilter)
        setFilters(prev => ({ ...prev, ...filterData }))
        // Limpiar el filtro guardado
        sessionStorage.removeItem('stockFilter')
      } catch (error) {
        console.error('Error parsing stock filter:', error)
      }
    }
  }, [])

  // Extraer categorías únicas del inventario
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    inventory.forEach(item => {
      if (item.product?.category) {
        categories.add(item.product.category)
      }
    })
    return Array.from(categories).sort()
  }, [inventory])

  // Función para manejar el ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Si ya está ordenado por este campo, cambiar dirección
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      }
    } else {
      // Nuevo campo, ordenar ascendente
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filtrar inventario basado en los filtros activos
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // Filtro por búsqueda (código, nombre o cliente)
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = !filters.search || 
        item.product?.code?.toLowerCase().includes(searchLower) ||
        item.product?.name?.toLowerCase().includes(searchLower) ||
        // Buscar en clientes de pedidos relacionados
        item.related_orders?.some((orderLine: any) => {
          return (
            orderLine.order?.client?.name?.toLowerCase().includes(searchLower) ||
            orderLine.order?.client?.business_name?.toLowerCase().includes(searchLower)
          )
        })

      // Filtro por categorías (múltiple selección)
      const matchesCategory = filters.categories.length === 0 || 
        filters.categories.includes(item.product?.category)

      // Filtro por estado de stock
      const matchesStockStatus = 
        filters.stockStatus === 'todos' ||
        (filters.stockStatus === 'sin_stock' && item.stock_disponible <= 0) ||
        (filters.stockStatus === 'stock_bajo' && item.stock_disponible > 0 && item.stock_disponible < 100) ||
        (filters.stockStatus === 'disponible' && item.stock_disponible >= 100)

      return matchesSearch && matchesCategory && matchesStockStatus
    })
  }, [inventory, filters])

  // Ordenar inventario si hay un campo de ordenamiento activo
  const sortedInventory = useMemo(() => {
    if (!sortField || !sortDirection) return filteredInventory

    return [...filteredInventory].sort((a, b) => {
      let aValue: any
      let bValue: any

      if (sortField === 'code') {
        aValue = a.product?.code || ''
        bValue = b.product?.code || ''
      } else if (sortField === 'name') {
        aValue = a.product?.name || ''
        bValue = b.product?.name || ''
      } else {
        aValue = a[sortField] || 0
        bValue = b[sortField] || 0
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [filteredInventory, sortField, sortDirection])

  // Aplicar paginación
  const paginatedInventory = useMemo(() => {
    const startIndex = currentPage * rowsPerPage
    return sortedInventory.slice(startIndex, startIndex + rowsPerPage)
  }, [sortedInventory, currentPage, rowsPerPage])

  // Calcular total de páginas
  const totalPages = Math.ceil(sortedInventory.length / rowsPerPage)

  // Resetear a página 0 cuando cambian los filtros
  const handleFilterChange = (newFilters: { search: string; categories: string[]; stockStatus: string }) => {
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
      <StockFilters 
        onFilterChange={handleFilterChange} 
        availableCategories={availableCategories}
        initialFilters={filters}
      />

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSort('code')}
              >
                <div className="flex items-center gap-2">
                  Código
                  {sortField === 'code' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Producto
                  {sortField === 'name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSort('stock_total')}
              >
                <div className="flex items-center gap-2">
                  Stock Total
                  {sortField === 'stock_total' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSort('stock_reservado')}
              >
                <div className="flex items-center gap-2">
                  Reservado
                  {sortField === 'stock_reservado' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSort('stock_generado')}
              >
                <div className="flex items-center gap-2">
                  Generado
                  {sortField === 'stock_generado' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSort('stock_disponible')}
              >
                <div className="flex items-center gap-2">
                  Disponible
                  {sortField === 'stock_disponible' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </div>
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={Package} title="No se encontraron productos" description="Prueba a cambiar los filtros." />
                </TableCell>
              </TableRow>
            ) : (
              paginatedInventory.map((item: any) => {
                const hasRelatedOrders = item.related_orders && item.related_orders.length > 0
                return (
                  <TableRow
                    key={item.id}
                    className={cn('relative', hasRelatedOrders && 'cursor-help')}
                    onMouseEnter={() => hasRelatedOrders && setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {item.product?.code}
                      {hasRelatedOrders && (
                        <Badge variant="info" className="ml-2">{item.related_orders.length}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.product?.name}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-foreground">
                      {item.stock_total?.toFixed(0)} unidades
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-warning">
                      {item.stock_reservado?.toFixed(0)} unidades
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-info">
                      {item.stock_generado?.toFixed(0) || 0} unidades
                    </TableCell>
                    <TableCell className="font-mono tabular-nums font-semibold text-foreground">
                      {item.stock_disponible?.toFixed(0)} unidades
                    </TableCell>
                    <TableCell>
                      {item.stock_disponible <= 0 ? (
                        <Badge variant="destructive">Sin stock</Badge>
                      ) : item.stock_disponible < 100 ? (
                        <Badge variant="warning">Stock bajo</Badge>
                      ) : (
                        <Badge variant="success">Disponible</Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-32 text-muted-foreground">
                      {item.product && item.stock_total !== null && item.stock_total !== undefined ? (
                        <QuickAdjustModal inventoryItem={item} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Tooltip con información de pedidos */}
                    {hoveredRow === item.id && hasRelatedOrders && (
                      <TableCell className="absolute left-0 top-full z-50 w-full pointer-events-none">
                        <div className="bg-popover border border-border rounded-lg shadow-lg p-4 ml-6 mr-6">
                          <p className="text-sm font-semibold text-foreground mb-2">
                            Mercadería comprometida en {item.related_orders.length} pedido{item.related_orders.length > 1 ? 's' : ''}:
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {item.related_orders.map((orderLine: any, idx: number) => {
                              const statusConfig = getOrderStatusConfig(orderLine.order?.status)
                              return (
                                <div key={idx} className="text-xs border-l-2 border-info pl-3 py-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-foreground">
                                      Pedido #{orderLine.order?.order_number}
                                    </span>
                                    <Badge variant={statusConfig.badgeVariant}>{statusConfig.label}</Badge>
                                  </div>
                                  <div className="text-muted-foreground">
                                    <p>Cliente: <span className="font-medium">{orderLine.order?.client?.business_name || orderLine.order?.client?.name}</span></p>
                                    <p>Cantidad: <span className="font-medium">{orderLine.quantity} unidades</span></p>
                                    <p>Fecha: <span className="font-medium">{new Date(orderLine.order?.created_at).toLocaleDateString('es-AR')}</span></p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Controles de paginación */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Selector de filas por página */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={sortedInventory.length}>Todos ({sortedInventory.length})</option>
            </select>
            <span className="text-sm text-muted-foreground">filas</span>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-muted-foreground">
            Mostrando {currentPage * rowsPerPage + 1} - {Math.min((currentPage + 1) * rowsPerPage, sortedInventory.length)} de {sortedInventory.length} productos
          </div>
        </div>

        {/* Navegación de páginas */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
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
                      className={cn(
                        'px-3 py-1 rounded text-sm',
                        page === currentPage
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {page + 1}
                    </button>
                  )
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="text-muted-foreground">...</span>
                }
                return null
              })}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
