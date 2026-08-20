/** The score chart must not draw a measurement that was never taken.
 *
 *  Two specific failures are pinned here: joining the line across a sweep that
 *  produced nothing (a straight run of "progress" through a hole in the data),
 *  and auto-scaling a two-point wobble into a cliff. Both look fine in a
 *  screenshot and are wrong.
 */
import { describe, expect, it } from "vitest";
import type { GeoHistoryPoint } from "../../../lib/api";
import {
  availableSeries, dayLabel, linePath, moveLabel, plot, scoreBand, scoreRange,
  segments, seriesValue,
} from "./trend";

const point = (date: string, score: number | null, over: Partial<GeoHistoryPoint> = {}): GeoHistoryPoint => ({
  date,
  at: `2026-08-${date.slice(6)}T02:00:00+00:00`,
  source: "sweep",
  score,
  components: { presence: 0.3 },
  weights: { presence: 1 },
  missing: [],
  mention_rate: 0.3,
  citation_rate: 0.1,
  sov_self: 0.2,
  n_measured: 120,
  n_answers: 130,
  n_prompts: 40,
  engines: { perplexity: 0.3 },
  competitors: { clio: 0.5 },
  ...over,
});

const BOX = { width: 100, height: 50, range: { min: 0, max: 100 } };

describe("dayLabel", () => {
  it("formats a compact date", () => {
    expect(dayLabel("20260819")).toBe("19 Aug");
  });

  it("refuses anything that is not one", () => {
    expect(dayLabel("")).toBe("");
    expect(dayLabel("2026-08-19")).toBe("");
  });
});

describe("scoreRange", () => {
  it("never lets a small move fill the whole chart", () => {
    const range = scoreRange([40, 41, 42]);

    expect(range.max - range.min).toBeGreaterThanOrEqual(20);
    expect(range.min).toBeLessThanOrEqual(40);
    expect(range.max).toBeGreaterThanOrEqual(42);
  });

  it("stays inside the scale the score lives on", () => {
    const range = scoreRange([2, 98]);

    expect(range.min).toBe(0);
    expect(range.max).toBe(100);
  });

  it("falls back to the full scale with no data", () => {
    expect(scoreRange([])).toEqual({ min: 0, max: 100 });
  });
});

describe("plot", () => {
  it("maps values onto the box with the y-axis inverted", () => {
    const pts = plot([point("20260817", 0), point("20260819", 100)], (p) => p.score, BOX);

    expect(pts.map((p) => [p.x, p.y])).toEqual([[0, 50], [100, 0]]);
  });

  it("drops unmeasured points but keeps everyone else's x slot", () => {
    const pts = plot(
      [point("20260815", 50), point("20260817", null), point("20260819", 50)],
      (p) => p.score, BOX,
    );

    expect(pts).toHaveLength(2);
    expect(pts.map((p) => p.x)).toEqual([0, 100]);
  });
});

describe("segments", () => {
  it("breaks the line where a sweep measured nothing", () => {
    const points = [point("20260815", 50), point("20260817", null), point("20260819", 50)];
    const runs = segments(points, plot(points, (p) => p.score, BOX));

    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.length)).toEqual([1, 1]);
  });

  it("keeps one run when nothing is missing", () => {
    const points = [point("20260815", 50), point("20260819", 60)];
    const runs = segments(points, plot(points, (p) => p.score, BOX));

    expect(runs).toHaveLength(1);
    expect(linePath(runs[0])).toBe("M0.0 25.0 L100.0 20.0");
  });

  it("draws nothing at all for an empty series", () => {
    expect(segments([], [])).toEqual([]);
    expect(linePath([])).toBe("");
  });
});

describe("moveLabel", () => {
  it("says there is nothing to compare to on the first measurement", () => {
    expect(moveLabel({ change: null, direction: "unknown" }, "since the last sweep"))
      .toBe("First measurement — no since the last sweep to compare against yet.");
  });

  it("reads as a direction and a size", () => {
    expect(moveLabel({ change: 7, direction: "up" }, "since the last sweep"))
      .toBe("Up 7.0 points since the last sweep.");
    expect(moveLabel({ change: -3.2, direction: "down" }, "this month"))
      .toBe("Down 3.2 points this month.");
    expect(moveLabel({ change: 0.2, direction: "flat" }, "this month"))
      .toBe("Unchanged this month.");
  });
});

describe("scoreBand", () => {
  it("does not grade a score that does not exist", () => {
    expect(scoreBand(null)).toBe("Not measured");
  });

  it("is coarse on purpose", () => {
    expect(scoreBand(72)).toBe("Strong");
    expect(scoreBand(40)).toBe("Growing");
    expect(scoreBand(20)).toBe("Early days");
    expect(scoreBand(4)).toBe("Barely visible");
  });
});

describe("availableSeries", () => {
  it("offers only what was measured, and names rivals", () => {
    const series = availableSeries([point("20260819", 40)], { clio: "Clio" });

    expect(series.map((s) => s.key))
      .toEqual(["score", "mention_rate", "citation_rate", "sov_self", "rival:clio"]);
    expect(series.at(-1)!.label).toBe("Clio");
  });

  it("does not offer a rival that was never measured", () => {
    const series = availableSeries(
      [point("20260819", 40, { competitors: { clio: null }, citation_rate: null })],
      { clio: "Clio" },
    );

    expect(series.map((s) => s.key)).toEqual(["score", "mention_rate", "sov_self"]);
  });
});

describe("seriesValue", () => {
  it("puts rates on the score's own 0-100 axis", () => {
    const p = point("20260819", 41);

    expect(seriesValue(p, "score")).toBe(41);
    expect(seriesValue(p, "mention_rate")).toBeCloseTo(30);
    expect(seriesValue(p, "rival:clio")).toBeCloseTo(50);
  });

  it("returns null for anything unmeasured rather than 0", () => {
    const p = point("20260819", null, { competitors: {}, citation_rate: null });

    expect(seriesValue(p, "score")).toBeNull();
    expect(seriesValue(p, "citation_rate")).toBeNull();
    expect(seriesValue(p, "rival:clio")).toBeNull();
  });
});
