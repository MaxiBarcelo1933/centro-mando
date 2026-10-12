// Bottom sheet reutilizable: panel que sube desde abajo con el fondo oscurecido.
// Se cierra tocando el fondo, con "Cancelar", con Escape o deslizando hacia abajo.
import { el } from '../dom.js';

const CLOSE_DRAG_DISTANCE = 90;
let titleCounter = 0;

/**
 * openSheet({ title, content, initialFocus, onClose })
 * Importante en iOS: si se pasa `initialFocus`, el foco se pone en el mismo momento
 * (dentro del toque del usuario) para que el teclado se abra al instante.
 */
export function openSheet({ title, content, initialFocus = null, onClose = null }) {
  const app = document.getElementById('app');
  const opener = document.activeElement;
  const titleId = `sheet-title-${++titleCounter}`;

  const cancelButton = el('button', { class: 'sheet__cancel', type: 'button', onclick: () => close() }, 'Cancelar');
  const header = el('header', { class: 'sheet__header' },
    el('div', { class: 'sheet__handle', 'aria-hidden': 'true' }),
    el('div', { class: 'sheet__bar' },
      cancelButton,
      el('h2', { class: 'sheet__title', id: titleId }, title),
      el('span', { 'aria-hidden': 'true' }),
    ),
  );
  const body = el('div', { class: 'sheet__body' }, content);
  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, header, body);
  const backdrop = el('div', { class: 'sheet-backdrop' }, sheet);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.addEventListener('keydown', onKeydown);
  setupDragToClose(header, sheet, () => close());
  const stopViewportTracking = trackKeyboard(backdrop);

  document.body.append(backdrop);
  app.inert = true; // lo de atrás no se puede tocar ni enfocar mientras el sheet está abierto
  if (initialFocus) initialFocus.focus({ preventScroll: true });
  else cancelButton.focus({ preventScroll: true });

  // Forzamos un cuadro antes de agregar la clase, para que se vea la animación de entrada.
  backdrop.getBoundingClientRect();
  backdrop.classList.add('is-open');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.activeElement?.blur();
    backdrop.classList.remove('is-open');
    sheet.style.transform = '';
    app.inert = false;
    stopViewportTracking();
    setTimeout(() => backdrop.remove(), 260);
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    onClose?.();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapFocus(event, sheet);
    }
  }

  return { close, element: sheet, body };
}

// Mantiene el foco del teclado (Tab) dentro del sheet.
function trapFocus(event, container) {
  const focusables = [...container.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea, select, summary, [tabindex]:not([tabindex="-1"])',
  )].filter((node) => node.offsetParent !== null);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// Deslizar la manija/encabezado hacia abajo cierra el sheet.
function setupDragToClose(handleArea, sheet, close) {
  let startY = null;
  let delta = 0;

  handleArea.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    startY = event.clientY;
    delta = 0;
  });
  handleArea.addEventListener('pointermove', (event) => {
    if (startY === null) return;
    delta = Math.max(0, event.clientY - startY);
    if (delta > 6) {
      if (!handleArea.hasPointerCapture(event.pointerId)) handleArea.setPointerCapture(event.pointerId);
      sheet.classList.add('is-dragging');
      sheet.style.transform = `translateY(${delta}px)`;
    }
  });
  const end = () => {
    if (startY === null) return;
    startY = null;
    sheet.classList.remove('is-dragging');
    if (delta > CLOSE_DRAG_DISTANCE) close();
    else sheet.style.transform = '';
  };
  handleArea.addEventListener('pointerup', end);
  handleArea.addEventListener('pointercancel', end);
}

// En el iPhone el teclado tapa la parte de abajo de la pantalla. Con visualViewport
// medimos cuánto ocupa y subimos el sheet para que quede justo arriba del teclado.
function trackKeyboard(backdrop) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  const update = () => {
    const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    backdrop.style.setProperty('--keyboard', `${keyboard}px`);
    backdrop.style.setProperty('--viewport-h', `${viewport.height}px`);
  };
  update();
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
  };
}
