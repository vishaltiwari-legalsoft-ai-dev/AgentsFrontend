/** Bounded control loop for the GEO poll — the decision layer, kept pure.
 *
 *  Every step of a poll is a batch of real, paid engine calls. The backend
 *  counts only *non-errored* answers as `done`, so when a provider key dies
 *  `done` freezes while `calls_used_today` keeps climbing: an unguarded
 *  `for(;;) { await geoPollStep() }` then spends the entire daily cap at full
 *  speed and only stops because the money ran out.
 *
 *  Three guards, in order of trust:
 *    1. the backend's own terminal signal (C-2: `terminal` / `terminal_reason`),
 *    2. our own consecutive-stall cap, so the loop is bounded even if that
 *       signal never arrives (older backend, partial deploy),
 *    3. an absolute step cap, so nothing can loop forever.
 *
 *  Kept free of React and of `@/lib/api` on purpose: the stop rules are the
 *  part that must be provable, and they are tested here without a component,
 *  a network or a timer.
 */

export type PollTone = "ok" | "warn" | "error";

/** The subset of the poll/step response the loop actually reasons about.
 *  Structural, so `GeoPollProgress` from `@/lib/api` satisfies it. `terminal`
 *  and `terminal_reason` are optional here even though the contract declares
 *  them required — a backend that predates C-2 simply omits them, and this
 *  loop must stay bounded in that case rather than trust a missing field. */
export interface PollStepProgress {
  done: number;
  total: number;
  calls_used_today: number;
  daily_cap: number;
  capped: boolean;
  terminal?: boolean;
  terminal_reason?: string | null;
}

export interface PollLoopState {
  /** steps completed so far in this run */
  steps: number;
  /** consecutive steps that collected no new answers */
  stalls: number;
  /** highest `done` seen so far */
  lastDone: number;
}

export interface PollStop {
  action: "stop";
  tone: PollTone;
  message: string;
}

export type PollDecision = { action: "continue"; delayMs: number } | PollStop;

/** Courtesy gap between healthy steps — engines are rate-limited and a step is
 *  already seconds of network, so this costs ~nothing and stops us hammering. */
export const POLL_BASE_DELAY_MS = 800;
export const POLL_MAX_DELAY_MS = 15_000;
/** Stalled steps tolerated before we stop. 3 steps of pure errors is the most
 *  spend we are willing to burn to find out the engines are down. */
export const POLL_MAX_STALLS = 3;
/** Absolute ceiling — a poll this long is a bug, not a big prompt universe. */
export const POLL_MAX_STEPS = 400;

export const initialPollState = (): PollLoopState => ({ steps: 0, stalls: 0, lastDone: -1 });

const spendLine = (p: PollStepProgress) =>
  `${p.calls_used_today} of ${p.daily_cap} engine calls used today`;

const collectedLine = (p: PollStepProgress) => `${p.done} of ${p.total} answers collected`;

/** Backoff for a stalled step: 1.6s, 3.2s, 6.4s … capped. */
export function pollBackoffMs(stalls: number): number {
  if (stalls <= 0) return POLL_BASE_DELAY_MS;
  return Math.min(POLL_BASE_DELAY_MS * 2 ** stalls, POLL_MAX_DELAY_MS);
}

/** The message shown when the user hits Stop — kept here so the stop control
 *  and the loop's own post-sleep check word it identically. */
export function pollStoppedByUser(p: PollStepProgress): PollStop {
  return {
    action: "stop",
    tone: "ok",
    message: `Poll stopped — ${collectedLine(p)}, ${spendLine(p)}. Hit Poll now to pick up where it left off.`,
  };
}

/** Decide what the poll loop does after one step. Pure: same inputs, same
 *  decision, no clock and no I/O. */
export function pollDecision(
  state: PollLoopState,
  p: PollStepProgress,
  opts: { stopRequested?: boolean } = {},
): { state: PollLoopState; decision: PollDecision } {
  const advanced = p.done > state.lastDone;
  const next: PollLoopState = {
    steps: state.steps + 1,
    stalls: advanced ? 0 : state.stalls + 1,
    lastDone: Math.max(state.lastDone, p.done),
  };
  const stop = (tone: PollTone, message: string) =>
    ({ state: next, decision: { action: "stop", tone, message } }) as const;

  // 1. The backend said stop. Trust it over every local heuristic.
  if (p.terminal) {
    const why = p.terminal_reason?.trim() || "the engines stopped answering";
    return stop("error", `Poll stopped — ${why}. ${spendLine(p)}.`);
  }

  // 2. Daily cap: expected, not a failure — but the user must see the number.
  if (p.capped) {
    return stop(
      "warn",
      `Daily engine-call cap reached (${p.calls_used_today}/${p.daily_cap}) — ${collectedLine(p)}. Polling resumes tomorrow.`,
    );
  }

  // 3. Finished.
  if (p.done >= p.total) {
    return stop("ok", `Poll complete — ${collectedLine(p)}, ${spendLine(p)}. Report updated.`);
  }

  // 4. The user asked to stop after this step.
  if (opts.stopRequested) return { state: next, decision: pollStoppedByUser(p) };

  // 5. Nothing is landing. `done` counts only non-errored answers, so a frozen
  //    `done` with a climbing spend counter is exactly the dead-key case.
  if (next.stalls >= POLL_MAX_STALLS) {
    return stop(
      "error",
      `Poll stopped — ${next.stalls} steps in a row collected no new answers, so the engines are erroring, not answering. ` +
        `${spendLine(p)}; stopped before the rest of the cap went the same way. Check the engine keys in Settings → Secrets.`,
    );
  }

  // 6. Absolute ceiling.
  if (next.steps >= POLL_MAX_STEPS) {
    return stop(
      "warn",
      `Poll paused at the ${POLL_MAX_STEPS}-step safety limit — ${collectedLine(p)}, ${spendLine(p)}. Hit Poll now to continue.`,
    );
  }

  return { state: next, decision: { action: "continue", delayMs: pollBackoffMs(next.stalls) } };
}
