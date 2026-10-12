// Utilidades de fechas. Todo se calcula en la hora de Montevideo,
// sin importar la zona horaria configurada en el dispositivo.

export const TIME_ZONE = 'America/Montevideo';
export const LOCALE = 'es-UY';

// Devuelve las partes de una fecha (año, mes, día, día de la semana…) en Montevideo.
function partsOf(date, options) {
  const parts = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Fecha de hoy en Montevideo como "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => p.find((x) => x.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "lunes 12 de octubre" (el sobretítulo lo pasa a mayúsculas con CSS). */
export function formatLongDate(now = new Date()) {
  const p = partsOf(now, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p.weekday} ${p.day} de ${p.month}`;
}
