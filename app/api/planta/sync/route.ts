import { NextResponse, type NextRequest } from 'next/server'
import { requireStaff } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { clampQuantity, parsePlantaOp, type PlantaOp, type PlantaOpResult } from '@/lib/planta-sync-core'
import { offlineNote } from '@/lib/planta-offline-time'
import { processCutOrder } from '@/app/actions/cut-operations'
import { prepareItem } from '@/app/actions/preparation'
import { confirmReassignmentPickup } from '@/app/actions/confirm-reassignment'
import { reassignStock } from '@/app/actions/reassign-stock'
import { createPlantaNote, markNoteAsRead } from '@/app/actions/order-notes'

// Sincronización de la tablet de planta. La tablet manda aquí, en orden, lo
// que hizo (con o sin conexión) y un latido con cuántas acciones le quedan.
// Cada operación lleva un op_id: si llega dos veces, se devuelve el resultado
// guardado y no se aplica de nuevo (ni se avisa dos veces a EVO).
// Es un route handler y no una server action para que siga funcionando con
// una tablet que se cargó con un despliegue anterior.

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_OPS = 50
const STUCK_MS = 5 * 60 * 1000
const CLOSED = ['cancelado', 'entregado']
const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Supa = ReturnType<typeof createAdminClient>

export async function POST(request: NextRequest) {
  // Solo desde la propia app (la cookie de sesión viaja sola en peticiones de otros sitios)
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })

  let actor
  try {
    actor = await requireStaff()
  } catch {
    return NextResponse.json({ error: 'Sesión de planta caducada. Vuelve a entrar con tu PIN.' }, { status: 401 })
  }
  if (actor.kind === 'system') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }
  const deviceId = String(body?.deviceId || '')
  if (!DEVICE_RE.test(deviceId)) return NextResponse.json({ error: 'Tablet no identificada' }, { status: 400 })
  const rawOps: unknown[] = Array.isArray(body?.ops) ? body.ops.slice(0, MAX_OPS) : []

  const supabase = createAdminClient()
  const actorId = actor.kind === 'operator' ? actor.operatorId : actor.userId
  const { data: actorRow } = await supabase.from('users').select('full_name').eq('id', actorId).maybeSingle()
  const actorName = actorRow?.full_name || (actor.kind === 'operator' ? 'Operario' : 'Admin')

  const results: PlantaOpResult[] = []
  const appliedLate: PlantaOp[] = []
  let rejectedLate = 0

  for (const raw of rawOps) {
    const parsed = parsePlantaOp(raw)
    if (!parsed.ok) {
      if (parsed.opId) results.push({ opId: parsed.opId, status: 'rejected', message: parsed.reason })
      continue
    }
    const { replay, ...res } = await applyOnce(supabase, parsed.op, { deviceId, actorId, actorName, actorKind: actor.kind })
    results.push(res)
    // Los reenvíos de algo ya recibido no cuentan como nuevas acciones sin conexión
    const late = !replay && Date.now() - Date.parse(parsed.op.occurredAt) > 2 * 60 * 1000
    if (late && res.status === 'applied') appliedLate.push(parsed.op)
    if (late && res.status === 'rejected') rejectedLate++
    // Si algo falla de forma transitoria, se para aquí para conservar el orden
    if (res.status === 'retry') break
  }

  // Latido de la tablet: última noticia y lo que le queda por enviar
  const done = results.filter(r => r.status !== 'retry').length
  const pendingBefore = Math.max(0, Number(body?.pending) || 0)
  const pendingAfter = Math.max(0, pendingBefore - done)
  const pendingOrderIds = (Array.isArray(body?.pendingOrderIds) ? body.pendingOrderIds : []).filter((x: unknown) => typeof x === 'string' && UUID_RE.test(x)).slice(0, 100)
  const oldest = Date.parse(body?.oldestPendingAt)
  const device: Record<string, unknown> = {
    device_id: deviceId,
    operator_id: actorId,
    operator_name: actorName,
    last_seen_at: new Date().toISOString(),
    pending_ops: pendingAfter,
    oldest_pending_at: pendingAfter && Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
    pending_order_ids: pendingAfter ? pendingOrderIds : [],
    user_agent: (request.headers.get('user-agent') || '').slice(0, 200),
  }
  if (results.length) device.last_sync_at = new Date().toISOString()
  if (appliedLate.length || rejectedLate) {
    const times = appliedLate.map(o => Date.parse(o.occurredAt)).sort((a, b) => a - b)
    device.last_offline_sync = {
      at: new Date().toISOString(),
      applied: appliedLate.length,
      rejected: rejectedLate,
      from: times.length ? new Date(times[0]).toISOString() : null,
      to: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    }
  }
  await supabase.from('planta_devices').upsert(device, { onConflict: 'device_id' })

  return NextResponse.json({ results, serverTime: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}

async function applyOnce(
  supabase: Supa,
  op: PlantaOp,
  ctx: { deviceId: string; actorId: string; actorName: string; actorKind: 'operator' | 'admin' },
): Promise<PlantaOpResult & { replay?: boolean }> {
  // Reservar el op_id: si ya existe, la operación ya llegó antes
  const { error: insErr } = await supabase.from('planta_operations').insert({
    op_id: op.opId,
    device_id: ctx.deviceId,
    operator_id: ctx.actorId,
    operator_name: ctx.actorName,
    kind: op.kind,
    order_id: op.orderId,
    payload: { ...op.payload, label: op.label },
    occurred_at: op.occurredAt,
    status: 'processing',
  })
  if (insErr) {
    if (insErr.code !== '23505') return { opId: op.opId, status: 'retry', message: 'No se pudo guardar la operación; se reintentará' }
    const { data: prev } = await supabase.from('planta_operations').select('status, message, received_at').eq('op_id', op.opId).maybeSingle()
    if (prev?.status === 'applied') return { opId: op.opId, status: 'applied', message: prev.message || undefined, replay: true }
    if (prev?.status === 'rejected') return { opId: op.opId, status: 'rejected', message: prev.message || 'Rechazada', replay: true }
    // Se quedó a medias (corte de red o error del servidor mientras se aplicaba):
    // no se reaplica para no duplicar; queda para que el admin lo revise.
    if (prev && Date.now() - Date.parse(prev.received_at) > STUCK_MS) {
      const message = 'Se interrumpió mientras se registraba. Revisa el pedido: puede que esté registrada o no.'
      await supabase.from('planta_operations').update({ status: 'rejected', message }).eq('op_id', op.opId)
      return { opId: op.opId, status: 'rejected', message }
    }
    return { opId: op.opId, status: 'retry', message: 'Registrándose…' }
  }

  let result: PlantaOpResult
  try {
    const message = await apply(supabase, op, ctx)
    result = { opId: op.opId, status: 'applied', message }
  } catch (e: any) {
    const message = String(e?.message || 'No se pudo registrar').slice(0, 300)
    result = { opId: op.opId, status: 'rejected', message }
  }
  await supabase.from('planta_operations').update({ status: result.status, message: result.message || null }).eq('op_id', op.opId)
  return result
}

/** Aplica una operación con las acciones de siempre. Devuelve un aviso si se aplicó a medias. */
async function apply(supabase: Supa, op: PlantaOp, ctx: { actorId: string; actorKind: 'operator' | 'admin' }): Promise<string | undefined> {
  const { data: order } = await supabase.from('orders').select('id, status, order_number').eq('id', op.orderId).maybeSingle()
  if (!order) throw new Error('El pedido ya no existe')
  if (op.kind !== 'note' && op.kind !== 'note_read' && CLOSED.includes(order.status)) {
    throw new Error(`El pedido ${order.order_number} está ${order.status === 'entregado' ? 'entregado' : 'cancelado'}: no se registró`)
  }

  switch (op.kind) {
    case 'cut': {
      const p = op.payload as PlantaOp<'cut'>['payload']
      const { data: cut } = await supabase.from('cut_orders').select('order_id, status, quantity_requested, quantity_cut').eq('id', p.cutOrderId).maybeSingle()
      if (!cut || cut.order_id !== op.orderId) throw new Error('Esa orden de corte ya no existe en el pedido (el admin la cambió)')
      if (cut.status === 'pendiente_confirmacion') throw new Error('Esa línea está pendiente de confirmar una recogida')
      const { apply: n, excess } = clampQuantity(Number(cut.quantity_requested), Number(cut.quantity_cut), p.quantity)
      if (n <= 0) throw new Error('Ya estaba cortado entero: no se registró otra vez')
      await processCutOrder({ cutOrderId: p.cutOrderId, selectedMaterialId: p.selectedMaterialId, materialLength: p.materialLength, quantityToCut: n, operatorId: ctx.actorId, occurredAt: op.occurredAt })
      return excess ? `Se registraron ${n} de ${p.quantity}: el resto ya estaba cortado` : undefined
    }
    case 'prepare': {
      const p = op.payload as PlantaOp<'prepare'>['payload']
      const { data: item } = await supabase.from('preparation_items').select('order_id, quantity_requested, quantity_prepared').eq('id', p.itemId).maybeSingle()
      if (!item || item.order_id !== op.orderId) throw new Error('Ese artículo ya no existe en el pedido (el admin lo cambió)')
      const { apply: n, excess } = clampQuantity(Number(item.quantity_requested), Number(item.quantity_prepared), p.quantity)
      if (n <= 0) throw new Error('Ya estaba preparado entero: no se registró otra vez')
      await prepareItem(p.itemId, n, ctx.actorId, op.occurredAt)
      return excess ? `Se registraron ${n} de ${p.quantity}: el resto ya estaba preparado` : undefined
    }
    case 'confirm_pickup': {
      const p = op.payload as PlantaOp<'confirm_pickup'>['payload']
      await confirmReassignmentPickup(p.cutOrderId, op.occurredAt)
      return undefined
    }
    case 'change_sheet': {
      const p = op.payload as PlantaOp<'change_sheet'>['payload']
      const res = await reassignStock(p.cutOrderId, p.inventoryId, p.productId, p.size, p.quantity)
      if (!res?.success) throw new Error('No se pudo cambiar la chapa')
      return undefined
    }
    case 'note': {
      const p = op.payload as PlantaOp<'note'>['payload']
      await createPlantaNote(op.orderId, `${p.content}${offlineNote(op.occurredAt)}`)
      return undefined
    }
    case 'note_read': {
      const p = op.payload as PlantaOp<'note_read'>['payload']
      await markNoteAsRead(p.noteId, p.operatorName)
      return undefined
    }
  }
}
