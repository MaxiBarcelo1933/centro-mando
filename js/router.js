// Navegación entre pestañas. La pestaña activa vive en la dirección (#hoy, #procesos…).
// `ui` guarda estado de pantalla que no se guarda en la base (ej. el filtro elegido).

export const TABS = ['hoy', 'procesos', 'seguimientos'];
const DEFAULT_TAB = 'hoy';

export const ui = {
  followupFilter: 'todos',
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
  return TABS.includes(tab) ? tab : DEFAULT_TAB;
}

/** navigate('seguimientos', { followupFilter: 'vencidos' }) */
export function navigate(tab, params = {}) {
  Object.assign(ui, params);
  if (tab === currentTab()) requestRender();
  else location.hash = tab;
}
