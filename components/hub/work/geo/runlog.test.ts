import { describe, expect, it } from "vitest";
import {
  deltaLabel,
  deltaTone,
  durationLabel,
  errorCount,
  mergeRunLedger,
  outcomeLabel,
  planLabel,
  timeLabel,
  triggerLabel,
  weekLabel,
  weeklyHeadline,
} from "./runlog";

const pt = (date: string) => ({ date });
const run = (day: string, score: number | null = 50) => ({ day, score });

describe("mergeRunLedger", () => {
  it("pairs a point with the run that measured it, by day", () => {
    const rows = mergeRunLedger([pt("20260828"), pt("20260829")], [run("20260829"), run("20260828")]);
    expect(rows).toHaveLength(2);
    expect(rows[0].day).toBe("20260829");
    expect(rows[0].point?.date).toBe("20260829");
    expect(rows[0].run?.day).toBe("20260829");
    expect(rows[1].point?.date).toBe("20260828");
  });

  it("keeps a run that produced no point — a failed sweep is a row, not a hole", () => {
    const rows = mergeRunLedger([pt("20260829")], [run("20260830", null), run("20260829")]);
    expect(rows).toHaveLength(2);
    expect(rows[0].day).toBe("20260830");
    expect(rows[0].point).toBeNull();
    expect(rows[0].run?.day).toBe("20260830");
  });

  it("keeps a point that predates the run log", () => {
    const rows = mergeRunLedger([pt("20260801"), pt("20260829")], [run("20260829")]);
    expect(rows).toHaveLength(2);
    expect(rows[1].day).toBe("20260801");
    expect(rows[1].run).toBeNull();
    expect(rows[1].point?.date).toBe("20260801");
  });

  it("orders newest first even when the inputs are not sorted", () => {
    const rows = mergeRunLedger(
      [pt("20260810"), pt("20260830")],
      [run("20260820"), run("20260830")],
    );
    expect(rows.map((r) => r.day)).toEqual(["20260830", "20260820", "20260810"]);
  });

  it("gives the day's point to the newest run that scored, and keeps the other run as its own row", () => {
    const scored = { day: "20260829", score: 61, id: "b" };
    const dead = { day: "20260829", score: null, id: "a" };
    // newest first: the dead manual retry came after the scored sweep
    const rows = mergeRunLedger([pt("20260829")], [dead, scored]);
    expect(rows).toHaveLength(2);
    expect(rows[0].run).toBe(dead);
    expect(rows[0].point).toBeNull();
    expect(rows[1].run).toBe(scored);
    expect(rows[1].point?.date).toBe("20260829");
  });

  it("is empty when there is nothing to show", () => {
    expect(mergeRunLedger([], [])).toEqual([]);
  });
});

describe("durationLabel", () => {
  it("reads minutes and seconds", () => {
    expect(durationLabel(580)).toBe("9m 40s");
  });
  it("drops a zero-second remainder", () => {
    expect(durationLabel(120)).toBe("2m");
  });
  it("stays in seconds under a minute", () => {
    expect(durationLabel(41.6)).toBe("42s");
  });
  it("rolls into hours", () => {
    expect(durationLabel(3840)).toBe("1h 4m");
  });
  it("is a dash when nothing was timed — never 0s", () => {
    expect(durationLabel(null)).toBe("—");
    expect(durationLabel(undefined)).toBe("—");
    expect(durationLabel(-5)).toBe("—");
  });
  it("says 0s only for a real measured zero", () => {
    expect(durationLabel(0)).toBe("0s");
  });
});

describe("timeLabel", () => {
  it("writes a date with its clock time", () => {
    // Local-time formatting: assert shape, not a timezone-dependent instant.
    expect(timeLabel("2026-08-29T02:14:00")).toBe("29 Aug, 2:14 am");
    expect(timeLabel("2026-08-29T14:05:00")).toBe("29 Aug, 2:05 pm");
  });
  it("writes midnight and noon as 12, not 0", () => {
    expect(timeLabel("2026-08-29T00:30:00")).toBe("29 Aug, 12:30 am");
    expect(timeLabel("2026-08-29T12:00:00")).toBe("29 Aug, 12:00 pm");
  });
  it("is a dash for garbage or absence", () => {
    expect(timeLabel("not a date")).toBe("—");
    expect(timeLabel(null)).toBe("—");
    expect(timeLabel("")).toBe("—");
  });
});

