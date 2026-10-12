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

/**
 * Números con formato uruguayo: punto para los miles y coma para los decimales.
 * formatNumber(11050.23) → "11.050,23" · formatNumber(447534.3, 0) → "447.534"
 */
export function formatNumber(value, decimals = 2) {
  const [whole, fraction] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '-' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

/** "USD 11.050,23" */
export const formatUSD = (value) => `USD ${formatNumber(value)}`;

/** "$ 447.534" (pesos, sin decimales) */
export const formatPesos = (value) => `$ ${formatNumber(value, 0)}`;

/** Lee un número escrito a mano: "40,50", "40.50" o "1.725,00". Devuelve NaN si no es un número. */
export function parseDecimal(text) {
  const clean = String(text).trim().replace(/\s/g, '');
  if (clean === '') return NaN;
  // Con coma: la coma es el decimal y los puntos son miles.
  return Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean);
}
