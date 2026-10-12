// Pantalla "Proyectos": el proyecto prioritario (hoy, "Estandarización 37 PDV estratégicos").
// Arriba los números (instalados, faltan, inversión); abajo la lista de PDV con vistas por chips.
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, relativeDayLabel } from '../dates.js';
import { ui, requestRender } from '../router.js';
import { chipGroup } from '../components/chips.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';
import { field } from '../components/form.js';
import { viewHeader, emptyState, formatNumber, formatUSD, formatPesos, parseDecimal } from './common.js';
import { openPdvDetail, statusPill } from './pdv-sheet.js';

// Vistas de la lista. "group" agrupa por ese campo; "missingOnly" muestra solo los que faltan.
const PROJECT_VIEWS = {
  faltan: { label: 'Faltan' },
  todos: { label: 'Todos' },
  estado: { label: 'Por estado', group: 'status' },
  departamento: { label: 'Por departamento', group: 'department', missingOnly: true },
  proveedor: { label: 'Por proveedor', group: 'supplier', missingOnly: true },
  sinfecha: { label: 'Sin fecha', missingOnly: true, test: (p) => !p.nextDate },
};

const STATUS_ORDER = ['PENDIENTE', 'RELEVADO', 'CAMBIO', 'INSTALADO', 'REEMPLAZADO'];

export function renderProyectos() {
  const today = todayISO();
  const project = store.getPriorityProject();
  if (!project) {
    return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
      viewHeader({ overline: 'Lo prioritario', title: 'Proyectos' }),
      el('div', { class: 'card' }, emptyState('Todavía no hay proyectos. Cargalos desde Ajustes → Datos de trabajo.', 'emptyList')),
    );
  }

  const stats = store.getProjectStats(project.id);
  const view = Object.hasOwn(PROJECT_VIEWS, ui.projectView) ? ui.projectView : 'faltan';

  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: `Prioridad #${project.priority}`, title: 'Proyectos' }),
    el('h2', { class: 'project-name' }, project.name),
    progressCard(stats),
    moneyCard(project, stats),
    viewChips(project, view, today),
    pdvList(project, view, today),
  );
}

// ---------- Números ----------

function progressCard(stats) {
  const bar = el('span', { class: 'progress__bar' });
  bar.style.width = `${Math.min(100, stats.percent)}%`;
  const parts = [
    [stats.byStatus.PENDIENTE, 'pendiente', 'pendientes'],
    [stats.byStatus.RELEVADO, 'relevado', 'relevados'],
    [stats.byStatus.CAMBIO, 'cambio', 'cambio'],
  ].filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);

  return el('div', { class: 'card kpi-card' },
    el('div', { class: 'kpi-card__top' },
      el('span', { class: 'kpi-card__big' }, `${stats.installed}`, el('span', { class: 'kpi-card__of' }, `/${stats.goal}`)),
      el('span', { class: 'kpi-card__label' }, `instalados · ${stats.percent}%`),
    ),
    el('span', { class: 'progress progress--lg', 'aria-hidden': 'true' }, bar),
    el('p', { class: 'kpi-card__sub' },
      el('strong', {}, `Faltan ${stats.missing}`),
      parts.length > 0 ? `: ${parts.join(' · ')}` : null),
  );
}

function moneyCard(project, stats) {
  const rate = project.usdRate;
  const row = (label, usd, strong = false) => el('div', { class: strong ? 'money-row is-total' : 'money-row' },
    el('span', { class: 'money-row__label' }, label),
    el('span', { class: 'money-row__values' },
      el('span', { class: 'money-row__usd' }, formatUSD(usd)),
      el('span', { class: 'money-row__uyu' }, formatPesos(usd * rate)),
    ),
  );
  return el('div', { class: 'card money-card' },
    row('Inversión instalada', stats.installedUSD),
    row('Inversión pendiente', stats.pendingUSD),
    row('Total', stats.totalUSD, true),
    el('button', { class: 'btn-text money-card__rate', type: 'button', onclick: () => editRate(project) },
      `Dólar a $ ${formatNumber(rate)} · Cambiar`),
  );
}

function editRate(project) {
  const input = el('input', {
    type: 'text', inputmode: 'decimal', class: 'field__input field__input--big',
    value: formatNumber(project.usdRate), autocomplete: 'off', enterkeyhint: 'done',
  });
  const save = el('button', { class: 'btn-primary', type: 'submit' }, 'Guardar');
  const form = el('form', { class: 'form', novalidate: true },
    field('Pesos por dólar', input),
    el('p', { class: 'hint' }, 'Se usa para mostrar la inversión en pesos y en el Excel.'),
    save,
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = parseDecimal(input.value);
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Escribí un número, por ejemplo 40,50');
      return;
    }
    const saved = await tryAction(() => store.updateProject(project.id, { usdRate: value }));
    if (!saved) return;
    sheet.close();
    showToast('Cotización actualizada');
  });
  const sheet = openSheet({ title: 'Cotización del dólar', content: form, initialFocus: input });
}

