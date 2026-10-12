// Pantalla "Ajustes" (se abre desde el avatar): áreas, backup, resumen del día,
// datos de trabajo, tareas hechas, badge del ícono, datos de ejemplo y versión.
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import { todayISO, dateOf, diffDays, formatLongDate } from '../dates.js';
import { navigate } from '../router.js';
import { chipGroup } from '../components/chips.js';
import { openSheet } from '../components/sheet.js';
import { showToast, tryAction } from '../components/toast.js';
import { field, areaTag } from '../components/form.js';
import { emptyState } from './common.js';
import { parseWorkSeed, importWorkSeed, importedSummary } from '../work-seed.js';

const BACKUP_WARNING_DAYS = 7;

export function renderAjustes() {
  return el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    el('header', { class: 'view-header view-header--back' },
      el('div', {},
        el('button', { class: 'back-btn', type: 'button', onclick: () => navigate('hoy') },
          icon('back'), 'Hoy'),
        el('h1', { class: 'title', id: 'view-title' }, 'Ajustes'),
      ),
    ),
    areasSection(),
    backupSection(),
    workSection(),
    daySection(),
    badgeSection(),
    sampleSection(),
    aboutSection(),
  );
}

function settingsSection(title, ...children) {
  return el('section', { class: 'section' },
    el('div', { class: 'section-head' }, el('h2', { class: 'section-title' }, title)),
    ...children,
  );
}

// ---------- Áreas ----------

function areasSection() {
  const areas = store.getAreas({ includeHidden: true });
  return settingsSection('Áreas',
    el('ul', { class: 'card card--list list' }, areas.map((area) =>
      el('li', {},
        el('button', { class: 'settings-row', type: 'button', onclick: () => openAreaEditor(area) },
          dot(area.color),
          el('span', { class: 'settings-row__label' }, area.name),
          area.hidden ? el('span', { class: 'tag tag--muted' }, 'Oculta') : null,
          el('span', { class: 'settings-row__chevron' }, icon('chevron')),
        ),
      ))),
    el('button', { class: 'btn-secondary btn-add', type: 'button', onclick: () => openAreaEditor(null) },
      icon('plus'), 'Agregar área'),
  );
}

function dot(color) {
  const node = el('span', { class: 'area-dot', 'aria-hidden': 'true' });
  node.style.background = color;
  return node;
}

function openAreaEditor(area) {
  const isNew = !area;
  const draft = isNew
    ? { name: '', ...store.AREA_PALETTE[0], hidden: false }
    : { ...area };

  const nameInput = el('input', {
    type: 'text', class: 'field__input field__input--big', value: draft.name,
    placeholder: 'Ej: Capacitaciones', autocomplete: 'off', autocapitalize: 'sentences',
  });
  nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

  // Preview de cómo se ve la etiqueta
  const preview = el('span', { class: 'tag' });
  const updatePreview = () => {
    preview.textContent = draft.name.trim() || 'Así se ve la etiqueta';
    preview.style.color = draft.color;
    preview.style.background = draft.bg;
  };
  nameInput.addEventListener('input', updatePreview);
  updatePreview();

  const swatches = store.AREA_PALETTE.map((option) => {
    const button = el('button', {
      class: 'swatch',
      type: 'button',
      'aria-label': option.name,
      'aria-pressed': String(option.color === draft.color),
      onclick: () => {
        draft.color = option.color;
        draft.bg = option.bg;
        swatches.forEach((s, i) => s.setAttribute('aria-pressed', String(store.AREA_PALETTE[i].color === draft.color)));
        updatePreview();
      },
    }, dot(option.color));
    return button;
  });

  // "Otros" no se puede ocultar: es donde caen las tareas sin área.
  const visibility = area?.id === 'otros' ? null : chipGroup({
    label: '¿Aparece al cargar tareas?',
    options: [
      { value: 'visible', label: 'Visible' },
      { value: 'hidden', label: 'Oculta' },
    ],
    value: draft.hidden ? 'hidden' : 'visible',
    onChange: (value) => { draft.hidden = value === 'hidden'; },
  });

  const save = el('button', { class: 'btn-primary', type: 'button' }, isNew ? 'Agregar área' : 'Guardar');
  save.addEventListener('click', async () => {
    const name = draft.name.trim();
    if (!name) {
      showToast('Ponele un nombre al área');
      nameInput.focus();
      return;
    }
    const ok = await tryAction(() => (isNew
      ? store.addArea({ name, color: draft.color, bg: draft.bg })
      : store.updateArea(area.id, { name, color: draft.color, bg: draft.bg, hidden: draft.hidden })
    ).then(() => true));
    if (!ok) return;
    sheet.close();
    showToast(isNew ? 'Área agregada' : 'Área guardada');
  });

  const content = el('div', { class: 'form' },
    field('Nombre', nameInput),
    el('div', { class: 'field', role: 'group', 'aria-label': 'Color' },
      el('span', { class: 'field__label' }, 'Color'),
      el('div', { class: 'swatches' }, swatches),
    ),
    el('div', { class: 'area-preview' }, preview),
    visibility?.element,
    isNew ? null : el('p', { class: 'hint' }, 'Las áreas no se borran para no perder las etiquetas de tus tareas. Si no la usás más, ocultala.'),
    save,
  );
  const sheet = openSheet({ title: isNew ? 'Nueva área' : 'Editar área', content });
}

