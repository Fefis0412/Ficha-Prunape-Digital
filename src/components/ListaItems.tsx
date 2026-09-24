import { useMemo, useState } from 'react'
import {
  catalogo as catalogoPorDefecto, esperableA, NOMBRE_AREA,
  type AreaId, type Catalogo, type ItemCatalogo, type Marca, type Respuestas,
} from '@/lib/catalogo'
import './lista-items.css'

/**
 * Modo lista de la ficha.
 *
 * En un celular el gráfico quedaría a escala 0,10: las etiquetas saldrían de
 * tres píxeles y las barras serían imposibles de tocar. Acá los mismos 79
 * ítems se recorren como lista, en orden de desarrollo, con dos botones
 * grandes por fila. El gráfico sigue disponible como vista de referencia.
 */

const ORDEN_AREAS: AreaId[] = ['personal_social', 'motor_fino', 'lenguaje', 'motor_grueso']

const CORTO: Record<AreaId, string> = {
  personal_social: 'P-Social',
  motor_fino: 'M. fino',
  lenguaje: 'Lenguaje',
  motor_grueso: 'M. grueso',
}

function edadLegible(meses: number): string {
  if (meses < 1) return `${Math.round(meses * 30)} d`
  if (meses < 24) return `${Math.round(meses)} m`
  const a = Math.floor(meses / 12)
  const m = Math.round(meses - a * 12)
  return m ? `${a} a ${m} m` : `${a} a`
}

export interface ListaItemsProps {
  respuestas: Respuestas
  mesesCorregidos: number
  soloLectura?: boolean
  onToggle: (itemId: string, siguiente: Marca | null) => void
  catalogo?: Catalogo
}

export function ListaItems({
  respuestas, mesesCorregidos, soloLectura = false, onToggle,
  catalogo = catalogoPorDefecto,
}: ListaItemsProps) {
  const [area, setArea] = useState<AreaId | 'todas'>('todas')
  const [soloEsperables, setSoloEsperables] = useState(true)

  const { visibles, esperables, marcadosEsperables } = useMemo(() => {
    const esp = catalogo.items.filter((i) => esperableA(i, mesesCorregidos))
    const base = soloEsperables ? esp : catalogo.items
    const filtrados = area === 'todas' ? base : base.filter((i) => i.area === area)
    return {
      visibles: [...filtrados].sort((a, b) => a.edad_meses.p90 - b.edad_meses.p90),
      esperables: esp.length,
      marcadosEsperables: esp.filter((i) => respuestas[i.id]).length,
    }
  }, [catalogo, area, soloEsperables, mesesCorregidos, respuestas])

  const porArea = useMemo(() => {
    const m = new Map<AreaId, ItemCatalogo[]>()
    for (const i of visibles) {
      const l = m.get(i.area) ?? []
      l.push(i)
      m.set(i.area, l)
    }
    return ORDEN_AREAS.filter((a) => m.has(a)).map((a) => [a, m.get(a)!] as const)
  }, [visibles])

  const marcar = (item: ItemCatalogo, valor: Marca) => {
    if (soloLectura) return
    onToggle(item.id, respuestas[item.id] === valor ? null : valor)
  }

  return (
    <div className="lista">
      <div className="lista-filtros">
        <div className="lista-chips" role="group" aria-label="Filtrar por área">
          <button
            type="button"
            className={`chip${area === 'todas' ? ' activo' : ''}`}
            onClick={() => setArea('todas')}
            aria-pressed={area === 'todas'}
          >
            Todas
          </button>
          {ORDEN_AREAS.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip${area === a ? ' activo' : ''}`}
              onClick={() => setArea(a)}
              aria-pressed={area === a}
            >
              {CORTO[a]}
            </button>
          ))}
        </div>

        <label className="lista-conmutador">
          <input
            type="checkbox"
            checked={soloEsperables}
            onChange={(e) => setSoloEsperables(e.target.checked)}
          />
          <span>Solo los esperables a esta edad</span>
        </label>

        <div className="lista-progreso">
          <div className="lista-barra">
            <span style={{ width: `${esperables ? (marcadosEsperables / esperables) * 100 : 0}%` }} />
          </div>
          <span className="min tenue">
            {marcadosEsperables} de {esperables} esperables marcados
          </span>
        </div>
      </div>

      {visibles.length === 0 && (
        <p className="tenue min" style={{ padding: '24px 4px', textAlign: 'center' }}>
          No hay ítems que mostrar con este filtro.
        </p>
      )}

      {porArea.map(([a, items]) => (
        <section key={a} className="lista-grupo">
          <h3 className="lista-grupo-titulo">{NOMBRE_AREA[a]}</h3>
          {items.map((item) => {
            const marca = respuestas[item.id]
            const p75 = item.edad_meses.p75 ?? item.edad_meses.p90
            return (
              <div
                key={item.id}
                className={`lista-fila${marca ? ' ' + marca : ''}`}
                data-item={item.id}
                data-marca={marca ?? ''}
              >
                <div className="lista-texto">
                  <span className="lista-etiqueta">
                    {item.tipo === 'A' && <b className="lista-tipo" title="Ítem tipo A">✱</b>}
                    {item.etiqueta.join(' ')}
                  </span>
                  <span className="lista-edad">
                    {edadLegible(p75)} – {edadLegible(item.edad_meses.p90)}
                    {item.notas.cola && <> · {item.notas.cola}</>}
                  </span>
                </div>
                <div className="lista-acciones">
                  <button
                    type="button"
                    className="lista-btn pasa"
                    aria-pressed={marca === 'pasa'}
                    aria-label={`Pasa: ${item.etiqueta.join(' ')}`}
                    disabled={soloLectura}
                    onClick={() => marcar(item, 'pasa')}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="lista-btn no-pasa"
                    aria-pressed={marca === 'no_pasa'}
                    aria-label={`No pasa: ${item.etiqueta.join(' ')}`}
                    disabled={soloLectura}
                    onClick={() => marcar(item, 'no_pasa')}
                  >
                    ✗
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
