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
 * Basado EXCLUSIVAMENTE en prefijos de código explícitos
 * NO se usa la categoría del producto
 */
export function isChapaProduct(code: string, category?: string | null, name?: string | null): boolean {
  // Lista explícita de prefijos que indican productos de corte
  const chapaPrefixes = [
    'A*B25110',
    'A*G25110',
    'A*M25110',
    'A*N25110',
    'A*R25110',
    'A*V25110',
    'AC25110',
    'AC27110',
    'ACDD.1,1',
    'ACPOLI.BL',
    'ACPOLI.CR',
    'ACPOLI.FU',
    'AG25110',
    'AG27110',
    'CP T101',
    'CP110',
    'CPDD',
    'T*B25110',
    'T*G25110',
    'T*M25110',
    'T*N25110',
    'T*R25110',
    'T*V25110',
    'T101POLI.B',
    'T101POLI.C',
    'T101POLI.F',
    'TC22110',
    'TC25110',
    'TC27110',
    'TG22110',
    'TG25110',
    'TG27110',
    'TRPOLIDD',
  ]

  // Verificar si el código empieza con alguno de los prefijos
  return chapaPrefixes.some(prefix => code.startsWith(prefix))
}

/**
 * Extraer código de familia del producto (sin el tamaño)
 * Soporta múltiples patrones:
 * 1. Estándar: AC25110.0,5 → AC25110
 * 2. Sinusoidal pintada: A*B25110.0,5 → A*B25110
 * 3. Dach acanalada: ACDD.1,1X10,0M → ACDD.1,1
 * 4. Polis: ACPOLI.BL.2.00 → ACPOLI.BL
 * 5. Acero: ACEROCONST.06 → ACEROCONST
 * 6. TRPOLIDD.B.0,5 → TRPOLIDD.B
 * 7. TRAVESAÑOBX0,6 → TRAVESAÑOBX
 */
export function extractFamilyCode(code: string): string {
  // Patrón Dach acanalada: ACDD.1,1X10,0M → ACDD.1,1 (antes de la X)
  const dachMatch = code.match(/^([A-Z0-9.]+)X\d+/i)
  if (dachMatch) {
    return dachMatch[1]
  }

  // Patrón estándar: AC25110.0,5 → AC25110
  const standardMatch = code.match(/^([A-Z0-9*]+)\./i)
  if (standardMatch) {
    const base = standardMatch[1]
    // Para patrones tipo ACPOLI.BL.2.00, la familia es ACPOLI.BL
    // Para patrones tipo AC25110.0,5, la familia es AC25110
    // Para patrones tipo A*B25110.0,5, la familia es A*B25110
    // Para patrones tipo TRPOLIDD.B.0,5, la familia es TRPOLIDD.B
    return base
  }

  // Para productos sin punto (ej: A/R 17/15, TH1, UPN100MM)
  // No tienen familia variable, el código completo es la familia
  return code
}

/**
 * Extraer patrón de familia del NOMBRE del producto
 * Ejemplo: "CH.DAS DACH ACANALADA X10,0M" → "CH.DAS DACH ACANALADA"
 */
export function extractFamilyFromName(name: string): string {
  // Patrón: texto antes de X{número}M o X{número} M
  const match = name.match(/^(.+?)\s*X\d+[\.,]?\d*M?$/i)
  if (match) {
    return match[1].trim()
  }
  
  // Si no tiene el patrón X...M, devolver el nombre completo
  return name
}

/**
 * Extraer tamaño en metros del NOMBRE del producto
 * Ejemplo: "CH.DAS DACH ACANALADA X10,0M" → 10.0
 */
export function extractSizeFromName(name: string): number {
  // Patrón: X{número}M o X{número} M al final (con coma o punto como decimal)
  const match = name.match(/X(\d+)[\.,](\d+)M?$/i)
  if (match) {
    const integer = parseInt(match[1], 10)
    const decimal = parseInt(match[2], 10)
    return parseFloat(`${integer}.${decimal}`)
  }

  // Patrón: X{número}M sin decimal
  const matchNoDecimal = name.match(/X(\d+)M?$/i)
  if (matchNoDecimal) {
    return parseInt(matchNoDecimal[1], 10)
  }

  return 0
}

/**
 * Extraer tamaño del código del producto
 * Soporta múltiples patrones:
 * 1. Estándar: AC25110.0,5 → 0.5, AC25110.5,0 → 5.0
 * 2. Dach acanalada: ACDD.1,1X10,0M → 10.0, ACDD.1,1X12,0M → 12.0
 * 3. Polis: ACPOLI.BL.2.00 → 2.0, ACPOLI.BL.10.5 → 10.5
 * 4. Acero: ACEROCONST.06 → 6.0, ACEROCONST.08 → 8.0
 * 5. TRPOLIDD: TRPOLIDD.B.0,5 → 0.5, TRPOLIDD.B.10, → 10.0
 * 6. T101POLI: T101POLI.B.10, → 10.0, T101POLI.B.0,5 → 0.5
 * 7. Traveseños: TRAVESAÑOBX0,6 → 0.6, TRAVESAÑOBX1,2 → 1.2
 */
export function extractSizeFromCode(code: string): number {
  // Patrón estándar: después del punto, número,número al final
  const standardMatch = code.match(/\.(\d+),(\d+)$/)
  if (standardMatch) {
    const integer = parseInt(standardMatch[1], 10)
    const decimal = parseInt(standardMatch[2], 10)
    return parseFloat(`${integer}.${decimal}`)
  }

  // Patrón Dach acanalada: X{LARGO}M al final, donde largo es número,número
  const dachMatch = code.match(/X(\d+),(\d+)M$/i)
  if (dachMatch) {
    const integer = parseInt(dachMatch[1], 10)
    const decimal = parseInt(dachMatch[2], 10)
    return parseFloat(`${integer}.${decimal}`)
  }

  // Patrón Polis: .{SIZE} al final con punto como separador decimal
  const poliMatch = code.match(/\.(\d+\.\d+)$/)
  if (poliMatch) {
    return parseFloat(poliMatch[1])
  }

  // Patrón T101POLI y TRPOLIDD: .{SIZE}, al final (ej: T101POLI.B.10, → 10.0, TRPOLIDD.B.10, → 10.0)
  const sizeWithCommaMatch = code.match(/\.(\d+),$/)
  if (sizeWithCommaMatch) {
    return parseFloat(sizeWithCommaMatch[1])
  }

  // Patrón Traveseños: X{SIZE} al final (ej: TRAVESAÑOBX0,6 → 0.6)
  const travMatch = code.match(/X(\d+),(\d+)$/i)
  if (travMatch) {
    const integer = parseInt(travMatch[1], 10)
    const decimal = parseInt(travMatch[2], 10)
    return parseFloat(`${integer}.${decimal}`)
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
export function analyzeProduct(code: string, category?: string | null, name?: string | null): ProductFamily {
  return {
    familyCode: extractFamilyCode(code),
    size: extractSizeFromCode(code),
    isChapa: isChapaProduct(code, category, name)
  }
}
