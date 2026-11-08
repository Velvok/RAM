import type { createAdminClient } from '@/lib/supabase/server'

// Lo que la oficina necesita saber de las tablets de planta: acciones que no
// se pudieron registrar al sincronizar, tablets sin conexión con acciones
// guardadas y resúmenes de lo que llegó tarde. Solo lo usa código de servidor
// que ya pasó requireAdmin().

type Supa = ReturnType<typeof createAdminClient>

/** Tablet sin latido desde hace más de esto = sin conexión. */
export const DEVICE_OFFLINE_MS = 3 * 60 * 1000
const MIN = 60 * 1000
/** Pasado esto sin noticias se da por apagada al terminar el turno y deja de avisar. */
const SHIFT_MS = 10 * 60 * MIN

export interface PlantaAlert {
  severity: 'alta' | 'media'
  orderId: string | null
  orderNumber: string
  text: string
  ageHours: number
}

export function horaAR(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = d.toDateString() === new Date().toDateString()
  return d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...(today ? {} : { day: '2-digit', month: '2-digit' }), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

export async function getPlantaAlerts(supabase: Supa, now = new Date()): Promise<PlantaAlert[]> {
  const since36h = new Date(now.getTime() - 36 * 60 * MIN).toISOString()
  const [rejRes, devRes] = await Promise.all([
    supabase
      .from('planta_operations')
      .select('id, order_id, operator_name, kind, payload, occurred_at, message, order:orders(order_number)')
      .eq('status', 'rejected')
      .is('acknowledged_at', null)
      .order('occurred_at', { ascending: false })
      .limit(50),
    supabase
      .from('planta_devices')
      .select('device_id, operator_name, last_seen_at, pending_ops, oldest_pending_at, last_offline_sync')
      .gte('last_seen_at', since36h),
  ])
  const out: PlantaAlert[] = []
  for (const r of (rejRes.data || []) as any[]) {
    out.push({
      severity: 'alta',
      orderId: r.order_id,
      orderNumber: r.order?.order_number || '',
      text: `planta (${r.operator_name || 'operario'}, ${horaAR(r.occurred_at)}): «${r.payload?.label || r.kind}» no se registró. ${r.message || ''}`.trim(),
      ageHours: (now.getTime() - Date.parse(r.occurred_at)) / (60 * MIN),
    })
  }
  for (const d of (devRes.data || []) as any[]) {
    // Sin latido: la tablet no tiene red (o se apagó). Lo que hagan sin conexión
    // no lo sabe el servidor hasta que vuelva, así que se avisa aunque no conste nada pendiente.
    const silentMs = now.getTime() - Date.parse(d.last_seen_at)
    if (silentMs > DEVICE_OFFLINE_MS && silentMs < SHIFT_MS) {
      out.push({
        severity: d.pending_ops > 0 ? 'alta' : 'media',
        orderId: null,
        orderNumber: 'Planta',
        text: d.pending_ops > 0
          ? `tablet de ${d.operator_name || 'planta'} sin conexión desde las ${horaAR(d.last_seen_at)}: ${d.pending_ops} acción(es) guardadas sin enviar (la primera de las ${horaAR(d.oldest_pending_at)})`
          : `tablet de ${d.operator_name || 'planta'} sin conexión (o apagada) desde las ${horaAR(d.last_seen_at)}: lo que corten o preparen se verá aquí al reconectarse`,
        ageHours: silentMs / (60 * MIN),
      })
    }
    const s = d.last_offline_sync
    if (s?.at && now.getTime() - Date.parse(s.at) < 12 * 60 * MIN && (s.applied || s.rejected)) {
      out.push({
        severity: 'media',
        orderId: null,
        orderNumber: 'Planta',
        text: `la tablet de ${d.operator_name || 'planta'} volvió a conectarse a las ${horaAR(s.at)} y envió ${s.applied} acción(es) hechas sin conexión${s.from ? ` (${horaAR(s.from)}–${horaAR(s.to)})` : ''}${s.rejected ? `; ${s.rejected} no se pudieron registrar` : ''}`,
        ageHours: 0,
      })
    }
  }
  return out
}

export interface PlantaOrderSyncInfo {
  rejected: { id: string; label: string; message: string; operatorName: string; occurredAt: string }[]
  pendingDevices: { operatorName: string; pendingOps: number; lastSeenAt: string; offline: boolean }[]
}

export async function getPlantaOrderSync(supabase: Supa, orderId: string): Promise<PlantaOrderSyncInfo> {
  const [rejRes, devRes] = await Promise.all([
    supabase
      .from('planta_operations')
      .select('id, kind, payload, message, operator_name, occurred_at')
      .eq('order_id', orderId)
      .eq('status', 'rejected')
      .is('acknowledged_at', null)
      .order('occurred_at', { ascending: false })
      .limit(20),
    supabase
      .from('planta_devices')
      .select('operator_name, pending_ops, last_seen_at')
      .contains('pending_order_ids', [orderId])
      .gt('pending_ops', 0),
  ])
  const now = Date.now()
  return {
    rejected: ((rejRes.data || []) as any[]).map(r => ({ id: r.id, label: r.payload?.label || r.kind, message: r.message || '', operatorName: r.operator_name || '', occurredAt: r.occurred_at })),
    pendingDevices: ((devRes.data || []) as any[]).map(d => ({ operatorName: d.operator_name || '', pendingOps: d.pending_ops, lastSeenAt: d.last_seen_at, offline: now - Date.parse(d.last_seen_at) > DEVICE_OFFLINE_MS })),
  }
}
