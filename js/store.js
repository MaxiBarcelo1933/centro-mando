// Estado de la app + reglas de negocio.
// Todas las escrituras pasan por acá: se guardan en IndexedDB, se actualiza
// la copia en memoria y se avisa a quien esté escuchando (re-render + badge).
import * as db from './db.js';
import { todayISO, dateOf, addDays, diffDays, formatLongDate, formatShortDate, overdueSinceLabel } from './dates.js';
import { currentPeriod, periodWorkStart } from './periods.js';
import { SEED_TEMPLATES, sampleData } from './seed.js';

export const DEFAULT_AREAS = [
  { id: 'ventas', name: 'Reporte de Ventas', color: '#8FB3FF', bg: 'rgba(91, 141, 239, 0.16)', hidden: false },
  { id: 'meta', name: 'Meta Premiada', color: '#F7BC55', bg: 'rgba(245, 165, 36, 0.16)', hidden: false },
  { id: 'pdv', name: 'PDV', color: '#6FDCA6', bg: 'rgba(63, 191, 127, 0.16)', hidden: false },
  { id: 'carteleria', name: 'Cartelería', color: '#CDB0FF', bg: 'rgba(185, 140, 245, 0.16)', hidden: false },
  { id: 'relevamiento', name: 'Relevamiento', color: '#7FD8E0', bg: 'rgba(127, 216, 224, 0.16)', hidden: false },
  { id: 'otros', name: 'Otros', color: '#C4C9D2', bg: '#232935', hidden: false },
];

const DEFAULT_SETTINGS = {
  areas: DEFAULT_AREAS,
  lastArea: 'otros',
  installBannerDismissed: false,
  badgeEnabled: false,
  lastBackupAt: null,
  seeded: false,
};

export const BUCKET_LABELS = { hoy: 'Hoy', semana: 'Esta semana', algun_dia: 'Algún día' };

const state = {
  tasks: [],
  followups: [],
  templates: [],
  runs: [],
  settings: { ...DEFAULT_SETTINGS },
};

// ---------- Suscripción a cambios ----------

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

// ---------- Arranque ----------

export async function init() {
  const [tasks, followups, templates, runs, settingsRows] = await Promise.all([
    db.getAll('tasks'),
    db.getAll('followups'),
    db.getAll('processTemplates'),
    db.getAll('processRuns'),
    db.getAll('settings'),
  ]);
  state.tasks = tasks;
  state.followups = followups;
  state.templates = templates;
  state.runs = runs;
  state.settings = { ...DEFAULT_SETTINGS };
  for (const row of settingsRows) state.settings[row.key] = row.value;

  await seedTemplates();
  await ensureCurrentRuns();

  // Le pedimos al navegador que no borre nuestros datos aunque falte espacio.
  navigator.storage?.persist?.().catch(() => {});
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Ajustes y áreas ----------

export function getSetting(key) {
  return state.settings[key];
}

export async function setSetting(key, value) {
  await db.put('settings', { key, value });
  state.settings[key] = value;
  notify();
}

export function getAreas({ includeHidden = false } = {}) {
  return state.settings.areas.filter((area) => includeHidden || !area.hidden);
}

/** Devuelve el área; si no existe (por ejemplo, la borraste), cae en "Otros". */
export function getArea(id) {
  const areas = state.settings.areas;
  return areas.find((a) => a.id === id) ?? areas.find((a) => a.id === 'otros') ?? DEFAULT_AREAS[5];
}

// ---------- Tareas: escrituras ----------

function findTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`No existe la tarea ${id}`);
  return task;
}

async function saveTask(task) {
  await db.put('tasks', task);
  const index = state.tasks.findIndex((t) => t.id === task.id);
  if (index >= 0) state.tasks[index] = task;
  else state.tasks.push(task);
  notify();
  return task;
}

/** Regla: una tarea de "Hoy" siempre tiene fecha (el día para el que se planificó). */
function normalizeSchedule(bucket, dueDate) {
  if (bucket === 'hoy' && !dueDate) return { bucket, dueDate: todayISO() };
  return { bucket, dueDate: dueDate || null };
}

