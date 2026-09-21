import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LINE_META, METRICS_WITHOUT_A_LINE, caughtBy, unattributed } from "./lineMap";
import type {
  MrAskAnswer, MrAskFact, MrBoardCoverageColumn, MrBoardRow, MrReportKind, MrReportPeriods,
} from "@/lib/api";
import {
  REPORT_META, REPORT_PERIOD_LIST, absentMetrics, boardPeriodOptions, boardPeriodValues,
  filledOf, periodsFor, takesPeriod,
} from "../../../console/mr/reportMeta";
import {
  askCaveat, askPeriodLabel, askProvenance, citedFacts, citeTitle, citeTokens, isOfflineSummary,
  mayDisconnect, mrDataActions, notModelWritten, offersForcedPull, pullBody, readNarrative,
  summarisePull,
} from "../../../console/mr/format";

/** The threshold keys `GET /api/mr/targets` returned on the live account.
 *  Pinned here so a key the backend adds — or renames — turns this red instead
 *  of silently reading as a line that catches nothing. */
const LIVE_THRESHOLD_KEYS = [
  "bad_lead_rate_red",
  "booking_rate_broken",
  "cac_red",
  "cac_target",
  "canceled_rate_red",
  "conversion_drop_pct",
  "cost_per_booking_flag",
  "cost_per_qualified_lead_red",
  "cost_per_qualified_lead_target_high",
  "cost_per_qualified_lead_target_low",
  "mgmt_fee_limit",
  "no_show_rate_red",
  "ql_ratio_great",
  "spend_no_demo_limit",
  "zero_completed_min_demos",
];

/** The flag metrics `GET /api/mr/overview` returned on the same account. */
const LIVE_FLAG_METRICS = [
  "cost_per_qualified_lead",
  "cac",
  "cost_per_booking",
  "channel_goal",
  "bad_lead_rate",
  "no_show_rate",
  "canceled_rate",
  "zero_completed",
];

describe("the line each flag crossed", () => {
  it("has an entry for every threshold the API returns", () => {
    const missing = LIVE_THRESHOLD_KEYS.filter((k) => !(k in LINE_META));
    expect(missing, "a threshold with no entry renders as a line nobody can read").toEqual([]);
  });

  it("accounts for every flag metric the API raises", () => {
    const owned = new Set(Object.values(LINE_META).map((m) => m.metric).filter(Boolean));
    const orphans = LIVE_FLAG_METRICS.filter((m) => !owned.has(m) && !(m in METRICS_WITHOUT_A_LINE));
    expect(orphans, "a flag metric no line owns is one the Lines panel silently loses").toEqual([]);
  });

  it("never lets two lines claim the same flag metric", () => {
    // Two owners would double-count the same finding on this panel.
    const seen = new Map<string, string>();
    for (const [key, meta] of Object.entries(LINE_META)) {
      if (!meta.metric) continue;
      expect(seen.has(meta.metric), `${meta.metric} claimed twice`).toBe(false);
      seen.set(meta.metric, key);
    }
  });

  it("does not join by prefix, which is the bug this file exists for", () => {
    // All three start with `cost_per_qualified_lead`. Only one is the red line.
    expect(LINE_META.cost_per_qualified_lead_red.metric).toBe("cost_per_qualified_lead");
    expect(LINE_META.cost_per_qualified_lead_target_low.metric).toBeNull();
    expect(LINE_META.cost_per_qualified_lead_target_high.metric).toBeNull();
  });
});

describe("caughtBy", () => {
  const groups = [
    { metric: "cost_per_qualified_lead", count: 4 },
    { metric: "no_show_rate", count: 7 },
    { metric: "channel_goal", count: 9 },
    { metric: null, count: 2 },
  ];

  it("counts the findings a line is responsible for", () => {
    expect(caughtBy("cost_per_qualified_lead_red", groups)).toBe(4);
    expect(caughtBy("no_show_rate_red", groups)).toBe(7);
  });

  it("reads zero for a line that fires but is currently catching nothing", () => {
    expect(caughtBy("canceled_rate_red", groups)).toBe(0);
  });

  it("reads null for a line that does not raise flags at all", () => {
    // "does not fire" and "fires but caught nothing" are different statements
    // about the same dash, and the panel says which.
    expect(caughtBy("cac_target", groups)).toBeNull();
    expect(caughtBy("ql_ratio_great", groups)).toBeNull();
  });

  it("reads null for a key it has never heard of rather than guessing zero", () => {
    expect(caughtBy("something_the_backend_added_today", groups)).toBeNull();
  });

  it("adds up when one metric arrives split across levels", () => {
    expect(caughtBy("no_show_rate_red", [
      { metric: "no_show_rate", count: 5 },
      { metric: "no_show_rate", count: 2 },
    ])).toBe(7);
  });
});

describe("unattributed", () => {
  it("names the flags no line owns, so the panel can show them rather than lose them", () => {
    const out = unattributed([
      { metric: "cost_per_qualified_lead", count: 4 },
      { metric: "channel_goal", count: 9 },
    ]);
    expect(out.map((g) => g.metric)).toEqual(["channel_goal"]);
  });

  it("ignores a group with no metric at all", () => {
    expect(unattributed([{ metric: null, count: 3 }])).toEqual([]);
  });
});

