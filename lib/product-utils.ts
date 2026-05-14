/**
 * Utilidades para extraer información de códigos de producto
 * No son server actions, solo funciones helper puras
 */

/**
 * Extraer código base del producto (sin el tamaño)
 * Soporta dos patrones:
 * 1. Estándar: AC25110.0,5 → AC25110
 * 2. Nuevo: ACDD.1,1X10,0M → ACDD
 */
export function extractBaseCode(code: string): string {
  // Patrón estándar: AC25110.0,5 → AC25110
  const standardMatch = code.match(/^([A-Z0-9]+)\./i)
  if (standardMatch) {
    return standardMatch[1]
  }

  // Patrón nuevo: ACDD.1,1X10,0M → ACDD
  // El código base es todo antes del primer punto
  const parts = code.split('.')
  if (parts.length > 1) {
    return parts[0]
  }

  return code
}

/**
 * Extraer tamaño del código del producto
 * Soporta dos patrones:
 * 1. Estándar: AC25110.0,5 → 0.5, AC25110.5,0 → 5.0
 * 2. Nuevo: ACDD.1,1X10,0M → 10.0, ACDD.1,1X12,0M → 12.0
 */
export function extractSizeFromCode(code: string): number {
  // Patrón estándar: después del punto, número,número al final
  const standardMatch = code.match(/\.(\d+),(\d+)$/)
  if (standardMatch) {
    return parseFloat(`${standardMatch[1]}.${standardMatch[2]}`)
  }

  // Patrón nuevo: X{LARGO}M al final, donde largo es número,número
  const newPatternMatch = code.match(/X(\d+),(\d+)M$/i)
  if (newPatternMatch) {
    return parseFloat(`${newPatternMatch[1]}.${newPatternMatch[2]}`)
  }

  return 0
}
