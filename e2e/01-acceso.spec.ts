import { expect, test } from '@playwright/test'
import { CUENTAS, entrar, limpiarSesion, salir } from './ayudas'

test.beforeEach(async ({ page }) => { await limpiarSesion(page) })

test.describe('Acceso', () => {
  test('se entra con un usuario suelto, sin correo', async ({ page }) => {
    await entrar(page, 'fefis')
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByRole('heading', { name: /Hola, Fefis/ })).toBeVisible()
  })

  test('el usuario que ve la terapeuta no es un correo interno', async ({ page }) => {
    await entrar(page, 'fefis')
    await page.getByRole('button', { name: 'Fefis' }).first().click()
    await expect(page.getByText('fefis', { exact: true })).toBeVisible()
    await expect(page.getByText(/prunape\.local/)).toHaveCount(0)
  })

  test('rechaza credenciales incorrectas sin dejar entrar', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Usuario').fill('ana@lapaz.bo')
    await page.getByLabel('Contraseña', { exact: true }).fill('clave-equivocada')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByRole('alert')).toContainText(/incorrecto/i)
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('exige completar los campos', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('alert')).toContainText(/Completá/i)
  })

  test('rechaza una cuenta que no existe', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Usuario').fill('nadie@ninguna-parte.bo')
    await page.getByLabel('Contraseña', { exact: true }).fill('Loquesea123!')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('una terapeuta entra y ve su nombre', async ({ page }) => {
    await entrar(page, 'tomas')
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText(CUENTAS.tomas.nombre)).toBeVisible()
  })

  test('el superadmin va al backoffice, no a la app del centro', async ({ page }) => {
    await entrar(page, 'super')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByRole('heading', { name: 'Panel general' })).toBeVisible()
  })

  test('una ruta protegida sin sesión manda al login', async ({ page }) => {
    await page.goto('/app/pacientes')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('una terapeuta no puede entrar al backoffice', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/app/)
  })

  test('el superadmin no cae en la app del centro', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/app')
    await expect(page).toHaveURL(/\/admin/)
  })

  test('cerrar sesión vuelve al login y corta el acceso', async ({ page }) => {
    await entrar(page, 'ana')
    await salir(page)
    await page.goto('/app/pacientes')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('una URL inexistente muestra el cartel de no encontrado', async ({ page }) => {
    await page.goto('/una/ruta/que-no-existe')
    await expect(page.getByText(/Esa página no existe/i)).toBeVisible()
  })

  test('la sesión sobrevive a recargar la página', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.reload()
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText(CUENTAS.tomas.nombre)).toBeVisible()
  })
})
