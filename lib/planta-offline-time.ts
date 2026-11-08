// Texto para el historial cuando una acción de planta se hizo sin conexión y
// llega más tarde: deja constancia de la hora real en que ocurrió.
const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000

export function offlineNote(occurredAt?: string | null, now = Date.now()): string {
  if (!occurredAt) return ''
  const t = Date.parse(occurredAt)
  if (!Number.isFinite(t) || now - t < OFFLINE_THRESHOLD_MS) return ''
  const when = new Date(t).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  return ` · hecho sin conexión el ${when}`
}
