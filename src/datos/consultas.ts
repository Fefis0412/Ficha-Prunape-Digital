import { supabase, mensajeError } from '@/lib/supabase'
import { catalogo } from '@/lib/catalogo'
import { calcularResultado } from '@/lib/resultado'
import { diasEntre, edadCorregida, fecha } from '@/lib/edad'
import { DIAS_POR_MES } from '@/lib/edad'
import type { Centro, Evaluacion, Paciente, Perfil, RegistroAuditoria } from '@/lib/tipos'

/** Envuelve una consulta y convierte el error de Postgres en algo legible. */
async function correr<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(mensajeError(error))
  return data as T
}

/* ── pacientes ───────────────────────────────────────────────────────────── */

export interface PacienteConUltima extends Paciente {
  evaluaciones: Pick<Evaluacion, 'id' | 'fecha_pesquisa' | 'estado' | 'resultado' | 'descartado_en'>[]
}

export function listarPacientes(busqueda = '', incluirArchivados = false) {
  let q = supabase
    .from('pacientes')
    .select('*, evaluaciones(id, fecha_pesquisa, estado, resultado, descartado_en)')
    .order('apellido')
    .order('nombre')
    .limit(200)

  if (!incluirArchivados) q = q.is('archivado_en', null)
  const t = busqueda.trim()
  if (t) q = q.or(`nombre.ilike.%${t}%,apellido.ilike.%${t}%,historia_clinica.ilike.%${t}%`)
  return correr<PacienteConUltima[]>(q)
}

export const obtenerPaciente = (id: string) =>
  correr<Paciente>(supabase.from('pacientes').select('*').eq('id', id).single())

export interface AltaPaciente {
  nombre: string
  apellido: string
  fecha_nacimiento: string
  edad_gestacional_sem: number | null
  historia_clinica: string | null
  sexo: 'F' | 'M' | 'X' | null
}

export const crearPaciente = (d: AltaPaciente, centroId: string, responsableId: string) =>
  correr<Paciente>(
    supabase.from('pacientes')
      .insert({ ...d, centro_id: centroId, responsable_id: responsableId })
      .select().single(),
  )

export const actualizarPaciente = (id: string, d: Partial<AltaPaciente>) =>
  correr<Paciente>(supabase.from('pacientes').update(d).eq('id', id).select().single())

export const archivarPaciente = (id: string) =>
  correr<Paciente>(
    supabase.from('pacientes')
      .update({ archivado_en: new Date().toISOString() }).eq('id', id).select().single(),
  )

/** Posible duplicado: mismo apellido y misma fecha de nacimiento. */
export function buscarDuplicado(apellido: string, fechaNac: string) {
  return correr<Paciente[]>(
    supabase.from('pacientes').select('*')
      .ilike('apellido', apellido.trim())
      .eq('fecha_nacimiento', fechaNac)
      .is('archivado_en', null)
      .limit(3),
  )
}

/* ── evaluaciones ────────────────────────────────────────────────────────── */

export const listarEvaluaciones = (pacienteId: string) =>
  correr<(Evaluacion & { perfiles: Pick<Perfil, 'nombre'> | null })[]>(
    supabase.from('evaluaciones')
      .select('*, perfiles!evaluaciones_examinador_id_fkey(nombre)')
      .eq('paciente_id', pacienteId)
      .is('descartado_en', null)
      .order('fecha_pesquisa', { ascending: false }),
  )

export const obtenerEvaluacion = (id: string) =>
  correr<Evaluacion & { pacientes: Paciente; perfiles: Pick<Perfil, 'nombre'> | null }>(
    supabase.from('evaluaciones')
      .select('*, pacientes(*), perfiles!evaluaciones_examinador_id_fkey(nombre)')
      .eq('id', id).single(),
  )

export const borradorDe = (pacienteId: string) =>
  correr<Evaluacion | null>(
    supabase.from('evaluaciones').select('*')
      .eq('paciente_id', pacienteId).eq('estado', 'borrador')
      .is('descartado_en', null).maybeSingle(),
  )

