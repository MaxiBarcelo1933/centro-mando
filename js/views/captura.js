// Captura rápida: cargar una tarea (o un seguimiento) en menos de 5 segundos desde el "+".
import { el } from '../dom.js';
import * as store from '../store.js';
import { todayISO, addDays, relativeDayLabel } from '../dates.js';
import { openSheet } from '../components/sheet.js';
import { chipGroup } from '../components/chips.js';
import { showToast, tryAction } from '../components/toast.js';
import { field, areaChips } from '../components/form.js';
import { dueDatePicker, ownerPicker } from '../components/followup-bits.js';
import { highlightTask } from './hoy.js';

const FOLLOWUP = 'seguimiento';
const PLACEHOLDERS = {
  task: 'Ej: llamar a la gomería de Las Piedras',
  followup: 'Ej: Cartel gomería · San José',
};

/**
 * Se llama directo desde el toque en "+" (así iOS abre el teclado al instante).
 * Desde el calendario llega con el día y la hora del hueco tocado: { date, time }.
 */
export function openQuickCapture({ date = null, time = null } = {}) {
  const today = todayISO();
  const draft = {
    when: bucketForDate(date, today),
    area: store.getSetting('lastArea') || 'otros',
  };

  const titleInput = el('input', {
    type: 'text',
    class: 'field__input field__input--big',
    placeholder: PLACEHOLDERS.task,
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    required: true,
  });
  const saveButton = el('button', { class: 'btn-primary', type: 'submit', disabled: true }, 'Guardar');
  titleInput.addEventListener('input', () => {
    saveButton.disabled = titleInput.value.trim() === '';
  });

  // Campos de tarea
  const dateInput = el('input', { type: 'date', class: 'field__input', value: date ?? '' });
  const timeInput = el('input', { type: 'time', class: 'field__input', value: time ?? '' });
  const notesInput = el('textarea', { class: 'field__input', rows: 3 });
  const taskFields = el('details', { class: 'more', open: Boolean(date || time) },
    el('summary', {}, 'Más detalles'),
    el('div', { class: 'more__body' },
      el('div', { class: 'field-row' },
        field('Fecha', dateInput),
        field('Hora', timeInput),
      ),
      field('Notas', notesInput),
    ),
  );

  // Campos de seguimiento (aparecen al elegir "Es un seguimiento")
  const nextActionInput = el('input', {
    type: 'text', class: 'field__input', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: 'Ej: consultar si aprueban la versión iluminada',
  });
  const dueDate = dueDatePicker({ value: date && date >= today ? date : addDays(today, 1) });
  const owner = ownerPicker();
  const followupFields = el('div', { class: 'form-group form-group--wide' },
    field('Próxima acción', nextActionInput),
    dueDate.element,
    owner.element,
  );
  followupFields.hidden = true;

  const whenChips = chipGroup({
    label: '¿Cuándo?',
    options: [
      ...Object.entries(store.BUCKET_LABELS).map(([value, label]) => ({ value, label })),
      { value: FOLLOWUP, label: 'Es un seguimiento' },
    ],
    value: draft.when,
    onChange: (value) => {
      draft.when = value;
      // Igual que al editar: "Hoy" pone la fecha de hoy; las otras borran una fecha de hoy o pasada.
      if (value === 'hoy') dateInput.value = today;
      else if (value !== FOLLOWUP && dateInput.value && dateInput.value <= today) dateInput.value = '';
      const isFollowup = value === FOLLOWUP;
      taskFields.hidden = isFollowup;
      followupFields.hidden = !isFollowup;
      titleInput.placeholder = isFollowup ? PLACEHOLDERS.followup : PLACEHOLDERS.task;
      sheet.element.querySelector('.sheet__title').textContent = isFollowup ? 'Nuevo seguimiento' : 'Nueva tarea';
    },
  });

  // Elegir una fecha acomoda "¿Cuándo?": hoy o pasada → Hoy; futura → Esta semana.
  dateInput.addEventListener('change', () => {
    if (!dateInput.value || draft.when === FOLLOWUP) return;
    draft.when = dateInput.value <= today ? 'hoy' : (draft.when === 'hoy' ? 'semana' : draft.when);
    whenChips.setValue(draft.when);
  });

  const form = el('form', { class: 'form', novalidate: true },
    field('¿Qué hay que hacer?', titleInput),
    whenChips.element,
    areaChips(draft.area, (value) => { draft.area = value; }).element,
    taskFields,
    followupFields,
    saveButton,
  );

  // El "Enter" del teclado envía el formulario.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    saveButton.disabled = true;

    let saved;
    let message;
    if (draft.when === FOLLOWUP) {
      saved = await tryAction(() => store.addFollowup({
        title,
        area: draft.area,
        nextAction: nextActionInput.value,
        dueDate: dueDate.value,
        owner: owner.owner,
        waitingFor: owner.waitingFor,
      }));
      message = 'Guardado en Seguimientos';
    } else {
      saved = await tryAction(() => store.addTask({
        title,
        area: draft.area,
        bucket: draft.when,
        dueDate: dateInput.value || null,
        time: timeInput.value || null,
        notes: notesInput.value,
      }));
      if (saved) highlightTask(saved.id);
      message = saved?.dueDate && saved.dueDate > today
        ? `Guardada para ${relativeDayLabel(saved.dueDate, today).toLowerCase()}`
        : `Guardada en ${store.BUCKET_LABELS[draft.when]}`;
    }
    if (!saved) {
      saveButton.disabled = false;
      return;
    }
    sheet.close();
    showToast(message);
    // Recordamos el área para la próxima vez (si falla no es grave).
    tryAction(() => store.setSetting('lastArea', draft.area));
  });

  const sheet = openSheet({ title: 'Nueva tarea', content: form, initialFocus: titleInput });
}

/** Día prellenado → "¿Cuándo?": sin día u hoy/pasado → Hoy; futuro → Esta semana. */
function bucketForDate(date, today) {
  return date && date > today ? 'semana' : 'hoy';
}
