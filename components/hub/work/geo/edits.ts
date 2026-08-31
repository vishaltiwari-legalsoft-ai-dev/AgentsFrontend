/** The small decisions behind the Competitors and Plan edit affordances.
 *
 *  Pure: no component, no network. Each function guards a write:
 *
 *  - `withoutCompetitor` refuses to produce a list that did not shrink. The
 *    comparison row and the saved config are read at different moments, so a
 *    key that matches nothing means they drifted — the caller must refuse the
 *    PUT rather than quietly re-save the same list and claim a removal.
 *  - `assigneeToSave` turns a blur into either a save or a no-op. Every blur
 *    firing a PUT would write the same name over and over; only a real change
 *    (including clearing to "") is worth a request.
 *  - `questionsCell` draws an absent count as "—", never as 0 — the field is
 *    optional per the deploy-skew law, and "0 questions" is a claim the old
 *    API never made.
 */
import type { GeoCompetitor } from "@/lib/api";

/** The tracked list minus one entry, or null when the key matches nothing —
 *  in which case nothing must be saved. */
export function withoutCompetitor(tracked: GeoCompetitor[], key: string): GeoCompetitor[] | null {
  const rest = tracked.filter((c) => c.key !== key);
  return rest.length === tracked.length ? null : rest;
}

/** "on how many questions" — a count, or an honest dash when the API predates
 *  the field. Zero is a real count and renders as "0". */
export function questionsCell(nQuestions: number | null | undefined): string {
  return nQuestions == null ? "—" : nQuestions.toLocaleString("en-US");
}

/** What an assign box should save on blur: the trimmed text ("" clears the
 *  assignment), or null when nothing actually changed. */
export function assigneeToSave(current: string | null | undefined, draft: string): string | null {
  const next = draft.trim();
  return next === (current ?? "").trim() ? null : next;
}
