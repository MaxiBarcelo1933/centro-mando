// Banner "Instalala en tu iPhone": aparece solo si la app está abierta en Safari
// del iPhone/iPad sin instalar, y si no lo descartaste antes.

const DISMISSED_KEY = 'mando.installBannerDismissed';

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function isIOS() {
  const ua = navigator.userAgent;
  // Los iPad nuevos se presentan como Mac, pero con pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// localStorage puede fallar (por ejemplo en modo privado); por eso el try/catch.
// TODO Fase 2: guardar esta preferencia en el store "settings" de IndexedDB.
function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Si no se puede guardar, el banner vuelve a aparecer la próxima vez. No es grave.
  }
}

export function setupInstallBanner() {
  const app = document.getElementById('app');
  const banner = document.getElementById('install-banner');
  if (isStandalone() || !isIOS() || wasDismissed()) return;

  banner.hidden = false;
  app.classList.add('has-banner');
  document.getElementById('install-banner-close').addEventListener('click', () => {
    banner.hidden = true;
    app.classList.remove('has-banner');
    rememberDismissed();
  });
}
