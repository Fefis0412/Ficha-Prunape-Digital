import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  catalogo as catalogoPorDefecto,
  xDeMeses,
  type Catalogo,
  type ItemCatalogo,
  type Marca,
  type Respuestas,
} from '@/lib/catalogo'
import './ficha.css'

/* ── medición de etiquetas ────────────────────────────────────────────────
   El original condensa el texto al 82% y lo mete dentro de la barra sólo si
   entra. Para decidirlo hay que saber cuánto mide. Se mide una vez con un
   canvas en lugar de tocar el DOM 79 veces por render.                     */
const ESCALA_TEXTO = 0.82
const ESPACIADO = 0.2
let ctx: CanvasRenderingContext2D | null = null
const cacheAncho = new Map<string, number>()

function anchoTexto(linea: string): number {
  const hit = cacheAncho.get(linea)
  if (hit !== undefined) return hit
  if (!ctx) {
    const c = document.createElement('canvas')
    ctx = c.getContext('2d')
    if (ctx) ctx.font = '30px Arial, Helvetica, sans-serif'
  }
  const w = ctx
    ? (ctx.measureText(linea).width + ESPACIADO * Math.max(0, linea.length - 1)) * ESCALA_TEXTO
    : linea.length * 15 * ESCALA_TEXTO
  cacheAncho.set(linea, w)
  return w
}

const anchoEtiqueta = (lineas: string[]) => Math.max(...lineas.map(anchoTexto))

interface Disposicion {
  item: ItemCatalogo
  /** x donde arranca el texto */
  textoX: number
  /** x de la divisoria interna, o null si no entra */
  divX: number | null
  /** borde derecho ocupado (barra o etiqueta desbordada) */
  finX: number
  colaX: number | null
}

function disponer(cat: Catalogo): Disposicion[] {
  return cat.items.map((item) => {
    const { x0, x1, div, texto } = item.geom
    const ancho = anchoEtiqueta(item.etiqueta)
    let textoX = x0 + 9
    let divX: number | null = null

    if (texto != null) {
      textoX = texto
    } else if (div != null && div > x0 + 30 && div + 9 + ancho <= x1 - 8) {
      textoX = div + 9
      divX = div
    }

    const finEtiqueta = textoX + ancho
    let colaX: number | null = null
    if (item.notas.cola) {
      const verde = item.geom.verde ?? x0
      colaX = Math.max((verde + x1) / 2, finEtiqueta + 20 + anchoTexto(item.notas.cola) / 2)
    }
    const finX = Math.max(x1, finEtiqueta, colaX ? colaX + anchoTexto(item.notas.cola!) / 2 : 0)
    return { item, textoX, divX, finX, colaX }
  })
}

/* ── componente ──────────────────────────────────────────────────────────── */

export interface DatosCabecera {
  examinador: string
  paciente: string
  historiaClinica: string
  edadGestacional: string
  fechaNacimiento: string
  fechaPesquisa: string
  edadPostnatal: string
  edadCorregida: string
}

export interface FichaPrunapeProps {
  respuestas: Respuestas
  /** Edad corregida en meses. Dibuja la línea roja sobre el gráfico. */
  mesesCorregidos?: number | null
  cabecera?: DatosCabecera
  catalogo?: Catalogo
  soloLectura?: boolean
  onToggle?: (itemId: string, siguiente: Marca | null) => void
  /** Ancho máximo en pantalla. En impresión se ignora. */
  anchoMaximo?: number
}

const SIGUIENTE: Record<string, Marca | null> = { '': 'pasa', pasa: 'no_pasa', no_pasa: null }

