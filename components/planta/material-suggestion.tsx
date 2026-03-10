'use client'

import { useState, useEffect } from 'react'
import { getMaterialSuggestions, type MaterialSuggestion as MaterialSuggestionType } from '@/app/actions/material-suggestions'

interface MaterialSuggestionProps {
  cutOrder: {
    id: string
    product_id: string
    quantity_requested: number
    product?: {
      name: string
    }
  }
  onMaterialSelected: (material: MaterialSuggestionType) => void
}

export default function MaterialSuggestion({ 
  cutOrder,
  onMaterialSelected 
}: MaterialSuggestionProps) {
  const [suggestions, setSuggestions] = useState<any>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSuggestionType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSuggestions() {
      try {
        const result = await getMaterialSuggestions(
          cutOrder.product_id,
          cutOrder.quantity_requested
        )
        setSuggestions(result)
        if (result.best) {
          setSelectedMaterial(result.best)
          onMaterialSelected(result.best)
        }
      } catch (error) {
        console.error('Error loading suggestions:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSuggestions()
  }, [cutOrder.product_id, cutOrder.quantity_requested])

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-6 text-center">
        <div className="text-white">Buscando mejor material...</div>
      </div>
    )
  }

  if (!suggestions || suggestions.all.length === 0) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <div className="text-red-400 font-semibold">
          ⚠️ No hay material disponible para este corte
        </div>
        <p className="text-slate-400 text-sm mt-2">
          Contacta con el administrador para reabastecer stock
        </p>
      </div>
    )
  }

  const handleSelectMaterial = (material: MaterialSuggestionType) => {
    setSelectedMaterial(material)
    onMaterialSelected(material)
  }

  return (
    <div className="space-y-4">
      {/* Título del corte */}
      <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-blue-500">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✂️</span>
          <div>
            <h2 className="text-xl font-bold text-white">
              Cortar: {cutOrder.product?.name || 'Producto'}
            </h2>
            <p className="text-slate-400">
              Longitud necesaria: <span className="font-semibold text-white">{cutOrder.quantity_requested}m</span>
            </p>
          </div>
        </div>
      </div>

      {/* Sugerencia Principal */}
      {suggestions.best && (
        <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-2 border-blue-500 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl">💡</span>
            <h3 className="font-bold text-xl text-white">SUGERENCIA DEL SISTEMA</h3>
          </div>
          
          <div className="bg-slate-800/80 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {suggestions.best.type === 'remnant' ? '🔵' : '🟢'}
              </span>
              <div>
                <div className="font-bold text-lg text-white">{suggestions.best.name}</div>
                {suggestions.best.productName && (
                  <div className="text-sm text-slate-400">{suggestions.best.productName}</div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-slate-400 text-sm">Longitud disponible</div>
                <div className="font-bold text-xl text-white">{suggestions.best.length}m</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-slate-400 text-sm">Desperdicio</div>
                <div className="font-bold text-xl text-orange-400">
                  {suggestions.best.waste.toFixed(2)}m
                </div>
              </div>
              {suggestions.best.location && (
                <div className="col-span-2 bg-slate-700/50 rounded-lg p-3">
                  <div className="text-slate-400 text-sm">Ubicación</div>
                  <div className="font-semibold text-white">{suggestions.best.location}</div>
                </div>
              )}
            </div>

            <button
              onClick={() => handleSelectMaterial(suggestions.best)}
              className={`w-full mt-2 px-6 py-4 rounded-lg font-bold text-lg transition-all ${
                selectedMaterial?.id === suggestions.best.id
                  ? 'bg-green-600 text-white'
                  : 'bg-green-700 hover:bg-green-600 text-white'
              }`}
            >
              {selectedMaterial?.id === suggestions.best.id ? '✓ Material Seleccionado' : '✓ Usar Este Material'}
            </button>
          </div>
        </div>
      )}

      {/* Alternativas */}
      {suggestions.alternatives.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <span>📋</span>
            Alternativas disponibles:
          </h4>
          <ul className="space-y-2">
            {suggestions.alternatives.map((alt: MaterialSuggestionType) => (
              <li 
                key={alt.id} 
                className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3 text-sm hover:bg-slate-700/50 transition-colors cursor-pointer"
                onClick={() => handleSelectMaterial(alt)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{alt.type === 'remnant' ? '🔵' : '🟢'}</span>
                  <div>
                    <div className="text-white font-semibold">{alt.name}</div>
                    <div className="text-slate-400 text-xs">{alt.length}m disponible</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-orange-400 font-semibold">
                    {alt.waste.toFixed(2)}m desperdicio
                  </div>
                  {selectedMaterial?.id === alt.id && (
                    <div className="text-green-400 text-xs">✓ Seleccionado</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selección Manual */}
      <div className="bg-slate-800/50 rounded-lg p-4 border-t-2 border-slate-700">
        <label className="block font-semibold text-white mb-3 flex items-center gap-2">
          <span>✋</span>
          O selecciona manualmente:
        </label>
        <select 
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold"
          value={selectedMaterial?.id || ''}
          onChange={(e) => {
            const selected = suggestions.all.find((s: MaterialSuggestionType) => s.id === e.target.value)
            if (selected) handleSelectMaterial(selected)
          }}
        >
          <option value="">Seleccionar material...</option>
          {suggestions.all.map((s: MaterialSuggestionType) => (
            <option key={s.id} value={s.id}>
              {s.type === 'remnant' ? '🔵' : '🟢'} {s.name} - {s.length}m (desperdicio: {s.waste.toFixed(2)}m)
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
