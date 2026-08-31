import { describe, expect, it } from "vitest";
import { LINE_META, METRICS_WITHOUT_A_LINE, caughtBy, unattributed } from "./lineMap";

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
