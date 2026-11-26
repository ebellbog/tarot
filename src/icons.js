// Draws a FontAwesome icon definition as inline SVG, without the (much larger) fontawesome-svg-core runtime.
const SVG_NS = "http://www.w3.org/2000/svg";

export function faIcon({ icon: [width, height, , , pathData] }) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "fa-icon");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData); // single-path (solid, regular, brands) icons only
  svg.append(path);
  return svg;
}
