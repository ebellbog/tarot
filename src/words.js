// Wording for content tags in count filters ("one dog", "multiple dogs").
//
// Tags are free text, so this is a best effort: it drops a leading article ("a dog" -> "dog"),
// pluralizes only the noun before "of" ("tree of life" -> "trees of life"), and otherwise
// leans on the `pluralize` library. Phrases that already carry a number ("two people")
// aren't understood; tag the noun ("person") and flag it multiple instead.

import pluralize from "pluralize";

const ARTICLE = /^(?:a|an|the|some)\s+/;

/** { singular, plural } display forms for a (normalized) tag, whichever form it was typed in. */
export function countForms(tag) {
  const text = tag.replace(ARTICLE, "");
  const [head, ...rest] = text.split(" of ");
  const tail = rest.length ? ` of ${rest.join(" of ")}` : "";
  return { singular: pluralize.singular(head) + tail, plural: pluralize.plural(head) + tail };
}

/** Option labels and filter-chip text for each count mode. */
export function countLabels(tag) {
  const { singular, plural } = countForms(tag);
  return { any: `any number of ${plural}`, one: `one ${singular}`, multiple: `multiple ${plural}` };
}
