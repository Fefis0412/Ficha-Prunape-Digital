import { catalogo, esperableA, type Catalogo, type Respuestas } from './catalogo'

export type Veredicto = 'sin_datos' | 'pasa' | 'derivar'

export interface Resultado {
  /** Ítems tipo A (marcados con ✱ en la ficha) que el niño no pasó. */
  fallosA: number
  /** Ítems tipo B que no pasó. */
  fallosB: number
  pasados: number
  marcados: number
  /** Ítems esperables a esta edad que quedaron sin marcar. */
  sinMarcarEsperables: number
  veredicto: Veredicto
}

/**
 * Criterio de fracaso del PRUNAPE: falla la pesquisa si el niño no pasa
 * al menos un ítem tipo A, o al menos dos ítems tipo B.
 *
 * Es una ayuda de cálculo: la interpretación final es del profesional y
 * debe contrastarse con el manual.
 */
export const REGLA = { minFallosA: 1, minFallosB: 2 } as const

export function calcularResultado(
  respuestas: Respuestas,
  mesesCorregidos: number,
  cat: Catalogo = catalogo,
): Resultado {
  let fallosA = 0, fallosB = 0, pasados = 0, sinMarcarEsperables = 0

  for (const item of cat.items) {
    const marca = respuestas[item.id]
    if (marca === 'pasa') {
      pasados++
    } else if (marca === 'no_pasa') {
      if (item.tipo === 'A') fallosA++
      else fallosB++
    } else if (esperableA(item, mesesCorregidos)) {
      sinMarcarEsperables++
    }
  }

  const marcados = pasados + fallosA + fallosB
  const veredicto: Veredicto =
    marcados === 0 ? 'sin_datos'
    : fallosA >= REGLA.minFallosA || fallosB >= REGLA.minFallosB ? 'derivar'
    : 'pasa'

  return { fallosA, fallosB, pasados, marcados, sinMarcarEsperables, veredicto }
}

export const ETIQUETA_VEREDICTO: Record<Veredicto, string> = {
  sin_datos: 'Sin marcar',
  pasa: 'Pasa',
  derivar: 'Criterio de fracaso',
}
