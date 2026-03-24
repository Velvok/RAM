import { createClient } from '@/lib/supabase/server'
import { DashboardRAMClient } from '@/components/dashboard-ram-client'

export async function DashboardServer() {
  const supabase = await createClient()

  // ============================================
  // 1. KPIs - Métricas principales
  // ============================================
  
  // Contar pedidos por estado
  const { data: orderStats } = await supabase
    .from('orders')
    .select('status', { count: 'exact' })
  
  const pendingOrders = orderStats?.filter(o => 
    ['nuevo', 'aprobado'].includes(o.status)
  ).length || 0

  const inProductionOrders = orderStats?.filter(o => 
    o.status === 'en_corte'
  ).length || 0

  const pendingDeliveryOrders = orderStats?.filter(o => 
    o.status === 'finalizado'
  ).length || 0

  // ============================================
  // 2. Últimos Pedidos (Top 5)
  // ============================================
  
  const { data: recentOrders } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      created_at,
      client:clients(business_name),
      lines:order_lines(
        quantity,
        product:products(code, name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  // ============================================
  // 3. Stock por Producto (Top productos con stock)
  // ============================================
  
  const { data: stockData } = await supabase
    .from('inventory')
    .select(`
      stock_total,
      stock_reservado,
      stock_disponible,
      product:products(code, name)
    `)
    .order('stock_total', { ascending: false })
    .limit(10)

  // ============================================
  // 4. Datos para gráficos mensuales
  // ============================================
  
  // Obtener pedidos de los últimos 6 meses agrupados
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: monthlyOrders } = await supabase
    .from('orders')
    .select('created_at, lines:order_lines(quantity)')
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: true })

  // ============================================
  // 5. Datos para gráficos anuales
  // ============================================
  
  const { data: yearlyOrders } = await supabase
    .from('orders')
    .select('created_at, lines:order_lines(quantity)')
    .order('created_at', { ascending: true })

  // ============================================
  // Preparar datos para el componente cliente
  // ============================================

  const dashboardData = {
    kpis: {
      pendingOrders,
      inProductionOrders,
      pendingDeliveryOrders,
      totalOrders: orderStats?.length || 0
    },
    recentOrders: recentOrders?.map(order => {
      const client = Array.isArray(order.client) ? order.client[0] : order.client
      const lines = Array.isArray(order.lines) ? order.lines : []
      const firstProduct = lines[0] ? (Array.isArray(lines[0].product) ? lines[0].product[0] : lines[0].product) : null
      
      return {
        pedido: order.order_number,
        cliente: client?.business_name || 'Sin cliente',
        metraje: lines.reduce((sum, line) => sum + (line.quantity || 0), 0).toFixed(0) + ' m',
        fecha: new Date(order.created_at).toLocaleDateString('es-AR'),
        estado: order.status,
        producto: firstProduct?.code || 'N/A'
      }
    }) || [],
    stockProductos: stockData?.map(item => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      return {
        codigo: product?.code || 'N/A',
        total: item.stock_total || 0,
        reservado: item.stock_reservado || 0,
        disponible: item.stock_disponible || 0,
        clientes: [] // Se puede mejorar con una query adicional
      }
    }) || [],
    monthlyData: processMonthlyData(monthlyOrders || []),
    yearlyData: processYearlyData(yearlyOrders || [])
  }

  return <DashboardRAMClient data={dashboardData} />
}

// ============================================
// Funciones auxiliares para procesar datos
// ============================================

function processMonthlyData(orders: any[]) {
  const monthsMap = new Map<string, { metros: number; unidades: number }>()
  
  orders.forEach(order => {
    const date = new Date(order.created_at)
    const monthKey = date.toLocaleDateString('es-AR', { month: 'short' })
    const totalQuantity = order.lines?.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0) || 0
    
    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, { metros: 0, unidades: 0 })
    }
    
    const current = monthsMap.get(monthKey)!
    current.metros += totalQuantity
    current.unidades += order.lines?.length || 0
  })

  return Array.from(monthsMap.entries()).map(([month, data]) => ({
    month,
    metros: Math.round(data.metros),
    unidades: data.unidades
  })).slice(-6) // Últimos 6 meses
}

function processYearlyData(orders: any[]) {
  const yearsMap = new Map<string, { metros: number; unidades: number }>()
  
  orders.forEach(order => {
    const year = new Date(order.created_at).getFullYear().toString()
    const totalQuantity = order.lines?.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0) || 0
    
    if (!yearsMap.has(year)) {
      yearsMap.set(year, { metros: 0, unidades: 0 })
    }
    
    const current = yearsMap.get(year)!
    current.metros += totalQuantity
    current.unidades += order.lines?.length || 0
  })

  return Array.from(yearsMap.entries()).map(([year, data]) => ({
    year,
    metros: Math.round(data.metros),
    unidades: data.unidades
  })).slice(-6) // Últimos 6 años
}
