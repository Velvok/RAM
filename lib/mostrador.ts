// Pedidos de Mostrador: EVO los manda con el tercero MOSTRADO. No pasan por la
// aprobación manual: al entrar se aprueban «en pausa» (se asigna lo que tiene
// stock y el resto queda para asignar a mano) y, si todo tenía stock, quedan
// directamente aprobados.

export const MOSTRADOR_CODTER = 'MOSTRADO'

export function isMostrador(refEvo: { codter?: string | null } | null | undefined): boolean {
  return String(refEvo?.codter || '').trim().toUpperCase() === MOSTRADOR_CODTER
}

/**
 * Solo se aprueba solo un pedido nuevo de Mostrador con todos sus artículos
 * reconocidos: si falta alguno, el pedido llegaría incompleto y lo revisa la
 * oficina.
 */
export function shouldAutoApprove(input: { refEvo: { codter?: string | null } | null | undefined; missingProducts: number }): boolean {
  return isMostrador(input.refEvo) && input.missingProducts === 0
}