// ---------- Backup ----------

function backupSection() {
  const last = store.getSetting('lastBackupAt');
  const days = last ? diffDays(dateOf(last), todayISO()) : null;
  let status;
  if (days === null) status = 'Todavía no hiciste ningún backup.';
  else if (days === 0) status = 'Último backup: hoy.';
  else if (days === 1) status = 'Último backup: ayer.';
  else status = `Último backup: hace ${days} días.`;
  const warn = days === null || days > BACKUP_WARNING_DAYS;

  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) previewImport(file);
  });

  return settingsSection('Copia de seguridad',
    el('div', { class: 'card settings-card' },
      el('p', { class: warn ? 'backup-status is-warning' : 'backup-status' },
        status,
        warn ? ' iOS puede borrar los datos de apps que no se usan: exportá una copia cada tanto.' : null),
      el('div', { class: 'button-row' },
        el('button', { class: 'btn-secondary', type: 'button', onclick: exportBackup }, icon('share'), 'Exportar copia (.json)'),
        el('button', { class: 'btn-secondary', type: 'button', onclick: () => fileInput.click() }, icon('download'), 'Importar copia'),
      ),
      fileInput,
    ),
  );
}

async function exportBackup() {
  const backup = await tryAction(() => store.exportBackup(), 'No se pudo armar la copia.');
  if (!backup) return;
  const name = `centro-mando-backup-${todayISO()}.json`;
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' });

  // En el iPhone abre la hoja de compartir (Guardar en Archivos, mandar por mail…).
  const isTouchDevice = navigator.maxTouchPoints > 0;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia de Centro de Mando' });
    } catch (error) {
      if (error.name === 'AbortError') return; // cancelaste: no cuenta como backup
      showToast('No se pudo compartir la copia.');
      return;
    }
  } else {
    // En la compu: se descarga el archivo.
    const url = URL.createObjectURL(file);
    const link = el('a', { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  await tryAction(() => store.setSetting('lastBackupAt', new Date().toISOString()));
  showToast('Copia exportada');
}

async function previewImport(file) {
  const result = store.parseBackup(await file.text());
  if (result.error) {
    showToast(result.error, { duration: 6000 });
    return;
  }
  const { counts, exportedAt, backup } = result;
  const confirmButton = el('button', { class: 'btn-danger', type: 'button' }, 'Reemplazar mis datos con esta copia');
  confirmButton.addEventListener('click', async () => {
    confirmButton.disabled = true;
    const ok = await tryAction(() => store.importBackup(backup).then(() => true), 'No se pudo importar. Tus datos no se tocaron.');
    if (!ok) {
      confirmButton.disabled = false;
      return;
    }
    sheet.close();
    showToast('Copia importada');
  });

  const sheet = openSheet({
    title: 'Importar copia',
    content: el('div', { class: 'form' },
      el('div', { class: 'card settings-card' },
        el('p', { class: 'import-summary__title' },
          exportedAt ? `Copia del ${formatLongDate(dateOf(exportedAt))}` : 'Copia sin fecha'),
        el('ul', { class: 'import-summary' },
          el('li', {}, `${counts.tasks} ${counts.tasks === 1 ? 'tarea' : 'tareas'}`),
          el('li', {}, `${counts.followups} ${counts.followups === 1 ? 'seguimiento' : 'seguimientos'}`),
          el('li', {}, `${counts.templates} ${counts.templates === 1 ? 'proceso' : 'procesos'}`),
        ),
      ),
      el('p', { class: 'hint' }, 'Ojo: se borra todo lo que tenés ahora en la app y se reemplaza por esta copia. No se puede deshacer.'),
      confirmButton,
    ),
  });
}

// ---------- Datos de trabajo ----------

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function workSection() {
  const info = store.getSetting('workSeed');
  const summary = importedSummary();
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) previewWorkSeed(file);
  });

  let status = 'Todavía no cargaste tus datos de trabajo.';
  if (summary) {
    const counts = summary.groups.map((g) => `${g.items.length} ${g.label.toLowerCase()}`).join(', ');
    status = `Versión ${summary.version} · última importación: ${formatLongDate(dateOf(summary.importedAt))} (${counts}).`;
  }

  return settingsSection('Datos de trabajo',
    el('div', { class: 'card settings-card' },
      el('p', { class: 'backup-status' }, status),
      el('div', { class: 'button-row' },
        el('button', { class: 'btn-secondary', type: 'button', onclick: () => fileInput.click() },
          icon('download'), info ? 'Reimportar datos de trabajo' : 'Importar datos de trabajo'),
        el('button', { class: 'btn-secondary', type: 'button', disabled: !summary, onclick: openImportedList },
          'Ver qué se importó'),
      ),
      el('p', { class: 'hint' }, 'Elegí el archivo seed-trabajo.json. Solo agrega lo que falta: nunca duplica ni pisa lo que cambiaste en la app.'),
      fileInput,
    ),
  );
}

