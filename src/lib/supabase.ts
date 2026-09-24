import { createClient } from '@supabase/supabase-js'

const crudo = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/* Una ruta relativa ('/api-supabase') se resuelve contra el origen actual.
   Sirve para servir la API por el mismo dominio que la aplicación, sea
   detrás de un túnel o de un proxy inverso. */
const url = crudo?.startsWith('/') ? window.location.origin + crudo : crudo

if (!crudo || !anon) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copiá .env.example a .env.local y completá los valores.',
  )
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Traduce los errores de Postgres a algo que una terapeuta pueda entender. */
export function mensajeError(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: string }
  const msg = err?.message ?? ''

  if (err?.code === '23505') {
    if (msg.includes('pacientes_hc_unica'))
      return 'Ya existe un paciente con ese N° de historia clínica en este centro.'
    if (msg.includes('evaluaciones_un_borrador'))
      return 'Este paciente ya tiene una pesquisa en borrador. Terminala o descartala antes de empezar otra.'
    return 'Ya existe un registro con esos datos.'
  }
  if (err?.code === '23514') {
    if (msg.includes('nacimiento_no_futuro')) return 'La fecha de nacimiento no puede ser futura.'
    if (msg.includes('pesquisa_no_futura')) return 'La fecha de la pesquisa no puede ser futura.'
    if (msg.includes('eg_plausible')) return 'La edad gestacional debe estar entre 20 y 45 semanas.'
    return 'Hay un dato fuera de rango.'
  }
  if (err?.code === '42501' || msg.includes('row-level security'))
    return 'No tenés permiso para hacer esto.'
  if (msg.includes('ya fue cerrada'))
    return 'La evaluación ya fue cerrada y forma parte de la historia clínica.'
  if (msg.includes('No se permite borrar'))
    return 'Los registros clínicos no se borran. Se archivan.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return 'Sin conexión con el servidor. Revisá tu internet.'
  if (msg.includes('Invalid login credentials')) return 'Usuario o contraseña incorrectos.'
  if (msg.includes('Email not confirmed')) return 'Falta confirmar el correo de esta cuenta.'

  return msg || 'Ocurrió un error inesperado.'
}
