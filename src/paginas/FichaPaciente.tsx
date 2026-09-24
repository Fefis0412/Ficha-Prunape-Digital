import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import {
  actualizarPaciente, archivarPaciente, borradorDe, crearEvaluacion,
  listarEvaluaciones, obtenerPaciente,
} from '@/datos/consultas'
import { Aviso, Campo, Cargando, Insignia, Modal, Vacio, fechaCorta } from '@/components/ui'
import {
  aISO, descomponer, edadCorregida, edadPostnatal, esPrematuro,
  fecha, formatoCorto, formatoLargo,
} from '@/lib/edad'
import { nombreCompleto, type Evaluacion, type Paciente, type Perfil } from '@/lib/tipos'
import type { Resultado } from '@/lib/resultado'

type EvalConAutor = Evaluacion & { perfiles: Pick<Perfil, 'nombre'> | null }

export default function FichaPaciente() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { perfil } = useSesion()

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [evaluaciones, setEvaluaciones] = useState<EvalConAutor[] | null>(null)
  const [error, setError] = useState('')
  const [editar, setEditar] = useState(false)
  const [nueva, setNueva] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [p, ev] = await Promise.all([obtenerPaciente(id), listarEvaluaciones(id)])
      setPaciente(p); setEvaluaciones(ev)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el paciente.')
    }
  }, [id])

  useEffect(() => { void cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!paciente || !evaluaciones) return <Cargando />

  const nac = fecha(paciente.fecha_nacimiento)
  const hoy = new Date()
  const prematuro = esPrematuro(paciente.edad_gestacional_sem)
  const borrador = evaluaciones.find((e) => e.estado === 'borrador')

  const empezar = async () => {
    try {
      const yaHay = await borradorDe(paciente.id)
      if (yaHay) { nav(`/app/evaluacion/${yaHay.id}`); return }
      setNueva(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la pesquisa.')
    }
  }

  return (
    <div className="vstack" style={{ gap: 18 }}>
      <Link className="min tenue" to="/app/pacientes">‹ Pacientes</Link>

      <div className="hstack entre" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>{nombreCompleto(paciente)}</h1>
          <p className="tenue min">
            {formatoLargo(edadPostnatal(nac, hoy))} · nac. {fechaCorta(paciente.fecha_nacimiento)}
            {paciente.historia_clinica && <> · HC {paciente.historia_clinica}</>}
          </p>
          {prematuro && (
            <p className="min" style={{ color: 'var(--primario-oscuro)', marginTop: 3 }}>
              EG {paciente.edad_gestacional_sem} semanas → se aplica edad corregida
              {' '}({formatoCorto(edadCorregida(nac, hoy, paciente.edad_gestacional_sem))} hoy)
            </p>
          )}
        </div>
        <div className="hstack">
          <button className="btn" onClick={() => setEditar(true)}>Editar</button>
          {evaluaciones.filter((e) => e.estado === 'cerrada').length >= 2 && (
            <Link className="btn" to={`/app/pacientes/${paciente.id}/comparar`}>⇄ Comparar</Link>
          )}
        </div>
      </div>

      {borrador ? (
        <div className="tarjeta" style={{ borderColor: 'var(--alerta)' }}>
          <div className="tarjeta-cuerpo hstack entre">
            <div>
              <strong>Hay una pesquisa sin cerrar</strong>
              <div className="min tenue">Iniciada el {fechaCorta(borrador.fecha_pesquisa)}</div>
            </div>
            <Link className="btn btn-primario" to={`/app/evaluacion/${borrador.id}`}>Continuar</Link>
          </div>
        </div>
      ) : (
        <button className="btn btn-primario btn-grande" onClick={empezar}>+ Nueva pesquisa</button>
      )}

      <div className="tarjeta">
        <div className="tarjeta-cabecera"><h2>Línea de tiempo</h2></div>
        {evaluaciones.length === 0 ? (
          <Vacio titulo="Sin pesquisas todavía" detalle="Cuando apliques la primera, va a aparecer acá." />
        ) : (
          <div className="tarjeta-cuerpo vstack" style={{ gap: 0 }}>
            {evaluaciones.map((ev, i) => {
              const r = ev.resultado as Resultado
              const ec = descomponer(ev.edad_corregida_dias)
              const ultimo = i === evaluaciones.length - 1
              return (
                <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{
                      width: 11, height: 11, borderRadius: '50%', marginTop: 5, flex: 'none',
                      background: ev.estado === 'borrador' ? 'var(--alerta)'
                        : r?.veredicto === 'derivar' ? 'var(--error)' : 'var(--ok)',
                    }} />
                    {!ultimo && <span style={{ width: 2, flex: 1, background: 'var(--borde)', marginTop: 3 }} />}
                  </div>
                  <div style={{ paddingBottom: ultimo ? 0 : 20 }}>
                    <div className="hstack entre" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <strong className="mono">{fechaCorta(ev.fecha_pesquisa)}</strong>
                        <span className="tenue"> · {formatoCorto(ec)} corregida</span>
                        <div className="min" style={{ marginTop: 3 }}>
                          {ev.estado === 'borrador' ? (
                            <Insignia tono="alerta">Borrador</Insignia>
                          ) : (
                            <>
                              <Insignia tono={r?.veredicto === 'derivar' ? 'error' : 'ok'}>
                                {r?.veredicto === 'derivar' ? 'Criterio de fracaso' : 'Pasa'}
                              </Insignia>
                              <span className="tenue">
                                {' '}· {r?.fallosA ?? 0} tipo A · {r?.fallosB ?? 0} tipo B
                                {' '}· {r?.pasados ?? 0} pasados
                              </span>
                            </>
                          )}
                        </div>
                        <div className="min tenue" style={{ marginTop: 2 }}>
                          {ev.perfiles?.nombre ?? '—'}
                        </div>
                      </div>
                      <Link className="btn" to={`/app/evaluacion/${ev.id}`}>
                        {ev.estado === 'borrador' ? 'Continuar' : 'Ver'}
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editar && (
        <ModalEditar
          paciente={paciente}
          esAdmin={perfil?.rol === 'admin'}
          onCerrar={() => setEditar(false)}
          onGuardado={() => { setEditar(false); void cargar() }}
          onArchivado={() => nav('/app/pacientes')}
        />
      )}

      {nueva && (
        <ModalNuevaPesquisa
          paciente={paciente}
          examinadorId={perfil!.id}
          onCerrar={() => setNueva(false)}
          onCreada={(ev) => nav(`/app/evaluacion/${ev.id}`)}
        />
      )}
    </div>
  )
}

/* ── modales ─────────────────────────────────────────────────────────────── */

function ModalNuevaPesquisa({
  paciente, examinadorId, onCerrar, onCreada,
}: {
  paciente: Paciente; examinadorId: string
  onCerrar: () => void; onCreada: (e: Evaluacion) => void
}) {
  const hoy = aISO(new Date())
  const [f, setF] = useState(hoy)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const nac = fecha(paciente.fecha_nacimiento)
  const valida = f && f <= hoy && f >= paciente.fecha_nacimiento
  const ec = valida ? edadCorregida(nac, fecha(f), paciente.edad_gestacional_sem) : null

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valida) { setError('La fecha debe estar entre el nacimiento y hoy.'); return }
    setEnviando(true)
    try {
      onCreada(await crearEvaluacion(paciente, examinadorId, f))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.')
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nueva pesquisa" onCerrar={onCerrar} ancho={420}>
      <form className="vstack" style={{ gap: 15 }} onSubmit={enviar} noValidate>
        {error && <Aviso>{error}</Aviso>}
        <Campo etiqueta="Fecha de la pesquisa" id="fp">
          <input id="fp" className="input" type="date" value={f} max={hoy}
            min={paciente.fecha_nacimiento} onChange={(e) => setF(e.target.value)} />
        </Campo>
        {ec && (
          <div className="aviso aviso-info">
            Edad corregida a esa fecha: <strong>{formatoLargo(ec)}</strong>
          </div>
        )}
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={enviando || !valida}>
            {enviando ? <span className="cargando" /> : 'Empezar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalEditar({
  paciente, esAdmin, onCerrar, onGuardado, onArchivado,
}: {
  paciente: Paciente; esAdmin: boolean
  onCerrar: () => void; onGuardado: () => void; onArchivado: () => void
}) {
  const [d, setD] = useState({
    nombre: paciente.nombre,
    apellido: paciente.apellido,
    historia_clinica: paciente.historia_clinica ?? '',
    edad_gestacional_sem: paciente.edad_gestacional_sem,
  })
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await actualizarPaciente(paciente.id, {
        ...d, historia_clinica: d.historia_clinica.trim() || null,
      })
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <Modal titulo="Editar paciente" onCerrar={onCerrar}>
      <form className="vstack" style={{ gap: 15 }} onSubmit={guardar} noValidate>
        {error && <Aviso>{error}</Aviso>}
        <div className="fila fila-2">
          <Campo etiqueta="Nombre" id="e-nom">
            <input id="e-nom" className="input" value={d.nombre}
              onChange={(e) => setD({ ...d, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Apellido" id="e-ape">
            <input id="e-ape" className="input" value={d.apellido}
              onChange={(e) => setD({ ...d, apellido: e.target.value })} />
          </Campo>
        </div>
        <div className="fila fila-2">
          <Campo etiqueta="N° H. Clínica" id="e-hc">
            <input id="e-hc" className="input" value={d.historia_clinica}
              onChange={(e) => setD({ ...d, historia_clinica: e.target.value })} />
          </Campo>
          <Campo etiqueta="Edad gestacional (sem)" id="e-eg">
            <input id="e-eg" className="input" type="number" step="0.1" min={20} max={45}
              value={d.edad_gestacional_sem ?? ''}
              onChange={(e) => setD({
                ...d, edad_gestacional_sem: e.target.value === '' ? null : Number(e.target.value),
              })} />
          </Campo>
        </div>
        <p className="min tenue">
          La fecha de nacimiento no se edita acá: cambiarla alteraría la edad de todas las
          pesquisas ya cerradas. Si está mal, pedíselo a un administrador.
        </p>

        <div className="hstack entre">
          {esAdmin ? (
            confirmar ? (
              <button type="button" className="btn btn-peligro"
                onClick={async () => { await archivarPaciente(paciente.id); onArchivado() }}>
                Confirmar archivado
              </button>
            ) : (
              <button type="button" className="btn btn-peligro" onClick={() => setConfirmar(true)}>
                Archivar
              </button>
            )
          ) : <span />}
          <div className="hstack">
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-primario">Guardar</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
