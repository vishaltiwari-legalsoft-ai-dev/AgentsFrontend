/** Wording and derivations for the competitor comparison table.
 *
 *  The trap this file exists to close: a rival with no domain on record has an
 *  UNKNOWN citation rate, and the obvious rendering — `pct(row.citation?.rate)`
 *  — draws that as "0%", which reads as "never cited". That is a claim we did
 *  not measure, about a competitor, in a table someone will take to a meeting.
 *
 *  Pure: no component, no network.
 */
import type { GeoComparisonRow, GeoQuestionRow, GeoUntrackedDomain } from "@/lib/api";

export const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

export type Cell = { text: string; unknown: boolean; title?: string };

/** The citation column for one row: a rate, or the reason there isn't one. */
export function citationCell(row: GeoComparisonRow): Cell {
  if (!row.domain) {
    return {
      text: "no domain",
      unknown: true,
      title: `No domain on record for ${row.name}, so their citations cannot be counted. Add one to compare.`,
    };
  }
  if (!row.citation || row.citation.rate === null) {
    return {
      text: "—",
      unknown: true,
      title: "No answer in this window carried citations, so there is nothing to count.",
    };
  }
  return {
    text: pct(row.citation.rate),
    unknown: false,
    title: `${row.citation.cited_answers} of ${row.citation.n_answers_with_citations} answers with citations link ${row.domain}.`,
  };
}

/** "1st or 2nd name" — where a brand lands inside the answer. Being named
 *  ninth is not the same win as being named first. */
export function positionCell(row: GeoComparisonRow): Cell {
  if (row.avg_position === null) {
    return { text: "—", unknown: true, title: `${row.name} is never named in this window.` };
  }
  return {
    text: `#${row.avg_position.toFixed(1)}`,
    unknown: false,
    title: `On average ${row.name} is the ${row.avg_position.toFixed(1)}th name in the answer. Lower is better.`,
  };
}

export type Scoreboard = { won: number; lost: number; tied: number; open: number; total: number };

/** Questions we lead on, they lead on, are level on, and that neither of us
 *  has claimed. The last bucket is the one worth acting on first. */
export function scoreboard(row: GeoComparisonRow): Scoreboard | null {
  if (!row.vs_self) return null;
  return {
    won: row.vs_self.ahead,
    lost: row.vs_self.behind,
    tied: row.vs_self.tied,
    open: row.vs_self.both_absent,
    total: row.vs_self.n_prompts,
  };
}

/** One sentence a person can repeat in a meeting. Never invented: when there
 *  is nothing to compare, it says that instead. */
export function headline(
  rows: GeoComparisonRow[],
  brandName: string,
  trackedCompetitors: number,
): string {
  const self = rows.find((r) => r.is_self);
  const rivals = rows.filter((r) => !r.is_self);
  if (!trackedCompetitors) {
    return `No competitors tracked yet — add the firms you lose deals to and this becomes a scoreboard.`;
  }
  if (!self || self.mention.rate === null) {
    return `Nothing measured for ${brandName} in this window — run a poll first.`;
  }
  const ahead = rivals.filter((r) => (r.mention.rate ?? 0) > (self.mention.rate ?? 0));
  const worstLoss = rivals
    .map((r) => ({ r, lost: r.vs_self?.behind ?? 0 }))
    .sort((a, b) => b.lost - a.lost)[0];
  if (!ahead.length) {
    const lostLine =
      worstLoss && worstLoss.lost > 0
        ? ` ${worstLoss.r.name} still leads on ${worstLoss.lost} question${worstLoss.lost === 1 ? "" : "s"}.`
        : "";
    return `${brandName} is named in ${pct(self.mention.rate)} of tracked answers — ahead of every tracked competitor.${lostLine}`;
  }
  const leader = ahead.sort((a, b) => (b.mention.rate ?? 0) - (a.mention.rate ?? 0))[0];
  return `${leader.name} is named in ${pct(leader.mention.rate)} of the same answers, against ${pct(self.mention.rate)} for ${brandName}.`;
}

/** Questions where at least one rival beats us — the work list, worst first.
 *  Already sorted that way by the backend; this just names the cut. */
export function losingQuestions(questions: GeoQuestionRow[]): GeoQuestionRow[] {
  return questions.filter((q) => q.rivals_ahead.length > 0);
}

/** Domains worth proposing as competitors: cited on our questions, and mostly
 *  in answers we are absent from. Ranked by the backend; this only drops the
 *  ones that never coincide with our absence. */
export function trackableDomains(domains: GeoUntrackedDomain[]): GeoUntrackedDomain[] {
  return domains.filter((d) => d.answers_you_absent > 0);
}

/** A domain to a competitor name: "clio.com" → "Clio". Good enough for a
 *  prefilled input the user can correct — never written without them seeing it. */
export function suggestName(domain: string): string {
  const stem = (domain || "").split(".")[0] || domain;
  return stem
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Stable id for a tracked competitor. Shared with the Overview tab so one
 *  name cannot produce two different keys depending on where it was typed. */
export function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "comp";
}