describe("weekLabel", () => {
  it("reads both spellings the backend has used", () => {
    expect(weekLabel("2026-08-24")).toBe("24 Aug");
    expect(weekLabel("20260824")).toBe("24 Aug");
  });
  it("is empty for garbage rather than Invalid Date", () => {
    expect(weekLabel("2026-W35")).toBe("");
    expect(weekLabel("")).toBe("");
    expect(weekLabel(null)).toBe("");
    expect(weekLabel("20261401")).toBe("");
  });
});

describe("deltaLabel / deltaTone", () => {
  it("signs both directions with a true minus", () => {
    expect(deltaLabel(6)).toBe("+6");
    expect(deltaLabel(-3)).toBe("−3");
    expect(deltaTone(6)).toBe("is-up");
    expect(deltaTone(-3)).toBe("is-down");
  });
  it("distinguishes no-change from not-comparable", () => {
    expect(deltaLabel(0)).toBe("±0");
    expect(deltaLabel(null)).toBe("—");
    expect(deltaTone(0)).toBe("");
    expect(deltaTone(null)).toBe("");
  });
  it("rounds a fractional delta", () => {
    expect(deltaLabel(2.6)).toBe("+3");
    expect(deltaLabel(-0.4)).toBe("±0");
  });
});

describe("triggerLabel", () => {
  it("writes cron in plain words and passes unknown values through", () => {
    expect(triggerLabel("cron")).toBe("scheduled");
    expect(triggerLabel("manual")).toBe("manual");
    expect(triggerLabel("retry")).toBe("retry");
    expect(triggerLabel("")).toBe("—");
  });
});

describe("outcomeLabel", () => {
  it("says finished for a completed run", () => {
    expect(outcomeLabel({ completed: true, stopped_because: "completed", terminal_reason: null })).toBe("finished");
  });
  it("reads the stop reason with its underscores out", () => {
    expect(outcomeLabel({ completed: false, stopped_because: "budget_exhausted", terminal_reason: null }))
      .toBe("budget exhausted");
  });
  it("falls back to the terminal reason, then to plain words", () => {
    expect(outcomeLabel({ completed: false, stopped_because: "completed", terminal_reason: "timeout" })).toBe("timeout");
    expect(outcomeLabel({ completed: false, stopped_because: "", terminal_reason: null })).toBe("stopped early");
  });
});

describe("planLabel", () => {
  it("shows plan standing, no-plan, and not-recorded as three different things", () => {
    expect(planLabel({ done: 3, total: 12 })).toBe("plan 3/12 done");
    expect(planLabel(null)).toBe("no plan yet");
    expect(planLabel(undefined)).toBe("—");
  });
});

describe("errorCount", () => {
  it("sums across engines and treats a missing map as zero recorded errors", () => {
    expect(errorCount({ chatgpt: 2, aio: 1 })).toBe(3);
    expect(errorCount({})).toBe(0);
    expect(errorCount(undefined)).toBe(0);
  });
});

describe("weeklyHeadline", () => {
  it("leads with the move since the last check", () => {
    expect(weeklyHeadline({ change: 4, direction: "up" }, 61))
      .toBe("Up 4 points since the last check; this week's average is 61.");
    expect(weeklyHeadline({ change: -3, direction: "down" }, 58))
      .toBe("Down 3 points since the last check; this week's average is 58.");
    expect(weeklyHeadline({ change: 0, direction: "flat" }, 58))
      .toBe("No change since the last check; this week's average is 58.");
  });
  it("uses the singular for a one-point move", () => {
    expect(weeklyHeadline({ change: -1, direction: "down" }, 58))
      .toBe("Down 1 point since the last check; this week's average is 58.");
  });
  it("stands alone when there is no move to lead with", () => {
    expect(weeklyHeadline({ change: null, direction: "unknown" }, 61)).toBe("This week's average is 61.");
    expect(weeklyHeadline(undefined, 61)).toBe("This week's average is 61.");
  });
  it("says when this week has no measurable score, never 0", () => {
    expect(weeklyHeadline({ change: 4, direction: "up" }, null))
      .toBe("Up 4 points since the last check; this week has no measurable score yet.");
  });
});
