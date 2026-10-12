// Piezas de formulario compartidas (campo con etiqueta, chips de área y de "¿Cuándo?").
import { el } from '../dom.js';
import * as store from '../store.js';
import { chipGroup } from './chips.js';

let fieldCounter = 0;

/** Campo con su etiqueta visible: field('Hora', input) */
export function field(labelText, input) {
  if (!input.id) input.id = `field-${++fieldCounter}`;
  return el('div', { class: 'field' },
    el('label', { class: 'field__label', for: input.id }, labelText),
    input,
  );
}

export function areaChips(value, onChange) {
  const options = store.getAreas().map((area) => ({ value: area.id, label: area.name, color: area.color }));
  // Si la tarea tiene un área oculta, la mostramos igual para no perderla.
  if (!options.some((o) => o.value === value)) {
    const area = store.getArea(value);
    options.push({ value: area.id, label: area.name, color: area.color });
  }
  return chipGroup({ label: 'Área', options, value, onChange });
}

export function bucketChips(value, onChange) {
  const options = Object.entries(store.BUCKET_LABELS).map(([key, label]) => ({ value: key, label }));
  return chipGroup({ label: '¿Cuándo?', options, value, onChange });
}

/**
 * Campo de texto de una línea que crece hacia abajo si el texto es largo
 * (así se lee completo aunque al lado haya botones). Enter no agrega saltos de línea.
 */
export function autoGrowInput(attrs, value, onInput) {
  const input = el('textarea', { class: 'field__input field__input--auto', rows: 1, ...attrs });
  input.value = value;
  const fit = () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight + 2}px`; // +2 por el borde
  };
  input.addEventListener('input', () => {
    // Si pegás un texto con saltos de línea, los convertimos en espacios.
    if (input.value.includes('\n')) input.value = input.value.replace(/\n+/g, ' ');
    onInput(input.value);
    fit();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
  // Medimos cuando ya está en pantalla.
  requestAnimationFrame(fit);
  return input;
}

/** Pastilla con el nombre del área en su color. */
export function areaTag(areaId) {
  const area = store.getArea(areaId);
  const tag = el('span', { class: 'tag' }, area.name);
  tag.style.color = area.color;
  tag.style.background = area.bg;
  return tag;
}
