'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function getCutOrderWithAssignment(cutOrderId: string) {
  const supabase = createAdminClient()

  const { data: cutOrder, error } = await supabase
    .from('cut_orders')
    .select(`
      *,
      product:products!cut_orders_product_id_fkey(*),
      assigned_product:products!cut_orders_material_base_id_fkey(id, code, name)
    `)
    .eq('id', cutOrderId)
    .single()

  if (error) throw error

  // Buscar el inventory item del producto asignado
  // IMPORTANTE: material_base_id es un PRODUCT_ID
  let assignedInventory = null
  if (cutOrder?.material_base_id) {
    const { data: inventories, error: inventoryError } = await supabase
      .from('inventory')
      .select('*, product:products(*)')
      .eq('product_id', cutOrder.material_base_id)
      .gt('stock_disponible', 0)
      .limit(1)

    if (!inventoryError && inventories && inventories.length > 0) {
      assignedInventory = inventories[0]
    } else {
      console.warn('⚠️ No se encontró inventory disponible para material_base_id (product_id):', cutOrder.material_base_id, inventoryError)
    }
  }

  return { ...cutOrder, assigned_inventory: assignedInventory }
}
