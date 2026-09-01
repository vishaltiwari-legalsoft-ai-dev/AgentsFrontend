import { describe, expect, it } from "vitest";
import type { CronJob, CronJobsPayload } from "@/lib/api";
import {
  classify,
  headline,
  humanSchedule,
  statement,
  tzLabel,
  type SchedulePage,
  type ScheduleCounts,
} from "./schedule";

let seq = 0;

const mk = (over: Partial<CronJob> = {}): CronJob => ({
  id: `job-${++seq}`,
  name: "GEO daily poll",
  agent_id: "a10",
  agent_label: "GEO",
  endpoint: "POST /api/geo/cron/poll",
  purpose: "Collects yesterday's engine answers.",
  why_time: "After the engines have settled overnight.",
  schedule: { cron: "0 2 * * *", timezone: "Asia/Kolkata" },
  state: "ENABLED",
  last_attempt: { time: "2026-09-01T02:00:00Z", ok: true },
  next_time: "2026-09-02T02:00:00Z",
  origin: "live_registered",
  ...over,
});

const payload = (jobs: CronJob[], over: Partial<CronJobsPayload> = {}): CronJobsPayload => ({
  generated_at: "2026-09-01T10:00:00Z",
  scheduler_ok: true,
  scheduler_error: null,
  jobs,
  ...over,
});

const page = (mode: SchedulePage["mode"], counts: ScheduleCounts): SchedulePage => ({
  mode,
  needsLook: [],
  onClock: [],
  counts,
});

const counts = (over: Partial<ScheduleCounts> = {}): ScheduleCounts => ({
  dead: 0, failed: 0, unregistered: 0, paused: 0, total: 5, ...over,
});

/* ------------------------------------------------------------- classify -- */

describe("classify, scheduler readable", () => {
  it("sends dead, then failed, then unregistered to Needs a look, in that order", () => {
    const unreg = mk({ origin: "live_only", name: null, purpose: null, why_time: null });
    const failed = mk({ last_attempt: { time: "2026-09-01T02:00:00Z", ok: false } });
    const dead = mk({ origin: "registry_only", state: null, last_attempt: null, next_time: null });
    const p = classify(payload([unreg, failed, dead, mk()]));

    expect(p.mode).toBe("live");
    expect(p.needsLook.map((r) => r.state)).toEqual(["dead", "failed", "unregistered"]);
    expect(p.needsLook.map((r) => r.job.id)).toEqual([dead.id, failed.id, unreg.id]);
    expect(p.onClock.map((r) => r.state)).toEqual(["healthy"]);
    expect(p.counts).toEqual({ dead: 1, failed: 1, unregistered: 1, paused: 0, total: 4 });
  });

  it("orders On the clock by soonest next fire, paused last", () => {
    const later = mk({ next_time: "2026-09-02T03:30:00Z" });
    const paused = mk({ state: "PAUSED", next_time: null });
    const sooner = mk({ next_time: "2026-09-01T11:00:00Z" });
    const unscheduled = mk({ next_time: null, last_attempt: null }); // never ran, no date
    const p = classify(payload([later, paused, sooner, unscheduled]));

    expect(p.needsLook).toEqual([]);
    expect(p.onClock.map((r) => r.job.id))
      .toEqual([sooner.id, later.id, unscheduled.id, paused.id]);
  });

  it("counts a paused job whose last run failed as paused, not failed", () => {
    const p = classify(payload([
      mk({ state: "PAUSED", last_attempt: { time: "2026-09-01T02:00:00Z", ok: false } }),
    ]));
    expect(p.counts.paused).toBe(1);
    expect(p.counts.failed).toBe(0);
    expect(p.onClock.map((r) => r.state)).toEqual(["paused"]);
  });

  it("keeps an unregistered job unregistered even when its last run failed", () => {
    const p = classify(payload([
      mk({ origin: "live_only", name: null, last_attempt: { time: "2026-09-01T02:00:00Z", ok: false } }),
    ]));
    expect(p.counts.unregistered).toBe(1);
    expect(p.counts.failed).toBe(0);
    expect(p.needsLook.map((r) => r.state)).toEqual(["unregistered"]);
  });

  it("calls an enabled job with no attempt yet neverRan, on the clock", () => {
    const p = classify(payload([mk({ last_attempt: null })]));
    expect(p.onClock.map((r) => r.state)).toEqual(["neverRan"]);
    expect(p.needsLook).toEqual([]);
  });
});

