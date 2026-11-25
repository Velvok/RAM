import { extractSizeFromCode } from '@/lib/product-utils'
import { cutOutcome, isExactLength, piecesPerSheet, round2 } from '@/lib/sheet-plan'

// Lógica pura de la pantalla de planta: qué tarea hay en cada pedido, en qué
// estado está cada tarjeta de corte y qué chapa usar. Sin dependencias de UI
// ni de base de datos, para poder probarla sola.

export type PlantaTask = 'cortar' | 'preparar' | 'confirmar' | 'sin_stock' | 'terminado'

export type CutCardState = 'cortando' | 'por_empezar' | 'sin_chapa' | 'confirmar_recogida' | 'terminada'

export interface CutLike {
  status: string
  quantity_requested: number | string
  quantity_cut?: number | string | null
  material_base_id?: string | null
}

export interface PrepLike {
  status?: string
  quantity_requested: number | string
  quantity_prepared?: number | string | null
  assigned_inventory_id?: string | null
}

const n = (v: unknown) => Number(v) || 0

export function cutCardState(cut: CutLike): CutCardState {
  if (cut.status === 'pendiente_confirmacion') return 'confirmar_recogida'
  const done = n(cut.quantity_cut), total = n(cut.quantity_requested)
  if (cut.status === 'completada' || cut.status === 'entregado' || (total > 0 && done >= total)) return 'terminada'
  if (!cut.material_base_id) return 'sin_chapa'
  return done > 0 ? 'cortando' : 'por_empezar'
}

/** Tareas que tiene abiertas un pedido para la planta, de más a menos urgente. */
export function orderTasks(order: { status?: string; cut_orders?: CutLike[] | null; preparation_items?: PrepLike[] | null }): PlantaTask[] {
  const cuts = order.cut_orders || []
  const preps = order.preparation_items || []
  const tasks = new Set<PlantaTask>()
  for (const c of cuts) {
    const s = cutCardState(c)
    if (s === 'confirmar_recogida') tasks.add('confirmar')
    else if (s === 'sin_chapa') tasks.add('sin_stock')
    else if (s !== 'terminada') tasks.add('cortar')
  }
  for (const p of preps) {
    if (n(p.quantity_prepared) < n(p.quantity_requested)) tasks.add('preparar')
  }
  if (tasks.size === 0) tasks.add('terminado')
  const order_: PlantaTask[] = ['confirmar', 'cortar', 'preparar', 'sin_stock', 'terminado']
  return order_.filter(t => tasks.has(t))
}

/** Tarea principal (la primera por urgencia). */
export function mainTask(order: Parameters<typeof orderTasks>[0]): PlantaTask {
  return orderTasks(order)[0]
}

export function orderProgress(order: { cut_orders?: CutLike[] | null; preparation_items?: PrepLike[] | null }): { done: number; total: number } {
  const cuts = order.cut_orders || []
  const preps = order.preparation_items || []
  return {
    done: cuts.reduce((s, c) => s + n(c.quantity_cut), 0) + preps.reduce((s, p) => s + n(p.quantity_prepared), 0),
    total: cuts.reduce((s, c) => s + n(c.quantity_requested), 0) + preps.reduce((s, p) => s + n(p.quantity_requested), 0),
  }
}

export const TASK_LABEL: Record<PlantaTask, string> = {
  confirmar: 'Reasignación',
  cortar: 'Para cortar',
  preparar: 'Para preparar',
  sin_stock: 'Sin stock',
  terminado: 'Terminados',
}

export const TASK_ACTION: Record<PlantaTask, string> = {
  confirmar: 'Confirmar →',
  cortar: 'Cortar →',
  preparar: 'Preparar →',
  sin_stock: 'Elegir chapa →',
  terminado: 'Ver',
}

/** Largo en metros de un producto (campo o código). */
export function productLength(product: { length_meters?: number | string | null; code?: string | null } | null | undefined): number {
  if (!product) return 0
  return Number(product.length_meters) || extractSizeFromCode(product.code || '') || 0
}

/**
 * Qué da una chapa de `materialLength` para piezas de `pieceLength`: cuántas
 * salen y qué sobra de una chapa aprovechada entera (reglas en lib/sheet-plan.ts).
 */
export function cutPlan(materialLength: number, pieceLength: number): { exact: boolean; remnant: number; piecesPerSheet: number } {
  if (materialLength <= 0 || pieceLength <= 0) return { exact: false, remnant: 0, piecesPerSheet: 0 }
  const exact = isExactLength(materialLength, pieceLength)
  const pps = exact ? 1 : piecesPerSheet(materialLength, pieceLength)
  return {
    exact,
    remnant: exact || pps === 0 ? 0 : round2(Math.max(0, materialLength - pps * pieceLength)),
    piecesPerSheet: pps,
  }
}

/**
 * Ordena las chapas candidatas para cortar `pieces` piezas: primero las que
 * dejan menos sobrante en total, luego las que gastan menos chapas y luego por
 * más stock. Las que son más cortas que la pieza van al final.
 */
export function sortByRemnant<T extends { code: string; stock_disponible: number | string }>(options: T[], pieceLength: number, pieces = 1): T[] {
  const score = (o: T) => {
    const out = cutOutcome(extractSizeFromCode(o.code), pieceLength, Math.max(1, pieces))
    return out.sheets === 0 ? { leftover: Infinity, sheets: Infinity } : { leftover: out.leftoverMeters, sheets: out.sheets }
  }
  return [...options].sort((a, b) => {
    const sa = score(a), sb = score(b)
    return (sa.leftover - sb.leftover || 0) || (sa.sheets - sb.sheets || 0) || n(b.stock_disponible) - n(a.stock_disponible)
  })
}

export function formatMeters(m: number): string {
  return `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(m)} m`
}
