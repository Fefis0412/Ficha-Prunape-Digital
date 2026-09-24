import { useEffect, useState } from 'react'
import { listarAuditoria, listarCentros } from '@/datos/consultas'
import { Aviso, Cargando, Insignia, Modal, Vacio, fechaHora } from '@/components/ui'
import type { Centro, RegistroAuditoria } from '@/lib/tipos'

const ACCION: Record<string, { texto: string; tono: 'neutro' | 'ok' | 'alerta' | 'error' }> = {
  alta: { texto: 'creó', tono: 'ok' },
  cambio: { texto: 'modificó', tono: 'neutro' },
  archivado: { texto: 'archivó', tono: 'alerta' },
  cierre: { texto: 'cerró', tono: 'ok' },
  lectura_soporte: { texto: 'acceso soporte', tono: 'error' },
}

const TABLAS = ['pacientes', 'evaluaciones', 'perfiles', 'centros']

export default function Auditoria() {
  const [filas, setFilas] = useState<RegistroAuditoria[] | null>(null)
  const [centros, setCentros] = useState<Centro[]>([])
  const [centroId, setCentroId] = useState('')
  const [tabla, setTabla] = useState('')
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null)

  useEffect(() => { listarCentros().then(setCentros).catch(() => {}) }, [])

  useEffect(() => {
    setFilas(null)
    listarAuditoria({ centroId: centroId || undefined, tabla: tabla || undefined, limite: 200 })
      .then(setFilas)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
  }, [centroId, tabla])

  if (error) return <Aviso>{error}</Aviso>

  return (
    <div className="vstack" style={{ gap: 16 }}>
      <h1>Auditoría</h1>

      <div className="hstack">
        <select className="select" style={{ width: 210 }} value={centroId}
          onChange={(e) => setCentroId(e.target.value)} aria-label="Filtrar por centro">
          <option value="">Todos los centros</option>
          {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="select" style={{ width: 175 }} value={tabla}
          onChange={(e) => setTabla(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todo</option>
          {TABLAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(centroId || tabla) && (
          <button className="btn btn-fantasma" onClick={() => { setCentroId(''); setTabla('') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="tarjeta">
        {!filas ? <Cargando /> : filas.length === 0 ? (
          <Vacio titulo="Sin movimientos" detalle="No hay registros que coincidan con el filtro." />
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Acción</th><th>Tipo</th><th>Registro</th><th /></tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const a = ACCION[f.accion] ?? { texto: f.accion, tono: 'neutro' as const }
                return (
                  <tr key={f.id} className="clicable" onClick={() => setDetalle(f)}>
                    <td className="tenue mono" style={{ width: 110 }}>{fechaHora(f.ocurrido_en)}</td>
                    <td><Insignia tono={a.tono}>{a.texto}</Insignia></td>
                    <td className="tenue">{f.tabla}</td>
                    <td className="tenue mono min">{f.registro_id.slice(0, 8)}…</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="btn btn-fantasma" style={{ height: 28 }}>Ver cambio ↗</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="min tenue">
        Esta tabla es de solo-agregado: la escriben triggers de la base de datos y no se
        puede editar ni borrar desde la aplicación, ni siquiera desde acá.
      </p>

      {detalle && <ModalDetalle fila={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  )
}

function ModalDetalle({ fila, onCerrar }: { fila: RegistroAuditoria; onCerrar: () => void }) {
  const antes = fila.datos_antes ?? {}
  const despues = fila.datos_despues ?? {}
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])]
    .filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
    .filter((k) => k !== 'actualizado_en')

  const recorta = (v: unknown) => {
    const s = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return s.length > 160 ? s.slice(0, 160) + '…' : s
  }

  return (
    <Modal titulo={`${fila.accion} · ${fila.tabla}`} onCerrar={onCerrar} ancho={720}>
      <div className="vstack" style={{ gap: 14 }}>
        <div className="min tenue mono">
          {fechaHora(fila.ocurrido_en)} · registro {fila.registro_id}
        </div>
        {claves.length === 0 ? (
          <p className="tenue min">No hay diferencias de campos para mostrar.</p>
        ) : (
          <table className="tabla">
            <thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
            <tbody>
              {claves.map((k) => (
                <tr key={k}>
                  <td><strong>{k}</strong></td>
                  <td className="min mono" style={{ color: 'var(--texto-2)', wordBreak: 'break-all' }}>
                    {recorta(antes[k])}
                  </td>
                  <td className="min mono" style={{ wordBreak: 'break-all' }}>
                    {recorta(despues[k])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
