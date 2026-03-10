'use server'

import { createClient } from '@/lib/supabase/server'

export interface MaterialSuggestion {
  type: 'remnant' | 'virgin'
  id: string
  name: string
  length: number
  waste: number
  location: string | null
  priority: number
  quantity?: number
  productName?: string
}

export interface SuggestionsResult {
  best: MaterialSuggestion | null
  alternatives: MaterialSuggestion[]
  all: MaterialSuggestion[]
}

/**
 * Obtiene sugerencias de material para un corte
 * Prioriza recortes disponibles sobre chapas vírgenes
 * Ordena por menor desperdicio
 */
export async function getMaterialSuggestions(
  productId: string,
  lengthNeeded: number
): Promise<SuggestionsResult> {
  const supabase = await createClient()
  const suggestions: MaterialSuggestion[] = []

  // 1. Buscar recortes disponibles del mismo producto
  const { data: remnants, error: remnantsError } = await supabase
    .from('remnants')
    .select(`
      id,
      length,
      location,
      product:products(name)
    `)
    .eq('product_id', productId)
    .eq('status', 'disponible')
    .gte('length', lengthNeeded)
    .order('length', { ascending: true })

  if (!remnantsError && remnants) {
    for (const remnant of remnants) {
      const product = Array.isArray(remnant.product) ? remnant.product[0] : remnant.product
      suggestions.push({
        type: 'remnant',
        id: remnant.id,
        name: `Recorte #${remnant.id.slice(0, 8)}`,
        length: remnant.length,
        waste: remnant.length - lengthNeeded,
        location: remnant.location,
        priority: 1, // Recortes tienen máxima prioridad
        productName: product?.name || 'Producto desconocido',
      })
    }
  }

  // 2. Buscar chapas vírgenes disponibles en stock
  const { data: stockItems, error: stockError } = await supabase
    .from('stock_items')
    .select(`
      id,
      length,
      quantity,
      location,
      product:products(name, length_meters)
    `)
    .eq('product_id', productId)
    .gt('quantity', 0)
    .gte('length', lengthNeeded)
    .order('length', { ascending: true })

  if (!stockError && stockItems) {
    for (const item of stockItems) {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      suggestions.push({
        type: 'virgin',
        id: item.id,
        name: product?.name || 'Chapa virgen',
        length: item.length || product?.length_meters || 0,
        waste: (item.length || product?.length_meters || 0) - lengthNeeded,
        location: item.location,
        priority: 2, // Chapas vírgenes segunda prioridad
        quantity: item.quantity,
        productName: product?.name,
      })
    }
  }

  // 3. Ordenar por prioridad (recortes primero) y luego por menor desperdicio
  suggestions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.waste - b.waste
  })

  return {
    best: suggestions[0] || null,
    alternatives: suggestions.slice(1, 4), // Top 3 alternativas
    all: suggestions,
  }
}

/**
 * Registra el uso de un material (recorte o chapa virgen)
 */
export async function useMaterial(
  materialId: string,
  materialType: 'remnant' | 'virgin',
  cutOrderId: string,
  lengthUsed: number
) {
  const supabase = await createClient()

  if (materialType === 'remnant') {
    // Marcar recorte como consumido
    const { error } = await supabase
      .from('remnants')
      .update({ 
        status: 'consumido',
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)

    if (error) throw error

    // Registrar en historial (opcional, si tienes tabla de historial)
    // await supabase.from('material_usage_history').insert({...})

  } else if (materialType === 'virgin') {
    // Decrementar cantidad en stock_items
    const { data: stockItem, error: fetchError } = await supabase
      .from('stock_items')
      .select('quantity')
      .eq('id', materialId)
      .single()

    if (fetchError) throw fetchError

    const newQuantity = (stockItem.quantity || 0) - 1

    const { error: updateError } = await supabase
      .from('stock_items')
      .update({ 
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)

    if (updateError) throw updateError
  }

  return { success: true }
}
