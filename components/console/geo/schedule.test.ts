/** The schedule line replaced a progress bar someone had to sit through, so
 *  its job is to be trustworthy when there is nothing good to say: no invented
 *  dates, and an off switch that reads as off. */
import { describe, expect, it } from "vitest";
import type { GeoBrandRow, GeoPollStatus } from "../../../lib/api";
import {
  cadenceWords, checkLine, checkOf, checkToggleWords,
  daysUntil, partialSweepLine, relativeDue, scheduleLine, shortDate,
} from "./schedule";

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

/* ----------------------------- one row's check ------------------------------ */

const row = (over: Partial<GeoBrandRow> = {}): GeoBrandRow => ({
  id: "legalsoft", name: "Legal Soft", domain: "legalsoft.com",
  prompts: 12, recent_answers: 240, calls_used_today: 0, competitors: 3,
  auto_poll: true, poll_interval_days: 7, next_due_at: "2026-08-20T02:00:00Z",
  ...over,
});

describe("checkOf", () => {
  it("reads the three fields the list carries", () => {
    expect(checkOf(row())).toEqual({
      on: true, intervalDays: 7, nextDueAt: "2026-08-20T02:00:00Z",
    });
  });

  it("reports an unsent switch as unknown, never as off", () => {
    // The four to six minutes between a frontend deploy and its backend one.
    // Round-tripped through JSON so the keys are genuinely absent, which is
    // what the older list route really answers with.
    const older: GeoBrandRow = JSON.parse(JSON.stringify({
      ...row(), auto_poll: undefined, poll_interval_days: undefined, next_due_at: undefined,
    }));

    expect("auto_poll" in older).toBe(false);
    expect(checkOf(older)).toEqual({ on: null, intervalDays: null, nextDueAt: null });
  });

  it("keeps a real false as off", () => {
    expect(checkOf(row({ auto_poll: false })).on).toBe(false);
  });

  it("survives no row at all", () => {
    expect(checkOf(null).on).toBeNull();
    expect(checkOf(undefined).nextDueAt).toBeNull();
  });
});

describe("cadenceWords", () => {
  it("reads naturally at one day and at many", () => {
    expect(cadenceWords(1)).toBe("every day");
    expect(cadenceWords(7)).toBe("every 7 days");
  });

  it("has nothing to say about a cadence it was not told", () => {
    expect(cadenceWords(null)).toBeNull();
  });
});

describe("checkLine", () => {
  it("names the cadence, the cost and the next date when the check is on", () => {
    const line = checkLine(checkOf(row()), NOW);

    expect(line.text).toBe(
      "Checked every 7 days, and paid for on that cadence. Next 20 Aug — in 2 days.",
    );
    expect(line.tone).toBe("normal");
  });

  it("says what an off brand costs instead: gaps in its history", () => {
    const line = checkLine(checkOf(row({ auto_poll: false })), NOW);

    expect(line.text).toContain("only when someone presses Check now");
    expect(line.text).toContain("gaps");
    expect(line.tone).toBe("attention");
  });

  it("does not invent a date for a brand that has never been checked", () => {
    const line = checkLine(checkOf(row({ next_due_at: null })), NOW);

    expect(line.text).toContain("Never checked yet");
    expect(line.text).not.toContain("Next ");
    expect(line.tone).toBe("normal");
  });

  it("says it does not know rather than reporting an unsent switch as off", () => {
    const line = checkLine({ on: null, intervalDays: null, nextDueAt: null }, NOW);

    expect(line.tone).toBe("unknown");
    expect(line.text).toContain("Not reported yet");
    expect(line.text).not.toContain("Off.");
  });

  it("still says the check is on when only the cadence went missing", () => {
    const line = checkLine({ on: true, intervalDays: null, nextDueAt: null }, NOW);

    expect(line.text).toContain("Checked on a schedule");
    expect(line.text).not.toContain("every null");
  });
});

describe("checkToggleWords", () => {
  it("says switching it on starts spending, on a named cadence", () => {
    const words = checkToggleWords("Legal Soft", true, 7);

    expect(words).toContain("every 7 days");
    expect(words).toContain("spends engine calls");
  });

  it("says switching it off starts leaving holes", () => {
    expect(checkToggleWords("Legal Soft", false, 7)).toContain("gaps in its history");
  });

  it("does not print a cadence it was never told", () => {
    const words = checkToggleWords("Legal Soft", true, null);

    expect(words).toContain("on its schedule");
    expect(words).not.toContain("null");
  });
});
