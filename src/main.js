import { CARDS, imageUrl } from "./cards.js";
import { el } from "./dom.js";
import { createGame, playableCards } from "./game.js";
import { openContextMenu, openDialog } from "./overlays.js";
import * as store from "./store.js";
import { countLabels, plural } from "./words.js";
import { identicalTagMap } from "./questions.js";
import { openTreeDialog } from "./visualize.js";
import { buildExport, loadDefaultTags, parseImport } from "./transfer.js";

// ---------- layouts ----------
// A layout is a list of sections covering all 78 cards exactly once:
//   { title, cards, note?, keepSlots?, build?(figures) }
// `keepSlots` sections dim non-matching cards in place instead of hiding them, so a
// positional grid keeps its alignment while filtering. `build` customizes the body.

const MAJORS = CARDS.filter((c) => c.arcana === "major");
// `pinned` sections stay visible even when a filter leaves them empty, because they hold the layout toggle.
const MAJOR_SECTION = { title: "Major Arcana", cards: MAJORS, pinned: true };
const MINOR_COUNT = CARDS.length - MAJORS.length;
const SUIT_SECTIONS = [
  ["Wands", "wands"],
  ["Cups", "cups"],
  ["Swords", "swords"],
  ["Pentacles", "pentacles"],
].map(([title, suit]) => ({ title, cards: CARDS.filter((c) => c.suit === suit) }));

const RANK_TITLES = ["Aces", "Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Pages", "Knights", "Queens", "Kings"];

/**
 * Rachel Pollack's arrangement (Seventy-Eight Degrees of Wisdom): the Fool stands apart
 * above the rest; Majors I-VII, VIII-XIV and XV-XXI form three rows of seven, so
 * e.g. The Lovers (VI) sits directly above Death (XIII). She defines it for the Majors only.
 */
function buildThreeRows(figures) {
  const [fool, ...rest] = figures;
  return el(
    "div",
    { class: "threes" },
    el("div", { class: "threes-inner" }, el("div", { class: "threes-fool" }, fool), el("div", { class: "threes-rows" }, ...rest)),
  );
}

// Majors and minors are laid out independently. The page shows the major section(s)
// first, then the minor sections.
const LAYOUT_GROUPS = {
  major: {
    label: "Majors",
    options: {
      default: {
        label: "Default",
        hint: "All 22 Major Arcana in order, 0–21",
        sections: () => [MAJOR_SECTION],
      },
      rows: {
        label: "3 × 7 (Pollack)",
        hint: "Rachel Pollack's arrangement: the Fool above three rows of seven",
        sections: () => [
          {
            ...MAJOR_SECTION,
            note: "Rachel Pollack's arrangement (Seventy-Eight Degrees of Wisdom): the Fool stands apart, and I–VII, VIII–XIV and XV–XXI form three rows of seven. Cards that don't match a filter are dimmed rather than hidden, so the grid keeps its shape.",
            keepSlots: true,
            build: buildThreeRows,
          },
        ],
      },
    },
  },
  minor: {
    label: "Minors",
    options: {
      suit: {
        label: "By suit",
        hint: "One section per suit: Wands, Cups, Swords, Pentacles",
        sections: () => SUIT_SECTIONS,
      },
      number: {
        label: "By number",
        hint: "Grouped by rank: all the Aces, all the Twos, … all the Kings",
        sections: () =>
          RANK_TITLES.map((title, i) => ({ title, cards: CARDS.filter((c) => c.arcana === "minor" && c.number === i + 1) })),
      },
    },
  },
};
const LAYOUT_GROUP_IDS = Object.keys(LAYOUT_GROUPS);
const DEFAULT_LAYOUT = { major: "default", minor: "suit" };

const LAYOUT_KEY = "tarot-memory:layout:v2"; // { major, minor }
const LEGACY_LAYOUT_KEY = "tarot-memory:layout:v1"; // one of "arcana" | "number" | "rows"
const LEGACY_LAYOUTS = { arcana: { major: "default", minor: "suit" }, number: { major: "default", minor: "number" }, rows: { major: "rows", minor: "suit" } };

