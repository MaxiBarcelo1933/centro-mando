# Proyecto: "Centro de Mando" — PWA de organización de tareas para iPhone

Hola Claude. Vamos a construir juntos mi primera app con Claude Code. Leé TODO este documento antes de escribir código. Es la especificación completa: contexto, stack, diseño, modelo de datos, pantallas, lógica, fases de trabajo y criterios de aceptación.

---

## 0. Cómo quiero que trabajes conmigo

- **Soy principiante en desarrollo.** Sé Excel avanzado, Power BI y nociones de informática, pero es mi primer proyecto de código real. Explicame en español simple qué hacés y por qué, sin tecnicismos innecesarios. Cuando uses un concepto nuevo (service worker, manifest, IndexedDB, etc.), explicalo en 1–2 líneas la primera vez.
- **Trabajá por fases (sección 11).** Al terminar cada fase: frená, mostrame qué hiciste, decime cómo probarlo y esperá mi OK antes de seguir. No hagas todo de una.
- **Antes de instalar cualquier dependencia o crear cuentas/servicios, preguntame.**
- **Primero escribí un `CLAUDE.md`** en la raíz con un resumen de esta especificación, las decisiones técnicas y las convenciones, para que en futuras sesiones tengas el contexto.
- **Usá git desde el inicio:** un commit por cada paso lógico, con mensajes claros en español.
- Si algo de esta especificación es ambiguo o técnicamente inconveniente en iOS, decímelo y proponé alternativas antes de implementar.
- Código: nombres de variables y funciones en inglés; comentarios en español; textos de la interfaz en español rioplatense (voseo: "tocá", "agregá", "cargá").

---

## 1. Contexto: quién soy y qué problema resuelve

Soy Maximiliano, analista comercial en Baterías Moura (Uruguay), área de trade marketing. Gestiono puntos de venta (gomerías, talleres, estaciones) por teléfono, mantengo varios Excel de seguimiento comercial y coordino cartelería y material POP. En el trabajo me marcaron que soy desordenado con mis tareas.

Mi desorden viene de tres cosas concretas:

1. **Procesos mensuales complejos que rehago de memoria** (cierre del Reporte de Ventas, Meta Premiada, Avance de Relevamiento). Tienen muchos pasos y "trampas" que se repiten cada mes.
2. **Seguimientos largos que quedan abiertos** (cotizaciones, permisos de cartelería, consultas al sistema, PDV a llamar) y se me pasan las fechas.
3. **Tareas que llegan por muchos canales** (Teams, mail, vendedores, mi jefe) y se pierden si no las anoto al instante.

La app tiene que resolver exactamente esas tres cosas, con tres secciones: **Hoy**, **Procesos** y **Seguimientos**, más una captura rápida accesible desde cualquier lado.

---

## 2. Plataforma y stack

- **Tipo:** PWA (Progressive Web App) que se instala en el iPhone desde Safari con "Compartir → Agregar a inicio" y se abre a pantalla completa como una app nativa.
- **Dispositivo principal:** iPhone 16 Pro Max (viewport 440×956 pt, Dynamic Island, iOS 18+). Tiene que verse perfecta ahí, y usable también en una PC (escritorio) como bonus.
- **Stack:** HTML + CSS + JavaScript moderno (ES modules), **sin frameworks y sin paso de build**. Motivo: quiero poder abrir los archivos y entender todo, y publicarlo sin complicaciones. Si creés que un framework mínimo es claramente mejor, justificalo antes y esperá mi OK.
- **Persistencia:** IndexedDB (con un wrapper chico propio en `db.js`), todo local en el dispositivo. Sin backend, sin login, sin servidores.
- **Offline:** service worker que cachee todos los assets ("cache first" para estáticos, con versionado de caché para poder actualizar).
- **Hosting:** GitHub Pages (HTTPS gratis; los service workers en iPhone necesitan HTTPS). Guiame paso a paso para crear el repo y publicarlo.
- **Sin dependencias externas en runtime** (nada de CDNs): la app tiene que funcionar 100% offline.

