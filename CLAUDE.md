# CLAUDE.md — Centro de Mando

Contexto para futuras sesiones. La especificación completa y original está en
`prompt-centro-de-mando.md` (fuente de verdad ante cualquier duda).

## Qué es
PWA personal de organización de tareas para iPhone (16 Pro Max, iOS 18+), para
Maximiliano (analista comercial, trade marketing, Baterías Moura Uruguay).
Resuelve tres problemas: procesos mensuales que rehace de memoria, seguimientos
largos que se le pasan, y tareas que llegan por muchos canales.

Secciones: **Hoy**, **Procesos**, **Seguimientos** (pestañas) + **captura rápida**
(botón "+" flotante en todas las pestañas) + **Ajustes** (desde el avatar "MB").

## Cómo trabajar con el usuario
- Es principiante: explicar en español simple, definir cada concepto nuevo en 1–2 líneas.
- Trabajar **por fases** (ver abajo). Al terminar cada una: frenar, mostrar qué se hizo,
  explicar cómo probarlo y **esperar su OK**.
- **Preguntar antes** de instalar dependencias o crear cuentas/servicios.
- Si algo es ambiguo o inconveniente en iOS, avisar y proponer alternativas antes de implementar.
- Git: un commit por paso lógico, mensajes en español.

## Stack y decisiones técnicas
- HTML + CSS + JavaScript moderno (ES modules). **Sin frameworks, sin build, sin CDNs,
  sin dependencias en runtime.** Todo funciona offline.
- Persistencia: IndexedDB con wrapper propio (`js/db.js`), base `centro-mando` versionada.
  Todas las escrituras pasan por `js/store.js`; después de cada cambio se re-renderiza
  la vista y se actualiza el badge.
- Service worker (`sw.js`): cache-first para estáticos, con versión de caché
  (`CACHE_VERSION`) que se sube en cada publicación.
- Hosting: GitHub Pages bajo subruta → **todas las rutas relativas** (`start_url`,
  `scope`, assets, registro del SW).
- Herramientas locales sin instalar nada (no hay Node ni Python en la PC):
  - Servidor local: script de PowerShell (`HttpListener`) → `tools/serve.ps1`.
  - Íconos PNG: generados con PowerShell + `System.Drawing` → `tools/make-icons.ps1`.
- Fechas: zona `America/Montevideo`, formateo con `Intl` en `es-UY`, semana empieza lunes.
  "Hoy" se calcula con `Intl` + timeZone (no con la hora local del dispositivo) y se
  recalcula en `visibilitychange`.

## Convenciones de código
- Variables y funciones en **inglés**; comentarios en **español**.
- Textos de interfaz en **español rioplatense** con voseo ("tocá", "agregá", "cargá").
- **Nunca** `innerHTML` con texto del usuario: usar `textContent` o una función de escape.
- Elementos interactivos reales (`button`, `a`, `input` + `label`); `aria-label` en
  botones de solo ícono; foco visible.
- Íconos: SVG inline de trazo (stroke 1.9–2). Sin emojis.
- Objetivos táctiles ≥ 44×44 px. Inputs con `font-size` ≥ 16px (evita zoom de iOS).
- Respetar `prefers-reduced-motion`.

## Estructura
```
index.html, manifest.webmanifest, sw.js
css/tokens.css (variables de diseño), css/app.css
js/app.js (arranque + router por pestañas), js/db.js, js/store.js, js/dates.js, js/seed.js
js/views/{hoy,procesos,seguimientos,ajustes}.js
js/components/{sheet,toast}.js
icons/ (PNG 180, 192, 512, 512 maskable)
tools/ (scripts de desarrollo, no se publican como parte de la app)
```

## Diseño (resumen; detalle en la spec §4)
Tema oscuro, acento ámbar `#F5A524`, fondo `#0E1116`, tarjetas `#171B22`.
Tokens en `css/tokens.css`. Radios: tarjetas 18, tiles 16, chips píldora, sheets 30.
Padding lateral 20px, separación entre bloques 18px.
Colores de área (texto / fondo 16%):
- Reporte de Ventas `#8FB3FF` / `rgba(91,141,239,.16)`
- Meta Premiada `#F7BC55` / `rgba(245,165,36,.16)`
- PDV `#6FDCA6` / `rgba(63,191,127,.16)`
- Cartelería `#CDB0FF` / `rgba(185,140,245,.16)`
- Relevamiento `#7FD8E0` / `rgba(127,216,224,.16)` (propuesto)
- Otros `#C4C9D2` / `#232935`

## Modelo de datos (stores de IndexedDB; detalle en spec §5)
`tasks`, `followups`, `processTemplates`, `processRuns`, `settings` (clave-valor).

Decisiones/ajustes sobre la spec (pendientes de confirmación del usuario en Fase 0):
- Tareas: una tarea "Hoy" guarda también `dueDate` = el día en que se planificó.
  "Atrasada" = no completada y `dueDate` < hoy. "Pasar a hoy" y "Mañana" solo cambian
  `dueDate`/`bucket`. Así no se depende de `createdAt`.
- Período mensual `YYYY-MM`; semanal ISO `YYYY-Www`. `periodOffset: -1` → mes anterior.
- Variables de pasos: `{MES_CIERRE}`, `{MES_ACTUAL}`, `{MES_CORTE}` (mes actual − 7, "mmm-AA").
  Octubre 2026 → "SEPTIEMBRE", "octubre", "mar-26".
- Se llama a `navigator.storage.persist()` para pedir almacenamiento persistente.

## Gotchas de iOS a recordar
- El teclado solo se abre con `input.focus()` llamado **sincrónicamente dentro del
  gesto del usuario** (el tap en "+"). El input de la captura rápida tiene que existir
  en el DOM y enfocarse en el mismo handler del tap, antes de la animación.
- `navigator.setAppBadge` funciona en iOS 16.4+ solo con la app instalada y con
  permiso de notificaciones concedido. Si no existe, ignorar sin error.
- Safe areas con `env(safe-area-inset-*)`; la tab bar suma `safe-area-inset-bottom`.
- Scroll solo dentro del contenedor de contenido; body fijo, `overscroll-behavior: contain`.

## Fases
0. Plan (CLAUDE.md, README.md, git) ← hecha
1. Esqueleto PWA (HTML, tokens, tabs, FAB, manifest, íconos, SW, banner de instalación)
2. DB + Hoy + captura rápida (solo tareas)
3. Procesos (plantillas, runs, variables, seed, edición, historial)
4. Seguimientos (lista, filtros, detalle, avances, posponer, resueltos, captura)
5. Ajustes y cierre (áreas, backup, resumen del día, datos de ejemplo, badge, pulido)
6. Publicación (GitHub Pages + prueba en iPhone)

## Estado actual
Fase 0 en curso. Sin código de la app todavía.
