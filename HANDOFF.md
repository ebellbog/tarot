# Tarot Memory: project handoff

A summary of the design conversation so far, so development can continue on another machine.
The next step is the **gameplay phase** (see "Next: gameplay" at the bottom).

## What this is

A simple, frontend-only web app for testing your memory of tarot cards (Rider-Waite-Smith deck).

Two phases of interaction are planned:

1. **Tagging** (built): you attach your own metadata tags to each card.
2. **Gameplay** (not started): guess a secret card by asking yes/no questions about the tags.

Constraints set by the owner: keep architecture and dependencies simple; prefer stable external image URLs over
downloading assets; limit visual screenshots when testing (token cost).

## Run it

```bash
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # production build into dist/ (also a quick syntax/import check)
```

Developed with Node v20.12.1 and npm 10.5.0. The only dependency is `vite` (dev). No framework: plain ES modules,
DOM built with a tiny `el()` helper.

## File map

| File | Role |
| --- | --- |
| `index.html` | Page shell: header (with `#actions` container top-right), sticky `#toolbar`, `#app`, footer credit |
| `src/cards.js` | All 78 cards and image URL helpers |
| `src/store.js` | Tag state, localStorage persistence, bulk operations, cross-tab sync |
| `src/transfer.js` | Export/import file format (build + parse/validate) |
| `src/overlays.js` | Reusable modal `openDialog()` (`<dialog>`) and `openContextMenu()` |
| `src/dom.js` | `el(tag, props, ...children)` DOM builder |
| `src/main.js` | All UI: cards, tag controls, filters, layouts, import/export/clear flows |
| `src/style.css` | All styling (dark theme, gold accent) |

## Cards and images (`src/cards.js`)

- Exports `CARDS` (78 entries), `imageUrl(card, width)`, `commonsPageUrl(card)`.
- Card fields: `id` (lowercased filename without `.jpg`, e.g. `rws_tarot_00_fool`, `wands01`, `pents14`), `name`,
  `arcana` (`"major"` | `"minor"`), `suit` (`"wands"|"cups"|"swords"|"pentacles"`, minors only),
  `number` (majors 0-21; minors 1-14 where 11-14 are Page, Knight, Queen, King), `file`, `hash`.
- Art is Pamela Colman Smith's 1909 RWS deck (public domain), **hotlinked from Wikimedia Commons**, not stored locally.
- URL shape: `https://upload.wikimedia.org/wikipedia/commons/thumb/<h>/<hh>/<file>/<width>px-<file>` where `<h>/<hh>` are
  the first one and two hex characters of `md5(file)`. Hashes were computed offline and verified against the Commons API.
  Standard thumb widths: 250, 330, 500, 960, ... The app uses 330 (1x) and 500 (2x) with lazy loading.
- Filenames: majors `RWS_Tarot_NN_Name.jpg`; minors `Wands01.jpg` ... `Cups14.jpg`, `Swords..`, `Pents..`.
- Gotcha: `commons.wikimedia.org/wiki/Special:FilePath/...` redirects and rapid `curl` calls (no User-Agent) returned
  HTTP 429. Direct `upload.wikimedia.org` URLs in a real browser were fine.

## Tag model (`src/store.js`)

Two kinds of tag, chosen by the owner:

- **descriptor** (adjectives, "this card is...": calm, ominous)
- **content** (nouns, "this card has...": a dog, two people)

State shape: `{ [cardId]: { descriptor: string[], content: string[] } }`. Cards with no tags have no entry.

- Tags are normalized (trimmed, whitespace collapsed, lowercased). Duplicates within a kind are ignored.
- The same text may exist in both kinds (they are independent).
- "Existing tags" are derived from the card data, so a tag disappears when no card uses it.
- Persisted at localStorage key `tarot-memory:tags:v2`. A one-time migration reads the old `tarot-memory:tags:v1`
  (flat `{id: string[]}`) and moves those tags into **content**.
- `storage` events keep multiple tabs in sync.

Store API: `KINDS`, `normalizeTag`, `sanitizeTags`, `subscribe(fn)`, `getCardTags(id, kind)`, `isTagged(id)`,
`addTag(id, kind, raw)`, `removeTag(id, kind, tag)`, `renameTag(kind, from, raw)` (merges if target exists),
`deleteTag(kind, tag)`, `importTags(incoming, "replace"|"append")`, `clearAllTags()`, `getTagCounts(kind)`.

## UI behavior (`src/main.js`)

- **Per card:** two tag groups (descriptors gold, contents teal). Each has a dropdown of existing tags of that kind
  plus a "New descriptor... / New content..." entry that becomes a text box (Enter adds, Escape/blur cancels).
  Focus returns to the add control after adding so tagging can continue from the keyboard.
