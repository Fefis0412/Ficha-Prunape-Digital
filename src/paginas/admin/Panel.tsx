import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contar, listarAuditoria } from '@/datos/consultas'
import { Aviso, Cargando, fechaHora } from '@/components/ui'
import type { RegistroAuditoria } from '@/lib/tipos'

const ACCION: Record<string, string> = {
  alta: 'creó', cambio: 'modificó', archivado: 'archivó',
  cierre: 'cerró', lectura_soporte: 'acceso de soporte',
}
const TABLA: Record<string, string> = {
  pacientes: 'un paciente', evaluaciones: 'una evaluación',
  perfiles: 'un usuario', centros: 'un centro',
}

export default function PanelAdmin() {
  const [cifras, setCifras] = useState<Record<string, number> | null>(null)
  const [actividad, setActividad] = useState<RegistroAuditoria[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      contar('centros'), contar('perfiles'), contar('pacientes'), contar('evaluaciones'),
      listarAuditoria({ limite: 12 }),
    ])
      .then(([centros, usuarios, pacientes, evaluaciones, act]) => {
        setCifras({ centros, usuarios, pacientes, evaluaciones })
        setActividad(act)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
  }, [])

  if (error) return <Aviso>{error}</Aviso>
  if (!cifras) return <Cargando />

  // El plan gratuito de Supabase da 500 MB. Estimamos ~5 KB por evaluación.
  const mbUsados = (cifras.evaluaciones * 5) / 1024
  const pct = Math.min(100, (mbUsados / 500) * 100)

  return (
    <div className="vstack" style={{ gap: 20 }}>
      <h1>Panel general</h1>

      <div className="fila" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Cifra n={cifras.centros} rotulo="Centros" a="/admin/centros" />
        <Cifra n={cifras.usuarios} rotulo="Usuarios" a="/admin/usuarios" />
        <Cifra n={cifras.pacientes} rotulo="Pacientes" />
        <Cifra n={cifras.evaluaciones} rotulo="Evaluaciones" />
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cabecera"><h2>Almacenamiento estimado</h2></div>
        <div className="tarjeta-cuerpo vstack">
          <div style={{ height: 8, background: '#eef1f3', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(pct, 1)}%`, height: '100%',
              background: pct > 80 ? 'var(--error)' : 'var(--primario)',
            }} />
          </div>
          <p className="min tenue">
            {mbUsados.toFixed(1)} MB de 500 MB del plan gratuito
            {' '}· estimado sobre {cifras.evaluaciones} evaluaciones
          </p>
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-cabecera">
          <h2>Actividad reciente</h2>
          <Link className="btn" to="/admin/auditoria">Ver auditoría</Link>
        </div>
        {actividad.length === 0 ? (
          <div className="tarjeta-cuerpo"><p className="tenue min">Todavía no hay movimientos.</p></div>
        ) : (
          <table className="tabla">
            <tbody>
              {actividad.map((a) => (
                <tr key={a.id}>
                  <td className="tenue mono" style={{ width: 96 }}>{fechaHora(a.ocurrido_en)}</td>
                  <td>{ACCION[a.accion] ?? a.accion} {TABLA[a.tabla] ?? a.tabla}</td>
                  <td className="tenue mono min" style={{ textAlign: 'right' }}>
                    {a.registro_id.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Cifra({ n, rotulo, a }: { n: number; rotulo: string; a?: string }) {
  const cuerpo = (
    <div className="tarjeta-cuerpo" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div className="min tenue">{rotulo}</div>
    </div>
  )
  return a
    ? <Link className="tarjeta" to={a} style={{ textDecoration: 'none', color: 'inherit' }}>{cuerpo}</Link>
    : <div className="tarjeta">{cuerpo}</div>
}
