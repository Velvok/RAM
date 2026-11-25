import { createAdminClient } from '@/lib/supabase/server'
import { extractFamilyCode, extractSizeFromCode } from '@/lib/product-utils'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export type MovementType = 'entrega' | 'compra' | 'corte' | 'remanente' | 'historico'

export interface MovementInput {
  productId: string
  type: MovementType
  units: number
  clientId?: string | null
  orderId?: string | null
  orderNumber?: string | null
  source: string
  sourceRef?: string | null
  occurredAt?: string
}

// Registra movimientos en product_movements (base del Historial anual).
// Nunca lanza: un fallo aquí no debe romper el flujo que lo llama.
// Todo en unidades; los metros (unidades × largo) quedan como dato auxiliar.
// La columna kg es del histórico antiguo y ya no se rellena.
export async function recordMovements(supabase: SupabaseAdmin, inputs: MovementInput[]) {
  const valid = inputs.filter(i => i.productId && i.units > 0)
  if (!valid.length) return
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, code, length_meters')
      .in('id', [...new Set(valid.map(i => i.productId))])
    const byId = new Map((products || []).map(p => [p.id, p]))
    const rows = valid.flatMap(i => {
      const p = byId.get(i.productId)
      if (!p) return []
      const length = Number(p.length_meters) || extractSizeFromCode(p.code) || 0
      const meters = i.units * length
      return [{
        product_id: i.productId,
        family_code: extractFamilyCode(p.code),
        length_m: length || null,
        movement_type: i.type,
        units: i.units,
        meters,
        client_id: i.clientId ?? null,
        order_id: i.orderId ?? null,
        order_number: i.orderNumber ?? null,
        source: i.source,
        source_ref: i.sourceRef ?? null,
        occurred_at: i.occurredAt ?? new Date().toISOString(),
      }]
    })
    if (!rows.length) return
    const { error } = await supabase.from('product_movements').upsert(rows, { onConflict: 'source,source_ref,product_id,movement_type', ignoreDuplicates: true })
    if (error) console.warn('⚠️ No se pudo registrar el movimiento en el historial:', error.message)
  } catch (e) {
    console.warn('⚠️ Error registrando movimientos en el historial:', e)
  }
}
