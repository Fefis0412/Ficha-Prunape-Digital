import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import { Aviso, Campo, Pantalla } from '@/components/ui'

export default function Entrar() {
  const { session, cargando, entrar } = useSesion()
  const loc = useLocation() as { state?: { desde?: string } }
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (cargando) return <Pantalla><span className="cargando" /></Pantalla>
  if (session) return <Navigate to={loc.state?.desde ?? '/'} replace />

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !clave) {
      setError('Completá el correo y la contraseña.')
      return
    }
    setEnviando(true)
    try {
      await entrar(email, clave)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ingresar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pantalla>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="hstack" style={{ justifyContent: 'center', marginBottom: 22, gap: 11 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--primario), var(--acento))',
          }} aria-hidden />
          <div style={{ lineHeight: 1.2 }}>
            <strong style={{ fontSize: 17 }}>PRUNAPE Digital</strong>
            <div className="min tenue">Prueba Nacional de Pesquisa</div>
          </div>
        </div>

        <form className="tarjeta" onSubmit={enviar} noValidate>
          <div className="tarjeta-cuerpo vstack" style={{ gap: 15 }}>
            {error && <Aviso>{error}</Aviso>}

            <Campo etiqueta="Correo" id="email">
              <input
                id="email" className="input" type="email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@centro.bo" autoFocus
              />
            </Campo>

            <Campo etiqueta="Contraseña" id="clave">
              <div style={{ position: 'relative' }}>
                <input
                  id="clave" className="input" type={verClave ? 'text' : 'password'}
                  autoComplete="current-password" style={{ paddingRight: 44 }}
                  value={clave} onChange={(e) => setClave(e.target.value)}
                />
                <button
                  type="button" className="btn btn-fantasma"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: 2, top: 2, height: 32, padding: '0 9px' }}
                >
                  {verClave ? '🙈' : '👁'}
                </button>
              </div>
            </Campo>

            <button className="btn btn-primario btn-grande btn-bloque" disabled={enviando}>
              {enviando ? <span className="cargando" /> : 'Ingresar'}
            </button>
          </div>
        </form>

        <p className="min tenue centrado" style={{ marginTop: 16 }}>
          ¿Olvidaste tu contraseña? Pedile al administrador de tu centro que la restablezca.
        </p>
      </div>
    </Pantalla>
  )
}
