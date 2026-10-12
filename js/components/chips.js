// Grupo de chips (píldoras) para elegir una opción. La activa va en ámbar.
import { el } from '../dom.js';

let groupCounter = 0;

/**
 * chipGroup({ label, options: [{ value, label, color? }], value, onChange })
 * Devuelve { element, setValue, value }.
 * `color` dibuja un puntito del color del área al lado del texto.
 */
export function chipGroup({ label, options, value, onChange = null }) {
  const labelId = `chips-${++groupCounter}`;
  let current = value;

  const buttons = options.map((option) => {
    const dot = option.color ? el('span', { class: 'chip__dot', 'aria-hidden': 'true' }) : null;
    if (dot) dot.style.background = option.color;
    return el('button', {
      class: 'chip',
      type: 'button',
      'aria-pressed': String(option.value === current),
      onclick: () => {
        setValue(option.value);
        onChange?.(option.value);
      },
    }, dot, option.label);
  });

  function setValue(newValue) {
    current = newValue;
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(options[i].value === newValue)));
  }

  const element = el('div', { class: 'field', role: 'group', 'aria-labelledby': labelId },
    el('span', { class: 'field__label', id: labelId }, label),
    el('div', { class: 'chips' }, buttons),
  );

  return {
    element,
    setValue,
    get value() { return current; },
  };
}
