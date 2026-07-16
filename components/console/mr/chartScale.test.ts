import { describe, expect, it } from "vitest";
import { niceTicks } from "./chartScale";

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
