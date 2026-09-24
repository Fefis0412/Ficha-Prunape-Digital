import { expect, test } from '@playwright/test'
import { entrar, limpiarSesion } from './ayudas'

test.beforeEach(async ({ page }) => { await limpiarSesion(page) })

test.describe('Aislamiento entre terapeutas y centros', () => {
  test('cada terapeuta ve solo su propio paciente', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(page.getByText('Rojas, Mateo')).toBeVisible()
    await expect(page.getByText('Mamani, Sofía')).toHaveCount(0)
    await expect(page.getByText('Choque, Luis')).toHaveCount(0)
  })

  test('la compañera del mismo centro ve el suyo, no el de Tomás', async ({ page }) => {
    await entrar(page, 'rita')
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(page.getByText('Mamani, Sofía')).toBeVisible()
    await expect(page.getByText('Rojas, Mateo')).toHaveCount(0)
  })

  test('el admin del centro ve a los dos pacientes de su centro', async ({ page }) => {
    await entrar(page, 'ana')
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(page.getByText('Rojas, Mateo')).toBeVisible()
    await expect(page.getByText('Mamani, Sofía')).toBeVisible()
    await expect(page.getByText('Choque, Luis')).toHaveCount(0)
  })

  test('otro centro está completamente aislado', async ({ page }) => {
    await entrar(page, 'berta')
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(page.getByText('Choque, Luis')).toBeVisible()
    await expect(page.getByText('Rojas, Mateo')).toHaveCount(0)
    await expect(page.getByText('Mamani, Sofía')).toHaveCount(0)
  })

  test('pedir por URL el paciente de otro NO lo muestra', async ({ page }) => {
    // Rita saca el id de su paciente
    await entrar(page, 'rita')
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await page.getByText('Mamani, Sofía').click()
    await expect(page).toHaveURL(/\/app\/pacientes\/[0-9a-f-]{36}/)
    const urlDeRita = page.url()

    // Tomás intenta abrir esa misma URL
    await limpiarSesion(page)
    await entrar(page, 'tomas')
    await page.goto(urlDeRita)

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Mamani')).toHaveCount(0)
  })

  test('el otro centro tampoco puede por URL', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await page.getByText('Rojas, Mateo').click()
    await expect(page).toHaveURL(/\/app\/pacientes\/[0-9a-f-]{36}/)
    const urlLaPaz = page.url()

    await limpiarSesion(page)
    await entrar(page, 'berta')
    await page.goto(urlLaPaz)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Rojas')).toHaveCount(0)
  })

  test('una terapeuta no ve la sección Equipo; la admin sí', async ({ page }) => {
    await entrar(page, 'tomas')
    await expect(page.getByRole('link', { name: 'Equipo', exact: true })).toHaveCount(0)

    await limpiarSesion(page)
    await entrar(page, 'ana')
    await expect(page.getByRole('link', { name: 'Equipo', exact: true })).toBeVisible()
  })

  test('si una terapeuta fuerza /app/equipo, no obtiene datos', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/equipo')
    await expect(page.getByText(/Solo los administradores/i)).toBeVisible()
  })

  test('el superadmin no ve pacientes sin acceso de soporte', async ({ page }) => {
    await entrar(page, 'super')
    await page.getByRole('link', { name: 'Panel' }).click()
    // el conteo global existe, pero las filas clínicas no se pueden leer
    await expect(page.getByRole('heading', { name: 'Panel general' })).toBeVisible()
    const cuerpo = await page.textContent('body')
    expect(cuerpo).not.toContain('Rojas')
    expect(cuerpo).not.toContain('Mamani')
    expect(cuerpo).not.toContain('Choque')
  })
})
