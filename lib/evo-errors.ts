// Textos para la gente sobre lo que pasa con EVO: nombres de los avisos y
// explicación de por qué falló un envío, sin códigos HTTP ni nombres de campos.
// El detalle técnico se sigue viendo, aparte, en Integración EVO.

const EVENT_LABEL: Record<string, string> = {
  corte_realizado: 'un corte',
  chapa_preparada: 'una preparación',
  pedido_completado: 'un pedido completado',
  pedido_parcialmente_entregado: 'una entrega parcial',
  pedido_iniciado: 'el inicio de un pedido',
  stock_ajustado: 'un ajuste de stock',
  test_ping: 'la prueba de conexión',
}

/** «un corte», «una preparación»… para frases como «No se pudo avisar a EVO de un corte». */
export function evoEventLabel(eventType: string | null | undefined): string {
  return EVENT_LABEL[eventType || ''] || 'un movimiento'
}

/** Por qué falló un envío a EVO, en llano. */
export function explainEvoError(errorMessage: string | null | undefined, httpStatus?: number | null): string {
  const msg = errorMessage || ''
  const http = Number(httpStatus) || Number(/HTTP (\d{3})/.exec(msg)?.[1]) || 0
  if (/timeout/i.test(msg)) return 'EVO tardó demasiado en responder. Puede que sí lo haya recibido: si lo confirma más tarde, se marcará solo. Compruébalo antes de reenviarlo.'
  if (/ref_evo/i.test(msg)) return 'El pedido no tiene los datos de EVO que hacen falta para avisarle (suele pasar con los pedidos de prueba).'
  if (http === 401 || http === 403) return 'EVO rechazó la conexión: hay que revisar las credenciales de la integración.'
  if (http === 404) return 'EVO no reconoce la dirección a la que se envió: hay que revisar la configuración de la integración.'
  if (http >= 400 && http < 500) return 'EVO no aceptó los datos del envío.'
  if (http >= 500) return 'EVO tuvo un error al procesarlo. Se puede reenviar más tarde.'
  if (/fetch failed|network|ECONN|ENOTFOUND|socket/i.test(msg)) return 'No se pudo conectar con EVO.'
  if (/max attempts/i.test(msg)) return 'Se agotaron los intentos de envío a EVO.'
  return 'EVO no confirmó el envío.'
}

/**
 * Un aviso a EVO marcado como fallido del que en realidad NO sabemos el
 * resultado: se agotó la espera, se cortó la conexión o EVO dio un error
 * interno. EVO puede haberlo aplicado igual, así que:
 * - si su confirmación llega después, se acepta (webhook de confirmación);
 * - se enseña como «Sin confirmar», no como rechazado;
 * - nunca se deshace ni se reenvía solo.
 * Un rechazo claro (4xx o una confirmación de EVO con error) sí es un fallo.
 */
export function isUnconfirmedOutcome(event: {
  status?: string | null
  http_status?: number | null
  response_body?: any
}): boolean {
  if (event.status !== 'failed') return false
  if (event.response_body?.evo_confirmation) return false
  const http = Number(event.http_status) || 0
  return !(http >= 400 && http < 500)
}
