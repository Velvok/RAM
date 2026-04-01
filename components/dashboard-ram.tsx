'use client'

import { useState, useEffect } from 'react'
import { 
  Package, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertTriangle,
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

export function DashboardRAM() {
  const [dolarData, setDolarData] = useState<DolarData | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [metricUnit, setMetricUnit] = useState<'metros' | 'unidades'>('metros')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'todo' | 'pedidos' | 'stock'>('todo')

  useEffect(() => {
    fetch('https://dolarapi.com/v1/dolares/mayorista')
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
      title: 'Órdenes Pendientes',
      value: '24',
      subtitle: '+3 desde ayer',
      color: 'text-slate-700'
    },
    {
      icon: TrendingUp,
      title: 'Despachos del Mes',
      value: metricUnit === 'metros' ? '12,450 m' : '8,320 u',
      subtitle: '+18% vs mes anterior',
      color: 'text-slate-700'
    },
    {
      icon: Clock,
      title: 'Pendientes de Entrega',
      value: metricUnit === 'metros' ? '3,280 m' : '2,150 u',
      subtitle: '12 órdenes en proceso',
      color: 'text-slate-700'
    }
  ]

  const yearlyData = [
    { year: '2020', metros: 45000, unidades: 32000 },
    { year: '2021', metros: 52000, unidades: 38000 },
    { year: '2022', metros: 61000, unidades: 44000 },
    { year: '2023', metros: 58000, unidades: 41000 },
    { year: '2024', metros: 68000, unidades: 49000 },
    { year: '2025', metros: 75000, unidades: 54000 },
  ]

  const monthlyData = [
    { month: 'Oct', metros: 5200, unidades: 3800 },
    { month: 'Nov', metros: 6100, unidades: 4400 },
    { month: 'Dic', metros: 5800, unidades: 4100 },
    { month: 'Ene', metros: 6800, unidades: 4900 },
    { month: 'Feb', metros: 7200, unidades: 5200 },
    { month: 'Mar', metros: 7500, unidades: 5400 },
  ]

  const stockData = [
    {
      documento: 'PED-2024-1847',
      metraje: '450 m',
      cliente: 'Metalúrgica San Martín S.A.',
      fecha: '15/03/2026',
      estado: 'Reservado'
    },
    {
      documento: 'PED-2024-1846',
      metraje: '1,200 m',
      cliente: 'Industrias del Norte',
      fecha: '14/03/2026',
      estado: 'Generado'
    },
    {
      documento: 'STK-TOTAL-001',
      metraje: '8,750 m',
      cliente: 'Stock General',
      fecha: '24/03/2026',
      estado: 'Stock Total'
    },
    {
      documento: 'PED-2024-1845',
      metraje: '680 m',
      cliente: 'Construcciones del Sur',
      fecha: '13/03/2026',
      estado: 'Disponible'
    },
    {
      documento: 'PED-2024-1844',
      metraje: '920 m',
      cliente: 'Aceros y Metales Ltda.',
      fecha: '12/03/2026',
      estado: 'Reservado'
    },
    {
      documento: 'PED-2024-1843',
      metraje: '1,500 m',
      cliente: 'Fabricaciones Industriales',
      fecha: '11/03/2026',
      estado: 'Generado'
    },
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

  // Datos mockeados para Últimos Pedidos (con campo producto para relación cruzada)
  // Estados reales de la DB: nuevo, aprobado, en_corte, finalizado, entregado, cancelado
  const pedidosData = [
    { pedido: 'PED-2024-1847', cliente: 'Metalúrgica San Martín S.A.', metraje: '450 m', fecha: '15/03/2026', estado: 'en_corte', producto: 'ZINC-ACAN-050' },
    { pedido: 'PED-2024-1846', cliente: 'Industrias del Norte', metraje: '1,200 m', fecha: '14/03/2026', estado: 'finalizado', producto: 'TRAPEZ-C-100' },
    { pedido: 'PED-2024-1845', cliente: 'Construcciones del Sur', metraje: '680 m', fecha: '13/03/2026', estado: 'aprobado', producto: 'CHAPA-LISA-060' },
    { pedido: 'PED-2024-1844', cliente: 'Aceros y Metales Ltda.', metraje: '920 m', fecha: '12/03/2026', estado: 'en_corte', producto: 'ZINC-ACAN-050' },
    { pedido: 'PED-2024-1843', cliente: 'Fabricaciones Industriales', metraje: '1,500 m', fecha: '11/03/2026', estado: 'entregado', producto: 'PERFIL-U-080' },
  ]

  // Datos mockeados para Stock por Producto (con campo clientes para relación cruzada)
  const stockProductos = [
    { codigo: 'ZINC-ACAN-050', total: 100, reservado: 30, disponible: 70, clientes: ['Metalúrgica San Martín S.A.', 'Aceros y Metales Ltda.'] },
    { codigo: 'TRAPEZ-C-100', total: 150, reservado: 45, disponible: 105, clientes: ['Industrias del Norte'] },
    { codigo: 'CHAPA-LISA-060', total: 200, reservado: 60, disponible: 140, clientes: ['Construcciones del Sur'] },
    { codigo: 'PERFIL-U-080', total: 80, reservado: 24, disponible: 56, clientes: ['Fabricaciones Industriales'] },
  ]

  // Lógica de filtrado según ámbito seleccionado
  const filteredPedidos = (() => {
    if (!searchQuery) return pedidosData
    
    if (searchScope === 'stock') {
      // Si busco en Stock, mostrar todos los pedidos
      return pedidosData
    }
    
    if (searchScope === 'pedidos') {
      // Buscar solo por cliente o pedido
      return pedidosData.filter(p => 
        p.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pedido.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Ámbito "Todo": Relación cruzada
    // Si coincide con un producto, filtrar pedidos de ese producto
    const matchingProducto = stockProductos.find(sp => 
      sp.codigo.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (matchingProducto) {
      return pedidosData.filter(p => p.producto === matchingProducto.codigo)
    }
    
    // Si coincide con un cliente, filtrar por cliente
    return pedidosData.filter(p => 
      p.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pedido.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })()

  const filteredProductos = (() => {
    if (!searchQuery) return stockProductos
    
    if (searchScope === 'pedidos') {
      // Si busco en Pedidos, mostrar todos los productos
      return stockProductos
    }
    
    if (searchScope === 'stock') {
      // Buscar solo por código de producto
      return stockProductos.filter(p => 
        p.codigo.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Ámbito "Todo": Relación cruzada
    // Si coincide con un cliente, filtrar productos de ese cliente
    const matchingCliente = pedidosData.find(pd => 
      pd.cliente.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (matchingCliente) {
      return stockProductos.filter(sp => 
        sp.clientes.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    // Si coincide con un producto, filtrar por código
    return stockProductos.filter(p => 
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
              <p className="text-sm font-medium text-slate-500 mb-2">Alertas de Stock</p>
              <p className="text-3xl font-bold text-slate-900 mb-1">7</p>
              <p className="text-xs text-blue-600">Productos bajo mínimo</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Evolución Anual</h3>
            <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setMetricUnit('metros')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricUnit === 'metros' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metros
              </button>
              <button
                onClick={() => setMetricUnit('unidades')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricUnit === 'unidades' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unidades
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="year" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey={metricUnit} 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Evolución Mensual</h3>
            <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setMetricUnit('metros')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricUnit === 'metros' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metros
              </button>
              <button
                onClick={() => setMetricUnit('unidades')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricUnit === 'unidades' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unidades
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }} 
              />
              <Bar 
                dataKey={metricUnit} 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Buscador Global con Selector de Ámbito */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Selector de Ámbito */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setSearchScope('todo')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                searchScope === 'todo' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todo
            </button>
            <button
              onClick={() => setSearchScope('pedidos')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                searchScope === 'pedidos' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pedidos
            </button>
            <button
              onClick={() => setSearchScope('stock')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                searchScope === 'stock' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock
            </button>
          </div>

          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={
                searchScope === 'todo' 
                  ? 'Buscar por cliente o código de producto...' 
                  : searchScope === 'pedidos'
                  ? 'Buscar por cliente o número de pedido...'
                  : 'Buscar por código de producto...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-lg pl-11 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Nueva estructura de grilla: Últimos Pedidos + Stock por Producto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Últimos Pedidos */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Últimos Pedidos</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Pedido #
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Metraje
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 text-sm text-slate-700">
                      {item.pedido}
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-900">
                      {item.cliente}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700">
                      {item.metraje}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700">
                      {item.fecha}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(item.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna Derecha: Stock por Producto */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Stock por Producto</h3>
          <div className="space-y-6">
            {filteredProductos.map((producto, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800">{producto.codigo}</span>
                  <span className="text-sm text-slate-600">{producto.total}m total</span>
                </div>
                
                {/* Barra Horizontal Segmentada (2 segmentos: Disponible + Reservado) */}
                <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
                  <div 
                    className="bg-blue-600" 
                    style={{ width: `${(producto.disponible / producto.total) * 100}%` }}
                  />
                  <div 
                    className="bg-slate-400" 
                    style={{ width: `${(producto.reservado / producto.total) * 100}%` }}
                  />
                </div>
                
                {/* Leyenda */}
                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                  <span>{producto.disponible}m Disponible</span>
                  <span>{producto.reservado}m Reservado</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
