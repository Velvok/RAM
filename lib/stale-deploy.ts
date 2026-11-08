// Errores típicos de una pestaña que se cargó con un despliegue anterior: las
// acciones de servidor o los trozos de JavaScript que pide ya no existen.
const STALE_RE = /Server Action .* was not found|UnrecognizedActionError|failed-to-find-server-action|ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i

export const STALE_CHECK_EVENT = 'ram:stale-check'

export function looksLikeStaleDeploy(error: unknown): boolean {
  const e = error as any
  const text = [e?.name, e?.message, e?.digest, typeof e === 'string' ? e : ''].filter(Boolean).join(' ')
  return STALE_RE.test(text)
}

/** Llamar desde los catch: si el error parece de versión vieja, se comprueba ya. */
export function reportPossibleStaleDeploy(error: unknown) {
  if (typeof window !== 'undefined' && looksLikeStaleDeploy(error)) {
    window.dispatchEvent(new Event(STALE_CHECK_EVENT))
  }
}
