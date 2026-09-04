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
import type { GeoPollProgress } from "../../../../lib/api";
import {
  initialPollState, pollDecision, POLL_MAX_STALLS,
  STOP_CHECKED_TODAY, STOP_DAILY_CAP, STOP_LEASE_HELD,
  type PollStepProgress,
} from "./pollLoop";

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
  stop_code: null,
  unlocks_at: null,
  lease_held_by: null,
  aio_capped: false,
  aio_credits_month: 0,
};

/** RECORDED GAP, CLOSED 2026-09-04. This file used to carry the fields the
 *  backend sent and `GeoPollProgress` did not declare, so no console code could
 *  read them:
 *
 *    - `stop_code` / `unlocks_at` / `lease_held_by` — WHICH refusal this is,
 *      when it clears, and who is responsible where somebody is. Four refusals
 *      (a check running, this brand already checked today, the daily budget,
 *      dead providers) that need four sentences and four different offers.
 *      Without the codes the console showed one generic terminal string for all
 *      of them, and the only alternative was matching on prose.
 *    - `aio_capped` / `aio_credits_month` — how the backend says "AI Overviews
 *      and AI Mode have spent their shared monthly SERP budget and dropped out
 *      of this check". The panel used to just show their numbers going stale.
 *
 *  All five are now declared above and folded into `WIRE`; the loop reasons
 *  about the four that change what it does or what it says.
 *
 *  The matching ratchet on the other side is
 *  backend/tests/test_cross_agent_contracts.py::
 *  test_the_only_fields_the_console_cannot_read_are_the_known_two, whose
 *  `KNOWN_UNDECLARED_BY_THE_CONSOLE` set is an equality assertion and must now
 *  be emptied. That file also pins the path
 *  `components/console/geo/pollLoop.ts`, which this module has moved out of.
 *  Both are backend edits: they are reported, not made here.
 */

/** A payload wider than the client type: whatever the backend adds next. Extra
 *  keys must be inert, never a crash — the property those five fields spent a
 *  release proving, kept pinned now that they are declared. */
const FUTURE_WIRE = { ...WIRE, some_field_shipped_after_this_console: true };

const wire = (over: Partial<GeoPollProgress> = {}): GeoPollProgress => ({ ...WIRE, ...over });

/** Fixed so a refusal's wording is decided by the code under test rather than
 *  by the clock and the time zone the suite happens to run in. */
const at = { now: new Date("2026-09-04T10:00:00Z"), timeZone: "UTC" };

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

  it("is unbothered by fields the client type does not declare", () => {
    const { decision } = pollDecision(initialPollState(), FUTURE_WIRE);
    expect(decision.action).toBe("continue");
  });

  it("stops on the real backend terminal payload and quotes its reason", () => {
    const { decision } = pollDecision(
      initialPollState(),
      wire({
        terminal: true,
        stop_code: "engine_failed",
        terminal_reason:
          "perplexity (10x): HTTP 401: invalid api key",
        calls_used_today: 22,
      }),
    );
    expect(decision).toMatchObject({ action: "stop", kind: "engines", tone: "error" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("HTTP 401: invalid api key");
      expect(decision.message).toContain("22 of 2000 engine calls used today");
    }
  });

  it("reads the real daily-cap payload as the budget ending, not a failure", () => {
    // The backend sets `capped`, `terminal`, the code and the reset time on
    // this one path. The reader is told their budget is spent and when it comes
    // back, rather than being shown the wording a dead engine gets.
    const { decision } = pollDecision(
      initialPollState(),
      wire({
        capped: true,
        terminal: true,
        stop_code: STOP_DAILY_CAP,
        unlocks_at: "2026-09-05T00:00:00+00:00",
        terminal_reason:
          "daily engine-call cap reached — 2000 of 2000 calls used today; polling resumes tomorrow or after raising the cap",
        calls_used_today: 2000,
      }),
      at,
    );
    expect(decision).toMatchObject({ action: "stop", kind: "budget", tone: "warn" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("cap reached");
      expect(decision.message).toContain("tomorrow at 00:00");
    }
  });

  it("reads the real lease refusal as held, not as a failure", () => {
    // What the router returns, verbatim, when a second person presses Check now
    // on a brand somebody else is checking: 200, nothing reserved, nothing
    // billed, the code and the lease holder set alongside the terminal flag.
    const { decision } = pollDecision(
      initialPollState(),
      wire({
        terminal: true,
        stop_code: STOP_LEASE_HELD,
        lease_held_by: "vishal.tiwari@legalsoft.com",
        unlocks_at: "2026-09-04T10:02:00+00:00",
        terminal_reason:
          "a check is already running for this brand (vishal.tiwari@legalsoft.com)"
          + " — you cannot start another one until it finishes",
      }),
      at,
    );
    expect(decision).toMatchObject({
      action: "stop", kind: "lease", tone: "warn", heldBy: "vishal.tiwari@legalsoft.com",
    });
    if (decision.action === "stop") {
      expect(decision.message).toContain("in about 2 minutes");
      expect(decision.message).toContain("nothing was spent");
    }
  });

  it("reads the real once-a-day refusal without leaking its timestamp", () => {
    const { decision } = pollDecision(
      initialPollState(),
      wire({
        terminal: true,
        stop_code: STOP_CHECKED_TODAY,
        unlocks_at: "2026-09-05T00:00:00+00:00",
        terminal_reason:
          "this brand has already been checked today (started by dev@legalsoft.com)"
          + " — one check per brand per day; the next one unlocks at 2026-09-05T00:00:00+00:00",
      }),
      at,
    );
    expect(decision).toMatchObject({ action: "stop", kind: "checked_today", tone: "warn" });
    if (decision.action === "stop") {
      expect(decision.message).toContain("tomorrow at 00:00");
      expect(decision.message).not.toContain("2026-09-05T00:00:00");
    }
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