### Estructura de carpetas sugerida
```
/index.html
/manifest.webmanifest
/sw.js
/css/tokens.css        ← variables de diseño
/css/app.css
/js/app.js             ← arranque y router por pestañas
/js/db.js              ← wrapper de IndexedDB
/js/store.js           ← estado + funciones de negocio
/js/dates.js           ← utilidades de fechas (es-UY)
/js/views/hoy.js
/js/views/procesos.js
/js/views/seguimientos.js
/js/views/ajustes.js
/js/components/sheet.js     ← bottom sheet reutilizable
/js/components/toast.js
/js/seed.js            ← plantillas de procesos iniciales
/icons/                ← íconos PNG generados
/CLAUDE.md
/README.md
```

---

## 3. Requisitos específicos de iOS (muy importantes)

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `<meta name="apple-mobile-web-app-capable" content="yes">` y `<meta name="mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="Mando">`
- `<meta name="theme-color" content="#0E1116">`
- `<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">`
- `manifest.webmanifest` con: `name: "Centro de Mando"`, `short_name: "Mando"`, `display: "standalone"`, `background_color` y `theme_color: "#0E1116"`, `start_url` y `scope` relativos (para que funcione en la subruta de GitHub Pages), `lang: "es-UY"`, íconos 192, 512 y 512 maskable.
- **Safe areas:** usar `env(safe-area-inset-top/bottom/left/right)` para que nada quede debajo de la Dynamic Island ni del indicador de inicio. La barra de pestañas inferior debe sumar `safe-area-inset-bottom` al padding.
- Evitar el zoom automático de iOS en inputs: **todos los inputs con `font-size` ≥ 16px**.
- Evitar rebote/scroll del body: el scroll ocurre solo dentro del contenedor de contenido (`overscroll-behavior: contain`).
- Desactivar el resaltado gris al tocar (`-webkit-tap-highlight-color: transparent`) y dar feedback propio (`:active` con leve escala/opacidad).
- Detectar si la app corre instalada (`navigator.standalone` / `display-mode: standalone`). Si está abierta en Safari sin instalar, mostrar arriba un banner discreto: "Instalala en tu iPhone: Compartir → Agregar a inicio", con botón para descartarlo (recordar la elección).
- **Badge del ícono:** si el navegador soporta `navigator.setAppBadge`, mostrar en el ícono la cantidad de tareas pendientes de hoy. Si no lo soporta, ignorar sin errores. (Pedir permiso de notificaciones solo si yo lo activo desde Ajustes.)
- Recordá: iOS puede borrar el almacenamiento de sitios web que no se usan, por eso hay **backup exportable** (sección 8.4).

---

## 4. Diseño visual (sistema de diseño)

Ya validé un mockup con este estilo. Respetalo con precisión.

### 4.1 Estilo general
Tema oscuro, sobrio y profesional, con un único color de acento ámbar (energía/batería). Sensación de app nativa de iOS: tarjetas redondeadas, mucho aire, tipografía del sistema.

### 4.2 Tokens (ponerlos en `css/tokens.css` como variables CSS)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0E1116` | Fondo general |
| `--surface` | `#171B22` | Tarjetas |
| `--surface-2` | `#1A1F27` | Bottom sheets |
| `--tabbar` | `#12161C` | Barra de pestañas |
| `--line` | `#222833` | Separadores |
| `--line-strong` | `#343B48` | Bordes de inputs y chips |
| `--text` | `#F2F4F7` | Texto principal |
| `--text-muted` | `#9AA3AF` | Texto secundario |
| `--text-done` | `#7D8696` | Tareas completadas (tachadas) |
| `--accent` | `#F5A524` | Acento ámbar (botón +, activos, progreso) |
| `--accent-soft` | `#3A2C10` | Fondo de chip activo |
| `--accent-text` | `#FFD27A` | Texto de chip activo |
| `--danger` | `#FF7A6E` | Vencidos |
| `--danger-bg` | `#221517` | Fondo tarjeta vencida |
| `--danger-border` | `#4D2420` | Borde tarjeta vencida |
| `--info` | `#9DBBFF` | "Esperando a otro" |