// ---------- Vistas y lista ----------

function viewChips(project, current, today) {
  const missing = store.getProjectPdvs(project.id).filter(store.isPdvMissing);
  const counts = {
    faltan: missing.length,
    todos: store.getProjectPdvs(project.id).length,
    sinfecha: missing.filter((p) => !p.nextDate).length,
  };
  return chipGroup({
    label: 'Ver PDV',
    hideLabel: true,
    options: Object.entries(PROJECT_VIEWS).map(([key, v]) => ({
      value: key,
      label: key in counts ? [v.label, el('span', { class: 'chip__count' }, String(counts[key]))] : v.label,
    })),
    value: current,
    onChange: (value) => {
      ui.projectView = value;
      requestRender();
    },
  }).element;
}

function pdvList(project, viewKey, today) {
  const view = PROJECT_VIEWS[viewKey];
  let pdvs = store.getProjectPdvs(project.id, { includeReplaced: viewKey === 'estado' });
  if (viewKey === 'faltan' || view.missingOnly) pdvs = pdvs.filter(store.isPdvMissing);
  if (view.test) pdvs = pdvs.filter(view.test);
  pdvs.sort(comparePdvs(today));

  if (pdvs.length === 0) {
    const text = viewKey === 'sinfecha' ? 'Todos los que faltan tienen próxima fecha. ¡Bien!' : 'No hay PDV para mostrar.';
    return el('div', { class: 'card' }, emptyState(text, 'emptyList'));
  }

  if (!view.group) return el('ul', { class: 'card card--list list' }, pdvs.map((p) => pdvRow(p, today)));

  // Agrupado: un bloque por estado / departamento / proveedor.
  const groups = new Map();
  for (const pdv of pdvs) {
    const key = pdv[view.group] || 'Sin dato';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pdv);
  }
  const keys = [...groups.keys()].sort((a, b) => (view.group === 'status'
    ? STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)
    : groups.get(b).length - groups.get(a).length || a.localeCompare(b)));

  return el('div', { class: 'pdv-groups' },
    view.missingOnly ? el('p', { class: 'hint' }, 'Solo los que faltan instalar.') : null,
    keys.map((key) => {
      const list = groups.get(key);
      const usd = list.reduce((sum, p) => sum + (p.quoteUSD ?? 0), 0);
      return el('section', { class: 'section' },
        el('div', { class: 'section-head' },
          el('h3', { class: 'group-title' }, view.group === 'status' ? store.PDV_STATUSES[key] : key),
          el('span', { class: 'section-aside' }, `${list.length} · ${formatUSD(usd)}`),
        ),
        el('ul', { class: 'card card--list list' }, list.map((p) => pdvRow(p, today))),
      );
    }),
  );
}

/** Orden: vencidos primero, después por próxima fecha, los sin fecha, y al final los instalados. */
function comparePdvs(today) {
  const rank = (p) => {
    if (!store.isPdvMissing(p)) return 3;
    if (store.isPdvOverdue(p, today)) return 0;
    return p.nextDate ? 1 : 2;
  };
  return (a, b) => rank(a) - rank(b)
    || (a.nextDate ?? '').localeCompare(b.nextDate ?? '')
    || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    || a.client.localeCompare(b.client);
}

function pdvRow(pdv, today) {
  const overdue = store.isPdvOverdue(pdv, today);
  const hasReview = pdv.review?.length > 0;
  const next = store.isPdvMissing(pdv) && (pdv.nextAction || pdv.nextDate)
    ? el('span', { class: overdue ? 'pdv-row__next is-overdue' : 'pdv-row__next' },
      icon('arrow'),
      el('span', {}, [pdv.nextAction || 'Sin próxima acción', pdv.nextDate ? relativeDayLabel(pdv.nextDate, today) : null]
        .filter(Boolean).join(' · ')))
    : null;

  return el('li', {},
    el('button', {
      class: 'pdv-row',
      type: 'button',
      'aria-label': `${pdv.code}, ${pdv.client}, ${store.PDV_STATUSES[pdv.status]}${overdue ? ', próxima acción vencida' : ''}${hasReview ? ', con datos a revisar' : ''}`,
      onclick: () => openPdvDetail(pdv.id),
    },
    el('span', { class: 'pdv-row__top' },
      el('span', { class: 'pdv-row__code' }, pdv.code),
      el('span', { class: 'pdv-row__client' }, pdv.client),
      hasReview ? el('span', { class: 'pdv-row__alert' }, icon('alert', 2)) : null,
      statusPill(pdv.status),
    ),
    el('span', { class: 'pdv-row__meta' },
      [pdv.department, pdv.supplier, formatUSD(pdv.quoteUSD ?? 0)].filter(Boolean).join(' · ')),
    next,
    ),
  );
}