describe("classify, scheduler unreadable — the honest partial", () => {
  const registryRows = () => [
    mk({ origin: "registry_only", state: null, last_attempt: null, next_time: null }),
    mk({ origin: "registry_only", state: null, last_attempt: null, next_time: null }),
  ];

  it("marks every row unconfirmed — dead-cron detection is not evaluated", () => {
    const p = classify(payload(registryRows(), { scheduler_ok: false, scheduler_error: "IAM denied" }));
    expect(p.mode).toBe("registry");
    expect(p.needsLook).toEqual([]);
    expect(p.onClock.map((r) => r.state)).toEqual(["unconfirmed", "unconfirmed"]);
  });

  it("claims no missing, failed, unregistered or paused jobs it never saw", () => {
    const p = classify(payload(registryRows(), { scheduler_ok: false, scheduler_error: "IAM denied" }));
    expect(p.counts).toEqual({ dead: 0, failed: 0, unregistered: 0, paused: 0, total: 2 });
  });

  it("keeps the registry's arrival order — there is no live time to sort by", () => {
    const rows = registryRows();
    const p = classify(payload(rows, { scheduler_ok: false, scheduler_error: null }));
    expect(p.onClock.map((r) => r.job.id)).toEqual(rows.map((j) => j.id));
  });
});

/* ------------------------------------------------------------ statement -- */

describe("statement priority: dead > failed > unregistered > paused > healthy", () => {
  it("names a dead cron first, whatever else is true", () => {
    const s = statement(page("live", counts({ dead: 2, failed: 3, unregistered: 1, paused: 1 })));
    expect(s.pre).toBe("Two scheduled jobs are ");
    expect(s.strong).toBe("missing from the scheduler.");
    expect(s.post).toBe("");
  });

  it("reads singular for one dead cron", () => {
    const s = statement(page("live", counts({ dead: 1 })));
    expect(s.pre).toBe("One scheduled job is ");
    expect(s.strong).toBe("missing from the scheduler.");
  });

  it("then a failed last run, singular owning its run", () => {
    const s = statement(page("live", counts({ failed: 1, unregistered: 2, paused: 1 })));
    expect(s.pre).toBe("One of five jobs ");
    expect(s.strong).toBe("failed its last run");
    expect(s.post).toBe(".");
  });

  it("plural failures own their runs", () => {
    const s = statement(page("live", counts({ failed: 2 })));
    expect(s.pre).toBe("Two of five jobs ");
    expect(s.strong).toBe("failed their last run");
  });

  it("then unregistered", () => {
    const s = statement(page("live", counts({ unregistered: 1, paused: 3 })));
    expect(s.pre).toBe("One job is ");
    expect(s.strong).toBe("running with no record of why");
    expect(s.post).toBe(".");
  });

  it("then paused, with the ticking count leading", () => {
    const s = statement(page("live", counts({ paused: 1 })));
    expect(s.pre).toBe("Four jobs on the clock. ");
    expect(s.strong).toBe("One paused.");
    expect(s.post).toBe("");
  });

  it("says so plainly when everything is paused", () => {
    const s = statement(page("live", counts({ paused: 5 })));
    expect(s.pre).toBe("Everything is paused.");
    expect(s.strong).toBeNull();
  });

  it("healthy speaks for all the jobs", () => {
    const s = statement(page("live", counts()));
    expect(s.pre).toBe("All five jobs ran when they were supposed to.");
    expect(s.strong).toBeNull();
  });

  it("healthy with one job reads singular", () => {
    const s = statement(page("live", counts({ total: 1 })));
    expect(s.pre).toBe("The one scheduled job ran when it was supposed to.");
  });

  it("the unread scheduler outranks everything — no live claim survives it", () => {
    const s = statement(page("registry", counts({ total: 3 })));
    expect(s.pre).toBe("The scheduler could not be read.");
    expect(s.strong).toBeNull();
    expect(s.lede).toBe(
      "The registry below says what should be running. Whether it is actually running could not be confirmed just now.",
    );
  });
});

