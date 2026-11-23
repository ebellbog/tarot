// "Test my knowledge!" mode: guess a secret card by asking yes/no questions about your own tags.
//
// Questions are built from the tags only (no suit / number / arcana, which would make it too easy):
//   content:    "Does this card contain [any | one | multiple] [content]?"
//   descriptor: "Is this card [quality]?"   (qualities are the descriptor tags)
// The secret card is chosen at random from cards that have at least one tag.

import { CARDS, cardBackUrl, imageUrl } from "./cards.js";
import { el } from "./dom.js";
import { openContextMenu, openDialog } from "./overlays.js";
import * as store from "./store.js";
import { countForms, countLabels, plural } from "./words.js";

const AMOUNTS = [
  { value: "any", label: "any" },
  { value: "one", label: "one" },
  { value: "multiple", label: "multiple" },
];

const GUESS_GROUPS = [
  ["Major Arcana", (c) => c.arcana === "major"],
  ["Wands", (c) => c.suit === "wands"],
  ["Cups", (c) => c.suit === "cups"],
  ["Swords", (c) => c.suit === "swords"],
  ["Pentacles", (c) => c.suit === "pentacles"],
];

/** The yes/no answer for `card`. question: { kind: "content", amount, tag } | { kind: "descriptor", tag } */
export function answerQuestion(card, q) {
  if (q.kind === "descriptor") return store.getCardTags(card.id, "descriptor").includes(q.tag);
  if (!store.getCardTags(card.id, "content").includes(q.tag)) return false;
  if (q.amount === "any") return true;
  return store.isMultiple(card.id, q.tag) === (q.amount === "multiple");
}

export const questionText = (q) =>
  q.kind === "content" ? `Does this card contain ${countLabels(q.tag)[q.amount]}?` : `Is this card ${q.tag}?`;

/** Cards the game can pick as the secret: those with at least one tag. */
export const playableCards = () => CARDS.filter((c) => store.isTagged(c.id));