export function addTask({ title, area, bucket = 'hoy', time = null, dueDate = null, notes = '', sample = false }) {
  return saveTask({
    ...(sample ? { sample: true } : {}),
    id: newId(),
    title: title.trim(),
    area,
    ...normalizeSchedule(bucket, dueDate),
    time: time || null,
    notes: notes.trim(),
    done: false,
    doneAt: null,
    createdAt: new Date().toISOString(),
    order: Date.now(),
  });
}

export function updateTask(id, patch) {
  const updated = { ...findTask(id), ...patch };
  if ('bucket' in patch || 'dueDate' in patch) {
    Object.assign(updated, normalizeSchedule(updated.bucket, updated.dueDate));
  }
  return saveTask(updated);
}

export function setTaskDone(id, done) {
  return updateTask(id, { done, doneAt: done ? new Date().toISOString() : null });
}

export function moveTaskToToday(id) {
  return updateTask(id, { bucket: 'hoy', dueDate: todayISO() });
}

/** Elimina y devuelve la tarea, para poder deshacer con restoreTask. */
export async function deleteTask(id) {
  const task = findTask(id);
  await db.remove('tasks', id);
  state.tasks = state.tasks.filter((t) => t.id !== id);
  notify();
  return task;
}

export function restoreTask(task) {
  return saveTask(task);
}

// ---------- Tareas: consultas ----------

/**
 * ¿En qué sección va una tarea?
 * - "today": para hoy (incluye atrasadas y las completadas hoy)
 * - "upcoming": con fecha futura (se muestra en "Esta semana")
 * - "week" / "someday": sin fecha, según el bucket
 * - "hidden": completada otro día (queda en el historial)
 */
export function classifyTask(task, today = todayISO()) {
  if (task.done) return dateOf(task.doneAt) === today ? 'today' : 'hidden';
  if (task.dueDate) return task.dueDate <= today ? 'today' : 'upcoming';
  if (task.bucket === 'hoy') return 'today';
  return task.bucket === 'semana' ? 'week' : 'someday';
}

export function isTaskOverdue(task, today = todayISO()) {
  return !task.done && Boolean(task.dueDate) && task.dueDate < today;
}

// Orden de "Para hoy": atrasadas → con hora → sin hora → completadas.
function todayRank(task, today) {
  if (task.done) return 3;
  if (isTaskOverdue(task, today)) return 0;
  return task.time ? 1 : 2;
}

function compareToday(today) {
  return (a, b) => {
    const rank = todayRank(a, today) - todayRank(b, today);
    if (rank !== 0) return rank;
    switch (todayRank(a, today)) {
      case 0: return a.dueDate.localeCompare(b.dueDate) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.order - b.order;
      case 1: return a.time.localeCompare(b.time) || a.order - b.order;
      case 3: return a.doneAt.localeCompare(b.doneAt);
      default: return a.order - b.order;
    }
  };
}

export function getTodayTasks(today = todayISO()) {
  return state.tasks.filter((t) => classifyTask(t, today) === 'today').sort(compareToday(today));
}

/** "Esta semana": primero las que tienen fecha futura (por fecha), después el resto. */
export function getWeekTasks(today = todayISO()) {
  const upcoming = state.tasks.filter((t) => classifyTask(t, today) === 'upcoming')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const week = state.tasks.filter((t) => classifyTask(t, today) === 'week').sort((a, b) => a.order - b.order);
  return [...upcoming, ...week];
}

export function getSomedayTasks(today = todayISO()) {
  return state.tasks.filter((t) => classifyTask(t, today) === 'someday').sort((a, b) => a.order - b.order);
}

export function countPendingToday(today = todayISO()) {
  return getTodayTasks(today).filter((t) => !t.done).length;
}

export function getTask(id) {
  return state.tasks.find((t) => t.id === id) ?? null;
}

// ---------- Calendario ----------

/**
 * Lo que va en el calendario entre `from` y `to` (inclusive), agrupado por día:
 * { 'YYYY-MM-DD': [{ kind: 'task'|'followup', id, title, area, date, time, done, overdue }] }
 * - Tareas con fecha (hechas o no). Las que no tienen fecha (Esta semana / Algún día) no van.
 * - Seguimientos abiertos, en su fecha límite (sin hora: van en "Todo el día").
 * Cada día viene ordenado: primero sin hora, después por hora.
 */
