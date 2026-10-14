'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateCutOrders } from '@/app/actions/orders'
import { Package, Calendar, User, DollarSign, Loader2, Filter, LayoutGrid, List, RefreshCw, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { getOrderStatusConfig, type OrderStatus } from '@/lib/order-status'
import { useError } from '@/components/error-modal'
import { cn } from '@/lib/utils'

interface OrdersGridWithFiltersProps {
  orders: any[]
}

const DOT_CLASS: Record<string, string> = {
  default: 'bg-primary',
  muted: 'bg-muted-foreground/50',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
  destructive: 'bg-destructive',
}

export default function OrdersGridWithFilters({ orders }: OrdersGridWithFiltersProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'rows'>('rows')
  const [currentPage, setCurrentPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const router = useRouter()
  const { showError, ErrorDialog } = useError()

  // Auto-refresh al montar y cada 30s para asegurar datos frescos
  useEffect(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      router.refresh()
    }, 30000)

    return () => clearInterval(refreshInterval)
  }, [router])

  // Cargar preferencia de vista desde localStorage solo en el cliente
  useEffect(() => {
    const savedMode = localStorage.getItem('pedidos-view-mode') as 'cards' | 'rows'
    if (savedMode) {
      setViewMode(savedMode)
    }
  }, [])

  const handleViewModeChange = (mode: 'cards' | 'rows') => {
    setViewMode(mode)
    localStorage.setItem('pedidos-view-mode', mode)
  }

  // Filtrar pedidos por estado y búsqueda
  const filteredOrders = useMemo(() => {
    let filtered = orders

    if (statusFilter !== 'todos') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }

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

  // Detectar automáticamente si se debe agrupar por cliente
  const shouldGroupByClient = useMemo(() => {
    if (!searchQuery) return false

    const searchLower = searchQuery.toLowerCase()
    const matchingClients = new Set(
      filteredOrders
        .filter(o =>
          o.client?.business_name?.toLowerCase().includes(searchLower) ||
          o.client?.name?.toLowerCase().includes(searchLower)
        )
        .map(o => o.client?.id)
    )

    return matchingClients.size > 0
  }, [searchQuery, filteredOrders])

  // Agrupar pedidos por cliente
  const groupedOrders = useMemo(() => {
    if (!shouldGroupByClient) return null

    const groups = new Map<string, any[]>()

    filteredOrders.forEach(order => {
      const clientId = order.client?.id || 'sin-cliente'
      if (!groups.has(clientId)) {
        groups.set(clientId, [])
      }
      groups.get(clientId)!.push(order)
    })

    return Array.from(groups.entries())
      .map(([clientId, orders]) => ({
        clientId,
        clientName: orders[0]?.client?.business_name || orders[0]?.client?.name || 'Sin cliente',
        orders: orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        totalOrders: orders.length,
        totalAmount: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
      }))
      .sort((a, b) => b.totalOrders - a.totalOrders)
  }, [filteredOrders, shouldGroupByClient])

  // Aplicar paginación para vista de filas
  const paginatedOrders = useMemo(() => {
    if (viewMode === 'cards') return filteredOrders
    const startIndex = currentPage * rowsPerPage
    return filteredOrders.slice(startIndex, startIndex + rowsPerPage)
  }, [filteredOrders, currentPage, rowsPerPage, viewMode])

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter)
    setCurrentPage(0)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(0)
  }

  const statusCounts = {
    todos: orders.length,
    nuevo: orders.filter(o => o.status === 'nuevo').length,
    aprobado: orders.filter(o => o.status === 'aprobado').length,
    aprobado_en_pausa: orders.filter(o => o.status === 'aprobado_en_pausa').length,
    en_corte: orders.filter(o => o.status === 'en_corte').length,
    finalizado: orders.filter(o => o.status === 'finalizado').length,
    entregado: orders.filter(o => o.status === 'entregado').length
  }

  const filters: Array<{ id: 'todos' | OrderStatus; label: string; count: number }> = [
    { id: 'todos', label: 'Todos', count: statusCounts.todos },
    { id: 'nuevo', label: 'Nuevos', count: statusCounts.nuevo },
    { id: 'aprobado', label: 'Aprobados', count: statusCounts.aprobado },
    { id: 'aprobado_en_pausa', label: 'En Pausa', count: statusCounts.aprobado_en_pausa },
    { id: 'en_corte', label: 'En Corte', count: statusCounts.en_corte },
    { id: 'finalizado', label: 'Finalizados', count: statusCounts.finalizado },
    { id: 'entregado', label: 'Entregados', count: statusCounts.entregado },
  ]

  async function handleGenerateCutOrders(e: React.MouseEvent, orderId: string) {
    e.stopPropagation()
    setLoading(orderId)
    try {
      await generateCutOrders(orderId)
      router.refresh()
    } catch (error) {
      console.error('Error generating cut orders:', error)
      showError('Error al generar órdenes de corte')
    } finally {
      setLoading(null)
    }
  }

  function handleOrderClick(order: any) {
    router.push(`/admin/pedidos/${order.id}`)
  }

  function OrderStatusBadge({ status }: { status: string }) {
    const config = getOrderStatusConfig(status)
    return <Badge variant={config.badgeVariant}>{config.label}</Badge>
  }

  function ApproveButton({ order, compact = false }: { order: any; compact?: boolean }) {
    if (order.status !== 'nuevo') return null
    return (
      <button
        onClick={(e) => handleGenerateCutOrders(e, order.id)}
        disabled={loading === order.id}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg bg-success text-success-foreground font-semibold transition-colors hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50',
          compact ? 'px-3 py-1.5 text-xs' : 'w-full px-3 py-2 text-sm'
        )}
      >
        {loading === order.id ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Aprobando...
          </>
        ) : (
          <>
            <Check size={14} />
            Aprobar Pedido
          </>
        )}
      </button>
    )
  }

  function OrderCard({ order }: { order: any }) {
    return (
      <Card
        onClick={() => handleOrderClick(order)}
        className="cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex-1">
            <h4 className="mb-1 text-lg font-bold text-foreground">
              {order.order_number}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar size={14} />
              {new Date(order.created_at).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mb-4 space-y-2.5">
          <div className="flex items-start gap-2">
            <User size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span className="line-clamp-1 text-sm font-medium text-foreground">
              {order.client?.business_name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">
                {order.total_amount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package size={14} />
              {order.lines?.reduce((sum: number, line: any) => sum + (line.units || 0), 0) || 0} unidades
            </div>
          </div>

          {order.cut_orders && order.cut_orders.length > 0 && (
            <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
              <Package size={14} />
              <span>{order.cut_orders.length} órdenes de corte</span>
            </div>
          )}
        </div>

        <ApproveButton order={order} />
      </Card>
    )
  }

  return (
    <>
      <ErrorDialog />

      {/* Filtros */}
      <Card className="mb-6 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">Filtros de Pedidos</h3>
          </div>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            title="Refrescar pedidos"
          >
            <RefreshCw size={16} />
            Refrescar
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-foreground">
            Estado del pedido
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const dotVariant = filter.id === 'todos' ? 'muted' : getOrderStatusConfig(filter.id).badgeVariant
              const active = statusFilter === filter.id
              return (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id)}
                  className={cn(
                    'inline-flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
                  )}
                >
                  <div className={cn('h-2 w-2 rounded-full', DOT_CLASS[dotVariant])} />
                  <span>{filter.label}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {filter.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por cliente (agrupa automáticamente) o pedido..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 pl-10"
            />
            {shouldGroupByClient && (
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-info/10 px-2 py-1 text-xs font-medium text-info">
                <Filter size={12} />
                Agrupado
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => handleViewModeChange('cards')}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Vista de tarjetas"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => handleViewModeChange('rows')}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                viewMode === 'rows' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Vista de lista"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* Vista de Tarjetas */}
      {viewMode === 'cards' && (
        <>
          {filteredOrders.length === 0 ? (
            <Card className="p-12">
              <EmptyState icon={Package} title="No hay pedidos con este filtro" />
            </Card>
          ) : shouldGroupByClient && groupedOrders ? (
            <div className="space-y-6">
              {groupedOrders.map((group) => (
                <div key={group.clientId} className="rounded-xl border border-border bg-muted/40 p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                        <User size={22} className="text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{group.clientName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {group.totalOrders} pedido{group.totalOrders !== 1 ? 's' : ''} • Total: {group.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="info" className="px-4 py-2 text-sm">
                      <Package size={14} />
                      {group.orders.reduce((sum: number, o: any) => sum + (o.lines?.reduce((s: number, l: any) => s + (l.units || 0), 0) || 0), 0)} unidades
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.orders.map((order: any) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Vista de Filas */}
      {viewMode === 'rows' && (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState icon={Package} title="No se encontraron pedidos" description="Prueba a cambiar los filtros o la búsqueda." />
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                      <TableCell className="text-foreground">{order.client?.business_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {order.total_amount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.lines?.reduce((sum: number, line: any) => sum + (line.units || 0), 0) || 0}
                      </TableCell>
                      <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                      <TableCell>
                        <ApproveButton order={order} compact />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredOrders.length}
            itemsPerPage={rowsPerPage}
            itemLabel="pedidos"
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setRowsPerPage}
          />
        </>
      )}
    </>
  )
}