async function previewWorkSeed(file) {
  const result = parseWorkSeed(await file.text());
  if (result.error) {
    showToast(result.error, { duration: 6000 });
    return;
  }
  const { seed, pending, existing } = result;
  const total = pending.areas.length + pending.tasks.length + pending.followups.length;

  const confirmButton = el('button', { class: 'btn-primary', type: 'button', disabled: total === 0 },
    total === 0 ? 'No hay nada nuevo' : `Agregar ${plural(total, 'elemento', 'elementos')}`);
  confirmButton.addEventListener('click', async () => {
    confirmButton.disabled = true;
    const added = await tryAction(() => importWorkSeed(seed), 'No se pudo importar. Probá de nuevo.');
    if (!added) {
      confirmButton.disabled = false;
      return;
    }
    sheet.close();
    showToast(`Listo: ${plural(added.tasks, 'tarea', 'tareas')} y ${plural(added.followups, 'seguimiento', 'seguimientos')} nuevos`);
  });

  const lines = [
    pending.areas.length ? plural(pending.areas.length, 'área nueva', 'áreas nuevas') : null,
    pending.tasks.length ? plural(pending.tasks.length, 'tarea', 'tareas') : null,
    pending.followups.length ? plural(pending.followups.length, 'seguimiento', 'seguimientos') : null,
  ].filter(Boolean);

  const sheet = openSheet({
    title: 'Datos de trabajo',
    content: el('div', { class: 'form' },
      el('div', { class: 'card settings-card' },
        el('p', { class: 'import-summary__title' }, `Archivo versión ${seed.seedVersion}`),
        total > 0
          ? el('ul', { class: 'import-summary' }, lines.map((line) => el('li', {}, `Se agrega: ${line}`)))
          : el('p', { class: 'hint' }, 'Todo lo de este archivo ya está en la app.'),
        existing > 0
          ? el('p', { class: 'hint' }, `${plural(existing, 'elemento ya estaba', 'elementos ya estaban')} y no se tocan.`)
          : null,
      ),
      confirmButton,
    ),
  });
}

function openImportedList() {
  const summary = importedSummary();
  if (!summary) return;
  const content = el('div', { class: 'form' },
    summary.groups.filter((g) => g.items.length > 0).map((group) =>
      el('section', { class: 'section' },
        el('div', { class: 'section-head' },
          el('h3', { class: 'group-title' }, group.label),
          el('span', { class: 'section-aside' }, String(group.items.length)),
        ),
        el('ul', { class: 'card card--list list' }, group.items.map((item) =>
          el('li', { class: 'history-row' },
            el('span', { class: 'history-row__title' }, item.title),
            item.gone ? el('span', { class: 'history-row__sub' }, 'Ya no está en la app: no se vuelve a agregar') : null,
          ))),
      )),
  );
  openSheet({ title: `Importado (versión ${summary.version})`, content });
}

// ---------- Tu día ----------

function daySection() {
  return settingsSection('Tu día',
    el('div', { class: 'card settings-card' },
      el('button', { class: 'btn-secondary', type: 'button', onclick: copySummary }, icon('copy'), 'Copiar resumen del día'),
      el('p', { class: 'hint' }, 'Lo hecho hoy, lo pendiente y los seguimientos vencidos, listo para pegar en Teams o WhatsApp.'),
      el('button', { class: 'btn-secondary', type: 'button', onclick: openDoneHistory }, icon('history'), 'Ver tareas hechas'),
    ),
  );
}

async function copySummary() {
  const text = store.buildDaySummary();
  try {
    await navigator.clipboard.writeText(text);
    showToast('Resumen copiado. Pegalo en Teams o WhatsApp.');
  } catch {
    // Si no se puede copiar, ofrecemos compartirlo.
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      showToast('No se pudo copiar el resumen.');
    }
  }
}

