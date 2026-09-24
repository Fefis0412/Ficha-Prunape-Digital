import { useCallback, useEffect, useState } from 'react'
import { useSesion } from '@/estado/sesion'
import { cambiarEstadoUsuario, cambiarRol, listarEquipo } from '@/datos/consultas'
import { Aviso, Cargando, Insignia, fechaCorta } from '@/components/ui'
import type { Perfil } from '@/lib/tipos'

export default function Equipo() {
  const { perfil, centro } = useSesion()
  const [equipo, setEquipo] = useState<Perfil[] | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    if (!centro?.id) return
    listarEquipo(centro.id).then(setEquipo).catch((e) => setError(e.message))
  }, [centro])

  useEffect(() => { cargar() }, [cargar])

  if (perfil?.rol !== 'admin') {
    return <Aviso tipo="info">Solo los administradores del centro pueden ver esta sección.</Aviso>
  }
  if (error) return <Aviso>{error}</Aviso>
  if (!equipo) return <Cargando />

  const cambiar = async (fn: Promise<Perfil>) => {
    try { await fn; cargar() } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }

  return (
    <div className="vstack" style={{ gap: 16 }}>
      <div>
        <h1>Equipo</h1>
        <p className="tenue min">{centro?.nombre}</p>
      </div>

      <Aviso tipo="info">
        Las altas de usuarios las hace el superadmin desde el backoffice, porque crear una
        cuenta requiere permisos que el navegador no tiene. Desde acá podés activar, desactivar
        y cambiar el rol de quienes ya existen.
      </Aviso>

      <div className="tarjeta">
        <div className="tarjeta-cabecera">
          <h2>Integrantes</h2>
          <span className="min tenue">{equipo.length}</span>
        </div>
        <table className="tabla tabla-apila">
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Alta</th><th /></tr>
          </thead>
          <tbody>
            {equipo.map((u) => {
              const yo = u.id === perfil?.id
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nombre}</strong>
                    {yo && <span className="tenue min"> (vos)</span>}
                  </td>
                  <td className="tenue">{u.email}</td>
                  <td>
                    <select
                      className="select" style={{ height: 30, width: 128 }}
                      value={u.rol ?? 'terapeuta'} disabled={yo}
                      onChange={(e) => cambiar(cambiarRol(u.id, e.target.value as 'admin' | 'terapeuta'))}
                      aria-label={`Rol de ${u.nombre}`}
                    >
                      <option value="terapeuta">Terapeuta</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    {u.activo ? <Insignia tono="ok">Activo</Insignia> : <Insignia>Inactivo</Insignia>}
                  </td>
                  <td className="tenue mono">{fechaCorta(u.creado_en)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {!yo && (
                      <button
                        className={`btn ${u.activo ? 'btn-peligro' : ''}`}
                        style={{ height: 30 }}
                        onClick={() => cambiar(cambiarEstadoUsuario(u.id, !u.activo))}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cabecera"><h2>Visibilidad de pacientes</h2></div>
        <div className="tarjeta-cuerpo vstack">
          <p className="min">
            Cada terapeuta ve <strong>únicamente los pacientes que tiene a su cargo</strong>.
            Como administrador, vos ves todos los del centro.
          </p>
          <p className="min tenue">
            Esta regla se aplica en la base de datos, no en la pantalla: aunque alguien
            manipule la aplicación, no puede leer pacientes que no le corresponden.
          </p>
        </div>
      </div>
    </div>
  )
}
