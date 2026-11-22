// Tag store, persisted to localStorage.
//
// Tags come in two kinds:
//   "descriptor" - adjectives:  "this card is ..."   (e.g. calm, ominous)
//   "content"    - nouns:       "this card has ..."  (e.g. a dog, two people)
//
// Shape: { [cardId]: { descriptor: string[], content: string[], multiple: string[] } }
// `multiple` is the subset of that card's contents shown more than once ("dogs" rather than
// "a dog"); the tag text itself stays shared. Descriptors have no count.
// The set of "existing tags" is derived from the card tags, so a tag disappears
// automatically once no card uses it. The same text may exist as both kinds.

export const KINDS = ["descriptor", "content"];

const KEY = "tarot-memory:tags:v2";
const LEGACY_KEY = "tarot-memory:tags:v1"; // { [cardId]: string[] }, before kinds existed
const NO_TAGS = Object.freeze([]);

const emptyEntry = () => ({ descriptor: [], content: [], multiple: [] });

export const normalizeTag = (raw) => raw.trim().replace(/\s+/g, " ").toLowerCase();

const cleanList = (list) =>
  Array.isArray(list) ? [...new Set(list.filter((t) => typeof t === "string").map(normalizeTag).filter(Boolean))] : [];

/** Coerce untrusted parsed JSON into valid state, dropping anything malformed or empty. */
export function sanitizeTags(parsed) {
  const out = {};
  for (const [id, entry] of Object.entries(parsed ?? {})) {
    const cleaned = Object.fromEntries(KINDS.map((kind) => [kind, cleanList(entry?.[kind])]));
    if (!KINDS.some((kind) => cleaned[kind].length)) continue;
    // Only contents already on the card can be flagged multiple.
    cleaned.multiple = cleanList(entry?.multiple).filter((t) => cleaned.content.includes(t));
    out[id] = cleaned;
  }
  return out;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw == null ? null : JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null; // corrupt, or storage unavailable
  }
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch (err) {
    console.warn("Could not save tags to localStorage:", err);
    return false;
  }
}

function load() {
  const current = readJson(KEY);
  if (current) return sanitizeTags(current);

  // One-time migration: v1 tags had no kind. Existing tags become contents (nouns);
  // remove and re-add any that were really descriptors.
  const legacy = readJson(LEGACY_KEY);
  if (legacy) {
    const migrated = sanitizeTags(Object.fromEntries(Object.entries(legacy).map(([id, list]) => [id, { content: list }])));
    if (save(migrated)) {
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* leaving the old key behind is harmless */
      }
    }
    return migrated;
  }
  return {};
}

/** True if nothing has ever been saved (no tags key, no legacy key): a first visit or cleared site data. */
export function isUninitialized() {
  try {
    return localStorage.getItem(KEY) === null && localStorage.getItem(LEGACY_KEY) === null;
  } catch {
    return false; // storage unavailable: don't nag about setup we can't persist
  }
}

let state = load();
const listeners = new Set();

function commit() {
  save(state);
  listeners.forEach((fn) => fn());
}

// Keep multiple open tabs in sync.
window.addEventListener("storage", (e) => {
  if (e.key === KEY || e.key === null) {
    state = load();
    listeners.forEach((fn) => fn());
  }
});

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export const getCardTags = (id, kind) => state[id]?.[kind] ?? NO_TAGS;

/** True if this content tag is flagged as "multiple" on this card. */
export const isMultiple = (id, tag) => state[id]?.multiple.includes(tag) ?? false;

/** Flip a card's content tag between one and multiple. Returns the new value, or null if the card lacks the tag. */
export function toggleMultiple(id, tag) {
  const entry = state[id];
  if (!entry?.content.includes(tag)) return null;
  const now = !entry.multiple.includes(tag);
  state = { ...state, [id]: { ...entry, multiple: now ? [...entry.multiple, tag] : entry.multiple.filter((t) => t !== tag) } };
  commit();
  return now;
}

