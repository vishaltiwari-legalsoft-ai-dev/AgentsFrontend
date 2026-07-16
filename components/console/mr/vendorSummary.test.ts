import { describe, expect, it } from "vitest";
import type { MrChannelAgg, MrPortfolio } from "@/lib/api";
import { vendorSummaryRows } from "./vendorSummary";

const portfolio: MrPortfolio = {
  date: "2026-07-15",
  month: "2026-07",
  vendors: 11,
  total_budget: 40000,
  total_spend: 18624,
  budget_utilized_pct: 47,
  leads: 29,
  qualified_leads: 16,
  cost_per_qualified_lead: 1164,
  qual_demos_booked: 9,
  cost_per_qual_demo_booked: 2069,
  demos_completed: 4,
  cost_per_demo_completed: 4656,
  show_rate_pct: 44,
  services_sold: 3,
  pacing: { day: 15, days_in_month: 31, expected_pct: 48 },
  benchmarks: { cpqdb_max: 500, ql_ratio_min: 40, show_rate_min: 80, cac_target: 2500, cpql_red: 600 },
};

const trackerTotals: MrChannelAgg = {
  spend: 18624,
  leads: 29,
  qualified_leads: 16,
  demos_booked: 12, // ALL demos booked — not the qualified subset
  demos_completed: 4,
  cost_per_demo_booked: 1552, // spend / all booked
  cost_per_demo_completed: 4656,
};

const cellFor = (rows: ReturnType<typeof vendorSummaryRows>, label: string) =>
  rows.flat().find((c) => c.label === label);

describe("vendor summary — official (snapshot) source", () => {
  it("shows the eight agreed metrics in two rows of four", () => {
    const rows = vendorSummaryRows(portfolio, null);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((c) => c.label)).toEqual([
      "Spend", "Qualified Leads", "Qualified Demos Booked", "Demos Completed",
    ]);
    expect(rows[1].map((c) => c.label)).toEqual([
      "Cost per Qualified Lead", "Cost per Qualified Demo",
      "Cost per Completed Demo", "Total Services Sold (Act.)",
    ]);
  });

  it("reports the snapshot's real qualified-demo figures", () => {
    const rows = vendorSummaryRows(portfolio, null);
    expect(cellFor(rows, "Qualified Demos Booked")?.value).toBe("9");
    expect(cellFor(rows, "Cost per Qualified Demo")?.value).toBe("$2,069");
    expect(cellFor(rows, "Total Services Sold (Act.)")?.value).toBe("3");
  });
});

describe("vendor summary — judged against the desk's own benchmarks", () => {
  it("flags cost per qualified lead once it reaches the red line", () => {
    // The fixture's $1,164 is already well over the $600 red line.
    expect(cellFor(vendorSummaryRows(portfolio, null), "Cost per Qualified Lead")?.status).toBe("bad");
    const under = { ...portfolio, cost_per_qualified_lead: 380 };
    expect(cellFor(vendorSummaryRows(under, null), "Cost per Qualified Lead")?.status).toBeUndefined();
  });

  it("marks cost per qualified demo good only under the ceiling", () => {
    // $2,069 is over the $500 ceiling; $410 is under it.
    expect(cellFor(vendorSummaryRows(portfolio, null), "Cost per Qualified Demo")?.status).toBe("bad");
    const good = { ...portfolio, cost_per_qual_demo_booked: 410 };
    expect(cellFor(vendorSummaryRows(good, null), "Cost per Qualified Demo")?.status).toBe("good");
  });

  it("captions the benchmark it was judged against, taken from the endpoint", () => {
    const rows = vendorSummaryRows(portfolio, null);
    expect(cellFor(rows, "Cost per Qualified Lead")?.note).toBe("red ≥ $600");
    expect(cellFor(rows, "Cost per Qualified Demo")?.note).toBe("target < $500");
  });

  it("leaves metrics with no benchmark unjudged rather than inventing one", () => {
    const rows = vendorSummaryRows(portfolio, null);
    const cpcd = cellFor(rows, "Cost per Completed Demo");
    expect(cpcd?.status).toBeUndefined();
    expect(cpcd?.note).toBeUndefined();
  });

  it("judges nothing in the tracker fallback — those figures have no benchmarks", () => {
    const rows = vendorSummaryRows(null, trackerTotals);
    expect(rows.flat().every((c) => c.status === undefined)).toBe(true);
  });
});

describe("vendor summary — tracker fallback (no snapshot yet)", () => {
  it("blanks qualified-demo metrics rather than passing off all-demo figures as qualified", () => {
    // The tracker has no qualified-demos-booked or services-sold concept. Showing
    // demos_booked (12) under "Qualified Demos Booked" overstates the funnel, and
    // cost_per_demo_booked ($1,552) understates the true cost per qualified demo.
    const rows = vendorSummaryRows(null, trackerTotals);
    expect(cellFor(rows, "Qualified Demos Booked")?.value).toBe("—");
    expect(cellFor(rows, "Cost per Qualified Demo")?.value).toBe("—");
    expect(cellFor(rows, "Total Services Sold (Act.)")?.value).toBe("—");
  });

  it("still shows the metrics the tracker genuinely has", () => {
    const rows = vendorSummaryRows(null, trackerTotals);
    expect(cellFor(rows, "Spend")?.value).toBe("$18,624");
    expect(cellFor(rows, "Qualified Leads")?.value).toBe("16");
    expect(cellFor(rows, "Demos Completed")?.value).toBe("4");
    expect(cellFor(rows, "Cost per Completed Demo")?.value).toBe("$4,656");
  });

  it("has nothing to show without either source", () => {
    expect(vendorSummaryRows(null, null)).toEqual([]);
  });
});