/** Saved choice (or the migrated v1 choice), validated; anything unrecognized falls back to the default. */
function loadLayout() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null");
    if (!raw || typeof raw !== "object") {
      const legacy = localStorage.getItem(LEGACY_LAYOUT_KEY);
      raw = Object.hasOwn(LEGACY_LAYOUTS, legacy) ? LEGACY_LAYOUTS[legacy] : null;
    }
  } catch {
    raw = null; // storage unavailable or corrupt
  }
  return Object.fromEntries(
    LAYOUT_GROUP_IDS.map((g) => [g, Object.hasOwn(LAYOUT_GROUPS[g].options, raw?.[g]) ? raw[g] : DEFAULT_LAYOUT[g]]),
  );
}

// UI copy per tag kind (the kinds themselves live in the store).
const KIND_UI = {
  descriptor: {
    noun: "descriptor",
    groupTitle: "Descriptors",
    filterLabel: "Is…",
    filterHint: "Descriptors: this card is…",
    newLabel: "New descriptor…",
    placeholder: "e.g. calm, then Enter",
  },
  content: {
    noun: "content",
    groupTitle: "Contents",
    filterLabel: "Has…",
    filterHint: "Contents: this card has…",
    newLabel: "New content…",
    placeholder: "e.g. a dog, then Enter",
  },
};
const KINDS = store.KINDS;

const taggedCardCount = () => CARDS.filter((c) => store.isTagged(c.id)).length;

// ---------- state ----------

const filter = {
  selected: Object.fromEntries(KINDS.map((k) => [k, new Set()])), // kind -> Set of tags
  // Per kind: tag -> "one" | "multiple" (contents only) | "none" (negated). A selected tag with no entry just means "has it".
  variant: Object.fromEntries(KINDS.map((k) => [k, new Map()])),
  mode: "all",
  duplicatesOnly: false, // hide cards with a unique tag set (show untagged and identically-tagged cards)
};
let layout = { ...DEFAULT_LAYOUT }; // { major, minor }: chosen option per layout group
const selectedCount = () => KINDS.reduce((n, k) => n + filter.selected[k].size, 0);
// The filter chips can be folded away, leaving just the "Showing x of y cards" line. Remembered between visits.
const COLLAPSE_KEY = "tarot-memory:filters-collapsed:v1";
let filtersCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
const filtersActive = () => selectedCount() > 0 || filter.duplicatesOnly;

// card.id -> other tagged cards with exactly the same tags. Rebuilt lazily after each tag change.
let twinCache = null;
function twinsOf(card) {
  twinCache ??= identicalTagMap(CARDS.filter((c) => store.isTagged(c.id)));
  return twinCache.get(card.id) ?? [];
}

const cardRefs = new Map(); // card.id -> { card, figure, tagsEl, addEls: { [kind]: button|input } }
const sectionRefs = []; // current layout's card sections: { section, countEl, cards, keepSlots, pinned, shown }
let minorGroup = null; // { countEl, sections }: the "Minor Arcana" heading's running count
let toolbar; // refs to toolbar elements

// ---------- cards ----------

function buildCard(card) {
  const img = el("img", {
    src: imageUrl(card, 330),
    srcset: `${imageUrl(card, 330)} 1x, ${imageUrl(card, 500)} 2x`,
    alt: card.name,
    loading: "lazy",
    decoding: "async",
    width: 330,
    height: 570, // approximate RWS aspect ratio; avoids layout shift while loading
  });
  const tagsEl = el("div", { class: "card-tags" });
  const figure = el("figure", { class: "card" }, img, el("figcaption", {}, card.name), tagsEl);
  img.addEventListener("error", () => figure.classList.add("card--broken"));

  const ref = { card, figure, tagsEl, addEls: {} };
  cardRefs.set(card.id, ref);
  renderCardTags(ref);
  return figure;
}

