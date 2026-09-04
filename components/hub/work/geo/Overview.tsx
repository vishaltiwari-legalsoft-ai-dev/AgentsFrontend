"use client";

/** Three blocks: what happened, which questions, what to do.
 *
 *  The first ledger row opens on arrival so real engine prose is on screen
 *  without a separate quotes block — the whole claim of this workspace is that
 *  you can read what the engines actually wrote, and a front page that shows
 *  only percentages does not make that claim.
 *
 *  This is also where "Check now" lives, and a check is not one request. A full
 *  sweep is ~440 paid engine calls; `poll/step` is a resumable slice of it,
 *  bounded server-side so the request returns. Firing one and saying "a check
 *  has started" bought about a fortieth of a check and then stopped, which is
 *  what `useGeoCheck` below exists to stop doing: it drives the whole thing,
 *  shows what it has collected as each step lands, and says — in different
 *  words for each — every way it can end.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiStatus, geoAnswers, geoPollStep, type GeoAnswer, type GeoPollProgress } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { engineCoverage } from "@/components/console/geo/provenance";
import { scheduleLine } from "@/components/console/geo/schedule";
import type { GeoPollStatus } from "@/lib/api";
import { Ic } from "../../Sprite";
import { PageHead, RuleHead, Wait, Oops } from "../../ui";
import { n, word } from "../../model";
import type { ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import {
  AnswerCard, ENGINE_IDS, EnginePills, Figure, Figures, Gauge, QuestionLedger,
  engineName, isLive, modeWords, rate, type LedgerRow,
} from "./parts";
import {
  aioNote, batchesLeft, checkFailure, checkGate, etaMs, humanDuration, initialPollState,
  newCheckToken, pollDecision, pollStoppedByUser, POLL_BATCH_SIZE,
  type PollLoopState, type PollStop, type PollStopKind,
} from "./pollLoop";

export function GeoOverview({
  data, poll, onGo, onToast,
}: {
  data: GeoData;
  poll: GeoPollStatus | null;
  onGo: (section: string) => void;
  onToast: ToastFn;
}) {
  const { report, status, comparison, specs, brandName, days } = data;
  const blended = report.blended;
  const rollup = report.prompt_rollup || [];

  const measured = blended.n_measured ?? blended.n_answers;
  const namedRate = blended.mention.rate;
  const named = namedRate === null ? null : Math.round(namedRate * measured);
  const gaps = rollup.filter((r) => r.self_rate === 0).length;

  const rows: LedgerRow[] = rollup.map((r) => ({
    id: r.prompt_id,
    text: r.text,
    enginesHit: r.engines_hit,
    enginesAsked: [],
    n: r.n,
    selfRate: r.self_rate,
  }));

  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);
  const check = useGeoCheck(data, onToast);

  const line = scheduleLine(poll, new Date());
  // What Check now may do BEFORE anyone presses it. A button that can only
  // discover it is blocked by being pressed is the dead-button experience the
  // backend added `manual_check_used` to avoid.
  const gate = checkGate(poll, check.run?.live === true, new Date());

  const topGap = report.source_gap[0];

  return (
    <>
      <PageHead
        statement={
          named === null
            ? <>Nothing has been measured in the last {days} days.</>
            : <>
                Engines named you in <b>{n(named)} of {n(measured)}</b> answers.
                {gaps > 0 ? <> On <u>{word(gaps)} question{gaps === 1 ? "" : "s"}</u> they never said your name.</> : <> Every question got your name at least once.</>}
              </>
        }
        lede={
          <>
            Your {n(rollup.length)} buyer question{rollup.length === 1 ? "" : "s"} go to five AI
            engines and we store what each one wrote back. This is everything stored in the last{" "}
            {days} days for {brandName}. {line.text}
          </>
        }
      />

      {check.run && (
        <CheckPanel
          run={check.run} brandName={brandName}
          onStop={check.stop} onDismiss={check.dismiss}
        />
      )}

      <section className="band">
        <RuleHead
          title="The five engines"
          note="An engine on its own API is the product your buyers use. One on a similar model is an OpenRouter model answering in its place, so its wording is representative rather than verbatim."
          aside={
            <button
              type="button" className="btn btn--quiet btn--sm"
              onClick={() => void check.start()} disabled={!gate.can}
            >
              <Ic name="sweep" />
              {gate.label}
            </button>
          }
        />
        {gate.note && <p className="help" style={{ marginBottom: "var(--s4)" }}>{gate.note}</p>}
        <EnginePills status={status} />

        <div className="strip4 strip4--five" style={{ marginTop: "var(--s4)" }}>
          {ENGINE_IDS.map((id) => {
            const block = report.engines[id];
            const st = status[id];
            const live = isLive(st);
            const stored = block ? block.n_measured ?? block.n_answers : 0;
            const gone = !st?.connected && stored > 0;
            // Why this engine's count is not the count beside it.
            //
            // `n_answers`, not `stored`: `n_expected` counts everything the
            // engine was asked, failed calls included, so the numerator that
            // matches it is every row the ask produced. `stored` is the rate's
            // denominator and answers a different question.
            //
            // Silent until BOTH `n_expected` and `n_sweeps` are on the wire —
            // one is per check and the other is what scales it, and dividing a
            // per-window count by a per-check expectation renders "350 of 70".
            const cover = engineCoverage({
              got: block?.n_answers ?? 0,
              expected: block?.n_expected,
              sweeps: report.n_sweeps,
              errors: block?.n_errors,
              emptySlots: block?.n_no_aio,
              spec: specs[id],
              creditSpent: report.search_credit_spent,
              creditUsed: report.search_credit_used,
              creditLimit: report.search_credit_limit,
              pausedSince: report.serp_capped_since ?? null,
              lastSeen: report.engine_last_seen?.[id] ?? null,
              // the window the backend actually measured, already clamped —
              // never the one the query string asked for
              days: report.days,
            });
            // A window with no check in it is a fact about the panel, not about
            // five engines: it is said once under the strip. A card repeats it
            // only when it HAS answers no logged check accounts for.
            const showCover = Boolean(st?.connected)
              && cover.state !== "unknown"
              && !(cover.state === "no_checks" && (block?.n_answers ?? 0) === 0);
            return (
              <div key={id}>
                <h3>{engineName(id)}</h3>
                <span className={`mode ${live ? "live" : "proxy"}`}>{modeWords(st)}</span>
                <b className="big">{stored > 0 ? rate(block!.mention.rate) : "—"}</b>
                <p>
                  {stored > 0
                    ? gone
                      // Not a live figure. Saying "of N answers" beside "no key
                      // configured" reads as a measurement still being taken.
                      ? `of ${n(stored)} answers stored before the key was removed`
                      : `of ${n(stored)} answers named you`
                    : st?.connected
                      ? "connected, nothing stored in this window"
                      : "not measured — no key configured"}
                </p>
                {showCover && (
                  <p className={`cover${cover.state === "paused" ? " is-paused" : ""}`}>
                    {cover.count}{cover.why ? ` · ${cover.why}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="help" style={{ marginTop: 14 }}>
          {report.n_sweeps === 0 && (
            <>No check has run in the last {n(report.days)} days, so nothing above has moved. </>
          )}
          The counts differ on purpose, and each card says how many answers that engine was asked
          for over this window and why. The chat engines are read more than once per question,
          because what they write changes between readings; Google&rsquo;s two are billed per call,
          so they are read once and only on the questions that do not already name you.
        </p>
      </section>

      <section className="band">
        <RuleHead
          title="Which questions did they name you on?"
          note="Open any row to read every answer, exactly as the engine wrote it."
        />
        {rows.length === 0 ? (
          <div className="empty">
            <h4>No questions have been asked yet</h4>
            <p>Write your buyer questions, then run a check — the answers land here.</p>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => onGo("questions")}>
              Write the questions
            </button>
          </div>
        ) : (
          <>
            <QuestionLedger
              rows={rows}
              openId={openId}
              onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
            >
              {(row) => <PromptAnswers data={data} promptId={row.id} />}
            </QuestionLedger>
            <p className="help" style={{ marginTop: 14 }}>
              A filled square means that engine said your name on that question. A blank one means it
              was never asked — which is not the same as never naming you, and is why the two are
              drawn differently. Google&rsquo;s two are only asked the questions that do not already
              name you.
            </p>
          </>
        )}
      </section>

      {topGap && (
        <>
          <RuleHead title="What to do next" note="One move, chosen from the questions you are losing." />
          <div className="move">
            <div>
              <h2>Get listed on {topGap.domain}</h2>
              <p>
                Engines cited it {word(topGap.count)} time{topGap.count === 1 ? "" : "s"} in this
                window, on {word(topGap.example_prompt_ids.length)} question
                {topGap.example_prompt_ids.length === 1 ? "" : "s"} where your name never appeared. A
                listing there sits inside the answers that currently leave you out.
              </p>
            </div>
            <button type="button" className="btn" onClick={() => onGo("plan")}>Open the plan</button>
          </div>
        </>
      )}

      {comparison && comparison.tracked_competitors === 0 && (
        <p className="soon-note">
          No competitor is tracked yet, so nothing here says who the engines named instead of you.
          Adding one re-reads answers already stored — it costs nothing and takes a few seconds.
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------- checking -- */

