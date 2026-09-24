/**
 * Supabase Auth identifica siempre por correo. Para que el equipo pueda
 * entrar con un usuario suelto —"fefis" en vez de "fefis@algo.bo"— se le
 * arma un correo interno con un dominio reservado. El usuario nunca lo ve:
 * escribe su nombre y listo.
 */
export const DOMINIO_INTERNO = 'prunape.local'

/** 'fefis' → 'fefis@prunape.local' · un correo de verdad se deja como está. */
export function aCorreo(entrada: string): string {
  const v = entrada.trim().toLowerCase()
  if (!v) return v
  return v.includes('@') ? v : `${v.replace(/\s+/g, '')}@${DOMINIO_INTERNO}`
}

/** Al revés: para mostrar 'fefis' y no el correo interno. */
export function aNombreVisible(correo: string | null | undefined): string {
  if (!correo) return ''
  return correo.endsWith(`@${DOMINIO_INTERNO}`) ? correo.split('@')[0] : correo
}

export const esCorreoInterno = (correo: string | null | undefined) =>
  !!correo?.endsWith(`@${DOMINIO_INTERNO}`)
