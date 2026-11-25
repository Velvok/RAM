// Lógica pura de «deshacer un corte» (sin base de datos, con tests).
//
// Un corte registrado por error se deshace mandando a EVO el evento inverso
// por la misma cola y el mismo endpoint que el corte original, y devolviendo
// la orden de corte a su cantidad anterior. Aquí se decide qué mandar a EVO,
// si se puede deshacer y en qué estado queda el pedido.

import type { CorteMovimiento } from '@/lib/ram-outbound'

/**
 * Cómo se invierte un corte real (BAJA/ALTA) hacia EVO:
 * - 'negativo': los mismos movimientos con la cantidad en negativo, igual que
 *   el PREP −n que ya se envía en las reasignaciones.
 * - 'intercambio': BAJA↔ALTA con la cantidad en positivo.
 * El PREP siempre se invierte en negativo (no tiene tipo contrario).
 */
export type ReversalMode = 'negativo' | 'intercambio'
export const REVERSAL_MODE: ReversalMode = 'negativo'

/** Movimientos que anulan los de un evento ya enviado a EVO. */
export function buildReversalMovimientos(original: CorteMovimiento[], mode: ReversalMode = REVERSAL_MODE): CorteMovimiento[] {
  return original.map(m => {
    if (m.tipo === 'PREP' || mode === 'negativo') return { ...m, cantidad: -m.cantidad }
    return { ...m, tipo: m.tipo === 'BAJA' ? 'ALTA' : 'BAJA' }
  })
}

/** Efecto neto en el stock de cada artículo al deshacer (para enseñarlo antes de confirmar). */
export function stockEffect(original: CorteMovimiento[]): Array<{ id_articulo: string; delta: number }> {
  const out = new Map<string, number>()
  for (const m of original) {
    // Un PREP no mueve stock en EVO: marca la línea del pedido como preparada
    if (m.tipo === 'PREP') continue
    const applied = m.tipo === 'ALTA' ? m.cantidad : -m.cantidad
    out.set(m.id_articulo, (out.get(m.id_articulo) || 0) - applied)
  }
  return [...out].filter(([, delta]) => delta !== 0).map(([id_articulo, delta]) => ({ id_articulo, delta }))
}

export interface OriginalEvent {
  status: string
  http_status?: number | null
  response_body?: any
}

/**
 * Qué hacer con EVO según cómo quedó el evento del corte original:
 * - 'ninguno': EVO nunca supo del corte (no se notificó o ya se descartó).
 * - 'descartar': el evento no llegó a aplicarse en EVO; basta con anularlo.
 * - 'inverso': EVO lo confirmó; hay que mandar el evento inverso.
 * - 'bloqueado': no se sabe todavía si EVO lo aplicó; no se puede deshacer aún.
 */
export type EvoAction =
  | { action: 'ninguno' }
  | { action: 'descartar' }
  | { action: 'inverso' }
  | { action: 'bloqueado'; reason: string }

export function evoActionFor(event: OriginalEvent | null | undefined): EvoAction {
  if (!event) return { action: 'ninguno' }
  switch (event.status) {
    case 'cancelled':
      return { action: 'ninguno' }
    case 'pending':
      return { action: 'descartar' }
    case 'success':
      return { action: 'inverso' }
    case 'processing':
      return { action: 'bloqueado', reason: 'EVO todavía no ha confirmado este corte. Espera unos segundos y vuelve a intentarlo.' }
    case 'failed': {
      const http = Number(event.http_status) || 0
      const evoRejected = event.response_body?.evo_confirmation?.estado === 'error'
      // EVO lo rechazó (4xx o confirmación con error): no lo aplicó
      if ((http >= 400 && http < 500) || evoRejected) return { action: 'descartar' }
      return { action: 'bloqueado', reason: 'El aviso de este corte a EVO falló y no sabemos si llegó a aplicarse. Revísalo en Logs antes de deshacerlo.' }
    }
    default:
      return { action: 'bloqueado', reason: `El aviso de este corte a EVO está en un estado desconocido (${event.status}).` }
  }
}

export interface UndoCutOrder {
  status: string
  quantity_requested: number | null
  quantity_cut: number | null
  quantity_delivered?: number | null
  reassigned_from_order_id?: string | null
  reassigned_from_cut_order_id?: string | null
}

/**
 * Motivo por el que NO se puede deshacer el último corte de una orden, o null.
 * `activeLinesTotal` es la suma de las piezas de los cortes vigentes de la
 * orden: si no coincide con lo cortado, hubo una reasignación de por medio
 * (que mueve unidades entre órdenes sin registrar un corte).
 */
export function undoBlocker(params: {
  orderStatus: string
  cutOrder: UndoCutOrder
  lineQuantity: number
  activeLinesTotal: number
  givenToOthers: boolean
}): string | null {
  const { orderStatus, cutOrder, lineQuantity, activeLinesTotal, givenToOthers } = params
  const cut = Number(cutOrder.quantity_cut) || 0
  const delivered = Number(cutOrder.quantity_delivered) || 0
  if (orderStatus === 'entregado') return 'El pedido ya está entregado.'
  if (orderStatus === 'cancelado') return 'El pedido está eliminado.'
  if (cutOrder.status === 'entregado') return 'Esta orden ya se entregó al cliente.'
  if (cutOrder.status === 'pendiente_confirmacion' || cutOrder.reassigned_from_order_id || cutOrder.reassigned_from_cut_order_id || givenToOthers) {
    return 'Esta orden tiene una reasignación en curso. Resuélvela antes de deshacer el corte.'
  }
  if (!(lineQuantity > 0)) return 'Este corte no tiene unidades que deshacer.'
  if (Math.abs(activeLinesTotal - cut) > 0.001) return 'Esta orden ha tenido reasignaciones y lo cortado ya no coincide con sus cortes registrados.'
  if (cut - lineQuantity < delivered) return 'Parte de este corte ya se entregó al cliente.'
  return null
}

/**
 * Estado del pedido después de deshacer un corte. Tras deshacer nunca queda
 * todo terminado, así que solo puede ser «en corte» o, si ya no queda nada
 * hecho, «aprobado». Los estados que no dependen del avance se conservan.
 */
export function orderStatusAfterUndo(currentStatus: string, nothingDone: boolean): string {
  if (['parcialmente_entregado', 'aprobado_en_pausa', 'modificado'].includes(currentStatus)) return currentStatus
  return nothingDone ? 'aprobado' : 'en_corte'
}

/**
 * Movimientos que se mandan a EVO por un corte real (la chapa no mide lo mismo
 * que la pieza): baja de las chapas gastadas, alta de las piezas con el
 * nro_item de la línea del pedido y alta de cada sobrante que vuelve al stock.
 * De una chapa pueden salir varias piezas, así que las cantidades no coinciden:
 * 3 piezas de 4 m de una chapa de 12 m = BAJA 1, ALTA 3 y ningún sobrante.
 */
export function buildCutMovimientos(input: {
  sheets: number
  sheetEvoId: string
  pieces: number
  pieceEvoId: string
  nroItem: number
  remnants: Array<{ evoId: string | null | undefined; count: number }>
}): CorteMovimiento[] {
  return [
    { tipo: 'BAJA', nro_item: 0, id_articulo: input.sheetEvoId, cantidad: input.sheets },
    { tipo: 'ALTA', nro_item: input.nroItem, id_articulo: input.pieceEvoId, cantidad: input.pieces },
    ...input.remnants
      .filter(r => r.evoId && r.count > 0)
      .map(r => ({ tipo: 'ALTA' as const, nro_item: 0, id_articulo: r.evoId as string, cantidad: r.count })),
  ]
}
