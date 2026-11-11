'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Loader2, RefreshCw, Check, Search } from 'lucide-react'
import { generateCutOrders } from '@/app/actions/orders'
import { lineUnits } from '@/lib/order-modification'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { useTableSort, SortableTh } from '@/components/ui/sortable-table'
import { OrderStatusBadge } from '@/components/order-status-badge'
import { getOrderStatusConfig, type OrderStatus } from '@/lib/order-status'
import { useError } from '@/components/error-modal'
import { cn } from '@/lib/utils'
import { DeleteOrderButton } from '@/components/pedido/delete-order-button'

interface OrdersGridWithFiltersProps {
  orders: any[]
  canDelete?: boolean
}

const DOT_CLASS: Record<string, string> = {
  default: 'bg-primary',
  muted: 'bg-muted-foreground/50',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
  destructive: 'bg-destructive',
}

// Formato fijo en hora de Argentina: igual en servidor y navegador (evita errores de hidratación)
const TZ = 'America/Argentina/Buenos_Aires'
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: TZ })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })

const TH = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

type SortKey = 'order' | 'client' | 'date' | 'units' | 'progress' | 'status'

// Qué toca hacer con el pedido, para leerlo en la lista sin entrar en el detalle
function nextStep(order: any): { text: string; tone: 'action' | 'wait' | 'done' } {
  const cuts = order.cut_orders || []
  const preps = order.preparation_items || []
  const pendingApproval = (order.lines || []).reduce((s: number, l: any) => s + (l.quantity_pending_approval || 0), 0)
  switch (order.status) {
    case 'nuevo': return { text: 'Aprobar y asignar stock', tone: 'action' }
    case 'modificado': return { text: `Aprobar ampliación (+${pendingApproval})`, tone: 'action' }
    case 'aprobado_en_pausa': {
      const missing = cuts.filter((c: any) => !c.material_base_id).length + preps.filter((p: any) => !p.assigned_inventory_id).length
      return { text: `Asignar stock (${missing} sin material)`, tone: 'action' }
    }
    case 'aprobado': return { text: 'Esperando a planta', tone: 'wait' }
    case 'en_corte': {
      const confirm = cuts.some((c: any) => c.status === 'pendiente_confirmacion')
      return { text: confirm ? 'Confirmar recogida en planta' : 'En planta', tone: 'wait' }
    }
    case 'finalizado': return { text: 'Esperando remito de EVO', tone: 'wait' }
    case 'parcialmente_entregado': return { text: 'Esperando remito final', tone: 'wait' }
    case 'entregado': return { text: 'Entregado', tone: 'done' }
    case 'cancelado': return { text: 'Cancelado', tone: 'done' }
    default: return { text: '', tone: 'wait' }
  }
}

function progressOf(order: any): { done: number; total: number } {
  const cuts = order.cut_orders || []
  const preps = order.preparation_items || []
  const done = cuts.reduce((s: number, c: any) => s + Number(c.quantity_cut || 0), 0) + preps.reduce((s: number, p: any) => s + Number(p.quantity_prepared || 0), 0)
  const total = cuts.reduce((s: number, c: any) => s + Number(c.quantity_requested || 0), 0) + preps.reduce((s: number, p: any) => s + Number(p.quantity_requested || 0), 0)
  return { done, total }
}

