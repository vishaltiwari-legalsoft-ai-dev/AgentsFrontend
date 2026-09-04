/** Pure logic for the Questions tab: buyer-persona segmentation and the words
 *  a pasted list's outcome is reported in.
 *
 *  Kept out of the component so the sentences the panel prints — and the rules
 *  a save is refused on — are testable without a DOM. Two decisions live here
 *  on purpose:
 *
 *  - **A missing measurement is never a zero.** A persona whose questions have
 *    no stored answers reads "not measured yet"; a measured 0% stays 0%.
 *  - **A key the persona list no longer carries still shows.** Hiding it would
 *    silently misfile the prompt as untagged, which is a different claim.
 */

import type { GeoAskedIntent, GeoPersona, GeoPersonaRollup, GeoPrompt } from "@/lib/api";

/** The backend refuses a ninth persona; refusing here too makes the form say
 *  so before a round-trip instead of after one. */
export const MAX_PERSONAS = 8;

/** Label for a prompt's persona chip. `""` or absent = untagged → no chip.
 *  An unknown key renders as the raw key rather than vanishing. */
export function personaLabel(
  personas: GeoPersona[],
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  return personas.find((p) => p.key === key)?.label ?? key;
}

/** The rollup's `""` bucket is answers whose question carries no persona. It
 *  stays visible: hiding it would make the tagged rates look like the whole
 *  story when they may be a sliver of it. */
export function bucketLabel(personas: GeoPersona[], key: string): string {
  return personaLabel(personas, key) ?? "No persona yet";
}

/** How many questions carry this persona key. Absent persona counts as `""`. */
export const promptCount = (prompts: GeoPrompt[], key: string): number =>
  prompts.filter((p) => (p.persona || "") === key).length;

/** "12 added · 2 skipped" — both halves of a paste, said plainly. Partial
 *  acceptance is the normal outcome of a paste, not an error to bury. */
export function outcomeWords(added: number, skipped: number): string {
  const a = added === 0 ? "Nothing added" : `${added} added`;
  return skipped === 0 ? a : `${a} · ${skipped} skipped`;
}

/** "named in 44% of 12 questions" — or "not measured yet" when the backend
 *  sent no rate, which means no answer has been stored for this persona's
 *  questions. */
export function coverageWords(row: GeoPersonaRollup): string {
  if (row.mention_rate === null || row.mention_rate === undefined) return "not measured yet";
  const q = row.n_prompts === 1 ? "question" : "questions";
  return `named in ${Math.round(row.mention_rate * 100)}% of ${row.n_prompts} ${q}`;
}

/** Why a persona label cannot be saved, or null when it can. Mirrors the
 *  backend's rules (2–60 characters, eight max) so the refusal is instant and
 *  the same either way. */
export function labelProblem(label: string, existing: GeoPersona[]): string | null {
  const clean = label.trim();
  if (clean.length < 2) return "Give the persona a name — at least two characters.";
  if (clean.length > 60) return "Keep the name under sixty characters.";
  if (existing.some((p) => p.label.trim().toLowerCase() === clean.toLowerCase())) {
    return `${clean} already exists.`;
  }
  if (existing.length >= MAX_PERSONAS) {
    return "Eight personas is the ceiling — remove one before adding another.";
  }
  return null;
}

/* ------------------------------------------------ deleting from the set ---- */

/** The picked ids that are still in the set, in list order.
 *
 *  A selection outlives the list it was made from: a regenerate, a paste, or
 *  another console's save all rewrite the universe while ticked boxes stay
 *  ticked. Counting the raw Set would print a number the screen cannot show and
 *  save a list the reader never agreed to, so every count and every delete
 *  reads the selection through here. */
export function stillListed(prompts: GeoPrompt[], picked: ReadonlySet<string>): string[] {
  return prompts.filter((p) => picked.has(p.id)).map((p) => p.id);
}

/** The running count beside the select-all controls. */
export function selectionWords(picked: number, total: number): string {
  if (picked === 0) return "Nothing selected";
  if (picked >= total) return `All ${total} selected`;
  return `${picked} of ${total} selected`;
}

/** What the confirm asks. Emptying the set is a different act from removing
 *  some of it and says so in its own words — the count is always named, so
 *  nobody confirms a number they did not read. */
export function deleteConfirmWords(picked: number, total: number): string {
  if (picked >= total) {
    const what = total === 1 ? "the only question left" : `all ${total} questions`;
    return `Delete ${what}? That leaves the set empty — the next check asks nothing until a question is added back.`;
  }
  return `Delete ${picked} of ${total} questions?`;
}

/** The line under every delete confirm. Deleting a question does not delete the
 *  answers it already collected, and the per-question reports keep listing it
 *  until those answers fall out of the window — said here so it is read as the
 *  design rather than reported later as a bug. */
export function deleteAftermathWords(days: number): string {
  return `Answers already collected are not deleted, so reports keep showing these questions until they age out of the last ${days} days.`;
}

/** The toast after a delete that saved. */
export function deletedWords(count: number): string {
  const subject = count === 1 ? "Question deleted. Answers it" : `${count} questions deleted. Answers they`;
  return `${subject} already collected stay in reports until they age out.`;
}

/* ------------------------------------- what a new question is asking for ---- */

/** The two kinds a person may choose between when writing a question, in their
 *  words rather than ours.
 *
 *  The value is what the create endpoints require; the label never says it. A
 *  question that does not name you is also put to Google's billed search
 *  engines, so this choice spends money and is therefore asked, never guessed. */
export const ASKED_CHOICES: { value: GeoAskedIntent; label: string }[] = [
  { value: "category", label: "A question someone would ask without knowing us" },
  { value: "brand", label: "A question that already names us" },
];

/** The one line under the choice: why a person is being asked at all. */
export const ASKED_WHY =
  "It decides where the question goes. The first kind is also put to Google's AI search, "
  + "which we pay for question by question; the second only goes to the chat engines.";

/** Why a new question cannot be sent yet, or null once a kind is chosen.
 *
 *  There is no default on purpose. "problem" is refused here as firmly as an
 *  empty box: the generator writes those and the store keeps them, but a person
 *  is never offered one, so a "problem" arriving from a form is a bug, not a
 *  choice somebody made. */
export function askedChoiceProblem(intent: string): string | null {
  return ASKED_CHOICES.some((c) => c.value === intent)
    ? null
    : "Choose which kind of question this is — it decides which engines we send it to.";
}

/** How a stored question's kind reads in the list.
 *
 *  Covers the kinds nobody can choose any more: "problem" questions are still
 *  written by the generator and still stored, and a value this console has
 *  never heard of prints itself rather than vanishing — a question with no
 *  visible kind reads as one with no kind at all. */
export function intentWords(intent: string): string {
  return INTENT_WORDS[intent] || intent;
}

const INTENT_WORDS: Record<string, string> = {
  brand: "already names you",
  category: "does not name you",
  problem: "describes the problem, not the product",
};