function openDoneHistory() {
  const days = store.getDoneTasksByDay();
  const content = days.length === 0
    ? el('div', { class: 'card' }, emptyState('Todavía no completaste tareas. Cuando lo hagas, van a quedar acá.', 'emptyDay'))
    : el('div', { class: 'form' }, days.map(({ date, tasks }) =>
      el('section', { class: 'section' },
        el('div', { class: 'section-head' },
          el('h3', { class: 'group-title done-day' }, formatLongDate(date)),
          el('span', { class: 'section-aside' }, String(tasks.length)),
        ),
        el('ul', { class: 'card card--list list' }, tasks.map((task) =>
          el('li', { class: 'history-row' },
            el('span', { class: 'history-row__title' }, task.title),
            el('span', { class: 'task-row__meta' }, areaTag(task.area)),
          ))),
      )));
  openSheet({ title: 'Tareas hechas', content });
}

// ---------- Badge del ícono ----------

function badgeSection() {
  const enabled = Boolean(store.getSetting('badgeEnabled'));
  return settingsSection('Ícono de la app',
    el('div', { class: 'card settings-card' },
      el('button', {
        class: 'switch-row',
        type: 'button',
        role: 'switch',
        'aria-checked': String(enabled),
        onclick: toggleBadge,
      },
        el('span', { class: 'switch-row__text' },
          el('span', { class: 'settings-row__label' }, 'Mostrar el número en el ícono'),
          el('span', { class: 'hint' }, 'Tareas pendientes de hoy + seguimientos vencidos. Pide permiso de notificaciones.'),
        ),
        el('span', { class: 'switch', 'aria-hidden': 'true' }, el('span', { class: 'switch__knob' })),
      ),
    ),
  );
}

async function toggleBadge() {
  if (store.getSetting('badgeEnabled')) {
    await tryAction(() => store.setSetting('badgeEnabled', false));
    navigator.clearAppBadge?.().catch(() => {});
    showToast('Número del ícono desactivado');
    return;
  }
  if (!('setAppBadge' in navigator)) {
    showToast('Este navegador no lo permite. En el iPhone funciona con la app instalada (iOS 16.4 o más).', { duration: 6000 });
    return;
  }
  if ('Notification' in window && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Sin el permiso de notificaciones, iOS no muestra el número.', { duration: 6000 });
      return;
    }
  }
  await tryAction(() => store.setSetting('badgeEnabled', true));
  showToast('Listo: vas a ver los pendientes en el ícono');
}

// ---------- Datos de ejemplo ----------

function sampleSection() {
  const hasSample = store.hasSampleData();
  return settingsSection('Datos de ejemplo',
    el('div', { class: 'card settings-card' },
      el('p', { class: 'hint' }, '4 tareas y 5 seguimientos inventados para probar la app. Se borran sin tocar lo tuyo.'),
      el('div', { class: 'button-row' },
        el('button', {
          class: 'btn-secondary',
          type: 'button',
          disabled: hasSample,
          onclick: async () => {
            await tryAction(() => store.loadSampleData());
            showToast('Datos de ejemplo cargados');
          },
        }, 'Cargar datos de ejemplo'),
        el('button', {
          class: 'btn-secondary',
          type: 'button',
          disabled: !hasSample,
          onclick: async () => {
            const count = await tryAction(() => store.clearSampleData());
            if (count !== undefined) showToast('Datos de ejemplo borrados');
          },
        }, 'Borrar datos de ejemplo'),
      ),
    ),
  );
}

// ---------- Versión y actualización ----------

function aboutSection() {
  const version = el('span', { class: 'settings-row__value' }, '…');
  // La versión es la del caché del service worker (ej. "v3").
  if ('caches' in window) {
    caches.keys()
      .then((keys) => { version.textContent = keys.find((k) => k.startsWith('mando-'))?.slice(6) ?? 'sin instalar'; })
      .catch(() => { version.textContent = '—'; });
  }

  return settingsSection('Acerca de',
    el('div', { class: 'card settings-card' },
      el('div', { class: 'settings-line' },
        el('span', { class: 'settings-row__label' }, 'Versión de la app'),
        version,
      ),
      el('button', { class: 'btn-secondary', type: 'button', onclick: checkForUpdate }, icon('refresh'), 'Buscar actualización'),
    ),
  );
}

async function checkForUpdate() {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) {
    showToast('Las actualizaciones funcionan con la app publicada.');
    return;
  }
  try {
    await registration.update();
  } catch {
    showToast('No se pudo buscar la actualización. ¿Tenés internet?');
    return;
  }
  if (registration.installing || registration.waiting) {
    showToast('Descargando la versión nueva…');
  } else {
    showToast('Ya tenés la última versión');
  }
}
