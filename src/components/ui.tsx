import { useEffect, useRef, type ReactNode } from 'react'

export function Pantalla({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100%', display: 'grid', placeItems: 'center',
      padding: 24, background: 'var(--fondo)',
    }}>
      {children}
    </div>
  )
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'alerta' | 'info'; children: ReactNode }) {
  const icono = tipo === 'error' ? '✕' : tipo === 'alerta' ? '!' : 'i'
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span aria-hidden style={{ fontWeight: 700, lineHeight: '1.4' }}>{icono}</span>
      <span>{children}</span>
    </div>
  )
}

export function Vacio({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="vacio">
      <h2>{titulo}</h2>
      {detalle && <p className="tenue">{detalle}</p>}
      {accion && <div style={{ marginTop: 16 }}>{accion}</div>}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="vacio hstack" style={{ justifyContent: 'center' }}>
      <span className="cargando" /> <span className="tenue">{texto}</span>
    </div>
  )
}

export function Campo({
  etiqueta, ayuda, error, children, id,
}: { etiqueta: string; ayuda?: string; error?: string; children: ReactNode; id?: string }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {error ? <span className="malo">{error}</span> : ayuda ? <span className="ayuda">{ayuda}</span> : null}
    </div>
  )
}

export function Modal({
  titulo, children, onCerrar, ancho = 520,
}: { titulo: string; children: ReactNode; onCerrar: () => void; ancho?: number }) {
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', tecla)
    const previo = document.activeElement as HTMLElement | null
    caja.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
      previo?.focus()
    }
  }, [onCerrar])

  return (
    <div
      className="modal-fondo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="tarjeta modal-caja"
        style={{ maxWidth: ancho }}
      >
        <div className="tarjeta-cabecera modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn btn-fantasma" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="tarjeta-cuerpo modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export function Insignia({
  tono = 'neutro', children,
}: { tono?: 'neutro' | 'ok' | 'error' | 'alerta' | 'primario'; children: ReactNode }) {
  const c = tono === 'neutro' ? '' : ` insignia-${tono}`
  return <span className={`insignia${c}`}>{children}</span>
}

/** Formatea 'YYYY-MM-DD' o ISO a dd/mm/aaaa sin correrse de día. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const soloFecha = iso.slice(0, 10)
  const [a, m, d] = soloFecha.split('-')
  return d && m && a ? `${d}/${m}/${a}` : '—'
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(f.getDate())}/${p(f.getMonth() + 1)} ${p(f.getHours())}:${p(f.getMinutes())}`
}
