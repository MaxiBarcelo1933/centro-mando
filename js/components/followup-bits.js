// Piezas de seguimientos que se usan en varias pantallas:
// selector de fecha límite, "¿A quién le toca?" y las pastillas de fecha y responsable.
import { el } from '../dom.js';
import { todayISO, addDays, nextMonday, formatShortDate, relativeDayLabel } from '../dates.js';
import { chipGroup } from './chips.js';
import { field } from './form.js';

/**
 * Fecha límite con chips rápidos: Hoy · Mañana · En 3 días · Próximo lunes · Elegir fecha.
 * Devuelve { element, value } (value = "YYYY-MM-DD").
 */
export function dueDatePicker({ value, label = 'Fecha límite' }) {
  const today = todayISO();
  const quick = {
    hoy: today,
    manana: addDays(today, 1),
    tres: addDays(today, 3),
    lunes: nextMonday(today),
  };
  const labels = { hoy: 'Hoy', manana: 'Mañana', tres: 'En 3 días', lunes: 'Próximo lunes', elegir: 'Elegir fecha' };
  let current = value;

  const initialKey = Object.keys(quick).find((key) => quick[key] === value) ?? 'elegir';
  const dateInput = el('input', { type: 'date', class: 'field__input', value, 'aria-label': label });
  dateInput.hidden = initialKey !== 'elegir';
  dateInput.addEventListener('change', () => {
    if (dateInput.value) current = dateInput.value;
  });

  const chips = chipGroup({
    label,
    options: Object.entries(labels).map(([key, text]) => ({ value: key, label: text })),
    value: initialKey,
    onChange: (key) => {
      if (key === 'elegir') {
        dateInput.hidden = false;
        dateInput.value = current;
        dateInput.focus();
      } else {
        dateInput.hidden = true;
        current = quick[key];
      }
    },
  });
  chips.element.append(dateInput);

  return {
    element: chips.element,
    get value() { return current; },
  };
}

/** "¿A quién le toca?": Me toca a mí / Esperando a otro (+ "¿A quién?"). */
export function ownerPicker({ owner = 'me', waitingFor = '' } = {}) {
  let current = owner;
  const whoInput = el('input', {
    type: 'text', class: 'field__input', value: waitingFor, autocomplete: 'off',
    placeholder: 'Ej: proveedor, propietario, el vendedor',
  });
  const whoField = field('¿A quién?', whoInput);
  whoField.hidden = owner !== 'other';

  const chips = chipGroup({
    label: '¿A quién le toca?',
    options: [
      { value: 'me', label: 'Me toca a mí' },
      { value: 'other', label: 'Esperando a otro' },
    ],
    value: owner,
    onChange: (value) => {
      current = value;
      whoField.hidden = value !== 'other';
    },
  });

  return {
    element: el('div', { class: 'form-group' }, chips.element, whoField),
    get owner() { return current; },
    get waitingFor() { return whoInput.value; },
  };
}

/** Pastilla de fecha: "Venció 9 oct" (rojo), "Hoy" (ámbar), "Mié 14" (gris). */
export function duePill(followup, today = todayISO()) {
  if (followup.status === 'open' && followup.dueDate < today) {
    return el('span', { class: 'date-pill date-pill--danger' }, `Venció ${formatShortDate(followup.dueDate)}`);
  }
  if (followup.dueDate === today) return el('span', { class: 'date-pill date-pill--today' }, 'Hoy');
  return el('span', { class: 'date-pill' }, relativeDayLabel(followup.dueDate, today));
}

/** "Me toca a mí" (ámbar) o "Esperando a otro" (azul), con a quién si lo cargaste. */
export function ownerPill(followup) {
  if (followup.owner === 'other') {
    const who = followup.waitingFor ? ` · ${followup.waitingFor}` : '';
    return el('span', { class: 'owner-pill owner-pill--other' }, `Esperando a otro${who}`);
  }
  return el('span', { class: 'owner-pill owner-pill--me' }, 'Me toca a mí');
}
