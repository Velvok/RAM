'use client'

import { useState, useEffect } from 'react'
import { 
  Package, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Search,
  ChevronDown
} from 'lucide-react'
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

  const kpiData = [
    {
      icon: Package,
      title: 'Pedidos Pendientes',
      value: data.kpis.pendingOrders.toString(),
      subtitle: 'Nuevos y aprobados',
      color: 'text-slate-700'
    },
    {
      icon: Clock,
      title: 'En Producción',
      value: data.kpis.inProductionOrders.toString(),
      subtitle: 'En corte actualmente',
      color: 'text-slate-700'
    },
    {
      icon: TrendingUp,
      title: 'Pendientes Entrega',
      value: data.kpis.pendingDeliveryOrders.toString(),
      subtitle: 'Finalizados sin entregar',
      color: 'text-slate-700'
    }
  ]

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'nuevo': { label: 'Nuevo', className: 'bg-slate-100 text-slate-700' },
      'aprobado': { label: 'Aprobado', className: 'bg-yellow-100 text-yellow-700' },
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

  // Lógica de filtrado según ámbito seleccionado
  const filteredPedidos = (() => {
    if (!searchQuery) return data.recentOrders
    
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
    return data.recentOrders.filter(p => 
      p.producto.toLowerCase().includes(query)
    )
  })()

  const filteredProductos = (() => {
    if (!searchQuery) return data.stockProductos
    
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
    const productosByCliente = data.stockProductos.filter(sp => 
      sp.clientes.some(c => c.toLowerCase().includes(query))
    )
    
    return productosByCliente
  })()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <p className="text-sm font-medium text-slate-500 mb-2">Cotización dólar</p>
              {loadingDolar ? (
                <p className="text-sm text-slate-400">Cargando...</p>
              ) : dolarData ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-slate-500">Compra:</span>
                      <span className="text-xl font-bold text-slate-900">${dolarData.compra}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-slate-500">Venta:</span>
                      <span className="text-xl font-bold text-slate-900">${dolarData.venta}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Dólar oficial</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No disponible</p>
              )}
            </div>
            <DollarSign className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
          </div>
        </div>

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Producción Anual</h3>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
              <button
                onClick={() => setMetricUnit('metros')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricUnit === 'metros'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metros
              </button>
              <button
                onClick={() => setMetricUnit('unidades')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricUnit === 'unidades'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unidades
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="year" 
                stroke="#64748b" 
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#64748b" 
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar 
                dataKey={metricUnit} 
                fill="#2563eb" 
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-800">Evolución Mensual</h3>
              <div className="flex items-center gap-2">
                {/* Botón Agregar Mes */}
                {selectedComparisonMonths.length < 2 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMonthMenu(!showMonthMenu)}
                      className="text-xs border border-blue-600 text-blue-600 rounded px-3 py-1.5 hover:bg-blue-50 font-medium flex items-center gap-1"
                    >
                      + Agregar Mes
                    </button>
                    {showMonthMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20 max-h-64 overflow-y-auto">
                        {last12Months.map(month => {
                          const date = new Date(month + '-01')
                          const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                          const isSelected = selectedComparisonMonths.includes(month)
                          return (
                            <button
                              key={month}
                              onClick={() => {
                                if (isSelected) {
                                  const filtered = selectedComparisonMonths.filter(m => m !== month)
                                  setSelectedComparisonMonths(filtered.length > 0 ? filtered : [last12Months[last12Months.length - 1]])
                                } else if (selectedComparisonMonths.length < 2) {
                                  setSelectedComparisonMonths([...selectedComparisonMonths, month].sort())
                                }
                                setShowMonthMenu(false)
                              }}
                              className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-slate-50 ${
                                isSelected ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-700'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Selector de Categorías */}
                <div className="relative group">
                  <button className="text-xs border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1">
                    <span className="font-medium text-slate-700">Categorías</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </button>
                  <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-10 min-w-[160px]">
                    {categories.map(category => (
                      <label key={category} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, category])
                            } else {
                              const filtered = selectedCategories.filter(c => c !== category)
                              setSelectedCategories(filtered.length > 0 ? filtered : ['Total'])
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Pills de Meses Seleccionados */}
            <div className="flex flex-wrap gap-2">
              {selectedComparisonMonths.map((month, index) => {
                const date = new Date(month + '-01')
                const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                const color = index === 0 ? 'bg-blue-600' : 'bg-slate-400'
                return (
                  <div
                    key={month}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-white ${color}`}
                  >
                    <span>{label}</span>
                    <button
                      onClick={() => {
                        const filtered = selectedComparisonMonths.filter(m => m !== month)
                        setSelectedComparisonMonths(filtered.length > 0 ? filtered : [last12Months[last12Months.length - 1]])
                      }}
                      className="hover:opacity-75"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={selectedCategories.map(category => {
                const dataPoint: any = { category }
                selectedComparisonMonths.forEach((month, index) => {
                  const monthLabel = new Date(month + '-01').toLocaleDateString('es-AR', { month: 'short' })
                  dataPoint[monthLabel] = categoryData[month]?.[category] || 0
                })
                return dataPoint
              })}
              barSize={32}
              barGap={8}
              margin={{ left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis 
                dataKey="category" 
                stroke="#64748b" 
                style={{ fontSize: '11px' }}
                tickLine={false}
                interval={0}
              />
              <YAxis 
                stroke="#64748b" 
                style={{ fontSize: '11px' }}
                tickLine={false}
                tickCount={5}
                width={60}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  
                  const category = payload[0].payload.category
                  
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
                      <p className="text-sm font-semibold text-slate-900 mb-2">{category}</p>
                      {payload.map((entry: any, index: number) => {
                        const value = Number(entry.value) || 0
                        const color = index === 0 ? '#2563eb' : '#94a3b8'
                        
                        return (
                          <div key={entry.name} className="flex items-center gap-2 mb-1 last:mb-0">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }}></div>
                            <span className="text-xs text-slate-600">{entry.name}:</span>
                            <span className="text-sm font-bold" style={{ color }}>{value.toLocaleString()} m</span>
                          </div>
                        )
                      })}
                      {payload.length === 2 && (() => {
                        const currentValue = Number(payload[0].value) || 0
                        const previousValue = Number(payload[1].value) || 0
                        if (previousValue > 0) {
                          const percentChange = ((currentValue - previousValue) / previousValue * 100).toFixed(1)
                          return (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <p className={`text-xs font-medium ${
                                parseFloat(percentChange) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {parseFloat(percentChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(percentChange))}% vs anterior
                              </p>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )
                }}
              />
              {selectedComparisonMonths.map((month, index) => {
                const monthLabel = new Date(month + '-01').toLocaleDateString('es-AR', { month: 'short' })
                const color = index === 0 ? '#2563eb' : '#94a3b8'
                return (
                  <Bar
                    key={month}
                    dataKey={monthLabel}
                    fill={color}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  />
                )
              })}
            </BarChart>
          </ResponsiveContainer>
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
    </div>
  )
}