function renderCardTags(ref) {
  const { card } = ref;
  const groups = KINDS.map((kind) => {
    const chips = store.getCardTags(card.id, kind).map((tag) => {
      const multiple = kind === "content" && store.isMultiple(card.id, tag);
      return el(
        "span",
        { class: `tag${multiple ? " tag--multiple" : ""}` },
        tag,
        kind === "content" &&
          el(
            "button",
            {
              type: "button",
              class: "tag-count",
              title: multiple ? `Multiple "${tag}". Click to change to one.` : `One "${tag}". Click to change to multiple.`,
              "aria-label": `${tag} on ${card.name}: ${multiple ? "multiple" : "one"}. Toggle.`,
              "aria-pressed": String(multiple),
              onClick: () => store.toggleMultiple(card.id, tag),
            },
            multiple ? "2+" : "1",
          ),
        el(
          "button",
          {
            type: "button",
            class: "tag-remove",
            title: `Remove "${tag}"`,
            "aria-label": `Remove ${kind} "${tag}" from ${card.name}`,
            onClick: () => store.removeTag(card.id, kind, tag),
          },
          "×",
        ),
      );
    });
    ref.addEls[kind] = buildAddButton(ref, kind);
    return el(
      "div",
      { class: `tag-group kind-${kind}` },
      el("h4", { class: "tag-group-title" }, KIND_UI[kind].groupTitle),
      el("div", { class: "tag-list" }, ...chips, ref.addEls[kind]),
    );
  });
  ref.tagsEl.replaceChildren(...[...groups, twinsFooter(card)].filter(Boolean));
}

/** "Unique" or "Same tags as n other cards" (untagged cards aren't in the game, so they get no footer). */
function twinsFooter(card) {
  if (!store.isTagged(card.id)) return null;
  const twins = twinsOf(card);
  return twins.length === 0
    ? el("p", { class: "card-twins", title: "No other card has exactly these tags" }, "Unique")
    : el(
        "p",
        { class: "card-twins is-duplicate", title: `No question can tell this card apart from: ${twins.map((c) => c.name).join(", ")}` },
        `Same tags as ${plural(twins.length, "other card")}`,
      );
}

/** The small "+" button that opens a menu of existing tags of this kind (minus ones already on the card) plus "New…". */
function buildAddButton(ref, kind) {
  const { card } = ref;
  const ui = KIND_UI[kind];
  const button = el(
    "button",
    {
      type: "button",
      class: "tag-add",
      title: `Add ${ui.noun}`,
      "aria-label": `Add ${ui.noun} to ${card.name}`,
      "aria-haspopup": "menu",
      onClick: () => {
        const mine = store.getCardTags(card.id, kind);
        const available = store.getTagCounts(kind).map((t) => t.tag).filter((t) => !mine.includes(t));
        const rect = button.getBoundingClientRect();
        // "New…" first, then the 3 most recently added tags, then everything else alphabetically.
        const recent = recentTags[kind].filter((t) => available.includes(t)).slice(0, RECENT_SHOWN);
        const rest = available.filter((t) => !recent.includes(t));
        const item = (tag) => ({ label: tag, onSelect: () => commitTag(ref, kind, tag) });
        openContextMenu(rect.left, rect.bottom + 4, [
          { label: ui.newLabel, accent: true, onSelect: () => startNewTag(ref, kind, button) },
          ...(recent.length ? [{ heading: "Recent" }, ...recent.map(item)] : []),
          // With no "Recent" section there's no heading to draw the rule under "New…", so the first tag does.
          ...(rest.length
            ? recent.length
              ? [{ heading: "All" }, ...rest.map(item)]
              : rest.map((tag, i) => ({ ...item(tag), separator: i === 0 }))
            : []),
        ]);
      },
    },
  );
  return button;
}

function startNewTag(ref, kind, addButton) {
  const ui = KIND_UI[kind];
  const input = el("input", {
    type: "text",
    class: "tag-input",
    maxLength: 40,
    placeholder: ui.placeholder,
    "aria-label": `New ${ui.noun} for ${ref.card.name}`,
  });
  let finished = false;
  const finish = (commit) => {
    if (finished) return; // Enter re-renders, which blurs the removed input; ignore that
    finished = true;
    if (commit && input.value.trim()) commitTag(ref, kind, input.value);
    else renderCardTags(ref);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(false));

  addButton.replaceWith(input);
  ref.addEls[kind] = input;
  input.focus();
}

