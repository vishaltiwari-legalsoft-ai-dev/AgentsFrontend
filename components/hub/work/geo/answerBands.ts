/** Pure shaping for the Answers and Sources panels.
 *
 *  The Answers tab folds a flat list of stored answers into per-question bands
 *  a reader can open one at a time, and the Sources tab has to say — in words —
 *  which questions a cited page appeared on. Both are joins over the report's
 *  own data, and both carry the workspace's honesty rule: an engine that
 *  errored, or a query Google published no AI Overview for, is not an answer
 *  the brand could have appeared in, so it never lands in a denominator and its
 *  square is never drawn as a miss.
 *
 *  Pure and separately tested, because a wrong count in a band header is a
 *  claim about answers the reader has not opened yet.
 */

import type { GeoAnswer, GeoPromptRollup } from "@/lib/api";

export type NamedFilter = "all" | "named" | "gap";

export interface AnswerBand {
  id: string;
  text: string;
  rows: GeoAnswer[];
  /** Persona key the question is tagged with; null = untagged, draw no chip. */
  persona: string | null;
}

/** Fold answers into one band per question, keeping only rows the filter
 *  matches — the band header must describe exactly the rows inside it.
 *  Bands keep the arrival order of the answer list. */
export function bandsFrom(
  answers: readonly GeoAnswer[],
  filter: { status: NamedFilter; term: string },
  rollup: readonly GeoPromptRollup[],
): AnswerBand[] {
  const tagOf = new Map(rollup.map((r) => [r.prompt_id, r.persona || ""]));
  const t = filter.term.trim().toLowerCase();
  const byPrompt = new Map<string, AnswerBand>();
  for (const a of answers) {
    if (filter.status === "named" && a.brand_mentioned !== true) continue;
    if (filter.status === "gap" && a.brand_mentioned === true) continue;
    if (t && !`${a.text} ${a.prompt_text}`.toLowerCase().includes(t)) continue;
    const band = byPrompt.get(a.prompt_id) ?? {
      id: a.prompt_id,
      text: a.prompt_text,
      rows: [],
      persona: null,
    };
    band.rows.push(a);
    byPrompt.set(a.prompt_id, band);
  }
  for (const band of byPrompt.values()) {
    band.persona = personaKeyOf(tagOf.get(band.id), band.rows);
  }
  return [...byPrompt.values()];
}

/** What one engine's square on a band header says. `named` — at least one
 *  usable answer said the name; `answered` — it answered but never named;
 *  `none` — nothing usable stored, drawn blank rather than as a miss. */
export type CellState = "named" | "answered" | "none";

export function cellOf(rows: readonly GeoAnswer[], engine: string): CellState {
  let answered = false;
  for (const a of rows) {
    if (a.engine !== engine || a.error || a.no_aio) continue;
    if (a.brand_mentioned === true) return "named";
    answered = true;
  }
  return answered ? "answered" : "none";
}

/** The band header's count: named of measured. Error and no-AIO rows are
 *  outside the denominator on purpose — nothing was measurable there. */
export function factsOf(rows: readonly GeoAnswer[]): { named: number; measured: number } {
  let named = 0;
  let measured = 0;
  for (const a of rows) {
    if (a.error || a.no_aio) continue;
    measured += 1;
    if (a.brand_mentioned === true) named += 1;
  }
  return { named, measured };
}

/** The persona a band shows: the rollup's tag when it has one, else whatever
 *  the stored answers themselves were stamped with (a question dropped from
 *  the current set still has answers worth labelling). Empty string means
 *  untagged, and untagged means no chip — never a chip that says "". */
export function personaKeyOf(
  fromRollup: string | undefined,
  rows: readonly GeoAnswer[],
): string | null {
  if (fromRollup) return fromRollup;
  return rows.find((a) => a.persona)?.persona || null;
}

/** A persona key is a slug (`solo-attorney`); on screen it reads as words. */
export const personaWords = (key: string): string => key.replace(/[-_]+/g, " ").trim();

/** Resolve a source-gap row's example prompt ids to readable question text:
 *  the first `max` that resolve, each cut at a word boundary. An id the rollup
 *  does not know is skipped, never invented — the caller draws a dash when
 *  nothing resolves. */
export function sampleQuestions(
  ids: readonly string[],
  rollup: readonly GeoPromptRollup[] | undefined,
  max = 2,
  maxLen = 80,
): string[] {
  if (!rollup?.length) return [];
  const textOf = new Map(rollup.map((r) => [r.prompt_id, r.text]));
  const out: string[] = [];
  for (const id of ids) {
    const text = textOf.get(id);
    if (!text) continue;
    out.push(truncate(text, maxLen));
    if (out.length >= max) break;
  }
  return out;
}

/** Cut at the last word boundary that keeps most of the budget, so a sample
 *  question never ends mid-word. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const at = cut.lastIndexOf(" ");
  return `${(at > maxLen * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}
