/** Home's two usage blocks: the decisions behind the rows, with no React in them.
 *
 *  The payload says several things that are not a number — a person who has
 *  not signed in, a chart row two accounts could be, a record that could not
 *  be read — and each has to stay distinct from a count of zero all the way to
 *  the cell. Those rules, the window sentence and the chip order live here so
 *  `format.test.ts` can pin them without rendering anything.
 */

import type { HumansMonth, HumansUser, TeamReportee, TeamUsage, TeamUsageTeam } from "@/lib/api";
import { AGENTS } from "./model";

/* ------------------------------------------------------------- the rows -- */

export type RowState = "counted" | "not-signed-in" | "ambiguous" | "unread";

/** Match first, then readability. A row nobody is attached to has no record to
 *  read, so `read_ok` says nothing about it; and the counts on a row that is
 *  not `counted` are never looked at, whatever they hold. */
export function rowState(r: Pick<TeamReportee, "match" | "read_ok">): RowState {
  if (r.match === "none") return "not-signed-in";
  if (r.match === "ambiguous") return "ambiguous";
  if (!r.read_ok) return "unread";
  return "counted";
}

/** The quiet tag a row carries instead of its figures. */
export const ROW_NOTE: Record<Exclude<RowState, "counted">, string> = {
  "not-signed-in": "not signed in yet",
  ambiguous: "two accounts match — ask an admin",
  unread: "could not be read",
};

export interface AgentChip {
  id: string;
  name: string;
  count: number;
}

/** Busiest specialist first; ties keep the catalogue's order; an id the
 *  catalogue does not know keeps its id as its name rather than vanishing.
 *  A zero is not a chip. */
export function agentChips(byAgent: Record<string, number>): AgentChip[] {
  const rank = (id: string) => {
    const i = AGENTS.findIndex((a) => a.id === id);
    return i === -1 ? AGENTS.length : i;
  };
  return Object.entries(byAgent)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, name: AGENTS.find((a) => a.id === id)?.name ?? id, count }))
    .sort((a, b) => b.count - a.count || rank(a.id) - rank(b.id));
}

/* ---------------------------------------------------------- the windows -- */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `YYYY-MM-DD` and `YYYY-MM` are calendar dates, not instants, so they are
 *  read by hand: `new Date("2026-10-08")` is midnight UTC, which west of
 *  Greenwich is the evening before. */
function calendar(s: string): { y: number; m: number; d: number | null } | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { y: Number(m[1]), m: month, d: m[3] ? Number(m[3]) : null };
}

/** `8 October 2026`, or `8 October` without the year. Anything that is not a
 *  date comes back as it was — shown, not reinterpreted. */
export function dayName(ymd: string, withYear = true): string {
  const c = calendar(ymd);
  if (!c || c.d === null) return ymd;
  return `${c.d} ${MONTH_NAMES[c.m - 1]}${withYear ? ` ${c.y}` : ""}`;
}

/** `October 2026`. */
export function monthLabel(ym: string): string {
  const c = calendar(ym);
  if (!c) return ym;
  return `${MONTH_NAMES[c.m - 1]} ${c.y}`;
}

/** The sentence under the table that says which days the three columns cover,
 *  taken from the backend's own window rather than the reader's clock. */
export function windowNote(w: Pick<TeamUsageTeam, "today" | "week_from" | "month">): string {
  return `Today is ${dayName(w.today)} · the week counts from ${dayName(w.week_from, false)} · the month is ${monthLabel(w.month)}.`;
}

/* ------------------------------------------------------------ the totals -- */

export interface TeamSummary {
  counted: number;
  notSignedIn: number;
  ambiguous: number;
  unread: number;
  /** The backend's totals, passed through: they are the figures it stands
   *  behind, and this console does not re-add rows it has just said it could
   *  not read. */
  totals: TeamUsageTeam["totals"];
}

export function teamSummary(team: Pick<TeamUsageTeam, "reportees" | "totals">): TeamSummary {
  const s: TeamSummary = { counted: 0, notSignedIn: 0, ambiguous: 0, unread: 0, totals: team.totals };
  for (const r of team.reportees) {
    const st = rowState(r);
    if (st === "counted") s.counted += 1;
    else if (st === "not-signed-in") s.notSignedIn += 1;
    else if (st === "ambiguous") s.ambiguous += 1;
    else s.unread += 1;
  }
  return s;
}

/** `4 of 6 counted · 1 not signed in yet · 1 could not be read`, or `all 6
 *  counted` when there is nothing to explain. */
export function summaryNote(s: TeamSummary): string {
  const all = s.counted + s.notSignedIn + s.ambiguous + s.unread;
  if (all === 0) return "";
  if (s.counted === all) return `all ${all} counted`;
  const parts = [`${s.counted} of ${all} counted`];
  if (s.notSignedIn) parts.push(`${s.notSignedIn} not signed in yet`);
  if (s.ambiguous) parts.push(`${s.ambiguous} matched two accounts`);
  if (s.unread) parts.push(`${s.unread} could not be read`);
  return parts.join(" · ");
}

/* ------------------------------------------------------------ by humans -- */

/** Newest month first, whatever order the backend sent. `YYYY-MM` sorts as a
 *  string. Returns a copy. */
export function monthsNewestFirst(months: readonly HumansMonth[]): HumansMonth[] {
  return [...months].sort((a, b) => (a.year_month < b.year_month ? 1 : a.year_month > b.year_month ? -1 : 0));
}

/** Most runs first; ties by name, so the list is stable between reads. */
export function usersByRuns(users: readonly HumansUser[]): HumansUser[] {
  return [...users].sort((a, b) => b.runs - a.runs || (a.name || a.email).localeCompare(b.name || b.email));
}

/* ------------------------------------------------------------- the gate -- */

/** A plain member gets both sections null, and Home shows nothing extra. */
export const hasExtras = (p: Pick<TeamUsage, "team" | "humans">): boolean =>
  p.team !== null || p.humans !== null;