export function createGame() {
  const root = el("section", { class: "game", hidden: true, "aria-label": "Test my knowledge" });

  // Everything about the current round lives here.
  // { secret, log: [{ text, answer }], guesses: [{ card, correct }], draft: null | "content" | "descriptor",
  //   repeated: text of a just-repeated question, solved, revealed (gave up and looked) }
  let g = null;
  let previousSecretId = null;

  function newGame() {
    const pool = playableCards();
    const choices = pool.length > 1 ? pool.filter((c) => c.id !== previousSecretId) : pool;
    const secret = choices[Math.floor(Math.random() * choices.length)];
    previousSecretId = secret?.id ?? null;
    g = { secret, log: [], guesses: [], draft: null, repeated: null, solved: false, revealed: false };
  }

  function start() {
    newGame();
    render();
  }

  // ---------- asking ----------

  function ask(q) {
    const text = questionText(q);
    if (g.log.some((e) => e.text === text)) {
      g.repeated = text; // asking again doesn't count against you; the existing row flashes instead
    } else {
      g.log.unshift({ text, answer: answerQuestion(g.secret, q) });
      g.repeated = null;
    }
    g.draft = null;
    render();
    root.querySelector(".game-ask")?.focus();
  }

  function openDraft(kind) {
    g.draft = kind;
    g.repeated = null;
    render();
    root.querySelector(".game-form .picker")?.focus();
  }

  function closeDraft() {
    g.draft = null;
    render();
    root.querySelector(".game-ask")?.focus();
  }

  /**
   * A dropdown drawn like the add-tag menus: a button that opens a styled menu.
   * Read the choice from `button.value` ("" until chosen). `items` is [{ value, label } | { heading }], or a
   * function returning that (evaluated each time, so labels can follow other fields). `button.sync()` re-labels
   * the current choice.
   */
  function picker(label, placeholder, items, onChange) {
    const list = () => (typeof items === "function" ? items() : items);
    const text = el("span", {}, placeholder);
    const button = el(
      "button",
      { type: "button", class: "picker", "aria-haspopup": "menu", "aria-label": label },
      text,
      el("span", { class: "picker-caret", "aria-hidden": "true" }, "▾"),
    );
    button.value = "";
    button.sync = () => {
      const current = list().find((i) => i.value === button.value);
      if (current) text.textContent = current.label;
    };
    button.addEventListener("click", () => {
      const rect = button.getBoundingClientRect();
      openContextMenu(
        rect.left,
        rect.bottom + 4,
        list().map((item) =>
          item.heading
            ? item
            : {
                label: item.label,
                onSelect: () => {
                  button.value = item.value;
                  text.textContent = item.label;
                  button.classList.add("has-value");
                  onChange?.();
                  button.focus();
                },
              },
        ),
      );
    });
    return button;
  }

  function buildForm(kind) {
    const changed = () => (askBtn.disabled = !ready());
    // Contents read as "one dog" / "any dogs" / "multiple dogs", so their labels follow the amount chosen.
    const contentItems = () =>
      store.getTagCounts("content").map(({ tag }) => {
        const forms = countForms(tag);
        return { value: tag, label: amount?.value === "one" ? forms.singular : forms.plural };
      });
    const qualityItems = () => store.getTagCounts("descriptor").map(({ tag }) => ({ value: tag, label: tag }));

    const amount = kind === "content" ? picker("How many", "choose…", AMOUNTS, () => (tag.sync(), changed())) : null;
    const tag = picker(kind === "content" ? "Content" : "Quality", "choose…", kind === "content" ? contentItems : qualityItems, changed);
    const askBtn = el("button", { type: "submit", class: "button button--primary", disabled: true }, "Ask");
    const cancelBtn = el("button", { type: "button", class: "button button--ghost", onClick: closeDraft }, "Cancel");
    const ready = () => tag.value !== "" && (!amount || amount.value !== "");

    const form = el(
      "form",
      { class: `game-form kind-${kind}` },
      el("span", {}, kind === "content" ? "Does this card contain" : "Is this card"),
      amount,
      tag,
      el("span", {}, "?"),
      el("div", { class: "game-form-actions" }, askBtn, cancelBtn),
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (ready()) ask(kind === "content" ? { kind, amount: amount.value, tag: tag.value } : { kind, tag: tag.value });
    });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDraft();
    });
    return form;
  }

  // ---------- guessing ----------

  function guess(id) {
    const card = CARDS.find((c) => c.id === id);
    if (!card || g.guesses.some((x) => x.card.id === id)) return;
    const correct = card.id === g.secret.id;
    g.guesses.push({ card, correct });
    if (correct) g.solved = true;
    render();
    if (!correct) root.querySelector(".game-guess .picker")?.focus();
  }

  function buildGuessRow() {
    const guessed = new Set(g.guesses.map((x) => x.card.id));
    const items = GUESS_GROUPS.flatMap(([heading, test]) => {
      const cards = CARDS.filter((c) => test(c) && !guessed.has(c.id));
      return cards.length ? [{ heading }, ...cards.map((c) => ({ value: c.id, label: c.name }))] : [];
    });
    const btn = el("button", { type: "submit", class: "button button--primary", disabled: true }, "Guess");
    const select = picker("Your guess", "choose a card…", items, () => (btn.disabled = select.value === ""));
    const form = el("form", { class: "game-guess" }, select, btn);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (select.value) guess(select.value);
    });
    return form;
  }

  async function revealSecret() {
    const result = await openDialog({
      title: "Reveal the secret card?",
      message: "This ends the round without a correct guess.",
      actions: [{ label: "Reveal", value: "reveal", kind: "danger" }],
    });
    if (!result || g.solved || g.revealed) return;
    g.revealed = true;
    g.draft = null;
    render();
  }

  // ---------- rendering ----------

  /** The face-down card: the original deck back, with the CSS pattern as a fallback if the image can't load. */
  function cardBack() {
    const img = el("img", {
      class: "game-card-art",
      src: cardBackUrl(330),
      srcset: `${cardBackUrl(330)} 1x, ${cardBackUrl(500)} 2x`,
      alt: "",
      width: 850,
      height: 1451, // the scan's own proportions
      draggable: false,
    });
    const button = el(
      "button",
      {
        type: "button",
        class: "game-card game-card--back",
        title: "Click to reveal the secret card",
        "aria-label": "The secret card, face down. Activate to reveal it.",
        onClick: revealSecret,
      },
      img,
    );
    img.addEventListener("error", () => button.classList.add("is-fallback"));
    return button;
  }

  function render() {
    const askable = (k) => store.getTagCounts(k).length > 0;
    const over = g.solved || g.revealed;

    const cardEl = over
      ? el("img", { class: "game-card game-card--face", src: imageUrl(g.secret, 500), alt: g.secret.name })
      : cardBack();

    const stats = el(
      "div",
      { class: "game-stats" },
      el("span", {}, plural(g.log.length, "question")),
      " · ",
      el("span", {}, plural(g.guesses.length, "guess")),
      el("button", { type: "button", class: "link-button", onClick: start }, over ? "Play again" : "Start over"),
    );

    const summary = `${plural(g.log.length, "question")} and ${plural(g.guesses.length, "guess")}`;
    const asking = g.solved
      ? el("div", { class: "game-win", role: "status" }, el("h2", {}, "You got it!"), el("p", {}, `It was ${g.secret.name}, found with ${summary}.`))
      : g.revealed
        ? el("div", { class: "game-win", role: "status" }, el("h2", {}, g.secret.name), el("p", {}, `Revealed after ${summary}.`))
        : el(
            "div",
            { class: "game-ask-area" },
            el("p", { class: "game-prompt" }, "Guess the secret card by asking yes/no questions!"),
            g.draft
              ? buildForm(g.draft)
              : el(
                  "div",
                  { class: "game-ask-buttons" },
                  el(
                    "button",
                    { type: "button", class: "button game-ask", disabled: !askable("content"), onClick: () => openDraft("content") },
                    "Ask about content",
                  ),
                  el(
                    "button",
                    { type: "button", class: "button game-ask", disabled: !askable("descriptor"), onClick: () => openDraft("descriptor") },
                    "Ask about qualities",
                  ),
                ),
          );

    const history =
      g.log.length > 0 &&
      el(
        "div",
        { class: "game-history" },
        el("h3", {}, "Questions so far:"),
        el(
          "ul",
          {},
          ...g.log.map((e) =>
            el(
              "li",
              { class: e.text === g.repeated ? "is-repeat" : "" },
              el("span", {}, e.text),
              el("span", { class: `game-pill ${e.answer ? "is-yes" : "is-no"}` }, e.answer ? "Yes" : "No"),
            ),
          ),
        ),
      );

    const wrongGuesses = g.guesses.filter((x) => !x.correct);
    const guessArea =
      !over &&
      el(
        "div",
        { class: "game-guess-area" },
        el("h3", {}, "Make a guess:"),
        buildGuessRow(),
        wrongGuesses.length > 0 &&
          el(
            "div",
            { class: "game-wrong" },
            el("span", { class: "muted" }, "Not these:"),
            ...wrongGuesses.map((x) => el("span", { class: "game-wrong-card" }, x.card.name)),
          ),
      );

    // replaceChildren would print `false`/`null` as text, so drop the empty pieces first.
    const divider = () => el("hr", { class: "game-divider" });
    root.replaceChildren(...[cardEl, stats, asking, history && divider(), history, divider(), guessArea].filter(Boolean));
  }

  return { root, start };
}
