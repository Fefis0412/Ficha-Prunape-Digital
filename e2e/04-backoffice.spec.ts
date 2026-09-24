import { expect, test } from '@playwright/test'
import { entrar, limpiarSesion } from './ayudas'

test.beforeEach(async ({ page }) => { await limpiarSesion(page) })

test.describe('Backoffice · centros', () => {
  test('lista los centros con sus colores', async ({ page }) => {
    await entrar(page, 'super')
    await page.getByRole('link', { name: 'Centros', exact: true }).click()
    await expect(page.getByText('Centro de Neurodesarrollo La Paz', { exact: true })).toBeVisible()
    await expect(page.getByText('Clínica Santa Cruz', { exact: true })).toBeVisible()
  })

  test('crea un centro y genera el identificador solo', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('button', { name: '+ Nuevo centro' }).click()

    const nombre = `Centro Prueba ${Date.now()}`
    await page.getByLabel('Nombre del centro').fill(nombre)
    await expect(page.getByLabel('Identificador')).toHaveValue(/centro-prueba-\d+/)
    await page.getByRole('button', { name: 'Crear' }).click()

    await expect(page).toHaveURL(/\/admin\/centros\/[0-9a-f-]{36}/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: nombre })).toBeVisible()
  })

  test('no deja crear un centro sin nombre', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('button', { name: '+ Nuevo centro' }).click()
    await page.getByRole('button', { name: 'Crear' }).click()
    await expect(page.getByRole('alert')).toContainText(/nombre/i)
  })

  test('rechaza un identificador repetido', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('button', { name: '+ Nuevo centro' }).click()
    await page.getByLabel('Nombre del centro').fill('Duplicado')
    await page.getByLabel('Identificador').fill('neuro-lapaz')
    await page.getByRole('button', { name: 'Crear' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('suspender y reactivar un centro', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('cell', { name: 'Clínica Santa Cruz' }).click()
    await expect(page).toHaveURL(/\/admin\/centros\/[0-9a-f-]{36}/)

    await page.getByRole('button', { name: 'Suspender' }).click()
    await expect(page.getByText(/Centro suspendido/i)).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Reactivar' }).click()
    await expect(page.getByText(/Centro suspendido/i)).toHaveCount(0, { timeout: 15_000 })
  })
})

test.describe('Backoffice · personalización por centro', () => {
  test('cambia los colores y los aplica a la interfaz', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('cell', { name: 'Centro de Neurodesarrollo La Paz' }).click()

    await page.getByLabel('Color primario').last().fill('#8a2f6b')
    await page.getByRole('button', { name: 'Guardar personalización' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 15_000 })

    // la terapeuta de ese centro ve el color nuevo
    await limpiarSesion(page)
    await entrar(page, 'tomas')
    // el branding se aplica cuando termina de cargar el centro: esperarlo
    await expect.poll(async () => (await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primario').trim()
    )).toLowerCase(), { timeout: 15_000 }).toBe('#8a2f6b')

    // la del otro centro NO
    await limpiarSesion(page)
    await entrar(page, 'berta')
    await page.goto('/app/pacientes')
    await expect(page.getByText('Choque, Luis')).toBeVisible({ timeout: 15_000 })
    const otro = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primario').trim())
    expect(otro.toLowerCase()).not.toBe('#8a2f6b')

    // dejar como estaba
    await limpiarSesion(page)
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('cell', { name: 'Centro de Neurodesarrollo La Paz' }).click()
    await page.getByLabel('Color primario').last().fill('#2f6f4e')
    await page.getByRole('button', { name: 'Guardar personalización' }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 15_000 })
  })

  test('rechaza un color mal escrito', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('cell', { name: 'Clínica Santa Cruz' }).click()
    await page.getByLabel('Color primario').last().fill('no-es-un-color')
    await expect(page.getByText(/formato #rrggbb/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar personalización' })).toBeDisabled()
  })
})

test.describe('Backoffice · acceso de soporte', () => {
  test('exige un motivo y muestra la franja mientras dura', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/centros')
    await page.getByRole('cell', { name: 'Clínica Santa Cruz' }).click()
    await page.getByRole('button', { name: 'Acceso de soporte' }).click()

    // motivo demasiado corto
    await page.getByLabel('Motivo *').fill('corto')
    await page.getByRole('button', { name: 'Abrir acceso' }).click()
    await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible()

    await page.getByLabel('Motivo *').fill('Prueba automatizada del acceso de soporte')
    await page.getByRole('button', { name: 'Abrir acceso' }).click()

    await expect(page.getByText('ACCESO DE SOPORTE ACTIVO')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/· Clínica Santa Cruz ·/)).toBeVisible()

    // cerrarlo hace desaparecer la franja
    await page.getByRole('button', { name: 'Cerrar acceso' }).click()
    await expect(page.getByText('ACCESO DE SOPORTE ACTIVO')).toHaveCount(0)
  })
})

test.describe('Backoffice · usuarios y auditoría', () => {
  test('lista usuarios de todos los centros', async ({ page }) => {
    await entrar(page, 'super')
    await page.getByRole('link', { name: 'Usuarios', exact: true }).click()
    await expect(page.getByText('tomas@lapaz.bo')).toBeVisible()
    await expect(page.getByText('berta@scz.bo')).toBeVisible()
    await expect(page.getByText('Superadmin').first()).toBeVisible()
  })

  test('la auditoría registra los movimientos y muestra el antes/después', async ({ page }) => {
    await entrar(page, 'super')
    await page.getByRole('link', { name: 'Auditoría', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible()

    const filas = page.locator('tbody tr')
    await expect(filas.first()).toBeVisible({ timeout: 15_000 })

    await filas.first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText(/registro/i)
  })

  test('filtrar la auditoría por tipo de registro', async ({ page }) => {
    await entrar(page, 'super')
    await page.goto('/admin/auditoria')
    await page.getByLabel('Filtrar por tipo').selectOption('centros')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
    const textos = await page.locator('tbody tr td:nth-child(3)').allTextContents()
    expect(textos.every((t) => t.trim() === 'centros')).toBe(true)
  })

  test('el panel muestra las cifras globales', async ({ page }) => {
    await entrar(page, 'super')
    await expect(page.getByText('Centros', { exact: true }).last()).toBeVisible()
    await expect(page.getByText('Evaluaciones', { exact: true })).toBeVisible()
    await expect(page.getByText(/plan gratuito/i)).toBeVisible()
  })
})
