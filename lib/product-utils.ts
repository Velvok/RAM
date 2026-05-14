/**
 * Utilidades para extraer información de códigos de producto
 * No son server actions, solo funciones helper puras
 */

interface ProductFamily {
  familyCode: string
  size: number
  isChapa: boolean
}

/**
 * Determinar si un producto es chapa (necesita corte)
 * Basado en patrones de código y categoría
 */
export function isChapaProduct(code: string, category?: string | null): boolean {
  // Si ya tiene categoría 'chapa', usarla
  if (category === 'chapa') {
    return true
  }

  // Patrones de código que indican chapas
  const chapaPatterns = [
    /^A\*[BGMN]25110/, // Sinusoidales pintadas (A*B, A*G, A*M, A*N)
    /^AC[0-9]+110/,    // Sinusoidales cinc (AC25110, AC27110)
    /^ACDD\./,         // Dach acanalada (ACDD.1,1X...)
    /^ACPOLI\./,       // Polis (ACPOLI.BL, etc.)
    /^ACOPIO\./,       // Acopio
    /^ACEROCONST\./,   // Acero construcción
  ]

  return chapaPatterns.some(pattern => pattern.test(code))
}

/**
 * Extraer código de familia del producto (sin el tamaño)
 * Soporta múltiples patrones:
 * 1. Estándar: AC25110.0,5 → AC25110
 * 2. Sinusoidal pintada: A*B25110.0,5 → A*B25110
 * 3. Dach acanalada: ACDD.1,1X10,0M → ACDD.1,1
 * 4. Polis: ACPOLI.BL.2.00 → ACPOLI.BL
 * 5. Acero: ACEROCONST.06 → ACEROCONST
 */
export function extractFamilyCode(code: string): string {
  // Patrón estándar: AC25110.0,5 → AC25110
  const standardMatch = code.match(/^([A-Z0-9]+)\./i)
  if (standardMatch) {
    const base = standardMatch[1]
    // Para patrones tipo ACDD.1,1X10,0M, la familia es ACDD.1,1
    // Para patrones tipo ACPOLI.BL.2.00, la familia es ACPOLI.BL
    // Para patrones tipo AC25110.0,5, la familia es AC25110
    // Para patrones tipo A*B25110.0,5, la familia es A*B25110
    return base
  }

  return code
}

/**
 * Extraer tamaño del código del producto
 * Soporta múltiples patrones:
 * 1. Estándar: AC25110.0,5 → 0.5, AC25110.5,0 → 5.0
 * 2. Dach acanalada: ACDD.1,1X10,0M → 10.0, ACDD.1,1X12,0M → 12.0
 * 3. Polis: ACPOLI.BL.2.00 → 2.0, ACPOLI.BL.10.5 → 10.5
 * 4. Acero: ACEROCONST.06 → 6.0, ACEROCONST.08 → 8.0
 */
export function extractSizeFromCode(code: string): number {
  // Patrón estándar: después del punto, número,número al final
  const standardMatch = code.match(/\.(\d+),(\d+)$/)
  if (standardMatch) {
    return parseFloat(`${standardMatch[1]}.${standardMatch[2]}`)
  }

  // Patrón Dach acanalada: X{LARGO}M al final, donde largo es número,número
  const dachMatch = code.match(/X(\d+),(\d+)M$/i)
  if (dachMatch) {
    return parseFloat(`${dachMatch[1]}.${dachMatch[2]}`)
  }

  // Patrón Polis: .{SIZE} al final con punto como separador decimal
  const poliMatch = code.match(/\.(\d+\.\d+)$/)
  if (poliMatch) {
    return parseFloat(poliMatch[1])
  }

  // Patrón Acero: .{SIZE} al final (sin decimal, interpretar como diámetro en mm)
  const aceroMatch = code.match(/\.(\d+)$/)
  if (aceroMatch && code.startsWith('ACEROCONST.')) {
    // ACEROCONST.06 → 6.0, ACEROCONST.08 → 8.0, ACEROCONST.10 → 10.0
    const size = parseInt(aceroMatch[1], 10)
    return size / 10.0 // Convertir de mm a unidades
  }

  return 0
}

/**
 * Analizar un producto y extraer información de familia y tamaño
 */
export function analyzeProduct(code: string, category?: string | null): ProductFamily {
  return {
    familyCode: extractFamilyCode(code),
    size: extractSizeFromCode(code),
    isChapa: isChapaProduct(code, category)
  }
}
