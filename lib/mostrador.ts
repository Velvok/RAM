// Pedidos de Mostrador: EVO los manda con un tercero que empieza por MOSTRA
// (MOSTRADO, MOSTRAD4, MOSTRA20…: todos son de Mostrador, criterio de EVO).
// No pasan por la
// aprobación manual: al entrar se aprueban «en pausa» (se asigna lo que tiene
// stock y el resto queda para asignar a mano) y, si todo tenía stock, quedan
// directamente aprobados.

export const MOSTRADOR_PREFIX = 'MOSTRA'

export function isMostrador(refEvo: { codter?: string | null } | null | undefined): boolean {
  return String(refEvo?.codter || '').trim().toUpperCase().startsWith(MOSTRADOR_PREFIX)
}

/**
 * Solo se aprueba solo un pedido nuevo de Mostrador con todos sus artículos
 * reconocidos: si falta alguno, el pedido llegaría incompleto y lo revisa la
 * oficina.
 */
export function shouldAutoApprove(input: { refEvo: { codter?: string | null } | null | undefined; missingProducts: number }): boolean {
  return isMostrador(input.refEvo) && input.missingProducts === 0
}
