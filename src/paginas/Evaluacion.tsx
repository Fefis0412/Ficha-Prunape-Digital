import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import {
  cerrarEvaluacion, descartarBorrador, guardarBorrador, obtenerEvaluacion,
} from '@/datos/consultas'
import { FichaPrunape, useImprimir, type DatosCabecera } from '@/components/FichaPrunape'
import { Aviso, Cargando, Insignia, Modal, fechaCorta } from '@/components/ui'
import { calcularResultado, type Resultado } from '@/lib/resultado'
import { descomponer, formatoLargo } from '@/lib/edad'
import { DIAS_POR_MES } from '@/lib/edad'
import { nombreCompleto, type Evaluacion as Eval, type Paciente, type Perfil } from '@/lib/tipos'
import type { Marca, Respuestas } from '@/lib/catalogo'
import './evaluacion.css'

type EvalCompleta = Eval & { pacientes: Paciente; perfiles: Pick<Perfil, 'nombre'> | null }
type EstadoGuardado = 'guardado' | 'guardando' | 'pendiente' | 'error'

const LLAVE_LOCAL = (id: string) => `prunape:borrador:${id}`

export default function Evaluacion() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { perfil } = useSesion()

  const [ev, setEv] = useState<EvalCompleta | null>(null)
  const [respuestas, setRespuestas] = useState<Respuestas>({})
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState<EstadoGuardado>('guardado')
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sucio = useRef(false)

  useImprimir(3799, 4925)

  /* ── carga ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    obtenerEvaluacion(id)
      .then((e) => {
        setEv(e)
        // si quedó trabajo sin sincronizar en este equipo, gana lo local
        const local = localStorage.getItem(LLAVE_LOCAL(id))
        if (local && e.estado === 'borrador') {
          try {
            const g = JSON.parse(local) as { respuestas: Respuestas; observaciones: string }
            setRespuestas(g.respuestas); setObservaciones(g.observaciones ?? '')
            sucio.current = true; setGuardado('pendiente')
            return
          } catch { /* ignorar json corrupto */ }
        }
        setRespuestas(e.respuestas ?? {})
        setObservaciones(e.observaciones ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
  }, [id])

  /* ── conexión ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    const arriba = () => setEnLinea(true)
    const abajo = () => setEnLinea(false)
    window.addEventListener('online', arriba)
    window.addEventListener('offline', abajo)
    return () => { window.removeEventListener('online', arriba); window.removeEventListener('offline', abajo) }
  }, [])

  const mesesCorregidos = ev ? ev.edad_corregida_dias / DIAS_POR_MES : 0
  const resultado: Resultado = useMemo(
    () => calcularResultado(respuestas, mesesCorregidos),
    [respuestas, mesesCorregidos],
  )

  /* ── guardado automático ───────────────────────────────────────────────── */
  const sincronizar = useCallback(async (r: Respuestas, obs: string) => {
    if (!ev || ev.estado !== 'borrador') return
    setGuardado('guardando')
    try {
      await guardarBorrador(ev.id, r, ev.edad_corregida_dias, obs || null)
      localStorage.removeItem(LLAVE_LOCAL(ev.id))
      sucio.current = false
      setGuardado('guardado')
    } catch {
      setGuardado('error')
    }
  }, [ev])

  const marcar = (itemId: string, siguiente: Marca | null) => {
    setRespuestas((prev) => {
      const r = { ...prev }
      if (siguiente === null) delete r[itemId]
      else r[itemId] = siguiente
      persistirLocal(r, observaciones)
      programar(r, observaciones)
      return r
    })
  }

  const persistirLocal = (r: Respuestas, obs: string) => {
    if (!ev || ev.estado !== 'borrador') return
    sucio.current = true
    try { localStorage.setItem(LLAVE_LOCAL(ev.id), JSON.stringify({ respuestas: r, observaciones: obs })) }
    catch { /* cuota llena: seguimos igual, el servidor es la fuente */ }
  }

  const programar = (r: Respuestas, obs: string) => {
    setGuardado('pendiente')
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => void sincronizar(r, obs), 700)
  }

  // reintento al recuperar conexión
  useEffect(() => {
    if (enLinea && sucio.current && ev?.estado === 'borrador') void sincronizar(respuestas, observaciones)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea])

  // aviso al cerrar la pestaña con cambios sin subir
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => { if (sucio.current) e.preventDefault() }
    window.addEventListener('beforeunload', antes)
    return () => window.removeEventListener('beforeunload', antes)
  }, [])

  if (error) return <div style={{ padding: 24 }}><Aviso>{error}</Aviso></div>
  if (!ev) return <Cargando />

  const p = ev.pacientes
  const cerrada = ev.estado === 'cerrada'
  const ecorr = descomponer(ev.edad_corregida_dias)
  const epost = descomponer(ev.edad_postnatal_dias)

  const cabecera: DatosCabecera = {
    examinador: ev.perfiles?.nombre ?? '',
    paciente: `${p.nombre} ${p.apellido}`,
    historiaClinica: p.historia_clinica ?? '',
    edadGestacional: p.edad_gestacional_sem ? String(p.edad_gestacional_sem) : '',
    fechaNacimiento: fechaCorta(p.fecha_nacimiento),
    fechaPesquisa: fechaCorta(ev.fecha_pesquisa),
    edadPostnatal: `${epost.anios} / ${epost.meses} / ${epost.diasResto}`,
    edadCorregida: `${ecorr.anios} / ${ecorr.meses} / ${ecorr.diasResto}`,
  }

  const cerrar = async () => {
    try {
      if (sucio.current) await sincronizar(respuestas, observaciones)
      const act = await cerrarEvaluacion(ev.id, perfil!.id)
      setEv({ ...ev, ...act })
      setConfirmarCierre(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar.')
      setConfirmarCierre(false)
    }
  }

  return (
    <div className="eval">
      <header className="eval-barra no-imprimir">
        <Link className="btn btn-fantasma" to={`/app/pacientes/${p.id}`}>‹ Volver</Link>
        <div className="eval-titulo">
          <strong>{nombreCompleto(p)}</strong>
          <span className="min tenue">
            {formatoLargo(ecorr)} corregida · pesquisa {fechaCorta(ev.fecha_pesquisa)}
          </span>
        </div>
        <span className="crece" />
        {!enLinea && <Insignia tono="alerta">Sin conexión</Insignia>}
        {cerrada
          ? <Insignia tono="ok">Cerrada</Insignia>
          : <EstadoAutoguardado estado={guardado} enLinea={enLinea} />}
        <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
      </header>

      {!enLinea && !cerrada && (
        <div className="no-imprimir" style={{ padding: '0 16px 10px' }}>
          <Aviso tipo="alerta">
            Sin internet. Seguí trabajando: todo se guarda en este equipo y se sincroniza
            solo cuando vuelva la conexión.
          </Aviso>
        </div>
      )}

      <div className="eval-cuerpo">
        <div className="eval-ficha">
          <FichaPrunape
            respuestas={respuestas}
            mesesCorregidos={mesesCorregidos}
            cabecera={cabecera}
            soloLectura={cerrada}
            onToggle={marcar}
          />
        </div>

        <aside className="eval-panel no-imprimir">
          <h2>Resumen</h2>

          <div className="eval-cifras">
            <Cifra n={resultado.fallosA} rotulo="Tipo A ✱ fallados" tono={resultado.fallosA > 0 ? 'error' : undefined} />
            <Cifra n={resultado.fallosB} rotulo="Tipo B fallados" tono={resultado.fallosB >= 2 ? 'error' : undefined} />
            <Cifra n={resultado.pasados} rotulo="Pasados" />
          </div>

          <div className={`eval-veredicto ${resultado.veredicto}`}>
            {resultado.veredicto === 'derivar' ? 'Criterio de fracaso alcanzado'
              : resultado.veredicto === 'pasa' ? 'Sin criterio de fracaso'
              : 'Todavía no hay ítems marcados'}
          </div>
          <p className="min tenue">
            Ayuda de cálculo. La interpretación final es del profesional y debe
            contrastarse con el manual del PRUNAPE.
          </p>

          {resultado.sinMarcarEsperables > 0 && !cerrada && (
            <Aviso tipo="alerta">
              Quedan <strong>{resultado.sinMarcarEsperables}</strong> ítems sin marcar
              dentro del rango de edad.
            </Aviso>
          )}

          <div className="campo">
            <label htmlFor="obs">Observaciones</label>
            <textarea
              id="obs" className="textarea" value={observaciones} disabled={cerrada}
              placeholder="Conducta durante la prueba, factores que puedan haber influido…"
              onChange={(e) => {
                setObservaciones(e.target.value)
                persistirLocal(respuestas, e.target.value)
                programar(respuestas, e.target.value)
              }}
            />
          </div>

          {cerrada ? (
            <div className="aviso aviso-info">
              Cerrada el {fechaCorta(ev.cerrada_en)}. Forma parte de la historia clínica
              y ya no se edita.
            </div>
          ) : (
            <>
              <button className="btn btn-primario btn-grande btn-bloque"
                onClick={() => setConfirmarCierre(true)}>
                Cerrar y firmar
              </button>
              <button className="btn btn-peligro btn-bloque"
                onClick={() => setConfirmarDescarte(true)}>
                Descartar borrador
              </button>
            </>
          )}
        </aside>
      </div>

      {confirmarCierre && (
        <Modal titulo="Cerrar la evaluación" onCerrar={() => setConfirmarCierre(false)} ancho={470}>
          <div className="vstack" style={{ gap: 14 }}>
            <p>
              Una vez cerrada queda como parte de la historia clínica y ya no se puede editar.
            </p>
            <div className="tarjeta"><div className="tarjeta-cuerpo">
              <strong>{nombreCompleto(p)}</strong>
              <div className="min tenue">
                {fechaCorta(ev.fecha_pesquisa)} · {formatoLargo(ecorr)} corregida
              </div>
              <div className="min" style={{ marginTop: 6 }}>
                {resultado.fallosA} tipo A · {resultado.fallosB} tipo B · {resultado.pasados} pasados
              </div>
            </div></div>
            {resultado.sinMarcarEsperables > 0 && (
              <Aviso tipo="alerta">
                Quedan {resultado.sinMarcarEsperables} ítems sin marcar dentro del rango de edad.
              </Aviso>
            )}
            {resultado.marcados === 0 && (
              <Aviso>No marcaste ningún ítem. Revisá antes de cerrar.</Aviso>
            )}
            <div className="hstack" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmarCierre(false)}>Volver</button>
              <button className="btn btn-primario" onClick={cerrar}>Cerrar y firmar</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmarDescarte && (
        <Modal titulo="Descartar el borrador" onCerrar={() => setConfirmarDescarte(false)} ancho={430}>
          <div className="vstack" style={{ gap: 14 }}>
            <p>Se pierde lo marcado hasta ahora. Esta pesquisa no quedará en la historia.</p>
            <div className="hstack" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmarDescarte(false)}>Volver</button>
              <button className="btn btn-peligro" onClick={async () => {
                try {
                  localStorage.removeItem(LLAVE_LOCAL(ev.id))
                  await descartarBorrador(ev.id)
                  nav(`/app/pacientes/${p.id}`)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'No se pudo descartar.')
                  setConfirmarDescarte(false)
                }
              }}>
                Descartar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Cifra({ n, rotulo, tono }: { n: number; rotulo: string; tono?: 'error' }) {
  return (
    <div className="eval-cifra">
      <strong style={{ color: tono === 'error' ? 'var(--error)' : undefined }}>{n}</strong>
      <span>{rotulo}</span>
    </div>
  )
}

function EstadoAutoguardado({ estado, enLinea }: { estado: EstadoGuardado; enLinea: boolean }) {
  if (!enLinea) return <Insignia tono="alerta">Guardado en el equipo</Insignia>
  if (estado === 'guardando') return <Insignia><span className="cargando" /> Guardando</Insignia>
  if (estado === 'pendiente') return <Insignia>Sin guardar</Insignia>
  if (estado === 'error') return <Insignia tono="error">Error al guardar</Insignia>
  return <Insignia tono="ok">Guardado</Insignia>
}
