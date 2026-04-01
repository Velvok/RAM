'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'

interface StockFiltersProps {
  onFilterChange: (filters: { search: string; categories: string[]; stockStatus: string }) => void
  availableCategories: string[]
  initialFilters?: { search?: string; categories?: string[]; stockStatus?: string }
}

export function StockFilters({ onFilterChange, availableCategories, initialFilters }: StockFiltersProps) {
  const [search, setSearch] = useState(initialFilters?.search || '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialFilters?.categories || [])
  const [selectedStockStatus, setSelectedStockStatus] = useState(initialFilters?.stockStatus || 'todos')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)

  // Expandir filtros automáticamente si hay filtros iniciales aplicados
  useEffect(() => {
    if (initialFilters?.stockStatus && initialFilters.stockStatus !== 'todos') {
      setIsFiltersExpanded(true)
    }
  }, [initialFilters])

  // Categorías dinámicas + opción "todas"
  const categories = [
    { value: 'todas', label: 'Todas' },
    ...availableCategories.map(cat => ({ value: cat, label: cat }))
  ]

  // Estados de stock
  const stockStatuses = [
    { value: 'todos', label: 'Todos', color: 'bg-slate-100 text-slate-700' },
    { value: 'sin_stock', label: 'Sin Stock', color: 'bg-red-100 text-red-700' },
    { value: 'stock_bajo', label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'disponible', label: 'Disponible', color: 'bg-green-100 text-green-700' }
  ]

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange({ search: value, categories: selectedCategories, stockStatus: selectedStockStatus })
  }

  const handleCategoryToggle = (category: string) => {
    if (category === 'todas') {
      setSelectedCategories([])
    } else {
      const newCategories = selectedCategories.includes(category)
        ? selectedCategories.filter(c => c !== category)
        : [...selectedCategories, category]
      setSelectedCategories(newCategories)
    }
  }

  const handleStockStatusChange = (value: string) => {
    setSelectedStockStatus(value)
    onFilterChange({ search, categories: selectedCategories, stockStatus: value })
  }

  // Actualizar filtros cuando cambian las categorías
  useEffect(() => {
    onFilterChange({ search, categories: selectedCategories, stockStatus: selectedStockStatus })
  }, [selectedCategories])

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Búsqueda siempre visible */}
      <div className="p-6 pb-4">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Buscar producto
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, nombre o cliente..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Botón para expandir filtros */}
      <div className="px-6 pb-4">
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filtros avanzados</span>
          {isFiltersExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Filtros desplegables */}
      {isFiltersExpanded && (
        <div className="border-t border-slate-200 p-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Filtros por categoría (múltiple selección) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Categorías
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCategoryToggle('todas')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 ${
                    selectedCategories.length === 0
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm'
                  }`}
                >
                  Todas
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryToggle(cat)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 ${
                      selectedCategories.includes(cat)
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <div className="mt-3 text-xs text-slate-600">
                  {selectedCategories.length} categor{selectedCategories.length === 1 ? 'ía' : 'ías'} seleccionada{selectedCategories.length === 1 ? '' : 's'}
                </div>
              )}
            </div>

            {/* Filtros por estado de stock */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Estado de Stock
              </label>
              <div className="flex flex-wrap gap-2">
                {stockStatuses.map(status => (
                  <button
                    key={status.value}
                    onClick={() => handleStockStatusChange(status.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 ${
                      selectedStockStatus === status.value
                        ? `${status.color} shadow-md`
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de filtros activos */}
      {(search || selectedCategories.length > 0 || selectedStockStatus !== 'todos') && (
        <div className="px-6 pb-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-700">Filtros activos:</span>
              {search && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  <Search className="w-3 h-3" />
                  Búsqueda: "{search}"
                  <button
                    onClick={() => handleSearchChange('')}
                    className="ml-1 hover:text-blue-900 transition-colors"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedCategories.length > 0 && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  <Filter className="w-3 h-3" />
                  {selectedCategories.length === 1 
                    ? selectedCategories[0] 
                    : `${selectedCategories.length} categorías`
                  }
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="ml-1 hover:text-blue-900 transition-colors"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedStockStatus !== 'todos' && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedStockStatus === 'sin_stock' ? 'bg-red-500' :
                    selectedStockStatus === 'stock_bajo' ? 'bg-yellow-500' :
                    selectedStockStatus === 'disponible' ? 'bg-green-500' : 'bg-slate-500'
                  }`} />
                  {stockStatuses.find(s => s.value === selectedStockStatus)?.label}
                  <button
                    onClick={() => handleStockStatusChange('todos')}
                    className="ml-1 hover:text-blue-900 transition-colors"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
