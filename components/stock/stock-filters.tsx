'use client'

import { useState } from 'react'
import { Search, Filter } from 'lucide-react'

interface StockFiltersProps {
  onFilterChange: (filters: { search: string; category: string; stockStatus: string }) => void
}

export function StockFilters({ onFilterChange }: StockFiltersProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('todas')
  const [selectedStockStatus, setSelectedStockStatus] = useState('todos')

  // Categorías basadas en los datos existentes
  const categories = [
    { value: 'todas', label: 'Todas las categorías' },
    { value: 'chapas', label: 'Chapas' }
  ]

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange({ search: value, category: selectedCategory, stockStatus: selectedStockStatus })
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    onFilterChange({ search, category: value, stockStatus: selectedStockStatus })
  }

  const handleStockStatusChange = (value: string) => {
    setSelectedStockStatus(value)
    onFilterChange({ search, category: selectedCategory, stockStatus: value })
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-900">Filtros</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Búsqueda por nombre/código */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Buscar producto
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, nombre o cliente..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filtro por categoría */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Categoría
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por estado de stock */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Estado de Stock
          </label>
          <select
            value={selectedStockStatus}
            onChange={(e) => handleStockStatusChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="sin_stock">🔴 Sin Stock</option>
            <option value="stock_bajo">🟡 Stock Bajo</option>
            <option value="disponible">🟢 Disponible</option>
          </select>
        </div>
      </div>

      {/* Indicador de filtros activos */}
      {(search || selectedCategory !== 'todas' || selectedStockStatus !== 'todos') && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-600">Filtros activos:</span>
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
              Búsqueda: "{search}"
              <button
                onClick={() => handleSearchChange('')}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          {selectedCategory !== 'todas' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
              {categories.find(c => c.value === selectedCategory)?.label}
              <button
                onClick={() => handleCategoryChange('todas')}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          {selectedStockStatus !== 'todos' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
              {selectedStockStatus === 'sin_stock' && '🔴 Sin Stock'}
              {selectedStockStatus === 'stock_bajo' && '🟡 Stock Bajo'}
              {selectedStockStatus === 'disponible' && '🟢 Disponible'}
              <button
                onClick={() => handleStockStatusChange('todos')}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