**Colores por área** (texto / fondo de etiqueta con 16% de opacidad):
- Reporte de Ventas: `#8FB3FF` / `rgba(91,141,239,0.16)`
- Meta Premiada: `#F7BC55` / `rgba(245,165,36,0.16)`
- PDV: `#6FDCA6` / `rgba(63,191,127,0.16)`
- Cartelería: `#CDB0FF` / `rgba(185,140,245,0.16)`
- Relevamiento: `#6FDCA6` con otro tono si hace falta distinguirlo de PDV (proponé uno, por ejemplo `#7FD8E0`)
- Otros: `#C4C9D2` / `#232935`

### 4.3 Tipografía
- `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`
- Título de sección: 34px, peso 700, `letter-spacing: -0.02em`
- Sobretítulo (fecha, etc.): 13px, peso 600, mayúsculas, `letter-spacing: 0.06em`, color muted
- Subtítulos: 20px / 700
- Cuerpo: 15–16px / 500
- Metadatos y etiquetas: 12–13px

### 4.4 Formas y espaciado
- Radios: tarjetas 18px, tiles 16px, chips 19–20px (píldora), botones grandes 16px, bottom sheets 30px arriba.
- Padding lateral de pantalla: 20px. Separación entre bloques: 18px.
- **Todos los objetivos táctiles ≥ 44×44px.**
- Contraste de texto mínimo 4.5:1.
- Íconos: SVG inline de trazo (stroke 1.9–2), sin emojis.

### 4.5 Componentes clave
- **Barra de pestañas inferior** fija: Hoy (ícono calendario), Procesos (ícono checklist), Seguimientos (ícono reloj). Activa en ámbar, inactivas en `#8B94A3`. Seguimientos muestra un globito rojo con la cantidad de vencidos.
- **Botón flotante "+"** (FAB): círculo ámbar de 62px, abajo a la derecha, sobre la barra de pestañas, con sombra ámbar suave. Visible en todas las pestañas. Abre la captura rápida.
- **Bottom sheet** reutilizable: se desliza desde abajo con animación (~250ms, ease-out), fondo oscurecido (60%), "manija" arriba, se cierra tocando el fondo, con "Cancelar" o deslizando hacia abajo.
- **Checkbox de tarea:** círculo de 28px; vacío con borde `#3A4250`; marcado = relleno ámbar con check oscuro. Al marcar, pequeña animación y el título pasa a tachado/gris.
- **Checkbox de paso de proceso:** cuadrado redondeado (8px) de 26px, mismo comportamiento.
- **Chips de filtro/selección:** píldoras con borde; la activa con borde ámbar, fondo `--accent-soft` y texto `--accent-text`.
- **Toast** abajo para confirmaciones ("Tarea guardada", "Deshacer").
- Respetar `prefers-reduced-motion`.

---

## 5. Modelo de datos (IndexedDB)

Base `centro-mando`, con versión para poder migrar. Stores:

### 5.1 `tasks`
```js
{
  id: string,            // uuid
  title: string,
  area: string,          // id de área
  bucket: "hoy" | "semana" | "algun_dia",
  time: string | null,   // "HH:MM" opcional
  dueDate: string | null,// "YYYY-MM-DD" opcional
  notes: string,
  done: boolean,
  doneAt: string | null, // ISO
  createdAt: string,     // ISO
  order: number          // para reordenar
}
```

