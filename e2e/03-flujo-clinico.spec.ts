import { expect, test, type Page } from '@playwright/test'
import { entrar, limpiarSesion } from './ayudas'

test.beforeEach(async ({ page }) => { await limpiarSesion(page) })

/** Crea un paciente con apellido único para que cada test sea independiente. */
async function nuevoPaciente(page: Page, apellido: string, opciones: {
  eg?: string; fechaNac?: string; hc?: string
} = {}) {
  await page.goto('/app/pacientes')
  await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
  await page.getByLabel('Nombre *').fill('Prueba')
  await page.getByLabel('Apellido *').fill(apellido)
  await page.getByLabel('Fecha de nacimiento *').fill(opciones.fechaNac ?? '2024-03-15')
  if (opciones.hc) await page.getByLabel('N° H. Clínica').fill(opciones.hc)
  if (opciones.eg) await page.getByLabel('Edad gestacional (semanas)').fill(opciones.eg)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/app\/pacientes\/[0-9a-f-]{36}/, { timeout: 15_000 })
}

test.describe('Alta de pacientes', () => {
  test('exige los campos obligatorios', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
    await page.getByRole('button', { name: 'Guardar' }).click()

    await expect(page.getByText('Requerido').first()).toBeVisible()
    await expect(page.getByText('Requerida')).toBeVisible()
  })

  test('rechaza una fecha de nacimiento futura', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
    await page.getByLabel('Nombre *').fill('Futuro')
    await page.getByLabel('Apellido *').fill('Imposible')
    await page.getByLabel('Fecha de nacimiento *').fill('2099-01-01')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('No puede ser futura')).toBeVisible()
  })

  test('rechaza una edad gestacional absurda', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
    await page.getByLabel('Nombre *').fill('EG')
    await page.getByLabel('Apellido *').fill('Absurda')
    await page.getByLabel('Fecha de nacimiento *').fill('2024-01-01')
    await page.getByLabel('Edad gestacional (semanas)').fill('99')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Entre 20 y 45 semanas')).toBeVisible()
  })

  test('avisa ante un posible duplicado y deja confirmar', async ({ page }) => {
    await entrar(page, 'tomas')
    const apellido = `Dup${Date.now()}`
    await nuevoPaciente(page, apellido)

    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
    await page.getByLabel('Nombre *').fill('Otro')
    await page.getByLabel('Apellido *').fill(apellido)
    await page.getByLabel('Fecha de nacimiento *').fill('2024-03-15')
    await page.getByRole('button', { name: 'Guardar' }).click()

    await expect(page.getByText(/Ya existe un paciente/i)).toBeVisible()
    // insistir crea igual
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page).toHaveURL(/\/app\/pacientes\/[0-9a-f-]{36}/, { timeout: 15_000 })
  })

  test('rechaza repetir el número de historia clínica', async ({ page }) => {
    await entrar(page, 'tomas')
    const hc = `HC-${Date.now()}`
    await nuevoPaciente(page, `Uno${Date.now()}`, { hc })

    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
    await page.getByLabel('Nombre *').fill('Dos')
    await page.getByLabel('Apellido *').fill(`Dos${Date.now()}`)
    await page.getByLabel('Fecha de nacimiento *').fill('2020-01-01')
    await page.getByLabel('N° H. Clínica').fill(hc)
    await page.getByRole('button', { name: 'Guardar' }).click()

    await expect(page.getByRole('alert')).toContainText(/historia clínica/i)
  })

  test('la búsqueda filtra y avisa cuando no hay resultados', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByRole('searchbox').fill('zzz-no-existe-zzz')
    await expect(page.getByText('Sin resultados')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Aplicar la pesquisa', () => {
  test('flujo completo: crear, marcar, guardar, cerrar y quedar inmutable', async ({ page }) => {
    await entrar(page, 'tomas')
    await nuevoPaciente(page, `Flujo${Date.now()}`, { eg: '34' })

    // la corrección por prematurez se anuncia
    await expect(page.getByText(/se aplica edad corregida/i)).toBeVisible()

    await page.getByRole('button', { name: '+ Nueva pesquisa' }).click()
    await expect(page.getByText(/Edad corregida a esa fecha/i)).toBeVisible()
    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(page).toHaveURL(/\/app\/evaluacion\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // la ficha se dibuja completa
    await expect(page.locator('.ficha-barra[data-item]')).toHaveCount(79)
    // y la línea de edad corregida está puesta
    await expect(page.locator('.ficha-edad-linea')).toBeVisible()

    // marcar: un clic = pasa, dos = no pasa
    const primero = page.locator('.ficha-barra[data-item]').first()
    await primero.click()
    await expect(primero).toHaveAttribute('data-marca', 'pasa')
    await primero.click()
    await expect(primero).toHaveAttribute('data-marca', 'no_pasa')
    await primero.click()
    await expect(primero).toHaveAttribute('data-marca', '')

    // marcar dos tipo B como fallados debe disparar el criterio de fracaso
    await primero.click(); await primero.click()          // no_pasa
    const segundo = page.locator('.ficha-barra[data-item]').nth(1)
    await segundo.click(); await segundo.click()          // no_pasa

    await expect(page.getByText(/Criterio de fracaso alcanzado|Sin criterio de fracaso/))
      .toBeVisible()

    // el autoguardado confirma
    await expect(page.getByText('Guardado')).toBeVisible({ timeout: 15_000 })

    // recargar conserva lo marcado
    await page.reload()
    await expect(page.locator('.ficha-barra[data-item]').first())
      .toHaveAttribute('data-marca', 'no_pasa', { timeout: 15_000 })

    // cerrar
    await page.getByRole('button', { name: 'Cerrar y firmar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar y firmar' }).click()
    await expect(page.getByText('Cerrada')).toBeVisible({ timeout: 15_000 })

    // ya no se puede editar
    await expect(page.getByRole('button', { name: 'Cerrar y firmar' })).toHaveCount(0)
    const marcaPrevia = await page.locator('.ficha-barra[data-item]').first()
      .getAttribute('data-marca')
    await page.locator('.ficha-barra[data-item]').first().click()
    await expect(page.locator('.ficha-barra[data-item]').first())
      .toHaveAttribute('data-marca', marcaPrevia!)
  })

  test('no deja abrir dos borradores del mismo paciente', async ({ page }) => {
    await entrar(page, 'tomas')
    await nuevoPaciente(page, `Doble${Date.now()}`)
    const urlPaciente = page.url()

    await page.getByRole('button', { name: '+ Nueva pesquisa' }).click()
    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(page).toHaveURL(/\/app\/evaluacion\//, { timeout: 15_000 })
    const urlEval = page.url()

    // volver e intentar otra: debe llevar al mismo borrador
    await page.goto(urlPaciente)
    await expect(page.getByText(/pesquisa sin cerrar/i)).toBeVisible()
    await page.getByRole('link', { name: 'Continuar' }).first().click()
    expect(page.url()).toBe(urlEval)
  })

  test('descartar un borrador lo saca de la historia', async ({ page }) => {
    await entrar(page, 'tomas')
    await nuevoPaciente(page, `Descarte${Date.now()}`)
    const urlPaciente = page.url()

    await page.getByRole('button', { name: '+ Nueva pesquisa' }).click()
    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(page).toHaveURL(/\/app\/evaluacion\//, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Descartar borrador' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click()

    await expect(page).toHaveURL(urlPaciente, { timeout: 15_000 })
    await expect(page.getByText('Sin pesquisas todavía')).toBeVisible()
  })

  test('avisa si quedan ítems sin marcar dentro del rango de edad', async ({ page }) => {
    await entrar(page, 'tomas')
    // un niño grande: casi todo el catálogo le corresponde
    await nuevoPaciente(page, `Grande${Date.now()}`, { fechaNac: '2021-01-01' })
    await page.getByRole('button', { name: '+ Nueva pesquisa' }).click()
    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(page).toHaveURL(/\/app\/evaluacion\//, { timeout: 15_000 })

    await page.locator('.ficha-barra[data-item]').first().click()
    await expect(page.getByText(/ítems sin marcar/i).first()).toBeVisible()
  })
})
