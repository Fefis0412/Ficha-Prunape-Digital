import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import { Aviso, Campo } from '@/components/ui'
import { catalogo } from '@/lib/catalogo'
import './entrar.css'

/* Un puñado de ítems reales de la ficha, usados como motivo gráfico. No es
   decoración inventada: es el instrumento mismo, que es de lo que habla
   la aplicación. */
const MOTIVO = catalogo.items
  .filter((i) => i.geom.verde != null)
  .filter((_, n) => n % 5 === 0)
  .slice(0, 12)
  .map((i) => {
    const ancho = i.geom.x1 - i.geom.x0
    return {
      id: i.id,
      etiqueta: i.etiqueta[0],
      // se normaliza a porcentajes del eje para que escale con la caja
      izq: ((i.geom.x0 - 406) / 3018) * 100,
      ancho: Math.max(22, (ancho / 3018) * 100),
      verde: ((i.geom.x1 - i.geom.verde!) / ancho) * 100,
    }
  })

export default function Entrar() {
  const { session, cargando, entrar } = useSesion()
  const loc = useLocation() as { state?: { desde?: string } }
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (cargando) {
    return <div className="portada-cargando"><span className="cargando" /></div>
  }
  if (session) return <Navigate to={loc.state?.desde ?? '/'} replace />

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!usuario.trim() || !clave) {
      setError('Completá el usuario y la contraseña.')
      return
    }
    setEnviando(true)
    try {
      await entrar(usuario, clave)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ingresar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="portada">
      {/* ── presentación ── */}
      <section className="portada-lado">
        <div className="portada-marca">
          <span className="portada-logo" aria-hidden />
          <span>PRUNAPE <b>Digital</b></span>
        </div>

        <div className="portada-texto">
          <h1>
            La pesquisa del desarrollo,<br />
            <em>sin papeles sueltos.</em>
          </h1>
          <p>
            La misma ficha de siempre, con la edad corregida calculada sola y la
            historia de cada niño en un solo lugar.
          </p>
        </div>

        <div className="portada-grafico" aria-hidden>
          <div className="portada-eje">
            {['2', '6', '12', '24', '4a'].map((m) => <span key={m}>{m}</span>)}
          </div>
          {MOTIVO.map((it, n) => (
            <div
              key={it.id}
              className="portada-barra"
              style={{
                left: `${it.izq}%`,
                width: `${it.ancho}%`,
                animationDelay: `${n * 70}ms`,
              }}
            >
              <span className="portada-verde" style={{ width: `${it.verde}%` }} />
              <em>{it.etiqueta}</em>
            </div>
          ))}
          <div className="portada-edad"><span>edad corregida</span></div>
        </div>

        <ul className="portada-puntos">
          <li>Edad corregida por prematurez, calculada</li>
          <li>Evolución del niño entre pesquisas</li>
          <li>Cada terapeuta ve solo sus pacientes</li>
        </ul>
      </section>

      {/* ── acceso ── */}
      <section className="portada-acceso">
        <div className="portada-caja">
          <div className="portada-marca portada-marca-movil">
            <span className="portada-logo" aria-hidden />
            <span>PRUNAPE <b>Digital</b></span>
          </div>

          <h2>Entrar</h2>
          <p className="portada-sub">Usá el usuario que te dio tu centro.</p>

          <form className="vstack" style={{ gap: 15 }} onSubmit={enviar} noValidate>
            {error && <Aviso>{error}</Aviso>}

            <Campo etiqueta="Usuario" id="usuario">
              <input
                id="usuario" className="input" autoFocus
                value={usuario} onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username" autoCapitalize="none"
                autoCorrect="off" spellCheck={false}
                placeholder="tu usuario"
              />
            </Campo>

            <Campo etiqueta="Contraseña" id="clave">
              <div style={{ position: 'relative' }}>
                <input
                  id="clave" className="input" type={verClave ? 'text' : 'password'}
                  autoComplete="current-password" style={{ paddingRight: 50 }}
                  value={clave} onChange={(e) => setClave(e.target.value)}
                  enterKeyHint="go"
                />
                <button
                  type="button" className="portada-ojo"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verClave ? '🙈' : '👁'}
                </button>
              </div>
            </Campo>

            <button className="btn btn-primario btn-grande btn-bloque" disabled={enviando}>
              {enviando ? <span className="cargando" /> : 'Ingresar'}
            </button>
          </form>

          <p className="portada-pie">
            ¿Olvidaste tu contraseña? Pedísela al administrador de tu centro.
          </p>
        </div>

        <p className="portada-nota">
          Herramienta de apoyo. La interpretación del resultado es del profesional
          y debe contrastarse con el manual del PRUNAPE.
        </p>
      </section>
    </div>
  )
}
