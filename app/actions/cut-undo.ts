'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidateOrders, revalidateStock } from '@/lib/revalidate'
import { notifyCorteRealizado, notifyChapaPreparada, processOnePendingPrep, type CorteMovimiento } from '@/lib/ram-outbound'
import { buildReversalMovimientos, evoActionFor, orderStatusAfterUndo, stockEffect, undoBlocker, type EvoAction } from '@/lib/cut-reversal'
import { updateOrderStatus } from './orders'
import { UserError } from '@/lib/user-error'

// Deshacer el último corte de una orden (corte registrado por error). Solo
// admins, desde el historial del pedido. La orden vuelve a su cantidad
// anterior y a EVO se le manda el evento inverso por la misma cola que el
// corte. La reserva no se toca (sigue en la chapa hasta la entrega) y el
// stock total lo corrige EVO con su stock_actualizado.

type SupabaseAdmin = ReturnType<typeof createAdminClient>

const num = (v: unknown) => Number(v) || 0
const FORWARD_EVENTS = ['corte_realizado', 'chapa_preparada']

export interface CutUndoInfo {
  cutOrderId: string
  quantity: number
  productName: string
  /** Motivo por el que no se puede deshacer; null si se puede */
  blocked: string | null
  before: string
  after: string
  orderStatus: string
  orderStatusAfter: string
  /** Qué se hace con EVO */
  evo: 'inverso' | 'descartar' | 'ninguno'
  /** Efecto en el stock de EVO al deshacer */
  stock: Array<{ name: string; delta: number }>
}

interface UndoContext {
  cutOrder: any
  order: any
  line: any
  event: any | null
  evoAction: EvoAction
  blocker: string | null
  nothingDoneAfter: boolean
}

async function loadUndoContext(supabase: SupabaseAdmin, cutOrderId: string): Promise<UndoContext | null> {
  const { data: cutOrder, error } = await supabase
    .from('cut_orders')
    .select(`
      id, order_id, status, quantity_requested, quantity_cut, quantity_delivered,
      reassigned_from_order_id, reassigned_from_cut_order_id,
      product:products!cut_orders_product_id_fkey(id, name, code),
      order:orders!cut_orders_order_id_fkey(id, order_number, status, status_before_modification)
    `)
    .eq('id', cutOrderId)
    .maybeSingle()
  if (error) throw new UserError('No se pudo leer la orden de corte')
  if (!cutOrder) return null
  const order: any = Array.isArray(cutOrder.order) ? cutOrder.order[0] : cutOrder.order

  const [linesRes, givenRes, siblingsRes, prepsRes] = await Promise.all([
    supabase.from('cut_lines').select('*').eq('cut_order_id', cutOrderId).is('reverted_at', null).order('created_at', { ascending: false }),
    supabase.from('cut_orders').select('id').eq('reassigned_from_cut_order_id', cutOrderId).limit(1),
    supabase.from('cut_orders').select('id, quantity_cut').eq('order_id', cutOrder.order_id),
    supabase.from('preparation_items').select('quantity_prepared').eq('order_id', cutOrder.order_id),
  ])
  if (linesRes.error) throw new UserError('No se pudieron leer los cortes de la orden')
  const lines = linesRes.data || []
  const line = lines[0]
  if (!line) return null

  // Evento del corte original: el enlazado o, en cortes anteriores a ese
  // enlace, el que se encoló justo después de registrar el corte
  let event: any = null
  if (line.outbound_event_id) {
    event = (await supabase.from('outbound_events').select('*').eq('id', line.outbound_event_id).maybeSingle()).data
  } else {
    const from = new Date(line.created_at).toISOString()
    const to = new Date(new Date(line.created_at).getTime() + 120_000).toISOString()
    const { data: candidates } = await supabase
      .from('outbound_events')
      .select('*')
      .eq('related_entity_id', cutOrderId)
      .in('event_type', FORWARD_EVENTS)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })
    event = (candidates || []).find(e => !String(e.payload?.id_evento || '').startsWith('rev_')) || null
  }

  const lineQuantity = num(line.quantity_produced)
  const blocker = undoBlocker({
    orderStatus: order?.status,
    cutOrder: cutOrder as any,
    lineQuantity,
    activeLinesTotal: lines.reduce((s, l) => s + num(l.quantity_produced), 0),
    givenToOthers: (givenRes.data || []).length > 0,
  })

  const cutsDoneAfter = (siblingsRes.data || []).reduce((s, c) => s + num(c.quantity_cut), 0) - lineQuantity
  const prepsDone = (prepsRes.data || []).reduce((s, p) => s + num(p.quantity_prepared), 0)

  return { cutOrder, order, line, event, evoAction: evoActionFor(event), blocker, nothingDoneAfter: cutsDoneAfter <= 0 && prepsDone <= 0 }
}

