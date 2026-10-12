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
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
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
