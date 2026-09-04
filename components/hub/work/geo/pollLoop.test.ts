import { describe, expect, it } from "vitest";
import {
  aioNote,
  batchesLeft,
  checkFailure,
  checkGate,
  etaMs,
  humanDuration,
  initialPollState,
  medianStepMs,
  newCheckToken,
  POLL_BASE_DELAY_MS,
  POLL_BATCH_SIZE,
  POLL_MAX_DELAY_MS,
  POLL_MAX_STALLS,
  POLL_MAX_STEPS,
  pollBackoffMs,
  pollDecision,
  STOP_CHECKED_TODAY,
  STOP_DAILY_CAP,
  STOP_ENGINE_FAILED,
  STOP_LEASE_HELD,
  unlocksWhen,
  type PollStepProgress,
} from "./pollLoop";

const progress = (over: Partial<PollStepProgress> = {}): PollStepProgress => ({
  done: 0,
  total: 480,
  calls_used_today: 0,
  daily_cap: 2000,
  capped: false,
  ...over,
});

/** Every wording test dates its refusal against this, and asks for UTC, so the
 *  sentence under test is decided by the code and not by the runner's clock. */
const NOW = new Date("2026-09-04T10:00:00Z");
const at = { now: NOW, timeZone: "UTC" };

describe("GEO poll loop decisions", () => {
  it("stops on the backend terminal signal and shows its reason", () => {
    const { decision } = pollDecision(initialPollState(), progress({
      done: 10, calls_used_today: 10, terminal: true,
      terminal_reason: "every call in the last 3 batches returned 401 from perplexity",
    }));
    expect(decision.action).toBe("stop");
    expect(decision).toMatchObject({ tone: "error" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("401 from perplexity");
      expect(decision.message).toContain("10 of 2000 engine calls used today");
    }
  });

  it("stops on a terminal signal with no reason without inventing one", () => {
    const { decision } = pollDecision(initialPollState(), progress({ terminal: true, terminal_reason: null }));
    expect(decision).toMatchObject({ action: "stop", tone: "error" });
    if (decision.action === "stop") expect(decision.message).toContain("the engines stopped answering");
  });

  it("treats the daily cap as a warning, not a failure", () => {
    const { decision } = pollDecision(initialPollState(), progress({ done: 300, calls_used_today: 2000, capped: true }));
    expect(decision).toMatchObject({ action: "stop", tone: "warn" });
    if (decision.action === "stop") expect(decision.message).toContain("2000/2000");
  });

  it("stops with an ok tone when every answer is in", () => {
    const { decision } = pollDecision(initialPollState(), progress({ done: 480, calls_used_today: 480 }));
    expect(decision).toMatchObject({ action: "stop", tone: "ok" });
  });

  it("keeps going at the base delay while answers keep landing", () => {
    let state = initialPollState();
    let decision;
    for (let i = 1; i <= 5; i++) {
      ({ state, decision } = pollDecision(state, progress({ done: i * 10, calls_used_today: i * 10 })));
      expect(decision).toEqual({ action: "continue", delayMs: POLL_BASE_DELAY_MS });
    }
    expect(state.stalls).toBe(0);
    expect(state.steps).toBe(5);
  });

  it("backs off while stalled, then stops before the cap is burned", () => {
    // dead provider key: `done` frozen because errors are not counted, spend climbing
    let state = initialPollState();
    const delays: number[] = [];
    let stopped: { tone: string; message: string } | null = null;

    for (let step = 1; step <= 50; step++) {
      const p = progress({ done: 10, calls_used_today: step * 10 });
      const out = pollDecision(state, p);
      state = out.state;
      if (out.decision.action === "stop") {
        stopped = { tone: out.decision.tone, message: out.decision.message };
        break;
      }
      delays.push(out.decision.delayMs);
    }

    expect(stopped).not.toBeNull();
    expect(stopped?.tone).toBe("error");
    expect(stopped?.message).toContain("no new answers");
    // step 1 sets the high-water mark, then POLL_MAX_STALLS stalled steps
    expect(state.steps).toBe(POLL_MAX_STALLS + 1);
    expect(delays).toEqual([POLL_BASE_DELAY_MS, 1600, 3200]);
  });

  it("bounds a total engine outage to a handful of calls, not the daily cap", () => {
    let state = initialPollState();
    let used = 0;
    for (let step = 1; step <= 500; step++) {
      used += 10; // one batch of paid calls per step
      const out = pollDecision(state, progress({ done: 10, calls_used_today: used }));
      state = out.state;
      if (out.decision.action === "stop") break;
    }
    expect(used).toBeLessThanOrEqual(50);
    expect(used).toBeLessThan(2000);
  });

  it("resets the stall counter as soon as one answer lands", () => {
    let state = initialPollState();
    ({ state } = pollDecision(state, progress({ done: 10 })));
    ({ state } = pollDecision(state, progress({ done: 10 })));
    expect(state.stalls).toBe(1);
    ({ state } = pollDecision(state, progress({ done: 11 })));
    expect(state.stalls).toBe(0);
  });

  it("honours a user stop request after the step it is already paying for", () => {
    const { decision } = pollDecision(initialPollState(), progress({ done: 40, calls_used_today: 40 }), {
      stopRequested: true,
    });
    expect(decision).toMatchObject({ action: "stop", tone: "ok", kind: "user" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("40 of 480 answers collected");
      expect(decision.message).toContain("Check now");
    }
  });

  it("lets the backend terminal signal win over a user stop", () => {
    const { decision } = pollDecision(initialPollState(), progress({ terminal: true, terminal_reason: "engine down" }), {
      stopRequested: true,
    });
    expect(decision).toMatchObject({ action: "stop", tone: "error" });
  });

  it("stops at the absolute step ceiling even while answers keep landing", () => {
    let state = initialPollState();
    let decision;
    for (let i = 1; i <= POLL_MAX_STEPS; i++) {
      ({ state, decision } = pollDecision(state, progress({ done: i, total: 10_000, calls_used_today: i })));
    }
    expect(decision).toMatchObject({ action: "stop", tone: "warn", kind: "ceiling" });
    expect(state.steps).toBe(POLL_MAX_STEPS);
  });

  it("never backs off past the ceiling", () => {
    for (let stalls = 0; stalls < 40; stalls++) {
      const ms = pollBackoffMs(stalls);
      expect(ms).toBeGreaterThanOrEqual(POLL_BASE_DELAY_MS);
      expect(ms).toBeLessThanOrEqual(POLL_MAX_DELAY_MS);
    }
  });
});

/* ------------------------------------------------ the refusals, told apart -- */

describe("GEO check endings, told apart", () => {
  it("gives every ending its own kind, and no two share a sentence", () => {
    const endings = [
      pollDecision(initialPollState(), progress({ done: 480 }), at).decision,
      pollDecision(initialPollState(), progress({
        stop_code: STOP_LEASE_HELD, terminal: true, lease_held_by: "dev@legalsoft.com",
        unlocks_at: "2026-09-04T10:01:00Z",
      }), at).decision,
      pollDecision(initialPollState(), progress({
        stop_code: STOP_CHECKED_TODAY, terminal: true, unlocks_at: "2026-09-05T00:00:00Z",
      }), at).decision,
      pollDecision(initialPollState(), progress({
        stop_code: STOP_DAILY_CAP, terminal: true, capped: true, calls_used_today: 2000,
        unlocks_at: "2026-09-05T00:00:00Z",
      }), at).decision,
      pollDecision(initialPollState(), progress({
        stop_code: STOP_ENGINE_FAILED, terminal: true, terminal_reason: "gemini returned 500 five times",
      }), at).decision,
      pollDecision(initialPollState(), progress({ done: 40 }), { ...at, stopRequested: true }).decision,
    ];
    const kinds = endings.map((d) => (d.action === "stop" ? d.kind : "continue"));
    const messages = endings.map((d) => (d.action === "stop" ? d.message : ""));

    expect(kinds).toEqual(["done", "lease", "checked_today", "budget", "engines", "user"]);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("refuses, without spending, when somebody else is checking right now", () => {
    const { decision } = pollDecision(initialPollState(), progress({
      stop_code: STOP_LEASE_HELD,
      terminal: true,
      terminal_reason: "a check is already running for this brand (dev@legalsoft.com)",
      lease_held_by: "dev@legalsoft.com",
      unlocks_at: "2026-09-04T10:01:00Z",
    }), at);

    expect(decision).toMatchObject({
      action: "stop", kind: "lease", tone: "warn", heldBy: "dev@legalsoft.com",
    });
    if (decision.action === "stop") {
      expect(decision.message).toContain("dev@legalsoft.com");
      // seconds away, so the register is a wait — not a date
      expect(decision.message).toContain("in about a minute");
      expect(decision.message).toContain("nothing was spent");
      // never the budget's words: the refusals must not read alike
      expect(decision.message).not.toContain("cap");
    }
  });

  it("says a check is held even when it cannot say for how long", () => {
    const { decision } = pollDecision(initialPollState(), progress({
      stop_code: STOP_LEASE_HELD, terminal: true, lease_held_by: "ops@legalsoft.com", unlocks_at: null,
    }), at);
    expect(decision).toMatchObject({ action: "stop", kind: "lease" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("ops@legalsoft.com");
      expect(decision.message).not.toContain("frees up");
    }
  });

  it("names somebody even when the refusal did not", () => {
    // `lease_held_by` missing from an older payload must not print "undefined".
    const { decision } = pollDecision(initialPollState(), progress({
      stop_code: STOP_LEASE_HELD, terminal: true,
    }), at);
    expect(decision).toMatchObject({ kind: "lease" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("somebody else in this workspace");
      expect(decision.message).not.toContain("undefined");
    }
  });

  it("dates the once-a-day refusal to the day it unlocks, not to a wait", () => {
    const { decision } = pollDecision(initialPollState(), progress({
      stop_code: STOP_CHECKED_TODAY,
      terminal: true,
      terminal_reason: "this brand has already been checked today (started by dev@legalsoft.com)"
        + " — one check per brand per day; the next one unlocks at 2026-09-05T00:00:00+00:00",
      unlocks_at: "2026-09-05T00:00:00+00:00",
    }), at);

    expect(decision).toMatchObject({ action: "stop", kind: "checked_today", tone: "warn" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("already been checked today");
      expect(decision.message).toContain("tomorrow at 00:00");
      expect(decision.message).toContain("Nothing was spent");
      // the raw timestamp in the backend's prose must never reach the reader
      expect(decision.message).not.toContain("2026-09-05T00:00:00");
    }
  });

  it("keys on the code, not the prose beside it", () => {
    // Same sentence, a different code: the classification must follow the code.
    // A loop that matched on wording would call this one a dead engine.
    const reason = "the providers stopped answering";
    const asEngines = pollDecision(initialPollState(), progress({
      stop_code: STOP_ENGINE_FAILED, terminal: true, terminal_reason: reason,
    }), at).decision;
    const asHeld = pollDecision(initialPollState(), progress({
      stop_code: STOP_LEASE_HELD, terminal: true, terminal_reason: reason,
      lease_held_by: "dev@legalsoft.com",
    }), at).decision;

    expect(asEngines).toMatchObject({ kind: "engines", tone: "error" });
    expect(asHeld).toMatchObject({ kind: "lease", tone: "warn" });
  });

  it("puts a named refusal ahead of the cap flag it also carries", () => {
    // A held brand reserved nothing, so "come back tomorrow" would be wrong
    // advice even though the payload is also carrying `capped`.
    const { decision } = pollDecision(initialPollState(), progress({
      stop_code: STOP_LEASE_HELD, capped: true, terminal: true, lease_held_by: "dev@legalsoft.com",
    }), at);
    expect(decision).toMatchObject({ kind: "lease", tone: "warn" });
  });

  it("keeps stepping against a backend that sends none of the new fields", () => {
    // Vercel is live four to six minutes before Cloud Run. Every field added
    // here is read with a default, so the old payload still drives the loop.
    const legacy: PollStepProgress = {
      done: 12, total: 480, calls_used_today: 12, daily_cap: 2000, capped: false,
    };
    expect(pollDecision(initialPollState(), legacy).decision).toEqual({
      action: "continue", delayMs: POLL_BASE_DELAY_MS,
    });
  });

  it("still ends properly on a backend that has no stop codes yet", () => {
    const capped = pollDecision(initialPollState(), progress({ capped: true, terminal: true })).decision;
    const dead = pollDecision(initialPollState(), progress({ terminal: true, terminal_reason: "401" })).decision;
    expect(capped).toMatchObject({ kind: "budget", tone: "warn" });
    expect(dead).toMatchObject({ kind: "engines", tone: "error" });
  });

  it("ignores a stop code it has never heard of rather than stopping blind", () => {
    // A code shipped after this console must not be read as a refusal we can
    // word; the fields underneath it still end the loop honestly.
    const { decision } = pollDecision(initialPollState(), progress({
      stop_code: "some_refusal_shipped_later", terminal: true, terminal_reason: "why",
    }));
    expect(decision).toMatchObject({ action: "stop", kind: "engines" });
  });
});

/* ------------------------------------------------- refusals that arrive as HTTP -- */

describe("a check that never got a payload", () => {
  it("reads a 409 and a 503 as refusals, in the backend's own words", () => {
    const monthly = checkFailure(409, "SERP monthly call budget is spent — resumes next month");
    const noPrompts = checkFailure(409, "No enabled prompts — generate the prompt universe first");
    const noKeys = checkFailure(503, "No engine keys configured — add a Perplexity/Gemini/OpenAI key in Settings → Secrets");

    for (const stop of [monthly, noPrompts, noKeys]) {
      expect(stop).toMatchObject({ action: "stop", kind: "refused", tone: "warn" });
      expect(stop.message).toContain("did not run");
    }
    expect(monthly.message).toContain("monthly call budget is spent");
    expect(noPrompts.message).toContain("enabled prompts");
    expect(noKeys.message).toContain("Settings → Secrets");
  });

  it("keeps a real failure in the red, and does not dress it as a refusal", () => {
    const broke = checkFailure(500, "Request failed");
    const offline = checkFailure(null, "Failed to fetch");
    expect(broke).toMatchObject({ kind: "failed", tone: "error", message: "Request failed" });
    expect(offline).toMatchObject({ kind: "failed", tone: "error" });
  });
});

/* ---------------------------------------------------------- time remaining -- */

describe("how much longer", () => {
  it("has no estimate until a step has actually returned", () => {
    expect(medianStepMs([])).toBeNull();
    expect(etaMs(progress({ done: 0 }), [])).toBeNull();
  });

  it("takes the median so one timeout does not double the estimate", () => {
    expect(medianStepMs([4000, 4000, 45_000, 4000, 4000])).toBe(4000);
    expect(medianStepMs([4000, 6000])).toBe(5000);
    expect(medianStepMs([0, -1, Number.NaN, 3000])).toBe(3000);
  });

  it("counts the batches still to buy, not the answers", () => {
    expect(batchesLeft(progress({ done: 0, total: 440 }))).toBe(44);
    expect(batchesLeft(progress({ done: 435, total: 440 }))).toBe(1);
    expect(batchesLeft(progress({ done: 440, total: 440 }))).toBe(0);
    // a `done` that overshot its total must not produce a negative estimate
    expect(batchesLeft(progress({ done: 460, total: 440 }))).toBe(0);
  });

  it("estimates remaining batches times the median step", () => {
    const p = progress({ done: 40, total: 440 });
    expect(batchesLeft(p)).toBe(40);
    expect(etaMs(p, [5000, 5000, 5000])).toBe(40 * 5000);
    expect(POLL_BATCH_SIZE).toBe(10);
  });

  it("stays vague, because a median of a handful of samples is vague", () => {
    expect(humanDuration(20_000)).toBe("under a minute");
    expect(humanDuration(60_000)).toBe("about a minute");
    expect(humanDuration(4 * 60_000)).toBe("about 4 minutes");
    expect(humanDuration(70 * 60_000)).toBe("about 1 hour 10 min");
    expect(humanDuration(120 * 60_000)).toBe("about 2 hours");
    expect(humanDuration(-1)).toBe("no time at all");
  });

  it("switches register with distance: a wait for seconds, a clock for hours", () => {
    const when = (iso: string) => unlocksWhen(iso, NOW, "UTC");
    expect(when("2026-09-04T10:02:00Z")).toBe("in about 2 minutes");   // a lease
    expect(when("2026-09-04T11:30:00Z")).toBe("in about 1 hour 30 min"); // still a wait
    expect(when("2026-09-04T23:00:00Z")).toBe("later today at 23:00");
    expect(when("2026-09-05T00:00:00Z")).toBe("tomorrow at 00:00");
    expect(when("2026-09-04T09:59:00Z")).toBe("any moment now");
    // A date further out names the day. The month's abbreviation is CLDR's to
    // spell (it moved from "Sep" to "Sept" in en-GB), so this pins the shape
    // and the clock rather than a string that changes with the ICU build.
    expect(when("2026-09-08T06:30:00Z")).toMatch(/^on 8 Sept? at 06:30$/);
  });

  it("never invents a time it was not given", () => {
    expect(unlocksWhen(null, NOW, "UTC")).toBeNull();
    expect(unlocksWhen("not a date", NOW, "UTC")).toBeNull();
    expect(unlocksWhen("2026-09-04T10:02:00Z", undefined, "UTC")).toBeNull();
  });
});

describe("the two engines on a monthly budget", () => {
  it("says so only when the budget is what stopped them", () => {
    expect(aioNote(null)).toBeNull();
    expect(aioNote(progress())).toBeNull();
    expect(aioNote(progress({ aio_capped: false }))).toBeNull();
    expect(aioNote(progress({ aio_capped: true }))).toContain("monthly search budget is spent");
  });
});

describe("what the button says before anyone presses it", () => {
  it("offers the check when nothing is blocking it", () => {
    expect(checkGate({ manual_check_used: false }, false, NOW, "UTC"))
      .toEqual({ can: true, label: "Run a check now", note: null });
  });

  it("explains itself instead of sitting dead once today's check is spent", () => {
    const gate = checkGate({
      manual_check_used: true,
      manual_check_by: "dev@legalsoft.com",
      manual_check_unlocks_at: "2026-09-05T00:00:00+00:00",
    }, false, NOW, "UTC");

    expect(gate.can).toBe(false);
    expect(gate.label).toBe("Checked today");
    expect(gate.note).toContain("dev@legalsoft.com");
    expect(gate.note).toContain("tomorrow at 00:00");
    // the scheduled sweep is unaffected, and a reader must not think otherwise
    expect(gate.note).toContain("scheduled sweep");
  });

  it("still says the day is spent when it cannot say who spent it", () => {
    const gate = checkGate({ manual_check_used: true }, false, NOW, "UTC");
    expect(gate.can).toBe(false);
    expect(gate.note).toContain("has already been run");
    expect(gate.note).toContain("when the day rolls over");
    expect(gate.note).not.toContain("undefined");
  });

  it("never blocks the button over a status it has not got", () => {
    // No status yet, or a backend deployed four minutes behind the frontend:
    // absent must read as "nothing is blocking you", not as "blocked".
    for (const status of [null, undefined, {}]) {
      expect(checkGate(status, false, NOW, "UTC").can).toBe(true);
    }
  });

  it("stands down while this browser is the one checking", () => {
    const gate = checkGate({ manual_check_used: false }, true, NOW, "UTC");
    expect(gate).toEqual({ can: false, label: "Checking…", note: null });
  });
});

describe("the loop token", () => {
  it("survives the backend's own cleaner, so the lease is held for the run", () => {
    // `loop_run_id` strips everything outside this set and truncates at 64. A
    // token reduced to nothing falls back to the session id, which every tab in
    // one browser shares — the interleaving the per-click token exists to close.
    const token = newCheckToken();
    expect(token).toMatch(/^[A-Za-z0-9_.:-]+$/);
    expect(token.length).toBeGreaterThan(8);
    expect(token.length).toBeLessThanOrEqual(64);
  });

  it("is different for every press, so two runs never share one lease", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newCheckToken()));
    expect(tokens.size).toBe(50);
  });
});
