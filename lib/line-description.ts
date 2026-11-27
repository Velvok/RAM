// Descripción del artículo que manda EVO en cada línea del pedido (con las
// unidades incluidas, p. ej. «Kg.Tubos … c/ Ud: 31.200»). Se guarda tal cual
// en order_lines.evo_description y se muestra en lugar del nombre del catálogo.

/** Limpia la descripción que llega de EVO: sin espacios sobrantes; vacía → null. */
export function cleanEvoDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.replace(/\s+/g, ' ').trim()
  return s || null
}

/** Nombre que se enseña de una línea: la descripción de EVO si la hay, si no el del producto. */
export function lineDisplayName(
  line: { evo_description?: string | null } | null | undefined,
  product: { name?: string | null; code?: string | null } | null | undefined
): string {
  return line?.evo_description || product?.name || product?.code || ''
}

/** Descripción de EVO por producto, a partir de las líneas del pedido. */
export function descriptionsByProduct(lines: Array<{ product_id?: string | null; evo_description?: string | null }> | null | undefined): Map<string, string> {
  const map = new Map<string, string>()
  for (const l of lines || []) {
    if (l.product_id && l.evo_description && !map.has(l.product_id)) map.set(l.product_id, l.evo_description)
  }
  return map
}
