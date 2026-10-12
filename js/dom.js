// Ayudante para crear elementos del DOM de forma segura.
// Los textos se agregan siempre como nodos de texto (nunca como HTML),
// así nada de lo que escribas en la app puede "inyectar" HTML.

/**
 * el('button', { class: 'x', onclick: fn }, 'Texto', otroNodo)
 * - attrs: atributos; las claves "onX" con función se registran como eventos.
 * - children: strings (se convierten a texto), nodos o arrays de ellos.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}
