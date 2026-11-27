import { describe, expect, it } from 'vitest'
import { cleanEvoDescription, descriptionsByProduct, lineDisplayName } from '../line-description'

describe('cleanEvoDescription', () => {
  it('quita los espacios sobrantes y conserva el texto de EVO', () => {
    expect(cleanEvoDescription('Kg.Tubos Estr.L.F.0.9mm 15x15 c/ Ud: 31.200 ')).toBe('Kg.Tubos Estr.L.F.0.9mm 15x15 c/ Ud: 31.200')
    expect(cleanEvoDescription('CH.SINUSOIDAL  CINC.25 X 5,5 M')).toBe('CH.SINUSOIDAL CINC.25 X 5,5 M')
  })
  it('vacía o ausente → null', () => {
    expect(cleanEvoDescription('   ')).toBeNull()
    expect(cleanEvoDescription(undefined)).toBeNull()
    expect(cleanEvoDescription(12)).toBeNull()
  })
})

describe('lineDisplayName', () => {
  it('usa la descripción de EVO si la hay', () => {
    expect(lineDisplayName({ evo_description: 'Kg.Tubos c/ Ud: 31.200' }, { name: 'Kg.Tubos', code: 'CUA' })).toBe('Kg.Tubos c/ Ud: 31.200')
  })
  it('si no, el nombre del producto y luego el código', () => {
    expect(lineDisplayName({ evo_description: null }, { name: 'Chapa', code: 'AC' })).toBe('Chapa')
    expect(lineDisplayName(null, { code: 'AC' })).toBe('AC')
  })
})

describe('descriptionsByProduct', () => {
  it('se queda con la primera descripción de cada producto', () => {
    const m = descriptionsByProduct([
      { product_id: 'a', evo_description: null },
      { product_id: 'a', evo_description: 'uno' },
      { product_id: 'a', evo_description: 'dos' },
      { product_id: 'b', evo_description: 'tres' },
    ])
    expect(m.get('a')).toBe('uno')
    expect(m.get('b')).toBe('tres')
  })
})