/** What this browser knows about the check IT is driving. Never about anybody
 *  else's: a second person is refused, not shown a mirror of a run they cannot
 *  stop and did not start. */
interface CheckRun {
  /** Still stepping. */
  live: boolean;
  /** The last step's reply, or null before the first one comes back. */
  at: GeoPollProgress | null;
  /** Steps this run has completed — how many batches were actually bought. */
  steps: number;
  /** Estimated ms remaining, or null while nothing has been measured yet. */
  left: number | null;
  /** How it ended. Set once, at the end. */
  end: PollStop | null;
  /** Stop was pressed; the batch already paid for finishes first. */
  stopping: boolean;
}

/** Sleep that wakes early when the check is asked to stop, so Stop never waits
 *  out a 15-second backoff. */
function sleepUnlessStopped(ms: number, stopped: { current: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (stopped.current || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 150);
  });
}

/** The driving loop. Every step is a batch of real, paid engine calls, so it is
 *  bounded four ways — the backend's `stop_code`, its terminal signal, our own
 *  stall cap and a hard step ceiling — plus a gap between steps and a Stop
 *  control. The rules themselves live in `pollLoop.ts` and are tested there;
 *  what is here is only the I/O and the clock.
 *
 *  One token per press, carried on every step, is what holds the brand for the
 *  whole run: without it the backend falls back to the session id, which every
 *  tab in one browser shares, and two tabs would interleave batches.
 *
 *  Leaving the workspace mid-check stops the driving — the session's unmount
 *  aborts the step in flight and every answer already stored stays stored. The
 *  brand's lease then expires on the backend's own TTL; there is no cancel
 *  endpoint to call and nothing here pretends there is.
 */
