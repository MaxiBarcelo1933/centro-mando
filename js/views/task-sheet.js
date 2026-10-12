// Sheet para editar una tarea existente.
import { el } from '../dom.js';
import * as store from '../store.js';
import { todayISO } from '../dates.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';
import { field, areaChips, bucketChips } from '../components/form.js';

export function openTaskEditor(task) {
  const today = todayISO();
  const draft = { area: task.area, bucket: task.bucket };

  const titleInput = el('input', {
    type: 'text', class: 'field__input field__input--big', value: task.title,
    autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'done',
  });
  const dateInput = el('input', { type: 'date', class: 'field__input', value: task.dueDate ?? '' });
  const timeInput = el('input', { type: 'time', class: 'field__input', value: task.time ?? '' });
  const notesInput = el('textarea', { class: 'field__input', rows: 3 });
  notesInput.value = task.notes;
  const saveButton = el('button', { class: 'btn-primary', type: 'submit' }, 'Guardar cambios');

  titleInput.addEventListener('input', () => {
    saveButton.disabled = titleInput.value.trim() === '';
  });

  // "¿Cuándo?" y "Fecha" se acomodan entre sí:
  // - Hoy → la fecha pasa a hoy.
  // - Esta semana / Algún día → si la fecha era hoy o pasada, se borra.
  // - Elegir una fecha → hoy marca "Hoy"; una fecha futura marca "Esta semana".
  const whenChips = bucketChips(draft.bucket, (value) => {
    draft.bucket = value;
    if (value === 'hoy') dateInput.value = today;
    else if (dateInput.value && dateInput.value <= today) dateInput.value = '';
  });
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    draft.bucket = dateInput.value <= today ? 'hoy' : (draft.bucket === 'hoy' ? 'semana' : draft.bucket);
    whenChips.setValue(draft.bucket);
  });

  // Eliminar pide confirmación con un segundo toque.
  let confirmTimer = null;
  const deleteButton = el('button', { class: 'btn-danger', type: 'button' }, 'Eliminar tarea');
  deleteButton.addEventListener('click', async () => {
    if (!confirmTimer) {
      deleteButton.textContent = 'Tocá de nuevo para eliminar';
      deleteButton.classList.add('is-confirming');
      confirmTimer = setTimeout(() => {
        confirmTimer = null;
        deleteButton.textContent = 'Eliminar tarea';
        deleteButton.classList.remove('is-confirming');
      }, 3000);
      return;
    }
    clearTimeout(confirmTimer);
    const removed = await tryAction(() => store.deleteTask(task.id));
    if (!removed) return;
    sheet.close();
    showToast('Tarea eliminada', {
      actionLabel: 'Deshacer',
      onAction: () => tryAction(() => store.restoreTask(removed)),
    });
  });

  const form = el('form', { class: 'form', novalidate: true },
    field('Tarea', titleInput),
    areaChips(draft.area, (value) => { draft.area = value; }).element,
    whenChips.element,
    el('div', { class: 'field-row' },
      field('Fecha', dateInput),
      field('Hora', timeInput),
    ),
    field('Notas', notesInput),
    saveButton,
    deleteButton,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    const saved = await tryAction(() => store.updateTask(task.id, {
      title,
      area: draft.area,
      bucket: draft.bucket,
      dueDate: dateInput.value || null,
      time: timeInput.value || null,
      notes: notesInput.value.trim(),
    }));
    if (!saved) return;
    sheet.close();
    showToast('Tarea guardada');
  });

  const sheet = openSheet({ title: 'Editar tarea', content: form });
}