- **Filters** (sticky toolbar): chip rows "Is..." (descriptors) and "Has..." (contents), each chip with a card count.
  Match mode **All/Any** applies across all selected tags of both kinds. "Clear filters" appears when any are active.
  A line "Showing x of 78 cards" is the last row of the sticky toolbar (centered, above its bottom divider).
- **Right-click a filter chip:** context menu with **Rename...** (applies to every card, merges if the new name exists;
  keeps the filter selected) and **Delete from all cards (n)** (confirmation first). Also reachable by keyboard menu key.
- **Header actions (top-right corner of the page; centered row under the title below 760px wide):**
  - **Export tags** downloads `tarot-tags-YYYY-MM-DD.json`.
  - **Import tags** picks a JSON file, shows counts, offers **Replace existing** vs **Add to existing** (or Cancel).
    Bad files get a clear error dialog. Entries for unknown card ids are skipped and counted. v1 export files import as contents.
  - **Clear tags** asks for confirmation (focus starts on Cancel).
- **Layouts** (two independent toggles, each labeled "Layout", under its own section heading; saved at
  localStorage `tarot-memory:layout:v2` as `{ major, minor }`; old `layout:v1` is migrated):
  - Majors: **Default** (0-21 in order) or **3 x 7 (Pollack)**.
  - Minors: **By suit** or **By number** (all Aces, all Twos, ... all Kings).
  - Page structure: a "Major Arcana" section, then a "Minor Arcana" heading wrapping the suit/rank subsections (`h3`).
  - The Major and Minor headings with their toggles stay visible even when a filter empties them.
- Layout switching moves the existing card DOM nodes (images and tag UI are not rebuilt).
- In the 3 x 7 layout, non-matching cards are **dimmed in place** instead of hidden, so the grid keeps its columns.

### Research: the "periodic table" layout

The owner remembered a layout with The Lovers above Death. That is **Rachel Pollack's three-rows-of-seven**
arrangement from *Seventy-Eight Degrees of Wisdom* (1980): the Fool is set apart above the rest, and Majors I-VII, VIII-XIV,
XV-XXI form three rows, so The Lovers (VI) sits directly above Death (XIII). Sources: Pollack's own
[Llewellyn article](https://www.llewellyn.com/journal/article/2009), the
[book's text](https://archive.org/stream/szare_op_78/78_djvu.txt), and a
[reference grid](https://www.tarotwhispers.co.uk/major).

- It is defined for the **Major Arcana only**. No source found places the minors in this grid, so none was invented.
- The Fool's horizontal position is a design choice (centered above column 4); sources only say "above".
- "By number" for minors is the owner-approved interpretation (group by rank). Majors were not merged into rank
  groups because that would rest on unverified numerology correspondences.

## Testing notes (no test framework in the repo)

Testing was done by driving the real UI in the Cursor browser with DOM scripts (`Runtime.evaluate`): dispatching `change`,
`keydown`, `contextmenu` events, clicking buttons, and asserting DOM and localStorage. Lessons worth keeping:

- localStorage is per-origin. Run test servers on a **different port** (e.g. 5199) so tests cannot clear real tag data on 5173.
- Rebuilding sections (layout switch) invalidates element references held by a script; re-query after switching.
- To avoid huge page snapshots, navigate to `http://localhost:<port>/favicon.ico` first, then set up state and
  `location.href = '/'` from a script.
- Check what owns a port before starting or killing a server.

## Moving to another laptop

1. **Code:** the repo is under git with no remote yet. Either add a remote and push (`git remote add origin <url>`,
   `git push -u origin <branch>`) and clone it, or copy the folder without `node_modules/`. Then `npm install`.
2. **Your tags are not in the repo.** They live in each browser's localStorage. On the old machine click **Export tags**,
   move the JSON file, then on the new machine click **Import tags** (choose Replace or Add).

## Next: gameplay

Goal: a secret card is chosen; the player asks yes/no questions about the tag metadata and then guesses the card.

Open question that was asked but not yet answered: **how should the yes/no questions be worded?**

- Option A: generate automatically from tags, e.g. "Is the card calm?" (descriptor) and "Does the card have a dog?" (content).
  No extra work for the owner, but contents written in different grammatical forms (e.g. "water" vs "two people") may read oddly.
- Option B: fixed, hand-written phrasings supplied by the owner.

Other points still to decide:

- Should questions also draw on fixed facts (suit, major/minor, number), or only on user tags?
- Should untagged cards be excluded from the game, or stay in with only fixed-fact questions?

Building blocks already available: `getTagCounts(kind)` for the question pool, `getCardTags(id, kind).includes(tag)` to answer a
question, `isTagged(id)` to find eligible cards, and the card images from `imageUrl()` for the reveal.
