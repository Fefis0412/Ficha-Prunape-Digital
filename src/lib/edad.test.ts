import { describe, expect, it } from 'vitest'
import {
  correccionDias, descomponer, diasEntre, edadCorregida, edadPostnatal,
  esPrematuro, fecha, formatoCorto, formatoLargo,
} from './edad'

describe('diasEntre', () => {
  it('cuenta días calendario', () => {
    expect(diasEntre(fecha('2026-01-01'), fecha('2026-01-31'))).toBe(30)
  })
  it('no se corre por cambio de horario de verano', () => {
    // Bolivia no aplica DST, pero el test protege ante cambios de huso
    expect(diasEntre(fecha('2026-03-01'), fecha('2026-04-01'))).toBe(31)
    expect(diasEntre(fecha('2026-10-01'), fecha('2026-11-01'))).toBe(31)
  })
  it('da 0 el mismo día', () => {
    expect(diasEntre(fecha('2026-05-05'), fecha('2026-05-05'))).toBe(0)
  })
  it('atraviesa años bisiestos', () => {
    expect(diasEntre(fecha('2024-02-28'), fecha('2024-03-01'))).toBe(2)
  })
})

describe('correccionDias', () => {
  it('no corrige a los nacidos de término', () => {
    expect(correccionDias(40)).toBe(0)
    expect(correccionDias(37)).toBe(0)
    expect(correccionDias(41)).toBe(0)
  })
  it('corrige a los prematuros', () => {
    expect(correccionDias(34)).toBe(42) // 6 semanas
    expect(correccionDias(28)).toBe(84) // 12 semanas
  })
  it('no corrige si falta el dato', () => {
    expect(correccionDias(null)).toBe(0)
    expect(correccionDias(undefined)).toBe(0)
    expect(correccionDias(NaN)).toBe(0)
  })
  it('ignora valores absurdos', () => {
    expect(correccionDias(0)).toBe(0)
    expect(correccionDias(-5)).toBe(0)
  })
  it('acepta semanas fraccionarias', () => {
    expect(correccionDias(34.5)).toBe(39)
  })
})

describe('edadPostnatal y edadCorregida', () => {
  const nac = fecha('2024-03-15')
  const pes = fecha('2026-08-27')

  it('caso verificado contra la ficha en papel', () => {
    const post = edadPostnatal(nac, pes)
    expect([post.anios, post.meses, post.diasResto]).toEqual([2, 5, 12])

    const corr = edadCorregida(nac, pes, 34)
    expect([corr.anios, corr.meses, corr.diasResto]).toEqual([2, 4, 1])
  })

  it('sin edad gestacional, corregida = postnatal', () => {
    expect(edadCorregida(nac, pes, null).dias).toBe(edadPostnatal(nac, pes).dias)
  })

  it('nunca da edad negativa aunque la prematurez supere la edad', () => {
    const recien = edadCorregida(fecha('2026-09-01'), fecha('2026-09-05'), 28)
    expect(recien.dias).toBe(0)
    expect(recien.mesesDecimal).toBe(0)
  })

  it('la corregida siempre es menor o igual que la postnatal', () => {
    for (const eg of [26, 30, 34, 36, 37, 40]) {
      expect(edadCorregida(nac, pes, eg).dias).toBeLessThanOrEqual(edadPostnatal(nac, pes).dias)
    }
  })
})

describe('descomponer', () => {
  it('reparte en años, meses y días', () => {
    const e = descomponer(400)
    expect(e.anios).toBe(1)
    expect(e.dias).toBe(400)
  })
  it('trata los negativos como cero', () => {
    expect(descomponer(-10).dias).toBe(0)
  })
  it('mesesDecimal sirve para ubicar sobre el eje', () => {
    expect(descomponer(365).mesesDecimal).toBeCloseTo(11.99, 1)
  })
})

describe('formato', () => {
  it('corto', () => {
    expect(formatoCorto(descomponer(0))).toBe('0 d')
    expect(formatoCorto(descomponer(60))).toBe('1 m')
    expect(formatoCorto(descomponer(400))).toBe('1 a 1 m')
  })
  it('largo usa singular y plural', () => {
    expect(formatoLargo(descomponer(400))).toBe('1 año 1 mes')
    expect(formatoLargo(descomponer(800))).toBe('2 años 2 meses')
    expect(formatoLargo(descomponer(3))).toBe('3 días')
    expect(formatoLargo(descomponer(1))).toBe('1 día')
  })
})

describe('esPrematuro', () => {
  it('marca solo por debajo de 37 semanas', () => {
    expect(esPrematuro(36.9)).toBe(true)
    expect(esPrematuro(37)).toBe(false)
    expect(esPrematuro(null)).toBe(false)
  })
})
