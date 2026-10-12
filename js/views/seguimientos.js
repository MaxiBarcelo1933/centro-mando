// Pantalla "Seguimientos": lo que no se puede perder (cotizaciones, permisos, consultas…).
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, dateOf, formatShortDate } from '../dates.js';
import { ui, requestRender } from '../router.js';
import { chipGroup } from '../components/chips.js';
import { showToast, tryAction } from '../components/toast.js';
import { areaTag } from '../components/form.js';
import { duePill, ownerPill } from '../components/followup-bits.js';
import { viewHeader, emptyState } from './common.js';
import { openFollowupDetail } from './followup-sheet.js';

const EMPTY_TEXTS = {
  todos: 'No tenés seguimientos abiertos. Tocá + y elegí "Es un seguimiento".',
  vencidos: 'No hay nada vencido. ¡Bien ahí!',
  me: 'No hay nada que te toque a vos ahora.',
  esperando: 'No estás esperando a nadie.',
};

const fold = { resolved: false };

export function renderSeguimientos() {
  const today = todayISO();
  const filter = Object.hasOwn(store.FOLLOWUP_FILTERS, ui.followupFilter) ? ui.followupFilter : 'todos';
  const counts = store.countFollowupsByFilter(today);
  const items = store.getOpenFollowups(filter, today);

  const filters = chipGroup({
    label: 'Filtrar seguimientos',
    hideLabel: true,
    options: Object.entries(store.FOLLOWUP_FILTERS).map(([key, f]) => ({
      value: key,
      label: [f.label, el('span', { class: 'chip__count' }, String(counts[key]))],
    })),
    value: filter,
    onChange: (value) => {
      ui.followupFilter = value;
      requestRender();
    },
  });

  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: 'Lo que no se puede perder', title: 'Seguimientos' }),
    filters.element,
    items.length > 0
      ? el('ul', { class: 'fu-list' }, items.map((f) => el('li', {}, followupCard(f, today))))
      : el('div', { class: 'card' }, emptyState(EMPTY_TEXTS[filter], 'emptyList')),
    resolvedSection(),
  );
}

function followupCard(followup, today) {
  const overdue = store.isFollowupOverdue(followup, today);
  return el('article', { class: overdue ? 'fu-card is-overdue' : 'fu-card' },
    el('button', { class: 'fu-card__main', type: 'button', onclick: () => openFollowupDetail(followup.id) },
      el('span', { class: 'fu-card__top' },
        el('span', { class: 'fu-card__heading' },
          el('span', { class: 'fu-card__title' }, followup.title),
          areaTag(followup.area),
        ),
        duePill(followup, today),
      ),
      followup.nextAction
        ? el('span', { class: 'fu-card__next' }, icon('arrow'), el('span', {}, followup.nextAction))
        : null,
    ),
    el('div', { class: 'fu-card__footer' },
      ownerPill(followup),
      el('button', { class: 'fu-resolve', type: 'button', onclick: () => resolve(followup) },
        icon('check', 2.2), 'Marcar resuelto'),
    ),
  );
}

async function resolve(followup) {
  const snapshot = structuredClone(followup);
  const saved = await tryAction(() => store.resolveFollowup(followup.id));
  if (!saved) return;
  showToast('Seguimiento resuelto', {
    actionLabel: 'Deshacer',
    onAction: () => tryAction(() => store.restoreFollowup(snapshot)),
  });
}

// "Resueltos": plegado al final, para consultar el historial.
function resolvedSection() {
  const resolved = store.getResolvedFollowups();
  if (resolved.length === 0) return null;

  const details = el('details', { class: 'section fold', open: fold.resolved },
    el('summary', { class: 'section-head fold__summary' },
      el('h2', { class: 'section-title' }, 'Resueltos'),
      el('span', { class: 'section-aside' }, String(resolved.length)),
      el('span', { class: 'fold__chevron' }, icon('chevron')),
    ),
    el('ul', { class: 'card card--list list' }, resolved.map((f) =>
      el('li', {},
        el('button', { class: 'followup-row', type: 'button', onclick: () => openFollowupDetail(f.id) },
          el('span', { class: 'followup-row__text' },
            el('span', { class: 'followup-row__title is-resolved' }, f.title),
            el('span', { class: 'followup-row__sub' }, `Resuelto el ${formatShortDate(dateOf(f.resolvedAt))}`),
          ),
          areaTag(f.area),
        ),
      ))),
  );
  details.addEventListener('toggle', () => { fold.resolved = details.open; });
  return details;
}
