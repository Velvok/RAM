'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Pedidos de los que se pueden traer chapas ya cortadas del mismo producto
 * (paso "Reasignar" del detalle). Solo órdenes de corte con unidades cortadas
 * y sin entregar, de pedidos que no sean el actual.
 */
export async function getReassignmentSources(productCode: string, excludeOrderId: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: product } = await supabase.from('products').select('id').eq('code', productCode).maybeSingle()
  if (!product) return []

  const { data, error } = await supabase
    .from('cut_orders')
    .select(`
      id, status, quantity_requested, quantity_cut, quantity_delivered, material_base_id, updated_at,
      material_base:products!cut_orders_material_base_id_fkey(code),
      operator:users!cut_orders_assigned_to_fkey(full_name),
      order:orders!cut_orders_order_id_fkey(id, order_number, status, client:clients(business_name))
    `)
    .eq('product_id', product.id)
    .in('status', ['completada', 'pendiente'])
    .gt('quantity_cut', 0)
    .not('material_base_id', 'is', null)
    .neq('order_id', excludeOrderId)

  if (error) throw error

  return (data || [])
    .map((co: any) => {
      const order = Array.isArray(co.order) ? co.order[0] : co.order
      const client = Array.isArray(order?.client) ? order.client[0] : order?.client
      const available = Number(co.quantity_cut || 0) - Number(co.quantity_delivered || 0)
      return {
        cutOrderId: co.id as string,
        orderId: order?.id as string,
        orderNumber: order?.order_number as string,
        orderStatus: order?.status as string,
        client: client?.business_name || 'Sin cliente',
        available,
        requested: Number(co.quantity_requested || 0),
        material: (Array.isArray(co.material_base) ? co.material_base[0] : co.material_base)?.code || null,
        operator: (Array.isArray(co.operator) ? co.operator[0] : co.operator)?.full_name || null,
        updatedAt: co.updated_at as string,
      }
    })
    .filter(s => s.available > 0 && s.orderId && !['entregado', 'cancelado'].includes(s.orderStatus))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
}