/* --------------------------------------------------------------------------
   The Reports panel's period picker.
   Lives here rather than in a file of its own: this is the MR work area's test
   module, and the decision under test — which of the endpoint's two lists a
   report kind reads — belongs to the panel next door.
   -------------------------------------------------------------------------- */


/** The exact shape `GET /api/mr/report-periods` answers with — two named
 *  lists, never a map keyed by report kind. Pinned from
 *  `reports.available_periods()`, so a backend that renames or drops a list
 *  turns this red instead of quietly handing the picker nothing. */
const LIVE_PERIODS: MrReportPeriods = {
  months: [
    { period: "2026-09", label: "September 2026", current: true },
    { period: "2026-08", label: "August 2026", current: false },
    { period: "2026-07", label: "July 2026", current: false },
  ],
  quarters: [
    { period: "2026-Q3", label: "Q3 2026", current: true },
    { period: "2026-Q2", label: "Q2 2026", current: false },
  ],
};

/** The eight kinds `POST /api/mr/reports/{kind}` answers 422 for when a period
 *  is sent — so the picker must never offer them one. */
const KINDS_WITHOUT_A_PERIOD: MrReportKind[] = [
  "daily_summary", "weekly_summary", "threshold_alert", "competitor_digest",
  "opportunity_report", "utm_attribution", "icp_signal", "daily_movement",
];

describe("periodsFor", () => {
  it("reads the monthly report's periods from the months list", () => {
    expect(periodsFor("monthly_summary", LIVE_PERIODS).map((p) => p.period))
      .toEqual(["2026-09", "2026-08", "2026-07"]);
  });

  it("reads the quarterly report's periods from the quarters list, so a specific quarter can be asked for", () => {
    expect(periodsFor("quarterly_summary", LIVE_PERIODS).map((p) => p.period))
      .toEqual(["2026-Q3", "2026-Q2"]);
  });

  it("never keys the payload by report kind — the regression that emptied the picker", () => {
    // `periods["monthly_summary"]` is undefined for all ten kinds; only the two
    // list names exist on the payload, and that is what the map must hold.
    expect(Object.values(REPORT_PERIOD_LIST).every((list) => list in LIVE_PERIODS)).toBe(true);
    expect(Object.keys(LIVE_PERIODS)).not.toContain("monthly_summary");
  });

  it("offers nothing for a kind the backend refuses a period on", () => {
    for (const kind of KINDS_WITHOUT_A_PERIOD) {
      expect(takesPeriod(kind)).toBe(false);
      expect(periodsFor(kind, LIVE_PERIODS)).toEqual([]);
    }
    expect(takesPeriod("monthly_summary")).toBe(true);
    expect(takesPeriod("quarterly_summary")).toBe(true);
  });

  it("returns a list, never undefined, while the periods are unread or the read failed", () => {
    expect(periodsFor("monthly_summary", null)).toEqual([]);
    expect(periodsFor("quarterly_summary", null)).toEqual([]);
  });

  it("returns a list when the payload holds no periods at all, so the picker shows its empty state", () => {
    expect(periodsFor("monthly_summary", { months: [], quarters: [] })).toEqual([]);
  });

  it("survives a payload missing a list rather than handing the picker undefined to map over", () => {
    const partial = { months: LIVE_PERIODS.months } as MrReportPeriods;
    expect(periodsFor("quarterly_summary", partial)).toEqual([]);
    expect(periodsFor("monthly_summary", partial)).toHaveLength(3);
  });
});

/* --------------------------------------------------------------------------
   The board report: its two period pickers, and what it could fill.
   Same reason the period tests above live here — this is the MR work area's
   test module, and both decisions belong to the Reports panel next door.
   `Reports.tsx` imports `@/lib/api` at runtime and vitest resolves no `@/`
   alias, so the seam that can be tested is `reportMeta.ts` (and `format.ts`),
   which import types only.
   -------------------------------------------------------------------------- */

describe("boardPeriodOptions", () => {
  it("offers months, quarters and the years they fall in — one control for all three comparisons", () => {
    const groups = boardPeriodOptions(LIVE_PERIODS);
    expect(groups.map((g) => g.label)).toEqual(["Months", "Quarters", "Years"]);
    // The locked decision: the ledger's columns are only A and B, so
    // month-vs-month, quarter-vs-quarter and year-vs-year all have to be
    // expressible from the same list.
    expect(boardPeriodValues(groups)).toEqual([
      "2026-09", "2026-08", "2026-07", "2026-Q3", "2026-Q2", "2026",
    ]);
  });

  it("offers only period strings the board route parses — YYYY-MM, YYYY-Qn or YYYY", () => {
    // `board_period()` refuses anything else with a 422 naming what it expected.
    for (const value of boardPeriodValues(boardPeriodOptions(LIVE_PERIODS))) {
      expect(value, `${value} is not a board-report period`)
        .toMatch(/^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/);
    }
  });

  it("derives a year from the months on file and never invents one", () => {
    const groups = boardPeriodOptions({
      months: [
        { period: "2026-01", label: "January 2026", current: false },
        { period: "2025-12", label: "December 2025", current: false },
        { period: "2025-03", label: "March 2025", current: false },
      ],
      quarters: [],
    });
    const years = groups.find((g) => g.label === "Years");
    expect(years?.options.map((o) => o.period)).toEqual(["2026", "2025"]);
  });

  it("marks the year holding the current month, so 'so far' reads on it too", () => {
    const years = boardPeriodOptions(LIVE_PERIODS).find((g) => g.label === "Years");
    expect(years?.options[0]).toEqual({ period: "2026", label: "2026", current: true });
  });

  it("drops a group with nothing in it rather than printing an empty heading", () => {
    const groups = boardPeriodOptions({ months: LIVE_PERIODS.months, quarters: [] });
    expect(groups.map((g) => g.label)).toEqual(["Months", "Years"]);
  });

  it("offers nothing at all while the periods are unread, or the read failed, or the tracker holds none", () => {
    // All three are the caller's own sentence to write — an empty select would
    // say "there is nothing" for a read that never came back.
    expect(boardPeriodOptions(null)).toEqual([]);
    expect(boardPeriodOptions({ months: [], quarters: [] })).toEqual([]);
    expect(boardPeriodValues([])).toEqual([]);
  });

  it("survives a payload missing a list rather than handing the picker undefined to map over", () => {
    const partial = { quarters: LIVE_PERIODS.quarters } as MrReportPeriods;
    expect(boardPeriodOptions(partial).map((g) => g.label)).toEqual(["Quarters"]);
  });
});

