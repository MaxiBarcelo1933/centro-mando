// Deslizar una fila hacia la izquierda para mostrar acciones (ej. "Mañana" y "Eliminar").
// El scroll vertical sigue funcionando: solo se toma el gesto si es más horizontal que vertical.

let openRow = null;
let lastSwipeEnd = 0;

/**
 * enableSwipe(fila, contenido, acciones, anchoDeLasAcciones)
 * - `content` es lo que se mueve; `actions` queda detrás, a la derecha.
 */
export function enableSwipe(row, content, actions, width) {
  let startX = 0;
  let startY = 0;
  let base = 0;
  let offset = 0;
  let tracking = false;
  let horizontal = false;

  const setOffset = (x, animate) => {
    content.style.transition = animate ? '' : 'none';
    content.style.transform = x ? `translateX(${x}px)` : '';
  };

  // Los botones de atrás solo se pueden enfocar cuando están a la vista.
  const setActionsReachable = (reachable) => {
    actions.setAttribute('aria-hidden', String(!reachable));
    for (const button of actions.querySelectorAll('button')) button.tabIndex = reachable ? 0 : -1;
  };

  function open() {
    if (openRow && openRow.row !== row) openRow.close();
    setOffset(-width, true);
    row.classList.add('is-swiped');
    setActionsReachable(true);
    openRow = { row, close };
  }

  function close() {
    setOffset(0, true);
    row.classList.remove('is-swiped');
    setActionsReachable(false);
    if (openRow?.row === row) openRow = null;
  }

  setActionsReachable(false);

  content.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    base = row.classList.contains('is-swiped') ? -width : 0;
    offset = base;
    tracking = true;
    horizontal = false;
  });

  content.addEventListener('pointermove', (event) => {
    if (!tracking) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!horizontal) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        tracking = false; // es un scroll vertical: no lo tocamos
        return;
      }
      horizontal = true;
      try {
        content.setPointerCapture(event.pointerId);
      } catch {
        // Si no se puede capturar el dedo, igual seguimos el gesto.
      }
    }
    offset = Math.min(0, Math.max(-width - 24, base + dx));
    setOffset(offset, false);
  });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!horizontal) return;
    lastSwipeEnd = Date.now();
    if (offset < -width / 2) open();
    else close();
  };
  content.addEventListener('pointerup', end);
  content.addEventListener('pointercancel', end);

  // Un deslizamiento no cuenta como toque; y tocar una fila abierta la cierra.
  content.addEventListener('click', (event) => {
    if (Date.now() - lastSwipeEnd < 350 || row.classList.contains('is-swiped')) {
      event.preventDefault();
      event.stopPropagation();
      if (row.classList.contains('is-swiped') && Date.now() - lastSwipeEnd >= 350) close();
    }
  }, true);
}

export function closeOpenSwipe() {
  openRow?.close();
}
