// "Visualize data": the decision tree "Ask best question" would follow, for every card the game can pick.
// Drawn left to right as SVG: each question splits into a "yes" branch (solid) and a "no" branch (dashed).
// Leaves are card names; a red leaf holds several cards whose tags are identical, so no question splits them.

import { el } from "./dom.js";
import { playableCards } from "./game.js";
import { buildTree } from "./questions.js";
import { countLabels, plural } from "./words.js";

const ROW = 20; // px per leaf card
const CHAR = 6.8; // rough px per character at the 12px label size, for sizing columns
const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

/** Short node label: "calm?" or "multiple dogs?" (the full question is in the tooltip). */
const shortLabel = (q) => (q.kind === "content" ? `${countLabels(q.tag)[q.amount]}?` : `${q.tag}?`);
const fullLabel = (q) =>
  q.kind === "content" ? `Does this card contain ${countLabels(q.tag)[q.amount]}?` : `Is this card ${q.tag}?`;

/** Summary numbers: how many questions until a card is pinned down (or stuck in a group), on average and at worst. */
function treeStats(tree, total) {
  let sum = 0;
  let max = 0;
  let groups = 0;
  let grouped = 0;
  const walk = (node, depth) => {
    if (node.cards) {
      sum += depth * node.cards.length;
      max = Math.max(max, depth);
      if (node.cards.length > 1) {
        groups++;
        grouped += node.cards.length;
      }
      return;
    }
    walk(node.yes, depth + 1);
    walk(node.no, depth + 1);
  };
  walk(tree, 0);
  return { average: total ? sum / total : 0, max, groups, grouped };
}

/** Assigns x/y to every node (leaves stacked top to bottom, each question centered on its branches). */
function layout(tree) {
  let rows = 0;
  let maxDepth = 0;
  let longestQuestion = 0;
  let longestLeaf = 0;
  const place = (node, depth) => {
    node.depth = depth;
    maxDepth = Math.max(maxDepth, depth);
    if (node.cards) {
      if (node.cards.length > 1) rows += 0.4; // breathing room around groups
      node.top = rows;
      node.y = (rows + (node.cards.length - 1) / 2) * ROW;
      rows += node.cards.length;
      if (node.cards.length > 1) rows += 0.4;
      for (const c of node.cards) longestLeaf = Math.max(longestLeaf, c.name.length);
      return;
    }
    longestQuestion = Math.max(longestQuestion, shortLabel(node.q).length);
    place(node.yes, depth + 1);
    place(node.no, depth + 1);
    node.y = (node.yes.y + node.no.y) / 2;
  };
  place(tree, 0);

  const col = Math.max(140, longestQuestion * CHAR + 40);
  const left = shortLabel(tree.q ?? { kind: "descriptor", tag: "" }).length * CHAR + 20;
  const setX = (node) => {
    node.x = left + node.depth * col;
    if (!node.cards) {
      setX(node.yes);
      setX(node.no);
    }
  };
  setX(tree);
  return { width: left + maxDepth * col + longestLeaf * CHAR + 40, height: rows * ROW + ROW };
}

function drawTree(tree) {
  const { width, height } = layout(tree);
  const edges = svg("g", { class: "tree-edges" });
  const nodes = svg("g", { class: "tree-nodes" });

  const draw = (node) => {
    if (node.cards) {
      const group = node.cards.length > 1;
      const g = svg("g", { class: group ? "tree-leaf is-group" : "tree-leaf" });
      g.append(svg("circle", { cx: node.x, cy: node.y, r: 3.5 }));
      if (group) {
        const top = node.top * ROW;
        const bottom = top + (node.cards.length - 1) * ROW;
        g.append(svg("path", { class: "tree-bracket", d: `M${node.x + 10} ${top - 6} v${bottom - top + 12}` }));
        g.append(svg("title", {}, `${node.cards.length} cards with identical tags: no question tells them apart`));
      }
      node.cards.forEach((c, i) => {
        g.append(svg("text", { x: node.x + (group ? 16 : 9), y: (group ? node.top * ROW + i * ROW : node.y) + 4 }, c.name));
      });
      nodes.append(g);
      return;
    }
    for (const [branch, child] of [
      ["yes", node.yes],
      ["no", node.no],
    ]) {
      const mid = (node.x + child.x) / 2;
      edges.append(
        svg("path", { class: `tree-edge is-${branch}`, d: `M${node.x} ${node.y} C${mid} ${node.y} ${mid} ${child.y} ${child.x} ${child.y}` }),
      );
      draw(child);
    }
    nodes.append(
      svg(
        "g",
        { class: "tree-question" },
        svg("title", {}, fullLabel(node.q)),
        svg("circle", { cx: node.x, cy: node.y, r: 4 }),
        svg("text", { x: node.x - 8, y: node.y - 7, "text-anchor": "end" }, shortLabel(node.q)),
      ),
    );
  };
  draw(tree);

  const pad = ROW; // room above the first row of text
  return svg(
    "svg",
    { class: "tree", width, height: height + pad, viewBox: `0 ${-pad} ${width} ${height + pad}`, role: "img", "aria-label": "Decision tree of questions" },
    edges,
    nodes,
  );
}

export function openTreeDialog() {
  const cards = playableCards();
  const tree = buildTree(cards);
  const stats = treeStats(tree, cards.length);

  const summary = el(
    "p",
    { class: "tree-summary" },
    `${plural(cards.length, "tagged card")} · on average ${stats.average.toFixed(1)} questions to narrow down a card · worst case ${stats.max}`,
    stats.groups > 0
      ? el("span", { class: "is-group" }, ` · ${plural(stats.groups, "group")} of identical cards (${stats.grouped} cards)`)
      : " · every card can be told apart",
  );
  const legend = el(
    "p",
    { class: "tree-legend" },
    el("span", { class: "legend-yes" }, "yes"),
    el("span", { class: "legend-no" }, "no"),
    el("span", { class: "legend-group" }, "cards no question can tell apart"),
  );
  const close = el("button", { type: "button", class: "button button--ghost", onClick: () => dialog.close() }, "Close");
  const dialog = el(
    "dialog",
    { class: "dialog dialog--tree", "aria-label": "Visualize data" },
    el("div", { class: "tree-header" }, el("h3", {}, "How your tags narrow down the cards"), close),
    summary,
    legend,
    el("div", { class: "tree-scroll" }, drawTree(tree)),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
