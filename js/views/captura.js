// Captura rápida: cargar una tarea en menos de 5 segundos desde el botón "+".
import { el } from '../dom.js';
import * as store from '../store.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';
import { field, areaChips, bucketChips } from '../components/form.js';
import { highlightTask } from './hoy.js';

// Se llama directo desde el toque en "+" (así iOS abre el teclado al instante).
export function openQuickCapture() {
  const draft = {
    bucket: 'hoy',
    area: store.getSetting('lastArea') || 'otros',
  };

  const titleInput = el('input', {
    type: 'text',
    class: 'field__input field__input--big',
    placeholder: 'Ej: llamar a la gomería de Las Piedras',
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    required: true,
  });
  const timeInput = el('input', { type: 'time', class: 'field__input' });
  const notesInput = el('textarea', { class: 'field__input', rows: 3 });
  const saveButton = el('button', { class: 'btn-primary', type: 'submit', disabled: true }, 'Guardar');

  titleInput.addEventListener('input', () => {
    saveButton.disabled = titleInput.value.trim() === '';
  });

  const form = el('form', { class: 'form', novalidate: true },
    field('¿Qué hay que hacer?', titleInput),
    bucketChips(draft.bucket, (value) => { draft.bucket = value; }).element,
    areaChips(draft.area, (value) => { draft.area = value; }).element,
    el('details', { class: 'more' },
      el('summary', {}, 'Más detalles'),
      el('div', { class: 'more__body' },
        field('Hora', timeInput),
        field('Notas', notesInput),
      ),
    ),
    saveButton,
  );

  // El "Enter" del teclado envía el formulario (en el campo del título).
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    saveButton.disabled = true;
    const task = await tryAction(() => store.addTask({
      title,
      area: draft.area,
      bucket: draft.bucket,
      time: timeInput.value || null,
      notes: notesInput.value,
    }));
    if (!task) {
      saveButton.disabled = false;
      return;
    }
    highlightTask(task.id);
    sheet.close();
    showToast(`Guardada en ${store.BUCKET_LABELS[draft.bucket]}`);
    // Recordamos el área para la próxima vez (si falla no es grave).
    tryAction(() => store.setSetting('lastArea', draft.area));
  });

  const sheet = openSheet({ title: 'Nueva tarea', content: form, initialFocus: titleInput });
}
