import type { Branding } from './tipos'

export const BRANDING_POR_DEFECTO: Branding = {
  logo_url: null,
  color_primario: '#2f6f4e',
  color_acento: '#a8c0a4',
}

/** Oscurece un hex una fracción (0..1). Se usa para el estado :hover. */
export function oscurecer(hex: string, f = 0.18): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - f)))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Aclara un hex mezclándolo con blanco. Se usa para fondos suaves. */
export function aclarar(hex: string, f = 0.88): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * f))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function esHexValido(v: string): boolean {
  return /^#[\da-f]{6}$/i.test(v.trim())
}

/** Vuelca el branding del centro a variables CSS. */
export function aplicarBranding(b: Branding | null | undefined): void {
  const s = document.documentElement.style
  const p = b && esHexValido(b.color_primario) ? b.color_primario : BRANDING_POR_DEFECTO.color_primario
  const a = b && esHexValido(b.color_acento) ? b.color_acento : BRANDING_POR_DEFECTO.color_acento
  s.setProperty('--primario', p)
  s.setProperty('--primario-oscuro', oscurecer(p))
  s.setProperty('--primario-suave', aclarar(p))
  s.setProperty('--acento', a)
}
