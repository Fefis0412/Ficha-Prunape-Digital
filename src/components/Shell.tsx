import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import { supabase } from '@/lib/supabase'
import { aNombreVisible } from '@/lib/usuario'
import type { AccesoSoporte } from '@/lib/tipos'
import './shell.css'

interface Enlace { a: string; texto: string; fin?: boolean; soloAdmin?: boolean }

const ENLACES_CENTRO: Enlace[] = [
  { a: '/app', texto: 'Inicio', fin: true },
  { a: '/app/pacientes', texto: 'Pacientes' },
  { a: '/app/equipo', texto: 'Equipo', soloAdmin: true },
]

const ENLACES_ADMIN: Enlace[] = [
  { a: '/admin', texto: 'Panel', fin: true },
  { a: '/admin/centros', texto: 'Centros' },
  { a: '/admin/usuarios', texto: 'Usuarios' },
  { a: '/admin/auditoria', texto: 'Auditoría' },
]

function Lateral({ enlaces, titulo, esAdmin }: { enlaces: Enlace[]; titulo: string; esAdmin: boolean }) {
  const { perfil, centro } = useSesion()
  const logo = centro?.branding?.logo_url
  return (
    <aside className="lateral">
      <div className="lateral-marca">
        {logo ? (
          <img src={logo} alt="" className="lateral-logo" />
        ) : (
          <span className="lateral-punto" aria-hidden />
        )}
        <div className="lateral-titulo">
          <strong>{titulo}</strong>
          {!esAdmin && centro && <span className="min tenue">{centro.nombre}</span>}
        </div>
      </div>
      <nav className="lateral-nav">
        {enlaces
          .filter((e) => !e.soloAdmin || perfil?.rol === 'admin')
          .map((e) => (
            <NavLink
              key={e.a}
              to={e.a}
              end={e.fin}
              className={({ isActive }) => `lateral-link${isActive ? ' activo' : ''}`}
            >
              {e.texto}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}

/** Marca del centro; en celular vive en la cabecera porque abajo está la
 *  barra de pestañas. */
function MarcaCabecera({ titulo, esAdmin }: { titulo: string; esAdmin: boolean }) {
  const { centro } = useSesion()
  const logo = centro?.branding?.logo_url
  return (
    <div className="cabecera-marca">
      {logo
        ? <img src={logo} alt="" className="lateral-logo" />
        : <span className="lateral-punto" aria-hidden />}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
        <strong>{titulo}</strong>
        {!esAdmin && centro && <span>{centro.nombre}</span>}
      </div>
    </div>
  )
}

function BarraUsuario() {
  const { perfil, salir } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!abierto) return
    const cerrar = () => setAbierto(false)
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [abierto])

  const rol = perfil?.es_superadmin
    ? 'Superadmin'
    : perfil?.rol === 'admin' ? 'Administración' : 'Terapeuta'

  return (
    <div className="usuario" onClick={(e) => e.stopPropagation()}>
      <button className="btn btn-fantasma" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="usuario-inicial" aria-hidden>{perfil?.nombre?.[0]?.toUpperCase() ?? '?'}</span>
        <span className="usuario-nombre">{perfil?.nombre}</span>
        <span aria-hidden>▾</span>
      </button>
      {abierto && (
        <div className="usuario-menu tarjeta">
          <div className="usuario-menu-cab">
            <strong>{perfil?.nombre}</strong>
            <span className="min tenue">{aNombreVisible(perfil?.email)}</span>
            <span className="min tenue">{rol}</span>
          </div>
          <button
            className="btn btn-fantasma btn-bloque"
            onClick={async () => { await salir(); nav('/entrar', { replace: true }) }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

/** Avisa a la franja de soporte que hay que volver a consultar, sin esperar
 *  al temporizador. Lo dispara quien abre o cierra un acceso. */
export const avisarCambioSoporte = () =>
  window.dispatchEvent(new CustomEvent('prunape:soporte'))

/** Franja roja mientras un superadmin tiene abierta una ventana de soporte. */
function BarraSoporte() {
  const { perfil } = useSesion()
  const [acceso, setAcceso] = useState<(AccesoSoporte & { centros: { nombre: string } }) | null>(null)
  const [restante, setRestante] = useState('')

  useEffect(() => {
    if (!perfil?.es_superadmin) return
    let vivo = true
    const consultar = async () => {
      const { data } = await supabase
        .from('accesos_soporte')
        .select('*, centros(nombre)')
        .is('revocado_en', null)
        .gt('fin', new Date().toISOString())
        .order('inicio', { ascending: false })
        .limit(1)
      if (vivo) setAcceso((data?.[0] as never) ?? null)
    }
    void consultar()
    const t = setInterval(consultar, 30_000)
    window.addEventListener('prunape:soporte', consultar)
    return () => {
      vivo = false
      clearInterval(t)
      window.removeEventListener('prunape:soporte', consultar)
    }
  }, [perfil])

  useEffect(() => {
    if (!acceso) return
    const tic = () => {
      const min = Math.max(0, Math.round((new Date(acceso.fin).getTime() - Date.now()) / 60000))
      setRestante(min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`)
    }
    tic()
    const t = setInterval(tic, 30_000)
    return () => clearInterval(t)
  }, [acceso])

  if (!acceso) return null
  return (
    <div className="barra-soporte" role="status">
      <strong>ACCESO DE SOPORTE ACTIVO</strong>
      <span>· {acceso.centros?.nombre} · queda {restante}</span>
      <span className="crece" />
      <button
        className="barra-soporte-btn"
        onClick={async () => {
          await supabase.from('accesos_soporte')
            .update({ revocado_en: new Date().toISOString() }).eq('id', acceso.id)
          setAcceso(null)
          avisarCambioSoporte()
        }}
      >
        Cerrar acceso
      </button>
    </div>
  )
}

export function Shell() {
  return (
    <div className="marco">
      <Lateral enlaces={ENLACES_CENTRO} titulo="PRUNAPE" esAdmin={false} />
      <div className="columna">
        <header className="cabecera">
          <MarcaCabecera titulo="PRUNAPE" esAdmin={false} />
          <span className="crece" />
          <BarraUsuario />
        </header>
        <main className="contenido"><Outlet /></main>
      </div>
    </div>
  )
}

export function ShellAdmin() {
  return (
    <div className="marco admin">
      <Lateral enlaces={ENLACES_ADMIN} titulo="Backoffice" esAdmin />
      <div className="columna">
        <BarraSoporte />
        <header className="cabecera">
          <MarcaCabecera titulo="Backoffice" esAdmin />
          <span className="crece" />
          <BarraUsuario />
        </header>
        <main className="contenido"><Outlet /></main>
      </div>
    </div>
  )
}