function useGeoCheck(data: GeoData, onToast: ToastFn) {
  const session = useLoadSession();
  const [run, setRun] = useState<CheckRun | null>(null);
  const stopRef = useRef(false);
  const liveRef = useRef(false);
  const { brandId, reload } = data;

  const stop = useCallback(() => {
    if (!liveRef.current || stopRef.current) return;
    stopRef.current = true;
    setRun((r) => (r && r.live ? { ...r, stopping: true } : r));
  }, []);

  const dismiss = useCallback(() => {
    if (!liveRef.current) setRun(null);
  }, []);

  const start = useCallback(async () => {
    if (liveRef.current) return;
    liveRef.current = true;
    stopRef.current = false;
    setRun({ live: true, at: null, steps: 0, left: null, end: null, stopping: false });

    const token = newCheckToken();
    const attempt = session.begin("geo-check");
    const samples: number[] = [];
    let state: PollLoopState = initialPollState();
    // The last reply we actually got. A step that fails after twenty good ones
    // must not blank the twenty: "200 of 440 answers in, then the call broke"
    // is the true account, and "the call broke" alone loses half of it.
    let last: GeoPollProgress | null = null;

    const settle = (end: PollStop, at: GeoPollProgress | null) => {
      setRun({ live: false, at, steps: state.steps, left: null, end, stopping: false });
      onToast(end.message, end.tone);
    };

    try {
      for (;;) {
        const began = Date.now();
        const at = await geoPollStep(
          brandId,
          { batch_size: POLL_BATCH_SIZE, poll_token: token },
          { signal: attempt.signal },
        );
        if (!attempt.current()) return;
        samples.push(Date.now() - began);
        last = at;

        const step = pollDecision(state, at, { stopRequested: stopRef.current, now: new Date() });
        state = step.state;
        if (step.decision.action === "stop") {
          settle(step.decision, at);
          break;
        }

        // The only place the bar moves: a step actually returned and its
        // answers are banked. Nothing here animates towards a number it hopes
        // to reach.
        setRun({
          live: true, at, steps: state.steps,
          left: etaMs(at, samples), end: null, stopping: stopRef.current,
        });

        await sleepUnlessStopped(step.decision.delayMs, stopRef);
        if (!attempt.current()) return;
        // asked to stop during the gap — do not buy another batch to find out
        if (stopRef.current) {
          settle(pollStoppedByUser(at), at);
          break;
        }
      }
      reload();
    } catch (e: unknown) {
      // `failure` is silent for an unmount or a supersession — the only two
      // ways this can be cut short without anyone wanting to hear about it.
      const message = attempt.failure(e, "The check could not be run.");
      if (message) settle(checkFailure(apiStatus(e), message), last);
    } finally {
      liveRef.current = false;
      stopRef.current = false;
    }
  }, [session, brandId, reload, onToast]);

  return { run, start, stop, dismiss };
}

/** One heading per way a check can end. The sentence underneath is the loop's
 *  own message; this is the two or three words above it, and no two of them are
 *  the same — "the budget is gone", "somebody else is checking" and "the
 *  engines broke" must never be read as one another. */
