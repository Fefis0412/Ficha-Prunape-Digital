/**
 * Crea un usuario y, si se pide, un paciente a su nombre.
 *
 *   node scripts/crear-usuario.mjs fefis fefis123 "Paciente de Prueba"
 *   node scripts/crear-usuario.mjs ana Ana12345! --admin
 *
 * El usuario puede ser un nombre suelto: se le arma un correo interno
 * (usuario@prunape.local) porque Supabase identifica siempre por correo.
 * Quien entra a la aplicación escribe sólo el usuario.
 */
import { createClient } from '@supabase/supabase-js'

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const DOMINIO = 'prunape.local'

const db = createClient(API, SERVICE, { auth: { persistSession: false } })
const morir = (q, e) => { if (e) { console.error(`✗ ${q}:`, e.message ?? e); process.exit(1) } }

const [usuario, clave, nombrePaciente] = process.argv.slice(2)
const esAdmin = process.argv.includes('--admin')

if (!usuario || !clave) {
  console.error('uso: node scripts/crear-usuario.mjs <usuario> <clave> ["Nombre Paciente"] [--admin]')
  process.exit(1)
}

const correo = usuario.includes('@') ? usuario.toLowerCase() : `${usuario.toLowerCase()}@${DOMINIO}`

// centro: el primero que haya, o uno nuevo si la base está vacía
let { data: centros } = await db.from('centros').select('*').order('creado_en').limit(1)
if (!centros?.length) {
  const { data, error } = await db.from('centros')
    .insert({ nombre: 'Centro de Neurodesarrollo', slug: 'centro' }).select()
  morir('crear centro', error)
  centros = data
}
const centro = centros[0]

// cuenta
let id
const { data: creado, error: eC } = await db.auth.admin.createUser({
  email: correo, password: clave, email_confirm: true,
})
if (eC) {
  if (!/already|registered|exists/i.test(eC.message)) morir('crear cuenta', eC)
  const { data: lista } = await db.auth.admin.listUsers({ perPage: 500 })
  const u = lista?.users.find((x) => x.email === correo)
  if (!u) morir('recuperar cuenta', new Error('no aparece'))
  id = u.id
  // si ya existía, se le actualiza la contraseña para que quede la pedida
  morir('actualizar contraseña', (await db.auth.admin.updateUserById(id, { password: clave })).error)
  console.log(`  la cuenta ya existía; se actualizó la contraseña`)
} else {
  id = creado.user.id
}

morir('perfil', (await db.from('perfiles').upsert({
  id,
  nombre: usuario.charAt(0).toUpperCase() + usuario.slice(1),
  email: correo,
  centro_id: centro.id,
  rol: esAdmin ? 'admin' : 'terapeuta',
  es_superadmin: false,
  activo: true,
})).error)

console.log(`✓ usuario "${usuario}" (${esAdmin ? 'admin' : 'terapeuta'}) en ${centro.nombre}`)

if (nombrePaciente && !nombrePaciente.startsWith('--')) {
  const partes = nombrePaciente.trim().split(/\s+/)
  const apellido = partes.length > 1 ? partes.slice(-1)[0] : partes[0]
  const nombre = partes.length > 1 ? partes.slice(0, -1).join(' ') : ''

  const { data: previo } = await db.from('pacientes').select('id')
    .eq('centro_id', centro.id).eq('responsable_id', id)
    .ilike('apellido', apellido).maybeSingle()

  if (previo) {
    console.log(`  el paciente "${nombrePaciente}" ya existía`)
  } else {
    const { error } = await db.from('pacientes').insert({
      centro_id: centro.id,
      nombre: nombre || apellido,
      apellido,
      fecha_nacimiento: '2024-03-10',
      edad_gestacional_sem: null,
      historia_clinica: null,
      sexo: null,
      responsable_id: id,
    })
    morir('crear paciente', error)
    console.log(`✓ paciente "${nombrePaciente}", sin pesquisas`)
  }
}

console.log(`\n  Entrar con:  usuario ${usuario}  ·  contraseña ${clave}\n`)