### 5.2 `followups` (seguimientos)
```js
{
  id: string,
  title: string,              // ej. "Cartel gomería · San José"
  area: string,
  nextAction: string,         // ej. "Consultar a MTOP si aprueban la versión iluminada"
  dueDate: string,            // "YYYY-MM-DD" obligatorio
  owner: "me" | "other",      // "Me toca a mí" / "Esperando a otro"
  waitingFor: string,         // a quién espero (texto libre, opcional)
  status: "open" | "resolved",
  history: [ { date: string, text: string } ], // bitácora de avances
  createdAt: string,
  resolvedAt: string | null
}
```

### 5.3 `processTemplates`
```js
{
  id: string,
  name: string,              // ej. "Cierre de mes"
  frequency: "monthly" | "weekly",
  periodOffset: number,      // monthly: -1 = el run corresponde al mes ANTERIOR (cierre)
  groups: [
    {
      name: string,          // ej. "Meta Premiada"
      area: string,
      steps: [ { id: string, title: string, note: string } ]
    }
  ]
}
```

### 5.4 `processRuns` (una ejecución por período)
```js
{
  id: string,                // `${templateId}:${period}`
  templateId: string,
  period: string,            // "2026-09" (o "2026-W41" si es semanal)
  checked: { [stepId]: string }, // stepId → fecha ISO en que se marcó
  createdAt: string,
  completedAt: string | null
}
```

### 5.5 `settings` (clave-valor)
Áreas (nombre + color, editables), banner de instalación descartado, última exportación de backup, preferencias.

**Reglas generales:** fechas en zona horaria `America/Montevideo`; formateo con `Intl` en `es-UY`; la semana empieza el lunes. Todas las escrituras pasan por `store.js` y, después de cada cambio, se re-renderiza la vista y se actualiza el badge.

---

## 6. Datos iniciales (`seed.js`)

En el primer arranque, crear la plantilla de procesos **"Cierre de mes"** (`frequency: "monthly"`, `periodOffset: -1`) con estos grupos y pasos (son mis procesos reales):

**Reporte de Ventas** (área Reporte de Ventas)
1. Pegar la bajada del sistema en BASE como valores
2. Revisar que no se hayan movido columnas — nota: "Las hojas derivadas leen por nombre de columna (AxTable1)."
3. Actualizar las tablas dinámicas

**Meta Premiada** (área Meta Premiada)
4. Cerrar el mes en la hoja Seguimiento
5. Guardar copia fija «BASE GENERAL {MES_CIERRE}»
6. Mover el corte de +180 días un mes — nota: "Base de {MES_ACTUAL}: última compra {MES_CORTE} o antes."
7. Enviar la base a los vendedores — nota: "Solo los 6 vendedores de campo."

**Avance de Relevamiento** (área Relevamiento)
8. Pegar la base descargada en BASE — nota: "Cruzar solo por código (viejo y E000xxxx), nunca por nombre."
9. Revisar el % por vendedor en RESUMEN

### Variables dinámicas en títulos y notas
Implementá un reemplazo de variables al mostrar los pasos:
- `{MES_CIERRE}` = mes del período en mayúsculas (ej. en octubre 2026 → "SEPTIEMBRE")
- `{MES_ACTUAL}` = mes calendario actual en minúscula (ej. "octubre")
- `{MES_CORTE}` = mes actual menos 7 meses, formato corto "mmm-AA" (ej. octubre 2026 → "mar-26")

No cargues tareas ni seguimientos de ejemplo en la base real. En Ajustes poné un botón **"Cargar datos de ejemplo"** (y otro para borrarlos) con 4 tareas y 5 seguimientos de muestra, para probar la app:
- Tareas: "Pegar la bajada en BASE (Reporte de Ventas)" 09:30 · "Llamar a 5 PDV en riesgo inactivo" 11:00 · "Pedir cotización del cartel 8×2 m" 15:00 · "Enviar base de octubre a vendedores" 17:00.
- Seguimientos: "Cartel gomería · San José" (vencido, me toca) · "Orden E01-000055 sin cliente" (hoy, me toca) · "Relevamiento con código cruzado" (en 2 días, me toca) · "Permiso de cartel · Canelones" (en 3 días, esperando firma del propietario) · "Cotización de banners 70×110" (en 4 días, esperando proveedor).

