// Datos de trabajo reales (archivo data/seed-trabajo.json, que NO se sube a GitHub).
// Se importan desde Ajustes eligiendo el archivo. La importación es "idempotente":
// cada elemento tiene un seedId fijo y solo se agrega lo que nunca se importó.
// Nunca se pisa nada que ya esté en la app (lo que editaste o completaste queda como está).
import * as store from './store.js';
import { todayISO, nextBusinessDay } from './dates.js';

export const WORK_SEED_APP = 'centro-mando-trabajo';

// Fecha especial que se calcula al importar.
const NEXT_BUSINESS_DAY = 'proximo_habil';

const KINDS = {
  areas: 'Áreas',
  tasks: 'Tareas',
  followups: 'Seguimientos',
};

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value) => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);

/**
 * Lee y revisa el archivo ANTES de tocar nada.
 * Devuelve { seed, pending: { areas, tasks, followups }, existing } o { error }.
 */
export function parseWorkSeed(text) {
  let seed;
  try {
    seed = JSON.parse(text);
  } catch {
    return { error: 'El archivo no se puede leer: no es un JSON válido.' };
  }
  if (seed?.app !== WORK_SEED_APP) return { error: 'Ese archivo no es de datos de trabajo de Centro de Mando.' };
  if (!Number.isInteger(seed.seedVersion) || seed.seedVersion < 1) return { error: 'Al archivo le falta la versión (seedVersion).' };

  const areas = seed.areas ?? [];
  const tasks = seed.tasks ?? [];
  const followups = seed.followups ?? [];
  if (![areas, tasks, followups].every(Array.isArray)) return { error: 'El archivo tiene listas dañadas.' };

  // Los seedId no se pueden repetir en todo el archivo.
  const ids = [...areas, ...tasks, ...followups].map((item) => item?.seedId);
  if (!ids.every(isText)) return { error: 'Hay elementos sin seedId.' };
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated) return { error: `El seedId "${repeated}" está repetido.` };

  const palette = new Set(store.AREA_PALETTE.map((p) => p.name));
  for (const area of areas) {
    if (!isText(area.id) || !isText(area.name)) return { error: `Al área ${area.seedId} le falta id o nombre.` };
    if (!palette.has(area.color)) return { error: `El color "${area.color}" del área ${area.seedId} no existe. Usá uno de: ${[...palette].join(', ')}.` };
  }

  const areaIds = new Set([...store.getAreas({ includeHidden: true }).map((a) => a.id), ...areas.map((a) => a.id)]);
  for (const task of tasks) {
    if (!isText(task.title)) return { error: `A la tarea ${task.seedId} le falta el título.` };
    if (!areaIds.has(task.area)) return { error: `La tarea ${task.seedId} tiene un área que no existe ("${task.area}").` };
    if (!Object.hasOwn(store.BUCKET_LABELS, task.bucket ?? 'hoy')) return { error: `La tarea ${task.seedId} tiene un "bucket" inválido.` };
    if (task.dueDate != null && !isDate(task.dueDate)) return { error: `La tarea ${task.seedId} tiene una fecha inválida.` };
    if (task.time != null && !isTime(task.time)) return { error: `La tarea ${task.seedId} tiene una hora inválida.` };
    if (task.pdvCodes != null && !(Array.isArray(task.pdvCodes) && task.pdvCodes.every(isText))) {
      return { error: `La tarea ${task.seedId} tiene códigos de PDV inválidos.` };
    }
  }
  for (const followup of followups) {
    if (!isText(followup.title)) return { error: `Al seguimiento ${followup.seedId} le falta el título.` };
    if (!areaIds.has(followup.area)) return { error: `El seguimiento ${followup.seedId} tiene un área que no existe ("${followup.area}").` };
    if (!(isDate(followup.dueDate) || followup.dueDate === NEXT_BUSINESS_DAY)) {
      return { error: `El seguimiento ${followup.seedId} tiene una fecha inválida.` };
    }
    if (!['me', 'other'].includes(followup.owner ?? 'me')) return { error: `El seguimiento ${followup.seedId} tiene un "owner" inválido.` };
  }

  const isNew = (item) => !alreadyImported(item.seedId);
  const areaExists = (id) => store.getAreas({ includeHidden: true }).some((a) => a.id === id);
  const pending = {
    areas: areas.filter((a) => isNew(a) && !areaExists(a.id)),
    tasks: tasks.filter(isNew),
    followups: followups.filter(isNew),
  };
  const existing = ids.length - pending.areas.length - pending.tasks.length - pending.followups.length;
  return { seed, pending, existing };
}

