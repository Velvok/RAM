import { getDashboardData } from '@/app/actions/dashboard-data'
import { DashboardRAMClient } from '@/components/dashboard-ram-client'

export async function DashboardServer() {
  const dashboardData = await getDashboardData()
  return <DashboardRAMClient data={dashboardData} />
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
