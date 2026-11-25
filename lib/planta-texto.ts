// La tablet de planta no enseña números de orden de corte (CUT-…): para el
// operario no significan nada y hacen ruido. El historial del pedido los guarda
// en la descripción (los ve la oficina); aquí se quitan al mostrarlo.

const CUT = 'CUT-[A-Za-z0-9-]+'

export function sinOrdenDeCorte(texto: string): string {
  return String(texto || '')
    .replace(new RegExp(`\\s*\\(orden ${CUT}\\)`, 'g'), '')
    .replace(new RegExp(`\\s+desde orden ${CUT}`, 'g'), '')
    .replace(new RegExp(`\\s*\\(?${CUT}\\)?`, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
