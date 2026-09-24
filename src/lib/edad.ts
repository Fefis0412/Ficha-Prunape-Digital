/**
 * Cálculo de edad para el PRUNAPE.
 *
 * Dos edades distintas y ambas importan:
 *  · postnatal  — la que cumple el niño en el calendario
 *  · corregida  — descontando la prematurez; es la que se usa para ubicar
 *                 la línea de edad sobre el gráfico
 *
 * Los resultados se GUARDAN calculados en cada evaluación. Si mañana cambia
 * la regla de corrección, las evaluaciones históricas no deben mutar.
 */

/** Días promedio por mes (365.25 / 12). Se usa para descomponer, no para posicionar. */
export const DIAS_POR_MES = 30.4375
export const DIAS_POR_ANIO = 365.25

/** Gestación de término. Por debajo de esto se corrige la edad. */
export const SEMANAS_TERMINO = 40
export const SEMANAS_PREMATURO = 37

export interface Edad {
  /** Total de días. Es lo que se persiste. */
  dias: number
  anios: number
  meses: number
  diasResto: number
  /** Meses decimales; es lo que ubica la línea sobre el eje del gráfico. */
  mesesDecimal: number
}

/** Parsea 'YYYY-MM-DD' sin que el huso horario corra el día. */
export function fecha(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function aISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function diasEntre(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  return Math.round((b - a) / 86_400_000)
}

export function descomponer(dias: number): Edad {
  const d = Math.max(0, Math.round(dias))
  const anios = Math.floor(d / DIAS_POR_ANIO)
  const resto = d - anios * DIAS_POR_ANIO
  const meses = Math.floor(resto / DIAS_POR_MES)
  const diasResto = Math.round(resto - meses * DIAS_POR_MES)
  return { dias: d, anios, meses, diasResto, mesesDecimal: d / DIAS_POR_MES }
}

/** Días a descontar por prematurez. Cero si es de término o no se conoce la EG. */
export function correccionDias(egSemanas: number | null | undefined): number {
  if (egSemanas == null || !Number.isFinite(egSemanas)) return 0
  if (egSemanas <= 0 || egSemanas >= SEMANAS_PREMATURO) return 0
  return Math.round((SEMANAS_TERMINO - egSemanas) * 7)
}

export function edadPostnatal(nacimiento: Date, pesquisa: Date): Edad {
  return descomponer(diasEntre(nacimiento, pesquisa))
}

export function edadCorregida(
  nacimiento: Date,
  pesquisa: Date,
  egSemanas: number | null | undefined,
): Edad {
  const brutos = diasEntre(nacimiento, pesquisa)
  return descomponer(Math.max(0, brutos - correccionDias(egSemanas)))
}

/** '2 a 3 m' · formato corto para listados */
export function formatoCorto(e: Edad): string {
  if (e.anios === 0 && e.meses === 0) return `${e.diasResto} d`
  if (e.anios === 0) return `${e.meses} m`
  return e.meses === 0 ? `${e.anios} a` : `${e.anios} a ${e.meses} m`
}

/** '2 años 3 meses' · formato largo para encabezados */
export function formatoLargo(e: Edad): string {
  const p: string[] = []
  if (e.anios) p.push(`${e.anios} ${e.anios === 1 ? 'año' : 'años'}`)
  if (e.meses) p.push(`${e.meses} ${e.meses === 1 ? 'mes' : 'meses'}`)
  if (!p.length) p.push(`${e.diasResto} ${e.diasResto === 1 ? 'día' : 'días'}`)
  return p.join(' ')
}

export function esPrematuro(egSemanas: number | null | undefined): boolean {
  return correccionDias(egSemanas) > 0
}
