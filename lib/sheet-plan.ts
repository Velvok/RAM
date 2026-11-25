// Reglas para sacar varias piezas de una misma chapa. Lógica pura (sin base de
// datos ni UI): la usan la aprobación, el cambio de chapa, el corte, las
// reservas y las pantallas de oficina y planta.
//
// - No se pierde material al cortar: de 12 m salen 3 piezas de 4 m justas.
// - Cada corte registrado es autónomo: abre y cierra sus chapas. Lo que sobra
//   de cada chapa vuelve al stock como remanente.
// - Reservas: lo que falta por cortar se reserva en CHAPAS de la chapa base; lo
//   ya cortado y sin entregar, en PIEZAS del producto de la pieza.

const EPS = 0.01
const num = (v: unknown) => Number(v) || 0
export const round2 = (v: number) => Math.round(v * 100) / 100

/** ¿La chapa mide lo mismo que la pieza? Entonces no hay corte: se prepara tal cual. */
export function isExactLength(sheetLength: number, pieceLength: number): boolean {
  return sheetLength > 0 && pieceLength > 0 && Math.abs(sheetLength - pieceLength) < EPS
}

/** Piezas de `pieceLength` que salen de una chapa de `sheetLength`. 0 si no cabe ninguna. */
export function piecesPerSheet(sheetLength: number, pieceLength: number): number {
  if (!(sheetLength > 0) || !(pieceLength > 0)) return 0
  return Math.floor((sheetLength + EPS) / pieceLength)
}

/** Chapas necesarias para `pieces` piezas si de cada una salen `pps`. */
export function sheetsFor(pieces: number, pps: number): number {
  if (!(pieces > 0)) return 0
  return Math.ceil(pieces / Math.max(1, Math.floor(pps) || 1))
}

export interface Leftover {
  /** Largo del trozo que sobra, en metros */
  length: number
  /** Cuántos trozos de ese largo */
  count: number
}

export interface CutOutcome {
  exact: boolean
  piecesPerSheet: number
  /** Chapas que se gastan */
  sheets: number
  /** Trozos que sobran, agrupados por largo (vacío si se aprovecha todo) */
  leftovers: Leftover[]
  leftoverMeters: number
}

/** Qué pasa al cortar `pieces` piezas de `pieceLength` con chapas de `sheetLength`. */
export function cutOutcome(sheetLength: number, pieceLength: number, pieces: number): CutOutcome {
  const pps = piecesPerSheet(sheetLength, pieceLength)
  const k = Math.max(0, Math.floor(num(pieces)))
  if (pps === 0 || k === 0) return { exact: false, piecesPerSheet: pps, sheets: 0, leftovers: [], leftoverMeters: 0 }
  if (isExactLength(sheetLength, pieceLength)) return { exact: true, piecesPerSheet: 1, sheets: k, leftovers: [], leftoverMeters: 0 }

  const full = Math.floor(k / pps)
  const rest = k % pps
  const byLength = new Map<number, number>()
  const add = (length: number, count: number) => {
    const l = round2(length)
    if (l >= EPS && count > 0) byLength.set(l, (byLength.get(l) || 0) + count)
  }
  add(sheetLength - pps * pieceLength, full)
  if (rest > 0) add(sheetLength - rest * pieceLength, 1)
  const leftovers = [...byLength].map(([length, count]) => ({ length, count })).sort((a, b) => b.length - a.length)
  return {
    exact: false,
    piecesPerSheet: pps,
    sheets: full + (rest > 0 ? 1 : 0),
    leftovers,
    leftoverMeters: round2(leftovers.reduce((s, l) => s + l.length * l.count, 0)),
  }
}

export interface SheetCandidate {
  id: string
  length: number
  /** Chapas disponibles (sin reservar) */
  available: number
}

export interface PlanPart {
  id: string
  length: number
  sheets: number
  pieces: number
  piecesPerSheet: number
  leftoverMeters: number
}

/**
 * Propuesta del sistema para `pieces` piezas: primero las chapas del largo
 * exacto; después la chapa que deja menos sobrante (a igualdad, menos chapas y
 * luego la más corta). Si una sola no alcanza, se usa la que más cubre y se
 * sigue con el resto. `uncovered` son las piezas que se quedan sin chapa.
 */
export function proposePlan(pieces: number, pieceLength: number, candidates: SheetCandidate[]): { parts: PlanPart[]; uncovered: number } {
  let left = Math.max(0, Math.floor(num(pieces)))
  const parts: PlanPart[] = []
  const pool = candidates
    .map(c => ({ ...c, available: Math.floor(num(c.available)), pps: piecesPerSheet(c.length, pieceLength) }))
    .filter(c => c.available > 0 && c.pps > 0)

  const take = (c: (typeof pool)[number], n: number) => {
    const o = cutOutcome(c.length, pieceLength, n)
    parts.push({ id: c.id, length: c.length, sheets: o.sheets, pieces: n, piecesPerSheet: o.piecesPerSheet, leftoverMeters: o.leftoverMeters })
    c.available -= o.sheets
    left -= n
  }

  for (const c of pool.filter(c => isExactLength(c.length, pieceLength))) {
    if (left > 0) take(c, Math.min(left, c.available))
  }

  while (left > 0) {
    const options = pool
      .filter(c => c.available > 0 && !isExactLength(c.length, pieceLength))
      .map(c => {
        const n = Math.min(left, c.available * c.pps)
        const o = cutOutcome(c.length, pieceLength, n)
        return { c, n, sheets: o.sheets, leftover: o.leftoverMeters }
      })
    if (!options.length) break
    options.sort((a, b) =>
      b.n - a.n ||                 // la que más piezas cubre (normalmente todas)
      a.leftover - b.leftover ||   // menos sobrante
      a.sheets - b.sheets ||       // menos chapas
      a.c.length - b.c.length)     // la más corta
    take(options[0].c, options[0].n)
  }
  return { parts, uncovered: left }
}

export interface ReservableCut {
  quantity_requested: number | string | null
  quantity_cut?: number | string | null
  quantity_delivered?: number | string | null
  pieces_per_sheet?: number | string | null
  material_base_id?: string | null
  /** Piezas que llegan ya cortadas de otro pedido y aún no se han confirmado */
  reassigned_from_order_id?: string | null
  reassigned_quantity?: number | string | null
}

/**
 * Reserva de una orden de corte:
 * - `sheets`: chapas de la chapa base para lo que falta por cortar.
 * - `pieces`: piezas ya cortadas y sin entregar, en el producto de la pieza.
 * Con una pieza por chapa y corte exacto es lo mismo que antes del cambio.
 */
export function cutReservation(cut: ReservableCut): { sheets: number; pieces: number } {
  const requested = num(cut.quantity_requested)
  const done = Math.min(num(cut.quantity_cut), requested)
  const incoming = cut.reassigned_from_order_id ? num(cut.reassigned_quantity) : 0
  const uncut = Math.max(0, requested - done - incoming)
  return {
    sheets: cut.material_base_id ? sheetsFor(uncut, num(cut.pieces_per_sheet) || 1) : 0,
    pieces: Math.max(0, done - num(cut.quantity_delivered)),
  }
}

/** Texto de los sobrantes: «1 de 8,0 m» / «2 de 3,0 m y 1 de 7,5 m». */
export function describeLeftovers(leftovers: Leftover[]): string {
  const m = (v: number) => `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(v)} m`
  const parts = leftovers.map(l => `${l.count} de ${m(l.length)}`)
  if (parts.length <= 1) return parts[0] || ''
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}