/* ------------------------------------------------------------- headline -- */

describe("headline", () => {
  it("leads with the count and the worst thing true", () => {
    expect(headline(page("live", counts({ dead: 1, failed: 2 })))).toBe("5 on the clock · 1 missing");
    expect(headline(page("live", counts({ failed: 2, paused: 1 })))).toBe("5 on the clock · 2 failed");
    expect(headline(page("live", counts({ unregistered: 1 })))).toBe("5 on the clock · 1 unregistered");
    expect(headline(page("live", counts({ paused: 3 })))).toBe("5 on the clock · 3 paused");
    expect(headline(page("live", counts()))).toBe("5 on the clock · all on time");
  });

  it("never says on time about a scheduler it could not read", () => {
    expect(headline(page("registry", counts({ total: 3 })))).toBe("3 expected · scheduler not read");
  });

  it("says nothing is on the clock when nothing is", () => {
    expect(headline(page("live", counts({ total: 0 })))).toBe("nothing on the clock");
  });
});

/* -------------------------------------------------------- humanSchedule -- */

describe("humanSchedule", () => {
  it("reads minute steps", () => {
    expect(humanSchedule("*/3 * * * *", "Asia/Kolkata")).toBe("Every 3 minutes");
    expect(humanSchedule("*/1 * * * *", "Asia/Kolkata")).toBe("Every minute");
  });

  it("reads hour steps", () => {
    expect(humanSchedule("0 */6 * * *", "Asia/Kolkata")).toBe("Every 6 hours");
    expect(humanSchedule("30 */1 * * *", "UTC")).toBe("Every hour");
  });

  it("reads a daily time in 12-hour words with the zone", () => {
    expect(humanSchedule("0 2 * * *", "Asia/Kolkata")).toBe("Daily at 2:00 AM IST");
    expect(humanSchedule("30 3 * * *", "Asia/Kolkata")).toBe("Daily at 3:30 AM IST");
    expect(humanSchedule("0 14 * * *", "UTC")).toBe("Daily at 2:00 PM UTC");
    expect(humanSchedule("0 0 * * *", "Asia/Kolkata")).toBe("Daily at 12:00 AM IST");
  });

  it("reads a single weekday, with 0 and 7 both Sunday", () => {
    expect(humanSchedule("0 9 * * 1", "Asia/Kolkata")).toBe("Every Monday at 9:00 AM IST");
    expect(humanSchedule("0 9 * * 0", "Asia/Kolkata")).toBe("Every Sunday at 9:00 AM IST");
    expect(humanSchedule("0 9 * * 7", "Asia/Kolkata")).toBe("Every Sunday at 9:00 AM IST");
  });

  it("reads a monthly day", () => {
    expect(humanSchedule("0 2 1 * *", "Asia/Kolkata")).toBe("Monthly on day 1 at 2:00 AM IST");
  });

  it("hands back a pattern it cannot say rather than paraphrasing it wrongly", () => {
    expect(humanSchedule("0 2 * * 1-5", "Asia/Kolkata")).toBe("On the schedule 0 2 * * 1-5 (IST)");
    expect(humanSchedule("not a cron", "UTC")).toBe("On the schedule not a cron (UTC)");
  });

  it("keeps an unmapped zone's IANA name instead of guessing an abbreviation", () => {
    expect(humanSchedule("0 2 * * *", "America/New_York")).toBe("Daily at 2:00 AM America/New_York");
  });
});

describe("tzLabel", () => {
  it("maps only the zones this workspace schedules in", () => {
    expect(tzLabel("Asia/Kolkata")).toBe("IST");
    expect(tzLabel("UTC")).toBe("UTC");
    expect(tzLabel("Europe/Berlin")).toBe("Europe/Berlin");
  });
});
