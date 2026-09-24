import { useCallback, useEffect, useState } from 'react'
import { supabase, mensajeError } from '@/lib/supabase'
import { listarCentros, listarUsuariosGlobales } from '@/datos/consultas'
import { Aviso, Cargando, Insignia, Vacio, fechaCorta } from '@/components/ui'
import type { Centro, Perfil } from '@/lib/tipos'

type UsuarioGlobal = Perfil & { centros: Pick<Centro, 'nombre'> | null }

export default function UsuariosGlobales() {
  const [lista, setLista] = useState<UsuarioGlobal[] | null>(null)
  const [centros, setCentros] = useState<Centro[]>([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const cargar = useCallback(() => {
    Promise.all([listarUsuariosGlobales(), listarCentros()])
      .then(([u, c]) => { setLista(u); setCentros(c) })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const asignar = async (id: string, campo: 'centro_id' | 'rol' | 'activo', valor: unknown) => {
    setError(''); setOk('')
    try {
      const { error: e } = await supabase.from('perfiles').update({ [campo]: valor }).eq('id', id)
      if (e) throw e
      setOk('Actualizado.')
      setTimeout(() => setOk(''), 2000)
      cargar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  if (error && !lista) return <Aviso>{error}</Aviso>
  if (!lista) return <Cargando />

  const sinCentro = lista.filter((u) => !u.es_superadmin && !u.centro_id)

  return (
    <div className="vstack" style={{ gap: 16 }}>
      <h1>Usuarios</h1>

      <Aviso tipo="info">
        Las cuentas se crean en Supabase (Authentication → Add user). Al crearse aparecen acá
        sin centro asignado; desde esta pantalla se les asigna centro y rol.
      </Aviso>

      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tipo="info">{ok}</Aviso>}

      {sinCentro.length > 0 && (
        <div className="tarjeta" style={{ borderColor: 'var(--alerta)' }}>
          <div className="tarjeta-cabecera">
            <h2>Esperando asignación</h2>
            <Insignia tono="alerta">{sinCentro.length}</Insignia>
          </div>
          <div className="tarjeta-cuerpo">
            <p className="min tenue">
              Estas cuentas existen pero todavía no pueden entrar a ningún centro.
            </p>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <div className="tarjeta-cabecera"><h2>Todos los usuarios</h2></div>
        {lista.length === 0 ? (
          <Vacio titulo="No hay usuarios todavía" />
        ) : (
          <table className="tabla tabla-apila">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Centro</th><th>Rol</th><th>Estado</th><th>Alta</th></tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nombre}</strong>
                    {u.es_superadmin && <> <Insignia tono="primario">Superadmin</Insignia></>}
                  </td>
                  <td className="tenue">{u.email}</td>
                  <td>
                    {u.es_superadmin ? <span className="tenue">—</span> : (
                      <select className="select" style={{ height: 30, minWidth: 160 }}
                        value={u.centro_id ?? ''}
                        onChange={(e) => asignar(u.id, 'centro_id', e.target.value || null)}
                        aria-label={`Centro de ${u.nombre}`}>
                        <option value="">Sin asignar</option>
                        {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {u.es_superadmin ? <span className="tenue">—</span> : (
                      <select className="select" style={{ height: 30, width: 128 }}
                        value={u.rol ?? ''} disabled={!u.centro_id}
                        onChange={(e) => asignar(u.id, 'rol', e.target.value || null)}
                        aria-label={`Rol de ${u.nombre}`}>
                        <option value="">—</option>
                        <option value="terapeuta">Terapeuta</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <button className="btn" style={{ height: 28 }}
                      onClick={() => asignar(u.id, 'activo', !u.activo)}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="tenue mono">{fechaCorta(u.creado_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
