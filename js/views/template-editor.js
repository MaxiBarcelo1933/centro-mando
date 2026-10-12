// Editor de plantillas de procesos: nombre, frecuencia, grupos y pasos.
// Se trabaja sobre una copia ("borrador"); recién al tocar Guardar se guarda.
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { chipGroup } from '../components/chips.js';
import { field, autoGrowInput } from '../components/form.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';

const emptyStep = () => ({ id: store.newStepId(), title: '', note: '' });
const emptyGroup = () => ({ name: '', area: 'otros', steps: [emptyStep()] });

/** openTemplateEditor(plantilla) para editar, o openTemplateEditor(null) para crear una nueva. */
export function openTemplateEditor(template, { onSaved = null } = {}) {
  const isNew = !template;
  const draft = isNew
    ? { name: '', frequency: 'monthly', periodOffset: 0, groups: [emptyGroup()] }
    : structuredClone(template);

  const nameInput = el('input', {
    type: 'text', class: 'field__input field__input--big', value: draft.name,
    placeholder: 'Ej: Cierre de mes', autocomplete: 'off', autocapitalize: 'sentences',
  });
  nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

  const offsetChips = chipGroup({
    label: '¿Qué mes se trabaja?',
    options: [
      { value: '-1', label: 'El mes anterior (cierre)' },
      { value: '0', label: 'El mes en curso' },
    ],
    value: String(draft.periodOffset),
    onChange: (value) => { draft.periodOffset = Number(value); },
  });
  offsetChips.element.hidden = draft.frequency !== 'monthly';

  const frequencyChips = chipGroup({
    label: '¿Cada cuánto se repite?',
    options: [
      { value: 'monthly', label: 'Todos los meses' },
      { value: 'weekly', label: 'Todas las semanas' },
    ],
    value: draft.frequency,
    onChange: (value) => {
      draft.frequency = value;
      if (value === 'weekly') draft.periodOffset = 0;
      offsetChips.setValue(String(draft.periodOffset));
      offsetChips.element.hidden = value !== 'monthly';
    },
  });

  // ---------- Grupos y pasos (se redibujan al agregar, mover o borrar) ----------

  const groupsRoot = el('div', { class: 'editor-groups' });

  function renderGroups(focusId = null) {
    groupsRoot.replaceChildren(
      ...draft.groups.map((group, index) => groupEditor(group, index)),
      el('button', {
        class: 'btn-secondary btn-add',
        type: 'button',
        onclick: () => {
          const group = emptyGroup();
          draft.groups.push(group);
          renderGroups(`group-${draft.groups.length - 1}`);
        },
      }, icon('plus'), 'Agregar grupo'),
    );
    if (focusId) groupsRoot.querySelector(`[data-focus="${focusId}"]`)?.focus();
  }

  function move(list, index, delta, focusId) {
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    renderGroups(focusId);
  }

  function groupEditor(group, groupIndex) {
    const nameField = el('input', {
      type: 'text', class: 'field__input', value: group.name, placeholder: 'Ej: Meta Premiada',
      autocomplete: 'off', 'data-focus': `group-${groupIndex}`,
    });
    nameField.addEventListener('input', () => { group.name = nameField.value; });

    const areaSelect = el('select', { class: 'field__input' },
      store.getAreas({ includeHidden: true }).map((area) =>
        el('option', { value: area.id, selected: area.id === group.area }, area.name)),
    );
    areaSelect.addEventListener('change', () => { group.area = areaSelect.value; });

    const last = draft.groups.length - 1;
    return el('div', { class: 'editor-group' },
      el('div', { class: 'editor-row' },
        field(`Grupo ${groupIndex + 1}`, nameField),
        el('div', { class: 'editor-row__buttons' },
          iconButton('up', 'Subir grupo', groupIndex === 0, () => move(draft.groups, groupIndex, -1)),
          iconButton('down', 'Bajar grupo', groupIndex === last, () => move(draft.groups, groupIndex, 1)),
          iconButton('trash', 'Eliminar grupo', false, () => {
            draft.groups.splice(groupIndex, 1);
            renderGroups();
          }),
        ),
      ),
      field('Área', areaSelect),
      el('ol', { class: 'editor-steps' }, group.steps.map((step, i) => stepEditor(group, step, i))),
      el('button', {
        class: 'btn-text',
        type: 'button',
        onclick: () => {
          const step = emptyStep();
          group.steps.push(step);
          renderGroups(step.id);
        },
      }, icon('plus'), 'Agregar paso'),
    );
  }

  function stepEditor(group, step, index) {
    const titleInput = autoGrowInput({
      placeholder: 'Qué hay que hacer', autocapitalize: 'sentences',
      'aria-label': `Paso ${index + 1}`, 'data-focus': step.id,
    }, step.title, (value) => { step.title = value; });
    const noteInput = autoGrowInput({
      class: 'field__input field__input--auto field__input--note',
      placeholder: 'Nota o trampa a recordar (opcional)', 'aria-label': `Nota del paso ${index + 1}`,
    }, step.note, (value) => { step.note = value; });

    const last = group.steps.length - 1;
    return el('li', { class: 'editor-step' },
      el('div', { class: 'editor-row' },
        titleInput,
        el('div', { class: 'editor-row__buttons' },
          iconButton('up', `Subir paso ${index + 1}`, index === 0, () => move(group.steps, index, -1, step.id)),
          iconButton('down', `Bajar paso ${index + 1}`, index === last, () => move(group.steps, index, 1, step.id)),
          iconButton('trash', `Eliminar paso ${index + 1}`, false, () => {
            group.steps.splice(index, 1);
            renderGroups();
          }),
        ),
      ),
      noteInput,
    );
  }

  renderGroups();

  // ---------- Guardar y eliminar ----------

  const saveButton = el('button', { class: 'btn-primary', type: 'button', onclick: save }, 'Guardar plantilla');

  async function save() {
    const name = draft.name.trim();
    if (!name) {
      showToast('Ponele un nombre a la plantilla');
      nameInput.focus();
      return;
    }
    // Limpiamos pasos vacíos y grupos que quedaron sin pasos.
    const groups = draft.groups
      .map((g) => ({
        name: g.name.trim() || 'General',
        area: g.area,
        steps: g.steps
          .map((s) => ({ id: s.id, title: s.title.trim(), note: s.note.trim() }))
          .filter((s) => s.title),
      }))
      .filter((g) => g.steps.length > 0);
    if (groups.length === 0) {
      showToast('Agregá al menos un paso');
      return;
    }
    const saved = await tryAction(() => store.saveTemplate({ ...draft, name, groups }));
    if (!saved) return;
    sheet.close();
    if (!isNew) showToast('Plantilla guardada');
    onSaved?.(saved);
  }

  let deleteButton = null;
  if (!isNew) {
    let confirmTimer = null;
    deleteButton = el('button', { class: 'btn-danger', type: 'button' }, 'Eliminar plantilla');
    deleteButton.addEventListener('click', async () => {
      if (!confirmTimer) {
        deleteButton.textContent = 'Tocá de nuevo para eliminar';
        deleteButton.classList.add('is-confirming');
        confirmTimer = setTimeout(() => {
          confirmTimer = null;
          deleteButton.textContent = 'Eliminar plantilla';
          deleteButton.classList.remove('is-confirming');
        }, 3000);
        return;
      }
      clearTimeout(confirmTimer);
      const removed = await tryAction(() => store.deleteTemplate(template.id));
      if (!removed) return;
      sheet.close();
      showToast('Plantilla eliminada', {
        actionLabel: 'Deshacer',
        onAction: () => tryAction(() => store.restoreTemplate(removed)),
      });
    });
  }

  const content = el('div', { class: 'form' },
    field('Nombre', nameInput),
    frequencyChips.element,
    offsetChips.element,
    el('p', { class: 'hint' },
      'En títulos y notas podés usar {MES_CIERRE}, {MES_ACTUAL} y {MES_CORTE}: se reemplazan solos por el mes que corresponda. ',
      'Los cambios no borran lo que ya marcaste.'),
    groupsRoot,
    saveButton,
    deleteButton,
  );

  const sheet = openSheet({ title: isNew ? 'Nueva plantilla' : 'Editar plantilla', content });
}

function iconButton(name, label, disabled, onClick) {
  return el('button', { class: 'icon-btn', type: 'button', 'aria-label': label, disabled, onclick: onClick }, icon(name));
}
