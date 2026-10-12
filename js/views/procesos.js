// Pantalla "Procesos": checklists que se repiten (cierre de mes y los que agregues).
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, dateOf, formatShortDate } from '../dates.js';
import { currentPeriod, periodTitle, periodVariables, resolveText, resetLegend, closedLabel } from '../periods.js';
import { requestRender } from '../router.js';
import { chipGroup } from '../components/chips.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';
import { viewHeader, emptyState } from './common.js';
import { openTemplateEditor } from './template-editor.js';

const ANIMATION_MS = 1200;
let selectedTemplateId = null;
let toggledStepId = null;      // paso recién marcado (se anima el check)
let celebratingTemplateId = null; // plantilla recién terminada (se anima la tarjeta)

export function renderProcesos() {
  const today = todayISO();
  const templates = store.getTemplates();
  const header = viewHeader({ overline: 'Checklists que se repiten', title: 'Procesos' });

  if (templates.length === 0) {
    return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
      header,
      el('div', { class: 'card' }, emptyState('No tenés procesos todavía. Creá uno con el botón de abajo.', 'emptyList')),
      newTemplateButton(),
    );
  }

  const template = templates.find((t) => t.id === selectedTemplateId) ?? templates[0];
  // Si el checklist del período todavía no se creó (ej. cambió el mes con la app abierta),
  // mostramos uno vacío; se guarda de verdad al marcar el primer paso.
  const run = store.getCurrentRun(template, today)
    ?? { period: currentPeriod(template, today), checked: {}, completedAt: null };
  const variables = periodVariables(template, run.period);

  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    header,
    templates.length > 1 ? templatePicker(templates, template) : null,
    periodCard(template, run),
    template.groups.filter((g) => g.steps.length > 0).map((group) => groupSection(template, run, group, variables)),
    newTemplateButton(),
  );
}

function selectTemplate(id) {
  selectedTemplateId = id;
  requestRender();
}

function templatePicker(templates, selected) {
  return chipGroup({
    label: 'Proceso',
    options: templates.map((t) => ({ value: t.id, label: t.name })),
    value: selected.id,
    onChange: selectTemplate,
  }).element;
}

// ---------- Tarjeta del período actual ----------

function periodCard(template, run) {
  const { done, total } = store.runProgress(template, run);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const remaining = total - done;

  const bar = el('span', { class: 'progress__bar' });
  bar.style.width = `${percent}%`;

  const legend = run.completedAt
    ? el('p', { class: 'process-card__legend is-done' },
      `${closedLabel(template)} ✓ el ${formatShortDate(dateOf(run.completedAt))}`)
    : el('p', { class: 'process-card__legend' }, icon('refresh'), resetLegend(template));

  const classes = ['card', 'process-card'];
  if (celebratingTemplateId === template.id) classes.push('is-celebrating');

  return el('article', { class: classes.join(' ') },
    el('div', { class: 'process-card__top' },
      el('div', {},
        el('h2', { class: 'process-card__title' }, periodTitle(template, run.period)),
        el('p', { class: 'process-card__sub' },
          `${done} de ${total} pasos · ${remaining > 0 ? `faltan ${remaining}` : 'todo listo'}`),
      ),
      el('span', { class: 'process-card__percent' }, `${percent}%`),
    ),
    el('span', {
      class: 'progress progress--lg',
      role: 'progressbar',
      'aria-label': 'Avance del período',
      'aria-valuemin': '0',
      'aria-valuemax': String(total),
      'aria-valuenow': String(done),
    }, bar),
    legend,
    el('div', { class: 'process-card__actions' },
      el('button', {
        class: 'btn-secondary',
        type: 'button',
        onclick: () => openTemplateEditor(template, { onSaved: (saved) => selectTemplate(saved.id) }),
      }, icon('edit'), 'Editar'),
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => openHistory(template) },
        icon('history'), 'Ver historial'),
    ),
  );
}

// ---------- Grupos y pasos ----------

function groupSection(template, run, group, variables) {
  const doneInGroup = group.steps.filter((s) => run.checked[s.id]).length;
  const area = store.getArea(group.area);
  const title = el('h3', { class: 'group-title' }, group.name);
  title.style.color = area.color;

  return el('section', { class: 'section' },
    el('div', { class: 'section-head' },
      title,
      el('span', { class: 'section-aside' }, `${doneInGroup}/${group.steps.length}`),
    ),
    el('ul', { class: 'card card--list list' }, group.steps.map((step) => stepRow(template, run, step, variables))),
  );
}

function stepRow(template, run, step, variables) {
  const checked = Boolean(run.checked[step.id]);
  const box = el('span', { class: 'step-check__box' }, icon('check', 2.6));
  if (checked && step.id === toggledStepId) box.classList.add('is-popping');

  return el('li', {},
    el('button', {
      class: checked ? 'step-row is-done' : 'step-row',
      type: 'button',
      role: 'checkbox',
      'aria-checked': String(checked),
      onclick: () => toggleStep(template, step),
    },
      box,
      el('span', { class: 'step-row__text' },
        el('span', { class: 'step-row__title' }, resolveText(step.title, variables)),
        step.note
          ? el('span', { class: 'step-row__note' }, icon('info'), el('span', {}, resolveText(step.note, variables)))
          : null,
      ),
    ),
  );
}

async function toggleStep(template, step) {
  toggledStepId = step.id;
  setTimeout(() => { if (toggledStepId === step.id) toggledStepId = null; }, ANIMATION_MS);

  const result = await tryAction(() => store.toggleStep(template.id, step.id));
  if (!result?.justCompleted) return;

  // ¡Terminado! Celebración discreta.
  celebratingTemplateId = template.id;
  setTimeout(() => { if (celebratingTemplateId === template.id) celebratingTemplateId = null; }, ANIMATION_MS);
  requestRender();
  showToast(`¡${periodTitle(template, result.run.period)} terminado!`);
}

// ---------- Historial ----------

function openHistory(template) {
  const runs = store.getPastRuns(template);
  const content = runs.length > 0
    ? el('ul', { class: 'card card--list list' }, runs.map((run) => historyRow(template, run)))
    : el('div', { class: 'card' },
      emptyState('Todavía no hay períodos anteriores. Cuando empiece el próximo, este va a quedar acá.', 'emptyList'));

  openSheet({
    title: 'Historial',
    content: el('div', { class: 'form' }, el('p', { class: 'hint' }, template.name), content),
  });
}

function historyRow(template, run) {
  const { done, total } = store.runProgress(template, run);
  const days = store.runDuration(template, run);
  const detail = run.completedAt
    ? `Cerrado el ${formatShortDate(dateOf(run.completedAt))} · tardaste ${days} ${days === 1 ? 'día' : 'días'}`
    : `Quedó sin terminar · ${done} de ${total} pasos`;

  return el('li', { class: 'history-row' },
    el('span', { class: 'history-row__title' }, periodTitle(template, run.period)),
    el('span', { class: run.completedAt ? 'history-row__sub is-done' : 'history-row__sub' }, detail),
  );
}

// ---------- Nueva plantilla ----------

function newTemplateButton() {
  return el('button', {
    class: 'btn-secondary btn-add',
    type: 'button',
    onclick: () => openTemplateEditor(null, {
      onSaved: (saved) => {
        selectTemplate(saved.id);
        showToast('Plantilla creada');
      },
    }),
  }, icon('plus'), 'Nueva plantilla');
}

// Para el tile de Hoy: abrir Procesos mostrando el cierre de mes.
export function showClosingTemplate() {
  selectedTemplateId = 'cierre-de-mes';
}
