import { useCallback, useEffect, useRef, useState } from 'react'
import { FichaPrunape, type FichaPrunapeProps } from './FichaPrunape'
import { xDeMeses } from '@/lib/catalogo'
import './visor-ficha.css'

/**
 * Visor con zoom y desplazamiento para la ficha.
 *
 * La ficha mide casi 3800 px de ancho: en un celular hay que poder acercarse
 * para leer y moverse para recorrerla. Acá se maneja eso con los gestos que
 * ya conoce cualquiera de las fotos: pellizcar para acercar, arrastrar para
 * moverse, tocar dos veces para acercar de golpe.
 *
 * Tocar una barra la marca. La diferencia entre "tocar" y "arrastrar" se
 * decide por cuánto se movió el dedo: si se movió poco, fue un toque.
 */

const MIN = 0.08
const MAX = 1.1
/** Cuánto puede moverse el dedo y seguir contando como toque, en píxeles. */
const TOLERANCIA_TOQUE = 8

interface Punto { x: number; y: number }

export interface VisorFichaProps extends Omit<FichaPrunapeProps, 'escalaFija' | 'onMedidas' | 'anchoMaximo'> {
  /** Alto del visor. Por defecto ocupa el alto disponible. */
  alto?: number | string
}

export function VisorFicha({ alto = '100%', ...props }: VisorFichaProps) {
  const marco = useRef<HTMLDivElement>(null)
  const [medidas, setMedidas] = useState({ ancho: 3799, alto: 4925 })
  const [escala, setEscala] = useState(0.35)
  const [pos, setPos] = useState<Punto>({ x: 0, y: 0 })
  const [listo, setListo] = useState(false)

  const punteros = useRef(new Map<number, Punto>())
  const inicio = useRef<{ dist: number; escala: number; centro: Punto; pos: Punto } | null>(null)
  const recorrido = useRef(0)
  const arrastro = useRef(false)
  const ultimoToque = useRef(0)

  const onMedidas = useCallback((m: { ancho: number; alto: number }) => setMedidas(m), [])

  const caja = () => marco.current?.getBoundingClientRect()

  /** Mantiene la hoja dentro de cuadro, dejando un respiro en los bordes. */
  const encuadrar = useCallback((p: Punto, e: number): Punto => {
    const c = caja()
    if (!c) return p
    const w = medidas.ancho * e, h = medidas.alto * e
    const aire = 60
    const minX = w > c.width ? c.width - w - aire : -aire
    const maxX = w > c.width ? aire : c.width - w + aire
    const minY = h > c.height ? c.height - h - aire : -aire
    const maxY = h > c.height ? aire : c.height - h + aire
    return {
      x: Math.min(maxX, Math.max(minX, p.x)),
      y: Math.min(maxY, Math.max(minY, p.y)),
    }
  }, [medidas])

  /** Cambia el zoom dejando quieto el punto indicado (el de los dedos). */
  const zoomEn = useCallback((nueva: number, foco: Punto) => {
    setEscala((previa) => {
      const e = Math.min(MAX, Math.max(MIN, nueva))
      setPos((p) => encuadrar({
        x: foco.x - (foco.x - p.x) * (e / previa),
        y: foco.y - (foco.y - p.y) * (e / previa),
      }, e))
      return e
    })
  }, [encuadrar])

  const escalaDeAjuste = useCallback(() => {
    const c = caja()
    return c ? Math.max(MIN, c.width / medidas.ancho) : MIN
  }, [medidas])

  const ajustar = useCallback(() => {
    const c = caja()
    if (!c) return
    const e = escalaDeAjuste()
    setEscala(e)
    setPos({ x: (c.width - medidas.ancho * e) / 2, y: 0 })
  }, [escalaDeAjuste, medidas])

  /** Centra la vista en la línea de edad, que es donde están los ítems que importan. */
  const irALaEdad = useCallback((e = escala) => {
    const c = caja()
    if (!c || props.mesesCorregidos == null) return
    const x = xDeMeses(props.mesesCorregidos)
    const y = medidas.alto * 0.42
    setPos(encuadrar({ x: c.width / 2 - x * e, y: c.height / 2 - y * e }, e))
  }, [escala, props.mesesCorregidos, medidas, encuadrar])

  /* Al abrir: un zoom en el que se lee, centrado en la edad del niño. */
  useEffect(() => {
    if (listo) return
    const c = caja()
    if (!c || !c.width) return
    const e = Math.min(0.42, Math.max(escalaDeAjuste(), 0.3))
    setEscala(e)
    if (props.mesesCorregidos != null) {
      const x = xDeMeses(props.mesesCorregidos)
      setPos(encuadrar({ x: c.width / 2 - x * e, y: c.height * 0.3 - medidas.alto * 0.42 * e }, e))
    } else {
      setPos({ x: (c.width - medidas.ancho * e) / 2, y: 0 })
    }
    setListo(true)
  }, [listo, medidas, escalaDeAjuste, encuadrar, props.mesesCorregidos])

  /* ── gestos ────────────────────────────────────────────────────────────── */

  const relativo = (e: React.PointerEvent): Punto => {
    const c = caja()!
    return { x: e.clientX - c.left, y: e.clientY - c.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    punteros.current.set(e.pointerId, relativo(e))
    recorrido.current = 0
    arrastro.current = false
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()]
      inicio.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        escala,
        centro: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        pos,
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!punteros.current.has(e.pointerId)) return
    const previo = punteros.current.get(e.pointerId)!
    const actual = relativo(e)
    punteros.current.set(e.pointerId, actual)

    if (punteros.current.size === 2 && inicio.current) {
      const [a, b] = [...punteros.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const e2 = Math.min(MAX, Math.max(MIN, inicio.current.escala * (dist / inicio.current.dist)))
      const k = e2 / inicio.current.escala
      setEscala(e2)
      setPos(encuadrar({
        x: centro.x - (inicio.current.centro.x - inicio.current.pos.x) * k,
        y: centro.y - (inicio.current.centro.y - inicio.current.pos.y) * k,
      }, e2))
      arrastro.current = true
      return
    }

    if (punteros.current.size === 1) {
      const dx = actual.x - previo.x
      const dy = actual.y - previo.y
      recorrido.current += Math.hypot(dx, dy)
      if (recorrido.current > TOLERANCIA_TOQUE) {
        // recién acá se toma el puntero: si se tomara al apoyar el dedo, el
        // click quedaría en el contenedor y no llegaría nunca a la barra
        if (!arrastro.current) {
          const el = e.currentTarget as HTMLElement
          if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId)
        }
        arrastro.current = true
        setPos((p) => encuadrar({ x: p.x + dx, y: p.y + dy }, escala))
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    punteros.current.delete(e.pointerId)
    if (punteros.current.size < 2) inicio.current = null

    // dos toques seguidos: acercar o volver
    if (!arrastro.current) {
      const ahora = Date.now()
      if (ahora - ultimoToque.current < 300) {
        const foco = relativo(e)
        zoomEn(escala < 0.5 ? 0.75 : escalaDeAjuste(), foco)
        arrastro.current = true // que no marque el ítem con el segundo toque
      }
      ultimoToque.current = ahora
    }
  }

  /* Si el dedo se movió, lo de recién fue un arrastre: no debe marcar nada.
     Se limpia acá para que el toque siguiente sí valga. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (arrastro.current) {
      e.stopPropagation()
      e.preventDefault()
      arrastro.current = false
    }
  }

  /* Al tocar una barra el navegador la desplaza a la vista y eso mueve el
     contenedor por su cuenta, dejando descolocado el cálculo de posición.
     Se traduce ese desplazamiento a un movimiento del visor y se vuelve a
     cero, para que la transformación siga siendo la única fuente de verdad. */
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (!el.scrollLeft && !el.scrollTop) return
    const { scrollLeft: dx, scrollTop: dy } = el
    el.scrollLeft = 0
    el.scrollTop = 0
    setPos((p) => encuadrar({ x: p.x - dx, y: p.y - dy }, escala))
  }

  const rueda = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const c = caja()!
    zoomEn(escala * (e.deltaY < 0 ? 1.12 : 0.89), { x: e.clientX - c.left, y: e.clientY - c.top })
  }

  // porcentaje sobre el tamaño real de la hoja, como en un visor de imágenes
  const porcentaje = Math.round(escala * 100)

  return (
    <div className="visor" style={{ height: alto }}>
      <div
        className="visor-marco"
        ref={marco}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onScroll={onScroll}
        onWheel={rueda}
      >
        <div
          className="visor-lienzo"
          style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${escala})` }}
        >
          <FichaPrunape {...props} escalaFija={1} onMedidas={onMedidas} />
        </div>
      </div>

      <div className="visor-mandos no-imprimir">
        {props.mesesCorregidos != null && (
          <button
            type="button"
            className="visor-btn visor-edad"
            onClick={() => irALaEdad()}
            title="Centrar en la edad del niño"
          >
            Ir a la edad
          </button>
        )}
        <button type="button" className="visor-btn" onClick={() => ajustar()} title="Ver la ficha entera">
          Ver todo
        </button>
        <div className="visor-zoom">
          <button
            type="button"
            aria-label="Alejar"
            disabled={escala <= MIN + 0.001}
            onClick={() => {
              const c = caja()!
              zoomEn(escala / 1.35, { x: c.width / 2, y: c.height / 2 })
            }}
          >
            −
          </button>
          <span aria-live="polite">{porcentaje}%</span>
          <button
            type="button"
            aria-label="Acercar"
            disabled={escala >= MAX - 0.001}
            onClick={() => {
              const c = caja()!
              zoomEn(escala * 1.35, { x: c.width / 2, y: c.height / 2 })
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
