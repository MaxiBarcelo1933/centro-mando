// Pantalla "Calendario": tus tareas con fecha y tus seguimientos abiertos, al estilo Teams.
// Tres vistas: Día (con horas), Semana laboral (lunes a viernes, con horas) y Mes.
// Tocar un horario libre abre la captura con ese día y hora; tocar algo lo abre para editar.
import { el } from '../dom.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import {
  todayISO, addDays, addMonths, diffDays, startOfWeek, weekdayOf, nowMinutes,
  formatLongDate, formatShortDate, formatMonthYear, WEEKDAYS_SHORT,
} from '../dates.js';
import { ui, requestRender } from '../router.js';
import { openQuickCapture } from './captura.js';
import { openTaskEditor } from './task-sheet.js';
import { openFollowupDetail } from './followup-sheet.js';
import { viewHeader } from './common.js';

const VIEWS = { day: 'Día', week: 'Semana', month: 'Mes' };
const WORK_DAYS = 5;          // semana laboral: lunes a viernes
const DEFAULT_HOURS = [7, 21]; // franja visible si no hay nada antes o después
const HOUR_HEIGHT = { day: 60, week: 52 }; // alto en px de cada hora
const BLOCK_MINUTES = 30;     // las tareas no tienen duración: se dibujan como bloques de media hora
const MAX_MINI = 2;           // en la semana, cuántos "todo el día" se ven antes del "+N"
const MAX_DOTS = 3;           // en el mes, cuántos puntitos por día

// Posición del scroll por vista, para que no salte al redibujar (ej. al guardar una tarea).
const scroll = { key: null, top: 0 };

const pad = (n) => String(n).padStart(2, '0');
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const dayNumber = (iso) => Number(iso.slice(8));
const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function renderCalendario() {
  const today = todayISO();
  const view = Object.hasOwn(VIEWS, ui.calendarView) ? ui.calendarView : 'day';
  const date = ui.calendarDate ?? today;

  let range;
  if (view === 'day') range = dayView(date, today);
  else if (view === 'week') range = weekView(date, today);
  else range = monthView(date, today);

  const scroller = el('div', { class: 'cal__scroll' }, range.body);
  restoreScroll(scroller, `${view}:${range.key}`, range.initialTop);

  return el('section', { class: 'view cal', 'aria-labelledby': 'view-title' },
    viewHeader({ overline: 'Tareas y seguimientos con fecha', title: 'Calendario' }),
    el('div', { class: 'cal__toolbar' },
      viewSwitcher(view),
      navBar(view, date, today, range.label),
    ),
    range.fixed,
    scroller,
  );
}

// ---------- Barra de arriba ----------

function viewSwitcher(current) {
  return el('div', { class: 'segmented', role: 'group', 'aria-label': 'Vista del calendario' },
    Object.entries(VIEWS).map(([key, label]) => el('button', {
      class: 'segmented__btn',
      type: 'button',
      'aria-pressed': String(key === current),
      onclick: () => go({ calendarView: key }),
    }, label)),
  );
}

function navBar(view, date, today, label) {
  const step = (direction) => {
    if (view === 'day') return addDays(date, direction);
    if (view === 'week') return addDays(date, 7 * direction);
    return addMonths(date, direction);
  };
  const names = { day: 'día', week: 'semana', month: 'mes' };
  return el('div', { class: 'cal-nav' },
    el('button', {
      class: 'icon-btn', type: 'button', 'aria-label': `${capitalize(names[view])} anterior`,
      onclick: () => go({ calendarDate: step(-1) }),
    }, icon('back', 2)),
    el('h2', { class: 'cal-nav__label', 'aria-live': 'polite' }, label),
    el('button', {
      class: 'icon-btn', type: 'button', 'aria-label': `${capitalize(names[view])} siguiente`,
      onclick: () => go({ calendarDate: step(1) }),
    }, icon('chevron', 2)),
    el('button', {
      class: 'cal-nav__today', type: 'button',
      disabled: date === today,
      onclick: () => go({ calendarDate: null }),
    }, 'Hoy'),
  );
}

function go(params) {
  Object.assign(ui, params);
  requestRender();
}

// ---------- Vista Día ----------

