import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '@/estado/sesion'
import {
  buscarDuplicado, crearPaciente, listarPacientes,
  type AltaPaciente, type PacienteConUltima,
} from '@/datos/consultas'
import { Aviso, Campo, Cargando, Insignia, Modal, Vacio, fechaCorta } from '@/components/ui'
import { aISO, edadPostnatal, esPrematuro, fecha, formatoCorto } from '@/lib/edad'
import { nombreCompleto, type Paciente } from '@/lib/tipos'
import type { Resultado } from '@/lib/resultado'

export default function Pacientes() {
  const nav = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState<PacienteConUltima[] | null>(null)
  const [error, setError] = useState('')
  const [abrirAlta, setAbrirAlta] = useState(false)

  const recargar = (q = busqueda) =>
    listarPacientes(q).then(setLista).catch((e) => setError(e.message))

  useEffect(() => {
    const t = setTimeout(() => void recargar(busqueda), busqueda ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  return (
    <div className="vstack" style={{ gap: 16 }}>
      <div className="hstack entre">
        <h1>Pacientes</h1>
        <button className="btn btn-primario" onClick={() => setAbrirAlta(true)}>+ Nuevo paciente</button>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <input
        className="input" style={{ maxWidth: 340 }} type="search"
        placeholder="Buscar por nombre, apellido o N° de historia clínica"
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        aria-label="Buscar pacientes"
      />

      <div className="tarjeta">
        {!lista ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio
            titulo={busqueda ? 'Sin resultados' : 'Todavía no hay pacientes'}
            detalle={busqueda
              ? 'Probá con otro nombre o número de historia clínica.'
              : 'Registrá el primero para poder aplicar una pesquisa.'}
            accion={!busqueda && (
              <button className="btn btn-primario" onClick={() => setAbrirAlta(true)}>
                + Registrar el primero
              </button>
            )}
          />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th><th>Edad</th><th>H. Clínica</th>
                <th>Última pesquisa</th><th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const ult = p.evaluaciones.filter((e) => !e.descartado_en).sort((a, b) =>
                  b.fecha_pesquisa.localeCompare(a.fecha_pesquisa))[0]
                const v = (ult?.resultado as Resultado)?.veredicto
                return (
                  <tr key={p.id} className="clicable" onClick={() => nav(`/app/pacientes/${p.id}`)}>
                    <td>
                      <strong>{nombreCompleto(p)}</strong>
                      {esPrematuro(p.edad_gestacional_sem) && (
                        <> <Insignia tono="primario">EG {p.edad_gestacional_sem}s</Insignia></>
                      )}
                    </td>
                    <td className="tenue">
                      {formatoCorto(edadPostnatal(fecha(p.fecha_nacimiento), new Date()))}
                    </td>
                    <td className="tenue mono">{p.historia_clinica || '—'}</td>
                    <td className="tenue mono">{ult ? fechaCorta(ult.fecha_pesquisa) : '—'}</td>
                    <td>
                      {!ult ? <span className="tenue">—</span>
                        : ult.estado === 'borrador' ? <Insignia tono="alerta">Borrador</Insignia>
                        : v === 'pasa' ? <Insignia tono="ok">Pasa</Insignia>
                        : v === 'derivar' ? <Insignia tono="error">Derivar</Insignia>
                        : <Insignia>Sin datos</Insignia>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {abrirAlta && (
        <ModalAlta
          onCerrar={() => setAbrirAlta(false)}
          onCreado={(p) => { setAbrirAlta(false); nav(`/app/pacientes/${p.id}`) }}
        />
      )}
    </div>
  )
}

/* ── alta ────────────────────────────────────────────────────────────────── */

const VACIO: AltaPaciente = {
  nombre: '', apellido: '', fecha_nacimiento: '',
  edad_gestacional_sem: null, historia_clinica: null, sexo: null,
}

function ModalAlta({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (p: Paciente) => void }) {
  const { perfil, centro } = useSesion()
  const [d, setD] = useState<AltaPaciente>(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [duplicados, setDuplicados] = useState<Paciente[]>([])
  const [forzar, setForzar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const hoy = useMemo(() => aISO(new Date()), [])

  const validar = () => {
    const e: Record<string, string> = {}
    if (!d.nombre.trim()) e.nombre = 'Requerido'
    if (!d.apellido.trim()) e.apellido = 'Requerido'
    if (!d.fecha_nacimiento) e.fecha_nacimiento = 'Requerida'
    else if (d.fecha_nacimiento > hoy) e.fecha_nacimiento = 'No puede ser futura'
    if (d.edad_gestacional_sem != null &&
        (d.edad_gestacional_sem < 20 || d.edad_gestacional_sem > 45))
      e.edad_gestacional_sem = 'Entre 20 y 45 semanas'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validar()) return
    if (!perfil?.id || !centro?.id) { setError('Tu usuario no tiene centro asignado.'); return }

    if (!forzar) {
      const dup = await buscarDuplicado(d.apellido, d.fecha_nacimiento).catch(() => [])
      if (dup.length) { setDuplicados(dup); setForzar(true); return }
    }

    setEnviando(true)
    try {
      const p = await crearPaciente(
        { ...d, historia_clinica: d.historia_clinica?.trim() || null },
        centro.id, perfil.id,
      )
      onCreado(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nuevo paciente" onCerrar={onCerrar} ancho={560}>
      <form className="vstack" style={{ gap: 15 }} onSubmit={enviar} noValidate>
        {error && <Aviso>{error}</Aviso>}

        <div className="fila fila-2">
          <Campo etiqueta="Nombre *" id="nombre" error={errores.nombre}>
            <input id="nombre" className="input" value={d.nombre}
              aria-invalid={!!errores.nombre}
              onChange={(e) => setD({ ...d, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Apellido *" id="apellido" error={errores.apellido}>
            <input id="apellido" className="input" value={d.apellido}
              aria-invalid={!!errores.apellido}
              onChange={(e) => setD({ ...d, apellido: e.target.value })} />
          </Campo>
        </div>

        <div className="fila fila-3">
          <Campo etiqueta="Fecha de nacimiento *" id="fnac" error={errores.fecha_nacimiento}>
            <input id="fnac" className="input" type="date" max={hoy} value={d.fecha_nacimiento}
              aria-invalid={!!errores.fecha_nacimiento}
              onChange={(e) => setD({ ...d, fecha_nacimiento: e.target.value })} />
          </Campo>
          <Campo etiqueta="N° H. Clínica" id="hc">
            <input id="hc" className="input" value={d.historia_clinica ?? ''}
              onChange={(e) => setD({ ...d, historia_clinica: e.target.value })} />
          </Campo>
          <Campo etiqueta="Sexo" id="sexo">
            <select id="sexo" className="select" value={d.sexo ?? ''}
              onChange={(e) => setD({ ...d, sexo: (e.target.value || null) as AltaPaciente['sexo'] })}>
              <option value="">—</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="X">Otro</option>
            </select>
          </Campo>
        </div>

        <Campo
          etiqueta="Edad gestacional (semanas)" id="eg"
          error={errores.edad_gestacional_sem}
          ayuda="Si es menor a 37, la edad se corrige automáticamente en cada pesquisa."
        >
          <input id="eg" className="input" type="number" step="0.1" min={20} max={45}
            style={{ maxWidth: 120 }} value={d.edad_gestacional_sem ?? ''}
            aria-invalid={!!errores.edad_gestacional_sem}
            onChange={(e) => setD({
              ...d, edad_gestacional_sem: e.target.value === '' ? null : Number(e.target.value),
            })} />
        </Campo>

        {duplicados.length > 0 && (
          <Aviso tipo="alerta">
            Ya existe un paciente con ese apellido y fecha de nacimiento:{' '}
            <strong>{duplicados.map(nombreCompleto).join(', ')}</strong>.
            Si igual es otro paciente, volvé a presionar Guardar.
          </Aviso>
        )}

        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? <span className="cargando" /> : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
