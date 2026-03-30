'use client'

import { useState, useEffect } from 'react'
import { 
  Package, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Search,
  ChevronDown,
  Info,
  Sparkles,
  AlertTriangle
} from 'lucide-react'
import { AIChatAssistant } from './ai-chat-assistant'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  mockOperators,
  generateMockCutData,
  getTodayCuts,
  getTopOperatorToday,
  aggregateByGranularity,
  getCutDistribution
} from '@/lib/mock-productivity-data'

interface DolarData {
  compra: number
  venta: number
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
  const [dolarData, setDolarData] = useState<DolarData | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [metricUnit, setMetricUnit] = useState<'metros' | 'unidades'>('metros')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'todo' | 'pedidos' | 'stock'>('todo')
  const [isChatOpen, setIsChatOpen] = useState(false)
  
  // Paginación para Últimos Pedidos
  const [pedidosPage, setPedidosPage] = useState(0)
  const [pedidosPerPage, setPedidosPerPage] = useState(20)
  
  // Paginación para Stock por Producto
  const [stockPage, setStockPage] = useState(0)
  const [stockPerPage, setStockPerPage] = useState(20)
  
  // Generar últimos 12 meses
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (11 - i))
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
  
  // Análisis por producto (ahora comparación mensual por categorías)
  const [selectedComparisonMonths, setSelectedComparisonMonths] = useState<string[]>([last12Months[last12Months.length - 1]])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Total'])
  const [showMonthMenu, setShowMonthMenu] = useState(false)

  // Productividad de planta
  const [productivityGranularity, setProductivityGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [selectedOperator, setSelectedOperator] = useState<string>('all')
  const mockCutData = generateMockCutData()
  const todayCuts = getTodayCuts(mockCutData)
  const topOperator = getTopOperatorToday(mockCutData)
  const cutDistribution = getCutDistribution(mockCutData)
  const evolutionData = aggregateByGranularity(mockCutData, productivityGranularity, selectedOperator)
  
  const categories = ['Total', 'Sincalum', 'Prepintado', 'Galvanizado', 'Perfiles']
  
  // Generar datos mockeados por categoría y mes
  const generateCategoryData = () => {
    const baseData: Record<string, Record<string, number>> = {}
    
    last12Months.forEach(month => {
      baseData[month] = {
        'Total': Math.floor(Math.random() * 5000) + 3000,
        'Sincalum': Math.floor(Math.random() * 1500) + 800,
        'Prepintado': Math.floor(Math.random() * 1200) + 600,
        'Galvanizado': Math.floor(Math.random() * 1000) + 500,
        'Perfiles': Math.floor(Math.random() * 800) + 400
      }
    })
    
    return baseData
  }
  
  const categoryData = generateCategoryData()

  useEffect(() => {
    fetch('https://dolarapi.com/v1/dolares/oficial')
      .then(res => res.json())
      .then(data => {
        setDolarData({ compra: data.compra, venta: data.venta })
        setLoadingDolar(false)
      })
      .catch(() => {
        setLoadingDolar(false)
      })
  }, [])

  // Calcular productos con stock crítico (disponible < 20% del total)
  const stockCritico = data.stockProductos?.filter((producto: any) => {
    if (producto.total === 0) return false
    const porcentajeDisponible = (producto.disponible / producto.total) * 100
    return porcentajeDisponible < 20 && producto.disponible > 0
  }).length || 0

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
    const statusConfig: Record<string, { label: string; className: string }> = {
      'nuevo': { label: 'Nuevo', className: 'bg-slate-100 text-slate-700' },
      'aprobado': { label: 'Aprobado', className: 'bg-yellow-100 text-yellow-700' },
      'aprobado_en_pausa': { label: 'En Pausa', className: 'bg-orange-100 text-orange-700' },
      'en_corte': { label: 'En Corte', className: 'bg-blue-100 text-blue-700' },
      'finalizado': { label: 'Finalizado', className: 'bg-green-100 text-green-700' },
      'entregado': { label: 'Entregado', className: 'bg-purple-100 text-purple-700' },
      'cancelado': { label: 'Cancelado', className: 'bg-red-100 text-red-700' }
    }
    const config = statusConfig[status] || { label: status, className: 'bg-slate-100 text-slate-700' }
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {kpiData.map((kpi, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 mb-2">{kpi.title}</p>
                <p className="text-3xl font-bold text-slate-900 mb-1">{kpi.value}</p>
                <p className="text-xs text-slate-400">{kpi.subtitle}</p>
              </div>
              <kpi.icon className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-2">Total Pedidos</p>
              <p className="text-3xl font-bold text-slate-900 mb-1">{data.kpis.totalOrders}</p>
              <p className="text-xs text-slate-400">En el sistema</p>
            </div>
            <Package className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-2">Stock Crítico</p>
              <p className="text-3xl font-bold text-slate-900 mb-1">{stockCritico}</p>
              <p className="text-xs text-slate-400">Productos con &lt; 20% disponible</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-orange-600" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-2">Dólar hoy</p>
              {loadingDolar ? (
                <p className="text-sm text-slate-400">Cargando...</p>
              ) : dolarData ? (
                <>
                  <p className="text-xl font-bold text-slate-900 mb-1">
                    {dolarData.compra} / {dolarData.venta}
                  </p>
                  <p className="text-xs text-slate-400">
                    Actualizado: {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No disponible</p>
              )}
            </div>
            <DollarSign className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Búsqueda Global</h3>
        </div>
        
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, pedido o producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              <option value="todo">Todo</option>
              <option value="pedidos">Solo Pedidos</option>
              <option value="stock">Solo Stock</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {searchQuery && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Buscando:</span> "{searchQuery}" en{' '}
              <span className="font-medium">
                {searchScope === 'todo' ? 'Todo el sistema' : searchScope === 'pedidos' ? 'Pedidos' : 'Stock'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col" style={{ height: '400px' }}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Últimos Pedidos</h3>
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pedido</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos
                  .slice(pedidosPage * pedidosPerPage, (pedidosPage + 1) * pedidosPerPage)
                  .map((pedido, index) => (
                  <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-2">
                      <div className="text-sm font-medium text-slate-900">{pedido.pedido}</div>
                      <div className="text-xs text-slate-500">{pedido.fecha}</div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm text-slate-700">{pedido.cliente}</div>
                      <div className="text-xs text-slate-500">{pedido.metraje}</div>
                    </td>
                    <td className="py-3 px-2">
                      {getStatusBadge(pedido.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={pedidosPerPage}
                onChange={(e) => {
                  setPedidosPerPage(Number(e.target.value))
                  setPedidosPage(0)
                }}
                className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={20}>20 filas</option>
                <option value={50}>50 filas</option>
              </select>
              <span className="text-xs text-slate-500">
                {filteredPedidos.length} total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPedidosPage(Math.max(0, pedidosPage - 1))}
                disabled={pedidosPage === 0}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-600">
                Página {pedidosPage + 1} de {Math.ceil(filteredPedidos.length / pedidosPerPage) || 1}
              </span>
              <button
                onClick={() => setPedidosPage(Math.min(Math.ceil(filteredPedidos.length / pedidosPerPage) - 1, pedidosPage + 1))}
                disabled={pedidosPage >= Math.ceil(filteredPedidos.length / pedidosPerPage) - 1}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col" style={{ height: '400px' }}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Stock por Producto</h3>
          <div className="flex-1 overflow-auto space-y-4">
            {filteredProductos
              .slice(stockPage * stockPerPage, (stockPage + 1) * stockPerPage)
              .map((producto, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{producto.codigo}</span>
                  <span className="text-xs text-slate-500">{producto.total} unidades</span>
                </div>
                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-blue-400 transition-all"
                    style={{ width: `${(producto.disponible / producto.total) * 100}%` }}
                  />
                  <div 
                    className="absolute h-full bg-yellow-400 transition-all"
                    style={{ 
                      left: `${(producto.disponible / producto.total) * 100}%`,
                      width: `${(producto.reservado / producto.total) * 100}%` 
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span className="text-slate-600">Disponible: {producto.disponible}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                      <span className="text-slate-600">Reservado: {producto.reservado}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={stockPerPage}
                onChange={(e) => {
                  setStockPerPage(Number(e.target.value))
                  setStockPage(0)
                }}
                className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={20}>20 filas</option>
                <option value={50}>50 filas</option>
              </select>
              <span className="text-xs text-slate-500">
                {filteredProductos.length} total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStockPage(Math.max(0, stockPage - 1))}
                disabled={stockPage === 0}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-600">
                Página {stockPage + 1} de {Math.ceil(filteredProductos.length / stockPerPage) || 1}
              </span>
              <button
                onClick={() => setStockPage(Math.min(Math.ceil(filteredProductos.length / stockPerPage) - 1, stockPage + 1))}
                disabled={stockPage >= Math.ceil(filteredProductos.length / stockPerPage) - 1}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Productividad de Planta */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Productividad de Planta</h2>
        
        {/* KPIs Superiores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Cortes Totales (Hoy) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-2">Cortes Totales (Hoy)</p>
                <p className="text-3xl font-bold text-slate-900 mb-1">{todayCuts.total}</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12% vs ayer</span>
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            </div>
          </div>

          {/* Operario del Día */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-2">Operario del Día</p>
                {topOperator ? (
                  <>
                    <p className="text-xl font-bold text-slate-900 mb-1">{topOperator.operator.name}</p>
                    <p className="text-sm text-slate-600">{topOperator.cuts} cortes realizados</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Sin datos</p>
                )}
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PieChart - Distribución de Carga */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-6">Distribución de Cortes por Operario</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cutDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {cutDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} cortes`, 'Total']}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* LineChart - Evolución de Productividad */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-slate-800">Evolución de Cortes</h3>
              <div className="flex items-center gap-2">
                {/* Selector de Granularidad */}
                <select
                  value={productivityGranularity}
                  onChange={(e) => setProductivityGranularity(e.target.value as 'day' | 'week' | 'month')}
                  className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="day">Día</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                </select>

                {/* Selector de Operario */}
                <select
                  value={selectedOperator}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  {mockOperators.map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    if (productivityGranularity === 'day') {
                      return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                    } else if (productivityGranularity === 'week') {
                      return `Sem ${date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`
                    } else {
                      return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
                    }
                  }}
                />
                <YAxis 
                  stroke="#64748b"
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('es-AR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })
                  }}
                  formatter={(value: number) => [`${value} cortes`, 'Total']}
                />
                <Line 
                  type="monotone" 
                  dataKey="cuts" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={{ fill: '#2563eb', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
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
