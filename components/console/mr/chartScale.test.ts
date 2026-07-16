import { describe, expect, it } from "vitest";
import { barAxisMax, niceTicks } from "./chartScale";

describe("barAxisMax", () => {
  // Real July data: one vendor at $4,800 against a pack from $118-$410. Scaling
  // to the outlier squashed seven of eight bars into unreadable stubs.
  const vendors = [118, 227, 290, 350, 409, 410, 1100, 4800];

  it("scales to the decision line, not the outlier", () => {
    // The chart answers "who is over the $600 red line", so the line sits mid-axis
    // and the pack stays legible instead of collapsing against a $4.8k bar.
    expect(barAxisMax(vendors, 600)).toBe(1200);
  });

  it("keeps the smallest bar visible", () => {
    const max = barAxisMax(vendors, 600);
    expect(118 / max).toBeGreaterThan(0.05);
  });

  it("grows past the line when nothing is near it, so bars are not all tiny", () => {
    // Everyone well under the line: don't waste half the axis on empty space.
    expect(barAxisMax([90, 110, 130], 600)).toBe(130);
  });

  it("falls back to the data max when no line is supplied", () => {
    expect(barAxisMax(vendors, null)).toBe(4800);
    expect(barAxisMax(vendors, undefined)).toBe(4800);
  });

  it("survives an empty set", () => {
    expect(barAxisMax([], 600)).toBeGreaterThan(0);
  });
});

describe("niceTicks", () => {
  it("rounds to human steps instead of fractions of the max", () => {
    // $63k max used to yield 0.25/0.5/0.75 -> $16k, $31k, $47k. Nobody reads in
    // sixteenths; the ticks should land on numbers a person would say out loud.
    const t = niceTicks(63000);
    expect(t.ticks).toEqual([0, 20000, 40000, 60000]);
    expect(t.max).toBe(60000);
  });

  it("never draws a gridline above the data", () => {
    // The plot scales to the real peak; gridlines are reference marks inside it,
    // so a tick above the data would label empty space.
    for (const max of [63000, 1234, 87, 5, 999999]) {
      expect(niceTicks(max).max).toBeLessThanOrEqual(max);
    }
  });

  it("lands every tick on a round number", () => {
    for (const max of [63000, 1234, 87, 999999]) {
      const { ticks } = niceTicks(max);
      const step = ticks[1] - ticks[0];
      const mag = 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 2.5, 5, 10]).toContain(step / mag);
    }
  });

  it("spaces ticks evenly", () => {
    const { ticks } = niceTicks(63000);
    const gaps = ticks.slice(1).map((v, i) => v - ticks[i]);
    expect(new Set(gaps).size).toBe(1);
  });

  it("always starts at zero — a truncated money axis exaggerates change", () => {
    expect(niceTicks(63000).ticks[0]).toBe(0);
    expect(niceTicks(7).ticks[0]).toBe(0);
  });

  it("handles small and zero maxima without dividing by zero", () => {
    expect(niceTicks(0).ticks.length).toBeGreaterThan(1);
    expect(niceTicks(0).max).toBeGreaterThan(0);
    expect(niceTicks(3).max).toBeGreaterThanOrEqual(3);
  });
});
