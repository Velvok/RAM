'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  TrendingUp,
  Clock,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  PackageX,
  Inbox
} from 'lucide-react'
import { AIChatAssistant } from './ai-chat-assistant'
import { MetricCard } from '@/components/metric-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { getOrderStatusConfig } from '@/lib/order-status'
import { cn } from '@/lib/utils'

interface DolarData {
  compra: number
  venta: number
  fechaActualizacion: string
  variacion: number
}

interface DashboardData {
  kpis: {
    pendingOrders: number
    inProductionOrders: number
    pendingDeliveryOrders: number
    totalOrders: number
  }
  recentOrders: Array<{
    pedido: string
    cliente: string
    metraje: string
    fecha: string
    estado: string
    producto: string
  }>
  stockProductos: Array<{
    codigo: string
    total: number
    reservado: number
    disponible: number
    clientes: string[]
  }>
  availableProducts: Array<{
    code: string
    name: string
  }>
  productMonthlyData: Record<string, Array<{ month: string; quantity: number }>>
  monthlyData: Array<{
    month: string
    metros: number
    unidades: number
  }>
  yearlyData: Array<{
    year: string
    metros: number
    unidades: number
  }>
}

interface DashboardRAMClientProps {
  data: DashboardData
}

export function DashboardRAMClient({ data }: DashboardRAMClientProps) {
  const router = useRouter()
  const [dolarData, setDolarData] = useState<DolarData | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [errorDolar, setErrorDolar] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'todo' | 'pedidos' | 'stock'>('todo')
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Paginación para Últimos Pedidos
  const [pedidosPage, setPedidosPage] = useState(0)
  const [pedidosPerPage, setPedidosPerPage] = useState(20)

  // Paginación para Stock por Producto
  const [stockPage, setStockPage] = useState(0)
  const [stockPerPage, setStockPerPage] = useState(20)

  // Función para obtener la cotización del dólar con caché inteligente
  const fetchDolarData = async () => {
    try {
      // Verificar si hay datos en caché recientes (menos de 5 minutos)
      const cachedData = localStorage.getItem('dolarData')
      const cachedTime = localStorage.getItem('dolarDataTime')
      
      if (cachedData && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime)
        const fiveMinutes = 5 * 60 * 1000 // 5 minutos en milisegundos
        
        if (cacheAge < fiveMinutes) {
          const data = JSON.parse(cachedData)
          setDolarData(data)
          setLastUpdate(new Date(parseInt(cachedTime)))
          setLoadingDolar(false)
          return
        }
      }

      // Si no hay caché o es muy antiguo, obtener datos nuevos
      const response = await fetch('https://dolarapi.com/v1/dolares/mayorista')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      // Validar que los datos sean válidos
      if (!data.compra || !data.venta || isNaN(data.compra) || isNaN(data.venta)) {
        throw new Error('Datos inválidos')
      }
      
      const dolarInfo: DolarData = {
        compra: data.compra,
        venta: data.venta,
        fechaActualizacion: data.fechaActualizacion,
        variacion: data.variacion || 0
      }
      
      // Guardar en caché
      localStorage.setItem('dolarData', JSON.stringify(dolarInfo))
      localStorage.setItem('dolarDataTime', Date.now().toString())
      
      setDolarData(dolarInfo)
      setLastUpdate(new Date())
      setErrorDolar(null)
      
    } catch (error) {
      console.error('Error obteniendo cotización del dólar:', error)
      setErrorDolar('No se pudo obtener la cotización')
      
      // Intentar usar caché antiguo si existe
      const cachedData = localStorage.getItem('dolarData')
      if (cachedData) {
        const data = JSON.parse(cachedData)
        setDolarData(data)
        setErrorDolar('Mostrando datos desactualizados')
      }
      
    } finally {
      setLoadingDolar(false)
    }
  }

  useEffect(() => {
    fetchDolarData()
    
    // Configurar actualización automática cada 5 minutos
    const interval = setInterval(fetchDolarData, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Actualizar cuando la ventana gana foco (usuario vuelve a la pestaña)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !loadingDolar) {
        const minutesSinceLastUpdate = lastUpdate 
          ? (Date.now() - lastUpdate.getTime()) / (1000 * 60)
          : Infinity
        
        // Si pasaron más de 2 minutos, actualizar
        if (minutesSinceLastUpdate > 2) {
          fetchDolarData()
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [lastUpdate, loadingDolar])

  // Calcular productos con stock roto (sin stock, disponible <= 0)
  const productosStockRoto = useMemo(() => {
    return data.stockProductos?.filter((producto: any) => {
      return producto.disponible <= 0
    }) || []
  }, [data.stockProductos])

  const stockRoto = productosStockRoto.length
  const stockRotoPreview = productosStockRoto.slice(0, 10)

  // Función para redirigir a stock con filtro sin stock
  const handleStockRotoClick = () => {
    // Guardar el filtro en sessionStorage para que se aplique al cargar la página
    sessionStorage.setItem('stockFilter', JSON.stringify({ stockStatus: 'sin_stock' }))
    router.push('/admin/stock')
  }

  const kpiData = [
    {
      icon: Package,
      title: 'Pedidos Nuevos',
      value: data.kpis.pendingOrders.toString(),
      subtitle: 'Nuevos y aprobados',
      color: 'text-slate-700'
    },
    {
      icon: Clock,
      title: 'En Preparación',
      value: data.kpis.inProductionOrders.toString(),
      subtitle: 'En corte actualmente',
      color: 'text-slate-700'
    },
    {
      icon: TrendingUp,
      title: 'Por Entregar',
      value: data.kpis.pendingDeliveryOrders.toString(),
      subtitle: 'Finalizados sin entregar',
      color: 'text-slate-700'
    }
  ]

  const getStatusBadge = (status: string) => {
    const config = getOrderStatusConfig(status)
    return <Badge variant={config.badgeVariant}>{config.label}</Badge>
  }

  const filteredPedidos = (() => {
    let result = data.recentOrders
    if (!searchQuery) {
      // Ordenar por criticidad: nuevo > aprobado > en_corte > resto
      const prioridad: Record<string, number> = {
        'nuevo': 1,
        'aprobado': 2,
        'en_corte': 3,
        'finalizado': 4,
        'entregado': 5,
        'cancelado': 6
      }
      return [...result].sort((a, b) => {
        const prioA = prioridad[a.estado] || 999
        const prioB = prioridad[b.estado] || 999
        return prioA - prioB
      })
    }
    
    const query = searchQuery.toLowerCase()
    
    if (searchScope === 'stock') {
      return data.recentOrders
    }
    
    if (searchScope === 'pedidos') {
      return data.recentOrders.filter(p => 
        p.cliente.toLowerCase().includes(query) ||
        p.pedido.toLowerCase().includes(query)
      )
    }
    
    // Ámbito "Todo": Búsqueda cruzada mejorada
    // 1. Buscar por producto en stock
    const matchingProducto = data.stockProductos.find(sp => 
      sp.codigo.toLowerCase().includes(query)
    )
    if (matchingProducto) {
      return data.recentOrders.filter(p => p.producto === matchingProducto.codigo)
    }
    
    // 2. Buscar por cliente o pedido
    const pedidosByClienteOrNumber = data.recentOrders.filter(p => 
      p.cliente.toLowerCase().includes(query) ||
      p.pedido.toLowerCase().includes(query)
    )
    
    if (pedidosByClienteOrNumber.length > 0) {
      return pedidosByClienteOrNumber
    }
    
    // 3. Si no hay coincidencias directas, buscar por producto en pedidos
    result = data.recentOrders.filter(p => 
      p.producto.toLowerCase().includes(query)
    )
    
    // Ordenar por criticidad
    const prioridad: Record<string, number> = {
      'nuevo': 1,
      'aprobado': 2,
      'en_corte': 3,
      'finalizado': 4,
      'entregado': 5,
      'cancelado': 6
    }
    return result.sort((a, b) => {
      const prioA = prioridad[a.estado] || 999
      const prioB = prioridad[b.estado] || 999
      return prioA - prioB
    })
  })()

  const filteredProductos = (() => {
    let result = data.stockProductos
    if (!searchQuery) {
      // Ordenar por criticidad: menor disponible primero, luego mayor reservado
      return [...result].sort((a, b) => {
        // Primero por porcentaje de disponible (menor es más crítico)
        const percA = a.total > 0 ? (a.disponible / a.total) : 1
        const percB = b.total > 0 ? (b.disponible / b.total) : 1
        if (percA !== percB) return percA - percB
        
        // Si tienen mismo porcentaje, ordenar por mayor reservado
        return b.reservado - a.reservado
      })
    }
    
    const query = searchQuery.toLowerCase()
    
    if (searchScope === 'pedidos') {
      return data.stockProductos
    }
    
    if (searchScope === 'stock') {
      return data.stockProductos.filter(p => 
        p.codigo.toLowerCase().includes(query)
      )
    }
    
    // Ámbito "Todo": Búsqueda cruzada mejorada
    // 1. Buscar por código de producto
    const productosByCode = data.stockProductos.filter(p => 
      p.codigo.toLowerCase().includes(query)
    )
    if (productosByCode.length > 0) {
      return productosByCode
    }
    
    // 2. Buscar productos involucrados en pedidos que coincidan con cliente o número de pedido
    const matchingPedidos = data.recentOrders.filter(pd => 
      pd.cliente.toLowerCase().includes(query) ||
      pd.pedido.toLowerCase().includes(query)
    )
    
    if (matchingPedidos.length > 0) {
      // Obtener códigos de productos de los pedidos coincidentes
      const productosInvolucrados = matchingPedidos.map(p => p.producto)
      return data.stockProductos.filter(sp => 
        productosInvolucrados.includes(sp.codigo)
      )
    }
    
    // 3. Buscar por clientes asociados al stock
    result = data.stockProductos.filter(sp => 
      sp.clientes.some(c => c.toLowerCase().includes(query))
    )
    
    // Ordenar por criticidad
    return result.sort((a, b) => {
      const percA = a.total > 0 ? (a.disponible / a.total) : 1
      const percB = b.total > 0 ? (b.disponible / b.total) : 1
      if (percA !== percB) return percA - percB
      return b.reservado - a.reservado
    })
  })()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        {kpiData.map((kpi, index) => (
          <MetricCard key={index} title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.subtitle} />
        ))}

        <MetricCard title="Total Pedidos" value={data.kpis.totalOrders} icon={Package} trend="En el sistema" />

        <Card
          className="group relative cursor-pointer p-6 transition-colors hover:border-destructive/40"
          onClick={handleStockRotoClick}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Stock Roto</p>
              <p className="mb-1 font-mono text-3xl font-bold tabular-nums text-destructive">{stockRoto}</p>
              <p className="flex items-center gap-1 text-xs font-medium text-primary underline decoration-dotted underline-offset-2">
                <span>Ver productos sin stock</span>
                <span>→</span>
              </p>
            </div>
            <PackageX size={20} strokeWidth={1.5} className="text-destructive" />
          </div>

          {/* Tooltip con lista de productos sin stock */}
          {stockRoto > 0 && (
            <div className="invisible absolute left-0 top-full z-[9999] mt-2 w-96 rounded-lg border border-border bg-popover p-4 shadow-2xl transition-all group-hover:visible">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Productos sin stock</h4>
                <Badge variant="muted">{stockRoto} total{stockRoto !== 1 ? 'es' : ''}</Badge>
              </div>
              {stockRotoPreview.length > 0 ? (
                <>
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
                    {stockRotoPreview.map((producto: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-muted/50">
                        <PackageX size={16} className="mt-0.5 flex-shrink-0 text-destructive" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {producto.codigo || 'Sin código'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {producto.nombre || 'Sin nombre'}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="destructive">Disponible: {producto.disponible}</Badge>
                            {producto.reservado > 0 && (
                              <Badge variant="warning">Reservado: {producto.reservado}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {stockRoto > 10 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-center text-xs font-medium text-muted-foreground">
                        +{stockRoto - 10} productos más sin stock
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No hay productos para mostrar</p>
              )}
              <div className="mt-3 border-t border-border pt-3">
                <p className="flex items-center justify-center gap-1 text-center text-xs font-semibold text-primary">
                  <span>Click para ver todos</span>
                  <span>→</span>
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Dólar hoy</p>
                <button
                  onClick={fetchDolarData}
                  disabled={loadingDolar}
                  className="rounded p-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  title="Actualizar cotización"
                >
                  <RefreshCw size={16} className={cn('text-muted-foreground', loadingDolar && 'animate-spin')} />
                </button>
              </div>
              {loadingDolar ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Actualizando...</p>
                  <div className="h-1 w-full rounded-full bg-muted">
                    <div className="h-1 animate-pulse rounded-full bg-primary" style={{ width: '60%' }}></div>
                  </div>
                </div>
              ) : dolarData ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                      ${dolarData.compra}
                    </p>
                    <span className="text-sm text-muted-foreground">/</span>
                    <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                      ${dolarData.venta}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dolarData.variacion !== 0 && (
                      <div className={cn(
                        'flex items-center gap-1 text-xs font-medium',
                        dolarData.variacion > 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {dolarData.variacion > 0 ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                        {Math.abs(dolarData.variacion)}%
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      {lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs` : 'Recién actualizado'}
                    </p>
                  </div>
                  {errorDolar && (
                    <p className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle size={12} />
                      {errorDolar}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No disponible</p>
                  <button
                    onClick={fetchDolarData}
                    className="text-xs font-medium text-primary hover:text-primary/80"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
            <DollarSign size={20} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Búsqueda Global</h3>
        </div>

        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por cliente, pedido o producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as any)}
              className="w-40"
            >
              <option value="todo">Todo</option>
              <option value="pedidos">Solo Pedidos</option>
              <option value="stock">Solo Stock</option>
            </Select>
          </div>
        </div>

        {searchQuery && (
          <div className="mb-4 rounded-lg border border-info/20 bg-info/5 p-3">
            <p className="text-sm text-info">
              <span className="font-medium">Buscando:</span> "{searchQuery}" en{' '}
              <span className="font-medium">
                {searchScope === 'todo' ? 'Todo el sistema' : searchScope === 'pedidos' ? 'Pedidos' : 'Stock'}
              </span>
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col p-6" style={{ height: '420px' }}>
          <h3 className="mb-4 text-base font-semibold text-foreground">Últimos Pedidos</h3>
          {filteredPedidos.length === 0 ? (
            <EmptyState icon={Inbox} title="No hay pedidos" description="No se encontraron pedidos con los filtros actuales." />
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos
                      .slice(pedidosPage * pedidosPerPage, (pedidosPage + 1) * pedidosPerPage)
                      .map((pedido, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{pedido.pedido}</div>
                          <div className="text-xs text-muted-foreground">{pedido.fecha}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{pedido.cliente}</div>
                          <div className="text-xs text-muted-foreground">{pedido.metraje}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(pedido.estado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                currentPage={pedidosPage}
                totalItems={filteredPedidos.length}
                itemsPerPage={pedidosPerPage}
                itemLabel="pedidos"
                onPageChange={setPedidosPage}
                onItemsPerPageChange={setPedidosPerPage}
                itemsPerPageOptions={[20, 50]}
              />
            </>
          )}
        </Card>

        <Card className="flex flex-col p-6" style={{ height: '420px' }}>
          <h3 className="mb-4 text-base font-semibold text-foreground">Stock por Producto</h3>
          {filteredProductos.length === 0 ? (
            <EmptyState icon={Package} title="No hay productos" description="No se encontraron productos con los filtros actuales." />
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-auto">
                {filteredProductos
                  .slice(stockPage * stockPerPage, (stockPage + 1) * stockPerPage)
                  .map((producto, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{producto.codigo}</span>
                      <span className="text-xs text-muted-foreground">{producto.total} unidades</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute left-0 top-0 h-full bg-info transition-all"
                        style={{ width: `${(producto.disponible / producto.total) * 100}%` }}
                      />
                      <div
                        className="absolute h-full bg-warning transition-all"
                        style={{
                          left: `${(producto.disponible / producto.total) * 100}%`,
                          width: `${(producto.reservado / producto.total) * 100}%`
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-info"></div>
                          <span className="text-muted-foreground">Disponible: {producto.disponible}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-warning"></div>
                          <span className="text-muted-foreground">Reservado: {producto.reservado}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                currentPage={stockPage}
                totalItems={filteredProductos.length}
                itemsPerPage={stockPerPage}
                itemLabel="productos"
                onPageChange={setStockPage}
                onItemsPerPageChange={setStockPerPage}
                itemsPerPageOptions={[20, 50]}
              />
            </>
          )}
        </Card>
      </div>

      {/* Botón flotante del chat IA */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-40 group"
      >
        <Sparkles className="w-6 h-6" />
        <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Asistente IA
        </span>
      </button>

      {/* Componente de chat IA */}
      <AIChatAssistant 
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false)
          console.log('🔍 Dashboard data disponible:', {
            pedidos: data.recentOrders?.length,
            stock: data.stockProductos?.length,
            kpis: data.kpis
          })
        }}
        dashboardData={data}
      />
    </div>
  )
}
