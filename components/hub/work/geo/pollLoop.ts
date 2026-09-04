/** Bounded control loop for the GEO check — the decision layer, kept pure.
 *
 *  Moved here from `components/console/geo/` unchanged in its rules: the old
 *  console screen is no longer rendered, and the hub's "Check now" is the only
 *  live driver of `poll/step`. What arrived with the move is the vocabulary the
 *  hub needs on top of the same decisions — a `kind` on every stop, so the ways
 *  a check can end are worded and offered differently instead of sharing one
 *  sentence, and the arithmetic behind "how much longer".
 *
 *  Every step of a check is a batch of real, paid engine calls. The backend
 *  counts only *non-errored* answers as `done`, so when a provider key dies
 *  `done` freezes while `calls_used_today` keeps climbing: an unguarded
 *  `for(;;) { await geoPollStep() }` then spends the entire daily cap at full
 *  speed and only stops because the money ran out.
 *
 *  Four guards, in order of trust:
 *    1. `stop_code` — the backend's machine-readable refusal. Four of them, and
 *       every one is terminal for this loop: retrying cannot change any,
 *    2. the backend's own terminal signal (C-2: `terminal` / `terminal_reason`),
 *       which is all an older deploy sends,
 *    3. our own consecutive-stall cap, so the loop is bounded even if neither
 *       signal arrives (older backend, partial deploy),
 *    4. an absolute step cap, so nothing can loop forever.
 *
 *  Kept free of React and of `@/lib/api` on purpose: the stop rules are the
 *  part that must be provable, and they are tested here without a component,
 *  a network or a timer. The one clock it touches is injected.
 */

export type PollTone = "ok" | "warn" | "error";

/* ------------------------------------------------------------- stop codes -- */

/** The backend's four refusals, verbatim from `final_geo_agent.geo_poll`.
 *  Matched as codes and never as prose: the sentences beside them are written
 *  for a person and get rewritten, and a loop that keys on a rewritten sentence
 *  silently reclassifies a refusal as a failure. */
export const STOP_LEASE_HELD = "lease_held";
export const STOP_CHECKED_TODAY = "already_checked_today";
export const STOP_DAILY_CAP = "daily_cap";
export const STOP_ENGINE_FAILED = "engine_failed";

/** Why a check ended. The UI words each of these differently, because they ask
 *  the reader to do different things — wait a minute, come back tomorrow, fix a
 *  key, write some questions, or nothing at all. */
export type PollStopKind =
  /** Every answer for the day is in. */
  | "done"
  /** Somebody else's check holds this brand right now. Frees up in seconds. */
  | "lease"
  /** This brand's one manual check for the day is already spent. */
  | "checked_today"
  /** The daily engine-call budget is spent. Expected, not a failure. */
  | "budget"
  /** The providers stopped answering. */
  | "engines"
  /** Steps kept costing money and collecting nothing (our own guard). */
  | "stalled"
  /** Our own absolute step ceiling. */
  | "ceiling"
  /** The reader pressed Stop. */
  | "user"
  /** The backend refused over HTTP — a valid request with an honest no. */
  | "refused"
  /** The call itself broke: a 5xx, a network drop, a deadline. */
  | "failed";

/** The subset of the poll/step response the loop actually reasons about.
 *  Structural, so `GeoPollProgress` from `@/lib/api` satisfies it. Everything
 *  below `capped` is optional even where the contract declares it required — a
 *  backend that predates the field simply omits it, and Vercel puts the
 *  frontend live four to six minutes before Cloud Run has the matching backend.
 *  Every one is therefore read with a default, never assumed. */