/* The production case this whole block exists for: the capture on file predates
   the roll-up parser expanding from 8 fields to 42, so the report fills 13 of
   38. A thin capture must never read as a thin quarter. */
const CATALOG_SIZE = 38;
const FILLED_TODAY = 13;

const ledgerRows: MrBoardRow[] = Array.from({ length: CATALOG_SIZE }, (_, i) => ({
  key: `m${i}`,
  label: `Metric ${i}`,
  group: i < 9 ? "Budget & Efficiency" : "Revenue",
  format: "money",
  polarity: "up",
}));

const liveColumn: MrBoardCoverageColumn = {
  column: "Q1 2026",
  period: "2026-Q1",
  months: ["2026-01", "2026-02", "2026-03"],
  filled: ledgerRows.slice(0, FILLED_TODAY).map((r) => r.key),
  absent: ledgerRows.slice(FILLED_TODAY).map((r) => r.key),
  absent_reasons: Object.fromEntries(
    ledgerRows.slice(FILLED_TODAY)
      .map((r) => [r.key, `the roll-up tab does not report '${r.key}' for this period`]),
  ),
  filled_count: FILLED_TODAY,
  metric_count: CATALOG_SIZE,
};

describe("filledOf", () => {
  it("reads the production case as 13 of 38", () => {
    expect(filledOf(liveColumn)).toEqual({ filled: 13, of: 38 });
  });

  it("counts the catalog itself when the backend sent no total, never 'of 0'", () => {
    const older = { ...liveColumn, metric_count: 0 } as MrBoardCoverageColumn;
    expect(filledOf(older)).toEqual({ filled: 13, of: 38 });
  });

  it("reads a fully covered column as all of them, not as a special case", () => {
    const full: MrBoardCoverageColumn = {
      ...liveColumn,
      filled: ledgerRows.map((r) => r.key),
      absent: [],
      absent_reasons: {},
      filled_count: CATALOG_SIZE,
    };
    expect(filledOf(full)).toEqual({ filled: 38, of: 38 });
    expect(absentMetrics(full, ledgerRows)).toEqual([]);
  });
});

describe("absentMetrics", () => {
  it("names every metric the column has no figure for — 25 of them, not one dropped", () => {
    const missing = absentMetrics(liveColumn, ledgerRows);
    expect(missing).toHaveLength(CATALOG_SIZE - FILLED_TODAY);
    // The count under the sentence and the list beneath it are the same fact,
    // and a reader who opens the list must be able to count it back.
    expect(missing.length + filledOf(liveColumn).filled).toBe(filledOf(liveColumn).of);
  });

  it("carries the backend's own reason for each one, so absent is never read as zero", () => {
    const missing = absentMetrics(liveColumn, ledgerRows);
    expect(missing[0].label).toBe("Metric 13");
    expect(missing[0].reason).toBe("the roll-up tab does not report 'm13' for this period");
    expect(missing.every((m) => m.reason.length > 0)).toBe(true);
  });

  it("prints them in the report's own row order, not the order the keys arrived in", () => {
    const shuffled: MrBoardCoverageColumn = {
      ...liveColumn,
      absent: [...liveColumn.absent].reverse(),
    };
    expect(absentMetrics(shuffled, ledgerRows).map((m) => m.key))
      .toEqual(ledgerRows.slice(FILLED_TODAY).map((r) => r.key));
  });

  it("still lists a metric the ledger rows do not carry, rather than shrinking the count", () => {
    const withStranger: MrBoardCoverageColumn = {
      ...liveColumn,
      absent: [...liveColumn.absent, "a_row_this_frontend_has_never_seen"],
      metric_count: CATALOG_SIZE + 1,
    };
    const missing = absentMetrics(withStranger, ledgerRows);
    expect(missing).toHaveLength(CATALOG_SIZE - FILLED_TODAY + 1);
    expect(missing[missing.length - 1].label).toBe("a_row_this_frontend_has_never_seen");
  });

  it("says so plainly when no reason came back, instead of printing an empty dash", () => {
    const silent: MrBoardCoverageColumn = { ...liveColumn, absent_reasons: {} };
    expect(absentMetrics(silent, ledgerRows).every((m) => m.reason === "the report did not say why"))
      .toBe(true);
  });

  it("survives a report carrying no rows at all — every absent key still gets named", () => {
    expect(absentMetrics(liveColumn, [])).toHaveLength(CATALOG_SIZE - FILLED_TODAY);
  });
});

