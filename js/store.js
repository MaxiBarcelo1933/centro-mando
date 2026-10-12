// Estado de la app + reglas de negocio.
// Todas las escrituras pasan por acá: se guardan en IndexedDB, se actualiza
// la copia en memoria y se avisa a quien esté escuchando (re-render + badge).
import * as db from './db.js';
import { todayISO, dateOf, addDays } from './dates.js';

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
};

export const BUCKET_LABELS = { hoy: 'Hoy', semana: 'Esta semana', algun_dia: 'Algún día' };

const state = {
  tasks: [],
  followups: [],
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
  const [tasks, followups, settingsRows] = await Promise.all([
    db.getAll('tasks'),
    db.getAll('followups'),
    db.getAll('settings'),
  ]);
  state.tasks = tasks;
  state.followups = followups;
  for (const row of settingsRows) state.settings[row.key] = row.value;

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

export function addTask({ title, area, bucket = 'hoy', time = null, dueDate = null, notes = '' }) {
  return saveTask({
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

// ---------- Seguimientos: consultas (las escrituras llegan en la Fase 4) ----------

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

// ---------- Procesos (llega en la Fase 3) ----------

/** Progreso del cierre de mes: { done, total } o null si todavía no hay plantilla. */
export function getClosingProgress() {
  return null;
}

// ---------- Badge del ícono ----------

export function getBadgeCount(today = todayISO()) {
  return countPendingToday(today) + countOverdueFollowups(today);
}