async function buildInfo(supabase: SupabaseAdmin, ctx: UndoContext): Promise<CutUndoInfo> {
  const { cutOrder, order, line, event, evoAction } = ctx
  const product: any = Array.isArray(cutOrder.product) ? cutOrder.product[0] : cutOrder.product
  const quantity = num(line.quantity_produced)
  const requested = num(cutOrder.quantity_requested)
  const cut = num(cutOrder.quantity_cut)

  // El stock de EVO solo cambia si hay que mandarle el inverso
  const movimientos: CorteMovimiento[] = evoAction.action === 'inverso' ? event?.payload?.movimientos || [] : []
  const effect = stockEffect(movimientos)
  let stock: CutUndoInfo['stock'] = []
  if (effect.length) {
    const { data: products } = await supabase
      .from('products')
      .select('name, evo_product_id')
      .in('evo_product_id', effect.map(e => e.id_articulo))
    const byEvo = new Map((products || []).map(p => [p.evo_product_id, p.name]))
    stock = effect.map(e => ({ name: byEvo.get(e.id_articulo) || e.id_articulo, delta: e.delta }))
  }

  return {
    cutOrderId: cutOrder.id,
    quantity,
    productName: product?.name || 'producto',
    blocked: ctx.blocker || (evoAction.action === 'bloqueado' ? evoAction.reason : null),
    before: `${cut}/${requested}`,
    after: `${cut - quantity}/${requested}`,
    orderStatus: order?.status,
    orderStatusAfter: orderStatusAfterUndo(order?.status, ctx.nothingDoneAfter),
    evo: evoAction.action === 'bloqueado' ? 'ninguno' : evoAction.action,
    stock,
  }
}

/** El corte del historial (cut_completed) vigente más reciente de cada orden de corte. */
function latestActiveCutActivity(logs: any[]): Map<string, any> {
  const out = new Map<string, any>()
  for (const a of logs) {
    if (a.activity_type !== 'cut_completed' || !a.cut_order_id || a.metadata?.reverted_at) continue
    const prev = out.get(a.cut_order_id)
    if (!prev || String(a.created_at) > String(prev.created_at)) out.set(a.cut_order_id, a)
  }
  return out
}

/**
 * Para el historial del pedido: qué cortes se pueden deshacer (por id de la
 * entrada del historial) y en qué estado está el aviso a EVO de los ya deshechos.
 */
