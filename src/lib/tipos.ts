import type { Respuestas } from './catalogo'
import type { Resultado } from './resultado'

export type RolCentro = 'admin' | 'terapeuta'
export type EstadoEvaluacion = 'borrador' | 'cerrada'

export interface Branding {
  logo_url: string | null
  color_primario: string
  color_acento: string
}

export interface Centro {
  id: string
  nombre: string
  slug: string
  activo: boolean
  branding: Branding
  creado_en: string
  archivado_en: string | null
}

export interface Perfil {
  id: string
  nombre: string
  email: string
  centro_id: string | null
  rol: RolCentro | null
  es_superadmin: boolean
  activo: boolean
  creado_en: string
}

export interface Paciente {
  id: string
  centro_id: string
  nombre: string
  apellido: string
  fecha_nacimiento: string
  edad_gestacional_sem: number | null
  historia_clinica: string | null
  sexo: 'F' | 'M' | 'X' | null
  responsable_id: string
  creado_en: string
  actualizado_en: string
  archivado_en: string | null
}

export interface Evaluacion {
  id: string
  centro_id: string
  paciente_id: string
  examinador_id: string
  catalogo_version: number
  fecha_pesquisa: string
  edad_postnatal_dias: number
  edad_corregida_dias: number
  respuestas: Respuestas
  resultado: Resultado | Record<string, never>
  observaciones: string | null
  estado: EstadoEvaluacion
  descartado_en: string | null
  cerrada_en: string | null
  cerrada_por: string | null
  creado_en: string
  actualizado_en: string
}

export interface RegistroAuditoria {
  id: number
  ocurrido_en: string
  usuario_id: string | null
  centro_id: string | null
  tabla: string
  registro_id: string
  accion: 'alta' | 'cambio' | 'archivado' | 'cierre' | 'lectura_soporte'
  datos_antes: Record<string, unknown> | null
  datos_despues: Record<string, unknown> | null
}

export interface AccesoSoporte {
  id: string
  superadmin_id: string
  centro_id: string
  motivo: string
  inicio: string
  fin: string
  revocado_en: string | null
}

export const nombreCompleto = (p: Pick<Paciente, 'nombre' | 'apellido'>) =>
  `${p.apellido}, ${p.nombre}`
