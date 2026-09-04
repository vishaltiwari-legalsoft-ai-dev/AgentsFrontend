import type {
  MrAnyReportKind, MrBoardCoverageColumn, MrBoardRow, MrReportKind, MrReportPeriod,
  MrReportPeriods,
} from "@/lib/api";

export interface ReportMeta { label: string; eyebrow: string; desc: string }

/** Keyed by every kind the run rail can hand back, not just the ten the panel
 *  offers as a list: `GET /api/mr/runs` lists board runs too, and a run whose
 *  kind has no entry here renders as its own raw id string. */
export const REPORT_META: Record<MrAnyReportKind, ReportMeta> = {
  daily_summary: {
    label: "Daily Performance Summary", eyebrow: "Daily · Marketing",
    desc: "Month-to-date through yesterday — spend, leads and demos per channel, flagged against the 2026 goals.",
  },
  weekly_summary: {
    label: "Weekly Performance Summary", eyebrow: "Weekly · Marketing",
    desc: "The last 7 days' blended KPIs with per-channel and per-vendor movement.",
  },
  monthly_summary: {
    label: "Monthly Performance Summary", eyebrow: "Monthly · Marketing",
    desc: "The month's blended KPIs, vendor detail and flags against the 2026 goals.",
  },
  quarterly_summary: {
    label: "Quarterly Performance Summary", eyebrow: "Quarterly · Marketing",
    desc: "Quarter-to-date performance and pacing for the leadership read.",
  },
  threshold_alert: {
    label: "Campaign Threshold Alert", eyebrow: "Triggered · Alert",
    desc: "Every campaign currently breaching a cost ceiling — CPL, CAC or spend-with-no-demo.",
  },
  competitor_digest: {
    label: "Competitor Change Digest", eyebrow: "Weekly · Competitive intel",
    desc: "What changed on tracked competitors' sites and positioning this week.",
  },
  opportunity_report: {
    label: "Media Opportunity Report", eyebrow: "Bi-weekly · Partnerships",
    desc: "Podcasts, newsletters and placements ranked by ICP fit and audience.",
  },
  utm_attribution: {
    label: "UTM Attribution Summary", eyebrow: "Weekly · Attribution",
    desc: "Which campaigns and practice areas actually produce qualified leads.",
  },
  icp_signal: {
    label: "ICP Audience Signal", eyebrow: "Monthly · Audience",
    desc: "Where ideal-customer-profile buyers are showing up, scored and ranked.",
  },
  daily_movement: {
    label: "Daily Movement Report", eyebrow: "Daily · Snapshots",
    desc: "What actually happened yesterday per vendor — day deltas from the snapshot history, corrections flagged.",
  },
  board_report: {
    label: "Board Report", eyebrow: "On demand · Board",
    desc: "The roll-up tab's own ledger for one period — no model writes any part of it.",
  },
  board_report_comparison: {
    label: "Board Report — two periods", eyebrow: "On demand · Board",
    desc: "The same ledger with a second column beside it, and the movement between them.",
  },
};

/* ---------------------------- picker periods ------------------------------ */

/** Which list in `GET /api/mr/report-periods` a report kind draws its periods
 *  from.
 *
 *  The endpoint answers `{months: [...], quarters: [...]}` — two named lists,
 *  never a map keyed by report kind. Reading it as `periods[kind]` therefore
 *  produces `undefined` for all ten kinds, which is what killed the hub's
 *  period picker: every build went out with no period at all and there was no
 *  way to ask for a specific quarter. The mapping has to be written down,
 *  because it cannot be derived from the kind's name.
 *
 *  Only these two take a period; `POST /api/mr/reports/{kind}` answers 422 for
 *  any other kind that is sent one, so the rest must never be offered a picker.
 */
export const REPORT_PERIOD_LIST: Partial<Record<MrReportKind, keyof MrReportPeriods>> = {
  monthly_summary: "months",
  quarterly_summary: "quarters",
};

/** True when this kind is offered a period at all. */
export const takesPeriod = (kind: MrReportKind): boolean => kind in REPORT_PERIOD_LIST;

/** The periods this kind can be built for, newest first — `[]` for a kind that
 *  takes none, and `[]` while the lists have not been read. Always an array, so
 *  a caller renders an empty picker state rather than crashing on `undefined`. */
export function periodsFor(
  kind: MrReportKind,
  periods: MrReportPeriods | null,
): MrReportPeriod[] {
  const list = REPORT_PERIOD_LIST[kind];
  return list ? periods?.[list] ?? [] : [];
}

