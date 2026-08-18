/** C-2, the console half: the payload the backend actually sends must drive the
 *  loop that decides when to stop spending money.
 *
 *  `pollLoop.test.ts` proves the *decisions* against a hand-made
 *  `PollStepProgress`. That fixture is written by the same hand as the code it
 *  tests, so it agrees with itself by construction and would keep agreeing
 *  after the backend renamed a field. This file closes that: `WIRE` below is
 *  the literal key set `final_geo_agent.geo_poll._progress()` returns, typed as
 *  the API client's own `GeoPollProgress`.
 *
 *  Which means drift fails on whichever side moves:
 *    - backend renames or drops a field  → the Python half fails
 *      (backend/tests/test_cross_agent_contracts.py reads these same interfaces
 *      out of lib/api.ts and pollLoop.ts and compares them to a live response);
 *    - lib/api.ts renames or drops a field → `WIRE` stops typechecking here;
 *    - pollLoop.ts stops accepting what api.ts declares → the `satisfies` below
 *      fails at compile time, before any assertion runs.
 *
 *  Pure: no component, no network, no timers.
 */
import { describe, expect, it } from "vitest";
import type { GeoPollProgress } from "../../../lib/api";
import { initialPollState, pollDecision, POLL_MAX_STALLS, type PollStepProgress } from "./pollLoop";

/** What POST /api/geo/brands/{id}/poll/step returns, as far as `lib/api.ts`
 *  declares it. No `as` cast, deliberately: the bare annotation is what makes a
 *  missing required field a compile error and an invented field an
 *  excess-property error. A cast would silence both and leave this file
 *  asserting nothing — which is exactly how the gap below stayed invisible. */
const WIRE: GeoPollProgress = {
  done: 12,
  total: 480,
  calls_used_today: 12,
  daily_cap: 2000,
  capped: false,
  engines: ["perplexity", "gemini"],
  date: "20260814",
  terminal: false,
  terminal_reason: null,
};

/** RECORDED GAP — the backend sends these two on every step and
 *  `GeoPollProgress` declares neither, so no console code can read them.
 *
 *  `aio_capped` is how the backend says "Google AIO has spent its monthly
 *  SerpAPI credit and has dropped out of this poll" — a fact the GEO panel is
 *  meant to show ("honestly reported, never a surprise", geo_poll.poll_step).
 *  Today the panel simply shows AIO's numbers quietly going stale.
 *
 *  Owner: senior-frontend — add both to `GeoPollProgress`, surface `aio_capped`
 *  in GeoAgent's poll status, then fold them into WIRE and delete this block.
 *  The matching ratchet is in
 *  backend/tests/test_cross_agent_contracts.py::test_the_only_fields_the_console_cannot_read_are_the_known_two
 */
const UNDECLARED_BY_THE_CLIENT = { aio_capped: false, aio_credits_month: 0 };

/** The complete payload, undeclared fields included — what the loop is really
 *  handed at runtime. Extra keys must be inert, never a crash. */
const FULL_WIRE = { ...WIRE, ...UNDECLARED_BY_THE_CLIENT };

const wire = (over: Partial<GeoPollProgress> = {}): GeoPollProgress => ({ ...WIRE, ...over });

describe("GEO poll contract (C-2)", () => {
  it("the API type the backend response is parsed into is accepted by the loop", () => {
    // Compile-time assertion: `GeoPollProgress` structurally satisfies what
    // `pollDecision` reads. If either interface drifts, `npm run typecheck`
    // fails here rather than the browser reading `undefined` in production.
    const asLoopInput = WIRE satisfies PollStepProgress;
    expect(asLoopInput.terminal).toBe(false);
  });

  it("carries the stop signal, and the loop keeps going while it is clear", () => {
    const { decision } = pollDecision(initialPollState(), wire());
    expect(decision.action).toBe("continue");
  });

  it("is unbothered by the fields the client type does not declare", () => {
    // The runtime payload is wider than the type. That must be inert — the
    // recorded gap is "the panel cannot show AIO's credit state", not a crash.
    const { decision } = pollDecision(initialPollState(), FULL_WIRE);
    expect(decision.action).toBe("continue");
    expect(Object.keys(FULL_WIRE)).toContain("aio_capped");
  });

  it("stops on the real backend terminal payload and quotes its reason", () => {
    const { decision } = pollDecision(
      initialPollState(),
      wire({
        terminal: true,
        terminal_reason:
          "perplexity (10x): HTTP 401: invalid api key",
        calls_used_today: 22,
      }),
    );
    expect(decision).toMatchObject({ action: "stop", tone: "error" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("HTTP 401: invalid api key");
      expect(decision.message).toContain("22 of 2000 engine calls used today");
    }
  });

  it("treats the backend's cap payload as capped AND terminal", () => {
    // The backend sets both on the daily-cap path; `terminal` wins the tone,
    // so this pins which of the two the console reports.
    const { decision } = pollDecision(
      initialPollState(),
      wire({
        capped: true,
        terminal: true,
        terminal_reason: "daily engine-call cap reached — 2000 of 2000 calls used today",
        calls_used_today: 2000,
      }),
    );
    expect(decision).toMatchObject({ action: "stop" });
    if (decision.action === "stop") expect(decision.message).toContain("cap reached");
  });

  it("stays bounded against a backend that omits the contract entirely", () => {
    // A partial deploy (frontend ahead of backend) sends no `terminal` at all.
    // The loop must not treat "no stop signal" as "keep spending".
    const legacy = {
      done: 12, total: 480, calls_used_today: 12, daily_cap: 2000, capped: false,
    } as PollStepProgress;

    let state = initialPollState();
    let steps = 0;
    for (let i = 0; i < 500; i++) {
      const out = pollDecision(state, legacy);
      state = out.state;
      steps++;
      if (out.decision.action === "stop") break;
    }
    expect(steps).toBe(POLL_MAX_STALLS + 1);
  });
});
