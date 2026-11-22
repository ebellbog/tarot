// Export/import file format.
//
//   v2: { version: 2, exportedAt, cards: { [cardId]: { name, descriptors: string[], contents: string[], multiples?: string[] } } }
//       `multiples` (optional) lists the contents that appear more than once on that card.
//   v1: { version: 1, exportedAt, cards: { [cardId]: { name, tags: string[] } } }   (import only; tags become contents)

import { CARDS } from "./cards.js";
import * as store from "./store.js";

const FIELD = { descriptor: "descriptors", content: "contents" };
const KNOWN_IDS = new Set(CARDS.map((c) => c.id));

export function buildExport() {
  const cards = {};
  for (const card of CARDS) {
    if (!store.isTagged(card.id)) continue;
    cards[card.id] = {
      name: card.name,
      ...Object.fromEntries(store.KINDS.map((k) => [FIELD[k], [...store.getCardTags(card.id, k)]])),
      multiples: store.getCardTags(card.id, "content").filter((t) => store.isMultiple(card.id, t)),
    };
  }
  return { version: 2, exportedAt: new Date().toISOString(), cards };
}

const fail = (error) => ({ ok: false, error });

/**
 * Parse and validate file text. Entries for unknown card ids are skipped (and counted);
 * tags are normalized the same way as typed ones.
 * @returns {{ ok: false, error: string } | { ok: true, tags: object, cardCount: number, tagCount: number, ignored: number }}
 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("That file isn't valid JSON.");
  }
  const cards = data?.cards;
  if (!cards || typeof cards !== "object" || Array.isArray(cards)) {
    return fail('That doesn\'t look like a tarot tags export (no "cards" section).');
  }
  if (data.version !== 1 && data.version !== 2) {
    return fail(`Unsupported export version: ${JSON.stringify(data.version) ?? "missing"}.`);
  }

  const raw = {};
  let ignored = 0;
  for (const [id, entry] of Object.entries(cards)) {
    if (!KNOWN_IDS.has(id)) {
      ignored++;
      continue;
    }
    raw[id] =
      data.version === 1
        ? { content: entry?.tags }
        : { ...Object.fromEntries(store.KINDS.map((k) => [k, entry?.[FIELD[k]]])), multiple: entry?.multiples };
  }

  const tags = store.sanitizeTags(raw);
  const cardCount = Object.keys(tags).length;
  const tagCount = Object.values(tags).reduce((n, entry) => n + store.KINDS.reduce((m, k) => m + entry[k].length, 0), 0);
  if (cardCount === 0) return fail("No tags for known cards were found in that file.");
  return { ok: true, tags, cardCount, tagCount, ignored };
}

/**
 * Fetch the bundled default tags (public/default-tarot-tags.json).
 * Resolves to a parseImport result, or null if the file is missing or can't be parsed.
 * (The dev server answers unknown paths with index.html, so a 200 alone proves nothing.)
 */
export async function loadDefaultTags() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}default-tarot-tags.json`);
    if (!res.ok) return null;
    const parsed = parseImport(await res.text());
    return parsed.ok ? parsed : null;
  } catch {
    return null;
  }
}
