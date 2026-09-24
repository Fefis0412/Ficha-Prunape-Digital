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
  test('arranca en la ficha y se maneja con los dedos', async ({ page }) => {
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

    // la ficha es la vista por defecto, dentro del visor
    await expect(page.locator('.visor')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.ficha-barra[data-item]')).toHaveCount(79)

    // el zoom es con los dedos: no hay botones de + y −
    await expect(page.locator('.visor-zoom')).toHaveCount(0)

    // la ficha se queda con la mayor parte de la pantalla
    const alto = page.viewportSize()!.height
    const visor = (await page.locator('.visor').boundingBox())!
    expect(visor.height / alto).toBeGreaterThan(0.65)

    // en reposo no queda una capa de GPU fija: es lo que recortaba la hoja
    // en iOS y la dejaba borrosa al escalar
    expect(await page.locator('.visor-lienzo')
      .evaluate((e) => getComputedStyle(e).willChange)).toBe('auto')
  })

  test('pellizcar con dos dedos acerca y aleja', async ({ page }) => {
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
    await expect(page.locator('.visor')).toBeVisible({ timeout: 10_000 })

    const escalaActual = () => page.locator('.visor-lienzo').evaluate((e) => {
      const m = new DOMMatrix(getComputedStyle(e).transform)
      return m.a
    })

    /** Simula un pellizco: dos punteros que se separan o se juntan. */
    const pellizcar = (desde: number, hasta: number) =>
      page.locator('.visor-marco').evaluate((el, [d, h]) => {
        const c = el.getBoundingClientRect()
        const cx = c.left + c.width / 2
        const cy = c.top + c.height / 2
        const ev = (t: string, id: number, x: number, y: number) =>
          el.dispatchEvent(new PointerEvent(t, {
            pointerId: id, clientX: x, clientY: y,
            bubbles: true, cancelable: true, pointerType: 'touch',
          }))
        ev('pointerdown', 1, cx - d / 2, cy)
        ev('pointerdown', 2, cx + d / 2, cy)
        const pasos = 8
        for (let i = 1; i <= pasos; i++) {
          const s = d + ((h - d) * i) / pasos
          ev('pointermove', 1, cx - s / 2, cy)
          ev('pointermove', 2, cx + s / 2, cy)
        }
        ev('pointerup', 1, cx - h / 2, cy)
        ev('pointerup', 2, cx + h / 2, cy)
      }, [desde, hasta])

    const inicial = await escalaActual()

    await pellizcar(80, 240)   // separar los dedos → acercar
    await expect.poll(escalaActual).toBeGreaterThan(inicial * 1.4)

    const acercado = await escalaActual()
    await pellizcar(240, 80)   // juntar los dedos → alejar
    await expect.poll(escalaActual).toBeLessThan(acercado * 0.8)
  })

  test('arrastrar con un dedo recorre la ficha en los dos ejes', async ({ page }) => {
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
    await expect(page.locator('.visor')).toBeVisible({ timeout: 10_000 })

    const posicion = () => page.locator('.visor-lienzo').evaluate((e) => {
      const m = new DOMMatrix(getComputedStyle(e).transform)
      return { x: Math.round(m.e), y: Math.round(m.f) }
    })

    const antes = await posicion()
    const marco = (await page.locator('.visor-marco').boundingBox())!
    await page.mouse.move(marco.x + marco.width / 2, marco.y + marco.height / 2)
    await page.mouse.down()
    await page.mouse.move(marco.x + marco.width / 2 - 90, marco.y + marco.height / 2 - 70, { steps: 12 })
    await page.mouse.up()

    const despues = await posicion()
    expect(despues.x, 'no se movió en horizontal').not.toBe(antes.x)
    expect(despues.y, 'no se movió en vertical').not.toBe(antes.y)
  })

  test('tocar marca el ítem y arrastrar solo mueve la ficha', async ({ page }) => {
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
    await expect(page.locator('.visor')).toBeVisible({ timeout: 10_000 })

    // una barra que caiga entera dentro del visor
    const marco = (await page.locator('.visor-marco').boundingBox())!
    const barras = page.locator('.ficha-barra[data-item]')
    let idx = -1
    for (let i = 0; i < (await barras.count()); i++) {
      const b = await barras.nth(i).boundingBox()
      if (b && b.x > marco.x + 15 && b.x + b.width < marco.x + marco.width - 15 &&
          b.y > marco.y + 15 && b.y + b.height < marco.y + marco.height - 70) { idx = i; break }
    }
    expect(idx, 'ninguna barra visible dentro del visor').toBeGreaterThanOrEqual(0)
    const barra = barras.nth(idx)

    // El borrador puede venir con marcas de antes: se lleva a un punto
    // conocido antes de comprobar el ciclo.
    for (let i = 0; i < 3 && (await barra.getAttribute('data-marca')) !== ''; i++) {
      await barra.click()
      await page.waitForTimeout(200)
    }
    await expect(barra).toHaveAttribute('data-marca', '')

    // tocar cicla la marca y confirma cuál se marcó
    await barra.click()
    await expect(barra).toHaveAttribute('data-marca', 'pasa')
    await expect(page.locator('.eval-aviso-marca')).toBeVisible()
    await barra.click()
    await expect(barra).toHaveAttribute('data-marca', 'no_pasa')

    // arrastrar mueve la hoja pero NO cambia la marca
    const b = (await barra.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 - 130, b.y + b.height / 2 - 50, { steps: 14 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    await expect(barra).toHaveAttribute('data-marca', 'no_pasa')
  })

  test('se puede pasar a la lista y marcar ahí', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Lista' }).click()
    await expect(page.locator('.lista')).toBeVisible()

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

  test('se puede volver al gráfico desde la lista', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Lista' }).click()
    await expect(page.locator('.lista')).toBeVisible()

    await page.getByRole('button', { name: 'Ficha' }).click()
    await expect(page.locator('.visor')).toBeVisible()
    // el gráfico se recorre dentro del visor, sin empujar la página
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth))
  })
})
