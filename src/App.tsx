import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import { Shell, ShellAdmin } from '@/components/Shell'
import { Pantalla } from '@/components/ui'

import Entrar from '@/paginas/Entrar'
import Inicio from '@/paginas/Inicio'
import Pacientes from '@/paginas/Pacientes'
import FichaPaciente from '@/paginas/FichaPaciente'
import Evaluacion from '@/paginas/Evaluacion'
import Equipo from '@/paginas/Equipo'
import Comparar from '@/paginas/Comparar'

import PanelAdmin from '@/paginas/admin/Panel'
import Centros from '@/paginas/admin/Centros'
import DetalleCentro from '@/paginas/admin/DetalleCentro'
import UsuariosGlobales from '@/paginas/admin/Usuarios'
import Auditoria from '@/paginas/admin/Auditoria'

function Protegido({ children, soloSuper }: { children: React.ReactNode; soloSuper?: boolean }) {
  const { cargando, session, perfil } = useSesion()
  const loc = useLocation()

  if (cargando) return <Pantalla><span className="cargando" /></Pantalla>
  if (!session) return <Navigate to="/entrar" state={{ desde: loc.pathname }} replace />

  if (!perfil) {
    return (
      <Pantalla>
        <div className="tarjeta" style={{ maxWidth: 440 }}>
          <div className="tarjeta-cuerpo vstack">
            <h1>Cuenta sin configurar</h1>
            <p className="tenue">
              Tu usuario existe pero todavía no está asignado a ningún centro.
              Pedile al administrador que complete el alta.
            </p>
            <CerrarSesion />
          </div>
        </div>
      </Pantalla>
    )
  }
  if (!perfil.activo) {
    return (
      <Pantalla>
        <div className="tarjeta" style={{ maxWidth: 440 }}>
          <div className="tarjeta-cuerpo vstack">
            <h1>Cuenta desactivada</h1>
            <p className="tenue">Tu acceso fue dado de baja. Contactá al administrador del centro.</p>
            <CerrarSesion />
          </div>
        </div>
      </Pantalla>
    )
  }
  if (soloSuper && !perfil.es_superadmin) return <Navigate to="/app" replace />
  if (!soloSuper && perfil.es_superadmin) return <Navigate to="/admin" replace />

  return <>{children}</>
}

function CerrarSesion() {
  const { salir } = useSesion()
  return <button className="btn" onClick={() => void salir()}>Cerrar sesión</button>
}

function Raiz() {
  const { cargando, session, perfil } = useSesion()
  if (cargando) return <Pantalla><span className="cargando" /></Pantalla>
  if (!session) return <Navigate to="/entrar" replace />
  return <Navigate to={perfil?.es_superadmin ? '/admin' : '/app'} replace />
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Raiz />} />
      <Route path="/entrar" element={<Entrar />} />

      <Route path="/app" element={<Protegido><Shell /></Protegido>}>
        <Route index element={<Inicio />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="pacientes/:id" element={<FichaPaciente />} />
        <Route path="pacientes/:id/comparar" element={<Comparar />} />
        <Route path="equipo" element={<Equipo />} />
      </Route>

      {/* pantalla completa: la ficha necesita todo el ancho */}
      <Route path="/app/evaluacion/:id" element={<Protegido><Evaluacion /></Protegido>} />

      <Route path="/admin" element={<Protegido soloSuper><ShellAdmin /></Protegido>}>
        <Route index element={<PanelAdmin />} />
        <Route path="centros" element={<Centros />} />
        <Route path="centros/:id" element={<DetalleCentro />} />
        <Route path="usuarios" element={<UsuariosGlobales />} />
        <Route path="auditoria" element={<Auditoria />} />
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

function NoEncontrado() {
  return (
    <Pantalla>
      <div className="vacio">
        <h2>Esa página no existe</h2>
        <p className="tenue">Puede que el enlace esté viejo o mal escrito.</p>
        <div style={{ height: 14 }} />
        <a className="btn" href="/">Volver al inicio</a>
      </div>
    </Pantalla>
  )
}