/** True if the card has at least one tag of any kind. */
export const isTagged = (id) => Object.hasOwn(state, id);

/** Returns the normalized tag if it was added, otherwise null (empty, duplicate, or unknown kind). */
export function addTag(id, kind, raw) {
  if (!KINDS.includes(kind)) return null;
  const tag = normalizeTag(raw);
  if (!tag || getCardTags(id, kind).includes(tag)) return null;
  const entry = state[id] ?? emptyEntry();
  state = { ...state, [id]: { ...entry, [kind]: [...entry[kind], tag] } };
  commit();
  return tag;
}

export function removeTag(id, kind, tag) {
  const entry = state[id];
  if (!entry || !entry[kind]?.includes(tag)) return;
  const nextEntry = { ...entry, [kind]: entry[kind].filter((t) => t !== tag) };
  if (kind === "content") nextEntry.multiple = entry.multiple.filter((t) => t !== tag);
  const { [id]: _removed, ...rest } = state;
  state = KINDS.some((k) => nextEntry[k].length) ? { ...rest, [id]: nextEntry } : rest;
  commit();
}

/**
 * Rename a tag on every card that has it. If `raw` matches another existing tag of the
 * same kind, the two are merged (cards with both end up with one).
 * Returns the new normalized name, or null if nothing changed.
 */
export function renameTag(kind, from, raw) {
  const to = normalizeTag(raw);
  if (!KINDS.includes(kind) || !to || to === from) return null;
  let changed = false;
  const next = {};
  for (const [id, entry] of Object.entries(state)) {
    if (entry[kind].includes(from)) {
      changed = true;
      const swap = (list) => [...new Set(list.map((t) => (t === from ? to : t)))];
      next[id] = { ...entry, [kind]: swap(entry[kind]) };
      // On a merge, the card keeps "multiple" if either tag had it.
      if (kind === "content") next[id].multiple = swap(entry.multiple);
    } else {
      next[id] = entry;
    }
  }
  if (!changed) return null;
  state = next;
  commit();
  return to;
}

/** Remove a tag from every card. Cards left with no tags become untagged. Returns how many cards changed. */
export function deleteTag(kind, tag) {
  if (!KINDS.includes(kind)) return 0;
  let affected = 0;
  const next = {};
  for (const [id, entry] of Object.entries(state)) {
    if (!entry[kind].includes(tag)) {
      next[id] = entry;
      continue;
    }
    affected++;
    const updated = { ...entry, [kind]: entry[kind].filter((t) => t !== tag) };
    if (kind === "content") updated.multiple = entry.multiple.filter((t) => t !== tag);
    if (KINDS.some((k) => updated[k].length)) next[id] = updated;
  }
  if (affected) {
    state = next;
    commit();
  }
  return affected;
}

/**
 * Bring in tags (shape: { [cardId]: { descriptor, content } }).
 * mode "replace" discards current tags first; "append" merges into them.
 */
export function importTags(incoming, mode) {
  const clean = sanitizeTags(incoming);
  if (mode === "replace") {
    state = clean;
  } else {
    const next = { ...state };
    for (const [id, entry] of Object.entries(clean)) {
      const current = next[id] ?? emptyEntry();
      next[id] = Object.fromEntries([...KINDS, "multiple"].map((k) => [k, [...new Set([...current[k], ...entry[k]])]]));
    }
    state = next;
  }
  commit();
}

/** Record that setup is done (with whatever tags exist, possibly none) so it isn't offered again. */
export function markInitialized() {
  save(state);
}

export function clearAllTags() {
  if (Object.keys(state).length === 0) return;
  state = {};
  commit();
}

/** Tags of one kind that are in use, alphabetical, with the number of cards using each. */
export function getTagCounts(kind) {
  const counts = new Map();
  for (const entry of Object.values(state)) {
    for (const t of entry[kind]) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}
