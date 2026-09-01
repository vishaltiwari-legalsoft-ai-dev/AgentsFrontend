import { describe, expect, it } from "vitest";
import { until } from "./format";

/* `until` mirrors `ago`, and like it takes an explicit `now` so a test never
 * depends on the machine's clock. */

const NOW = new Date("2026-09-01T10:00:00Z");
const plus = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("until", () => {
  it("counts minutes", () => {
    expect(until(plus(3 * 60_000), NOW)).toBe("in 3 minutes");
    expect(until(plus(60_000), NOW)).toBe("in 1 minute");
  });

  it("counts hours", () => {
    expect(until(plus(6 * 3_600_000), NOW)).toBe("in 6 hours");
    expect(until(plus(3_600_000), NOW)).toBe("in 1 hour");
  });

  it("counts days", () => {
    expect(until(plus(2 * 86_400_000), NOW)).toBe("in 2 days");
    expect(until(plus(86_400_000), NOW)).toBe("in 1 day");
  });

  it("says a past or present time is due, not broken", () => {
    expect(until(plus(0), NOW)).toBe("any moment now");
    expect(until(plus(-3_600_000), NOW)).toBe("any moment now");
    expect(until(plus(30_000), NOW)).toBe("any moment now");
  });

  it("names the date once it is too far away to count", () => {
    expect(until(plus(45 * 86_400_000), NOW)).toBe("on October 16");
  });

  it("says nothing about a timestamp it cannot parse", () => {
    expect(until("not a date", NOW)).toBe("");
  });
});