export interface PollStepProgress {
  done: number;
  total: number;
  calls_used_today: number;
  daily_cap: number;
  capped: boolean;
  terminal?: boolean;
  terminal_reason?: string | null;
  /** One of the `STOP_*` codes above, or absent/null on a healthy step. */
  stop_code?: string | null;
  /** When the refusal clears. Seconds away for `lease_held`; the next UTC
   *  midnight for the two day-keyed refusals; null for a dead engine. */
  unlocks_at?: string | null;
  /** The account already running a check. Only alongside `lease_held`. */
  lease_held_by?: string | null;
  /** The joint monthly SERP budget for AI Overviews / AI Mode is spent, so
   *  those two sat this check out. Not a stop — the rest keep answering. */
  aio_capped?: boolean;
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
  kind: PollStopKind;
  tone: PollTone;
  message: string;
  /** Only on `kind: "lease"` — the account already running a check. */
  heldBy?: string;
  /** Whatever `unlocks_at` the refusal carried, raw, so the panel can date it
   *  against its own clock rather than re-reading a payload it was handed a
   *  verdict about. */
  unlocksAt?: string | null;
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

/** Engine calls we ask for per step. Matches the backend's own `DEFAULT_BATCH`,
 *  and is sent explicitly rather than left to default because the estimate of
 *  time remaining divides by it: a client that guesses the batch size guesses
 *  the clock too. */
export const POLL_BATCH_SIZE = 10;

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
    kind: "user",
    tone: "ok",
    message: `Check stopped — ${collectedLine(p)}, ${spendLine(p)}. Check now picks up where it left off.`,
  };
}

/** Decide what the poll loop does after one step. Pure: same inputs, same
 *  decision, no I/O, and the only clock is the one handed in. */
export function pollDecision(
  state: PollLoopState,
  p: PollStepProgress,
  opts: { stopRequested?: boolean; now?: Date; timeZone?: string } = {},
): { state: PollLoopState; decision: PollDecision } {
  const advanced = p.done > state.lastDone;
  const next: PollLoopState = {
    steps: state.steps + 1,
    stalls: advanced ? 0 : state.stalls + 1,
    lastDone: Math.max(state.lastDone, p.done),
  };
  const stop = (kind: PollStopKind, tone: PollTone, message: string, extra: Partial<PollStop> = {}) =>
    ({ state: next, decision: { action: "stop", kind, tone, message, ...extra } }) as const;
  const when = unlocksWhen(p.unlocks_at, opts.now, opts.timeZone);

  // 1. A refusal the backend named. Every one of the four is terminal for this
  //    loop — retrying cannot change any of them — and each gets its own
  //    sentence, because "wait a minute", "come back tomorrow", "raise the cap"
  //    and "fix a key" are four different things to do.
  switch (p.stop_code) {
    case STOP_LEASE_HELD: {
      const heldBy = p.lease_held_by?.trim() || "somebody else in this workspace";
      return stop(
        "lease", "warn",
        `A check is already running for this brand — ${heldBy} started it${when ? `, and it frees up ${when}` : ""}. ` +
          `Only one check runs per brand at a time, so this one did not start and nothing was spent.`,
        { heldBy, unlocksAt: p.unlocks_at ?? null },
      );
    }
    case STOP_CHECKED_TODAY:
      return stop(
        "checked_today", "warn",
        `This brand has already been checked today. One check per brand per day, so the next one unlocks ` +
          `${when || "when the day rolls over"}. Nothing was spent.`,
        { unlocksAt: p.unlocks_at ?? null },
      );
    case STOP_DAILY_CAP:
      return stop(
        "budget", "warn",
        `Daily engine-call cap reached (${p.calls_used_today}/${p.daily_cap}) — ${collectedLine(p)}. ` +
          `The check stops here and the budget resets ${when || "when the day rolls over"}.`,
        { unlocksAt: p.unlocks_at ?? null },
      );
    case STOP_ENGINE_FAILED:
      return stop("engines", "error", `Check stopped — ${terminalWhy(p)}. ${spendLine(p)}.`);
    default:
      break;
  }

  // 2. The same two endings from a backend that predates `stop_code`. Read in
  //    this order because that deploy sets BOTH on the daily-cap path, and
  //    "your budget is spent, come back tomorrow" is a different sentence from
  //    "the engines broke" even though both stop the loop.
  if (p.capped) {
    return stop(
      "budget", "warn",
      `Daily engine-call cap reached (${p.calls_used_today}/${p.daily_cap}) — ${collectedLine(p)}. ` +
        `The check stops here and picks up tomorrow.`,
    );
  }
  if (p.terminal) {
    return stop("engines", "error", `Check stopped — ${terminalWhy(p)}. ${spendLine(p)}.`);
  }

  // 3. Finished.
  if (p.done >= p.total) {
    return stop("done", "ok", `Check complete — ${collectedLine(p)}, ${spendLine(p)}. The report is updated.`);
  }

  // 4. The user asked to stop after this step.
  if (opts.stopRequested) return { state: next, decision: pollStoppedByUser(p) };

  // 5. Nothing is landing. `done` counts only non-errored answers, so a frozen
  //    `done` with a climbing spend counter is exactly the dead-key case.
  if (next.stalls >= POLL_MAX_STALLS) {
    return stop(
      "stalled", "error",
      `Check stopped — ${next.stalls} steps in a row collected no new answers, so the engines are erroring, not answering. ` +
        `${spendLine(p)}; stopped before the rest of the cap went the same way. Check the engine keys in Settings → Secrets.`,
    );
  }

  // 6. Absolute ceiling.
  if (next.steps >= POLL_MAX_STEPS) {
    return stop(
      "ceiling", "warn",
      `Check paused at the ${POLL_MAX_STEPS}-step safety limit — ${collectedLine(p)}, ${spendLine(p)}. Check now continues it.`,
    );
  }

  return { state: next, decision: { action: "continue", delayMs: pollBackoffMs(next.stalls) } };
}

