// Arranque de la app y "router" por pestañas.
// La pestaña activa se guarda en la dirección (#hoy, #procesos, #seguimientos),
// así el botón "atrás" del navegador funciona en la compu.
import { el } from './dom.js';
import * as store from './store.js';
import { msUntilNextMidnight } from './dates.js';
import { currentTab, setRenderer } from './router.js';
import { renderHoy } from './views/hoy.js';
import { renderProcesos } from './views/procesos.js';
import { renderSeguimientos } from './views/seguimientos.js';
import { renderAjustes } from './views/ajustes.js';
import { openQuickCapture } from './views/captura.js';
import { showToast } from './components/toast.js';
import { setupInstallBanner } from './components/install-banner.js';
import { emptyState } from './views/common.js';

const VIEWS = {
  hoy: renderHoy,
  procesos: renderProcesos,
  seguimientos: renderSeguimientos,
  ajustes: renderAjustes,
};

const viewRoot = document.getElementById('view');
const tabs = document.querySelectorAll('.tab');
let renderedTab = null;

/** Dibuja la sección activa. Se llama en cada cambio de pestaña o de datos. */
function render() {
  const tab = currentTab();
  const view = VIEWS[tab]();
  // Al cambiar de pantalla, una entrada suave (no al redibujar la misma).
  if (tab !== renderedTab && renderedTab !== null) view.classList.add('view-enter');
  viewRoot.replaceChildren(view);
  for (const button of tabs) {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  // Al cambiar de pestaña volvemos arriba; al re-dibujar la misma, no.
  if (tab !== renderedTab) viewRoot.scrollTop = 0;
  renderedTab = tab;
  updateBadges();
}

// Globito rojo de Seguimientos + número en el ícono de la app (si está activado).
function updateBadges() {
  const overdue = store.countOverdueFollowups();
  const tabBadge = document.getElementById('badge-seguimientos');
  tabBadge.hidden = overdue === 0;
  tabBadge.textContent = String(overdue);
  tabBadge.setAttribute('aria-label', `${overdue} vencidos`);

  if (!store.getSetting('badgeEnabled') || !('setAppBadge' in navigator)) return;
  const count = store.getBadgeCount();
  const update = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  update.catch(() => {}); // si el sistema no lo permite, lo ignoramos
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
  // Se abre en el mismo toque: así iOS muestra el teclado al instante.
  document.getElementById('fab').addEventListener('click', openQuickCapture);
}

// "Hoy" se recalcula al volver a la app y justo después de la medianoche.
// Si empezó un mes o semana nueva, también se crea el checklist del período.
function refreshDay() {
  store.refreshDay().catch((error) => console.warn(error)).finally(render);
}

function setupDayRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshDay();
  });
  const scheduleMidnight = () => {
    setTimeout(() => {
      refreshDay();
      scheduleMidnight();
    }, msUntilNextMidnight() + 1000);
  };
  scheduleMidnight();
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

function showStartupError(error) {
  console.warn(error);
  document.getElementById('fab').hidden = true;
  viewRoot.replaceChildren(el('div', { class: 'view' },
    el('div', { class: 'card' },
      emptyState('No pude abrir tus datos guardados. Cerrá la app del todo y volvé a abrirla. Si sigue pasando, puede que el navegador esté en modo privado.'),
    ),
  ));
}

async function start() {
  registerServiceWorker();
  try {
    await store.init();
  } catch (error) {
    showStartupError(error);
    return;
  }
  setRenderer(render);
  store.subscribe(render);
  setupInstallBanner();
  setupTabs();
  setupFab();
  setupDayRefresh();
  render();
}

start();
