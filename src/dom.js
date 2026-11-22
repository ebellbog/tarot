/**
 * Tiny DOM builder: el("button", { class: "x", onClick: fn }, "text", childNode)
 * `onXyz` props become event listeners; other props are set as properties when they
 * exist on the element, otherwise as attributes (e.g. "aria-label").
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}
