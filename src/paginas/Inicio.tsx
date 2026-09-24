import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import { listarPacientes, type PacienteConUltima } from '@/datos/consultas'
import { Aviso, Cargando, Insignia, Vacio, fechaCorta } from '@/components/ui'
import { edadPostnatal, fecha, formatoCorto } from '@/lib/edad'
import { nombreCompleto } from '@/lib/tipos'
import type { Resultado } from '@/lib/resultado'

function tonoResultado(r: Resultado | Record<string, never> | undefined) {
  const v = (r as Resultado)?.veredicto
  if (v === 'pasa') return { tono: 'ok' as const, texto: 'Pasa' }
  if (v === 'derivar') return { tono: 'error' as const, texto: 'Derivar' }
  return { tono: 'neutro' as const, texto: 'Sin datos' }
}

export default function Inicio() {
  const { perfil } = useSesion()
  const nav = useNavigate()
  const [pacientes, setPacientes] = useState<PacienteConUltima[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listarPacientes().then(setPacientes).catch((e) => setError(e.message))
  }, [])

  if (error) return <Aviso>{error}</Aviso>
  if (!pacientes) return <Cargando />

  const borradores = pacientes.flatMap((p) =>
    p.evaluaciones.filter((e) => e.estado === 'borrador' && !e.descartado_en).map((e) => ({ paciente: p, eval: e })),
  )

  const recientes = pacientes
    .flatMap((p) => p.evaluaciones.filter((e) => !e.descartado_en).map((e) => ({ paciente: p, eval: e })))
    .sort((a, b) => b.eval.fecha_pesquisa.localeCompare(a.eval.fecha_pesquisa))
    .slice(0, 8)

  const nombrePila = perfil?.nombre?.split(' ')[0] ?? ''

  return (
    <div className="vstack" style={{ gap: 20 }}>
      <div className="hstack entre">
        <div>
          <h1>Hola, {nombrePila}</h1>
          <p className="tenue min">Tenés {pacientes.length} paciente{pacientes.length === 1 ? '' : 's'} a tu cargo.</p>
        </div>
        <Link className="btn btn-primario" to="/app/pacientes">+ Nueva pesquisa</Link>
      </div>

      {borradores.length > 0 && (
        <div className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Pesquisas sin cerrar</h2>
            <Insignia tono="alerta">{borradores.length}</Insignia>
          </div>
          <table className="tabla">
            <tbody>
              {borradores.map(({ paciente, eval: ev }) => (
                <tr key={ev.id} className="clicable" onClick={() => nav(`/app/evaluacion/${ev.id}`)}>
                  <td><strong>{nombreCompleto(paciente)}</strong></td>
                  <td className="tenue">
                    {formatoCorto(edadPostnatal(fecha(paciente.fecha_nacimiento), new Date()))}
                  </td>
                  <td className="tenue mono">{fechaCorta(ev.fecha_pesquisa)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="btn btn-fantasma">Continuar →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="tarjeta">
        <div className="tarjeta-cabecera"><h2>Últimas evaluaciones</h2></div>
        {recientes.length === 0 ? (
          <Vacio
            titulo="Todavía no hay evaluaciones"
            detalle="Registrá un paciente y aplicale la primera pesquisa."
            accion={<Link className="btn btn-primario" to="/app/pacientes">Ir a pacientes</Link>}
          />
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Paciente</th><th>Edad</th><th>Fecha</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              {recientes.map(({ paciente, eval: ev }) => {
                const r = tonoResultado(ev.resultado)
                return (
                  <tr key={ev.id} className="clicable" onClick={() => nav(`/app/evaluacion/${ev.id}`)}>
                    <td><strong>{nombreCompleto(paciente)}</strong></td>
                    <td className="tenue">
                      {formatoCorto(edadPostnatal(fecha(paciente.fecha_nacimiento), fecha(ev.fecha_pesquisa)))}
                    </td>
                    <td className="tenue mono">{fechaCorta(ev.fecha_pesquisa)}</td>
                    <td>
                      {ev.estado === 'borrador'
                        ? <Insignia tono="alerta">Borrador</Insignia>
                        : <Insignia tono={r.tono}>{r.texto}</Insignia>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