export function getCalendarItems(from, to, today = todayISO()) {
  const days = {};
  const push = (date, item) => {
    if (date < from || date > to) return;
    (days[date] ??= []).push({ ...item, date });
  };
  for (const t of state.tasks) {
    if (!t.dueDate) continue;
    push(t.dueDate, {
      kind: 'task', id: t.id, title: t.title, area: t.area, time: t.time ?? null,
      done: t.done, overdue: isTaskOverdue(t, today),
    });
  }
  for (const f of state.followups) {
    if (f.status !== 'open') continue;
    push(f.dueDate, {
      kind: 'followup', id: f.id, title: f.title, area: f.area, time: null,
      done: false, overdue: isFollowupOverdue(f, today),
    });
  }
  const byTime = (a, b) => Number(Boolean(a.time)) - Number(Boolean(b.time))
    || (a.time ?? '').localeCompare(b.time ?? '')
    || (a.kind === b.kind ? 0 : (a.kind === 'task' ? -1 : 1));
  for (const items of Object.values(days)) items.sort(byTime);
  return days;
}

// ---------- Seguimientos: escrituras ----------

function findFollowup(id) {
  const followup = state.followups.find((f) => f.id === id);
  if (!followup) throw new Error(`No existe el seguimiento ${id}`);
  return followup;
}

async function saveFollowup(followup) {
  await db.put('followups', followup);
  const index = state.followups.findIndex((f) => f.id === followup.id);
  if (index >= 0) state.followups[index] = followup;
  else state.followups.push(followup);
  notify();
  return followup;
}

export function getFollowup(id) {
  return state.followups.find((f) => f.id === id) ?? null;
}

