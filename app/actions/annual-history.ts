'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Interfaz para datos mensuales de historial
 */
export interface MonthlyData {
  month: number
  monthName: string
  purchases_kg: number
  sales_kg: number
  purchases_tons: number
  sales_tons: number
  purchases_units: number
  sales_units: number
}

/**
 * Interfaz para datos de producto con historial
 */
export interface ProductHistoryData {
  productId: string
  productName: string
  productCode: string
  category: string
  data: MonthlyData[]
}

/**
 * Nombres de meses en español
 */
const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
]

/**
 * Obtener historial anual para productos específicos
 */
export async function getAnnualHistory(
  year: number,
  productIds?: string[]
): Promise<ProductHistoryData[]> {
  const supabase = createAdminClient()

  // Si no se especifican productos, obtener los primeros 6 del historial
  let selectedProductIds = productIds

  if (!selectedProductIds || selectedProductIds.length === 0) {
    const { data: historyProds } = await supabase
      .from('annual_history')
      .select('product_id')
      .eq('year', year)
      .limit(6)

    const uniqueIds = [...new Set(historyProds?.map(p => p.product_id) || [])]

    if (uniqueIds.length === 0) {
      const { data: convProds } = await supabase
        .from('product_weight_conversions')
        .select('product_id')
        .limit(6)
      selectedProductIds = convProds?.map(p => p.product_id) || []
    } else {
      selectedProductIds = uniqueIds
    }
  }

  if (selectedProductIds.length === 0) {
    return []
  }

  // Obtener datos de historial para el año y productos seleccionados
  const { data: historyData, error: historyError } = await supabase
    .from('annual_history')
    .select(`
      product_id,
      month,
      purchases_kg,
      sales_kg,
      purchases_units,
      sales_units,
      product:products(id, code, name, category)
    `)
    .eq('year', year)
    .in('product_id', selectedProductIds)
    .order('month', { ascending: true })

  if (historyError) throw historyError

  // Agrupar datos por producto
  const productMap = new Map<string, ProductHistoryData>()

  const emptyMonths = () => Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: MONTH_NAMES[i],
    purchases_kg: 0,
    sales_kg: 0,
    purchases_tons: 0,
    sales_tons: 0,
    purchases_units: 0,
    sales_units: 0,
  }))

  historyData?.forEach((record: any) => {
    const productId = record.product_id
    const product = record.product

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        productName: product.name,
        productCode: product.code,
        category: product.category || 'general',
        data: emptyMonths()
      })
    }

    const productData = productMap.get(productId)!
    const monthIndex = record.month - 1

    if (monthIndex >= 0 && monthIndex < 12) {
      productData.data[monthIndex] = {
        month: record.month,
        monthName: MONTH_NAMES[monthIndex],
        purchases_kg: parseFloat(record.purchases_kg || 0),
        sales_kg: parseFloat(record.sales_kg || 0),
        purchases_tons: parseFloat(record.purchases_kg || 0) / 1000,
        sales_tons: parseFloat(record.sales_kg || 0) / 1000,
        purchases_units: record.purchases_units || 0,
        sales_units: record.sales_units || 0,
      }
    }
  })

  // Para productos sin historial, añadirlos con datos a cero
  const missingIds = selectedProductIds.filter(id => !productMap.has(id))
  if (missingIds.length > 0) {
    const { data: missingProducts } = await supabase
      .from('products')
      .select('id, code, name, category')
      .in('id', missingIds)

    missingProducts?.forEach(p => {
      productMap.set(p.id, {
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        category: p.category || 'general',
        data: emptyMonths()
      })
    })
  }

  // Mantener el orden de selectedProductIds
  return selectedProductIds
    .map(id => productMap.get(id))
    .filter(Boolean) as ProductHistoryData[]
}

/**
 * Obtener productos disponibles para el historial (todos los activos)
 */
export async function getProductsForHistory() {
  const supabase = createAdminClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, code, name, category')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error

  return (products || []).map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category || 'general'
  }))
}

/**
 * Obtener productos seleccionados por el usuario (guardados en BD)
 */
export async function getDefaultProducts() {
  const supabase = createAdminClient()

  // Obtener productos seleccionados de la tabla user_selected_products
  const { data: selected } = await supabase
    .from('user_selected_products')
    .select('product_id')
    .order('display_order', { ascending: true })

  if (selected && selected.length > 0) {
    const productIds = selected.map(s => s.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, code, name, category')
      .in('id', productIds)

    const orderedProducts = productIds
      .map(id => products?.find(p => p.id === id))
      .filter(Boolean)

    return orderedProducts.map(p => ({
      id: p!.id,
      code: p!.code,
      name: p!.name,
      category: p!.category || 'general'
    }))
  }

  // Fallback: primeros 6 productos que tienen historial
  const { data: historyProducts } = await supabase
    .from('annual_history')
    .select('product_id')
    .limit(6)

  const historyIds = [...new Set(historyProducts?.map(h => h.product_id) || [])].slice(0, 6)

  if (historyIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, code, name, category')
      .in('id', historyIds)

    return (products || []).map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category || 'general'
    }))
  }

  return []
}

/**
 * Actualizar productos seleccionados (guardar en BD)
 */
export async function updateSelectedProducts(productIds: string[]) {
  const supabase = createAdminClient()

  // Eliminar todos los productos seleccionados actuales
  const { error: deleteError } = await supabase
    .from('user_selected_products')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Eliminar todos

  if (deleteError) {
    console.error('Error eliminando productos seleccionados:', deleteError)
    throw deleteError
  }

  // Insertar nuevos productos seleccionados
  const newSelections = productIds.map((productId, index) => ({
    product_id: productId,
    display_order: index
  }))

  const { error: insertError } = await supabase
    .from('user_selected_products')
    .insert(newSelections)

  if (insertError) {
    console.error('Error insertando productos seleccionados:', insertError)
    throw insertError
  }

  return true
}

/**
 * Obtener años disponibles en el historial
 */
export async function getAvailableYears() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('annual_history')
    .select('year')
    .order('year', { ascending: false })

  if (error) throw error

  // Obtener años únicos
  const years = [...new Set(data?.map(item => item.year) || [])]
  
  return years
}
