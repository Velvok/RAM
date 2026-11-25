// Errores con un mensaje pensado para la persona que usa la app.
//
// En producción, Next no deja pasar al navegador el texto de un error lanzado
// en el servidor (lo sustituye por un aviso genérico en inglés) y solo envía
// su `digest`. Un UserError viaja en ese `digest`, así que su mensaje sí llega;
// cualquier otro error (base de datos, red, fallos de programación) se queda
// en los logs del servidor y la persona ve un aviso genérico en español.
//
// - En el servidor: `throw new UserError('No hay stock suficiente de X')`
// - En el cliente:  `toast.error(userMessage(e, 'No se pudo aprobar'))`

const PREFIX = 'USER:'

export const GENERIC_ERROR = 'No se ha podido completar. Vuelve a intentarlo y, si sigue pasando, avisa a soporte.'
export const OFFLINE_ERROR = 'No hay conexión con el servidor. Comprueba la conexión y vuelve a intentarlo.'

export class UserError extends Error {
  digest: string
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
    this.digest = PREFIX + message
  }
}

const NETWORK_RE = /failed to fetch|fetch failed|networkerror|load failed|network request failed/i

/** Mensaje que se puede enseñar; `fallback` si el error no es de los nuestros. */
export function userMessage(error: unknown, fallback: string = GENERIC_ERROR): string {
  const e = error as any
  if (typeof e?.digest === 'string' && e.digest.startsWith(PREFIX)) return e.digest.slice(PREFIX.length) || fallback
  if (e?.name === 'UserError' && typeof e.message === 'string' && e.message) return e.message
  if (typeof e?.message === 'string' && NETWORK_RE.test(e.message)) return OFFLINE_ERROR
  return fallback
}

/** true si el error trae un mensaje nuestro (no técnico). */
export function isUserError(error: unknown): boolean {
  const e = error as any
  return (typeof e?.digest === 'string' && e.digest.startsWith(PREFIX)) || e?.name === 'UserError'
}
