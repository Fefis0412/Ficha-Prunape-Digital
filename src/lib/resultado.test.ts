import { describe, expect, it } from 'vitest'
import { calcularResultado } from './resultado'
import { catalogo, esperableA, xDeMeses, type Respuestas } from './catalogo'

const tipoA = catalogo.items.filter((i) => i.tipo === 'A')
const tipoB = catalogo.items.filter((i) => i.tipo === 'B')

describe('catálogo', () => {
  it('tiene los 79 ítems de la ficha', () => {
    expect(catalogo.items).toHaveLength(79)
  })
  it('reparte las áreas como el PRUNAPE', () => {
    const cuenta = (a: string) => catalogo.items.filter((i) => i.area === a).length
    expect(cuenta('personal_social')).toBe(18)
    expect(cuenta('motor_fino')).toBe(19)
    expect(cuenta('lenguaje')).toBe(19)
    expect(cuenta('motor_grueso')).toBe(23)
  })
  it('no repite identificadores', () => {
    expect(new Set(catalogo.items.map((i) => i.id)).size).toBe(79)
  })
  it('los percentilos van en orden creciente', () => {
    for (const i of catalogo.items) {
      const { p25, p50, p75, p90 } = i.edad_meses
      expect(p90).toBeGreaterThanOrEqual(p25)
      if (p50 != null) { expect(p50).toBeGreaterThanOrEqual(p25); expect(p90).toBeGreaterThanOrEqual(p50) }
      if (p75 != null) expect(p90).toBeGreaterThanOrEqual(p75)
    }
  })
  it('todo ítem tiene al menos una línea de etiqueta', () => {
    for (const i of catalogo.items) {
      expect(i.etiqueta.length).toBeGreaterThan(0)
      expect(i.etiqueta.join('').trim().length).toBeGreaterThan(0)
    }
  })
})

describe('xDeMeses', () => {
  it('respeta los puntos del eje', () => {
    for (const p of catalogo.eje.puntos) expect(xDeMeses(p.meses)).toBeCloseTo(p.x, 0)
  })
  it('es monótona creciente', () => {
    let previo = -Infinity
    for (let m = 0; m <= 72; m += 0.5) {
      const x = xDeMeses(m)
      expect(x).toBeGreaterThanOrEqual(previo)
      previo = x
    }
  })
  it('satura fuera de rango', () => {
    expect(xDeMeses(-10)).toBe(catalogo.eje.puntos[0].x)
    expect(xDeMeses(500)).toBe(catalogo.eje.puntos.at(-1)!.x)
  })
})

describe('calcularResultado', () => {
  it('sin marcas no emite veredicto', () => {
    const r = calcularResultado({}, 24)
    expect(r.veredicto).toBe('sin_datos')
    expect(r.marcados).toBe(0)
  })

  it('un solo fallo tipo A ya alcanza el criterio de fracaso', () => {
    const r = calcularResultado({ [tipoA[0].id]: 'no_pasa' }, 24)
    expect(r.fallosA).toBe(1)
    expect(r.veredicto).toBe('derivar')
  })

  it('un solo fallo tipo B no alcanza', () => {
    const r = calcularResultado({ [tipoB[0].id]: 'no_pasa' }, 24)
    expect(r.fallosB).toBe(1)
    expect(r.veredicto).toBe('pasa')
  })

  it('dos fallos tipo B alcanzan', () => {
    const r = calcularResultado(
      { [tipoB[0].id]: 'no_pasa', [tipoB[1].id]: 'no_pasa' }, 24,
    )
    expect(r.fallosB).toBe(2)
    expect(r.veredicto).toBe('derivar')
  })

  it('cuenta los pasados sin confundirlos con fallos', () => {
    const r = calcularResultado(
      { [tipoA[0].id]: 'pasa', [tipoB[0].id]: 'pasa', [tipoB[1].id]: 'no_pasa' }, 24,
    )
    expect(r.pasados).toBe(2)
    expect(r.fallosA).toBe(0)
    expect(r.fallosB).toBe(1)
    expect(r.veredicto).toBe('pasa')
  })

  it('ignora identificadores que no existen en el catálogo', () => {
    const r = calcularResultado({ 'item-fantasma': 'no_pasa' } as Respuestas, 24)
    expect(r.marcados).toBe(0)
    expect(r.veredicto).toBe('sin_datos')
  })

  it('cuenta los esperables sin marcar según la edad', () => {
    const bebe = calcularResultado({ [tipoA[0].id]: 'pasa' }, 1)
    const grande = calcularResultado({ [tipoA[0].id]: 'pasa' }, 72)
    expect(grande.sinMarcarEsperables).toBeGreaterThan(bebe.sinMarcarEsperables)
  })

  it('a los 72 meses casi todo el catálogo es esperable', () => {
    const r = calcularResultado({}, 72)
    expect(r.sinMarcarEsperables).toBeGreaterThan(70)
  })
})

describe('esperableA', () => {
  it('un ítem de recién nacido es esperable a cualquier edad mayor', () => {
    const temprano = [...catalogo.items].sort((a, b) => a.edad_meses.p90 - b.edad_meses.p90)[0]
    expect(esperableA(temprano, 12)).toBe(true)
  })
  it('un ítem de 5 años no es esperable en un bebé', () => {
    const tardio = [...catalogo.items].sort((a, b) => b.edad_meses.p90 - a.edad_meses.p90)[0]
    expect(esperableA(tardio, 2)).toBe(false)
  })
})
