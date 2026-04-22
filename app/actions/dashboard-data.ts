'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Server actions para datos del dashboard
 * Usan createAdminClient() para bypassear RLS
 */

export async function getDashboardData() {
  const supabase = createAdminClient()

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
  
  // Obtener pedidos de los últimos 12 meses con productos
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: monthlyOrders } = await supabase
    .from('orders')
    .select(`
      created_at,
      lines:order_lines(
        quantity,
        product:products(code, name)
      )
    `)
    .gte('created_at', twelveMonthsAgo.toISOString())
    .order('created_at', { ascending: true })
  
  // Obtener lista de todos los productos disponibles
  const { data: allProducts } = await supabase
    .from('products')
    .select('code, name')
    .order('code', { ascending: true })

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
    availableProducts: allProducts?.map(p => ({
      code: p.code,
      name: p.name
    })) || [],
    productMonthlyData: processProductMonthlyData(monthlyOrders || []),
    monthlyData: [], // Deprecated, usar productMonthlyData
    yearlyData: processYearlyData(yearlyOrders || [])
  }

  return dashboardData
}

export async function getAvailableOperators() {
  const supabase = createAdminClient()
  
  const { data } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  return data || []
}

export async function getAvailableOrdersForReassignment(productId: string, minLength?: number) {
  const supabase = createAdminClient()
  
  const { data } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      cut_orders!cut_orders_order_id_fkey(
        id,
        status,
        quantity_requested,
        quantity_cut,
        product:products(code, name)
      )
    `)
    .in('status', ['aprobado', 'en_corte'])
    .order('created_at', { ascending: false })

  // Filtrar por producto y longitud si se especifica
  const filteredOrders = data?.filter(order => {
    if (!order.cut_orders || order.cut_orders.length === 0) return false
    
    return order.cut_orders.some((cutOrder: any) => {
      const product = Array.isArray(cutOrder.product) ? cutOrder.product[0] : cutOrder.product
      const hasMatchingProduct = product?.code === productId
      const hasEnoughLength = !minLength || (cutOrder.quantity_cut || 0) >= minLength
      const isCompletedOrPartial = cutOrder.status === 'finalizado' || (cutOrder.quantity_cut || 0) > 0
      
      return hasMatchingProduct && hasEnoughLength && isCompletedOrPartial
    })
  })

  return filteredOrders || []
}

// ============================================
// Funciones auxiliares para procesar datos
// ============================================

function processProductMonthlyData(orders: any[]) {
  // Estructura: { productCode: { month: quantity } }
  const productMonthMap = new Map<string, Map<string, number>>()
  
  orders.forEach(order => {
    const date = new Date(order.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const lines = Array.isArray(order.lines) ? order.lines : []
    
    lines.forEach((line: any) => {
      const product = Array.isArray(line.product) ? line.product[0] : line.product
      const productCode = product?.code
      const quantity = line.quantity || 0
      
      if (!productCode) return
      
      if (!productMonthMap.has(productCode)) {
        productMonthMap.set(productCode, new Map())
      }
      
      const monthData = productMonthMap.get(productCode)!
      monthData.set(monthKey, (monthData.get(monthKey) || 0) + quantity)
    })
  })
  
  // Convertir a formato más amigable
  const result: Record<string, Array<{ month: string; quantity: number }>> = {}
  
  productMonthMap.forEach((monthData, productCode) => {
    result[productCode] = Array.from(monthData.entries())
      .map(([month, quantity]) => ({ month, quantity }))
      .sort((a, b) => a.month.localeCompare(b.month))
  })
  
  return result
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
