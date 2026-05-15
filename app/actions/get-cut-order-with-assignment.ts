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
  let assignedInventory = null
  if (cutOrder?.material_base_id) {
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('*, product:products(*)')
      .eq('product_id', cutOrder.material_base_id)
      .single()

    if (!inventoryError) {
      assignedInventory = inventory
    }
  }

  return { ...cutOrder, assigned_inventory: assignedInventory }
}