describe("REPORT_META", () => {
  it("has an entry for the board kinds, which list on the same run rail as the ten", () => {
    // `GET /api/mr/runs` returns these alongside the campaign kinds; a kind with
    // no entry renders in the history table as its own raw id.
    expect(REPORT_META.board_report.label).toBe("Board Report");
    expect(REPORT_META.board_report_comparison.label).toBe("Board Report — two periods");
  });

  it("still refuses the board kinds a period picker — they take two, from their own control", () => {
    // `POST /api/mr/reports/{kind}` answers 422 for a board kind and names the
    // route that does build it, so the ten-kind list must never offer one.
    expect(REPORT_PERIOD_LIST).not.toHaveProperty("board_report");
    expect(REPORT_PERIOD_LIST).not.toHaveProperty("board_report_comparison");
  });
});

/* --------------------------------------------------------------------------
   Who is offered the Disconnect button on a connected sheet.
   -------------------------------------------------------------------------- */

describe("mayDisconnect", () => {
  it("offers the button when the server says this caller may remove the sheet", () => {
    expect(mayDisconnect({ can_remove: true }, { whenUnknown: false })).toBe(true);
  });

  it("hides it when the server says no — the click would only earn a 403", () => {
    expect(mayDisconnect({ can_remove: false }, { whenUnknown: true })).toBe(false);
  });

  it("never offers it on the primary tracker, whatever else is said", () => {
    expect(mayDisconnect({ primary: true, can_remove: true }, { whenUnknown: true })).toBe(false);
  });

  it("falls back to the panel's own answer while the backend has not started sending the field", () => {
    // The deploy-skew window is real here: Vercel ships in about a minute and
    // Cloud Run in four to six, and a reply with no `can_remove` came from a
    // backend with no delete gate at all — where that button worked. Absent
    // must mean "no opinion", so nothing that worked disappears and nothing
    // new can 403.
    expect(mayDisconnect({}, { whenUnknown: true })).toBe(true);
    expect(mayDisconnect({}, { whenUnknown: false })).toBe(false);
  });

  it("lets the server's answer win over the fallback in both directions", () => {
    expect(mayDisconnect({ can_remove: true }, { whenUnknown: false })).toBe(true);
    expect(mayDisconnect({ can_remove: false }, { whenUnknown: true })).toBe(false);
  });
});

/* --------------------------------------------------------------------------
   Who is offered the pull, and who is offered the rest of the Data panel.
   -------------------------------------------------------------------------- */

/** Source of a sibling file, for the screens that cannot be rendered here — this
 *  suite has no DOM, and tsconfig's `jsx: "preserve"` means a .tsx module cannot
 *  be imported. The same device `geo/edits.test.ts` uses for its editor gate. */
const sourceOf = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("mrDataActions", () => {
  const member = { is_admin: false, is_creator: false };

  it("offers a plain member the pull — the server asks only that they are signed in", () => {
    expect(mrDataActions(member).pull).toBe(true);
    expect(mrDataActions({ is_admin: false }).pull).toBe(true);
  });

  it("offers a plain member nothing that edits what the whole workspace reads", () => {
    expect(mrDataActions(member).edit).toBe(false);
  });

  it("reads a session stored before the role flags existed as a member, not as nobody", () => {
    expect(mrDataActions({})).toEqual({ pull: true, edit: false });
  });

  it("keeps connecting and re-reading with admins and creators", () => {
    expect(mrDataActions({ is_admin: true })).toEqual({ pull: true, edit: true });
    expect(mrDataActions({ is_creator: true })).toEqual({ pull: true, edit: true });
  });

  it("offers a GEO-only account neither — the scope wall refuses every /api/mr route", () => {
    expect(mrDataActions({ is_geo_only: true, is_admin: true })).toEqual({ pull: false, edit: false });
  });

  it("offers nothing when nobody is signed in", () => {
    expect(mrDataActions(null)).toEqual({ pull: false, edit: false });
    expect(mrDataActions(undefined)).toEqual({ pull: false, edit: false });
  });

  it("does not hand a member Disconnect on a sheet somebody else connected, whichever backend answers", () => {
    const { edit } = mrDataActions(member);
    // A backend that has not started answering `can_remove`: the panel's own answer.
    expect(mayDisconnect({}, { whenUnknown: edit })).toBe(false);
    // One that has: the server's answer wins outright, in both directions.
    expect(mayDisconnect({ can_remove: false }, { whenUnknown: edit })).toBe(false);
    expect(mayDisconnect({ can_remove: true }, { whenUnknown: edit })).toBe(true);
  });
});

/** What the screens draw, read off their source.
 *
 *  The defect being pinned was invisible to every other kind of test: the old
 *  gate typed fine, rendered fine, and simply drew no button for the team.
 *  `mrDataActions` above proves the rule; this proves the screens ask it. */