function dayView(date, today) {
  const items = store.getCalendarItems(date, date, today)[date] ?? [];
  const allDay = items.filter((item) => !item.time);
  const hours = hourRange(items);

  const fixed = allDay.length > 0
    ? el('div', { class: 'cal-allday' },
      el('span', { class: 'cal-allday__label' }, 'Todo el día'),
      el('ul', { class: 'cal-allday__list' }, allDay.map((item) => el('li', {}, itemButton(item, 'cal-chip')))),
    )
    : null;

  const hourHeight = HOUR_HEIGHT.day;
  return {
    key: date,
    label: date === today ? `Hoy, ${formatLongDate(date)}` : capitalize(formatLongDate(date)),
    fixed,
    body: timeGrid([date], items, hours, hourHeight, today, 'day'),
    initialTop: initialScroll([date], items, hours, hourHeight, today),
  };
}

// ---------- Vista Semana laboral ----------

function weekView(date, today) {
  const monday = startOfWeek(date);
  const days = Array.from({ length: WORK_DAYS }, (_, i) => addDays(monday, i));
  const byDay = store.getCalendarItems(monday, addDays(monday, 6), today);
  const items = days.flatMap((d) => byDay[d] ?? []);
  const hours = hourRange(items);

  const head = el('div', { class: 'cal-week-head' },
    el('span', { 'aria-hidden': 'true' }),
    days.map((d) => el('button', {
      class: d === today ? 'cal-week-head__day is-today' : 'cal-week-head__day',
      type: 'button',
      'aria-label': `Ver el ${formatLongDate(d)}`,
      onclick: () => go({ calendarView: 'day', calendarDate: d }),
    },
    el('span', { class: 'cal-week-head__name' }, WEEKDAYS_SHORT[weekdayOf(d)]),
    el('span', { class: 'cal-week-head__num' }, String(dayNumber(d))),
    )),
  );

  // Fila "Todo el día": por día, hasta 2 nombres y "+N". Tocarla abre ese día.
  const hasAllDay = days.some((d) => (byDay[d] ?? []).some((item) => !item.time));
  const allDayRow = hasAllDay
    ? el('div', { class: 'cal-week-allday' },
      el('span', { class: 'cal-week-allday__label' }, 'Día'),
      days.map((d) => {
        const list = (byDay[d] ?? []).filter((item) => !item.time);
        if (list.length === 0) return el('span', {});
        const extra = list.length - MAX_MINI;
        return el('button', {
          class: 'cal-week-allday__cell', type: 'button',
          'aria-label': `${list.length} sin hora el ${formatLongDate(d)}. Ver el día`,
          onclick: () => go({ calendarView: 'day', calendarDate: d }),
        },
        list.slice(0, MAX_MINI).map((item) => miniBar(item)),
        extra > 0 ? el('span', { class: 'cal-more' }, `+${extra}`) : null,
        );
      }),
    )
    : null;

  // Lo del sábado y domingo no entra en la grilla: lo avisamos.
  const weekend = [addDays(monday, 5), addDays(monday, 6)];
  const weekendCount = weekend.reduce((sum, d) => sum + (byDay[d]?.length ?? 0), 0);
  const weekendHint = weekendCount > 0
    ? el('button', {
      class: 'cal-hint', type: 'button',
      onclick: () => go({ calendarView: 'day', calendarDate: weekend.find((d) => byDay[d]?.length) }),
    }, `El fin de semana tenés ${weekendCount} ${weekendCount === 1 ? 'cosa' : 'cosas'}`, icon('chevron', 2))
    : null;

  const friday = days[WORK_DAYS - 1];
  const label = monday.slice(5, 7) === friday.slice(5, 7)
    ? `${dayNumber(monday)} – ${formatShortDate(friday)}`
    : `${formatShortDate(monday)} – ${formatShortDate(friday)}`;

  const hourHeight = HOUR_HEIGHT.week;
  return {
    key: monday,
    label,
    fixed: el('div', { class: 'cal-week-top' }, weekendHint, head, allDayRow),
    body: timeGrid(days, items, hours, hourHeight, today, 'week'),
    initialTop: initialScroll(days, items, hours, hourHeight, today),
  };
}

function miniBar(item) {
  const area = store.getArea(item.area);
  const bar = el('span', { class: barClass('cal-mini', item) }, item.title);
  bar.style.setProperty('--area', area.color);
  bar.style.setProperty('--area-bg', area.bg);
  return bar;
}

// ---------- Grilla con horas (Día y Semana) ----------

/** Franja de horas a mostrar: 7 a 21, o más si hay algo antes o después. */
function hourRange(items) {
  const timed = items.filter((item) => item.time).map((item) => minutesOf(item.time));
  let [start, end] = DEFAULT_HOURS;
  if (timed.length > 0) {
    start = Math.min(start, Math.floor(Math.min(...timed) / 60));
    end = Math.max(end, Math.min(24, Math.ceil((Math.max(...timed) + BLOCK_MINUTES) / 60)));
  }
  return { start, end };
}

