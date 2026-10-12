// Banner "Instalala en tu iPhone": aparece solo si la app está abierta en Safari
// del iPhone/iPad sin instalar, y si no lo descartaste antes.
import * as store from '../store.js';
import { tryAction } from './toast.js';

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function isIOS() {
  const ua = navigator.userAgent;
  // Los iPad nuevos se presentan como Mac, pero con pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function setupInstallBanner() {
  const app = document.getElementById('app');
  const banner = document.getElementById('install-banner');
  if (isStandalone() || !isIOS() || store.getSetting('installBannerDismissed')) return;

  banner.hidden = false;
  app.classList.add('has-banner');
  document.getElementById('install-banner-close').addEventListener('click', () => {
    banner.hidden = true;
    app.classList.remove('has-banner');
    tryAction(() => store.setSetting('installBannerDismissed', true));
  });
}
