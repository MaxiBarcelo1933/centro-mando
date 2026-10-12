// Íconos SVG de trazo. Son textos fijos escritos por nosotros (no datos del usuario),
// por eso es seguro convertirlos a elementos.

const PATHS = {
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  checklist: '<path d="M4 6.5l1.7 1.7L9 5M4 12.5l1.7 1.7L9 11M4 18.5l1.7 1.7L9 17"/><path d="M12.5 7h7.5M12.5 13h7.5M12.5 19h7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M6 12.5l4 4 8-9"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.8v.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V11"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M9 7V4.5h6V7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
  flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-2.5 4 2.5 4H5.5"/>',
  alert: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4"/><path d="M12 16.8v.01"/>',
};

// Ilustraciones para estados vacíos (viewBox más grande, con acento ámbar)
const ILLUSTRATIONS = {
  emptyDay:
    '<rect x="12" y="16" width="48" height="44" rx="10" stroke="#3A4250"/>' +
    '<path d="M12 29h48M25 10v10M47 10v10" stroke="#3A4250"/>' +
    '<path d="M27 44l6 6 13-13" stroke="#F5A524"/>',
  emptyList:
    '<rect x="14" y="12" width="44" height="50" rx="10" stroke="#3A4250"/>' +
    '<path d="M24 28h24M24 38h24M24 48h14" stroke="#3A4250"/>' +
    '<circle cx="52" cy="52" r="10" stroke="#F5A524"/><path d="M52 47v5l3 2" stroke="#F5A524"/>',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(viewBox, inner, strokeWidth) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = inner;
  return svg;
}

export function icon(name, strokeWidth = 1.9) {
  return build('0 0 24 24', PATHS[name], strokeWidth);
}

export function illustration(name) {
  return build('0 0 72 72', ILLUSTRATIONS[name], 2.4);
}
