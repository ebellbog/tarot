// Yes/no questions about the tags, and the "best question" solver.
//
// Question shapes:
//   { kind: "content", amount: "any" | "one" | "multiple", tag }   "Does this card contain one dog?"
//   { kind: "descriptor", tag }                                     "Is this card calm?"
//
// The solver never looks at the secret card. It only knows which cards are still possible (cards consistent with
// every answer so far, minus wrong guesses) and their tags. Each card is equally likely, so the most informative
// question is the one that splits the remaining cards most evenly: whatever the answer, as many cards as possible
// are ruled out. Asking that repeatedly is a greedy way of building a balanced decision tree, a binary search over
// the cards (good, though not guaranteed to be the shortest possible game).

import { countLabels } from "./words.js";
import * as store from "./store.js";

export const AMOUNTS = ["any", "one", "multiple"];

/** The yes/no answer for `card`. */
export function answerQuestion(card, q) {
  if (q.kind === "descriptor") return store.getCardTags(card.id, "descriptor").includes(q.tag);
  if (!store.getCardTags(card.id, "content").includes(q.tag)) return false;
  if (q.amount === "any") return true;
  return store.isMultiple(card.id, q.tag) === (q.amount === "multiple");
}

export const questionText = (q) =>
  q.kind === "content" ? `Does this card contain ${countLabels(q.tag)[q.amount]}?` : `Is this card ${q.tag}?`;

/** Every question that can be asked with the current tags. */
export function allQuestions() {
  return [
    ...store.getTagCounts("descriptor").map(({ tag }) => ({ kind: "descriptor", tag })),
    ...store.getTagCounts("content").flatMap(({ tag }) => AMOUNTS.map((amount) => ({ kind: "content", amount, tag }))),
  ];
}

/**
 * Cards still possible: in `pool`, not already guessed wrong, and giving the same answer to every question in `log`
 * ({ q, answer } entries) as the secret card did.
 */
export const remainingCards = (pool, log, wrongIds) =>
  pool.filter((c) => !wrongIds.has(c.id) && log.every((e) => answerQuestion(c, e.q) === e.answer));

/** How a question divides `cards`: { yes, no } counts. */
export function split(cards, q) {
  let yes = 0;
  for (const c of cards) if (answerQuestion(c, q)) yes++;
  return { yes, no: cards.length - yes };
}

/**
 * The question that splits `cards` most evenly (largest smaller side), or null if no question tells any of them
 * apart. Questions whose answer is already known (all yes or all no) are skipped, which also skips anything asked
 * before. Returns { q, yes, no }.
 */
export function bestQuestion(cards) {
  let best = null;
  for (const q of allQuestions()) {
    const s = split(cards, q);
    const worst = Math.min(s.yes, s.no);
    if (worst > 0 && (!best || worst > Math.min(best.yes, best.no))) best = { q, ...s };
  }
  return best;
}

// ---------- identical tag sets ----------

/** A key that is equal for two cards exactly when no question can tell them apart. */
export function tagSignature(id) {
  const descriptors = [...store.getCardTags(id, "descriptor")].sort();
  const contents = [...store.getCardTags(id, "content")].sort().map((t) => (store.isMultiple(id, t) ? `${t} (multiple)` : t));
  return JSON.stringify([descriptors, contents]);
}

/** For each card, the other cards with exactly the same tags: Map(card.id -> card[]). */
export function identicalTagMap(cards) {
  const bySignature = new Map();
  for (const c of cards) {
    const sig = tagSignature(c.id);
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig).push(c);
  }
  const out = new Map();
  for (const group of bySignature.values()) for (const c of group) out.set(c.id, group.filter((o) => o !== c));
  return out;
}

// ---------- decision tree ----------

/**
 * The full tree of questions "Ask best question" would ask, for every possible secret among `cards`.
 * Node: { q, yes, no } for a question, or { cards } for a leaf (more than one card means no question can split them).
 */
export function buildTree(cards) {
  const best = bestQuestion(cards);
  if (!best) return { cards };
  const yes = [];
  const no = [];
  for (const c of cards) (answerQuestion(c, best.q) ? yes : no).push(c);
  return { q: best.q, yes: buildTree(yes), no: buildTree(no) };
}
