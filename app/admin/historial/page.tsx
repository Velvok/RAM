'use client'

import { useEffect, useState } from 'react'
import { AnnualChart } from '@/components/annual-chart'
import { ProductSelector } from '@/components/product-selector'
import { getAnnualHistory, getDefaultProducts, getProductsForHistory, getAvailableYears, updateSelectedProducts, ProductHistoryData } from '@/app/actions/annual-history'
import { BarChart3, Calendar, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoader } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  code: string
  name: string
  category: string
}

export default function HistorialAnualPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [historyData, setHistoryData] = useState<ProductHistoryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'purchases' | 'sales'>('purchases')

  // Cargar datos iniciales
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true)
        
        // Cargar años disponibles
        const years = await getAvailableYears()
        setAvailableYears(years)
        
        // Cargar productos disponibles
        const products = await getProductsForHistory()
        setAvailableProducts(products as Product[])
        
        // Cargar productos por defecto (primeros 6)
        const defaultProds = await getDefaultProducts()
        setSelectedProducts(defaultProds as Product[])
        
        // Cargar datos de historial
        const history = await getAnnualHistory(
          selectedYear,
          defaultProds.map(p => p.id)
        )
        setHistoryData(history)
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  // Recargar datos cuando cambia el año o productos seleccionados
  useEffect(() => {
    async function loadHistory() {
      if (selectedProducts.length === 0) {
        setHistoryData([])
        return
      }

      try {
        const history = await getAnnualHistory(
          selectedYear,
          selectedProducts.map(p => p.id)
        )
        setHistoryData(history)
      } catch (error) {
        console.error('Error cargando historial:', error)
      }
    }

    if (!isLoading) {
      loadHistory()
    }
  }, [selectedYear, selectedProducts, isLoading])

  const handleProductSelectionChange = async (products: Product[]) => {
    setSelectedProducts(products)
    
    // Guardar selección en la base de datos
    try {
      await updateSelectedProducts(products.map(p => p.id))
    } catch (error) {
      console.error('Error guardando productos seleccionados:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PageLoader label="Cargando historial anual..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-info" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Historial Anual</h1>
              <p className="text-muted-foreground mt-1">Análisis de compras y ventas por producto</p>
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-4">
          {/* Toggle de vista */}
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('purchases')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'purchases' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Compras
            </button>
            <button
              onClick={() => setViewMode('sales')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'sales' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Ventas
            </button>
          </div>

          {/* Selector de año */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-input rounded-lg text-sm font-medium text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selector de productos */}
      <div className="bg-muted rounded-lg p-6 border border-border">
        <ProductSelector
          availableProducts={availableProducts}
          selectedProducts={selectedProducts}
          onSelectionChange={handleProductSelectionChange}
        />
      </div>

      {/* Gráficas */}
      {historyData.length === 0 ? (
        <Card className="p-12">
          <EmptyState icon={BarChart3} title="No hay datos disponibles" description="Selecciona productos para ver su historial anual" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {historyData.map((productData) => (
            <AnnualChart
              key={productData.productId}
              productName={productData.productName}
              productCode={productData.productCode}
              data={productData.data}
              showPurchases={viewMode === 'purchases'}
              showSales={viewMode === 'sales'}
            />
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="bg-info/5 border border-info/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-info/10 rounded">
            <Info className="w-4 h-4 text-info" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-info mb-1">
              Información sobre los datos
            </h4>
            <p className="text-sm text-info/90">
              Los datos se actualizan automáticamente cuando un pedido es marcado como entregado.
              Las conversiones de peso se calculan según las configuraciones de cada producto.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
