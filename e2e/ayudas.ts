import { expect, type Page } from '@playwright/test'

export const CUENTAS = {
  super:  { email: 'super@prunape.bo', clave: 'Super1234!', nombre: 'Super Admin' },
  ana:    { email: 'ana@lapaz.bo',     clave: 'Ana12345!',  nombre: 'Ana Pérez' },
  tomas:  { email: 'tomas@lapaz.bo',   clave: 'Tomas1234!', nombre: 'Tomás Quispe' },
  rita:   { email: 'rita@lapaz.bo',    clave: 'Rita1234!',  nombre: 'Rita Flores' },
  berta:  { email: 'berta@scz.bo',     clave: 'Berta1234!', nombre: 'Berta Áñez' },
} as const

export async function entrar(page: Page, quien: keyof typeof CUENTAS) {
  const c = CUENTAS[quien]
  await page.goto('/entrar')
  await page.getByLabel('Correo').fill(c.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(c.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/(app|admin)/, { timeout: 20_000 })
}

export async function salir(page: Page) {
  await page.getByRole('button', { name: /Super Admin|Ana|Tomás|Rita|Berta/ }).first().click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/entrar/)
}

/** Deja la sesión limpia sin depender de la UI. */
export async function limpiarSesion(page: Page) {
  await page.goto('/entrar')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
}