export async function crearEvaluacion(paciente: Paciente, examinadorId: string, fechaPesquisa: string) {
  const nac = fecha(paciente.fecha_nacimiento)
  const pes = fecha(fechaPesquisa)
  const postnatal = diasEntre(nac, pes)
  const corregida = edadCorregida(nac, pes, paciente.edad_gestacional_sem)

  return correr<Evaluacion>(
    supabase.from('evaluaciones').insert({
      centro_id: paciente.centro_id,
      paciente_id: paciente.id,
      examinador_id: examinadorId,
      catalogo_version: catalogo.version,
      fecha_pesquisa: fechaPesquisa,
      edad_postnatal_dias: postnatal,
      edad_corregida_dias: corregida.dias,
      respuestas: {},
      resultado: calcularResultado({}, corregida.mesesDecimal),
    }).select().single(),
  )
}

export const guardarBorrador = (
  id: string,
  respuestas: Evaluacion['respuestas'],
  edadCorregidaDias: number,
  observaciones: string | null,
) =>
  correr<Evaluacion>(
    supabase.from('evaluaciones').update({
      respuestas,
      observaciones,
      resultado: calcularResultado(respuestas, edadCorregidaDias / DIAS_POR_MES),
    }).eq('id', id).select().single(),
  )

export const cerrarEvaluacion = (id: string, cerradaPor: string) =>
  correr<Evaluacion>(
    supabase.from('evaluaciones').update({
      estado: 'cerrada',
      cerrada_en: new Date().toISOString(),
      cerrada_por: cerradaPor,
    }).eq('id', id).select().single(),
  )

/**
 * Un borrador sin firmar todavía no es historia clínica, así que se puede
 * descartar. La fila no se borra: se marca, y el descarte queda auditado.
 */
export const descartarBorrador = (id: string) =>
  correr<Evaluacion>(
    supabase.from('evaluaciones')
      .update({ descartado_en: new Date().toISOString() })
      .eq('id', id).eq('estado', 'borrador').select().single(),
  )

/* ── equipo y centros ────────────────────────────────────────────────────── */

export const listarEquipo = (centroId: string) =>
  correr<Perfil[]>(
    supabase.from('perfiles').select('*').eq('centro_id', centroId).order('nombre'),
  )

export const cambiarEstadoUsuario = (id: string, activo: boolean) =>
  correr<Perfil>(supabase.from('perfiles').update({ activo }).eq('id', id).select().single())

export const cambiarRol = (id: string, rol: 'admin' | 'terapeuta') =>
  correr<Perfil>(supabase.from('perfiles').update({ rol }).eq('id', id).select().single())

export const listarCentros = () =>
  correr<Centro[]>(supabase.from('centros').select('*').order('nombre'))

export const obtenerCentro = (id: string) =>
  correr<Centro>(supabase.from('centros').select('*').eq('id', id).single())

export const actualizarCentro = (id: string, d: Partial<Centro>) =>
  correr<Centro>(supabase.from('centros').update(d).eq('id', id).select().single())

export const crearCentro = (nombre: string, slug: string) =>
  correr<Centro>(supabase.from('centros').insert({ nombre, slug }).select().single())

export const listarUsuariosGlobales = () =>
  correr<(Perfil & { centros: Pick<Centro, 'nombre'> | null })[]>(
    supabase.from('perfiles').select('*, centros(nombre)').order('creado_en', { ascending: false }),
  )

/* ── auditoría y soporte ─────────────────────────────────────────────────── */

export function listarAuditoria(filtros: { centroId?: string; tabla?: string; limite?: number } = {}) {
  let q = supabase.from('auditoria').select('*')
    .order('ocurrido_en', { ascending: false })
    .limit(filtros.limite ?? 100)
  if (filtros.centroId) q = q.eq('centro_id', filtros.centroId)
  if (filtros.tabla) q = q.eq('tabla', filtros.tabla)
  return correr<RegistroAuditoria[]>(q)
}

export function abrirAccesoSoporte(centroId: string, superadminId: string, motivo: string, horas: number) {
  const fin = new Date(Date.now() + horas * 3_600_000).toISOString()
  return correr(
    supabase.from('accesos_soporte')
      .insert({ centro_id: centroId, superadmin_id: superadminId, motivo, fin })
      .select().single(),
  )
}

/* ── métricas del panel ──────────────────────────────────────────────────── */

export async function contar(tabla: string, filtro?: { col: string; val: string }) {
  let q = supabase.from(tabla).select('*', { count: 'exact', head: true })
  if (filtro) q = q.eq(filtro.col, filtro.val)
  const { count, error } = await q
  if (error) throw new Error(mensajeError(error))
  return count ?? 0
}
