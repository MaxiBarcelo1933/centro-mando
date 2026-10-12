// Pantalla "Procesos". Se completa en la Fase 3.
import { el } from '../dom.js';
import { viewHeader, emptyState } from './common.js';

export function renderProcesos() {
  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: 'Checklists que se repiten', title: 'Procesos' }),
    el('div', { class: 'card' },
      emptyState('Acá vas a ver el checklist del cierre de mes y tus otros procesos.', 'emptyList'),
    ),
  );
}
