'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getInventory() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .order('stock_disponible', { ascending: true })

  if (error) throw error
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

  revalidatePath('/admin/stock')
  return data
}

export async function adjustStock(productId: string, newQuantity: number, notes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: current } = await supabase
    .from('inventory')
    .select('stock_total')
    .eq('product_id', productId)
    .single()

  const stockBefore = current?.stock_total || 0

  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_total: newQuantity })
    .eq('product_id', productId)
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      movement_type: 'ajuste',
      quantity: newQuantity - stockBefore,
      stock_before: stockBefore,
      stock_after: newQuantity,
      user_id: user?.id,
      notes,
    })

  revalidatePath('/admin/stock')
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
