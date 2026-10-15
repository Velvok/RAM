'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, LogOut, Search, X, Clock, MessageSquare, ChevronRight, Scissors, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoader } from '@/components/ui/spinner'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'aprobado', label: 'Aprobado' },
  { id: 'aprobado_en_pausa', label: 'En Pausa' },
  { id: 'en_corte', label: 'En Corte' },
  { id: 'finalizado', label: 'Finalizado' },
]

export default function PlantaPedidosPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [currentTime, setCurrentTime] = useState('')
  const [unreadNotes, setUnreadNotes] = useState<Record<string, number>>({})

  useEffect(() => {
    const operatorData = localStorage.getItem('operator')
    if (!operatorData) {
      router.push('/planta/login')
      return
    }
    setOperator(JSON.parse(operatorData))
    loadPedidos()
  }, [router])

  // Actualizar hora cada segundo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const argentinaTime = now.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      setCurrentTime(argentinaTime)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  async function loadPedidos() {
    try {
      const { getOrdersForPlanta } = await import('@/app/actions/client-queries')
      const data = await getOrdersForPlanta()
      setPedidos(data || [])
      if (data && data.length > 0) {
        const { getUnreadNotesCountByOrders } = await import('@/app/actions/order-notes')
        const counts = await getUnreadNotesCountByOrders(data.map((p: any) => p.id))
        setUnreadNotes(counts)
      }
    } catch (error) {
      console.error('Error loading pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function refreshUnreadNotes(orderIds: string[]) {
    if (!orderIds.length) return
    try {
      const { getUnreadNotesCountByOrders } = await import('@/app/actions/order-notes')
      const counts = await getUnreadNotesCountByOrders(orderIds)
      setUnreadNotes(counts)
    } catch (e) {}
  }

  useEffect(() => {
    if (!pedidos.length) return
    const supabase = createClient()
    const channel = supabase
      .channel('order_notes_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_notes' },
        () => refreshUnreadNotes(pedidos.map(p => p.id))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pedidos])

  function handleLogout() {
    localStorage.removeItem('operator')
    router.push('/')
  }

  // Filtrar pedidos por búsqueda y estado
  const filteredPedidos = useMemo(() => {
    let filtered = pedidos

    if (statusFilter !== 'todos') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.order_number?.toLowerCase().includes(searchLower) ||
        p.client?.business_name?.toLowerCase().includes(searchLower) ||
        p.client?.name?.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [pedidos, statusFilter, searchQuery])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader label="Cargando pedidos..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
            <p className="text-foreground/90 mt-1">
              Operario: {operator?.full_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Reloj */}
            <div className="flex items-center gap-2 px-4 py-2 bg-card/50 rounded-lg border border-border">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="text-lg font-mono font-semibold text-foreground">
                {currentTime}
              </span>
            </div>
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-foreground rounded-lg transition-colors"
              title="Buscar Pedido"
            >
              <Search className="w-6 h-6" />
            </button>
            <button
              onClick={handleLogout}
              className="p-3 bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-destructive-foreground rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sección de Búsqueda Desplegable */}
        {showSearchModal && (
          <Card className="p-6 space-y-4 animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-foreground">Buscar Pedido</h3>
              <button
                onClick={() => {
                  setShowSearchModal(false)
                  setSearchQuery('')
                  setStatusFilter('todos')
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-2">
                  Buscar por Cliente o Número de Pedido
                </label>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: ACME Corp, PED-TEST-1234..."
                  className="h-12 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-2">
                  Estado del Pedido
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setStatusFilter(filter.id)}
                      className={cn(
                        'px-4 py-3 rounded-lg font-semibold text-sm transition-colors',
                        statusFilter === filter.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground/90 hover:bg-secondary active:bg-secondary/80'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? 's' : ''} encontrado{filteredPedidos.length !== 1 ? 's' : ''}
              </p>
              {(searchQuery || statusFilter !== 'todos') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('todos')
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </Card>
        )}

        {filteredPedidos.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              icon={Package}
              title="No hay pedidos disponibles"
              description={pedidos.length === 0 ? 'No hay pedidos aprobados en este momento' : 'Prueba a cambiar los filtros de búsqueda'}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPedidos.map((pedido) => {
              const cutOrdersCount = pedido.cut_orders?.length || 0
              const statusConfig = getOrderStatusConfig(pedido.status)
              const notesCount = unreadNotes[pedido.id] || 0

              return (
                <Card
                  key={pedido.id}
                  onClick={() => router.push(`/planta/pedidos/${pedido.id}`)}
                  className="p-5 cursor-pointer transition-colors hover:border-primary/40 active:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-xl font-bold text-foreground">{pedido.order_number}</div>
                      <div className="text-base text-foreground/90 font-medium mt-0.5">
                        {pedido.client?.business_name || pedido.client?.name || 'Sin cliente'}
                      </div>
                    </div>
                    <Badge variant={statusConfig.badgeVariant} className="text-sm px-3 py-1 flex-shrink-0">
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(pedido.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Scissors className="w-4 h-4" />
                        {cutOrdersCount} {cutOrdersCount === 1 ? 'orden' : 'órdenes'}
                      </span>
                      {notesCount > 0 && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/50 rounded-full">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-amber-300">{notesCount}</span>
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
