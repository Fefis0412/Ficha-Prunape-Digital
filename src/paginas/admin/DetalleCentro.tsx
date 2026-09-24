import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import { avisarCambioSoporte } from '@/components/Shell'
import {
  abrirAccesoSoporte, actualizarCentro, listarAuditoria, listarEquipo, obtenerCentro,
} from '@/datos/consultas'
import { Aviso, Campo, Cargando, Insignia, Modal, fechaCorta, fechaHora } from '@/components/ui'
import { aclarar, BRANDING_POR_DEFECTO, esHexValido, oscurecer } from '@/lib/branding'
import type { Centro, Perfil, RegistroAuditoria } from '@/lib/tipos'

export default function DetalleCentro() {
  const { id = '' } = useParams()
  const { perfil } = useSesion()
  const [centro, setCentro] = useState<Centro | null>(null)
  const [equipo, setEquipo] = useState<Perfil[]>([])
  const [movimientos, setMovimientos] = useState<RegistroAuditoria[]>([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [soporte, setSoporte] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const c = await obtenerCentro(id)
      setCentro(c)
      const [eq, aud] = await Promise.all([
        listarEquipo(id).catch(() => []),
        listarAuditoria({ centroId: id, limite: 10 }).catch(() => []),
      ])
      setEquipo(eq); setMovimientos(aud)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [id])

  useEffect(() => { void cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!centro) return <Cargando />

  const guardar = async (parche: Partial<Centro>) => {
    setError(''); setOk('')
    try {
      setCentro(await actualizarCentro(centro.id, parche))
      setOk('Cambios guardados.')
      setTimeout(() => setOk(''), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  return (
    <div className="vstack" style={{ gap: 18 }}>
      <Link className="min tenue" to="/admin/centros">‹ Centros</Link>

      <div className="hstack entre">
        <div>
          <h1>{centro.nombre}</h1>
          <p className="tenue min mono">{centro.slug} · alta {fechaCorta(centro.creado_en)}</p>
        </div>
        <div className="hstack">
          <button className="btn" onClick={() => setSoporte(true)}>Acceso de soporte</button>
          <button
            className={`btn ${centro.activo ? 'btn-peligro' : 'btn-primario'}`}
            onClick={() => guardar({ activo: !centro.activo })}
          >
            {centro.activo ? 'Suspender' : 'Reactivar'}
          </button>
        </div>
      </div>

      {ok && <Aviso tipo="info">{ok}</Aviso>}
      {!centro.activo && (
        <Aviso tipo="alerta">
          Centro suspendido. Sus usuarios siguen existiendo pero conviene desactivarlos
          si la baja es definitiva.
        </Aviso>
      )}

      <PanelBranding centro={centro} onGuardar={(br) => guardar({ branding: br })} />

      <div className="tarjeta">
        <div className="tarjeta-cabecera">
          <h2>Usuarios</h2>
          <Insignia>{equipo.length}</Insignia>
        </div>
        {equipo.length === 0 ? (
          <div className="tarjeta-cuerpo">
            <p className="tenue min">
              Este centro todavía no tiene usuarios. Se crean desde Supabase
              (Authentication → Add user) y después se les asigna el centro en
              la sección Usuarios.
            </p>
          </div>
        ) : (
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
            <tbody>
              {equipo.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td className="tenue">{u.email}</td>
                  <td>{u.rol === 'admin' ? 'Administración' : 'Terapeuta'}</td>
                  <td>{u.activo ? <Insignia tono="ok">Activo</Insignia> : <Insignia>Inactivo</Insignia>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cabecera"><h2>Últimos movimientos</h2></div>
        {movimientos.length === 0 ? (
          <div className="tarjeta-cuerpo"><p className="tenue min">Sin movimientos registrados.</p></div>
        ) : (
          <table className="tabla">
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="tenue mono" style={{ width: 100 }}>{fechaHora(m.ocurrido_en)}</td>
                  <td>{m.accion} · {m.tabla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {soporte && (
        <ModalSoporte
          centro={centro}
          superadminId={perfil!.id}
          onCerrar={() => setSoporte(false)}
          onAbierto={() => { setSoporte(false); void cargar() }}
        />
      )}
    </div>
  )
}

/* ── branding ────────────────────────────────────────────────────────────── */

function PanelBranding({
  centro, onGuardar,
}: { centro: Centro; onGuardar: (b: Centro['branding']) => void }) {
  const inicial = { ...BRANDING_POR_DEFECTO, ...centro.branding }
  const [b, setB] = useState(inicial)
  useEffect(() => { setB({ ...BRANDING_POR_DEFECTO, ...centro.branding }) }, [centro])

  const validoP = esHexValido(b.color_primario)
  const validoA = esHexValido(b.color_acento)
  const cambiado = JSON.stringify(b) !== JSON.stringify(inicial)

  return (
    <div className="tarjeta">
      <div className="tarjeta-cabecera">
        <h2>Personalización</h2>
        <span className="min tenue">Cómo ve la aplicación este centro</span>
      </div>
      <div className="tarjeta-cuerpo vstack" style={{ gap: 16 }}>
        <div className="fila fila-3">
          <Campo etiqueta="Color primario" id="cp" error={validoP ? undefined : 'Usá formato #rrggbb'}>
            <div className="hstack">
              <input type="color" value={validoP ? b.color_primario : '#2f6f4e'}
                onChange={(e) => setB({ ...b, color_primario: e.target.value })}
                style={{ width: 38, height: 36, padding: 2, border: '1px solid var(--borde-fuerte)',
                         borderRadius: 'var(--r-sm)', background: 'none' }}
                aria-label="Elegir color primario" />
              <input id="cp" className="input mono" value={b.color_primario}
                onChange={(e) => setB({ ...b, color_primario: e.target.value })} />
            </div>
          </Campo>
          <Campo etiqueta="Color de acento" id="ca" error={validoA ? undefined : 'Usá formato #rrggbb'}>
            <div className="hstack">
              <input type="color" value={validoA ? b.color_acento : '#a8c0a4'}
                onChange={(e) => setB({ ...b, color_acento: e.target.value })}
                style={{ width: 38, height: 36, padding: 2, border: '1px solid var(--borde-fuerte)',
                         borderRadius: 'var(--r-sm)', background: 'none' }}
                aria-label="Elegir color de acento" />
              <input id="ca" className="input mono" value={b.color_acento}
                onChange={(e) => setB({ ...b, color_acento: e.target.value })} />
            </div>
          </Campo>
          <Campo etiqueta="URL del logo" id="logo" ayuda="Imagen cuadrada, PNG o SVG.">
            <input id="logo" className="input" value={b.logo_url ?? ''}
              placeholder="https://…"
              onChange={(e) => setB({ ...b, logo_url: e.target.value || null })} />
          </Campo>
        </div>

        <div>
          <div className="min tenue" style={{ marginBottom: 6 }}>Vista previa</div>
          <div style={{
            border: '1px solid var(--borde)', borderRadius: 'var(--r)', overflow: 'hidden',
            display: 'grid', gridTemplateColumns: '150px 1fr',
          }}>
            <div style={{ background: '#fff', borderRight: '1px solid var(--borde)', padding: 10 }}>
              <div className="hstack" style={{ gap: 8, marginBottom: 10 }}>
                {b.logo_url
                  ? <img src={b.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                  : <span style={{ width: 20, height: 20, borderRadius: 6, background:
                      `linear-gradient(135deg, ${validoP ? b.color_primario : '#2f6f4e'}, ${validoA ? b.color_acento : '#a8c0a4'})` }} />}
                <strong style={{ fontSize: 12 }}>{centro.nombre.slice(0, 14)}</strong>
              </div>
              <div style={{
                fontSize: 11, padding: '5px 8px', borderRadius: 5,
                background: validoP ? aclarar(b.color_primario) : '#eaf2ed',
                color: validoP ? oscurecer(b.color_primario) : '#245740', fontWeight: 500,
              }}>Pacientes</div>
            </div>
            <div style={{ padding: 12, background: 'var(--fondo)' }}>
              <button className="btn" style={{
                background: validoP ? b.color_primario : '#2f6f4e',
                borderColor: validoP ? b.color_primario : '#2f6f4e', color: '#fff', pointerEvents: 'none',
              }}>+ Nueva pesquisa</button>
            </div>
          </div>
        </div>

        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={!cambiado}
            onClick={() => setB({ ...BRANDING_POR_DEFECTO, ...centro.branding })}>
            Deshacer
          </button>
          <button className="btn btn-primario" disabled={!cambiado || !validoP || !validoA}
            onClick={() => onGuardar(b)}>
            Guardar personalización
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── acceso de soporte ───────────────────────────────────────────────────── */

function ModalSoporte({
  centro, superadminId, onCerrar, onAbierto,
}: { centro: Centro; superadminId: string; onCerrar: () => void; onAbierto: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [horas, setHoras] = useState(1)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (motivo.trim().length < 10) { setError('Escribí un motivo de al menos 10 caracteres.'); return }
    setEnviando(true)
    try {
      await abrirAccesoSoporte(centro.id, superadminId, motivo.trim(), horas)
      avisarCambioSoporte()
      onAbierto()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el acceso.')
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={`Acceder a datos clínicos de ${centro.nombre}`} onCerrar={onCerrar} ancho={520}>
      <form className="vstack" style={{ gap: 15 }} onSubmit={enviar} noValidate>
        <Aviso tipo="alerta">
          Esto te habilita a leer historias clínicas de ese centro durante una ventana de
          tiempo. Queda registrado en la auditoría con tu nombre y el motivo.
        </Aviso>
        {error && <Aviso>{error}</Aviso>}

        <Campo etiqueta="Motivo *" id="motivo"
          ayuda="Va a quedar visible para los administradores del centro.">
          <textarea id="motivo" className="textarea" value={motivo} autoFocus
            placeholder="Reporte de error: la evaluación no calcula bien la edad corregida"
            onChange={(e) => setMotivo(e.target.value)} />
        </Campo>

        <Campo etiqueta="Duración" id="dur">
          <select id="dur" className="select" value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
            <option value={1}>1 hora</option>
            <option value={4}>4 horas</option>
            <option value={24}>24 horas</option>
          </select>
        </Campo>

        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? <span className="cargando" /> : 'Abrir acceso'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
