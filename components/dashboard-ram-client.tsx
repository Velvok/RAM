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
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'

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
    
    if (searchScope === 'stock') {
      return data.recentOrders
    }
    
    if (searchScope === 'pedidos') {
      return data.recentOrders.filter(p => 
        p.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pedido.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    const matchingProducto = data.stockProductos.find(sp => 
      sp.codigo.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (matchingProducto) {
      return data.recentOrders.filter(p => p.producto === matchingProducto.codigo)
    }
    
    return data.recentOrders.filter(p => 
      p.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pedido.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })()

  const filteredProductos = (() => {
    if (!searchQuery) return data.stockProductos
    
    if (searchScope === 'pedidos') {
      return data.stockProductos
    }
    
    if (searchScope === 'stock') {
      return data.stockProductos.filter(p => 
        p.codigo.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    const matchingCliente = data.recentOrders.find(pd => 
      pd.cliente.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (matchingCliente) {
      return data.stockProductos.filter(sp => 
        sp.clientes.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    return data.stockProductos.filter(p => 
      p.codigo.toLowerCase().includes(searchQuery.toLowerCase())
    )
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Últimos 6 Meses</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
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
              <Line 
                type="monotone" 
                dataKey={metricUnit} 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 4 }}
              />
            </LineChart>
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
                    className="absolute left-0 top-0 h-full bg-red-400 transition-all"
                    style={{ width: `${(producto.reservado / producto.total) * 100}%` }}
                  />
                  <div 
                    className="absolute h-full bg-green-400 transition-all"
                    style={{ 
                      left: `${(producto.reservado / producto.total) * 100}%`,
                      width: `${(producto.disponible / producto.total) * 100}%` 
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span className="text-slate-600">Reservado: {producto.reservado}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-slate-600">Disponible: {producto.disponible}</span>
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
    </div>
  )
}
