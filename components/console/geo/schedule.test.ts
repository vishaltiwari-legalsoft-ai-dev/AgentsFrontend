/** The schedule line replaced a progress bar someone had to sit through, so
 *  its job is to be trustworthy when there is nothing good to say: no invented
 *  dates, and an off switch that reads as off. */
import { describe, expect, it } from "vitest";
import type { GeoPollStatus } from "../../../lib/api";
import { daysUntil, partialSweepLine, relativeDue, scheduleLine, shortDate } from "./schedule";

const NOW = new Date("2026-08-18T09:00:00Z");

const status = (over: Partial<GeoPollStatus> = {}): GeoPollStatus => ({
  brand_id: "legalsoft", pending: 0, done: 400, total: 400,
  auto_poll: true, interval_days: 2,
  last_completed_at: "2026-08-18T02:00:00Z",
  next_due_at: "2026-08-20T02:00:00Z",
  due_now: false, due_reason: "next due 2026-08-20",
  ...over,
});

describe("scheduleLine", () => {
  it("states the last and next sweep in plain words", () => {
    const line = scheduleLine(status(), NOW);

    expect(line.text).toBe("Last polled 18 Aug · next 20 Aug (in 2 days), every 2 days.");
    expect(line.tone).toBe("normal");
  });

  it("says a brand has never been polled instead of inventing a date", () => {
    const line = scheduleLine(status({ last_completed_at: null, next_due_at: null }), NOW);

    expect(line.text).toContain("Never polled yet");
    expect(line.tone).toBe("attention");
  });

  it("calls out a brand whose scheduled polling is switched off", () => {
    const line = scheduleLine(status({ auto_poll: false }), NOW);

    expect(line.text).toContain("Scheduled polling is off");
    expect(line.tone).toBe("attention");
  });

  it("reads naturally at a one-day interval", () => {
    expect(scheduleLine(status({ interval_days: 1 }), NOW).text).toContain("every day");
  });

  it("survives a completed sweep with no next date", () => {
    expect(scheduleLine(status({ next_due_at: null }), NOW).text).toBe("Last polled 18 Aug.");
  });
});

describe("relativeDue", () => {
  it("rounds up rather than reporting a sweep hours away as zero days", () => {
    expect(relativeDue("2026-08-18T21:00:00Z", NOW)).toBe("tomorrow");
  });

  it("reports an elapsed date as due now, never as negative days", () => {
    expect(relativeDue("2026-08-16T02:00:00Z", NOW)).toBe("due now");
    expect(daysUntil("2026-08-16T02:00:00Z", NOW)).toBeLessThan(0);
  });
});

describe("shortDate", () => {
  it("adds the year only when it differs from today's", () => {
    expect(shortDate("2026-08-20T02:00:00Z", NOW)).toBe("20 Aug");
    expect(shortDate("2027-01-04T02:00:00Z", NOW)).toBe("4 Jan 2027");
  });

  it("returns empty rather than 'Invalid Date' for junk", () => {
    expect(shortDate("not-a-date", NOW)).toBe("");
  });
});

describe("partialSweepLine", () => {
  it("shows resume progress only while a sweep is genuinely mid-flight", () => {
    expect(partialSweepLine(status({ done: 120, pending: 280 }))).toContain("120 of 400");
  });

  it("is silent for a finished sweep and for one that has not started", () => {
    expect(partialSweepLine(status())).toBeNull();
    expect(partialSweepLine(status({ done: 0, pending: 400 }))).toBeNull();
  });
});
