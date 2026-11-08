'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { getPlantaOrderSync, type PlantaOrderSyncInfo } from '@/lib/planta-status'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Acciones de planta del pedido que no se registraron, y tablets con acciones suyas sin enviar. */
export async function getPlantaOrderSyncInfo(orderId: string): Promise<PlantaOrderSyncInfo> {
  await requireAdmin()
  if (!UUID_RE.test(orderId)) throw new Error('Pedido no válido')
  return getPlantaOrderSync(createAdminClient(), orderId)
}

/** El admin ya revisó una acción de planta rechazada. */
export async function acknowledgePlantaOperation(id: string) {
  const actor = await requireAdmin()
  if (!UUID_RE.test(id)) throw new Error('Operación no válida')
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('planta_operations')
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: actor.kind === 'admin' ? actor.userId : null })
    .eq('id', id)
    .eq('status', 'rejected')
  if (error) throw new Error('No se pudo marcar como revisada')
  return { success: true }
}
