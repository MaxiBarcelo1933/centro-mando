// Navegación. La pantalla activa vive en la dirección (#hoy, #procesos, #seguimientos, #calendario, #ajustes).
// `ui` guarda estado de pantalla que no se guarda en la base (ej. el filtro elegido).

export const TABS = ['hoy', 'procesos', 'seguimientos', 'calendario'];
// Ajustes no es una pestaña: se abre desde el avatar.
const ROUTES = [...TABS, 'ajustes'];
const DEFAULT_TAB = 'hoy';

export const ui = {
  followupFilter: 'todos',
  calendarView: 'day',  // 'day' | 'week' | 'month'
  calendarDate: null,   // día elegido en el calendario ("YYYY-MM-DD"); null = hoy
};

let renderer = () => {};

export function setRenderer(fn) {
  renderer = fn;
}

export function requestRender() {
  renderer();
}

export function currentTab() {
  const tab = location.hash.slice(1);
  return ROUTES.includes(tab) ? tab : DEFAULT_TAB;
}

/** navigate('seguimientos', { followupFilter: 'vencidos' }) */
export function navigate(tab, params = {}) {
  Object.assign(ui, params);
  if (tab === currentTab()) requestRender();
  else location.hash = tab;
}