function timeGrid(days, items, hours, hourHeight, today, mode) {
  const hourList = Array.from({ length: hours.end - hours.start }, (_, i) => hours.start + i);
  const grid = el('div', { class: `cal-grid cal-grid--${mode}` },
    el('div', { class: 'cal-grid__hours', 'aria-hidden': 'true' },
      hourList.map((h) => el('span', { class: 'cal-grid__hour' }, `${h}:00`)),
    ),
    days.map((date) => dayColumn(date, items.filter((item) => item.time && item.date === date), hours, hourList, hourHeight, today)),
  );
  grid.style.setProperty('--hour-h', `${hourHeight}px`);
  grid.style.setProperty('--cols', String(days.length));
  return grid;
}


function dayColumn(date, timedItems, hours, hourList, hourHeight, today) {
  const label = formatLongDate(date);
  const slots = hourList.map((h) => el('button', {
    class: 'cal-slot', type: 'button',
    'aria-label': `Agregar el ${label} a las ${h}:00`,
    // La captura se abre en el mismo toque, así iOS muestra el teclado.
    onclick: () => openQuickCapture({ date, time: `${pad(h)}:00` }),
  }));

  const blocks = layoutBlocks(timedItems, hours.start).map(({ item, top, col, cols }) => {
    const block = itemButton(item, 'cal-block');
    block.style.top = `${(top / 60) * hourHeight}px`;
    block.style.height = `${(BLOCK_MINUTES / 60) * hourHeight - 2}px`;
    block.style.left = `calc(${(col / cols) * 100}% + 2px)`;
    block.style.width = `calc(${100 / cols}% - 4px)`;
    return block;
  });

  // Línea de "ahora" en el día de hoy.
  let nowLine = null;
  const now = nowMinutes() - hours.start * 60;
  if (date === today && now >= 0 && now <= (hours.end - hours.start) * 60) {
    nowLine = el('div', { class: 'cal-now', 'aria-hidden': 'true' });
    nowLine.style.top = `${(now / 60) * hourHeight}px`;
  }

  return el('div', { class: date === today ? 'cal-col is-today' : 'cal-col' }, slots, blocks, nowLine);
}

/**
 * Ubica los bloques: si dos se pisan (misma media hora), se reparten el ancho en columnas.
 * Devuelve [{ item, top (minutos desde el inicio de la grilla), col, cols }].
 */
function layoutBlocks(items, startHour) {
  const events = items
    .map((item) => {
      const top = minutesOf(item.time) - startHour * 60;
      return { item, top, end: top + BLOCK_MINUTES, col: 0, cols: 1 };
    })
    .sort((a, b) => a.top - b.top);

  let group = [];
  let groupEnd = -Infinity;
  let columnEnds = [];
  const closeGroup = () => {
    const cols = columnEnds.length;
    for (const event of group) event.cols = cols;
    group = [];
    columnEnds = [];
  };

  for (const event of events) {
    if (group.length > 0 && event.top >= groupEnd) closeGroup();
    let col = columnEnds.findIndex((end) => end <= event.top);
    if (col < 0) {
      col = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[col] = event.end;
    event.col = col;
    group.push(event);
    groupEnd = group.length === 1 ? event.end : Math.max(groupEnd, event.end);
  }
  if (group.length > 0) closeGroup();
  return events;
}

/** Al entrar: hoy → una hora antes de ahora; otro día → la primera tarea con hora, o las 8. */
function initialScroll(days, items, hours, hourHeight, today) {
  let hour;
  const firstTimed = items.find((item) => item.time);
  if (days.includes(today)) hour = Math.floor(nowMinutes() / 60) - 1;
  else if (firstTimed) hour = Math.floor(Math.min(...items.filter((i) => i.time).map((i) => minutesOf(i.time))) / 60);
  else hour = 8;
  hour = Math.max(hours.start, Math.min(hour, hours.end - 1));
  return (hour - hours.start) * hourHeight;
}

// ---------- Vista Mes ----------

function monthView(date, today) {
  const first = `${date.slice(0, 7)}-01`;
  const gridStart = startOfWeek(first);
  const nextMonth = addMonths(first, 1);
  const weeks = Math.ceil(diffDays(gridStart, nextMonth) / 7);
  const gridEnd = addDays(gridStart, weeks * 7 - 1);
  const byDay = store.getCalendarItems(gridStart, gridEnd, today);

  const names = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(gridStart, i);
    const list = byDay[d] ?? [];
    const classes = ['cal-day'];
    if (d.slice(0, 7) !== date.slice(0, 7)) classes.push('is-other');
    if (d === today) classes.push('is-today');

    const dots = el('span', { class: 'cal-day__dots', 'aria-hidden': 'true' },
      list.slice(0, MAX_DOTS).map((item) => {
        const dot = el('span', { class: 'cal-day__dot' });
        dot.style.background = store.getArea(item.area).color;
        return dot;
      }),
    );
    const count = list.length === 0 ? 'nada cargado' : `${list.length} ${list.length === 1 ? 'cosa' : 'cosas'}`;
    return el('button', {
      class: classes.join(' '),
      type: 'button',
      'aria-pressed': String(d === date),
      'aria-label': `${formatLongDate(d)}, ${count}`,
      onclick: () => go({ calendarDate: d }),
    }, el('span', { class: 'cal-day__num' }, String(dayNumber(d))), dots);
  });

  const body = el('div', { class: 'cal-month-wrap' },
    el('div', { class: 'cal-month' },
      names.map((n) => el('span', { class: 'cal-month__name', 'aria-hidden': 'true' }, n)),
      cells,
    ),
    agenda(date, byDay[date] ?? [], today),
  );

  return {
    key: date.slice(0, 7),
    label: capitalize(formatMonthYear(date)),
    fixed: null,
    body,
    initialTop: 0,
  };
}