export function FichaPrunape({
  respuestas,
  mesesCorregidos,
  cabecera,
  catalogo = catalogoPorDefecto,
  soloLectura = false,
  onToggle,
  anchoMaximo = 1700,
}: FichaPrunapeProps) {
  const disposicion = useMemo(() => disponer(catalogo), [catalogo])
  const marco = catalogo.eje.marco

  /* la hoja se dimensiona para dejar el mismo aire blanco a ambos lados */
  const { anchoHoja, corrimiento, altoHoja } = useMemo(() => {
    const m = catalogo.lienzo.margen
    const min = Math.min(318, ...disposicion.map((d) => d.item.geom.x0))
    const max = Math.max(...disposicion.map((d) => d.finX), marco.x1, 3481)
    return { anchoHoja: Math.round(max - min + m * 2), corrimiento: Math.round(m - min), altoHoja: catalogo.lienzo.alto }
  }, [catalogo, disposicion, marco])

  const contenedor = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.4)

  useLayoutEffect(() => {
    const ajustar = () => {
      const vw = document.documentElement.clientWidth
      const disponible = contenedor.current?.parentElement?.clientWidth ?? vw
      const pad = Math.max(16, Math.min(64, vw * 0.03))
      setEscala(Math.min(1, anchoMaximo / anchoHoja, (disponible - pad * 2) / anchoHoja))
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [anchoHoja, anchoMaximo])

  const lineaEdadX = mesesCorregidos != null ? xDeMeses(mesesCorregidos, catalogo) : null

  const click = (item: ItemCatalogo) => {
    if (soloLectura || !onToggle) return
    onToggle(item.id, SIGUIENTE[respuestas[item.id] ?? ''])
  }

  return (
    <div
      className="ficha-envoltorio"
      ref={contenedor}
      style={{ width: anchoHoja * escala, height: altoHoja * escala }}
    >
      <div
        className="ficha-hoja"
        style={{ width: anchoHoja, height: altoHoja, transform: `scale(${escala})` }}
      >
        <div className="ficha-capa" style={{ left: corrimiento }}>
          <Cabecera datos={cabecera} />

          <div
            className="ficha-marco"
            style={{
              left: marco.x0, top: marco.y0,
              width: marco.x1 - marco.x0, height: marco.y1 - marco.y0,
            }}
          />
          <Eje catalogo={catalogo} y={896} numerosY={856} />
          <Eje catalogo={catalogo} y={marco.y1} numerosY={4650} />

          <div className="ficha-txt b" style={{ left: 688, top: 4693, fontSize: 50 }}>MESES</div>
          <div className="ficha-txt b" style={{ left: 2983, top: 4693, fontSize: 50 }}>AÑOS</div>
          <div className="ficha-txt" style={{ left: 1839, top: 4468, fontSize: 52 }}>EDAD</div>

          {catalogo.areas.map((a) => {
            const alto = a.y1 - a.y0
            return (
              <div key={a.id} className="ficha-area"
                style={{ left: 345 - alto / 2, top: (a.y0 + a.y1) / 2 - 30, width: alto }}>
                {a.nombre}
              </div>
            )
          })}

          <Leyenda />

          {disposicion.map(({ item, textoX, divX, colaX }) => {
            const marca = respuestas[item.id]
            const ancho = item.geom.x1 - item.geom.x0
            return (
              <div
                key={item.id}
                className={`ficha-barra${marca ? ' ' + marca : ''}${soloLectura ? ' ficha-fija' : ''}`}
                style={{ left: item.geom.x0, top: item.geom.y - 3, width: ancho }}
                onClick={() => click(item)}
                data-item={item.id}
                data-marca={marca ?? ''}
                role={soloLectura ? undefined : 'button'}
                tabIndex={soloLectura ? undefined : 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(item) }
                }}
                aria-label={`${item.etiqueta.join(' ')} · ${marca ?? 'sin marcar'}`}
              >
                {item.geom.verde != null && (
                  <div className="ficha-verde" style={{ left: Math.max(0, item.geom.verde - item.geom.x0) }} />
                )}
                {divX != null && <div className="ficha-div" style={{ left: divX - item.geom.x0 }} />}
                <div className="ficha-lbl" style={{ left: textoX - item.geom.x0 }}>
                  {item.etiqueta.map((l, i) => <div key={i} className="ficha-linea">{l}</div>)}
                </div>
                {item.notas.izq && <Nota texto={item.notas.izq} lado="izq" />}
                {item.notas.der && <Nota texto={item.notas.der} lado="der" ancho={ancho} />}
                {item.notas.cola && colaX != null && (
                  <div className="ficha-cola" style={{ left: colaX - item.geom.x0 }}>{item.notas.cola}</div>
                )}
                {marca && <div className="ficha-marca">{marca === 'pasa' ? '✓' : '✗'}</div>}
              </div>
            )
          })}

          {lineaEdadX != null && (
            <>
              <div className="ficha-edad-linea"
                style={{ left: lineaEdadX, top: marco.y0, height: marco.y1 - marco.y0 }} />
              <div className="ficha-edad-rotulo"
                style={{ left: Math.min(lineaEdadX + 12, anchoHoja - 700), top: marco.y0 + 12 }}>
                edad corregida: {mesesCorregidos!.toFixed(1)} meses
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── piezas ──────────────────────────────────────────────────────────────── */

function Nota({ texto, lado, ancho = 0 }: { texto: string; lado: 'izq' | 'der'; ancho?: number }) {
  const w = anchoTexto(texto)
  return (
    <div className="ficha-nota" style={{ left: lado === 'izq' ? -(w + 14) : ancho + 16 }}>
      {texto}
    </div>
  )
}

function Eje({ catalogo, y, numerosY }: { catalogo: Catalogo; y: number; numerosY: number }) {
  return (
    <>
      {catalogo.eje.puntos.map((p, i) => (
        <div key={`M${p.x}`}>
          <div className="ficha-tick" style={{ left: p.x - 1, top: y, height: 46 }} />
          {i > 0 && (
            <div className="ficha-axnum" style={{ left: p.x - 60, top: numerosY, width: 120 }}>
              {p.meses >= 24 ? p.meses / 12 : p.meses}
            </div>
          )}
        </div>
      ))}
      {catalogo.eje.menores.map((x) => (
        <div key={`m${x}${y}`} className="ficha-tick" style={{ left: x - 1, top: y + 18, height: 28 }} />
      ))}
    </>
  )
}

function Leyenda() {
  return (
    <>
      <div className="ficha-txt" style={{ left: 501, top: 1040, fontSize: 44 }}>
        Percentilos de edad de cumplimiento
      </div>
      {([['25', 606], ['50', 678], ['75', 762], ['90', 890]] as const).map(([n, x]) => (
        <div key={n} className="ficha-txt" style={{ left: x, top: 1096, fontSize: 30 }}>{n}</div>
      ))}
      <div className="ficha-barra ficha-fija" style={{ left: 615, top: 1147, width: 300 }}>
        <div className="ficha-verde" style={{ left: 161 }} />
        <div className="ficha-div" style={{ left: 63, top: 6, height: 22, bottom: 'auto' }} />
      </div>
    </>
  )
}

function Cabecera({ datos }: { datos?: DatosCabecera }) {
  const d = datos
  const campos: [string, number, string][] = [
    ['Examinador/a:', 465, d?.examinador ?? ''],
    ['Nombre del niño/a:', 558, d?.paciente ?? ''],
    ['N° de H. Clínica:', 655, d?.historiaClinica ?? ''],
    ['Edad gestacional (semanas):', 752, d?.edadGestacional ?? ''],
  ]
  const derecha: [string, number, string][] = [
    ['Fecha de Nacimiento:', 465, d?.fechaNacimiento ?? ''],
    ['Fecha de la Pesquisa:', 558, d?.fechaPesquisa ?? ''],
    ['Edad postnatal:', 700, d?.edadPostnatal ?? ''],
    ['Edad corregida:', 790, d?.edadCorregida ?? ''],
  ]
  return (
    <>
      <div className="ficha-txt b" style={{ left: 1222, top: 238, fontSize: 62 }}>
        PRUEBA NACIONAL DE PESQUISA - PRUNAPE
      </div>
      <div className="ficha-txt" style={{ left: 1722, top: 326, fontSize: 44 }}>
        Formulario de Aplicación
      </div>
      <div className="ficha-regla" style={{ left: 340, top: 388, width: 3082 }} />

      {campos.map(([rotulo, top, valor]) => (
        <div key={rotulo}>
          <div className="ficha-txt b" style={{ left: 409, top, fontSize: 46 }}>{rotulo}</div>
          <div className="ficha-dato" style={{ left: 1060, top: top - 2, width: 738 }}>{valor}</div>
          <div className="ficha-subrayado" style={{ left: 1060, top: top + 52, width: 738 }} />
        </div>
      ))}

      <div className="ficha-txt" style={{ left: 2873, top: 414, fontSize: 34 }}>día</div>
      <div className="ficha-txt" style={{ left: 3032, top: 414, fontSize: 34 }}>mes</div>
      <div className="ficha-txt" style={{ left: 3218, top: 414, fontSize: 34 }}>año</div>
      <div className="ficha-txt" style={{ left: 2839, top: 637, fontSize: 34 }}>años</div>
      <div className="ficha-txt" style={{ left: 2990, top: 637, fontSize: 34 }}>meses</div>
      <div className="ficha-txt" style={{ left: 3176, top: 637, fontSize: 34 }}>días</div>

      {derecha.map(([rotulo, top, valor]) => (
        <div key={rotulo}>
          <div className="ficha-txt b" style={{ left: 2276, top, fontSize: 46 }}>{rotulo}</div>
          <div className="ficha-dato" style={{ left: 2800, top: top - 2, width: 516 }}>{valor}</div>
          <div className="ficha-subrayado" style={{ left: 2800, top: top + 52, width: 516 }} />
        </div>
      ))}
    </>
  )
}

/** Dispara el diálogo de impresión con la ficha escalada a una hoja A4. */
export function useImprimir(anchoHoja: number, altoHoja: number) {
  useEffect(() => {
    const antes = () => {
      document.documentElement.style.setProperty(
        '--escala-impresion',
        String(Math.min(718 / anchoHoja, 1035 / altoHoja)),
      )
    }
    window.addEventListener('beforeprint', antes)
    return () => window.removeEventListener('beforeprint', antes)
  }, [anchoHoja, altoHoja])
}
