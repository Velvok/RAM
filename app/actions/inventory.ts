'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidateInventory } from '@/lib/revalidate'

export async function getInventory() {
  const supabase = createAdminClient()

  // Primero obtener el total de productos para saber cuántos lotes necesitamos
  const { count, error: countError } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError
  const totalCount = count || 0
  console.log(`📊 Total inventory records: ${totalCount}`)

  // Traer datos por lotes de 1000 (límite de Supabase con joins)
  const batchSize = 1000
  const allData: any[] = []
  let offset = 0

  while (offset < totalCount) {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        *,
        product:products(
          id,
          code,
          name,
          category,
          unit,
          evo_product_id
        )
      `)
      .order('stock_disponible', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) throw error
    if (data && data.length > 0) {
      allData.push(...data)
      console.log(`📦 Batch ${Math.floor(offset / batchSize) + 1}: ${data.length} products`)
    }

    offset += batchSize
  }

  console.log(`📊 Inventory loaded: ${allData.length} products`)

  // NOTA: Consultas de pedidos relacionados desactivadas temporalmente
  // para evitar stack overflow con muchos productos
  // Se reactivará cuando sea necesario o se optimice la consulta
  
  const result = allData.map(item => ({
    ...item,
    related_orders: []
  }))
  console.log(`✅ Returning ${result.length} products to client`)
  return result
}

export async function getInventoryByProduct(productId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('inventory')
    .select(`
      *,
      product:products(
        id,
        code,
        name,
        category,
        unit,
        evo_product_id
      )
    `)
    .eq('product_id', productId)
    .single()

  if (error) throw error
  return data
}

export async function updateStock(productId: string, quantity: number, type: 'add' | 'subtract') {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: current } = await supabase
    .from('inventory')
    .select('stock_total')
    .eq('product_id', productId)
    .single()

  const stockBefore = current?.stock_total || 0
  const stockAfter = type === 'add' ? stockBefore + quantity : stockBefore - quantity

  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_total: stockAfter })
    .eq('product_id', productId)
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      movement_type: type === 'add' ? 'ingreso' : 'egreso',
      quantity: type === 'add' ? quantity : -quantity,
      stock_before: stockBefore,
      stock_after: stockAfter,
      user_id: user?.id,
    })

  // Revalidar inventario
  revalidateInventory()
  return data
}

export async function adjustStock(productId: string, newQuantity: number, notes: string) {
  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: current } = await supabase
    .from('inventory')
    .select('stock_total, stock_generado')
    .eq('product_id', productId)
    .single()

  const stockBefore = current?.stock_total || 0
  const generadoBefore = current?.stock_generado || 0
  const difference = newQuantity - stockBefore

  // Calcular nuevo stock_generado usando lógica FIFO
  let newGenerado = generadoBefore
  
  if (difference < 0) {
    // Si estamos REDUCIENDO stock, reducir primero del generado
    const quantityToReduce = Math.abs(difference)
    const reduceFromGenerated = Math.min(quantityToReduce, generadoBefore)
    newGenerado = generadoBefore - reduceFromGenerated
    
    console.log(`📊 Ajuste de stock (reducción):`)
    console.log(`   Stock total: ${stockBefore} → ${newQuantity}`)
    console.log(`   Stock generado: ${generadoBefore} → ${newGenerado}`)
    console.log(`   Reducido de generado: ${reduceFromGenerated}`)
  } else if (difference > 0) {
    // Si estamos AUMENTANDO stock, no tocar generado (es stock virgen)
    console.log(`📊 Ajuste de stock (aumento):`)
    console.log(`   Stock total: ${stockBefore} → ${newQuantity}`)
    console.log(`   Stock generado: ${generadoBefore} (sin cambios)`)
    console.log(`   Stock virgen añadido: ${difference}`)
  }

  const { data, error } = await supabase
    .from('inventory')
    .update({ 
      stock_total: newQuantity,
      stock_generado: newGenerado
    })
    .eq('product_id', productId)
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      movement_type: 'ajuste',
      quantity: difference,
      stock_before: stockBefore,
      stock_after: newQuantity,
      user_id: user?.id,
      notes: difference < 0 
        ? `${notes} (reducido ${Math.abs(difference)} unidades, ${Math.min(Math.abs(difference), generadoBefore)} de generado)`
        : `${notes} (añadido ${difference} unidades vírgenes)`,
    })

  // Revalidar inventario
  revalidateInventory()
  return data
}

export async function getRemnants() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('remnants')
    .select('*, product:products(*), cut_order:cut_orders(*)')
    .eq('status', 'disponible')
    .order('reuse_score', { ascending: false })

  if (error) throw error
  return data
}
