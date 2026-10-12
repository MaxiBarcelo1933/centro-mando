// Pantalla "Hoy": resumen, tareas para hoy, seguimientos donde espero a alguien,
// "Esta semana" y "Algún día".
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, formatLongDate, relativeDayLabel, overdueSinceLabel } from '../dates.js';
import { navigate } from '../router.js';
import { showToast, tryAction } from '../components/toast.js';
import { areaTag } from '../components/form.js';
import { viewHeader, emptyState } from './common.js';
import { openTaskEditor } from './task-sheet.js';

// Estado de pantalla que sobrevive a los re-render.
const fold = { week: true, someday: false };
let newTaskId = null;     // tarea recién cargada (se anima al aparecer)
let toggledTaskId = null; // tarea recién marcada (se anima el check)

const ANIMATION_MS = 700;

/** La captura rápida avisa qué tarea es nueva para animarla. */
export function highlightTask(id) {
  newTaskId = id;
  setTimeout(() => { if (newTaskId === id) newTaskId = null; }, ANIMATION_MS);
}

function markToggled(id) {
  toggledTaskId = id;
  setTimeout(() => { if (toggledTaskId === id) toggledTaskId = null; }, ANIMATION_MS);
}

export function renderHoy() {
  const today = todayISO();
  const todayTasks = store.getTodayTasks(today);
  const doneCount = todayTasks.filter((t) => t.done).length;

  const avatar = el('button', {
    class: 'avatar',
    type: 'button',
    'aria-label': 'Abrir ajustes',
    onclick: () => showToast('Los ajustes llegan en la Fase 5'),
  }, 'MB');

  const view = el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: formatLongDate(today), title: 'Hoy', trailing: avatar }),
    summaryTiles(today),
    el('section', { class: 'section' },
      el('div', { class: 'section-head' },
        el('h2', { class: 'section-title' }, 'Para hoy'),
        doneCount > 0 ? el('span', { class: 'section-aside' }, `${doneCount} ${doneCount === 1 ? 'hecha' : 'hechas'}`) : null,
      ),
      todayTasks.length > 0
        ? el('ul', { class: 'card card--list list' }, todayTasks.map((t) => taskRow(t, today)))
        : el('div', { class: 'card' }, emptyState('Nada pendiente para hoy. Tocá + para cargar algo.')),
    ),
    waitingSection(today),
    foldSection('week', 'Esta semana', store.getWeekTasks(today), today),
    foldSection('someday', 'Algún día', store.getSomedayTasks(today), today),
  );
  return view;
}

// ---------- Tiles de resumen ----------

function summaryTiles(today) {
  const pending = store.countPendingToday(today);
  const overdue = store.countOverdueFollowups(today);
  const closing = store.getClosingProgress();

  const closingValue = closing ? `${closing.done}/${closing.total}` : '—';
  const closingPercent = closing && closing.total ? (closing.done / closing.total) * 100 : 0;
  const bar = el('span', { class: 'progress__bar' });
  bar.style.width = `${closingPercent}%`;

  return el('div', { class: 'tiles' },
    el('div', { class: 'tile' },
      el('span', { class: 'tile__value' }, String(pending)),
      el('span', { class: 'tile__label' }, 'Pendientes hoy'),
    ),
    el('button', {
      class: 'tile',
      type: 'button',
      onclick: () => navigate('seguimientos', { followupFilter: 'vencidos' }),
    },
      el('span', { class: overdue > 0 ? 'tile__value tile__value--danger' : 'tile__value' }, String(overdue)),
      el('span', { class: 'tile__label' }, overdue === 1 ? 'Seguimiento vencido' : 'Seguimientos vencidos'),
    ),
    el('button', { class: 'tile', type: 'button', onclick: () => navigate('procesos') },
      el('span', { class: 'tile__value' }, closingValue),
      el('span', { class: 'tile__label' }, 'Cierre de mes'),
      el('span', { class: 'progress', 'aria-hidden': 'true' }, bar),
    ),
  );
}

// ---------- Fila de tarea ----------

