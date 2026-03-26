'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { MonthlyData } from '@/app/actions/annual-history'

interface AnnualChartProps {
  productName: string
  productCode: string
  data: MonthlyData[]
  showPurchases?: boolean
  showSales?: boolean
}

export function AnnualChart({ 
  productName, 
  productCode, 
  data,
  showPurchases = true,
  showSales = true
}: AnnualChartProps) {
  // Tooltip personalizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600">{entry.name}:</span>
              <span className="font-semibold text-slate-900">
                {entry.value.toFixed(2)} ton
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{productName}</h3>
        <p className="text-sm text-slate-500">{productCode}</p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="monthName" 
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
            label={{ 
              value: 'Toneladas', 
              angle: -90, 
              position: 'insideLeft',
              style: { fill: '#64748b', fontSize: 12 }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="rect"
            formatter={(value) => <span className="text-sm text-slate-700">{value}</span>}
          />
          {showPurchases && (
            <Bar 
              dataKey="purchases_tons" 
              name="Compras" 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]}
            />
          )}
          {showSales && (
            <Bar 
              dataKey="sales_tons" 
              name="Ventas" 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