export default function OrdersGridWithFilters({ orders, canDelete }: OrdersGridWithFiltersProps) {
  const [loading, setLoading] = useState<string | null>(null)
  // ?status=xxx desde el dashboard abre la lista ya filtrada
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const router = useRouter()
  const { showError, ErrorDialog } = useError()

  // Refresco cada 30 s mientras la pestaña está visible
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) router.refresh() }, 30000)
    return () => clearInterval(id)
  }, [router])

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of orders) if (o.client?.id) m.set(o.client.id, o.client.business_name || o.client.name || 'Sin nombre')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [orders])

  const filteredOrders = useMemo(() => {
    let filtered = orders
    if (statusFilter !== 'todos') filtered = filtered.filter(o => o.status === statusFilter)
    if (clientFilter) filtered = filtered.filter(o => o.client?.id === clientFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.client?.business_name?.toLowerCase().includes(q) ||
        o.lines?.some((l: any) => l.product?.code?.toLowerCase().includes(q) || l.product?.name?.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [orders, statusFilter, clientFilter, searchQuery])

  const { sorted, sort } = useTableSort<any, SortKey>(filteredOrders, {
    order: o => o.order_number,
    client: o => o.client?.business_name,
    date: o => o.created_at,
    units: o => o.lines?.reduce((s: number, l: any) => s + lineUnits(l), 0) || 0,
    progress: o => { const p = progressOf(o); return p.total ? p.done / p.total : -1 },
    status: o => getOrderStatusConfig(o.status).label,
  }, { key: 'date', dir: 'desc' })

  const paginatedOrders = useMemo(() => sorted.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage), [sorted, currentPage, rowsPerPage])

  const statusCounts: Record<string, number> = { todos: orders.length }
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1

  const filters: Array<{ id: 'todos' | OrderStatus; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'nuevo', label: 'Nuevos' },
    { id: 'modificado', label: 'Modificados' },
    { id: 'aprobado_en_pausa', label: 'En pausa' },
    { id: 'aprobado', label: 'Aprobados' },
    { id: 'en_corte', label: 'En corte' },
    { id: 'finalizado', label: 'Finalizados' },
    { id: 'parcialmente_entregado', label: 'Parciales' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'cancelado', label: 'Cancelados' },
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

  return (
    <>
      <ErrorDialog />

      <div className="flex flex-wrap gap-2">
        {filters.map(filter => {
          const count = statusCounts[filter.id] || 0
          if (filter.id !== 'todos' && count === 0 && statusFilter !== filter.id) return null
          const dotVariant = filter.id === 'todos' ? 'muted' : getOrderStatusConfig(filter.id).badgeVariant
          const active = statusFilter === filter.id
          return (
            <button
              key={filter.id}
              onClick={() => { setStatusFilter(filter.id); setCurrentPage(0) }}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', DOT_CLASS[dotVariant])} />
              {filter.label}
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
            </button>
          )
        })}
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por pedido, cliente o producto"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(0) }}
            className="h-10 pl-10"
          />
        </div>
        <SelectField wrapperClassName="w-64" value={clientFilter} onChange={e => { setClientFilter(e.target.value); setCurrentPage(0) }} aria-label="Cliente">
          <option value="">Todos los clientes</option>
          {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </SelectField>
        <button
          onClick={() => router.refresh()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          title="Refrescar pedidos"
        >
          <RefreshCw size={15} />
          Refrescar
        </button>
        <span className="ml-auto text-sm text-muted-foreground">{filteredOrders.length} pedido{filteredOrders.length === 1 ? '' : 's'}</span>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <SortableTh sort={sort} sortKey="order" className={TH}>Pedido</SortableTh>
                <SortableTh sort={sort} sortKey="client" className={TH}>Cliente</SortableTh>
                <SortableTh sort={sort} sortKey="date" className={TH}>Entrada</SortableTh>
                <SortableTh sort={sort} sortKey="units" className={cn(TH, 'text-right')}>Unidades</SortableTh>
                <SortableTh sort={sort} sortKey="progress" className={TH}>Planta</SortableTh>
                <SortableTh sort={sort} sortKey="status" className={TH}>Estado</SortableTh>
                <th className={TH}>Próximo paso</th>
                <th className={cn(TH, 'text-right')}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState icon={Package} title="No hay pedidos con estos filtros" description="Prueba a cambiar el estado, el cliente o la búsqueda." />
                  </td>
                </tr>
              ) : paginatedOrders.map(order => {
                const units = order.lines?.reduce((s: number, l: any) => s + lineUnits(l), 0) || 0
                const pending = order.lines?.reduce((s: number, l: any) => s + (l.quantity_pending_approval || 0), 0) || 0
                const progress = progressOf(order)
                const step = nextStep(order)
                return (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/pedidos/${order.id}`)}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{order.order_number}</div>
                      {order.evo_order_id && order.evo_order_id !== order.order_number && <div className="text-xs text-muted-foreground">EVO {order.evo_order_id}</div>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{order.client?.business_name || <span className="text-muted-foreground">Sin cliente</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground" suppressHydrationWarning>
                      {fmtDate(order.created_at)}
                      <span className="ml-1.5 text-xs">· {fmtTime(order.created_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {units}{pending > 0 && <span className="ml-1 text-xs font-medium text-warning">+{pending}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {progress.total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted"><div className={cn('h-full', progress.done >= progress.total ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }} /></div>
                          <span className="text-xs tabular-nums text-muted-foreground">{progress.done}/{progress.total}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className={cn('px-4 py-3 text-sm', step.tone === 'action' ? 'font-medium text-foreground' : 'text-muted-foreground')}>{step.text}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                      {order.status === 'nuevo' && (
                        <button
                          onClick={e => handleGenerateCutOrders(e, order.id)}
                          disabled={loading === order.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground transition-colors hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading === order.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Aprobar
                        </button>
                      )}
                      {canDelete && <DeleteOrderButton compact order={order} onDone={() => router.refresh()} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
  )
}