// Most recently added tags per kind (newest first), remembered across visits for the add menus.
const RECENT_KEY = "tarot-memory:recent:v1";
const RECENT_SHOWN = 3;
const recentTags = (() => {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(RECENT_KEY));
  } catch {
    /* none saved, or unreadable */
  }
  return Object.fromEntries(KINDS.map((k) => [k, Array.isArray(saved?.[k]) ? saved[k].filter((t) => typeof t === "string") : []]));
})();

function rememberRecent(kind, tag) {
  recentTags[kind] = [tag, ...recentTags[kind].filter((t) => t !== tag)].slice(0, 10); // spare room: some may be on the card already
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentTags));
  } catch {
    /* recents are a nicety; ignore */
  }
}

/** Add a tag, then put focus back on that add control so tagging can continue by keyboard. */
function commitTag(ref, kind, raw) {
  const added = store.addTag(ref.card.id, kind, raw); // notifies subscribers, which re-render
  if (added) rememberRecent(kind, added);
  renderCardTags(ref); // also covers the no-op case (duplicate tag)
  ref.addEls[kind].focus();
}

// ---------- tag management (rename / delete everywhere) ----------

function showTagMenu(e, kind, tag, count) {
  e.preventDefault();
  // Keyboard-invoked context menus (Menu key / Shift+F10) report 0,0; anchor to the chip instead.
  const fromKeyboard = e.clientX === 0 && e.clientY === 0;
  const rect = e.currentTarget.getBoundingClientRect();
  openContextMenu(fromKeyboard ? rect.left : e.clientX, fromKeyboard ? rect.bottom : e.clientY, [
    { label: "Rename…", onSelect: () => renameTagFlow(kind, tag) },
    { label: `Delete from all cards (${count})`, danger: true, onSelect: () => deleteTagFlow(kind, tag, count) },
  ]);
}

async function renameTagFlow(kind, tag) {
  const ui = KIND_UI[kind];
  const result = await openDialog({
    title: `Rename ${ui.noun} "${tag}"`,
    message: "Applies to every card that has it. If the new name already exists, the two are merged.",
    input: { value: tag, label: `New name for ${tag}` },
    actions: [{ label: "Rename", value: "rename", kind: "primary" }],
  });
  if (!result) return;

  const wasSelected = filter.selected[kind].has(tag);
  const wasVariant = filter.variant[kind].get(tag);
  const renamed = store.renameTag(kind, tag, result.input);
  if (renamed && wasSelected) {
    // The store's update already dropped the old name from the filter; carry the selection over.
    filter.selected[kind].add(renamed);
    if (wasVariant) filter.variant[kind].set(renamed, wasVariant);
    updateFilterUI();
  }
}

async function deleteTagFlow(kind, tag, count) {
  const ui = KIND_UI[kind];
  const result = await openDialog({
    title: `Delete ${ui.noun} "${tag}"?`,
    message: `This removes it from ${plural(count, "card")}. This can't be undone.`,
    actions: [{ label: "Delete", value: "delete", kind: "danger" }],
  });
  if (result) store.deleteTag(kind, tag);
}

// ---------- import / export / clear ----------

