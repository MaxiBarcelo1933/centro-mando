// Pantalla "Seguimientos". Se completa en la Fase 4.
import { el } from '../dom.js';
import { viewHeader, emptyState } from './common.js';

export function renderSeguimientos() {
  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: 'Lo que no se puede perder', title: 'Seguimientos' }),
    el('div', { class: 'card' },
      emptyState('Acá van a aparecer las cotizaciones, permisos y consultas que estás siguiendo.', 'emptyList'),
    ),
  );
}
