// Arranque de la app y "router" por pestañas.
// La pestaña activa se guarda en la dirección (#hoy, #procesos, #seguimientos),
// así el botón "atrás" del navegador funciona en la compu.
import { renderHoy } from './views/hoy.js';
import { renderProcesos } from './views/procesos.js';
import { renderSeguimientos } from './views/seguimientos.js';
import { showToast } from './components/toast.js';
import { setupInstallBanner } from './components/install-banner.js';

const VIEWS = {
  hoy: renderHoy,
  procesos: renderProcesos,
  seguimientos: renderSeguimientos,
};
const DEFAULT_TAB = 'hoy';

const viewRoot = document.getElementById('view');
const tabs = document.querySelectorAll('.tab');
let renderedTab = null;

function currentTab() {
  const tab = location.hash.slice(1);
  return Object.hasOwn(VIEWS, tab) ? tab : DEFAULT_TAB;
}

/** Dibuja la sección activa. Se llama en cada cambio de pestaña o de datos. */
export function render() {
  const tab = currentTab();
  viewRoot.replaceChildren(VIEWS[tab]());
  for (const button of tabs) {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  // Al cambiar de pestaña volvemos arriba; al re-dibujar la misma, no.
  if (tab !== renderedTab) viewRoot.scrollTop = 0;
  renderedTab = tab;
}

function setupTabs() {
  for (const button of tabs) {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      if (tab === currentTab()) viewRoot.scrollTo({ top: 0, behavior: 'smooth' });
      else location.hash = tab;
    });
  }
  window.addEventListener('hashchange', render);
}

function setupFab() {
  document.getElementById('fab').addEventListener('click', () => {
    showToast('La captura rápida llega en la Fase 2');
  });
}

// Si la app queda abierta de un día para otro, al volver a verla se recalcula "hoy".
function setupDayRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });
}

// Service worker: el "ayudante" que guarda una copia de la app para que ande sin internet.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Solo avisamos si ya había una versión anterior funcionando (no en la primera instalación).
    if (hadController) {
      showToast('Hay una versión nueva de la app', {
        actionLabel: 'Recargar',
        onAction: () => location.reload(),
        duration: 10000,
      });
    }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('No se pudo registrar el service worker', error);
    });
  });
}

setupInstallBanner();
setupTabs();
setupFab();
setupDayRefresh();
render();
registerServiceWorker();
