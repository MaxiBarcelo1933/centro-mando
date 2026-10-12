// Ficha de un PDV del proyecto (sheet): estado, próxima acción, registrar avance,
// etapas, bitácora y edición de datos. El código es el identificador (nunca el nombre).
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, dateOf, formatShortDate, relativeDayLabel } from '../dates.js';
import { openSheet } from '../components/sheet.js';
import { chipGroup } from '../components/chips.js';
import { showToast, tryAction } from '../components/toast.js';
import { field } from '../components/form.js';
import { formatUSD, formatPesos, formatNumber, parseDecimal } from './common.js';

// Estados que se eligen a mano ("Reemplazado" lo pone el reemplazo, en la próxima entrega).
const EDITABLE_STATUSES = ['PENDIENTE', 'RELEVADO', 'CAMBIO', 'INSTALADO'];

/** Pastilla de color con el estado del PDV. */
export function statusPill(status) {
  return el('span', { class: `status-pill status-pill--${status.toLowerCase()}` }, store.PDV_STATUSES[status]);
}

export function openPdvDetail(id) {
  const first = store.getPdv(id);
  if (!first) return;
  const sheet = openSheet({ title: `PDV ${first.code}`, content: build() });

  // Después de cada acción redibujamos con los datos nuevos.
  function refresh() {
    sheet.body.replaceChildren(build());
  }

  function build() {
    const pdv = store.getPdv(id);
    const project = store.getProject(pdv.projectId);
    const today = todayISO();
    return el('div', { class: 'form' },
      summaryCard(pdv, project),
      reviewBox(pdv),
      nextCard(pdv, today),
      statusSection(pdv),
      progressSection(pdv),
      stagesSection(pdv),
      logSection(pdv),
      editSection(pdv),
    );
  }

  // ---------- Resumen ----------

  function summaryCard(pdv, project) {
    const facts = [
      pdv.department,
      pdv.giro,
      pdv.zone != null ? `Zona ${pdv.zone}` : null,
    ].filter(Boolean).join(' · ');
    return el('div', { class: 'card pdv-summary' },
      el('div', { class: 'pdv-summary__top' },
        el('h3', { class: 'pdv-summary__client' }, pdv.client),
        statusPill(pdv.status),
      ),
      el('p', { class: 'pdv-summary__codes' },
        el('span', {}, 'Código '), el('strong', {}, pdv.code), el('span', {}, ' · '), el('strong', {}, store.newPdvCode(pdv.code))),
      facts ? el('p', { class: 'pdv-summary__facts' }, facts) : null,
      el('p', { class: 'pdv-summary__facts' },
        [pdv.supplier, `${formatUSD(pdv.quoteUSD ?? 0)} (${formatPesos((pdv.quoteUSD ?? 0) * (project?.usdRate ?? 0))})`,
          pdv.estimatedFinish ? `Finaliza: ${pdv.estimatedFinish}` : null].filter(Boolean).join(' · ')),
      pdv.notes ? el('p', { class: 'pdv-summary__notes' }, pdv.notes) : null,
    );
  }

  // ---------- Datos a revisar ----------

  function reviewBox(pdv) {
    if (!pdv.review?.length) return null;
    return el('div', { class: 'review-box', role: 'note' },
      el('p', { class: 'review-box__title' }, icon('alert', 2), 'Datos a revisar'),
      el('ul', { class: 'review-box__list' }, pdv.review.map((text) => el('li', {}, text))),
      el('button', {
        class: 'btn-secondary',
        type: 'button',
        onclick: async () => {
          const saved = await tryAction(() => store.clearPdvReview(pdv.id));
          if (!saved) return;
          refresh();
          showToast('Listo, quedó revisado');
        },
      }, icon('check', 2.2), 'Ya lo revisé'),
    );
  }

  // ---------- Próxima acción ----------

  function nextCard(pdv, today) {
    if (!store.isPdvMissing(pdv)) return null;
    const overdue = store.isPdvOverdue(pdv, today);
    return el('div', { class: overdue ? 'card next-card is-overdue' : 'card next-card' },
      el('p', { class: 'next-card__label' }, 'Próxima acción'),
      el('p', { class: 'next-card__action' }, pdv.nextAction || 'Sin definir'),
      el('p', { class: 'next-card__meta' },
        pdv.nextDate
          ? el('span', { class: overdue ? 'tag tag--danger' : 'tag tag--muted' },
            overdue ? `Venció ${relativeDayLabel(pdv.nextDate, today).toLowerCase()}` : relativeDayLabel(pdv.nextDate, today))
          : el('span', { class: 'tag tag--muted' }, 'Sin fecha'),
        pdv.waitingFor ? el('span', { class: 'tag tag--muted' }, `Esperando a: ${store.WAITING_FOR[pdv.waitingFor]}`) : null,
      ),
    );
  }

  // ---------- Estado ----------

  function statusSection(pdv) {
    if (pdv.status === 'REEMPLAZADO') {
      return section('Estado', el('p', { class: 'hint' }, 'Este PDV fue reemplazado y ya no cuenta en el total.'));
    }
    const chips = chipGroup({
      label: 'Estado',
      hideLabel: true,
      options: EDITABLE_STATUSES.map((s) => ({ value: s, label: store.PDV_STATUSES[s] })),
      value: pdv.status,
      onChange: async (status) => {
        if (status === pdv.status) return;
        const saved = await tryAction(() => store.updatePdv(pdv.id, { status }));
        if (!saved) return;
        refresh();
        showToast(`Estado: ${store.PDV_STATUSES[status]}`, {
          actionLabel: 'Deshacer',
          onAction: async () => {
            await tryAction(() => store.restorePdv(pdv));
            refresh();
          },
        });
      },
    });
    return section('Estado', chips.element);
  }

  // ---------- Registrar avance ----------

  function progressSection(pdv) {
    if (!store.isPdvMissing(pdv)) return null;
    let waitingFor = pdv.waitingFor ?? null;
    const textInput = el('textarea', { class: 'field__input', rows: 2, placeholder: 'Ej: El proveedor confirmó la instalación para el jueves' });
    const nextInput = el('input', { type: 'text', class: 'field__input', value: pdv.nextAction ?? '', autocomplete: 'off' });
    const dateInput = el('input', { type: 'date', class: 'field__input', value: pdv.nextDate ?? '' });
    const waiting = chipGroup({
      label: 'Esperando a',
      options: Object.entries(store.WAITING_FOR).map(([value, label]) => ({ value, label })),
      value: waitingFor,
      onChange: (value) => { waitingFor = value; },
    });
    const button = el('button', { class: 'btn-secondary', type: 'button', disabled: true }, icon('plus'), 'Registrar avance');
    textInput.addEventListener('input', () => { button.disabled = textInput.value.trim() === ''; });

    button.addEventListener('click', async () => {
      const text = textInput.value.trim();
      if (!text) return;
      const saved = await tryAction(() => store.logPdvProgress(pdv.id, {
        text,
        nextAction: nextInput.value,
        nextDate: dateInput.value,
        waitingFor,
      }));
      if (!saved) return;
      refresh();
      showToast('Avance registrado');
    });

    return section('Registrar avance',
      field('¿Qué pasó?', textInput),
      field('Próxima acción', nextInput),
      field('Fecha (opcional)', dateInput),
      waiting.element,
      button,
    );
  }

  // ---------- Etapas ----------

  function stagesSection(pdv) {
    const done = store.PDV_STAGES.filter((s) => pdv.stages?.[s.id]).length;
    return section(`Etapas · ${done}/${store.PDV_STAGES.length}`,
      el('ul', { class: 'card card--list list' }, store.PDV_STAGES.map((stage) => {
        const checked = Boolean(pdv.stages?.[stage.id]);
        return el('li', {},
          el('button', {
            class: checked ? 'step-row is-done' : 'step-row',
            type: 'button',
            role: 'checkbox',
            'aria-checked': String(checked),
            onclick: async () => {
              const before = pdv.status;
              const saved = await tryAction(() => store.togglePdvStage(pdv.id, stage.id));
              if (!saved) return;
              refresh();
              if (saved.status === 'INSTALADO' && before !== 'INSTALADO') showToast('¡Instalado! Pasó a estado Instalado');
            },
          },
          el('span', { class: 'step-check__box' }, icon('check', 2.6)),
          el('span', { class: 'step-row__text' }, el('span', { class: 'step-row__title' }, stage.label)),
          ),
        );
      })),
    );
  }

  // ---------- Bitácora ----------

  function logSection(pdv) {
    if (pdv.history.length === 0) {
      return section('Bitácora', el('p', { class: 'hint' }, 'Todavía no registraste avances.'));
    }
    const entries = [...pdv.history].reverse(); // lo más nuevo arriba
    return section('Bitácora',
      el('ol', { class: 'log-list' }, entries.map((entry) =>
        el('li', { class: 'log-row' },
          el('span', { class: 'log-row__date' }, formatShortDate(dateOf(entry.date))),
          el('span', { class: 'log-row__text' }, entry.text),
        ))),
    );
  }

  // ---------- Editar datos ----------

  function editSection(pdv) {
    const input = (value, attrs = {}) => el('input', { type: 'text', class: 'field__input', value: value ?? '', autocomplete: 'off', ...attrs });
    const client = input(pdv.client);
    const department = input(pdv.department);
    const giro = input(pdv.giro);
    const zone = input(pdv.zone, { inputmode: 'numeric' });
    const supplier = input(pdv.supplier);
    const quote = input(formatNumber(pdv.quoteUSD ?? 0), { inputmode: 'decimal' });
    const finish = input(pdv.estimatedFinish);
    const notes = el('textarea', { class: 'field__input', rows: 3 });
    notes.value = pdv.notes ?? '';

    const save = el('button', { class: 'btn-secondary', type: 'button' }, 'Guardar cambios');
    save.addEventListener('click', async () => {
      const quoteUSD = parseDecimal(quote.value);
      if (!client.value.trim()) {
        showToast('El PDV necesita el nombre del cliente');
        return;
      }
      if (!Number.isFinite(quoteUSD) || quoteUSD < 0) {
        showToast('La cotización tiene que ser un número, por ejemplo 1.725,00');
        return;
      }
      const zoneValue = zone.value.trim();
      const saved = await tryAction(() => store.updatePdv(pdv.id, {
        client: client.value.trim(),
        department: department.value.trim(),
        giro: giro.value.trim(),
        zone: zoneValue === '' ? null : (Number.isFinite(Number(zoneValue)) ? Number(zoneValue) : zoneValue),
        supplier: supplier.value.trim(),
        quoteUSD,
        estimatedFinish: finish.value.trim(),
        notes: notes.value.trim(),
      }));
      if (!saved) return;
      refresh();
      showToast('Cambios guardados');
    });

    return el('details', { class: 'more' },
      el('summary', {}, 'Editar datos'),
      el('div', { class: 'more__body' },
        field('Cliente', client),
        el('div', { class: 'field-row' }, field('Departamento', department), field('Zona', zone)),
        field('Giro', giro),
        el('div', { class: 'field-row' }, field('Proveedor', supplier), field('Cotización USD', quote)),
        field('Finalización estimada', finish),
        field('Observaciones', notes),
        save,
      ),
    );
  }
}

function section(title, ...children) {
  return el('section', { class: 'sheet-section' },
    el('h3', { class: 'sheet-section__title' }, title),
    ...children,
  );
}