/** Debajo del mes: la lista del día elegido. */
function agenda(date, items, today) {
  const title = date === today ? `Hoy, ${formatLongDate(date)}` : capitalize(formatLongDate(date));
  return el('section', { class: 'cal-agenda', 'aria-label': title },
    el('div', { class: 'section-head' },
      el('h3', { class: 'section-title' }, title),
      el('button', {
        class: 'btn-text', type: 'button',
        onclick: () => go({ calendarView: 'day', calendarDate: date }),
      }, 'Ver día'),
    ),
    items.length > 0
      ? el('ul', { class: 'card card--list cal-agenda__list' }, items.map((item) => el('li', {}, itemButton(item, 'cal-row'))))
      : el('p', { class: 'cal-agenda__empty' }, 'Nada cargado para este día.'),
    el('button', {
      class: 'btn-secondary btn-add', type: 'button',
      onclick: () => openQuickCapture({ date }),
    }, icon('plus', 2.2), 'Agregar en este día'),
  );
}

// ---------- Piezas ----------

function barClass(base, item) {
  const classes = [base];
  if (item.kind === 'followup') classes.push('is-followup');
  if (item.done) classes.push('is-done');
  if (item.overdue) classes.push('is-overdue');
  return classes.join(' ');
}

/** Botón de una tarea o seguimiento. Lo que muestra depende del estilo (bloque, chip o fila). */
function itemButton(item, kind) {
  const area = store.getArea(item.area);
  const what = item.kind === 'followup' ? 'Seguimiento' : (item.done ? 'Tarea hecha' : 'Tarea');
  const when = item.time ? `, ${item.time}` : '';
  const late = item.overdue ? ', atrasado' : '';
  const button = el('button', {
    class: barClass(kind, item),
    type: 'button',
    'aria-label': `${what}: ${item.title}${when}${late}`,
    onclick: () => openItem(item),
  },
  kind === 'cal-row'
    ? el('span', { class: 'cal-row__time' }, item.time ?? (item.kind === 'followup' ? 'Vence' : 'Sin hora'))
    : null,
  item.kind === 'followup' ? icon('clock', 2.2) : null,
  el('span', { class: `${kind}__title` }, item.title),
  kind === 'cal-row' ? el('span', { class: 'cal-row__area' }, area.name) : null,
  );
  button.style.setProperty('--area', area.color);
  button.style.setProperty('--area-bg', area.bg);
  return button;
}

function openItem(item) {
  if (item.kind === 'followup') {
    openFollowupDetail(item.id);
    return;
  }
  const task = store.getTask(item.id);
  if (task) openTaskEditor(task);
}

/** Vuelve a la misma posición si es la misma vista; si no, va a la hora inicial. */
function restoreScroll(scroller, key, initialTop) {
  const top = scroll.key === key ? scroll.top : initialTop;
  scroll.key = key;
  scroll.top = top;
  scroller.addEventListener('scroll', () => { scroll.top = scroller.scrollTop; }, { passive: true });
  requestAnimationFrame(() => { scroller.scrollTop = top; });
}