const CHECK_HEADLINE: Record<PollStopKind, string> = {
  done: "Check complete",
  user: "Check stopped",
  budget: "Today's engine budget is spent",
  lease: "A check is already running",
  checked_today: "This brand was already checked today",
  engines: "The engines stopped answering",
  stalled: "Nothing was landing",
  ceiling: "Check paused at the safety limit",
  refused: "This check did not run",
  failed: "The check could not be run",
};

/** The long-run progress surface, and afterwards the record of how it ended.
 *
 *  Four states, and they are genuinely different things to say: about to start
 *  (nothing measured yet, so no bar and no clock), running, stopped by the
 *  reader or by the backend, and finished.
 */
function CheckPanel({
  run, brandName, onStop, onDismiss,
}: {
  run: CheckRun;
  brandName: string;
  onStop: () => void;
  onDismiss: () => void;
}) {
  const at = run.at;
  const total = at?.total ?? 0;
  const done = at?.done ?? 0;
  const left = total > 0 ? Math.max(0, total - done) : 0;
  const end = run.end;
  const aio = aioNote(at);

  return (
    <section className="pg">
      <div className="pg__head">
        <div>
          <h2>
            {end
              ? CHECK_HEADLINE[end.kind]
              : run.stopping
                ? `Stopping the check of ${brandName}`
                : `Checking ${brandName}`}
          </h2>
          {/* The one thing worth interrupting a screen reader for is how this
              ended. The figures below change on every step; announcing all of
              them 44 times would bury the sentence that matters. */}
          <p aria-live="polite">
            {end
              ? end.message
              : at
                ? "Every question goes to each engine with a key, and the answers are stored as they land. "
                  + "Leaving this screen stops the check; whatever is already collected stays."
                : "Asking for the first batch. Nothing is drawn here until it comes back."}
          </p>
        </div>
        {run.live ? (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onStop} disabled={run.stopping}>
            {run.stopping ? "Stopping…" : "Stop after this batch"}
          </button>
        ) : (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onDismiss}>Dismiss</button>
        )}
      </div>

      {at && total > 0 && (
        <>
          <div
            role="progressbar" aria-label="Answers collected"
            aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
            aria-valuetext={`${n(done)} of ${n(total)} answers collected`}
          >
            <Gauge fill={done / total} />
          </div>
          <Figures>
            <Figure value={n(done)} title="answers in">
              of {n(total)} this check will ask for
            </Figure>
            <Figure value={n(left)} title="still to ask">
              across {word(at.engines?.length ?? 0)} engine{at.engines?.length === 1 ? "" : "s"} with a key
            </Figure>
            {/* Time left is prose, not a headline number: it is remaining
                batches at the median of the steps measured so far, and a big
                clock face would claim a precision that estimate does not have. */}
            <Figure
              value={run.live ? n(batchesLeft(at)) : n(run.steps)}
              title={run.live ? "batches left" : `batch${run.steps === 1 ? "" : "es"} bought`}
            >
              {run.live
                ? run.left === null
                  ? "still timing the first one"
                  : `${humanDuration(run.left)} at the pace of the steps so far`
                : "each one a request the engines were paid for"}
            </Figure>
          </Figures>
        </>
      )}

      {at && (
        <p className="pg__foot">
          {n(at.calls_used_today)} of {n(at.daily_cap)} engine calls used today
          {aio ? ` · ${aio}` : ""}
        </p>
      )}
    </section>
  );
}

/** The four answers behind one question, fetched only when the row is opened.
 *
 *  Loading every answer for every question up front would be hundreds of long
 *  strings for a page whose first job is a grid of squares. */
function PromptAnswers({ data, promptId }: { data: GeoData; promptId: string }) {
  const session = useLoadSession();
  const [answers, setAnswers] = useState<Load<GeoAnswer[]>>(loadPending);

  useEffect(() => {
    void session.run(
      `geo-answers-${promptId}`,
      (s) => geoAnswers(data.brandId, { prompt_id: promptId, days: data.days }, { signal: s })
        .then((r) => r.answers),
      setAnswers,
      "Those answers could not be read.",
    );
  }, [session, data.brandId, data.days, promptId]);

  const names = data.names;

  if (answers.phase === "loading" && !answers.data) return <Wait what="Reading what they wrote" />;
  if (answers.phase === "failed" && !answers.data) {
    return <Oops what="Those answers could not be read." error={answers.error || ""} />;
  }
  if (!answers.data?.length) {
    return (
      <p className="calm" style={{ margin: "8px 0 0" }}>
        Nothing is stored for this question in the last {data.days} days.
      </p>
    );
  }

  return (
    <>
      {answers.data.map((a, i) => (
        <AnswerCard key={`${a.engine}-${a.run}-${i}`} answer={a} status={data.status} names={names} />
      ))}
    </>
  );
}