export async function getCutUndoInfo(orderId: string): Promise<{
  undo: Record<string, CutUndoInfo>
  evoStatus: Record<string, 'pendiente' | 'confirmado' | 'error' | 'no_hizo_falta'>
}> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: logs } = await supabase
    .from('order_activity_log')
    .select('id, activity_type, cut_order_id, metadata, created_at')
    .eq('order_id', orderId)
    .in('activity_type', ['cut_completed', 'cut_reverted'])

  const undo: Record<string, CutUndoInfo> = {}
  for (const [cutOrderId, activity] of latestActiveCutActivity(logs || [])) {
    const ctx = await loadUndoContext(supabase, cutOrderId)
    if (ctx) undo[activity.id] = await buildInfo(supabase, ctx)
  }

  const evoStatus: Record<string, 'pendiente' | 'confirmado' | 'error' | 'no_hizo_falta'> = {}
  const reverted = (logs || []).filter(a => a.activity_type === 'cut_reverted')
  const eventIds = reverted.map(a => a.metadata?.reversal_event_id).filter(Boolean)
  const { data: events } = eventIds.length
    ? await supabase.from('outbound_events').select('id, status').in('id', eventIds)
    : { data: [] as any[] }
  const statusById = new Map((events || []).map(e => [e.id, e.status]))
  for (const a of reverted) {
    const status = a.metadata?.reversal_event_id ? statusById.get(a.metadata.reversal_event_id) : null
    evoStatus[a.id] = !a.metadata?.reversal_event_id ? 'no_hizo_falta'
      : status === 'success' ? 'confirmado'
      : status === 'pending' || status === 'processing' ? 'pendiente'
      : 'error'
  }

  return { undo, evoStatus }
}

