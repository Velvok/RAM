'use server'

import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()

  // Si no se especifican productos, obtener los 6 con conversión de peso
  let selectedProductIds = productIds

  if (!selectedProductIds || selectedProductIds.length === 0) {
    const { data: defaultProducts } = await supabase
      .from('product_weight_conversions')
      .select('product_id')
      .limit(6)

    selectedProductIds = defaultProducts?.map(p => p.product_id) || []
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

  historyData?.forEach((record: any) => {
    const productId = record.product_id
    const product = record.product

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        productName: product.name,
        productCode: product.code,
        category: product.category || 'general',
        data: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          monthName: MONTH_NAMES[i],
          purchases_kg: 0,
          sales_kg: 0,
          purchases_tons: 0,
          sales_tons: 0,
          purchases_units: 0,
          sales_units: 0,
        }))
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

  return Array.from(productMap.values())
}

/**
 * Obtener productos disponibles para el historial
 */
export async function getProductsForHistory() {
  const supabase = await createClient()

  // Obtener IDs de productos con conversión
  const { data: conversions, error: convError } = await supabase
    .from('product_weight_conversions')
    .select('product_id')

  if (convError) {
    console.error('Error obteniendo conversiones:', convError)
    throw convError
  }

  if (!conversions || conversions.length === 0) {
    console.warn('No hay conversiones de peso configuradas')
    return []
  }

  const productIds = conversions.map(c => c.product_id)

  // Obtener productos
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, code, name, category')
    .in('id', productIds)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (prodError) {
    console.error('Error obteniendo productos:', prodError)
    throw prodError
  }

  return products?.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category || 'general'
  })) || []
}

/**
 * Obtener productos seleccionados por el usuario (guardados en BD)
 */
export async function getDefaultProducts() {
  const supabase = await createClient()

  // Obtener productos seleccionados de la tabla user_selected_products
  const { data: selected, error: selError } = await supabase
    .from('user_selected_products')
    .select('product_id')
    .order('display_order', { ascending: true })

  if (selError) {
    console.error('Error obteniendo productos seleccionados:', selError)
    throw selError
  }

  if (!selected || selected.length === 0) {
    return []
  }

  const productIds = selected.map(s => s.product_id)

  // Obtener detalles de los productos
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, code, name, category')
    .in('id', productIds)

  if (prodError) {
    console.error('Error obteniendo productos:', prodError)
    throw prodError
  }

  // Mantener el orden de display_order
  const orderedProducts = productIds.map(id => 
    products?.find(p => p.id === id)
  ).filter(Boolean)

  return orderedProducts.map(p => ({
    id: p!.id,
    code: p!.code,
    name: p!.name,
    category: p!.category || 'general'
  }))
}

/**
 * Actualizar productos seleccionados (guardar en BD)
 */
export async function updateSelectedProducts(productIds: string[]) {
  const supabase = await createClient()

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
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('annual_history')
    .select('year')
    .order('year', { ascending: false })

  if (error) throw error

  // Obtener años únicos
  const years = [...new Set(data?.map(item => item.year) || [])]
  
  return years
}