---

## 7. Pantallas y comportamiento

### 7.1 Hoy (pantalla de inicio de la app)
**Encabezado:** sobretítulo con la fecha ("LUNES 12 DE OCTUBRE"), título "Hoy", avatar circular con mis iniciales "MB" a la derecha (abre Ajustes).

**Tres tiles resumen** (grilla de 3 columnas):
1. **Pendientes hoy:** cantidad de tareas no completadas de "Hoy".
2. **Seguimiento(s) vencido(s):** cantidad en rojo; al tocarlo va a Seguimientos con el filtro "Vencidos".
3. **Cierre de mes:** "5/9" + barra de progreso ámbar; al tocarlo va a Procesos.

**Sección "Para hoy":** lista en una tarjeta. Incluye:
- tareas con `bucket: "hoy"`,
- tareas con `dueDate` igual a hoy,
- tareas atrasadas no completadas (de días anteriores), arriba de todo, con etiqueta roja "Atrasada · desde ayer / desde el lun 5".

Cada fila: checkbox, título, etiqueta de área con su color, hora (si tiene). Orden: atrasadas → con hora (ascendente) → sin hora (por `order`). Las completadas bajan al final, tachadas, y a medianoche dejan de mostrarse (quedan en el historial).

Al lado del título de sección: "X hechas".

**Sección "Esperando a alguien":** los seguimientos con `owner: "other"` que vencen en los próximos 3 días (título, subtítulo con la próxima acción, fecha a la derecha). Tocar uno abre su detalle.

**Sección "Esta semana"** (colapsable): tareas con `bucket: "semana"`. Cada una tiene un botón rápido "Pasar a hoy".

**Interacciones de una tarea:**
- Tocar el checkbox → completar / descompletar (con toast "Deshacer" de 4 segundos).
- Tocar el título → abre un sheet de edición (título, área, cuándo, hora, fecha, notas, botón eliminar con confirmación).
- Deslizar a la izquierda (opcional, si sale prolijo) → acciones "Mañana" y "Eliminar".

**Estado vacío:** ilustración simple con SVG + "Nada pendiente para hoy. Tocá + para cargar algo."

### 7.2 Captura rápida (bottom sheet desde el botón +)
Objetivo: **cargar una tarea en menos de 5 segundos.**
- Encabezado: "Cancelar" | "Nueva tarea".
- Input "¿Qué hay que hacer?" con **foco automático** y teclado abierto al instante. Placeholder: "Ej: llamar a la gomería de Las Piedras".
- Chips "¿Cuándo?": **Hoy** (por defecto) · **Esta semana** · **Algún día** · **Es un seguimiento**.
- Chips "Área": Reporte de Ventas · Meta Premiada · PDV · Cartelería · Relevamiento · Otros (recordar la última área usada).
- Opcional plegable "Más detalles": hora y notas.
- Si elijo **"Es un seguimiento"**, el formulario cambia a: próxima acción, fecha límite (chips rápidos: Hoy · Mañana · En 3 días · Próximo lunes · Elegir fecha), "¿A quién le toca?" (Me toca a mí / Esperando a otro + campo "¿A quién?").
- Botón grande "Guardar" (deshabilitado/gris si el título está vacío, ámbar si hay texto). **Enter en el teclado también guarda.**
- Después de guardar: cierra el sheet, toast "Guardada en Hoy" y la tarea aparece con una animación sutil.

### 7.3 Procesos
**Encabezado:** sobretítulo "CHECKLISTS QUE SE REPITEN", título "Procesos".

**Tarjeta del período actual** de cada plantilla: nombre ("Cierre de septiembre"), "5 de 9 pasos · faltan 4", porcentaje grande en ámbar, barra de progreso y la leyenda "Se reinicia sola el 1º de cada mes" con ícono de refresco.