// Prefer a real "Save as" dialog (Chromium browsers), which lets you pick a folder and overwrite an
// existing file such as public/default-tarot-tags.json. Elsewhere, fall back to a plain download.
async function exportTags() {
  const json = JSON.stringify(buildExport(), null, 2);
  const name = `tarot-tags-${new Date().toISOString().slice(0, 10)}.json`;

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        id: "tarot-tags-export", // the browser remembers the last folder used for this id
        suggestedName: name,
        types: [{ description: "Tarot tags (JSON)", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // cancelled the dialog
      console.warn("Save dialog failed, downloading instead:", err);
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function importTagsFromFile(file, { firstRun = false } = {}) {
  const problem = (message) =>
    openDialog({ title: "Can't import that file", message, cancelLabel: "OK" });

  let text;
  try {
    text = await file.text();
  } catch {
    return problem("The file couldn't be read.");
  }
  const parsed = parseImport(text);
  if (!parsed.ok) return problem(parsed.error);
  if (firstRun) return store.importTags(parsed.tags, "replace"); // nothing to merge with or lose

  const existing = taggedCardCount();
  const skipped = parsed.ignored ? ` ${plural(parsed.ignored, "entry")} for unknown cards will be skipped.` : "";
  const result = await openDialog({
    title: "Import tags",
    message:
      `Found ${plural(parsed.tagCount, "tag")} on ${plural(parsed.cardCount, "card")}.${skipped}\n\n` +
      `Add to existing keeps your current tags and merges these in.\n` +
      `Replace existing discards your current tags (${plural(existing, "tagged card")}) first.`,
    actions: [
      { label: "Replace existing", value: "replace", kind: "danger" },
      { label: "Add to existing", value: "append", kind: "primary" },
    ],
  });
  if (result) store.importTags(parsed.tags, result.value);
}

async function clearTagsFlow() {
  const result = await openDialog({
    title: "Clear all tags?",
    message: `This removes every tag from ${plural(taggedCardCount(), "tagged card")}. This can't be undone, so export first if you want a backup.`,
    actions: [{ label: "Clear all tags", value: "clear", kind: "danger" }],
  });
  if (result) store.clearAllTags();
}

// ---------- filters ----------

function matches(card) {
  // "Only cards without unique tags": hide cards whose tags no other card shares (untagged cards stay).
  if (filter.duplicatesOnly && store.isTagged(card.id) && twinsOf(card).length === 0) return false;
  const picks = KINDS.flatMap((k) =>
    [...filter.selected[k]].map((t) => {
      const has = store.getCardTags(card.id, k).includes(t);
      const want = filter.variant[k].get(t);
      if (want === "none") return !has;
      return has && (!want || store.isMultiple(card.id, t) === (want === "multiple"));
    }),
  );
  if (picks.length === 0) return true;
  return filter.mode === "all" ? picks.every(Boolean) : picks.some(Boolean);
}

function buildToolbar() {
  const groups = {};
  const groupEls = KINDS.map((kind) => {
    const chips = el("div", { class: "chips" });
    groups[kind] = chips;
    return el(
      "div",
      { class: `chip-group kind-${kind}`, title: KIND_UI[kind].filterHint },
      el("span", { class: "chip-group-label" }, KIND_UI[kind].filterLabel),
      chips,
    );
  });

  const modeAll = el("button", { type: "button", class: "seg", onClick: () => setMode("all") }, "All");
  const modeAny = el("button", { type: "button", class: "seg", onClick: () => setMode("any") }, "Any");
  const modeGroup = el("div", { class: "mode", title: "Show cards that have all, or any, of the selected tags" }, "Match", modeAll, modeAny);
  const clearFiltersBtn = el("button", { type: "button", class: "link-button", onClick: clearFilters }, "Clear filters");

  const fileInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onChange: () => {
      const file = fileInput.files[0];
      fileInput.value = ""; // so picking the same file again still fires `change`
      if (file) importTagsFromFile(file);
    },
  });
  // Export / Import / Clear share one "Manage tags" menu.
  const manageBtn = el(
    "button",
    {
      type: "button",
      class: "button",
      "aria-haspopup": "menu",
      onClick: () => {
        const hasTags = taggedCardCount() > 0;
        const rect = manageBtn.getBoundingClientRect();
        openContextMenu(rect.right, rect.bottom + 4, [
          { label: "Export tags…", disabled: !hasTags, onSelect: exportTags },
          { label: "Import tags…", onSelect: () => fileInput.click() },
          { label: "Clear tags…", danger: true, separator: true, disabled: !hasTags, onSelect: clearTagsFlow },
        ], { alignRight: true }); // it sits at the page's right edge
      },
    },
    "Manage tags ▾",
  );
  const visualizeBtn = el("button", { type: "button", class: "button button--plain", onClick: openTreeDialog }, "Visualize data");

  const duplicatesBox = el("input", {
    type: "checkbox",
    onChange: () => {
      filter.duplicatesOnly = duplicatesBox.checked;
      updateFilterUI();
    },
  });
  const duplicatesToggle = el(
    "label",
    { class: "check-toggle", title: "Untagged cards, and cards whose tags exactly match another card's (no question can tell those apart)" },
    duplicatesBox,
    "Only cards without unique tags",
  );

  // "Showing x of y cards": last row of the sticky toolbar, so it stays visible while scrolling.
  const status = el("div", { class: "status", role: "status" });
  const collapseBtn = el("button", { type: "button", class: "toolbar-toggle", onClick: toggleFiltersCollapsed });
  const activeSummary = el("span", { class: "toolbar-active" }); // shown only while collapsed, since the chips are hidden then
  const foot = el("div", { class: "toolbar-foot" }, status, activeSummary);

  // Data actions live in the page header's top-right corner (see #actions in index.html).
  document.getElementById("actions").append(visualizeBtn, manageBtn, fileInput);
  document
    .getElementById("toolbar")
    .append(
      el(
        "div",
        { class: "toolbar-inner" },
        collapseBtn,
        ...groupEls,
        el("div", { class: "toolbar-row" }, modeGroup, duplicatesToggle, clearFiltersBtn),
        foot,
      ),
    );
  return {
    groups,
    modeAll,
    modeAny,
    modeGroup,
    clearFiltersBtn,
    duplicatesBox,
    visualizeBtn,
    collapseBtn,
    activeSummary,
    status,
  };
}

function setMode(mode) {
  filter.mode = mode;
  updateFilterUI();
}

function toggleFiltersCollapsed() {
  filtersCollapsed = !filtersCollapsed;
  try {
    localStorage.setItem(COLLAPSE_KEY, filtersCollapsed ? "1" : "0");
  } catch {
    /* just a preference */
  }
  updateFilterUI();
}

function clearFilters() {
  KINDS.forEach((k) => filter.selected[k].clear());
  KINDS.forEach((k) => filter.variant[k].clear());
  filter.duplicatesOnly = false;
  updateFilterUI();
}

// Clicking a chip opens a menu of how to filter on it; clicking it again turns the filter off.
//   content:    any / one / multiple / none   ("one" and "multiple" only if some card has the tag that way)
//   descriptor: is / is not
function toggleTagFilter(kind, tag, chip, stats) {
  const set = filter.selected[kind];
  if (set.has(tag)) {
    set.delete(tag);
    filter.variant[kind].delete(tag);
    updateFilterUI();
    return;
  }
  const choose = (variant) => {
    set.add(tag);
    if (variant) filter.variant[kind].set(tag, variant);
    else filter.variant[kind].delete(tag);
    updateFilterUI();
  };
  let options;
  if (kind === "content") {
    const labels = countLabels(tag);
    options = [
      { label: labels.none, hint: "= 0", onSelect: () => choose("none") },
      { label: labels.any, hint: "> 0", onSelect: () => choose(null) },
      stats.count > stats.multiple && { label: labels.one, hint: "= 1", onSelect: () => choose("one") },
      stats.multiple > 0 && { label: labels.multiple, hint: "> 1", onSelect: () => choose("multiple") },
    ];
  } else {
    options = [
      { label: tag, onSelect: () => choose(null) },
      { label: `not ${tag}`, onSelect: () => choose("none") },
    ];
  }
  const rect = chip.getBoundingClientRect();
  openContextMenu(rect.left, rect.bottom + 4, options.filter(Boolean));
}

function tagFilterChip(kind, tag, stats) {
  const { count } = stats;
  const selected = filter.selected[kind].has(tag);
  const variant = filter.variant[kind].get(tag);
  const label =
    kind === "content" ? (selected ? countLabels(tag)[variant ?? "any"] : tag) : variant === "none" ? `not ${tag}` : tag;
  return el(
    "button",
    {
      type: "button",
      class: "chip",
      title:
        kind === "content"
          ? "Click to choose how many (any, one, multiple, none), or to turn off. Right-click to rename or delete."
          : "Click to filter by it, or exclude it. Click again to turn off. Right-click to rename or delete.",
      "aria-pressed": String(selected),
      ...(!selected ? { "aria-haspopup": "menu" } : {}),
      onClick: (e) => toggleTagFilter(kind, tag, e.currentTarget, stats),
      onContextMenu: (e) => showTagMenu(e, kind, tag, count),
    },
    label,
    el("span", { class: "chip-count" }, String(count)),
  );
}

/** Rebuild the toolbar from current tags/filter state, then apply the filter to the grid. */
function updateFilterUI() {
  for (const kind of KINDS) {
    const counts = store.getTagCounts(kind);
    // A selected tag that no card uses anymore can't be toggled off in the UI; drop it.
    for (const t of [...filter.selected[kind]]) {
      if (counts.some((c) => c.tag === t)) continue;
      filter.selected[kind].delete(t);
      filter.variant[kind].delete(t);
    }

    const chips = counts.map((stats) => tagFilterChip(kind, stats.tag, stats));
    if (chips.length === 0) chips.push(el("span", { class: "muted" }, "none yet"));
    toolbar.groups[kind].replaceChildren(...chips);
  }

  const hasTags = taggedCardCount() > 0;
  toolbar.modeAll.setAttribute("aria-pressed", String(filter.mode === "all"));
  toolbar.modeAny.setAttribute("aria-pressed", String(filter.mode === "any"));
  toolbar.modeGroup.classList.toggle("is-inactive", selectedCount() < 2);
  toolbar.clearFiltersBtn.hidden = !filtersActive();
  document.getElementById("toolbar").classList.toggle("is-collapsed", filtersCollapsed);
  const active = selectedCount() + (filter.duplicatesOnly ? 1 : 0);
  toolbar.collapseBtn.textContent = filtersCollapsed ? "▸" : "▾";
  toolbar.collapseBtn.title = toolbar.collapseBtn.ariaLabel = filtersCollapsed ? "Show filters" : "Hide filters";
  toolbar.collapseBtn.setAttribute("aria-expanded", String(!filtersCollapsed));
  toolbar.activeSummary.textContent = filtersCollapsed && active ? `· ${plural(active, "filter")} active` : "";
  toolbar.duplicatesBox.checked = filter.duplicatesOnly;
  toolbar.visualizeBtn.disabled = !hasTags;

  // Every card belongs to exactly one section in every layout.
  let shown = 0;
  for (const s of sectionRefs) {
    let n = 0;
    for (const card of s.cards) {
      const { figure } = cardRefs.get(card.id);
      const ok = matches(card);
      figure.hidden = !ok && !s.keepSlots;
      figure.classList.toggle("card--dimmed", !ok && s.keepSlots);
      if (ok) n++;
    }
    shown += n;
    s.shown = n;
    s.section.hidden = n === 0 && !s.keepSlots && !s.pinned;
    s.countEl.textContent = n === s.cards.length ? String(n) : `${n} / ${s.cards.length}`;
  }
  if (minorGroup) {
    const n = minorGroup.sections.reduce((sum, s) => sum + s.shown, 0);
    minorGroup.countEl.textContent = n === MINOR_COUNT ? String(n) : `${n} / ${MINOR_COUNT}`;
  }
  toolbar.status.textContent = `Showing ${shown} of ${CARDS.length} cards`;
}

// ---------- init ----------

/** The "Layout" segmented control for one layout group, shown under that group's heading. */
function layoutToggle(group) {
  const buttons = Object.entries(LAYOUT_GROUPS[group].options).map(([option, o]) =>
    el(
      "button",
      {
        type: "button",
        class: "seg",
        title: o.hint,
        "aria-pressed": String(option === layout[group]),
        onClick: () => setLayout(group, option),
      },
      o.label,
    ),
  );
  return el(
    "div",
    { class: "mode layout-toggle", role: "group", "aria-label": `${LAYOUT_GROUPS[group].label} layout`, "data-group": group },
    "Layout",
    ...buttons,
  );
}

function buildSection({ title, cards, note, keepSlots = false, pinned = false, build, controls, level = "h2" }) {
  const countEl = el("span", { class: "count" }, String(cards.length));
  const figures = cards.map((c) => cardRefs.get(c.id).figure);
  const body = build ? build(figures) : el("div", { class: "grid" }, ...figures);
  const section = el(
    "section",
    { class: level === "h3" ? "subsection" : "" },
    el(level, {}, title, countEl),
    controls,
    note && el("p", { class: "section-note" }, note),
    body,
  );
  const ref = { section, countEl, cards, keepSlots, pinned, shown: cards.length };
  sectionRefs.push(ref);
  return { section, ref };
}

/**
 * Rearrange the existing card elements into the current layout (images and tag UI are reused,
 * not rebuilt). Each layout toggle lives under its own heading: "Major Arcana", and a
 * "Minor Arcana" heading that wraps the suit/rank subsections.
 */
function applyLayout() {
  sectionRefs.length = 0;

  const [majorDef] = LAYOUT_GROUPS.major.options[layout.major].sections();
  const major = buildSection({ ...majorDef, controls: layoutToggle("major") }).section;

  const minorBuilt = LAYOUT_GROUPS.minor.options[layout.minor].sections().map((def) => buildSection({ ...def, level: "h3" }));
  const countEl = el("span", { class: "count" }, String(MINOR_COUNT));
  minorGroup = { countEl, sections: minorBuilt.map((b) => b.ref) };
  const minor = el(
    "section",
    {},
    el("h2", {}, "Minor Arcana", countEl),
    layoutToggle("minor"),
    ...minorBuilt.map((b) => b.section),
  );

  document.getElementById("app").replaceChildren(major, minor);
  updateFilterUI();
}

function setLayout(group, option) {
  layout[group] = option;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    localStorage.removeItem(LEGACY_LAYOUT_KEY); // superseded
  } catch {
    /* preference just won't persist */
  }
  applyLayout();
  // The toggles were rebuilt, so put keyboard focus back on the one just used.
  document.querySelector(`.layout-toggle[data-group="${group}"] .seg[aria-pressed="true"]`)?.focus();
}

