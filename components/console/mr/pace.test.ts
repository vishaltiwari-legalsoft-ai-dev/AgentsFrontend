import { describe, expect, it } from "vitest";
import { readPace } from "./pace";

// July 16 of 31 -> 52% of the month gone. Kept internally consistent: spend,
// budget and utilized% always agree, the way the endpoint reports them.
const base = {
  total_budget: 60000,
  total_spend: 30032,
  budget_utilized_pct: 50,
  pacing: { day: 16, days_in_month: 31, expected_pct: 52 },
};

describe("readPace", () => {
  it("reads the burn against the day of the month", () => {
    const p = readPace(base);
    expect(p).not.toBeNull();
    expect(p!.spentPct).toBe(50);
    expect(p!.expectedPct).toBe(52);
    expect(p!.day).toBe(16);
    expect(p!.daysInMonth).toBe(31);
  });

  it("reads under pace when the burn trails the month by more than a day's worth", () => {
    const p = readPace({ ...base, total_spend: 24000, budget_utilized_pct: 40 });
    expect(p!.state).toBe("under");
  });

  it("reads over pace when the burn leads the month", () => {
    const p = readPace({ ...base, total_spend: 42600, budget_utilized_pct: 71 });
    expect(p!.state).toBe("over");
  });

  it("treats a sub-day gap as on pace — one day is ~3 points, so 2 is noise", () => {
    expect(readPace(base)!.state).toBe("on"); // 50 vs 52
    expect(readPace({ ...base, budget_utilized_pct: 54 })!.state).toBe("on");
  });

  it("states the money, not just the percentage", () => {
    // 52% of a $60,000 budget is $31,200 expected vs $30,032 spent.
    expect(readPace(base)!.deltaMoney).toBe(1168);
  });

  it("clamps the bar to the track when spend overruns the budget", () => {
    const p = readPace({ ...base, budget_utilized_pct: 140 });
    expect(p!.spentPct).toBe(140);
    expect(p!.barPct).toBe(100);
  });

  it("has nothing to say without a budget to pace against", () => {
    expect(readPace({ ...base, total_budget: 0 })).toBeNull();
    expect(readPace({ ...base, budget_utilized_pct: null })).toBeNull();
    expect(readPace(null)).toBeNull();
  });
});
