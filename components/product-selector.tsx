'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Product {
  id: string
  code: string
  name: string
  category: string
}

interface ProductSelectorProps {
  availableProducts: Product[]
  selectedProducts: Product[]
  onSelectionChange: (products: Product[]) => void
}

export function ProductSelector({ 
  availableProducts, 
  selectedProducts,
  onSelectionChange 
}: ProductSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredProducts = availableProducts.filter(p => 
    !selectedProducts.find(sp => sp.id === p.id) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     p.code.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleAddProduct = (product: Product) => {
    if (selectedProducts.length < 6) {
      onSelectionChange([...selectedProducts, product])
      setSearchTerm('')
      setIsOpen(false)
    }
  }

  const handleRemoveProduct = (productId: string) => {
    onSelectionChange(selectedProducts.filter(p => p.id !== productId))
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      chapa: 'bg-blue-100 text-blue-700',
      alambre: 'bg-purple-100 text-purple-700',
      tejido: 'bg-green-100 text-green-700',
      poste: 'bg-orange-100 text-orange-700',
      malla: 'bg-pink-100 text-pink-700',
    }
    return colors[category] || 'bg-slate-100 text-slate-700'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Productos seleccionados ({selectedProducts.length}/6)
        </h3>
        {selectedProducts.length < 6 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            + Agregar producto
          </button>
        )}
      </div>

      {/* Productos seleccionados */}
      <div className="flex flex-wrap gap-2">
        {selectedProducts.map(product => (
          <div
            key={product.id}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg group hover:border-slate-300 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {product.name}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(product.category)}`}>
                  {product.category}
                </span>
              </div>
              <span className="text-xs text-slate-500">{product.code}</span>
            </div>
            <button
              onClick={() => handleRemoveProduct(product.id)}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Eliminar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Dropdown de búsqueda */}
      {isOpen && (
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            
            <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No hay productos disponibles
                </p>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500">{product.code}</div>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(product.category)}`}>
                        {product.category}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