function render() {
  CARDS.forEach(buildCard);
  toolbar = buildToolbar();
  layout = loadLayout();
  applyLayout();
}

render();

// The filter toolbar sticks just below the pinned action bar, whose height changes when it wraps on narrow screens.
const topbar = document.getElementById("topbar");
const syncTopbarHeight = () => document.documentElement.style.setProperty("--topbar-h", `${topbar.offsetHeight}px`);
new ResizeObserver(syncTopbarHeight).observe(topbar);
syncTopbarHeight();

// ---------- test mode ----------

const game = createGame();
document.getElementById("app").after(game.root);
let testing = false;
const testBtn = el("button", { type: "button", class: "button", onClick: () => setTesting(!testing) });
document.getElementById("mode-actions").append(testBtn);

function setTesting(on) {
  testing = on;
  for (const id of ["toolbar", "app", "actions"]) document.getElementById(id).hidden = on;
  game.root.hidden = !on;
  if (on) game.start();
  updateTestButton();
  window.scrollTo(0, 0);
}

function updateTestButton() {
  testBtn.textContent = testing ? "← Back" : "Test my knowledge!";
  testBtn.classList.toggle("button--danger", testing); // red while in test mode, green otherwise
  testBtn.classList.toggle("button--content", !testing);
  const playable = playableCards().length > 0;
  testBtn.disabled = !testing && !playable;
  testBtn.title = !testing && !playable ? "Tag some cards first (or import tags): the secret card is picked from tagged cards." : "";
}
updateTestButton();

// First visit (nothing saved yet): load the bundled defaults, or ask for a file to import.
async function firstRunSetup() {
  if (!store.isUninitialized()) return;
  const defaults = await loadDefaultTags();
  if (defaults) return store.importTags(defaults.tags, "replace");

  const result = await openDialog({
    title: "Welcome! Import your tags?",
    message:
      "No default tags were found. If you have a tags file exported from this app, choose it now to get started. " +
      "Otherwise, skip this and tag cards yourself; you can import a file any time with Import tags.",
    actions: [{ label: "Choose file...", value: "choose", kind: "primary" }],
    cancelLabel: "Skip",
  });
  if (!result) return store.markInitialized(); // skipped: don't ask again
  const input = el("input", { type: "file", accept: "application/json,.json" });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) importTagsFromFile(file, { firstRun: true });
  });
  input.click();
}
firstRunSetup();

// Any tag change (including from another tab): refresh every card's tag UI, then the filters.
store.subscribe(() => {
  twinCache = null;
  for (const ref of cardRefs.values()) renderCardTags(ref);
  updateFilterUI();
  updateTestButton();
});
