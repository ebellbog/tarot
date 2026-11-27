// "Tag popularity": every tag in use, from most to least common, beside the cards that have the selected one.

import { CARDS } from "./cards.js";
import { el } from "./dom.js";
import { openDataDialog } from "./overlays.js";
import * as store from "./store.js";
import { countLabels, plural } from "./words.js";

/**
 * One entry per tag, with its cards in deck order; most cards first, ties alphabetical.
 * With `byNumber`, each content tag is split into its "one" and "multiple" cards.
 */
export function rankTags(byNumber) {
  const entries = store.KINDS.flatMap((kind) =>
    store.getTagCounts(kind).flatMap(({ tag }) => {
      const cards = CARDS.filter((c) => store.getCardTags(c.id, kind).includes(tag));
      if (!byNumber || kind !== "content") return [{ kind, tag, label: tag, cards }];
      return ["one", "multiple"].map((amount) => ({
        kind,
        tag,
        label: countLabels(tag)[amount],
        cards: cards.filter((c) => store.isMultiple(c.id, tag) === (amount === "multiple")),
      }));
    }),
  );
  return entries.filter((e) => e.cards.length > 0).sort((a, b) => b.cards.length - a.cards.length || a.label.localeCompare(b.label));
}

export function openPopularityDialog() {
  const tagList = el("ul", { class: "popularity-tags", "aria-label": "Tags, most popular first" });
  const matches = el("div", { class: "popularity-cards", "aria-live": "polite" });
  let selected = null; // the entry whose cards are listed

  const select = (entry, button) => {
    selected = entry;
    for (const b of tagList.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
    matches.className = `popularity-cards kind-${entry.kind}`;
    matches.replaceChildren(
      el("h4", {}, `${entry.label} · ${plural(entry.cards.length, "card")}`),
      el("ul", {}, ...entry.cards.map((c) => el("li", {}, c.name))),
    );
    matches.scrollTop = 0;
  };

  const render = (byNumber) => {
    const entries = rankTags(byNumber);
    const buttons = entries.map((entry) => {
      const button = el(
        "button",
        { type: "button", class: `kind-${entry.kind}`, onClick: () => select(entry, button) },
        el("span", {}, entry.label),
        el("span", { class: "popularity-count" }, String(entry.cards.length)),
      );
      return button;
    });
    tagList.replaceChildren(...buttons.map((b) => el("li", {}, b)));
    // Stay on the same tag across a re-ranking; start with the most popular.
    const i = Math.max(0, entries.findIndex((e) => e.kind === selected?.kind && e.tag === selected?.tag));
    if (!entries.length) return;
    select(entries[i], buttons[i]);
    buttons[i].scrollIntoView({ block: "nearest" });
  };

  const byNumberBox = el("input", { type: "checkbox", onChange: () => render(byNumberBox.checked) });
  openDataDialog(
    { title: "Tag popularity", className: "dialog--narrow" },
    el("label", { class: "check-toggle" }, byNumberBox, "Break down by occurrences per card (one vs multiple)"),
    el("div", { class: "popularity" }, tagList, matches),
  );
  render(false); // after opening, so that scrolling the selection into view works
}