function taskRow(task, today, { showMoveToToday = false } = {}) {
  const overdue = store.isTaskOverdue(task, today);
  const classes = ['task-row'];
  if (task.done) classes.push('is-done');
  if (task.id === newTaskId) classes.push('is-new');

  const box = el('span', { class: 'check__box' }, icon('check', 2.6));
  if (task.id === toggledTaskId && task.done) box.classList.add('is-popping');

  const check = el('button', {
    class: 'check',
    type: 'button',
    role: 'checkbox',
    'aria-checked': String(task.done),
    'aria-label': `Completar: ${task.title}`,
    onclick: () => toggleTask(task),
  }, box);

  // Fecha futura: la mostramos en "Esta semana" ("Mañana", "Jue 15"…).
  const showDate = !task.done && task.dueDate && task.dueDate > today;

  const main = el('button', { class: 'task-row__main', type: 'button', onclick: () => openTaskEditor(task) },
    el('span', { class: 'task-row__text' },
      el('span', { class: 'task-row__title' }, task.title),
      el('span', { class: 'task-row__meta' },
        overdue ? el('span', { class: 'tag tag--danger' }, `Atrasada · ${overdueSinceLabel(task.dueDate, today)}`) : null,
        areaTag(task.area),
        showDate ? el('span', { class: 'tag tag--muted' }, relativeDayLabel(task.dueDate, today)) : null,
      ),
    ),
    task.time ? el('span', { class: 'task-row__time' }, task.time) : null,
  );

  const moveButton = showMoveToToday && !task.done
    ? el('button', {
      class: 'row-action',
      type: 'button',
      onclick: () => moveToToday(task),
    }, 'Pasar a hoy')
    : null;

  return el('li', { class: classes.join(' ') }, check, main, moveButton);
}

async function toggleTask(task) {
  const previous = { done: task.done, doneAt: task.doneAt };
  markToggled(task.id);
  const saved = await tryAction(() => store.setTaskDone(task.id, !task.done));
  if (!saved) return;
  showToast(saved.done ? 'Tarea completada' : 'Tarea desmarcada', {
    actionLabel: 'Deshacer',
    onAction: () => tryAction(() => store.updateTask(task.id, previous)),
  });
}

async function moveToToday(task) {
  const previous = { bucket: task.bucket, dueDate: task.dueDate };
  highlightTask(task.id);
  const saved = await tryAction(() => store.moveTaskToToday(task.id));
  if (!saved) return;
  showToast('Pasada a hoy', {
    actionLabel: 'Deshacer',
    onAction: () => tryAction(() => store.updateTask(task.id, previous)),
  });
}

// ---------- Esperando a alguien ----------

function waitingSection(today) {
  const items = store.getWaitingSoon(today);
  if (items.length === 0) return null;

  return el('section', { class: 'section' },
    el('div', { class: 'section-head' }, el('h2', { class: 'section-title' }, 'Esperando a alguien')),
    el('ul', { class: 'card card--list list' }, items.map((f) => {
      const overdue = store.isFollowupOverdue(f, today);
      const dateClass = overdue ? 'date-pill date-pill--danger' : (f.dueDate === today ? 'date-pill date-pill--today' : 'date-pill');
      return el('li', {},
        el('button', {
          class: 'followup-row',
          type: 'button',
          onclick: () => showToast('El detalle de seguimientos llega en la Fase 4'),
        },
          el('span', { class: 'followup-row__text' },
            el('span', { class: 'followup-row__title' }, f.title),
            el('span', { class: 'followup-row__sub' }, f.nextAction),
          ),
          el('span', { class: dateClass }, relativeDayLabel(f.dueDate, today)),
        ),
      );
    })),
  );
}

// ---------- Secciones plegables (Esta semana / Algún día) ----------

function foldSection(key, title, tasks, today) {
  if (tasks.length === 0) return null;
  const details = el('details', { class: 'section fold', open: fold[key] },
    el('summary', { class: 'section-head fold__summary' },
      el('h2', { class: 'section-title' }, title),
      el('span', { class: 'section-aside' }, String(tasks.length)),
      el('span', { class: 'fold__chevron' }, icon('chevron')),
    ),
    el('ul', { class: 'card card--list list' }, tasks.map((t) => taskRow(t, today, { showMoveToToday: true }))),
  );
  details.addEventListener('toggle', () => { fold[key] = details.open; });
  return details;
}
