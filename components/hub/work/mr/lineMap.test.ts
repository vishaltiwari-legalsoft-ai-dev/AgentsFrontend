import { describe, expect, it } from "vitest";
import { LINE_META, METRICS_WITHOUT_A_LINE, caughtBy, unattributed } from "./lineMap";
import type {
  MrBoardCoverageColumn, MrBoardRow, MrReportKind, MrReportPeriods,
} from "@/lib/api";
import {
  REPORT_META, REPORT_PERIOD_LIST, absentMetrics, boardPeriodOptions, boardPeriodValues,
  filledOf, periodsFor, takesPeriod,
} from "../../../console/mr/reportMeta";
import { mayDisconnect } from "../../../console/mr/format";

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