const terminalWhy = (p: PollStepProgress) =>
  p.terminal_reason?.trim() || "the engines stopped answering";

/** A rejected request, classified. A refusal (a valid request the backend said
 *  no to, with something the reader can do about it) is not a failure, and the
 *  status is the only channel that separates them — the two read alike as
 *  prose, which is why this branches on the code and quotes the sentence rather
 *  than the other way round.
 *
 *  409 is the monthly SERP budget and "no questions written yet"; 503 is "no
 *  engine keys configured". All three name their own fix, so the backend's
 *  sentence is the message and the tone stays out of the red. */
export function checkFailure(status: number | null, message: string): PollStop {
  const refused = status === 409 || status === 503;
  return {
    action: "stop",
    kind: refused ? "refused" : "failed",
    tone: refused ? "warn" : "error",
    message: refused ? `This check did not run — ${lowerFirst(message)}` : message,
  };
}

const lowerFirst = (s: string) =>
  /^[A-Z][a-z]/.test(s) ? `${s[0].toLowerCase()}${s.slice(1)}` : s;

/** What the panel says about the engines that sat a check out. Null unless the
 *  monthly SERP budget actually stopped them, because "not measured" and "not
 *  measured for this reason" are different claims. */
export function aioNote(p: PollStepProgress | null): string | null {
  if (!p?.aio_capped) return null;
  return "AI Overviews and AI Mode sat this check out — their shared monthly search budget is spent until next month.";
}

/* ------------------------------------------------ what the button may do -- */

/** The half of `poll/status` that says what Check now may do right now.
 *  Structural, so `GeoPollStatus` from `@/lib/api` satisfies it without this
 *  module importing the API client. Every field optional: a backend that
 *  predates them must read as "nothing is blocking you", never as "blocked". */
export interface ManualCheckStatus {
  manual_check_used?: boolean;
  manual_check_by?: string | null;
  manual_check_unlocks_at?: string | null;
}

export interface CheckGate {
  /** Whether pressing it can do anything. */
  can: boolean;
  /** What the button says. */
  label: string;
  /** Why it cannot, in a sentence — or null when there is nothing to explain. */
  note: string | null;
}

/** The button's resting state, decided before anyone presses it.
 *
 *  One manual check per brand per day is the backend's rule and its clock; this
 *  reads the answer it publishes rather than keeping a second copy of either.
 *  A button that can only discover it is blocked by being pressed is the dead
 *  button those fields exist to prevent — and the one refusal that CANNOT be
 *  known in advance (somebody checking right now) costs nothing to discover,
 *  because that refusal reserves and bills nothing.
 */
export function checkGate(
  status: ManualCheckStatus | null | undefined,
  running: boolean,
  now: Date,
  timeZone?: string,
): CheckGate {
  if (running) return { can: false, label: "Checking…", note: null };
  if (status?.manual_check_used !== true) {
    return { can: true, label: "Run a check now", note: null };
  }
  const by = status.manual_check_by?.trim();
  const when = unlocksWhen(status.manual_check_unlocks_at, now, timeZone);
  return {
    can: false,
    label: "Checked today",
    note:
      `Today's check ${by ? `was run by ${by}` : "has already been run"} — one check per brand per day, `
      + `so the next one unlocks ${when || "when the day rolls over"}. `
      + `The scheduled sweep keeps running either way.`,
  };
}

