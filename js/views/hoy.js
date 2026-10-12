// Pantalla "Hoy". En la Fase 1 es solo el encabezado y el estado vacío.
import { el } from '../dom.js';
import { formatLongDate } from '../dates.js';
import { showToast } from '../components/toast.js';
import { viewHeader, emptyState } from './common.js';

export function renderHoy() {
  const avatar = el('button', {
    class: 'avatar',
    type: 'button',
    'aria-label': 'Abrir ajustes',
    onclick: () => showToast('Los ajustes llegan en la Fase 5'),
  }, 'MB');

  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: formatLongDate(), title: 'Hoy', trailing: avatar }),
    el('div', { class: 'card' },
      emptyState('Nada pendiente para hoy. Tocá + para cargar algo.'),
    ),
  );
}
