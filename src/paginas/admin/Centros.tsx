import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { crearCentro, listarCentros } from '@/datos/consultas'
import { Aviso, Campo, Cargando, Insignia, Modal, Vacio, fechaCorta } from '@/components/ui'
import type { Centro } from '@/lib/tipos'

const aSlug = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export default function Centros() {
  const nav = useNavigate()
  const [lista, setLista] = useState<Centro[] | null>(null)
  const [error, setError] = useState('')
  const [abrir, setAbrir] = useState(false)

  const cargar = useCallback(() => {
    listarCentros().then(setLista).catch((e) => setError(e.message))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!lista) return <Cargando />

  return (
    <div className="vstack" style={{ gap: 16 }}>
      <div className="hstack entre">
        <h1>Centros</h1>
        <button className="btn btn-primario" onClick={() => setAbrir(true)}>+ Nuevo centro</button>
      </div>

      <div className="tarjeta">
        {lista.length === 0 ? (
          <Vacio
            titulo="Todavía no hay centros"
            detalle="Creá el primero para empezar a dar de alta usuarios."
            accion={<button className="btn btn-primario" onClick={() => setAbrir(true)}>+ Nuevo centro</button>}
          />
        ) : (
          <table className="tabla tabla-apila">
            <thead>
              <tr><th>Centro</th><th>Identificador</th><th>Alta</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="clicable" onClick={() => nav(`/admin/centros/${c.id}`)}>
                  <td>
                    <span className="hstack" style={{ gap: 8 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 5, flex: 'none',
                        background: c.branding?.color_primario ?? 'var(--primario)',
                      }} aria-hidden />
                      <strong>{c.nombre}</strong>
                    </span>
                  </td>
                  <td className="tenue mono">{c.slug}</td>
                  <td className="tenue mono">{fechaCorta(c.creado_en)}</td>
                  <td>
                    {c.activo ? <Insignia tono="ok">Activo</Insignia> : <Insignia>Suspendido</Insignia>}
                  </td>
                  <td style={{ textAlign: 'right' }}><span className="btn btn-fantasma">Ver →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {abrir && (
        <ModalNuevo
          onCerrar={() => setAbrir(false)}
          onCreado={(c) => { setAbrir(false); nav(`/admin/centros/${c.id}`) }}
        />
      )}
    </div>
  )
}

function ModalNuevo({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (c: Centro) => void }) {
  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const slugFinal = tocado ? slug : aSlug(nombre)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('Poné un nombre.'); return }
    if (!slugFinal) { setError('El identificador no puede quedar vacío.'); return }
    setEnviando(true)
    try {
      onCreado(await crearCentro(nombre.trim(), slugFinal))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.')
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nuevo centro" onCerrar={onCerrar} ancho={460}>
      <form className="vstack" style={{ gap: 15 }} onSubmit={enviar} noValidate>
        {error && <Aviso>{error}</Aviso>}
        <Campo etiqueta="Nombre del centro" id="c-nom">
          <input id="c-nom" className="input" value={nombre} autoFocus
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Centro de Neurodesarrollo La Paz" />
        </Campo>
        <Campo etiqueta="Identificador" id="c-slug"
          ayuda="Se usa internamente. Solo minúsculas, números y guiones.">
          <input id="c-slug" className="input" value={slugFinal}
            onChange={(e) => { setTocado(true); setSlug(aSlug(e.target.value)) }} />
        </Campo>
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? <span className="cargando" /> : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