describe("the MR screens offer the pull to everyone, and only the pull", () => {
  const data = () => sourceOf("./Data.tsx");

  it("Data.tsx asks the shared gate and reads no role flag of its own", () => {
    expect(data()).toContain("mrDataActions(user)");
    expect(data().match(/user\??\.\s*is_(creator|admin|geo_only)/g) || []).toEqual([]);
  });

  it("draws the pull button on the pull right, not the edit right", () => {
    expect(data()).toMatch(/mayPull\s*\?\s*<PullButton/);
    expect(data()).not.toMatch(/mayEdit\s*\?\s*\(?\s*<PullButton/);
  });

  it("keeps connect, disconnect and re-reading behind the edit right", () => {
    // The connect form and the line that tells you to share the sheet first.
    expect(data().match(/mayEdit && sources\.data\?\.enabled/g)).toHaveLength(2);
    expect(data()).toContain("mayDisconnect(s, { whenUnknown: mayEdit })");
    expect(data()).toMatch(/mayEdit\s*\?\s*\(\s*<button[\s\S]*?onClick=\{scan\}/);
  });

  it("has no dataset delete control, so nothing here needs `can_delete` yet", () => {
    // `MrDataset.can_delete === false` means the DELETE would answer 403. The day
    // this panel grows a delete control it must be hidden on that — and this is
    // the reminder to do it.
    expect(
      data(),
      "a dataset delete now exists in Data.tsx: hide it when can_delete === false, then update this test",
    ).not.toContain("mrDeleteDataset");
  });

  it("the whole-workspace empty state carries the pull, not a pointer to a panel it stands in front of", () => {
    const ws = sourceOf("../MrWorkspace.tsx");
    expect(ws).toMatch(/if \(!ov\.has_data\) return <NothingPulled/);
    expect(ws).toMatch(/function NothingPulled[\s\S]*useWorkbookPull[\s\S]*<PullWorkbook/);
    expect(ws).not.toContain("Connect the tracker on the Data panel");
    expect(ws).toContain("team's workbook data");
  });

  it("the board builder's empty state carries the pull too", () => {
    const reports = sourceOf("./Reports.tsx");
    expect(reports).toMatch(/No period holds tracker figures yet"[\s\S]{0,80}action=\{<PullWorkbook/);
    expect(reports).toContain("team's workbook data");
  });
});

/* --------------------------------------------------------------------------
   What a finished pull says.
   -------------------------------------------------------------------------- */

describe("summarisePull", () => {
  const STAMP = "2026-09-21T09:58:00Z";
  const since = (iso: string) => (iso === STAMP ? "2 minutes ago" : "");

  it("says a clean pull landed, with the rows and the tabs", () => {
    const out = summarisePull(
      { status: "ok", degraded: [], tabs: [{ tab: "A", metrics: 10 }, { tab: "B", metrics: 5 }] },
      since, true,
    );
    expect(out).toMatchObject({ kind: "ok", tone: "ok", rows: 15, tabs: 2 });
    expect(out.message).toBe("Pulled 15 rows across 2 tabs. The team's workbook data is now up to date.");
  });

  it("reads singular counts as singular, and groups thousands the same on every machine", () => {
    expect(summarisePull({ tabs: [{ tab: "A", metrics: 1 }] }, since, true).message)
      .toContain("Pulled 1 row across 1 tab.");
    expect(summarisePull({ tabs: [{ tab: "A", metrics: 1234 }] }, since, true).message)
      .toContain("Pulled 1,234 rows");
  });

  it("reads a reply with no status field as a normal pull — an older backend sent none", () => {
    expect(summarisePull({ tabs: [{ tab: "A", metrics: 3 }] }, since, true).kind).toBe("ok");
  });

  it("does not report a partial pull as a success, and names what did not land", () => {
    const out = summarisePull(
      { status: "partial", degraded: ["Leads — the tab was unreadable"], tabs: [{ tab: "A", metrics: 4 }] },
      since, true,
    );
    expect(out.kind).toBe("partial");
    expect(out.tone).toBe("warn");
    expect(out.message).toContain("but not everything: Leads — the tab was unreadable");
    expect(out.message).toContain("still showing its previous data");
  });

  it("falls back to the failed tabs when the server gave no reasons of its own", () => {
    const out = summarisePull(
      { tabs: [{ tab: "A", metrics: 4 }, { tab: "B", error: "quota exceeded" }] },
      since, true,
    );
    expect(out.kind).toBe("partial");
    expect(out.message).toContain("B — quota exceeded");
  });

  it("prefers the server's reasons over its own list of failed tabs", () => {
    const out = summarisePull(
      { status: "partial", degraded: ["the server's words"], tabs: [{ tab: "B", error: "raw error" }] },
      since, true,
    );
    expect(out.message).toContain("the server's words");
    expect(out.message).not.toContain("raw error");
  });

  it("does not say 'done' about a pull that found no rows — the reader would be shown the same blank screen", () => {
    const out = summarisePull({ status: "ok", degraded: [], tabs: [] }, since, true);
    expect(out.kind).toBe("empty");
    expect(out.tone).toBe("warn");
    expect(out.message).toContain("no rows");
  });

  it("treats 'already fresh' as a calm success, and says how long ago", () => {
    // It arrives as `tabs: []` with nothing ingested — the exact shape of a pull
    // that found no rows — so it is the order of the checks that keeps it from
    // being reported as an empty workbook.
    const out = summarisePull(
      { status: "fresh", degraded: [], tabs: [], last_pulled_at: STAMP },
      since, true,
    );
    expect(out.kind).toBe("fresh");
    expect(out.tone).toBe("ok");
    expect(out.message).toBe("Already up to date — the team's workbook data was pulled 2 minutes ago.");
  });

  it("still says something true when the 'fresh' reply carries no readable time", () => {
    expect(summarisePull({ status: "fresh", tabs: [] }, since, true).message)
      .toBe("Already up to date — the team's workbook data was pulled a moment ago.");
    expect(summarisePull({ status: "fresh", tabs: [], last_pulled_at: "not a date" }, since, true).message)
      .toContain("pulled a moment ago");
  });

  it("offers the way past 'fresh' only for 'fresh'", () => {
    // The component draws "Pull again anyway" on kind === "fresh" and nowhere else.
    const others = [
      summarisePull({ status: "ok", tabs: [{ tab: "A", metrics: 2 }] }, since, true),
      summarisePull({ status: "partial", tabs: [{ tab: "A", metrics: 2 }] }, since, true),
      summarisePull({ tabs: [] }, since, true),
    ];
    expect(others.map((o) => o.kind)).not.toContain("fresh");
  });
});

describe("'Pull again anyway' is for admins and creators", () => {
  const STAMP = "2026-09-21T09:58:00Z";
  const since = (iso: string) => (iso === STAMP ? "2 minutes ago" : "");
  const fresh = { status: "fresh", degraded: [], tabs: [], last_pulled_at: STAMP };

  it("tells a member, calmly, when they can pull again — and does not offer to force it", () => {
    const out = summarisePull(fresh, since, false);
    expect(out.kind).toBe("fresh");
    expect(out.message).toBe(
      "Already up to date — the team's workbook data was pulled 2 minutes ago. "
      + "You can pull again in a couple of minutes.",
    );
  });

  it("does not tell an admin or creator to wait — the button is beside the line instead", () => {
    expect(summarisePull(fresh, since, true).message).not.toContain("pull again in a couple of minutes");
  });

  it("says the wait only about 'fresh', never about a pull that landed, part-landed or found nothing", () => {
    const rest = [
      summarisePull({ status: "ok", tabs: [{ tab: "A", metrics: 2 }] }, since, false),
      summarisePull({ status: "partial", tabs: [{ tab: "A", metrics: 2 }] }, since, false),
      summarisePull({ tabs: [] }, since, false),
    ];
    for (const out of rest) expect(out.message).not.toContain("pull again in a couple of minutes");
  });

  it("draws the button only after 'fresh' and only for a reader who may edit", () => {
    expect(offersForcedPull("fresh", true)).toBe(true);
    expect(offersForcedPull("fresh", false)).toBe(false);
    for (const kind of ["ok", "partial", "empty"] as const) {
      expect(offersForcedPull(kind, true)).toBe(false);
      expect(offersForcedPull(kind, false)).toBe(false);
    }
  });

  it("sends no `force` on a normal pull, and none at all from a member who asks for it", () => {
    expect(pullBody(false, true)).toEqual({});
    expect(pullBody(false, false)).toEqual({});
    expect(pullBody(true, false)).toEqual({});
    expect(pullBody(true, true)).toEqual({ force: true });
  });

  it("is drawn and sent through those two helpers, and through the shared gate", () => {
    const src = sourceOf("./Data.tsx");
    expect(src).toMatch(/offersForcedPull\(s\.outcome\.kind, pull\.mayForce\)\s*&&/);
    expect(src).toContain("mrIngestSheet(pullBody(opts?.force === true, mayForce))");
    expect(src).toMatch(/const \{ edit: mayForce \} = mrDataActions\(user\)/);
    // The one place `force: true` is written at a call site is the gated button.
    expect(src.match(/force: true/g)).toHaveLength(1);
  });
});

/* The hub's Data panel offers no CSV/PDF upload, no single-tab (`gid`) pull and
   no dataset delete — the server is restricting those to admins and creators,
   and there is nothing here to gate. This is the reminder for the day one is
   added: it must be drawn on `mayEdit`, and a 403 must show the server's own
   message (`describeFailure` already does, for a pull). */
describe("the hub offers no other restricted action yet", () => {
  const panel = () => sourceOf("./Data.tsx");

  it("has no upload or single-tab pull (the dataset delete is pinned above)", () => {
    expect(panel(), "an upload now exists in Data.tsx: gate it on mayEdit").not.toMatch(/mrIngest\b|mrIngestPdf|type="file"/);
    expect(panel(), "a single-tab pull now exists in Data.tsx: gate it on mayEdit").not.toMatch(/\bgid\s*:/);
  });
});

/* --------------------------------------------------------------------------
   How an Ask answer was made.
   -------------------------------------------------------------------------- */

const factOf = (id: string, extra: Partial<MrAskFact> = {}): MrAskFact => ({
  id, label: `Figure ${id}`, value: 1, unit: null,
  tab: "Vendor Summary", month: "2026-07", basis: "month to date", ...extra,
});

/** A reply from a backend that predates every new field. */
const OLD: MrAskAnswer = {
  question: "Which vendor is cheapest?",
  timeframe: "monthly",
  answer: "Vendor A spent $100 [f12].\n\nRecommend: hold.",
  used_tabs: ["Vendor Summary"],
};

describe("readNarrative and the offline marker", () => {
  it("no longer strips the (offline summary) marker — it was the only tell that the text was canned", () => {
    const out = readNarrative("[daily_summary] (offline summary) Spend was $100.\nRecommend: hold.");
    expect(out.summary).toBe("[daily_summary] (offline summary) Spend was $100.");
    expect(out.recommend).toBe("hold.");
  });

  it("still strips the heading line and the bold, and still splits off the Recommend line", () => {
    const out = readNarrative("# Title\n\n**Vendor A** spent $100.\n\nRecommend: hold.");
    expect(out).toEqual({ summary: "Vendor A spent $100.", recommend: "hold." });
  });

  it("leaves citation markers where the model put them", () => {
    expect(readNarrative("Spend was $100 [f12]. Recommend: hold [f3].")).toEqual({
      summary: "Spend was $100 [f12].", recommend: "hold [f3].",
    });
  });
});

describe("isOfflineSummary", () => {
  it("recognises the marker at the head of the text, through a heading and bold", () => {
    expect(isOfflineSummary("[daily_summary] (offline summary) Spend was $100.")).toBe(true);
    expect(isOfflineSummary("# Title\n\n**[daily_summary] (Offline Summary)** Spend.")).toBe(true);
  });

  it("does not mistake an ordinary answer, or a marker mid-text, for one", () => {
    expect(isOfflineSummary("Vendor A spent $100.")).toBe(false);
    expect(isOfflineSummary("Vendor A spent $100 [daily_summary] (offline summary)")).toBe(false);
    expect(isOfflineSummary("")).toBe(false);
  });
});

describe("askProvenance", () => {
  it("reads an answer with no `ai` field as model-written — an older backend sent the text and nothing else", () => {
    expect(askProvenance(OLD)).toEqual({ ai: true, reason: null });
    expect(askProvenance({ ...OLD, ai: true })).toEqual({ ai: true, reason: null });
  });

  it("says `ai: false` is not model-written, and carries the reason the backend gave", () => {
    expect(askProvenance({ ...OLD, ai: false, fallback_reason: "  the model returned no answer " }))
      .toEqual({ ai: false, reason: "the model returned no answer" });
  });

  it("says `ai: false` even when the backend gave no reason, and invents none", () => {
    expect(askProvenance({ ...OLD, ai: false })).toEqual({ ai: false, reason: null });
    expect(askProvenance({ ...OLD, ai: false, fallback_reason: null })).toEqual({ ai: false, reason: null });
    expect(askProvenance({ ...OLD, ai: false, fallback_reason: "   " })).toEqual({ ai: false, reason: null });
  });

  it("catches a canned text by its own marker when the backend sent no `ai` field", () => {
    expect(askProvenance({ ...OLD, answer: "[daily_summary] (offline summary) Spend was $100." }))
      .toEqual({ ai: false, reason: null });
  });

  it("lets the marker outvote an `ai: true` that contradicts it", () => {
    expect(askProvenance({ ...OLD, ai: true, answer: "[daily_summary] (offline summary) Spend." }).ai).toBe(false);
  });
});

describe("notModelWritten", () => {
  it("writes the reason as a sentence, then says what the text is", () => {
    expect(notModelWritten("the model returned no answer")).toBe(
      "The model returned no answer. What follows is the figures read straight from the tabs, not an analysis of them.",
    );
  });

  it("does not double a full stop the reason already ends with", () => {
    expect(notModelWritten("No key is set.")).toMatch(/^No key is set\. What follows/);
  });

  it("still says what the text is when there is no reason", () => {
    expect(notModelWritten(null)).toBe(
      "What follows is the figures read straight from the tabs, not an analysis of them.",
    );
  });
});

describe("askPeriodLabel", () => {
  it("shows the period the backend resolved", () => {
    expect(askPeriodLabel({ period_label: "July 2026" })).toBe("July 2026");
  });

  it("shows nothing when there is no label — and never the granularity word in `timeframe`", () => {
    expect(askPeriodLabel(OLD)).toBeNull();
    expect(askPeriodLabel({ ...OLD, period_label: null })).toBeNull();
    expect(askPeriodLabel({ ...OLD, period_label: "   " })).toBeNull();
    expect(sourceOf("./Ask.tsx")).not.toMatch(/\ba\.timeframe\b/);
  });
});

describe("askCaveat", () => {
  it("says nothing when the backend flagged nothing", () => {
    expect(askCaveat(OLD)).toBeNull();
    expect(askCaveat({ unverified_numbers: [], omitted: [] })).toBeNull();
    expect(askCaveat({ unverified_numbers: null as unknown as string[], omitted: null as unknown as [] })).toBeNull();
  });

  it("names the numbers it could not match, and says to check them", () => {
    expect(askCaveat({ unverified_numbers: ["$1,234", "45%"] })).toBe(
      "2 figures in this answer could not be matched to the workbook: $1,234, 45%. "
      + "Check them against the sheet before you rely on them.",
    );
    expect(askCaveat({ unverified_numbers: ["$9"] })).toMatch(/^One figure in this answer, \$9, could not/);
  });

  it("lists the first few and counts the rest, rather than printing forty numbers", () => {
    const many = Array.from({ length: 9 }, (_, i) => `$${i + 1}`);
    const note = askCaveat({ unverified_numbers: many })!;
    expect(note).toContain("9 figures");
    expect(note).toContain("$1, $2, $3, $4, $5, $6 and 3 more.");
    expect(note).not.toContain("$7");
  });

  it("names the rows the read left out, per tab", () => {
    expect(askCaveat({ omitted: [{ tab: "Vendor Summary", rows: 312 }] })).toBe(
      "312 rows of Vendor Summary were left out of what was read. The answer cannot speak for them.",
    );
    expect(askCaveat({ omitted: [{ tab: "Leads", rows: 1 }] })).toMatch(/^1 row of Leads was left out/);
    expect(askCaveat({ omitted: [{ tab: "A", rows: 5 }, { tab: "B", rows: 40 }] })).toContain(
      "Some rows were left out of what was read: 5 of A, 40 of B.",
    );
  });

  it("ignores an omission that omitted nothing, or that names no tab", () => {
    expect(askCaveat({ omitted: [{ tab: "Leads", rows: 0 }, { tab: "", rows: 9 }] })).toBeNull();
  });

  it("folds both into ONE note, numbers first", () => {
    const note = askCaveat({ unverified_numbers: ["$9"], omitted: [{ tab: "Leads", rows: 4 }] })!;
    expect(note.indexOf("$9")).toBeLessThan(note.indexOf("Leads"));
    expect(note.match(/rely on them/g)).toHaveLength(1);
  });
});

describe("citeTokens", () => {
  const facts = [factOf("f12"), factOf("f7"), factOf("f3"), factOf("f4")];
  const rebuild = (tokens: ReturnType<typeof citeTokens>) =>
    tokens.map((t) => ("cite" in t ? `[${t.cite.id}]` : t.text)).join("");

  it("turns a marker the answer has a fact for into a chip, leaving the words around it alone", () => {
    expect(citeTokens("Spend was $18,624 [f12], up on June [f7].", facts)).toEqual([
      { text: "Spend was $18,624 " }, { cite: facts[0] },
      { text: ", up on June " }, { cite: facts[1] }, { text: "." },
    ]);
  });

  it("hands the text back whole when there are no facts — an older backend renders as it always did", () => {
    const text = "Spend was $18,624 [f12].";
    expect(citeTokens(text, undefined)).toEqual([{ text }]);
    expect(citeTokens(text, null)).toEqual([{ text }]);
    expect(citeTokens(text, [])).toEqual([{ text }]);
  });

  it("leaves a marker with no fact behind it exactly as written — a chip pointing nowhere is a made-up source", () => {
    expect(citeTokens("Spend [f99] here.", facts)).toEqual([{ text: "Spend [f99] here." }]);
  });

  it("leaves other bracketed text, and markdown links, alone", () => {
    const text = "See [the sheet](https://example.com) and [note to self] and [f12 is wrong].";
    expect(citeTokens(text, facts)).toEqual([{ text }]);
  });

  it("chips every id in a grouped marker, but only when every id is known", () => {
    expect(citeTokens("Both [f3, f4] agree.", facts)).toEqual([
      { text: "Both " }, { cite: facts[2] }, { cite: facts[3] }, { text: " agree." },
    ]);
    expect(citeTokens("Both [f3, f99] agree.", facts)).toEqual([{ text: "Both [f3, f99] agree." }]);
  });

  it("handles a marker at either end of the text, and empty text", () => {
    expect(rebuild(citeTokens("[f12] opens and closes [f7]", facts))).toBe("[f12] opens and closes [f7]");
    expect(citeTokens("", facts)).toEqual([]);
  });

  it("ignores facts with no usable id", () => {
    const junk = [{ id: "", label: "x", tab: "t" }, null as unknown as MrAskFact];
    expect(citeTokens("Spend [f12].", junk)).toEqual([{ text: "Spend [f12]." }]);
  });
});

describe("citeTitle and citedFacts", () => {
  it("says where a figure came from: tab, month, basis", () => {
    expect(citeTitle(factOf("f1"))).toBe("Vendor Summary · July 2026 · month to date");
  });

  it("skips whatever the fact does not carry", () => {
    expect(citeTitle({ tab: "Vendor Summary", month: null, basis: undefined })).toBe("Vendor Summary");
    expect(citeTitle({ tab: "Leads", month: "Q3 2026", basis: "total" })).toBe("Leads · Q3 2026 · total");
  });

  it("lists each cited figure once, in the order it was first cited", () => {
    const a = factOf("f12");
    const b = factOf("f7");
    const tokens = [{ cite: b }, { text: " and " }, { cite: a }, { text: " and again " }, { cite: b }];
    expect(citedFacts(tokens).map((f) => f.id)).toEqual(["f7", "f12"]);
  });
});

describe("an answer from a backend that predates every new field", () => {
  it("draws exactly what it drew before: no badge, no period, no caveat, no chips", () => {
    expect(askProvenance(OLD).ai).toBe(true);
    expect(askPeriodLabel(OLD)).toBeNull();
    expect(askCaveat(OLD)).toBeNull();
    const { summary, recommend } = readNarrative(OLD.answer);
    expect(citeTokens(summary, OLD.facts)).toEqual([{ text: "Vendor A spent $100 [f12]." }]);
    expect(recommend).toBe("hold.");
  });
});

describe("the Ask panel's own words", () => {
  it("no longer claims an answer cannot disagree with the desk", () => {
    // Every connected sheet is read to answer; the desk counts the primary
    // tracker and another sheet only when it was included in the dashboard.
    expect(sourceOf("./Ask.tsx")).not.toContain("cannot disagree with the desk");
    expect(sourceOf("./Ask.tsx")).toContain("only if it was included in the dashboard");
  });
});
