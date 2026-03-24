// Mock data para productividad de planta
// TODO: Reemplazar con datos reales de la tabla de operarios cuando esté disponible

export interface Operator {
  id: string
  name: string
  color: string
}

export interface CutRecord {
  date: string
  operator_id: string
  cuts: number
}

export const mockOperators: Operator[] = [
  { id: '1', name: 'Facundo Rossello', color: '#2563eb' }, // blue-600
  { id: '2', name: 'Guillermo Ramirez', color: '#60a5fa' }, // blue-400
  { id: '3', name: 'Alvaro Pons', color: '#cbd5e1' }, // slate-300
]

// Generar datos de cortes para los últimos 30 días
export function generateMockCutData(): CutRecord[] {
  const records: CutRecord[] = []
  const today = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    mockOperators.forEach(operator => {
      // Generar cantidad aleatoria de cortes (entre 5 y 25 por día)
      const cuts = Math.floor(Math.random() * 20) + 5
      records.push({
        date: dateStr,
        operator_id: operator.id,
        cuts
      })
    })
  }
  
  return records
}

// Obtener cortes del día actual
export function getTodayCuts(data: CutRecord[]): { total: number; byOperator: Record<string, number> } {
  const today = new Date().toISOString().split('T')[0]
  const todayRecords = data.filter(r => r.date === today)
  
  const byOperator: Record<string, number> = {}
  let total = 0
  
  todayRecords.forEach(record => {
    byOperator[record.operator_id] = (byOperator[record.operator_id] || 0) + record.cuts
    total += record.cuts
  })
  
  return { total, byOperator }
}

// Obtener operario del día (el que más cortes hizo hoy)
export function getTopOperatorToday(data: CutRecord[]): { operator: Operator; cuts: number } | null {
  const { byOperator } = getTodayCuts(data)
  
  let topOperatorId: string | null = null
  let maxCuts = 0
  
  Object.entries(byOperator).forEach(([operatorId, cuts]) => {
    if (cuts > maxCuts) {
      maxCuts = cuts
      topOperatorId = operatorId
    }
  })
  
  if (!topOperatorId) return null
  
  const operator = mockOperators.find(op => op.id === topOperatorId)
  return operator ? { operator, cuts: maxCuts } : null
}

// Agrupar datos por granularidad
export function aggregateByGranularity(
  data: CutRecord[],
  granularity: 'day' | 'week' | 'month',
  operatorId?: string
): Array<{ date: string; cuts: number }> {
  let filteredData = data
  
  if (operatorId && operatorId !== 'all') {
    filteredData = data.filter(r => r.operator_id === operatorId)
  }
  
  if (granularity === 'day') {
    // Agrupar por día
    const grouped: Record<string, number> = {}
    filteredData.forEach(record => {
      grouped[record.date] = (grouped[record.date] || 0) + record.cuts
    })
    
    return Object.entries(grouped)
      .map(([date, cuts]) => ({ date, cuts }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  
  if (granularity === 'week') {
    // Agrupar por semana
    const grouped: Record<string, number> = {}
    filteredData.forEach(record => {
      const date = new Date(record.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      
      grouped[weekKey] = (grouped[weekKey] || 0) + record.cuts
    })
    
    return Object.entries(grouped)
      .map(([date, cuts]) => ({ date, cuts }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  
  if (granularity === 'month') {
    // Agrupar por mes
    const grouped: Record<string, number> = {}
    filteredData.forEach(record => {
      const monthKey = record.date.substring(0, 7) // YYYY-MM
      grouped[monthKey] = (grouped[monthKey] || 0) + record.cuts
    })
    
    return Object.entries(grouped)
      .map(([date, cuts]) => ({ date, cuts }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  
  return []
}

// Obtener distribución de cortes por operario (para PieChart)
export function getCutDistribution(data: CutRecord[]): Array<{ name: string; value: number; color: string }> {
  const byOperator: Record<string, number> = {}
  
  data.forEach(record => {
    byOperator[record.operator_id] = (byOperator[record.operator_id] || 0) + record.cuts
  })
  
  return mockOperators.map(operator => ({
    name: operator.name,
    value: byOperator[operator.id] || 0,
    color: operator.color
  }))
}
