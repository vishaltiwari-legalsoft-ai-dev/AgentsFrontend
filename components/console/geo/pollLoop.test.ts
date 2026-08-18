import { describe, expect, it } from "vitest";
import {
  initialPollState,
  POLL_BASE_DELAY_MS,
  POLL_MAX_DELAY_MS,
  POLL_MAX_STALLS,
  POLL_MAX_STEPS,
  pollBackoffMs,
  pollDecision,
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
    expect(decision).toMatchObject({ action: "stop", tone: "ok" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("40 of 480 answers collected");
      expect(decision.message).toContain("Poll now");
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
    expect(decision).toMatchObject({ action: "stop", tone: "warn" });
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