/* -------------------------------------------------- when it frees up again -- */

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;

/** When a refusal clears, in the register its distance deserves.
 *
 *  A lease is seconds away, so "in about a minute" is what a person acts on; a
 *  day-keyed refusal is hours away, and a clock time is. Null when there is no
 *  usable date: this console does not invent one, and a refusal that cannot say
 *  when it clears says only that it is held.
 *
 *  `timeZone` defaults to the viewer's own, and exists so the wording is
 *  testable without the test's clock deciding the answer. */
export function unlocksWhen(
  iso: string | null | undefined, now: Date | undefined, timeZone?: string,
): string | null {
  if (!iso || !now) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;
  const gap = at - now.getTime();
  if (gap <= 0) return "any moment now";
  if (gap < 2 * HOUR_MS) return `in ${humanDuration(gap)}`;

  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone,
  });
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone });
  const target = new Date(at);
  const today = day.format(now);
  const tomorrow = day.format(new Date(now.getTime() + 24 * HOUR_MS));
  const which = day.format(target);
  const at_ = clock.format(target);
  if (which === today) return `later today at ${at_}`;
  if (which === tomorrow) return `tomorrow at ${at_}`;
  return `on ${which} at ${at_}`;
}

/** The typical step, in ms — median rather than mean because one 45-second
 *  timeout among twenty fast batches should not double the estimate. Null until
 *  at least one step has actually returned: this console does not draw a clock
 *  it has no measurement for. */
export function medianStepMs(samples: readonly number[]): number | null {
  const clean = samples.filter((ms) => Number.isFinite(ms) && ms > 0).slice().sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = clean.length >> 1;
  return clean.length % 2 === 1 ? clean[mid] : Math.round((clean[mid - 1] + clean[mid]) / 2);
}

/** Steps still to buy. One step is one batch of `batchSize` engine calls, and
 *  one call is one answer, so the remaining answers divide straight into it. */
export function batchesLeft(p: PollStepProgress, batchSize = POLL_BATCH_SIZE): number {
  const remaining = Math.max(0, p.total - p.done);
  const size = Math.max(1, Math.floor(batchSize));
  return Math.ceil(remaining / size);
}

/** Time left, in ms: remaining batches × the median step so far. Null while
 *  nothing has been measured — a progress surface that says "about 4 minutes"
 *  before its first step has returned is guessing, and this one does not. */
export function etaMs(
  p: PollStepProgress, samples: readonly number[], batchSize = POLL_BATCH_SIZE,
): number | null {
  const median = medianStepMs(samples);
  if (median === null) return null;
  return batchesLeft(p, batchSize) * median;
}

/** A duration a person can act on. Deliberately vague — "about 4 minutes", not
 *  "4:12" — because the estimate is a median of a handful of samples and a
 *  precise-looking number would claim more than it knows. */
export function humanDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "no time at all";
  if (ms < 45_000) return "under a minute";
  if (ms < 90_000) return "about a minute";
  if (ms < HOUR_MS) return `about ${Math.round(ms / MIN_MS)} minutes`;
  const hours = Math.floor(ms / HOUR_MS);
  const mins = Math.round((ms % HOUR_MS) / MIN_MS);
  const h = `${hours} hour${hours === 1 ? "" : "s"}`;
  return mins === 0 ? `about ${h}` : `about ${h} ${mins} min`;
}

/** One id for one press of Check now, sent on every step of that run.
 *
 *  This is what makes "a check is already running" a stable answer instead of
 *  something two people trade back and forth between batches: the backend holds
 *  the brand's lease for as long as the same token keeps stepping. A fresh one
 *  per press, never per step — the router falls back to the session id when no
 *  token arrives, and a session is shared by every tab in one browser, which is
 *  exactly the interleaving this closes.
 *
 *  Kept to the character set the backend's own cleaner accepts, so a token is
 *  never silently reduced to nothing. `randomUUID` needs a secure context; the
 *  fallback keeps a plain-HTTP dev host working rather than sending an empty
 *  string and quietly reverting to the session.
 */
export function newCheckToken(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `t${Date.now().toString(36)}-${rand()}${rand()}`;
}