/** ¿Ya se importó (o ya existe en la app) este seedId? */
function alreadyImported(seedId) {
  if (store.getSetting('workSeed')?.imported?.[seedId]) return true;
  return store.hasSeedItem(seedId);
}

/** Agrega lo que falta. Devuelve cuántos de cada tipo se agregaron. */
export async function importWorkSeed(seed, today = todayISO()) {
  const { pending, error } = parseWorkSeed(JSON.stringify(seed));
  if (error) throw new Error(error);
  const holidays = store.getSetting('holidays') ?? [];
  const imported = { ...(store.getSetting('workSeed')?.imported ?? {}) };

  for (const area of pending.areas) {
    const colors = store.AREA_PALETTE.find((p) => p.name === area.color);
    await store.addArea({ id: area.id, name: area.name, color: colors.color, bg: colors.bg });
    imported[area.seedId] = { kind: 'areas', id: area.id };
  }

  for (const task of pending.tasks) {
    // Con fecha: hoy o pasada → Hoy; futura → Esta semana. Sin fecha: el bucket del archivo.
    const bucket = task.dueDate ? (task.dueDate <= today ? 'hoy' : 'semana') : (task.bucket ?? 'hoy');
    const saved = await store.addTask({
      title: task.title,
      area: task.area,
      bucket,
      dueDate: task.dueDate ?? null,
      time: task.time ?? null,
      notes: task.notes ?? '',
      seedId: task.seedId,
      pdvCodes: task.pdvCodes ?? null,
    });
    imported[task.seedId] = { kind: 'tasks', id: saved.id };
  }

  for (const followup of pending.followups) {
    const saved = await store.addFollowup({
      title: followup.title,
      area: followup.area,
      nextAction: followup.nextAction ?? '',
      dueDate: followup.dueDate === NEXT_BUSINESS_DAY ? nextBusinessDay(today, holidays) : followup.dueDate,
      owner: followup.owner ?? 'me',
      waitingFor: followup.waitingFor ?? '',
      seedId: followup.seedId,
    });
    imported[followup.seedId] = { kind: 'followups', id: saved.id };
  }

  const previous = store.getSetting('workSeed');
  await store.setSetting('workSeed', {
    version: Math.max(seed.seedVersion, previous?.version ?? 0),
    importedAt: new Date().toISOString(),
    imported,
  });
  return {
    areas: pending.areas.length,
    tasks: pending.tasks.length,
    followups: pending.followups.length,
  };
}

/**
 * Lo importado hasta ahora, para "Ver qué se importó":
 * { version, importedAt, groups: [{ kind, label, items: [{ seedId, title, gone }] }] }
 * `gone` = lo borraste de la app (no se vuelve a agregar).
 */
export function importedSummary() {
  const info = store.getSetting('workSeed');
  if (!info) return null;
  const groups = Object.entries(KINDS).map(([kind, label]) => {
    const items = Object.entries(info.imported)
      .filter(([, entry]) => entry.kind === kind)
      .map(([seedId, entry]) => {
        const item = findById(kind, entry.id);
        return { seedId, title: item?.title ?? item?.name ?? seedId, gone: !item };
      });
    return { kind, label, items };
  });
  return { version: info.version, importedAt: info.importedAt, groups };
}

function findById(kind, id) {
  if (kind === 'tasks') return store.getTask(id);
  if (kind === 'followups') return store.getFollowup(id);
  return store.getAreas({ includeHidden: true }).find((a) => a.id === id) ?? null;
}