**Grupos:** título del grupo con el color de su área y contador "2/4". Debajo, una tarjeta con los pasos. Cada paso: checkbox cuadrado, título y, si tiene, nota en ámbar suave (`#D9C29A`) con ícono de info. Tocar la fila entera marca/desmarca.

**Lógica de períodos:**
- Al abrir la app, si no existe el run del período actual de una plantilla, se crea vacío automáticamente.
- Con `periodOffset: -1`, el período mostrado es el mes anterior (en octubre se trabaja el "Cierre de septiembre").
- Cuando se completan todos los pasos: animación de celebración discreta, `completedAt` guardado y la tarjeta muestra "Mes cerrado ✓ el 6 oct".
- Botón "Ver historial": lista de períodos anteriores con su fecha de cierre y cuántos días tardé.

**Edición de plantillas** (desde un botón "Editar" en la tarjeta): renombrar, agregar/eliminar/reordenar grupos y pasos, editar notas. Los cambios aplican a los períodos nuevos sin borrar lo ya marcado. Permitir crear plantillas nuevas (mensuales o semanales).

### 7.4 Seguimientos
**Encabezado:** sobretítulo "LO QUE NO SE PUEDE PERDER", título "Seguimientos".

**Chips de filtro con contador:** Todos · Vencidos · Me toca · Esperando.

**Lista de tarjetas**, ordenada por fecha (vencidos primero). Cada tarjeta:
- Título (16px/600) y área en su color.
- Pastilla de fecha arriba a la derecha: "Venció 9 oct" (rojo), "Hoy" (ámbar), "Mié 14" (gris).
- Próxima acción con ícono de flecha.
- Pie: pastilla "Me toca a mí" (ámbar) o "Esperando a otro" (azul `--info`) + botón "Marcar resuelto".
- Las tarjetas vencidas tienen fondo `--danger-bg` y borde `--danger-border`.

**Detalle de un seguimiento** (sheet al tocar la tarjeta):
- Editar todos los campos.
- **"Registrar avance":** escribo qué pasó y defino la nueva próxima acción y fecha. Se agrega a `history` con la fecha y se actualiza la tarjeta.
- **Posponer rápido:** +1 día · +3 días · Próximo lunes.
- Bitácora (historial) en orden cronológico inverso.
- "Marcar resuelto" (con deshacer) y "Eliminar" (con confirmación).
- Sección "Resueltos" plegada al final de la lista para consultar el historial.

### 7.5 Ajustes (desde el avatar)
- Áreas: renombrar, cambiar color, agregar, ocultar.
- **Backup:** "Exportar copia (.json)" usando la hoja de compartir de iOS (`navigator.share` con archivo si está disponible; si no, descarga) e "Importar copia" (con vista previa y confirmación antes de reemplazar). Mostrar "Último backup: hace X días" y un aviso suave si pasaron más de 7 días.
- **"Copiar resumen del día":** genera un texto listo para pegar en Teams/WhatsApp con lo hecho hoy, lo pendiente y los seguimientos vencidos.
- Cargar / borrar datos de ejemplo.
- Activar badge en el ícono (pide permiso de notificaciones).
- Versión de la app y botón "Buscar actualización" (fuerza la actualización del service worker).

---

## 8. Lógica y reglas de negocio (resumen)

1. **Fechas:** todo con `America/Montevideo`. "Hoy" se recalcula al volver a abrir la app (evento `visibilitychange`), así que si la dejo abierta de un día para otro, se actualiza sola.
2. **Arrastre de tareas:** las tareas de "Hoy" no completadas siguen apareciendo al día siguiente como "Atrasada", nunca se pierden.
3. **Vencidos:** un seguimiento abierto con `dueDate` < hoy está vencido; cuenta para el tile de Hoy y para el globito de la pestaña.
4. **Badge del ícono** = tareas pendientes de hoy + seguimientos vencidos (si está activado).
5. **Deshacer** en toda acción destructiva o de completar (toast 4 s).
6. **Backup** en JSON con versión del esquema; al importar, validar el formato antes de tocar la base.

