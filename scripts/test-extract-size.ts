import { extractSizeFromCode } from '../lib/product-utils'

const testCodes = [
  'A*G25110.12,0',
  'A*G25110.10,0',
  'A*G25110.8,0',
  'ACPOLI.CR.10.0',
  'TC25110.0,5',
]

console.log('🧪 Probando extractSizeFromCode:\n')

testCodes.forEach(code => {
  const size = extractSizeFromCode(code)
  console.log(`${code} → ${size}m`)
})
