# PRUNAPE Digital

Aplicación web para aplicar y archivar la **Prueba Nacional de Pesquisa (PRUNAPE)**
en centros de neurodesarrollo. Pensada para varios centros, cada uno con su
equipo, sus pacientes y su identidad visual.

---

## Qué hace

**Para la terapeuta** — pensado para usarse desde el celular
- Registro de pacientes con edad gestacional y corrección por prematurez.
- Dos modos de aplicar la pesquisa. La **ficha** es el modo principal en las
  dos pantallas y ocupa casi toda la del celular: se maneja sólo con los
  dedos —dos para acercar, uno para recorrer en cualquier dirección, un
  toque para marcar una barra—. La **lista** queda como alternativa para
  marcar de corrido, con filtro por área y por edad.
- La ficha del PRUNAPE reproducida fiel al papel: los 79 ítems con sus
  percentilos, la línea de edad corregida marcada sobre el gráfico.
- Marcado por clic (pasa / no pasa / sin marcar), con guardado automático y
  continuidad si se corta internet.
- Cierre firmado de la evaluación, impresión a una hoja A4.
- Línea de tiempo por paciente y comparación de la evolución entre pesquisas.

**Para el backoffice (superadmin)**
- Alta y suspensión de centros.
- Personalización por centro: logo y colores, con vista previa.
- Asignación de usuarios a centros y roles.
- Auditoría navegable con el antes/después de cada cambio.
- Acceso de soporte con motivo, duración y aviso visible.

---

## Cómo está construido

| Capa | Tecnología | Por qué |
|---|---|---|
| Interfaz | React + Vite + TypeScript | estático, sin servidor propio |
| Datos y sesión | Supabase (Postgres + Auth + RLS) | el aislamiento vive en la base |
| Alojamiento | Cloudflare Pages | plan gratuito que permite uso comercial |
| Respaldo | GitHub Actions | volcado cifrado todas las noches |

### Las cuatro reglas que sostienen el diseño

1. **El aislamiento se aplica en la base, no en la pantalla.** Las políticas de
   Row Level Security deciden qué filas existen para cada usuario. Un error en
   una consulta no puede filtrar datos de otro centro.
2. **Nada se borra.** Los pacientes se archivan; las evaluaciones cerradas son
   inmutables; un borrador sin firmar se marca como descartado, no se elimina.
3. **La auditoría la escriben triggers de Postgres**, no la aplicación. No se
   puede saltear ni alterar desde el navegador.
4. **Lo calculado se guarda.** Cada evaluación registra con qué versión del
   catálogo se aplicó y qué edad corregida tenía el niño ese día, así un cambio
   futuro de reglas no altera la historia clínica.

### Quién ve qué

| | Su paciente | Otros del centro | Otros centros |
|---|---|---|---|
| Terapeuta | sí | no | no |
| Admin del centro | sí | sí | no |
| Superadmin | solo con acceso de soporte abierto y auditado | | |

---

## Puesta en marcha

### Requisitos
Node 20+, Docker (solo para desarrollo local).

### Desarrollo

```bash
git clone https://github.com/Fefis0412/Ficha-Prunape-Digital.git
cd Ficha-Prunape-Digital

npm install
cp .env.example .env.local    # ya viene con los valores del Supabase local

npx supabase start            # levanta Postgres, Auth y la API (tarda la 1ª vez)
node scripts/sembrar.mjs      # centros, usuarios y pacientes de prueba
node scripts/sembrar-demo.mjs # historial clínico para ver la evolución
npm run dev                   # http://localhost:5173
```

La primera vez `supabase start` descarga varias imágenes de Docker y puede
tardar bastante. Si falla con *ports are not available*, es que Windows tiene
reservado ese rango: los puertos de `supabase/config.toml` ya están corridos a
la serie 553xx por ese motivo.

Cuentas que crea la siembra:

| Usuario | Contraseña | Rol |
|---|---|---|
| fefis | fefis123 | terapeuta, con un paciente y sin pesquisas |
| super@prunape.bo | Super1234! | superadmin |
| ana@lapaz.bo | Ana12345! | admin del centro |
| tomas@lapaz.bo | Tomas1234! | terapeuta |
| rita@lapaz.bo | Rita1234! | terapeuta (mismo centro) |
| berta@scz.bo | Berta1234! | terapeuta (otro centro) |

Se puede entrar con un **usuario suelto** o con un correo. Supabase identifica
siempre por correo, así que a quien no tiene uno se le arma uno interno
(`usuario@prunape.local`) que nunca ve. Para dar de alta a alguien así:

```bash
node scripts/crear-usuario.mjs fefis fefis123 "Paciente de Prueba"
node scripts/crear-usuario.mjs coordinacion Clave123 --admin
```

### Probarlo desde el celular

El celular tiene que llegar a la PC por la red local, así que hay que apuntar
la aplicación a la IP de la PC en vez de a `127.0.0.1` (que en el celular sería
el propio celular).

