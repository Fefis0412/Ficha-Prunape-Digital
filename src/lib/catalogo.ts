import bruto from '@/data/catalogo-v1.json'

export type AreaId = 'personal_social' | 'motor_fino' | 'lenguaje' | 'motor_grueso'
export type TipoItem = 'A' | 'B'
/** Estado de un ítem dentro de una evaluación. Ausente = sin marcar. */
export type Marca = 'pasa' | 'no_pasa'
export type Respuestas = Record<string, Marca>

export interface ItemCatalogo {
  id: string
  n: number
  area: AreaId
  etiqueta: string[]
  tipo: TipoItem
  edad_meses: { p25: number; p50: number | null; p75: number | null; p90: number }
  notas: { izq: string | null; der: string | null; cola: string | null }
  geom: {
    x0: number; x1: number; y: number
    verde: number | null; div: number | null; texto: number | null
  }
}

export interface Catalogo {
  version: number
  nombre: string
  lienzo: { ancho: number; alto: number; margen: number }
  eje: {
    puntos: { meses: number; x: number }[]
    menores: number[]
    marco: { x0: number; y0: number; x1: number; y1: number }
  }
  areas: { id: AreaId; nombre: string; y0: number; y1: number }[]
  items: ItemCatalogo[]
}

export const catalogo = bruto as unknown as Catalogo

export const NOMBRE_AREA: Record<AreaId, string> = {
  personal_social: 'Personal-Social',
  motor_fino: 'Motor fino',
  lenguaje: 'Lenguaje',
  motor_grueso: 'Motor grueso',
}

/** Convierte meses de edad a la coordenada x del eje (escala no lineal). */
export function xDeMeses(meses: number, cat: Catalogo = catalogo): number {
  const p = cat.eje.puntos
  if (meses <= p[0].meses) return p[0].x
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i]
    if (meses <= b.meses) return a.x + ((b.x - a.x) * (meses - a.meses)) / (b.meses - a.meses)
  }
  return p[p.length - 1].x
}

/**
 * Un ítem es "esperable" a esta edad si la edad ya superó el percentil 75,
 * que es donde arranca el tramo verde. Es lo que usa la pantalla para
 * avisar que quedan ítems sin marcar dentro del rango.
 */
export function esperableA(item: ItemCatalogo, mesesCorregidos: number): boolean {
  return mesesCorregidos >= (item.edad_meses.p75 ?? item.edad_meses.p90)
}

export function itemsPorId(cat: Catalogo = catalogo): Map<string, ItemCatalogo> {
  return new Map(cat.items.map((i) => [i.id, i]))
}
