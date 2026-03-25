'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { revalidateInventory } from '@/lib/revalidate'

export async function getInventory() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventory')
    .select(`
      *,
      product:products(*)
    `)
    .order('stock_disponible', { ascending: true })

  if (error) throw error

  // Para cada producto, obtener pedidos aprobados que lo incluyen
  if (data) {
    const inventoryWithOrders = await Promise.all(
      data.map(async (item) => {
        // Primero obtener order_lines del producto
        const { data: orderLines } = await supabase
          .from('order_lines')
          .select(`
            quantity,
            order_id
          `)
          .eq('product_id', item.product_id)

        if (!orderLines || orderLines.length === 0) {
          return {
            ...item,
            related_orders: []
          }
        }

        // Obtener los IDs de los pedidos
        const orderIds = orderLines.map(ol => ol.order_id)

        // Consultar los pedidos con sus clientes, filtrando por status
        // Incluir todos los estados excepto cancelado (pedidos activos que comprometen stock)
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            status,
            created_at,
            client:clients(
              name,
              business_name
            )
          `)
          .in('id', orderIds)
          .in('status', ['nuevo', 'aprobado', 'en_corte', 'en_proceso', 'finalizado'])
          .order('created_at', { ascending: false })

        // Combinar order_lines con orders
        const relatedOrders = orderLines
          .map(ol => {
            const order = orders?.find(o => o.id === ol.order_id)
            if (!order) return null
            return {
              quantity: ol.quantity,
              order: order
            }
          })
          .filter(Boolean)

        return {
          ...item,
          related_orders: relatedOrders
        }
      })
    )
    return inventoryWithOrders
  }

  return data
}

export async function getInventoryByProduct(productId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('product_id', productId)
    .single()

  if (error) throw error
  return data
}

export async function updateStock(productId: string, quantity: number, type: 'add' | 'subtract') {
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('remnants')
    .select('*, product:products(*), cut_order:cut_orders(*)')
    .eq('status', 'disponible')
    .order('reuse_score', { ascending: false })

  if (error) throw error
  return data
}
