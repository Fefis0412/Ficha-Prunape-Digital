# Ficha PRUNAPE Digital

Versión digital e interactiva del **Formulario de Aplicación** de la Prueba Nacional de Pesquisa (PRUNAPE), maquetada a partir de la ficha original en papel.

Es una única página HTML sin dependencias: se abre con doble clic, funciona sin internet y no envía datos a ningún servidor.

## Uso

Abrí `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox).

## Qué hace

- **Datos del paciente**: examinador, nombre, N° de historia clínica, edad gestacional, fecha de nacimiento y fecha de la pesquisa.
- **Edad postnatal y edad corregida calculadas automáticamente**. La corrección por prematurez se aplica sola cuando la edad gestacional es menor a 37 semanas.
- **Línea de edad**: una guía roja vertical se dibuja sobre el gráfico en la edad corregida del niño, para ver de un vistazo qué ítems corresponde evaluar.
- **Marcado de ítems**: clic sobre cualquier ítem para ciclar entre
  `Pasa` (✓ verde) → `No pasa` (✗ rojo) → sin marcar.
- **Contadores**: ítems fallados tipo A (los marcados con ✱ en la ficha) y tipo B, más el total de ítems pasados.
- **Guardado automático** en el navegador (`localStorage`), así no se pierde nada al cerrar la pestaña.
- **Impresión / PDF**: el botón escala la ficha a una única hoja A4 vertical.

## Cómo se construyó

La ficha original era un PDF escaneado, sin capa de texto. La geometría se extrajo analizando la imagen píxel a píxel:

- Marco del gráfico: `x 406–3423`, `y 940–4618` (en px de la imagen original de 3454×4925).
- Eje de edad: 13 marcas mayores (0, 2, 4, 6, 9, 12, 15, 18, 24 meses y 3, 4, 5, 6 años) con separación regular de 251 px entre ellas.
- 79 ítems, cada uno con su rectángulo, el tramo verde (percentilo 75 → 90) y la posición de su etiqueta.

La página reproduce ese mismo sistema de coordenadas y lo escala de forma responsiva, así que las proporciones son idénticas a la ficha impresa.

## Estructura

```
index.html      la ficha completa (HTML + CSS + JS, todo junto)
origen/         material de referencia: la ficha original escaneada
```

## Nota

El criterio de fracaso que muestra la barra superior (≥1 ítem tipo A o ≥2 tipo B) es una ayuda visual. **La interpretación del resultado debe hacerse siempre contra el manual del PRUNAPE**; esta herramienta no reemplaza el criterio profesional.

El formulario PRUNAPE es un instrumento de la Sociedad Argentina de Pediatría. Este repositorio es una digitalización de uso interno.
