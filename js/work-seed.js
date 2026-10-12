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
  projects: 'Proyectos',
  pdvs: 'PDV',
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** id interno de un PDV: proyecto + código (el código es el identificador, nunca el nombre). */
export const pdvId = (projectId, code) => `${projectId}:${code}`;

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value) => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);

/**
 * Lee y revisa el archivo ANTES de tocar nada.
 * Devuelve { seed, pending: { areas, tasks, followups, projects, pdvs }, existing } o { error }.
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
  const projects = seed.projects ?? [];
  if (![areas, tasks, followups, projects].every(Array.isArray)) return { error: 'El archivo tiene listas dañadas.' };

  const projectError = projects.map(checkProject).find(Boolean);
  if (projectError) return { error: projectError };
  // Cada PDV usa como seedId "proyecto:código".
  const pdvs = projects.flatMap((project) => project.pdv.map((pdv) => ({ ...pdv, seedId: pdvId(project.seedId, pdv.codigo), project })));

  // Los seedId no se pueden repetir en todo el archivo.
  const ids = [...areas, ...tasks, ...followups, ...projects, ...pdvs].map((item) => item?.seedId);
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
    projects: projects.filter((p) => isNew(p) && !store.getProject(p.seedId)),
    pdvs: pdvs.filter((p) => isNew(p) && !store.getPdv(p.seedId)),
  };
  const added = Object.values(pending).reduce((total, list) => total + list.length, 0);
  return { seed, pending, existing: ids.length - added };
}

/** Revisa un proyecto y sus PDV. Devuelve el mensaje de error o null. */
function checkProject(project) {
  if (!isText(project?.seedId) || !isText(project.nombre)) return 'A un proyecto le falta seedId o nombre.';
  if (!Array.isArray(project.pdv)) return `Al proyecto ${project.seedId} le falta la lista de PDV.`;
  if (!isNumber(project.cotizacionUSD)) return `Al proyecto ${project.seedId} le falta la cotización del dólar.`;
  const codes = new Set();
  for (const pdv of project.pdv) {
    if (!isText(pdv?.codigo) || !isText(pdv.cliente)) return 'Hay un PDV sin código o sin cliente.';
    if (codes.has(pdv.codigo)) return `El código de PDV ${pdv.codigo} está repetido.`;
    codes.add(pdv.codigo);
    if (!Object.hasOwn(store.PDV_STATUSES, pdv.estado)) return `El PDV ${pdv.codigo} tiene un estado inválido ("${pdv.estado}").`;
    if (!isNumber(pdv.cotizacionUSD)) return `El PDV ${pdv.codigo} no tiene cotización en USD.`;
    if (pdv.etapa != null && !store.PDV_STAGES.some((s) => s.id === pdv.etapa)) return `El PDV ${pdv.codigo} tiene una etapa inválida.`;
    if (pdv.fechaProxima != null && !isDate(pdv.fechaProxima)) return `El PDV ${pdv.codigo} tiene una fecha inválida.`;
    if (pdv.esperandoA != null && !Object.hasOwn(store.WAITING_FOR, pdv.esperandoA)) return `El PDV ${pdv.codigo} tiene un "esperandoA" inválido.`;
  }
  // El total tiene que dar la meta (ej. 37): si no, algo se cargó mal.
  const active = project.pdv.filter((p) => p.estado !== 'REEMPLAZADO').length;
  if (isNumber(project.meta) && active !== project.meta) {
    return `El proyecto ${project.nombre} tiene ${active} PDV y la meta es ${project.meta}. Revisá el archivo.`;
  }
  for (const item of project.datosARevisar ?? []) {
    if (!codes.has(item?.codigo)) return `"Datos a revisar" menciona el PDV ${item?.codigo}, que no está en la lista.`;
  }
  return null;
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

  for (const project of pending.projects) {
    await store.addProject({
      id: project.seedId,
      seedId: project.seedId,
      name: project.nombre,
      priority: project.prioridad ?? 99,
      goal: project.meta ?? project.pdv.length,
      usdRate: project.cotizacionUSD,
      owner: project.responsable ?? '',
    });
    imported[project.seedId] = { kind: 'projects', id: project.seedId };
  }

  for (const pdv of pending.pdvs) {
    const project = pdv.project;
    const review = (project.datosARevisar ?? []).filter((r) => r.codigo === pdv.codigo).map((r) => r.motivo);
    await store.addPdv({
      id: pdv.seedId,
      seedId: pdv.seedId,
      projectId: project.seedId,
      code: pdv.codigo,
      client: pdv.cliente,
      department: pdv.departamento ?? '',
      giro: pdv.giro ?? '',
      zone: pdv.zona ?? null,
      status: pdv.estado,
      supplier: pdv.proveedor ?? '',
      quoteUSD: pdv.cotizacionUSD,
      estimatedFinish: pdv.finalizacionEstimada ?? '',
      notes: pdv.observaciones ?? '',
      nextAction: pdv.proximaAccion ?? '',
      nextDate: pdv.fechaProxima ?? null,
      waitingFor: pdv.esperandoA ?? null,
      stages: pdv.etapa ? store.stagesUpTo(pdv.etapa) : {},
      review,
    });
    imported[pdv.seedId] = { kind: 'pdvs', id: pdv.seedId };
  }

  const previous = store.getSetting('workSeed');
  await store.setSetting('workSeed', {
    version: Math.max(seed.seedVersion, previous?.version ?? 0),
    importedAt: new Date().toISOString(),
    imported,
  });
  return Object.fromEntries(Object.entries(pending).map(([kind, list]) => [kind, list.length]));
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
  if (kind === 'projects') return store.getProject(id);
  if (kind === 'pdvs') {
    const pdv = store.getPdv(id);
    return pdv && { title: `${pdv.code} · ${pdv.client}` };
  }
  return store.getAreas({ includeHidden: true }).find((a) => a.id === id) ?? null;
}
