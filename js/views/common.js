// Piezas compartidas por las vistas.
import { el } from '../dom.js';
import { illustration } from '../icons.js';

/** Encabezado de sección: sobretítulo + título grande + (opcional) algo a la derecha. */
export function viewHeader({ overline, title, trailing = null }) {
  return el('header', { class: 'view-header' },
    el('div', {},
      el('p', { class: 'overline' }, overline),
      el('h1', { class: 'title', id: 'view-title' }, title),
    ),
    trailing,
  );
}

/** Estado vacío: ilustración + texto. */
export function emptyState(text, art = 'emptyDay') {
  return el('div', { class: 'empty' }, illustration(art), el('p', {}, text));
}
