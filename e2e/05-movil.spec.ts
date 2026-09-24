import { expect, test } from '@playwright/test'
import { entrar, limpiarSesion } from './ayudas'

/* El proyecto "celular" de playwright.config.ts corre este archivo con el
   perfil de un iPhone sobre WebKit, que es el motor de Safari en iOS. La
   emulación no reproduce el tacto real, pero sí el ancho, las media queries
   y el motor, que es donde aparecen las diferencias. */

test.beforeEach(async ({ page }) => { await limpiarSesion(page) })

test.describe('Celular · estructura', () => {
  test('nada desborda el ancho de la pantalla', async ({ page }) => {
    await entrar(page, 'tomas')
    for (const ruta of ['/app', '/app/pacientes']) {
      await page.goto(ruta)
      await page.waitForTimeout(600)
      const desborde = await page.evaluate(() => {
        const w = document.documentElement.clientWidth
        return [...document.querySelectorAll('*')]
          .filter((e) => e.getBoundingClientRect().right > w + 1)
          .map((e) => e.tagName + '.' + String(e.className).slice(0, 30))
      })
      expect(desborde, `desbordes en ${ruta}`).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth))
    }
  })

  test('la navegación queda anclada abajo, al alcance del pulgar', async ({ page }) => {
    await entrar(page, 'tomas')
    const nav = page.locator('.lateral')
    const caja = await nav.boundingBox()
    const alto = page.viewportSize()!.height
    expect(caja).not.toBeNull()
    // pegada al borde inferior y baja, no estirada a toda la pantalla
    expect(caja!.y + caja!.height).toBeGreaterThan(alto - 5)
    expect(caja!.height).toBeLessThan(90)
  })

  test('los campos miden 16px o más para que iOS no haga zoom', async ({ page }) => {
    await page.goto('/entrar')
    const tam = await page.getByLabel('Correo').evaluate(
      (e) => parseFloat(getComputedStyle(e).fontSize),
    )
    expect(tam).toBeGreaterThanOrEqual(16)
  })

  test('los botones llegan al mínimo táctil de 44px', async ({ page }) => {
    await page.goto('/entrar')
    const caja = await page.getByRole('button', { name: 'Ingresar' }).boundingBox()
    expect(caja!.height).toBeGreaterThanOrEqual(44)
  })

  test('el formulario de alta sube desde abajo como hoja', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()

    const caja = await page.getByRole('dialog').boundingBox()
    const v = page.viewportSize()!
    expect(caja!.width).toBeGreaterThan(v.width - 4)      // a todo el ancho
    expect(caja!.y + caja!.height).toBeGreaterThan(v.height - 4) // anclada abajo
  })
})

test.describe('Celular · aplicar la pesquisa en modo lista', () => {
  test('arranca en lista, marca, filtra y muestra el resumen fijo', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByRole('button', { name: '+ Nuevo paciente' }).click()
    await page.getByLabel('Nombre *').fill('Movil')
    await page.getByLabel('Apellido *').fill(`Test${Date.now()}`)
    await page.getByLabel('Fecha de nacimiento *').fill('2023-01-10')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page).toHaveURL(/\/app\/pacientes\/[0-9a-f-]{36}/, { timeout: 15_000 })

    await page.getByRole('button', { name: '+ Nueva pesquisa' }).click()
    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(page).toHaveURL(/\/app\/evaluacion\//, { timeout: 15_000 })

    // en pantalla angosta la vista por defecto es la lista, no el gráfico
    await expect(page.locator('.lista')).toBeVisible()
    await expect(page.locator('.ficha-hoja')).toHaveCount(0)

    const filas = page.locator('.lista-fila')
    await expect(filas.first()).toBeVisible({ timeout: 10_000 })
    const conFiltro = await filas.count()
    expect(conFiltro).toBeGreaterThan(0)

    // marcar: un toque pone la marca, el mismo toque la saca
    const primera = filas.first()
    await primera.locator('.lista-btn.pasa').click()
    await expect(primera).toHaveAttribute('data-marca', 'pasa')
    await primera.locator('.lista-btn.no-pasa').click()
    await expect(primera).toHaveAttribute('data-marca', 'no_pasa')
    await primera.locator('.lista-btn.no-pasa').click()
    await expect(primera).toHaveAttribute('data-marca', '')

    // "solo esperables" reduce la lista
    await page.getByRole('checkbox').uncheck()
    await expect.poll(() => filas.count()).toBeGreaterThan(conFiltro)
    await page.getByRole('checkbox').check()

    // filtrar por área
    await page.getByRole('button', { name: 'Lenguaje' }).click()
    await expect(page.getByRole('heading', { name: 'Lenguaje' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Motor grueso' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Todas' }).click()

    // el resumen queda fijo abajo y visible sin salir de la lista
    const panel = page.locator('.eval-panel')
    const caja = await panel.boundingBox()
    const v = page.viewportSize()!
    expect(caja!.y + caja!.height).toBeGreaterThan(v.height - 5)
    expect(caja!.height).toBeLessThan(v.height * 0.45) // no puede tapar la lista
    await expect(page.getByRole('button', { name: 'Cerrar y firmar' })).toBeVisible()
  })

  test('se puede pasar al gráfico y volver', async ({ page }) => {
    await entrar(page, 'tomas')
    await page.goto('/app/pacientes')
    await page.getByText('Rojas, Mateo').first().click()

    const nueva = page.getByRole('button', { name: '+ Nueva pesquisa' })
    if (await nueva.count()) {
      await nueva.click()
      await page.getByRole('button', { name: 'Empezar' }).click()
    } else {
      await page.getByRole('link', { name: 'Continuar' }).first().click()
    }
    await expect(page).toHaveURL(/\/app\/evaluacion\//, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Ficha' }).click()
    await expect(page.locator('.ficha-hoja')).toBeVisible()
    // el gráfico se recorre dentro de su caja, sin empujar la página
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth))

    await page.getByRole('button', { name: 'Lista' }).click()
    await expect(page.locator('.lista')).toBeVisible()
  })
})
