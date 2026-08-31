/** Issues — the decisions behind the Issues panel and Home's blocker rows.
 *
 *  Pure on purpose, like `work/geo/highlight.ts`: grouping, ordering, the
 *  counts sentence, and where a fix button sends the reader are all rules, not
 *  I/O, so they live here where `issues.test.ts` can prove them in node with
 *  no DOM. The views only draw what these functions decide.
 *
 *  The backend contract (lib/api.ts `getIssues`) already sorts high → medium →
 *  low then brand; `homeIssues` re-asserts that order locally so a mis-ordered
 *  payload can never put a low-severity row above an urgent one on Home.
 */

import type { Issue, IssueFix, IssuesPayload } from "@/lib/api";

export type Severity = Issue["severity"];

/** Most severe first — the one order both views draw in. */
export const SEVERITY_ORDER: readonly Severity[] = ["high", "medium", "low"];

export interface SeverityMeta {
  /** The chip's word. */
  chip: string;
  /** The group heading on the Issues panel. */
  head: string;
  /** The sentence under that heading. */
  note: string;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  high: {
    chip: "High",
    head: "Fix now",
    note: "Data is being lost or a specialist cannot do its job until these are put right.",
  },
  medium: {
    chip: "Medium",
    head: "Fix soon",
    note: "The numbers are real but incomplete while these stand.",
  },
  low: {
    chip: "Low",
    head: "Worth knowing",
    note: "Nothing is broken. Read once, then decide.",
  },
};

export interface SeverityGroup {
  severity: Severity;
  issues: Issue[];
}

/** The panel's groups: high first, backend order kept inside each group, and
 *  an empty group simply absent — a heading over nothing is a claim. */
export function groupBySeverity(issues: readonly Issue[]): SeverityGroup[] {
  return SEVERITY_ORDER
    .map((severity) => ({ severity, issues: issues.filter((i) => i.severity === severity) }))
    .filter((g) => g.issues.length > 0);
}

/** The one-line statement the panel opens with, driven only by the counts. */
export function countsLine(counts: IssuesPayload["counts"]): string {
  const total = counts.high + counts.medium + counts.low;
  if (total === 0) return "All clear — nothing needs your attention";
  const base = total === 1 ? "1 thing needs fixing" : `${total} things need fixing`;
  if (counts.high === 0) return base;
  return total === 1 ? `${base} — urgent` : `${base} — ${counts.high} urgent`;
}

/** Where a fix button sends the reader. `section === "settings"` is not a
 *  workspace section — engine keys live on the Settings panel — so that one
 *  routes to the panel, everything else into the named workspace. */
export type FixRoute =
  | { kind: "panel"; panel: "settings" }
  | { kind: "work"; workspace: string; subject: string; section: string };

export function routeForFix(fix: IssueFix): FixRoute {
  if (fix.section === "settings") return { kind: "panel", panel: "settings" };
  return { kind: "work", workspace: fix.workspace, subject: fix.subject, section: fix.section };
}

/** Whether a Home row needs the brand named beside it. Most backend titles
 *  carry the brand already ("berry Virtual has never been measured…"); a title
 *  that does not ("Search Console has not granted access…") would read as
 *  workspace-wide without it. "All brands" is workspace-wide, so no tag. */
export function needsBrandTag(issue: Pick<Issue, "brand" | "title">): boolean {
  const brand = issue.brand.trim();
  if (!brand || brand === "All brands") return false;
  return !issue.title.toLowerCase().includes(brand.toLowerCase());
}

/** How many backend issues Home shows before pointing at the full panel. */
export const HOME_ISSUE_LIMIT = 3;

export interface HomeIssues {
  /** The rows Home draws, most severe first. */
  top: Issue[];
  /** Whether Home owes the reader an "All issues" link. */
  more: boolean;
  /** How many issues the link is standing in for (0 can still need the link —
   *  a low-severity issue shown on Home is shown without its full context). */
  remaining: number;
}

export function homeIssues(payload: IssuesPayload, limit = HOME_ISSUE_LIMIT): HomeIssues {
  const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
  // Stable sort: re-asserts severity order, keeps the backend's brand order.
  const ordered = [...payload.issues].sort((a, b) => rank(a.severity) - rank(b.severity));
  const top = ordered.slice(0, limit);
  const remaining = ordered.length - top.length;
  return { top, more: remaining > 0 || payload.counts.low > 0, remaining };
}
