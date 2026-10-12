// Toast: mensaje corto abajo de la pantalla, con un botón opcional (ej. "Deshacer").
import { el } from '../dom.js';

let current = null;

/**
 * showToast('Tarea guardada', { actionLabel: 'Deshacer', onAction: fn, duration: 4000 })
 * Devuelve { dismiss } por si hay que cerrarlo antes.
 */
export function showToast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  const root = document.getElementById('toast-root');
  if (current) current.dismiss();

  const node = el('div', { class: 'toast' }, el('span', {}, message));
  if (actionLabel) {
    node.append(el('button', {
      class: 'toast__action',
      type: 'button',
      onclick: () => {
        dismiss();
        onAction?.();
      },
    }, actionLabel));
  }

  root.append(node);
  // Esperamos un cuadro para que la transición de entrada se vea.
  requestAnimationFrame(() => node.classList.add('is-visible'));
  const timer = setTimeout(dismiss, duration);

  function dismiss() {
    clearTimeout(timer);
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 250);
    if (current?.node === node) current = null;
  }

  current = { node, dismiss };
  return { dismiss };
}
