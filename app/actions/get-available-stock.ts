'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { extractFamilyCode, extractSizeFromCode, isChapaProduct } from '@/lib/product-utils'

export async function getAvailableStock(productCode: string) {
  const supabase = createAdminClient()

  // Obtener el tamaño del producto solicitado usando el CÓDIGO
  const productSize = extractSizeFromCode(productCode)

  // Extraer el código de familia del CÓDIGO del producto
  const familyCode = extractFamilyCode(productCode)

  // Buscar TODO el stock disponible
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('id, product_id, stock_disponible, stock_reservado, stock_total')
    .gt('stock_disponible', 0)

  if (error) {
    console.error('Error en consulta inventory:', error)
    throw error
  }

  if (!inventory || inventory.length === 0) {
    return []
  }

  // Obtener los productos separadamente
  const productIds = inventory.map(item => item.product_id)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, code, name')
    .in('id', productIds)

  if (productsError) {
    console.error('Error obteniendo productos:', productsError)
    throw productsError
  }

  // Crear un mapa de productos por ID
  const productMap = new Map((products || []).map(p => [p.id, p]))

  // Filtrar por:
  // 1. Mismo tipo de producto (mismo código de familia)
  // 2. Tamaño >= solicitado
  const filtered = inventory
    .map(item => ({
      ...item,
      product: productMap.get(item.product_id)
    }))
    .filter(item => {
      const product = item.product
      if (!product) return false

      // Verificar que sea el mismo tipo de producto usando el código de familia
      const itemFamilyCode = extractFamilyCode(product.code || '')
      const isSameProduct = itemFamilyCode === familyCode

      // Verificar que sea de tamaño suficiente usando extractSizeFromCode
      const itemSize = extractSizeFromCode(product.code || '')
      const isSufficientSize = itemSize >= productSize

      return isSameProduct && isSufficientSize
    })
    .sort((a, b) => {
      const prodA = a.product
      const prodB = b.product

      // Ordenar por tamaño
      const sizeA = extractSizeFromCode(prodA?.code || '')
      const sizeB = extractSizeFromCode(prodB?.code || '')
      return sizeA - sizeB
    })

  return filtered
}
