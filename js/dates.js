// Utilidades de fechas. Todo se calcula en la hora de Montevideo,
// sin importar la zona horaria configurada en el dispositivo.
// Las fechas "de calendario" se manejan como texto "YYYY-MM-DD".

export const TIME_ZONE = 'America/Montevideo';

// Nombres propios (en vez de Intl) para que salgan siempre iguales en todos los navegadores.
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Año, mes, día, hora… de un instante, vistos desde Montevideo.
function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second'),
  };
}

// "YYYY-MM-DD" ↔ Date a medianoche UTC (solo para hacer cuentas de días).
function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const fromUTC = (date) => date.toISOString().slice(0, 10);

/** Fecha de calendario (en Montevideo) de un instante: Date o texto ISO. */
export function dateOf(value) {
  const p = zonedParts(value instanceof Date ? value : new Date(value));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Fecha de hoy en Montevideo como "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  return dateOf(now);
}

export function addDays(iso, days) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** Días desde `from` hasta `to` (positivo si `to` es posterior). */
export function diffDays(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(iso) {
  return toUTC(iso).getUTCDay();
}

/** El próximo lunes (si hoy es lunes, el de la semana que viene). */
export function nextMonday(iso) {
  const delta = (8 - weekdayOf(iso)) % 7 || 7;
  return addDays(iso, delta);
}

/** "lunes 12 de octubre" */
export function formatLongDate(iso = todayISO()) {
  const d = toUTC(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

/** "9 oct" */
export function formatShortDate(iso) {
  const d = toUTC(iso);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "mié 14" */
export function formatWeekdayDay(iso) {
  const d = toUTC(iso);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** "Hoy", "Mañana", "Ayer", "Mié 14" (esta semana) o "21 oct". */
export function relativeDayLabel(iso, today = todayISO()) {
  const diff = diffDays(today, iso);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff < 7) return capitalize(formatWeekdayDay(iso));
  return formatShortDate(iso);
}

/** Para tareas atrasadas: "desde ayer", "desde el lun 5", "desde el 28 sep". */
export function overdueSinceLabel(iso, today = todayISO()) {
  const diff = diffDays(iso, today);
  if (diff <= 1) return 'desde ayer';
  if (diff <= 7) return `desde el ${formatWeekdayDay(iso)}`;
  return `desde el ${formatShortDate(iso)}`;
}

/** Milisegundos que faltan para la próxima medianoche de Montevideo. */
export function msUntilNextMidnight(now = new Date()) {
  const p = zonedParts(now);
  return ((24 - p.hour) * 3600 - p.minute * 60 - p.second) * 1000 - now.getMilliseconds();
}

/** Lunes de la semana de `iso` (la semana empieza el lunes). */
export function startOfWeek(iso) {
  return addDays(iso, -((weekdayOf(iso) + 6) % 7));
}

/** Suma meses y queda en el día 1: addMonths('2026-10-12', 1) → '2026-11-01'. */
export function addMonths(iso, months) {
  const d = toUTC(iso);
  return fromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)));
}

/** "octubre 2026" */
export function formatMonthYear(iso) {
  const d = toUTC(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Minutos que pasaron desde la medianoche en Montevideo (para la línea de "ahora"). */
export function nowMinutes(now = new Date()) {
  const p = zonedParts(now);
  return p.hour * 60 + p.minute;
}

/** Día hábil: de lunes a viernes y que no sea feriado. */
export function isBusinessDay(iso, holidays = []) {
  const weekday = weekdayOf(iso);
  return weekday !== 0 && weekday !== 6 && !holidays.includes(iso);
}

/** El próximo día hábil DESPUÉS de `iso`. */
export function nextBusinessDay(iso, holidays = []) {
  let day = addDays(iso, 1);
  while (!isBusinessDay(day, holidays)) day = addDays(day, 1);
  return day;
}
