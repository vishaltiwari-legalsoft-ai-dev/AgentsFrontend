/** Plain words for the page-check panel.
 *
 *  The backend speaks in enums ("likely cannibalizes", risk "unknown", evidence
 *  kind "gsc"); the panel speaks to a marketer. Every translation lives here,
 *  pure and tested, so the component stays markup and the words stay honest —
 *  in particular: an **unknown** overlap risk is never worded as a safe one,
 *  and an enum this module has never seen falls through as itself rather than
 *  being dressed up as something it is not.
 */

/** The verdict sentence, split so the component can put the pivotal words on
 *  the marigold swipe. `mark` is "" when nothing deserves emphasis (a verdict
 *  of "cannot tell" is not a result to celebrate). */
export interface VerdictParts {
  before: string;
  mark: string;
  after: string;
}

const VERDICTS: Record<string, VerdictParts> = {
  "likely helps": { before: "", mark: "Likely helps", after: "" },
  "needs work": { before: "", mark: "Needs work", after: " before it will help" },
  "likely cannibalizes": { before: "", mark: "Likely cannibalizes", after: " a page you already have" },
  "cannot tell": { before: "Could not tell either way", mark: "", after: "" },
};

export function verdictParts(label: string): VerdictParts {
  // An unfamiliar label renders as itself: wrong words are worse than plain ones.
  return VERDICTS[label] ?? { before: label, mark: "", after: "" };
}

export const verdictSentence = (label: string): string => {
  const p = verdictParts(label);
  return `${p.before}${p.mark}${p.after}`;
};

export function confidenceWords(confidence: string): string {
  return confidence === "high" || confidence === "medium" || confidence === "low"
    ? `${confidence} confidence`
    : "";
}

/** Where the measured query came from, for the "Measured for …" line.
 *  "given" is the user's own phrase and needs no explaining. */
export function querySourceWords(source: string): string {
  if (source === "page_title") return "taken from the page title";
  if (source === "draft_heading") return "taken from the draft's first heading";
  return "";
}

/** The overlap risk in one sentence. "unknown" (and anything unrecognised) is
 *  worded as not-checked — never as safe. */
export function riskSentence(risk: string): string {
  switch (risk) {
    case "high":
      return "This topic overlaps a page you already have — published as is, the two would compete for the same searches.";
    case "medium":
      return "This topic partly overlaps a page you already have — worth a look before publishing.";
    case "low":
      return "No serious overlap with your existing pages was found.";
    default:
      return "Overlap with your own pages could not be checked.";
  }
}

export const riskIsKnown = (risk: string): boolean =>
  risk === "high" || risk === "medium" || risk === "low";

/** The evidence chip: where a piece of overlap evidence was seen. */
export function evidenceWhere(kind: string): string {
  if (kind === "serp") return "search results";
  if (kind === "corpus") return "your site";
  if (kind === "gsc") return "search console";
  return kind;
}

/** The muted prefix on a pro/con row. Kinds are open-ended on the backend, so
 *  only the one opaque abbreviation is translated; the rest just lose their
 *  underscores. */
export function kindWords(kind: string): string {
  if (kind === "paa") return "searchers ask";
  return kind.replace(/_/g, " ");
}

/** Cons carry `priority` on the gap-derived rows only — lower means fix first.
 *  Prioritised rows lead in that order; the rest keep the backend's order. */
export function sortCons<T extends { priority?: number }>(cons: T[]): T[] {
  return cons
    .map((c, i) => [c, i] as const)
    .sort((a, b) =>
      (a[0].priority ?? Number.POSITIVE_INFINITY) - (b[0].priority ?? Number.POSITIVE_INFINITY) ||
      a[1] - b[1],
    )
    .map(([c]) => c);
}

/** A URL shortened for a narrow list row: scheme and www off, capped with an
 *  ellipsis. Never returns "" for a non-empty input. */
export function shortUrl(url: string, max = 56): string {
  const s = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "") || url;
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}
