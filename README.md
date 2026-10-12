# Centro de Mando

App personal (PWA) para organizar tareas en el iPhone: **Hoy**, **Procesos** y
**Seguimientos**, con captura rápida desde el botón **+**.

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

## Cómo instalarla en el iPhone
_(Se completa en la Fase 6.)_

1. Abrí la dirección de la app en **Safari**.
2. Tocá **Compartir → Agregar a inicio**.
3. Abrila desde el ícono **Mando**.

## Cómo publicar una actualización
_(Se completa en la Fase 6.)_

## Estructura del proyecto
Ver `CLAUDE.md` (resumen técnico) y `prompt-centro-de-mando.md` (especificación completa).
