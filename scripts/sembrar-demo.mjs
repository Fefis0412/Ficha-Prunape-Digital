/**
 * Agrega historial clínico de demostración: tres pesquisas cerradas a la
 * misma paciente, con una progresión realista, para poder ver la línea de
 * tiempo y la comparación de evolución con datos.
 *
 *   node scripts/sembrar-demo.mjs
 *
 * Requiere haber corrido antes scripts/sembrar.mjs.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const db = createClient(API, SERVICE, { auth: { persistSession: false } })
const catalogo = JSON.parse(readFileSync(new URL('../src/data/catalogo-v1.json', import.meta.url)))

const DIAS_MES = 30.4375
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000)

/** Marca como "pasa" todo lo esperable a esa edad, salvo los ítems a fallar. */
function responder(mesesCorregidos, fallar = []) {
  const r = {}
  for (const it of catalogo.items) {
    const umbral = it.edad_meses.p75 ?? it.edad_meses.p90
    if (mesesCorregidos < umbral) continue
    r[it.id] = fallar.includes(it.id) ? 'no_pasa' : 'pasa'
  }
  return r
}

function resultado(respuestas) {
  let fallosA = 0, fallosB = 0, pasados = 0
  for (const it of catalogo.items) {
    const m = respuestas[it.id]
    if (m === 'pasa') pasados++
    else if (m === 'no_pasa') (it.tipo === 'A' ? fallosA++ : fallosB++)
  }
  const marcados = pasados + fallosA + fallosB
  return {
    fallosA, fallosB, pasados, marcados, sinMarcarEsperables: 0,
    veredicto: marcados === 0 ? 'sin_datos'
      : fallosA >= 1 || fallosB >= 2 ? 'derivar' : 'pasa',
  }
}

const muere = (etiqueta, e) => {
  if (e) { console.error(`✗ ${etiqueta}:`, e.message ?? e); process.exit(1) }
}

const { data: paciente } = await db.from('pacientes')
  .select('*').eq('historia_clinica', 'HC-1042').maybeSingle()
if (!paciente) {
  console.error('✗ falta la paciente HC-1042. Corré antes scripts/sembrar.mjs')
  process.exit(1)
}

const { data: rita } = await db.from('perfiles')
  .select('id').eq('email', 'rita@lapaz.bo').single()

// Tres ítems de lenguaje que fallan al principio y se recuperan después
const aFallar = catalogo.items
  .filter((i) => i.area === 'lenguaje' && i.edad_meses.p90 < 30)
  .slice(-3).map((i) => i.id)

const pesquisas = [
  { fecha: '2024-02-10', fallar: [] },
  { fecha: '2025-03-12', fallar: aFallar },          // derivar
  { fecha: '2026-09-15', fallar: [] },               // recuperado
]

await db.from('evaluaciones').delete().eq('paciente_id', paciente.id)

for (const p of pesquisas) {
  const d = dias(paciente.fecha_nacimiento, p.fecha)
  if (d < 0) continue
  const respuestas = responder(d / DIAS_MES, p.fallar)
  const { error } = await db.from('evaluaciones').insert({
    centro_id: paciente.centro_id,
    paciente_id: paciente.id,
    examinador_id: rita.id,
    catalogo_version: catalogo.version,
    fecha_pesquisa: p.fecha,
    edad_postnatal_dias: d,
    edad_corregida_dias: d,
    respuestas,
    resultado: resultado(respuestas),
    estado: 'cerrada',
    cerrada_en: new Date(p.fecha).toISOString(),
    cerrada_por: rita.id,
  })
  muere(`pesquisa ${p.fecha}`, error)
  const r = resultado(respuestas)
  console.log(`  ${p.fecha} · ${r.pasados} pasados · ${r.fallosA}A ${r.fallosB}B · ${r.veredicto}`)
}

console.log('\n✓ historial cargado en Mamani, Sofía (rita@lapaz.bo)')
