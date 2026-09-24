import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listarEvaluaciones, obtenerPaciente } from '@/datos/consultas'
import { Aviso, Cargando, Insignia, Vacio, fechaCorta } from '@/components/ui'
import { catalogo, NOMBRE_AREA, type AreaId, type Respuestas } from '@/lib/catalogo'
import { descomponer, formatoCorto } from '@/lib/edad'
import { nombreCompleto, type Evaluacion, type Paciente } from '@/lib/tipos'
import type { Resultado } from '@/lib/resultado'

const AREAS: AreaId[] = ['personal_social', 'motor_fino', 'lenguaje', 'motor_grueso']

/** ¿Falló algún ítem de esta área en esta evaluación? */
function estadoArea(resp: Respuestas, area: AreaId): 'ok' | 'falla' | 'vacio' {
  let marcados = 0
  for (const item of catalogo.items) {
    if (item.area !== area) continue
    const m = resp[item.id]
    if (!m) continue
    marcados++
    if (m === 'no_pasa') return 'falla'
  }
  return marcados ? 'ok' : 'vacio'
}

export default function Comparar() {
  const { id = '' } = useParams()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [evs, setEvs] = useState<Evaluacion[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([obtenerPaciente(id), listarEvaluaciones(id)])
      .then(([p, e]) => { setPaciente(p); setEvs(e.filter((x) => x.estado === 'cerrada').reverse()) })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
  }, [id])

  const dejaronDeFallar = useMemo(() => {
    if (!evs || evs.length < 2) return []
    const primera = evs[0].respuestas ?? {}
    const ultima = evs[evs.length - 1].respuestas ?? {}
    return catalogo.items
      .filter((i) => primera[i.id] === 'no_pasa' && ultima[i.id] === 'pasa')
      .map((i) => i.etiqueta.join(' '))
  }, [evs])

  const aparecieron = useMemo(() => {
    if (!evs || evs.length < 2) return []
    const primera = evs[0].respuestas ?? {}
    const ultima = evs[evs.length - 1].respuestas ?? {}
    return catalogo.items
      .filter((i) => primera[i.id] === 'pasa' && ultima[i.id] === 'no_pasa')
      .map((i) => i.etiqueta.join(' '))
  }, [evs])

  if (error) return <Aviso>{error}</Aviso>
  if (!paciente || !evs) return <Cargando />

  if (evs.length < 2) {
    return (
      <div className="vstack" style={{ gap: 16 }}>
        <Link className="min tenue" to={`/app/pacientes/${id}`}>‹ Volver</Link>
        <Vacio
          titulo="Hacen falta al menos dos pesquisas cerradas"
          detalle="La comparación muestra la evolución entre evaluaciones ya firmadas."
        />
      </div>
    )
  }

  return (
    <div className="vstack" style={{ gap: 18 }}>
      <Link className="min tenue" to={`/app/pacientes/${id}`}>‹ {nombreCompleto(paciente)}</Link>
      <h1>Evolución</h1>

      <div className="tarjeta" style={{ overflowX: 'auto' }}>
        <table className="tabla">
          <thead>
            <tr>
              <th>Área</th>
              {evs.map((e) => (
                <th key={e.id} style={{ textAlign: 'center' }}>
                  <div className="mono">{fechaCorta(e.fecha_pesquisa)}</div>
                  <div style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {formatoCorto(descomponer(e.edad_corregida_dias))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AREAS.map((a) => (
              <tr key={a}>
                <td><strong>{NOMBRE_AREA[a]}</strong></td>
                {evs.map((e) => {
                  const s = estadoArea(e.respuestas ?? {}, a)
                  return (
                    <td key={e.id} style={{ textAlign: 'center', fontSize: 16 }}>
                      <span style={{
                        color: s === 'ok' ? 'var(--ok)' : s === 'falla' ? 'var(--error)' : 'var(--texto-3)',
                        fontWeight: 700,
                      }}>
                        {s === 'ok' ? '✓' : s === 'falla' ? '✗' : '—'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td><strong>Resultado</strong></td>
              {evs.map((e) => {
                const r = e.resultado as Resultado
                return (
                  <td key={e.id} style={{ textAlign: 'center' }}>
                    <Insignia tono={r?.veredicto === 'derivar' ? 'error' : 'ok'}>
                      {r?.veredicto === 'derivar' ? 'Derivar' : 'Pasa'}
                    </Insignia>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="fila fila-2">
        <div className="tarjeta">
          <div className="tarjeta-cabecera"><h2>Ítems que dejaron de fallar</h2></div>
          <div className="tarjeta-cuerpo">
            {dejaronDeFallar.length === 0
              ? <p className="tenue min">Ninguno entre la primera y la última pesquisa.</p>
              : <ul style={{ margin: 0, paddingLeft: 18 }} className="min">
                  {dejaronDeFallar.map((t) => <li key={t} style={{ color: 'var(--ok)' }}>{t}</li>)}
                </ul>}
          </div>
        </div>
        <div className="tarjeta">
          <div className="tarjeta-cabecera"><h2>Ítems que empezaron a fallar</h2></div>
          <div className="tarjeta-cuerpo">
            {aparecieron.length === 0
              ? <p className="tenue min">Ninguno.</p>
              : <ul style={{ margin: 0, paddingLeft: 18 }} className="min">
                  {aparecieron.map((t) => <li key={t} style={{ color: 'var(--error)' }}>{t}</li>)}
                </ul>}
          </div>
        </div>
      </div>
    </div>
  )
}
