# Centro de Mando

App personal (PWA) para organizar tareas en el iPhone: **Hoy**, **Procesos**, **Seguimientos** y
**Calendario** (día, semana laboral y mes), con captura rápida desde el botón **+**.

Funciona 100% offline y guarda todo en el propio teléfono (no hay servidor ni login).
Por eso conviene exportar una copia de seguridad cada tanto desde **Ajustes → Backup**.

## Cómo probarla en la compu
1. Abrí PowerShell en la carpeta del proyecto (`D:\centro-mando`) y ejecutá:
   ```
   powershell -ExecutionPolicy Bypass -File tools\serve.ps1
   ```
   Si dice que el puerto está ocupado, agregá `-Port 8081` al final.
2. Abrí **http://localhost:8080/** en Chrome.
3. Para cortar el servidor: **Ctrl+C** en la ventana de PowerShell.

### Simular el iPhone 16 Pro Max en Chrome
1. Con la app abierta, tocá **F12** (abre las herramientas de desarrollo).
2. Tocá **Ctrl+Shift+M** (modo dispositivo).
3. Arriba, en el menú de dispositivos, elegí **Edit… → Add custom device**:
   nombre `iPhone 16 Pro Max`, ancho `440`, alto `956`, DPR `3`, tipo **Mobile**,
   y en *User agent* pegá el de un iPhone (Chrome trae uno en la lista de iPhone).
4. Elegilo en el menú. Con el user agent de iPhone vas a ver el banner "Instalala en tu iPhone".

Notas:
- La Dynamic Island y el indicador de inicio **no** se simulan en Chrome; eso se prueba en el teléfono real (Fase 6).
- Mientras programamos, el service worker en `localhost` pide siempre la versión nueva, así ves los cambios con solo recargar.
- Para probar sin internet: F12 → pestaña **Network** → **Offline**, y recargá.

### Pruebas automáticas
Con el servidor corriendo, en **otra** ventana de PowerShell:
```
powershell -ExecutionPolicy Bypass -File tools\test.ps1
```
Abre un Chrome invisible (con un perfil aparte, no toca tus datos), usa la app sola
(carga tareas, las completa, las edita, las borra) y te muestra la lista de pruebas con
OK o FALLA. Al final tiene que decir **Resultado: TODO OK**.

### Regenerar los íconos
```
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
```

## Dónde está publicada
**https://maxibarcelo1933.github.io/centro-mando/**

(GitHub Pages publica automáticamente lo que esté en la rama `main` del repositorio
`MaxiBarcelo1933/centro-mando`.)

## Cómo instalarla en el iPhone
1. Abrí **https://maxibarcelo1933.github.io/centro-mando/** en **Safari**
   (tiene que ser Safari: desde Chrome del iPhone no se instala igual).
2. Tocá el botón **Compartir** (el cuadrado con la flecha para arriba, abajo al medio).
3. Bajá y tocá **Agregar a inicio** → dejá el nombre **Mando** → **Agregar**.
4. Abrila siempre desde el ícono **Mando** de la pantalla de inicio (no desde Safari):
   así se abre a pantalla completa y tus datos quedan en la app instalada.

Importante: los datos que cargues en Safari y los de la app instalada son **distintos**
(iOS los guarda por separado). Usá siempre la app instalada.

## Cómo publicar una actualización
1. Hacé los cambios y probalos en la compu (servidor local + `tools\test.ps1`).
2. En `sw.js`, subí la versión: `const CACHE_VERSION = 'v1';` → `'v2'` (después `'v3'`, etc.).
   Sin este paso el teléfono sigue usando la copia vieja que tiene guardada.
3. Guardá y subí los cambios:
   ```
   git add -A
   git commit -m "Qué cambió"
   git push
   ```
4. Esperá 1–2 minutos (GitHub Pages publica solo).
5. En el iPhone, abrí la app: al detectar la versión nueva aparece el aviso
   **"Hay una versión nueva de la app" → Recargar**. Si no aparece, cerrala del todo
   (deslizándola hacia arriba en el selector de apps) y abrila de nuevo, o andá a
   **Ajustes → Buscar actualización**. En **Ajustes → Versión** vas a ver la versión nueva.

Tus datos **no** se pierden al actualizar: viven en el teléfono, no en el código.

## Estructura del proyecto
Ver `CLAUDE.md` (resumen técnico) y `prompt-centro-de-mando.md` (especificación completa).