export function addFollowup({ title, area, nextAction = '', dueDate, owner = 'me', waitingFor = '', sample = false }) {
  return saveFollowup({
    ...(sample ? { sample: true } : {}),
    id: newId(),
    title: title.trim(),
    area,
    nextAction: nextAction.trim(),
    dueDate,
    owner,
    waitingFor: owner === 'other' ? waitingFor.trim() : '',
    status: 'open',
    history: [],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
}

export function updateFollowup(id, patch) {
  const updated = { ...findFollowup(id), ...patch };
  if (updated.owner !== 'other') updated.waitingFor = '';
  return saveFollowup(updated);
}

/** "Registrar avance": anota qué pasó en la bitácora y define la próxima acción y fecha. */
export function logFollowupProgress(id, { text, nextAction, dueDate }) {
  const followup = findFollowup(id);
  return saveFollowup({
    ...followup,
    history: [...followup.history, { date: new Date().toISOString(), text: text.trim() }],
    nextAction: nextAction.trim(),
    dueDate,
  });
}

/** Pospone a una fecha nueva y lo deja anotado en la bitácora. */
export function postponeFollowup(id, dueDate, note) {
  const followup = findFollowup(id);
  return saveFollowup({
    ...followup,
    dueDate,
    history: [...followup.history, { date: new Date().toISOString(), text: note }],
  });
}

export function resolveFollowup(id) {
  return updateFollowup(id, { status: 'resolved', resolvedAt: new Date().toISOString() });
}

export function reopenFollowup(id) {
  return updateFollowup(id, { status: 'open', resolvedAt: null });
}

export async function deleteFollowup(id) {
  const followup = findFollowup(id);
  await db.remove('followups', id);
  state.followups = state.followups.filter((f) => f.id !== id);
  notify();
  return followup;
}

/** Para "Deshacer": vuelve a guardar una copia exacta de cómo estaba. */
export function restoreFollowup(snapshot) {
  return saveFollowup(snapshot);
}

// ---------- Seguimientos: consultas ----------

export const FOLLOWUP_FILTERS = {
  todos: { label: 'Todos', test: () => true },
  vencidos: { label: 'Vencidos', test: (f, today) => f.dueDate < today },
  me: { label: 'Me toca', test: (f) => f.owner === 'me' },
  esperando: { label: 'Esperando', test: (f) => f.owner === 'other' },
};

/** Abiertos que cumplen el filtro, ordenados por fecha (los vencidos quedan arriba). */
export function getOpenFollowups(filter = 'todos', today = todayISO()) {
  const test = FOLLOWUP_FILTERS[filter]?.test ?? FOLLOWUP_FILTERS.todos.test;
  return state.followups
    .filter((f) => f.status === 'open' && test(f, today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt));
}

export function countFollowupsByFilter(today = todayISO()) {
  return Object.fromEntries(Object.keys(FOLLOWUP_FILTERS).map((key) => [key, getOpenFollowups(key, today).length]));
}

export function getResolvedFollowups() {
  return state.followups
    .filter((f) => f.status === 'resolved')
    .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
}

export function isFollowupOverdue(followup, today = todayISO()) {
  return followup.status === 'open' && followup.dueDate < today;
}

export function countOverdueFollowups(today = todayISO()) {
  return state.followups.filter((f) => isFollowupOverdue(f, today)).length;
}

/** Seguimientos donde espero a otro que vencen en los próximos 3 días (o ya vencieron). */
export function getWaitingSoon(today = todayISO()) {
  const limit = addDays(today, 3);
  return state.followups
    .filter((f) => f.status === 'open' && f.owner === 'other' && f.dueDate <= limit)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ---------- Procesos: plantillas y ejecuciones por período ----------

/** Primer arranque: carga el "Cierre de mes" real (una sola vez, aunque después lo borres). */
async function seedTemplates() {
  if (state.settings.seeded) return;
  if (state.templates.length === 0) {
    const templates = structuredClone(SEED_TEMPLATES);
    await db.putMany('processTemplates', templates);
    state.templates = templates;
  }
  await db.put('settings', { key: 'seeded', value: true });
  state.settings.seeded = true;
}

/** Crea vacía la ejecución del período actual de cada plantilla, si todavía no existe. */
export async function ensureCurrentRuns(today = todayISO()) {
  const missing = [];
  for (const template of state.templates) {
    const period = currentPeriod(template, today);
    if (!getRun(template.id, period)) {
      missing.push({
        id: `${template.id}:${period}`,
        templateId: template.id,
        period,
        checked: {},
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    }
  }
  if (missing.length === 0) return false;
  await db.putMany('processRuns', missing);
  state.runs.push(...missing);
  return true;
}

/** Al volver a la app o a medianoche: si empezó un mes/semana nuevo, crea su checklist. */
export async function refreshDay() {
  if (await ensureCurrentRuns()) notify();
}

export function getTemplates() {
  return state.templates;
}

export function getTemplate(id) {
  return state.templates.find((t) => t.id === id) ?? null;
}

export function getRun(templateId, period) {
  return state.runs.find((r) => r.templateId === templateId && r.period === period) ?? null;
}

export function getCurrentRun(template, today = todayISO()) {
  return getRun(template.id, currentPeriod(template, today));
}

/** Períodos anteriores de una plantilla, del más nuevo al más viejo. */
export function getPastRuns(template, today = todayISO()) {
  const current = currentPeriod(template, today);
  return state.runs
    .filter((r) => r.templateId === template.id && r.period !== current)
    .sort((a, b) => b.period.localeCompare(a.period));
}

const templateStepIds = (template) => template.groups.flatMap((g) => g.steps.map((s) => s.id));

/** Cuántos pasos de la plantilla (tal como está hoy) están marcados en la ejecución. */
export function runProgress(template, run) {
  const ids = templateStepIds(template);
  const done = run ? ids.filter((id) => run.checked[id]).length : 0;
  return { done, total: ids.length };
}

/** Días que se tardó en cerrar un período (contando el primer día de trabajo). */
export function runDuration(template, run) {
  if (!run?.completedAt) return null;
  return diffDays(periodWorkStart(template, run.period), dateOf(run.completedAt)) + 1;
}

// Marca la ejecución como terminada (o no) según los pasos actuales de la plantilla.
function withCompletion(template, run) {
  const { done, total } = runProgress(template, run);
  const complete = total > 0 && done === total;
  if (complete && !run.completedAt) return { ...run, completedAt: new Date().toISOString() };
  if (!complete && run.completedAt) return { ...run, completedAt: null };
  return run;
}

async function saveRun(run) {
  await db.put('processRuns', run);
  const index = state.runs.findIndex((r) => r.id === run.id);
  if (index >= 0) state.runs[index] = run;
  else state.runs.push(run);
}

/** Marca o desmarca un paso. Devuelve { run, justCompleted }. */
export async function toggleStep(templateId, stepId) {
  const template = getTemplate(templateId);
  if (!getCurrentRun(template)) await ensureCurrentRuns();
  const run = getCurrentRun(template);
  const checked = { ...run.checked };
  if (checked[stepId]) delete checked[stepId];
  else checked[stepId] = new Date().toISOString();
  const updated = withCompletion(template, { ...run, checked });
  await saveRun(updated);
  notify();
  return { run: updated, justCompleted: !run.completedAt && Boolean(updated.completedAt) };
}

/** Guarda una plantilla nueva o editada. Lo ya marcado en el período actual se conserva. */
export async function saveTemplate(template) {
  const toSave = { ...template, id: template.id ?? newId() };
  await db.put('processTemplates', toSave);
  const index = state.templates.findIndex((t) => t.id === toSave.id);
  if (index >= 0) state.templates[index] = toSave;
  else state.templates.push(toSave);

  await ensureCurrentRuns();
  // Si se agregaron o sacaron pasos, puede cambiar si el período está terminado.
  const run = getCurrentRun(toSave);
  if (run) {
    const updated = withCompletion(toSave, run);
    if (updated !== run) await saveRun(updated);
  }
  notify();
  return toSave;
}

/** Elimina la plantilla (sus períodos quedan guardados, por si deshacés). */
export async function deleteTemplate(id) {
  const template = getTemplate(id);
  await db.remove('processTemplates', id);
  state.templates = state.templates.filter((t) => t.id !== id);
  notify();
  return template;
}

export function restoreTemplate(template) {
  return saveTemplate(template);
}

export function newStepId() {
  return newId();
}

/** Progreso del cierre de mes para el tile de Hoy: { done, total } o null si no hay plantilla mensual. */
export function getClosingProgress(today = todayISO()) {
  const template = getTemplate('cierre-de-mes') ?? state.templates.find((t) => t.frequency === 'monthly');
  if (!template) return null;
  return runProgress(template, getCurrentRun(template, today));
}

// ---------- Badge del ícono ----------

export function getBadgeCount(today = todayISO()) {
  return countPendingToday(today) + countOverdueFollowups(today);
}

// ---------- Áreas ----------

/** Paleta para las áreas: color del texto y fondo de la etiqueta (16% de opacidad). */
export const AREA_PALETTE = [
  { name: 'Azul', color: '#8FB3FF', bg: 'rgba(91, 141, 239, 0.16)' },
  { name: 'Ámbar', color: '#F7BC55', bg: 'rgba(245, 165, 36, 0.16)' },
  { name: 'Verde', color: '#6FDCA6', bg: 'rgba(63, 191, 127, 0.16)' },
  { name: 'Violeta', color: '#CDB0FF', bg: 'rgba(185, 140, 245, 0.16)' },
  { name: 'Celeste', color: '#7FD8E0', bg: 'rgba(127, 216, 224, 0.16)' },
  { name: 'Coral', color: '#FF9F8A', bg: 'rgba(255, 122, 110, 0.16)' },
  { name: 'Rosa', color: '#F5A3D7', bg: 'rgba(240, 120, 200, 0.16)' },
  { name: 'Gris', color: '#C4C9D2', bg: '#232935' },
];

export function updateArea(id, patch) {
  const areas = state.settings.areas.map((a) => (a.id === id ? { ...a, ...patch } : a));
  return setSetting('areas', areas);
}

export function addArea({ name, color, bg }) {
  const area = { id: `area-${newId().slice(0, 8)}`, name: name.trim(), color, bg, hidden: false };
  return setSetting('areas', [...state.settings.areas, area]).then(() => area);
}

// ---------- Historial de tareas hechas ----------

/** Tareas completadas agrupadas por día: [{ date, tasks }], del día más nuevo al más viejo. */
export function getDoneTasksByDay() {
  const byDay = new Map();
  for (const task of state.tasks.filter((t) => t.done && t.doneAt)) {
    const day = dateOf(task.doneAt);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(task);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, tasks]) => ({ date, tasks: tasks.sort((a, b) => a.doneAt.localeCompare(b.doneAt)) }));
}

// ---------- Resumen del día (para pegar en Teams/WhatsApp) ----------

export function buildDaySummary(today = todayISO()) {
  const tasks = getTodayTasks(today);
  const done = tasks.filter((t) => t.done);
  const pending = tasks.filter((t) => !t.done);
  const overdue = getOpenFollowups('vencidos', today);
  const date = formatLongDate(today);

  const lines = [`Resumen del ${date}`, ''];
  lines.push(`Hecho hoy (${done.length}):`);
  if (done.length === 0) lines.push('• Nada todavía');
  for (const t of done) lines.push(`• ${t.title}`);

  lines.push('', `Pendiente (${pending.length}):`);
  if (pending.length === 0) lines.push('• Nada pendiente');
  for (const t of pending) {
    const extra = isTaskOverdue(t, today) ? ` (atrasada ${overdueSinceLabel(t.dueDate, today)})` : (t.time ? ` (${t.time})` : '');
    lines.push(`• ${t.title}${extra}`);
  }

  lines.push('', `Seguimientos vencidos (${overdue.length}):`);
  if (overdue.length === 0) lines.push('• Ninguno');
  for (const f of overdue) {
    const next = f.nextAction ? `. Próxima acción: ${f.nextAction}` : '';
    lines.push(`• ${f.title} (venció el ${formatShortDate(f.dueDate)})${next}`);
  }
  return lines.join('\n');
}

// ---------- Datos de ejemplo ----------

export function hasSampleData() {
  return state.tasks.some((t) => t.sample) || state.followups.some((f) => f.sample);
}

export async function loadSampleData(today = todayISO()) {
  const sample = sampleData(today);
  for (const task of sample.tasks) await addTask({ ...task, bucket: 'hoy', sample: true });
  for (const followup of sample.followups) await addFollowup({ ...followup, sample: true });
}

export async function clearSampleData() {
  const taskIds = state.tasks.filter((t) => t.sample).map((t) => t.id);
  const followupIds = state.followups.filter((f) => f.sample).map((f) => f.id);
  await db.removeMany('tasks', taskIds);
  await db.removeMany('followups', followupIds);
  state.tasks = state.tasks.filter((t) => !t.sample);
  state.followups = state.followups.filter((f) => !f.sample);
  notify();
  return taskIds.length + followupIds.length;
}

// ---------- Backup ----------

export const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_STORES = ['tasks', 'followups', 'processTemplates', 'processRuns', 'settings'];

/** Todo lo guardado, listo para convertir a JSON. */
export async function exportBackup() {
  return {
    app: 'centro-mando',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: await db.readAll(BACKUP_STORES),
  };
}

const isText = (value) => typeof value === 'string';
const BACKUP_CHECKS = {
  tasks: (t) => isText(t?.id) && isText(t?.title) && typeof t.done === 'boolean',
  followups: (f) => isText(f?.id) && isText(f?.title) && isText(f?.dueDate) && Array.isArray(f?.history),
  processTemplates: (t) => isText(t?.id) && isText(t?.name) && Array.isArray(t?.groups),
  processRuns: (r) => isText(r?.id) && isText(r?.templateId) && isText(r?.period) && typeof r?.checked === 'object',
  settings: (s) => isText(s?.key),
};

/**
 * Revisa un backup ANTES de tocar la base.
 * Devuelve { backup, counts, exportedAt } si está bien, o { error } con un mensaje para mostrar.
 */
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return { error: 'El archivo no se puede leer: no es una copia válida.' };
  }
  if (backup?.app !== 'centro-mando') return { error: 'Ese archivo no es una copia de Centro de Mando.' };
  if (typeof backup.schemaVersion !== 'number' || backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { error: 'La copia es de una versión más nueva de la app. Actualizá la app y probá de nuevo.' };
  }
  const data = backup.data ?? {};
  for (const [name, check] of Object.entries(BACKUP_CHECKS)) {
    if (!Array.isArray(data[name])) return { error: 'A la copia le faltan datos: no se puede importar.' };
    if (!data[name].every(check)) return { error: 'La copia tiene datos dañados: no se puede importar.' };
  }
  return {
    backup,
    exportedAt: backup.exportedAt ?? null,
    counts: {
      tasks: data.tasks.length,
      followups: data.followups.length,
      templates: data.processTemplates.length,
    },
  };
}

/** Reemplaza TODO por el contenido del backup (ya validado con parseBackup). */
export async function importBackup(backup) {
  await db.replaceAll(Object.fromEntries(BACKUP_STORES.map((name) => [name, backup.data[name]])));
  await init();
  notify();
}
