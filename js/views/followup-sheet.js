// Detalle de un seguimiento (sheet): posponer, registrar avance, bitácora,
// editar datos, marcar resuelto y eliminar.
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, dateOf, addDays, nextMonday, formatShortDate, formatWeekdayDay } from '../dates.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';
import { field, areaChips, areaTag } from '../components/form.js';
import { dueDatePicker, ownerPicker, duePill, ownerPill } from '../components/followup-bits.js';

export function openFollowupDetail(id) {
  const sheet = openSheet({ title: 'Seguimiento', content: build() });

  // Después de cada acción redibujamos el contenido con los datos nuevos.
  function refresh() {
    if (!store.getFollowup(id)) {
      sheet.close();
      return;
    }
    sheet.body.replaceChildren(build());
  }

  function build() {
    const followup = store.getFollowup(id);
    const today = todayISO();
    const isOpen = followup.status === 'open';

    return el('div', { class: 'form' },
      summaryCard(followup, today),
      isOpen ? postponeSection(followup, today) : resolvedSection(followup),
      isOpen ? progressSection(followup, today) : null,
      logSection(followup),
      editSection(followup),
      isOpen
        ? el('button', { class: 'btn-primary', type: 'button', onclick: () => resolve(followup) },
          'Marcar resuelto')
        : null,
      deleteButton(followup),
    );
  }

  // ---------- Resumen ----------

  function summaryCard(followup, today) {
    const overdue = store.isFollowupOverdue(followup, today);
    return el('div', { class: overdue ? 'fu-card is-overdue' : 'fu-card' },
      el('div', { class: 'fu-card__main' },
        el('div', { class: 'fu-card__top' },
          el('div', { class: 'fu-card__heading' },
            el('h3', { class: 'fu-card__title' }, followup.title),
            areaTag(followup.area),
          ),
          duePill(followup, today),
        ),
        followup.nextAction
          ? el('p', { class: 'fu-card__next' }, icon('arrow'), el('span', {}, followup.nextAction))
          : null,
      ),
      el('div', { class: 'fu-card__footer' }, ownerPill(followup)),
    );
  }

  // ---------- Posponer rápido ----------

  function postponeSection(followup, today) {
    // Se cuenta desde la fecha límite, o desde hoy si ya venció.
    const base = followup.dueDate > today ? followup.dueDate : today;
    const options = [
      { label: '+1 día', date: addDays(base, 1) },
      { label: '+3 días', date: addDays(base, 3) },
      { label: 'Próximo lunes', date: nextMonday(today) },
    ];
    return section('Posponer',
      el('div', { class: 'chips' }, options.map((option) =>
        el('button', { class: 'chip', type: 'button', onclick: () => postpone(followup, option.date) }, option.label))),
    );
  }

  async function postpone(followup, date) {
    const snapshot = structuredClone(followup);
    const label = `Pospuesto para el ${formatWeekdayDay(date)}`;
    const saved = await tryAction(() => store.postponeFollowup(followup.id, date, label));
    if (!saved) return;
    refresh();
    showToast(label, {
      actionLabel: 'Deshacer',
      onAction: async () => {
        await tryAction(() => store.restoreFollowup(snapshot));
        refresh();
      },
    });
  }

  // ---------- Registrar avance ----------

  function progressSection(followup, today) {
    const textInput = el('textarea', { class: 'field__input', rows: 2, placeholder: 'Ej: Llamé, quedaron en mandar la firma el jueves' });
    const nextInput = el('input', { type: 'text', class: 'field__input', value: followup.nextAction, autocomplete: 'off' });
    const date = dueDatePicker({
      value: followup.dueDate > today ? followup.dueDate : addDays(today, 1),
      label: 'Nueva fecha',
    });
    const button = el('button', { class: 'btn-secondary', type: 'button', disabled: true }, icon('plus'), 'Registrar avance');
    textInput.addEventListener('input', () => { button.disabled = textInput.value.trim() === ''; });

    button.addEventListener('click', async () => {
      const text = textInput.value.trim();
      if (!text) return;
      const saved = await tryAction(() => store.logFollowupProgress(followup.id, {
        text,
        nextAction: nextInput.value,
        dueDate: date.value,
      }));
      if (!saved) return;
      refresh();
      showToast('Avance registrado');
    });

    return section('Registrar avance',
      field('¿Qué pasó?', textInput),
      field('Nueva próxima acción', nextInput),
      date.element,
      button,
    );
  }

  // ---------- Resuelto ----------

  function resolvedSection(followup) {
    return el('div', { class: 'resolved-banner' },
      el('span', {}, `Resuelto el ${formatShortDate(dateOf(followup.resolvedAt))}`),
      el('button', {
        class: 'btn-secondary',
        type: 'button',
        onclick: async () => {
          const saved = await tryAction(() => store.reopenFollowup(followup.id));
          if (!saved) return;
          refresh();
          showToast('Seguimiento reabierto');
        },
      }, 'Reabrir'),
    );
  }

  async function resolve(followup) {
    const snapshot = structuredClone(followup);
    const saved = await tryAction(() => store.resolveFollowup(followup.id));
    if (!saved) return;
    sheet.close();
    showToast('Seguimiento resuelto', {
      actionLabel: 'Deshacer',
      onAction: () => tryAction(() => store.restoreFollowup(snapshot)),
    });
  }

  // ---------- Bitácora ----------

  function logSection(followup) {
    if (followup.history.length === 0) {
      return section('Bitácora', el('p', { class: 'hint' }, 'Todavía no registraste avances.'));
    }
    const entries = [...followup.history].reverse(); // lo más nuevo arriba
    return section('Bitácora',
      el('ol', { class: 'log-list' }, entries.map((entry) =>
        el('li', { class: 'log-row' },
          el('span', { class: 'log-row__date' }, formatShortDate(dateOf(entry.date))),
          el('span', { class: 'log-row__text' }, entry.text),
        ))),
    );
  }

  // ---------- Editar datos ----------

  function editSection(followup) {
    let area = followup.area;
    const titleInput = el('input', { type: 'text', class: 'field__input', value: followup.title, autocomplete: 'off' });
    const nextInput = el('input', { type: 'text', class: 'field__input', value: followup.nextAction, autocomplete: 'off' });
    const date = dueDatePicker({ value: followup.dueDate });
    const owner = ownerPicker({ owner: followup.owner, waitingFor: followup.waitingFor });

    const save = el('button', { class: 'btn-secondary', type: 'button' }, 'Guardar cambios');
    save.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      if (!title) {
        showToast('El seguimiento necesita un título');
        return;
      }
      const saved = await tryAction(() => store.updateFollowup(followup.id, {
        title,
        area,
        nextAction: nextInput.value.trim(),
        dueDate: date.value,
        owner: owner.owner,
        waitingFor: owner.waitingFor.trim(),
      }));
      if (!saved) return;
      refresh();
      showToast('Cambios guardados');
    });

    return el('details', { class: 'more' },
      el('summary', {}, 'Editar datos'),
      el('div', { class: 'more__body' },
        field('Título', titleInput),
        areaChips(area, (value) => { area = value; }).element,
        field('Próxima acción', nextInput),
        date.element,
        owner.element,
        save,
      ),
    );
  }

  // ---------- Eliminar ----------

  function deleteButton(followup) {
    let confirmTimer = null;
    const button = el('button', { class: 'btn-danger', type: 'button' }, 'Eliminar seguimiento');
    button.addEventListener('click', async () => {
      if (!confirmTimer) {
        button.textContent = 'Tocá de nuevo para eliminar';
        button.classList.add('is-confirming');
        confirmTimer = setTimeout(() => {
          confirmTimer = null;
          button.textContent = 'Eliminar seguimiento';
          button.classList.remove('is-confirming');
        }, 3000);
        return;
      }
      clearTimeout(confirmTimer);
      const removed = await tryAction(() => store.deleteFollowup(followup.id));
      if (!removed) return;
      sheet.close();
      showToast('Seguimiento eliminado', {
        actionLabel: 'Deshacer',
        onAction: () => tryAction(() => store.restoreFollowup(removed)),
      });
    });
    return button;
  }
}

function section(title, ...children) {
  return el('section', { class: 'sheet-section' },
    el('h3', { class: 'sheet-section__title' }, title),
    ...children,
  );
}
