// Períodos de los procesos (meses y semanas) y variables dinámicas de los pasos.
//
// - Mensual: período "YYYY-MM". Con periodOffset -1, en octubre se trabaja septiembre.
// - Semanal: período ISO "YYYY-Www" (la semana empieza el lunes).
// El "mes de referencia" es el mes en que se TRABAJA el período (octubre, para el
// cierre de septiembre). De ahí salen {MES_ACTUAL} y {MES_CORTE}.
import { MONTHS, MONTHS_SHORT, addDays, weekdayOf, formatShortDate } from './dates.js';

const pad = (n) => String(n).padStart(2, '0');
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// ---------- Meses ----------

/** "2026-10-12" → "2026-10" */
export const monthOf = (iso) => iso.slice(0, 7);

/** addMonths("2026-01", -1) → "2025-12" */
export function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

const monthIndex = (month) => Number(month.slice(5, 7)) - 1;

// ---------- Semanas ISO ----------

/** Semana ISO de una fecha: "2026-10-12" → "2026-W42" */
export function isoWeekOf(iso) {
  // El jueves de esa semana define a qué año pertenece.
  const thursday = addDays(iso, 3 - ((weekdayOf(iso) + 6) % 7));
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor((Date.parse(thursday) - Date.parse(`${year}-01-01`)) / 86400000 / 7) + 1;
  return `${year}-W${pad(week)}`;
}

/** Lunes de una semana ISO: "2026-W42" → "2026-10-12" */
export function mondayOfIsoWeek(period) {
  const [year, week] = period.split('-W').map(Number);
  // El 4 de enero siempre cae en la semana 1.
  const jan4 = `${year}-01-04`;
  const mondayWeek1 = addDays(jan4, -((weekdayOf(jan4) + 6) % 7));
  return addDays(mondayWeek1, (week - 1) * 7);
}

// ---------- Período actual de una plantilla ----------

export function currentPeriod(template, today) {
  if (template.frequency === 'weekly') {
    const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
    return isoWeekOf(addDays(monday, (template.periodOffset ?? 0) * 7));
  }
  return addMonths(monthOf(today), template.periodOffset ?? 0);
}

/** Primer día en que se trabaja el período (para calcular cuánto se tardó). */
export function periodWorkStart(template, period) {
  const offset = template.periodOffset ?? 0;
  if (template.frequency === 'weekly') return addDays(mondayOfIsoWeek(period), -offset * 7);
  return `${addMonths(period, -offset)}-01`;
}

// ---------- Variables dinámicas ----------

export function periodVariables(template, period) {
  const workStart = periodWorkStart(template, period);
  const periodMonth = template.frequency === 'weekly' ? monthOf(mondayOfIsoWeek(period)) : period;
  const reference = monthOf(workStart);
  const cut = addMonths(reference, -7);
  return {
    MES_CIERRE: MONTHS[monthIndex(periodMonth)].toUpperCase(),
    MES_ACTUAL: MONTHS[monthIndex(reference)],
    MES_CORTE: `${MONTHS_SHORT[monthIndex(cut)]}-${cut.slice(2, 4)}`,
  };
}

/** Reemplaza {MES_CIERRE}, {MES_ACTUAL} y {MES_CORTE} en un texto. */
export function resolveText(text, variables) {
  return text.replace(/\{(MES_CIERRE|MES_ACTUAL|MES_CORTE)\}/g, (match, key) => variables[key] ?? match);
}

// ---------- Textos ----------

/** "Cierre de septiembre", "Reporte · Septiembre 2026", "Revisión semanal · semana del 12 oct" */
export function periodTitle(template, period) {
  if (template.frequency === 'weekly') {
    return `${template.name} · semana del ${formatShortDate(mondayOfIsoWeek(period))}`;
  }
  const monthName = MONTHS[monthIndex(period)];
  if (/\bmes\b/i.test(template.name)) return template.name.replace(/\bmes\b/i, monthName);
  return `${template.name} · ${capitalize(monthName)} ${period.slice(0, 4)}`;
}

export function resetLegend(template) {
  return template.frequency === 'weekly' ? 'Se reinicia sola cada lunes' : 'Se reinicia sola el 1º de cada mes';
}

export function closedLabel(template) {
  return template.frequency === 'weekly' ? 'Semana cerrada' : 'Mes cerrado';
}