/** Deshace el último corte vigente de una orden de corte. */
export async function undoLastCut(cutOrderId: string, reason?: string) {
  const actor = await requireAdmin()
  const supabase = createAdminClient()
  const userId = actor.kind === 'admin' ? actor.userId : null
  const cleanReason = (reason || '').trim().slice(0, 300) || null

  const ctx = await loadUndoContext(supabase, cutOrderId)
  if (!ctx) throw new UserError('Esta orden no tiene ningún corte que deshacer')
  if (ctx.blocker) throw new UserError(ctx.blocker)
  if (ctx.evoAction.action === 'bloqueado') throw new UserError(ctx.evoAction.reason)
  const { cutOrder, order, line, event, evoAction } = ctx
  const product: any = Array.isArray(cutOrder.product) ? cutOrder.product[0] : cutOrder.product
  const quantity = num(line.quantity_produced)
  const cutBefore = num(cutOrder.quantity_cut)
  const now = new Date().toISOString()

  // 1. La llave: solo sigue quien consigue marcar el corte como deshecho
  //    (dos clics o dos personas a la vez no lo deshacen dos veces)
  const { data: claimed, error: claimError } = await supabase
    .from('cut_lines')
    .update({ reverted_at: now, reverted_by: userId, revert_reason: cleanReason })
    .eq('id', line.id)
    .is('reverted_at', null)
    .select('id')
  if (claimError) throw new UserError('No se pudo deshacer el corte')
  if (!claimed?.length) throw new UserError('Este corte ya se había deshecho. Recarga la página.')
  const release = () => supabase.from('cut_lines').update({ reverted_at: null, reverted_by: null, revert_reason: null }).eq('id', line.id)

  // 2. EVO: descartar el evento que no llegó a aplicarse, o mandar el inverso
  let reversalEventId: string | null = null
  try {
    if (evoAction.action === 'descartar') {
      const { data: discarded } = await supabase
        .from('outbound_events')
        .update({ status: 'cancelled', error_message: 'Descartado: corte deshecho en RAM', completed_at: now, updated_at: now })
        .eq('id', event.id)
        .eq('status', event.status)
        .select('id')
      if (!discarded?.length) throw new UserError('El aviso de este corte a EVO acaba de cambiar de estado. Vuelve a intentarlo en unos segundos.')
    } else if (evoAction.action === 'inverso') {
      const payload = event.payload || {}
      const params = {
        cutOrderId,
        orderId: cutOrder.order_id,
        idPedido: payload.id_pedido,
        refEvo: payload.ref_evo,
        operario: payload.operario,
        movimientos: buildReversalMovimientos(payload.movimientos || []),
      }
      reversalEventId = event.event_type === 'chapa_preparada'
        ? await notifyChapaPreparada(params)
        : await notifyCorteRealizado(params)
    }
  } catch (e) {
    await release()
    throw e instanceof Error ? e : new Error('No se pudo avisar a EVO; el corte no se ha deshecho')
  }

  // 3. La orden vuelve a su cantidad anterior y reaparece en planta
  const cutAfter = Math.max(0, cutBefore - quantity)
  const stillComplete = cutAfter >= num(cutOrder.quantity_requested)
  const { error: updateError } = await supabase
    .from('cut_orders')
    .update({ quantity_cut: cutAfter, status: stillComplete ? 'completada' : 'pendiente', ...(stillComplete ? {} : { finished_at: null }) })
    .eq('id', cutOrderId)
  if (updateError) {
    // El inverso ya está en cola: se deja constancia para arreglarlo a mano
    console.error('❌ Corte deshecho en EVO pero no en la orden de corte:', cutOrderId, updateError.message)
    throw new UserError('Se avisó a EVO pero no se pudo actualizar la orden de corte. Avisa a soporte.')
  }
  if (reversalEventId) await supabase.from('cut_lines').update({ reversal_event_id: reversalEventId }).eq('id', line.id)

  // 4. Historial de movimientos: el corte y su remanente dejan de contar (y
  //    así el corte correcto que se haga después vuelve a registrarse)
  await supabase.from('product_movements').delete().eq('source', 'corte').eq('source_ref', `${cutOrderId}:${cutBefore}`)

  // 5. Historial del pedido: marcar el corte como deshecho y dejar constancia
  const { data: logs } = await supabase
    .from('order_activity_log')
    .select('id, activity_type, cut_order_id, metadata, created_at')
    .eq('cut_order_id', cutOrderId)
    .eq('activity_type', 'cut_completed')
  const activity = latestActiveCutActivity(logs || []).get(cutOrderId)
  if (activity) {
    await supabase.from('order_activity_log').update({ metadata: { ...(activity.metadata || {}), reverted_at: now } }).eq('id', activity.id)
  }
  const { data: who } = userId ? await supabase.from('users').select('full_name, email').eq('id', userId).maybeSingle() : { data: null }
  // user_id de este log apunta a auth.users (no a users): quién lo hizo va en el texto
  await supabase.from('order_activity_log').insert({
    order_id: cutOrder.order_id,
    cut_order_id: cutOrderId,
    activity_type: 'cut_reverted',
    description: `${who?.full_name || who?.email || 'Un administrador'} deshizo el corte de ${quantity} unidad${quantity !== 1 ? 'es' : ''} de ${product?.name || 'producto'} (${cutAfter}/${num(cutOrder.quantity_requested)})`,
    metadata: {
      cut_line_id: line.id,
      reverted_activity_id: activity?.id ?? null,
      quantity,
      reason: cleanReason,
      evo_action: evoAction.action,
      original_event_id: event?.id ?? null,
      reversal_event_id: reversalEventId,
    },
  })

  // 6. Estado del pedido. updateOrderStatus nunca devuelve un pedido a
  //    «aprobado»: si ya no queda nada hecho, se hace aquí.
  await updateOrderStatus(cutOrder.order_id)
  if (ctx.nothingDoneAfter) {
    if (order?.status === 'modificado') {
      await supabase.from('orders').update({ status_before_modification: 'aprobado' }).eq('id', cutOrder.order_id).eq('status', 'modificado').eq('status_before_modification', 'en_corte')
    } else {
      await supabase.from('orders').update({ status: 'aprobado' }).eq('id', cutOrder.order_id).eq('status', 'en_corte')
    }
  }

  revalidateOrders(cutOrder.order_id)
  revalidateStock()
  return { success: true, quantity, cutAfter, evo: evoAction.action, reversalEventId }
}

/**
 * Empuja la cola hacia EVO. La cola solo manda un evento cada vez que algo la
 * dispara (otro envío o una confirmación de EVO), así que el aviso de un corte
 * deshecho puede quedarse esperando detrás de otro. El historial llama a esto
 * mientras tiene un aviso pendiente. Respeta el lock y el «uno a la vez».
 */
export async function nudgeOutboundQueue() {
  await requireAdmin()
  await processOnePendingPrep()
  return { success: true }
}