---

## 9. Accesibilidad y calidad

- Elementos interactivos reales (`<button>`, `<a>`, `<input>` con `<label>`); `aria-label` en botones de solo ícono.
- Foco visible con teclado (para cuando la use en la PC).
- Nada de `innerHTML` con texto que haya escrito yo: escapá el contenido para evitar inyección de HTML.
- Sin errores en consola. Manejo de errores de IndexedDB con mensaje amigable.
- Rendimiento: debe abrir en menos de 1 segundo en el iPhone.

---

## 10. Publicación

1. Inicializar git y crear el repo en GitHub (guiame: ¿tengo que crear cuenta?, ¿cómo me autentico?).
2. Configurar GitHub Pages desde la rama `main`.
3. Verificar que el `manifest`, el `start_url`, el `scope` y el service worker funcionen bajo la subruta `https://<usuario>.github.io/<repo>/`.
4. Darme las instrucciones exactas para abrirla en Safari del iPhone e instalarla.
5. Explicame cómo publicar una actualización en el futuro (cambiar la versión de caché del service worker, commit, push) y cómo se actualiza en el teléfono.

---

## 11. Fases de trabajo (frená al final de cada una y esperá mi OK)

**Fase 0 — Plan.** Leé todo, haceme las preguntas que necesites, proponé ajustes, creá `CLAUDE.md` y `README.md` e inicializá git.

**Fase 1 — Esqueleto PWA.** `index.html`, tokens de diseño, barra de pestañas, navegación entre las 3 secciones vacías, FAB, `manifest`, íconos (generá el ícono: cuadrado oscuro `#0E1116` con un cuadrado redondeado de trazo ámbar y un check ámbar adentro; exportá PNG 180, 192, 512 y 512 maskable), service worker y banner de instalación. Decime cómo probarla en la compu (servidor local) y cómo simular el tamaño del iPhone en el navegador.

**Fase 2 — Base de datos + Hoy + captura rápida.** `db.js`, `store.js`, pantalla Hoy completa y captura rápida (solo tareas).

**Fase 3 — Procesos.** Plantillas, runs por período, variables dinámicas, seed real, edición de plantillas e historial.

**Fase 4 — Seguimientos.** Lista, filtros, detalle, registrar avance, posponer, resueltos y captura de seguimiento desde el botón +.

**Fase 5 — Ajustes y cierre.** Áreas, backup, resumen del día, datos de ejemplo, badge, pulido de animaciones y accesibilidad.

**Fase 6 — Publicación.** GitHub Pages y prueba real en el iPhone.

---

## 12. Criterios de aceptación (checklist final)

- [ ] Se instala desde Safari en el iPhone 16 Pro Max y abre a pantalla completa, sin barra de Safari, con su ícono y el nombre "Mando".
- [ ] Nada queda tapado por la Dynamic Island ni por el indicador de inicio.
- [ ] Funciona sin internet (modo avión) después de la primera carga.
- [ ] Cargo una tarea en menos de 5 segundos desde cualquier pestaña.
- [ ] Las tareas no completadas de ayer aparecen como atrasadas.
- [ ] El checklist de cierre se crea solo cada mes, con las variables de mes bien calculadas (en octubre 2026: "SEPTIEMBRE", "octubre", "mar-26").
- [ ] Los seguimientos vencidos se ven en rojo, arriba, y cuentan en el globito de la pestaña.
- [ ] Puedo registrar avances y posponer seguimientos.
- [ ] Puedo exportar e importar un backup.
- [ ] Los datos sobreviven a cerrar la app y reiniciar el teléfono.
- [ ] No hay inputs que hagan zoom al tocarlos.
- [ ] Todo el texto está en español rioplatense y las fechas en formato uruguayo.

---

Cuando termines de leer, empezá por la **Fase 0**: contame en pocas líneas cómo entendiste el proyecto, qué decisiones técnicas proponés y qué preguntas tenés. No escribas código de la app todavía.