```bash
# 1. averiguá la IP de la PC en la red
ipconfig                     # Windows   → "Dirección IPv4"
ip addr | grep 'inet '       # Linux/Mac

# 2. ponela en .env.local
VITE_SUPABASE_URL=http://TU-IP:55321

# 3. levantá el servidor (vite ya escucha en toda la red)
npm run dev
```

Después, desde el celular en **la misma red wifi**, abrí `http://TU-IP:5173`.

Si no carga, casi siempre es el **firewall de Windows**: si la red está
clasificada como *Pública*, bloquea las conexiones entrantes. Se destraba con
una sola orden, en una PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName "PRUNAPE dev" -Direction Inbound `
  -Protocol TCP -LocalPort 5173,55321 -Action Allow -Profile Any
```

### Producción

1. Crear un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. Aplicar el esquema: `npx supabase db push --db-url <URL>`.
3. Crear el primer superadmin desde Authentication → Add user, y marcarlo con
   `update perfiles set es_superadmin = true where email = '…'`.
4. En Cloudflare Pages: conectar el repositorio, build `npm run build`,
   carpeta `dist`, y cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Cargar los secretos del respaldo (ver `.github/workflows/respaldo.yml`).

La **clave de servicio** (`service_role`) nunca va al navegador ni al
repositorio: solo se usa desde `scripts/sembrar.mjs` en tu máquina.

---

## Pruebas

```bash
npm test                    # 37 pruebas de la lógica clínica
bash scripts/probar-db.sh   # 27 afirmaciones de aislamiento contra Postgres
npm run e2e                 # 55 pruebas de navegador

npx playwright test --project=escritorio   # solo escritorio (Chromium)
npx playwright test --project=celular      # solo celular (WebKit, perfil iPhone)
npx playwright test --headed               # verlas correr a la vista
npx playwright test --ui                   # panel interactivo, paso a paso
```

Las de celular corren sobre **WebKit**, que es el motor de Safari en iOS, y
verifican lo que suele romperse ahí: que nada desborde el ancho, que la
navegación quede anclada abajo, que los campos midan 16px (por debajo de eso
iOS hace zoom al enfocar y no vuelve), que los botones lleguen al mínimo
táctil de 44px y que el resumen fijo no tape la lista.

Las de navegador necesitan la aplicación levantada y los datos sembrados.

Las tres capas cubren cosas distintas:

- **Unitarias** — cálculo de edad corregida, criterio de fracaso, coherencia del
  catálogo (79 ítems, reparto 18/19/19/23 por área, percentilos crecientes).
- **Base de datos** — que un terapeuta no vea pacientes de su compañera, que
  otro centro esté aislado, que una evaluación cerrada no se pueda editar, que
  la auditoría no se pueda alterar.
- **Navegador** — los flujos completos, incluidos los casos malos: credenciales
  incorrectas, fechas futuras, duplicados, historia clínica repetida, intentos
  de abrir por URL el paciente de otro; más la estructura en celular.

---

## Estructura

```
src/
  components/FichaPrunape.tsx   la ficha; reproduce el formulario impreso
  components/VisorFicha.tsx     zoom y desplazamiento de la ficha en celular
  components/ListaItems.tsx     los mismos ítems como lista, alternativa
  data/catalogo-v1.json         los 79 ítems: geometría, área, tipo, percentilos
  lib/edad.ts                   edad postnatal y corregida
  lib/resultado.ts              criterio de fracaso
  paginas/                      pantallas del centro
  paginas/admin/                backoffice
supabase/
  migrations/                   esquema, RLS y triggers
  pruebas/                      pruebas de aislamiento en SQL
legacy/                         la ficha original en un solo HTML
origen/                         el formulario escaneado del que se extrajo todo
```

### Sobre el catálogo

La ficha original era un PDF escaneado sin capa de texto. La geometría de los
79 ítems se extrajo analizando la imagen píxel a píxel: marco del gráfico, las
13 marcas del eje de edad y, para cada ítem, su rectángulo y su tramo de
percentilos. De ahí salen los percentilos en meses que usa la aplicación.

El área de cada ítem (personal-social, motor fino, lenguaje, motor grueso) **no
se puede deducir de la posición**, porque las cuatro comparten filas en el
gráfico. Se asignaron según la clasificación estándar del PRUNAPE y el reparto
resultante (18/19/19/23) coincide con el del instrumento.

---

## Aviso

El criterio de fracaso que muestra la aplicación (≥1 ítem tipo A o ≥2 tipo B)
es una ayuda de cálculo. **La interpretación del resultado es del profesional y
debe contrastarse con el manual del PRUNAPE.** Esta herramienta no reemplaza el
criterio clínico.

El formulario PRUNAPE es un instrumento de la Sociedad Argentina de Pediatría.
