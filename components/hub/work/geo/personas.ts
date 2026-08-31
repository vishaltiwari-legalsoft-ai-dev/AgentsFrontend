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

import type { GeoPersona, GeoPersonaRollup, GeoPrompt } from "@/lib/api";

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
