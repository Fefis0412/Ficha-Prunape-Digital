/**
 * Siembra datos de prueba contra una instancia de Supabase.
 *
 *   node scripts/sembrar.mjs
 *
 * Usa la clave de servicio (saltea RLS) para crear las cuentas y el primer
 * superadmin, que es exactamente lo que no se puede hacer desde el navegador.
 * Lee la configuración de las variables de entorno o de la instancia local.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const db = createClient(URL, SERVICE, { auth: { persistSession: false } })

const morir = (etiqueta, error) => {
  if (error) { console.error(`✗ ${etiqueta}:`, error.message ?? error); process.exit(1) }
}

/** Crea la cuenta si no existe y devuelve su id. */
async function cuenta(email, password) {
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) morir(`cuenta ${email}`, error)
    const { data: lista } = await db.auth.admin.listUsers({ perPage: 200 })
    const u = lista?.users.find((x) => x.email === email)
    if (!u) morir(`cuenta ${email}`, new Error('no se pudo recuperar'))
    return u.id
  }
  return data.user.id
}

async function perfil(id, nombre, email, centro_id, rol, es_superadmin = false) {
  const { error } = await db.from('perfiles').upsert({
    id, nombre, email, centro_id, rol, es_superadmin, activo: true,
  })
  morir(`perfil ${email}`, error)
}

async function main() {
  console.log(`▸ sembrando en ${URL}`)

  // catálogo vigente
  const { default: catalogo } = await import('../src/data/catalogo-v1.json', {
    with: { type: 'json' },
  })
  morir('catálogo', (await db.from('catalogos').upsert({
    version: catalogo.version, nombre: catalogo.nombre, definicion: catalogo,
  })).error)

  // centros
  const centros = [
    { nombre: 'Centro de Neurodesarrollo La Paz', slug: 'neuro-lapaz',
      branding: { logo_url: null, color_primario: '#2f6f4e', color_acento: '#a8c0a4' } },
    { nombre: 'Clínica Santa Cruz', slug: 'clinica-scz',
      branding: { logo_url: null, color_primario: '#1e5f8e', color_acento: '#9ec4dd' } },
  ]
  const { data: creados, error: eC } = await db.from('centros')
    .upsert(centros, { onConflict: 'slug' }).select()
  morir('centros', eC)
  const [lapaz, scz] = creados.sort((a, b) => a.slug.localeCompare(b.slug) * -1)

  // usuarios
  const sup = await cuenta('super@prunape.bo', 'Super1234!')
  await perfil(sup, 'Super Admin', 'super@prunape.bo', null, null, true)

  const ana = await cuenta('ana@lapaz.bo', 'Ana12345!')
  await perfil(ana, 'Ana Pérez', 'ana@lapaz.bo', lapaz.id, 'admin')

  const tomas = await cuenta('tomas@lapaz.bo', 'Tomas1234!')
  await perfil(tomas, 'Tomás Quispe', 'tomas@lapaz.bo', lapaz.id, 'terapeuta')

  const rita = await cuenta('rita@lapaz.bo', 'Rita1234!')
  await perfil(rita, 'Rita Flores', 'rita@lapaz.bo', lapaz.id, 'terapeuta')

  const berta = await cuenta('berta@scz.bo', 'Berta1234!')
  await perfil(berta, 'Berta Áñez', 'berta@scz.bo', scz.id, 'terapeuta')

  // pacientes: uno de Tomás, uno de Rita, uno del otro centro
  const pacientes = [
    { centro_id: lapaz.id, nombre: 'Mateo', apellido: 'Rojas',
      fecha_nacimiento: '2024-03-15', edad_gestacional_sem: 34,
      historia_clinica: 'HC-0987', sexo: 'M', responsable_id: tomas },
    { centro_id: lapaz.id, nombre: 'Sofía', apellido: 'Mamani',
      fecha_nacimiento: '2023-01-10', edad_gestacional_sem: null,
      historia_clinica: 'HC-1042', sexo: 'F', responsable_id: rita },
    { centro_id: scz.id, nombre: 'Luis', apellido: 'Choque',
      fecha_nacimiento: '2022-06-01', edad_gestacional_sem: null,
      historia_clinica: 'HC-1103', sexo: 'M', responsable_id: berta },
  ]
  // El índice de historia clínica es parcial (ignora archivados), así que
  // upsert no puede usarlo: miramos primero cuáles ya están.
  const { data: previos } = await db.from('pacientes')
    .select('historia_clinica').in('historia_clinica', pacientes.map((p) => p.historia_clinica))
  const yaHay = new Set((previos ?? []).map((p) => p.historia_clinica))
  const faltantes = pacientes.filter((p) => !yaHay.has(p.historia_clinica))
  let pacs = []
  if (faltantes.length) {
    const { data, error: eP } = await db.from('pacientes').insert(faltantes).select()
    morir('pacientes', eP)
    pacs = data
  }

  // Un acceso de soporte abierto de una corrida anterior contamina las
  // pruebas siguientes: lo cerramos al sembrar.
  const { error: eS } = await db.from('accesos_soporte')
    .update({ revocado_en: new Date().toISOString() })
    .is('revocado_en', null).gt('fin', new Date().toISOString())
  morir('cerrar accesos de soporte', eS)

  console.log(`✓ ${creados.length} centros, 5 usuarios, ${pacs.length} pacientes`)
  console.log(`
  Cuentas de prueba
  ─────────────────────────────────────────────────────
  super@prunape.bo  Super1234!   superadmin (backoffice)
  ana@lapaz.bo      Ana12345!    admin del centro La Paz
  tomas@lapaz.bo    Tomas1234!   terapeuta · ve a Rojas
  rita@lapaz.bo     Rita1234!    terapeuta · ve a Mamani
  berta@scz.bo      Berta1234!   terapeuta · otro centro
`)
}

main().catch((e) => { console.error(e); process.exit(1) })
