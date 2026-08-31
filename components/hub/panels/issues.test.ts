import { describe, expect, it } from "vitest";
import type { Issue, IssuesPayload } from "@/lib/api";
import {
  HOME_ISSUE_LIMIT,
  countsLine,
  groupBySeverity,
  homeIssues,
  needsBrandTag,
  routeForFix,
} from "./issues";

let seq = 0;

const mk = (over: Partial<Issue> = {}): Issue => ({
  id: `i${++seq}`,
  severity: "medium",
  area: "seo",
  brand_id: "b1",
  brand: "Berry Virtual",
  code: "seo_never_measured",
  title: "Berry Virtual has never been measured for search",
  detail: "No data has been collected yet. Run the first analysis.",
  fix: { label: "Run the first analysis", workspace: "seo", subject: "b1", section: "fixes" },
  since: null,
  ...over,
});

const payload = (issues: Issue[]): IssuesPayload => ({
  issues,
  counts: {
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
  },
  generated_at: "2026-08-31T10:00:00Z",
});

describe("groupBySeverity", () => {
  it("puts high first, then medium, then low, whatever order the rows arrive in", () => {
    const groups = groupBySeverity([
      mk({ severity: "medium" }),
      mk({ severity: "low" }),
      mk({ severity: "high" }),
      mk({ severity: "medium" }),
    ]);
    expect(groups.map((g) => g.severity)).toEqual(["high", "medium", "low"]);
  });

  it("keeps the backend's order inside one group", () => {
    const a = mk({ severity: "high", id: "a" });
    const b = mk({ severity: "high", id: "b" });
    const groups = groupBySeverity([a, mk({ severity: "low" }), b]);
    expect(groups[0].issues.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("drops an empty group instead of heading over nothing", () => {
    const groups = groupBySeverity([mk({ severity: "low" }), mk({ severity: "low" })]);
    expect(groups.map((g) => g.severity)).toEqual(["low"]);
  });

  it("has no groups at all when there are no issues", () => {
    expect(groupBySeverity([])).toEqual([]);
  });
});

describe("countsLine", () => {
  it("says all clear when nothing is wrong", () => {
    expect(countsLine({ high: 0, medium: 0, low: 0 }))
      .toBe("All clear — nothing needs your attention");
  });

  it("counts the things and calls out the urgent ones", () => {
    expect(countsLine({ high: 1, medium: 1, low: 0 }))
      .toBe("2 things need fixing — 1 urgent");
  });

  it("leaves urgency out when nothing is high", () => {
    expect(countsLine({ high: 0, medium: 2, low: 1 })).toBe("3 things need fixing");
  });

  it("reads singular for one thing", () => {
    expect(countsLine({ high: 0, medium: 1, low: 0 })).toBe("1 thing needs fixing");
  });

  it("does not count the single urgent thing twice", () => {
    expect(countsLine({ high: 1, medium: 0, low: 0 })).toBe("1 thing needs fixing — urgent");
  });
});

describe("routeForFix", () => {
  it('routes a "settings" section to the Settings panel, not into a workspace', () => {
    const route = routeForFix({ label: "Connect", workspace: "geo", subject: "b1", section: "settings" });
    expect(route).toEqual({ kind: "panel", panel: "settings" });
  });

  it("routes every other section into its workspace at the subject", () => {
    const route = routeForFix({ label: "Open the fix list", workspace: "seo", subject: "b1", section: "fixes" });
    expect(route).toEqual({ kind: "work", workspace: "seo", subject: "b1", section: "fixes" });
  });
});

describe("needsBrandTag", () => {
  it("adds no tag when the title already names the brand, whatever the casing", () => {
    expect(needsBrandTag({ brand: "berry Virtual", title: "Berry Virtual has never been measured" }))
      .toBe(false);
  });

  it("adds no tag to a workspace-wide issue", () => {
    expect(needsBrandTag({ brand: "All brands", title: "The brand registry could not be read" }))
      .toBe(false);
  });

  it("names the brand when the title does not", () => {
    expect(needsBrandTag({ brand: "Berry Virtual", title: "Search Console has not granted access to this property" }))
      .toBe(true);
  });
});

describe("homeIssues", () => {
  it("takes the top rows by severity even when the payload arrives mis-ordered", () => {
    const rows = [
      mk({ severity: "low", id: "l1" }),
      mk({ severity: "high", id: "h1" }),
      mk({ severity: "medium", id: "m1" }),
      mk({ severity: "high", id: "h2" }),
    ];
    const home = homeIssues(payload(rows));
    expect(home.top.map((i) => i.id)).toEqual(["h1", "h2", "m1"]);
    expect(home.remaining).toBe(1);
    expect(home.more).toBe(true);
  });

  it("shows a short list whole, with no link owed", () => {
    const home = homeIssues(payload([mk({ severity: "high" }), mk({ severity: "medium" })]));
    expect(home.top).toHaveLength(2);
    expect(home.more).toBe(false);
    expect(home.remaining).toBe(0);
  });

  it("still owes the link when a low-severity issue made it onto Home", () => {
    const home = homeIssues(payload([mk({ severity: "low" })]));
    expect(home.top).toHaveLength(1);
    expect(home.remaining).toBe(0);
    expect(home.more).toBe(true);
  });

  it("honours the limit", () => {
    const rows = Array.from({ length: HOME_ISSUE_LIMIT + 2 }, () => mk({ severity: "medium" }));
    const home = homeIssues(payload(rows));
    expect(home.top).toHaveLength(HOME_ISSUE_LIMIT);
    expect(home.remaining).toBe(2);
  });
});