/* ------------------------- the board report's periods --------------------- */

/** One heading in the board pickers, and the periods under it. */
export interface BoardPeriodGroup { label: string; options: MrReportPeriod[] }

/** The years the tracker holds any month of, newest first.
 *
 *  Derived rather than fetched: `GET /api/mr/report-periods` answers months and
 *  quarters only, while `POST /api/mr/board-report` also accepts `YYYY`. A year
 *  offered here is one at least one tracker month falls in — never an invented
 *  window — and a year that turns out to hold nothing is still the backend's
 *  422 to give, not this list's to guess at.
 *
 *  A year means all twelve of its months. The months the sheet has no rows for
 *  are named by the report (its `gaps`) instead of being summed around, which
 *  is why the current year is offered like any other rather than quietly
 *  turned into a year-to-date. */
function yearsIn(months: MrReportPeriod[]): MrReportPeriod[] {
  const seen = new Map<string, boolean>();
  for (const m of months) {
    const year = m.period.slice(0, 4);
    if (!/^\d{4}$/.test(year)) continue;   // a period shaped like nothing we know
    seen.set(year, (seen.get(year) ?? false) || m.current);
  }
  return [...seen.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([year, current]) => ({ period: year, label: year, current }));
}

/** Everything either board picker may offer, grouped for `<optgroup>`.
 *
 *  Both columns read the same list on purpose. The report's two columns are
 *  only "column A" and "column B" — the template's quarters were never the
 *  structure — so month-against-month, quarter-against-quarter and
 *  year-against-year all fall out of one control, and nothing here forecloses
 *  a comparison by shape.
 *
 *  A group with nothing in it is dropped rather than rendered as an empty
 *  heading, and the whole thing is `[]` while the periods are unread or the
 *  read failed — so the caller shows its own three states instead of an empty
 *  select that looks like "there is nothing". */
export function boardPeriodOptions(periods: MrReportPeriods | null): BoardPeriodGroup[] {
  const months = periods?.months ?? [];
  const groups: BoardPeriodGroup[] = [
    { label: "Months", options: months },
    { label: "Quarters", options: periods?.quarters ?? [] },
    { label: "Years", options: yearsIn(months) },
  ];
  return groups.filter((g) => g.options.length > 0);
}

/** Every period value on offer, flat — for checking that a pick still exists
 *  after the lists are re-read. A stored pick that no longer appears must never
 *  be sent: the backend would either refuse it or, worse, accept a window the
 *  reader is no longer looking at. */
export function boardPeriodValues(groups: BoardPeriodGroup[]): string[] {
  return groups.flatMap((g) => g.options.map((o) => o.period));
}

/* ------------------------ what the report could fill ---------------------- */

/** One metric a column left blank, ready to print. */
export interface AbsentMetric { key: string; label: string; group: string; reason: string }

/** How much of the catalog this column filled.
 *
 *  `metric_count` is the backend's own total; the sum of the two lists is the
 *  fallback, so a reply that predates the field still reads as "13 of 38"
 *  rather than "13 of 0". */
export function filledOf(column: MrBoardCoverageColumn): { filled: number; of: number } {
  const of = column.metric_count || (column.filled?.length ?? 0) + (column.absent?.length ?? 0);
  return { filled: column.filled_count ?? column.filled?.length ?? 0, of };
}

/** The metrics this column has no number for, each with the reason the backend
 *  gave, in the report's own print order.
 *
 *  Absent is never zero, and this is the list that says so by name. A key the
 *  ledger rows do not carry is still listed — under its own key, with whatever
 *  reason came back — because dropping it would silently shrink the count the
 *  line above it just published. */
export function absentMetrics(
  column: MrBoardCoverageColumn,
  rows: MrBoardRow[],
): AbsentMetric[] {
  const absent = new Set(column.absent ?? []);
  const reason = (key: string) =>
    (column.absent_reasons ?? {})[key] || "the report did not say why";
  const inOrder = (rows ?? [])
    .filter((r) => absent.has(r.key))
    .map((r) => ({ key: r.key, label: r.label, group: r.group, reason: reason(r.key) }));
  const named = new Set(inOrder.map((m) => m.key));
  const orphans = [...absent]
    .filter((k) => !named.has(k))
    .map((k) => ({ key: k, label: k, group: "", reason: reason(k) }));
  return [...inOrder, ...orphans];
}
