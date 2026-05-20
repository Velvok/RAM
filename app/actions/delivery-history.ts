'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function getDeliveryHistory(orderId: string) {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('delivery_history')
    .select(`
      *,
      orders(order_number)
    `)
    .eq('order_id', orderId)
    .order('delivered_at', { ascending: false })
  
  if (error) throw error
  
  // Para cada delivery, obtener la información de los productos
  const enrichedData = await Promise.all(
    (data || []).map(async (delivery) => {
      const enrichedItems = await Promise.all(
        (delivery.items_delivered || []).map(async (item: any) => {
          let productInfo = null
          
          if (item.cut_order_id) {
            const { data: cutOrder } = await supabase
              .from('cut_orders')
              .select('product:products(*)')
              .eq('id', item.cut_order_id)
              .single()
            
            if (cutOrder) {
              productInfo = cutOrder.product
            }
          } else if (item.preparation_item_id) {
            const { data: prepItem } = await supabase
              .from('preparation_items')
              .select('product:products(*)')
              .eq('id', item.preparation_item_id)
              .single()
            
            if (prepItem) {
              productInfo = prepItem.product
            }
          }
          
          return {
            ...item,
            product: productInfo
          }
        })
      )
      
      return {
        ...delivery,
        items_delivered: enrichedItems
      }
    })
  )
  
  return enrichedData
}
