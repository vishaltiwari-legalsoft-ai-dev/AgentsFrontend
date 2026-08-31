"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  geoAddCustomPrompt, geoAnswers, geoBrandConfig, geoBrands, geoConfig, geoGeneratePrompts, geoPollStep,
  geoPollStatus, geoPrompts, geoReport, geoRescan, geoSaveBrandConfig, geoSavePrompts,
  type GeoAnswer, type GeoBrandConfig, type GeoBrandRow, type GeoCompetitor, type GeoGlobalConfig,
  type GeoEngineStatus, type GeoPollProgress, type GeoPollStatus, type GeoPrompt, type GeoReport,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/lib/kit-ui";
import { describeFailure, useLoadSession } from "@/lib/load";
import { useReportWork } from "@/lib/work";
import type { ToastFn } from "@/components/console/ConsoleApp";
import { AnswerText } from "./AnswerText";
import { slugKey } from "./compare";
import { ContentOptimizer } from "./ContentOptimizer";
import { GeoActionPlan } from "./GeoActionPlan";
import { GeoCompare } from "./GeoCompare";
import { GeoDashboard } from "./GeoDashboard";
import { GeoInsights } from "./GeoInsights";
import { initialPollState, pollDecision, pollStoppedByUser, type PollLoopState } from "./pollLoop";
import { modeSuffix, statusOf } from "./provenance";
import { partialSweepLine, scheduleLine } from "./schedule";

/** GEO agent (a10) — how often AI answer engines name and cite each brand.
 *  Honesty rules baked in: every rate shows its n and variance; a missing
 *  engine key reads as "not connected", never as a zero. */

type GeoTab =
  | "insights" | "plan" | "dashboard" | "competitors"
  | "overview" | "prompts" | "answers" | "sources" | "optimizer";

const TAB_LABELS: Record<GeoTab, string> = {
  insights: "Insights",
  plan: "Action Plan",
  dashboard: "Dashboard",
  competitors: "Competitors",
  overview: "Overview",
  prompts: "Prompts",
  answers: "Answers",
  sources: "Sources",
  optimizer: "Content Optimizer",
};

const TAB_ORDER: GeoTab[] = [
  "insights", "plan", "dashboard", "competitors",
  "overview", "prompts", "answers", "sources", "optimizer",
];

const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  aio: "Google AIO",
};

/** Chip colour per measurement surface. Amber for proxy and unknown: both are
 *  usable data with a caveat, neither is an alarm — and neither may look like
 *  the green that means "this is the real product". */
const MODE_CLASS: Record<string, string> = {
  native: "seo-chip--on", serpapi: "seo-chip--on",
  proxy: "seo-chip--warn", unknown: "seo-chip--warn", off: "seo-chip--off",
};

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

const band = (stdev: number | null | undefined) =>
  stdev === null || stdev === undefined || stdev === 0 ? "" : ` ±${Math.round(stdev * 100)}`;

/** Sleep that wakes early when the poll is asked to stop, so a user hitting
 *  Stop never waits out a backoff. */
function sleepUnlessStopped(ms: number, stopped: { current: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (stopped.current || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve();
      }
    };
    const timer = setInterval(tick, 150);
  });
}

export function GeoAgent({ onToast, onBack }: { onToast: ToastFn; onBack: () => void }) {
  const { user } = useAuth();
  const [globalCfg, setGlobalCfg] = useState<GeoGlobalConfig | null>(null);
  const [brands, setBrands] = useState<GeoBrandRow[]>([]);
  /** Both kept apart from `brands`, because an empty list is only honest once
   *  a read has finished and succeeded. The registry read takes seconds, and
   *  until it lands `brands` is [] — which used to render "no brands yet" and
   *  send you to the SEO agent to add a brand that is already there. */
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [brand, setBrand] = useState<GeoBrandRow | null>(null);
  const [prompts, setPrompts] = useState<GeoPrompt[]>([]);
  const [report, setReport] = useState<GeoReport | null>(null);
  const [brandCfg, setBrandCfg] = useState<GeoBrandConfig | null>(null);
  const [answers, setAnswers] = useState<GeoAnswer[]>([]);
  const [answerEngine, setAnswerEngine] = useState<string>("");
  const [openAnswer, setOpenAnswer] = useState<number | null>(null);
  const [tab, setTab] = useState<GeoTab>("insights");
  const [busy, setBusy] = useState(false);
  // the brand's first load is several stored-answer reads; every panel must
  // say "loading" during it rather than "you have no data"
  const [loadingBrand, setLoadingBrand] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [polling, setPolling] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [progress, setProgress] = useState<GeoPollProgress | null>(null);
  const [schedule, setSchedule] = useState<GeoPollStatus | null>(null);
  const [pollNote, setPollNote] = useState<{ text: string; warn: boolean } | null>(null);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const stopPoll = useRef(false);
  /** Which brand the screen is currently showing. Every brand-scoped reply
   *  checks it before writing: the slot ticket stops a *second* call to the
   *  same loader landing under the first, and this stops one loader's reply
   *  landing under a brand the user has since moved on from. */
  const openBrandId = useRef<string | null>(null);
  const session = useLoadSession();

  useReportWork(busy || polling);

  const refresh = useCallback(async () => {
    const attempt = session.begin("brands");
    try {
      const [cfg, list] = await Promise.all([geoConfig(), geoBrands()]);
      if (!attempt.current()) return;
      setGlobalCfg(cfg);
      setBrands(list.brands);
      setBrandsError(null);
      setBrandsLoaded(true);
    } catch (e) {
      const message = attempt.failure(e, "Couldn't load the brands");
      if (message) {
        setBrandsError(message);
        setBrandsLoaded(true);
        onToast(message, "error");
      }
    }
  }, [onToast, session]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { stopPoll.current = true; }, []);

  /** Four endpoints into five pieces of shared state. Open brand A, then brand
   *  B before A lands, and A's report used to render under B's name — the exact
   *  race `RequestSequence` was written for, at the one call site that most
   *  needed it. One ticket covers all four, so a superseded open writes nothing
   *  and says nothing; B set the loading flag and B is the one that clears it. */
  async function openBrand(row: GeoBrandRow) {
    setBrand(row);
    openBrandId.current = row.id;
    setTab("insights");
    setReport(null);
    setProgress(null);
    setPollNote(null);
    setAnswers([]);
    setSchedule(null);
    setLoadingBrand(true);
    const attempt = session.begin("brand");
    try {
      const [p, r, c, s] = await Promise.all([
        geoPrompts(row.id), geoReport(row.id), geoBrandConfig(row.id),
        // the schedule is informational — a brand with no engine key still
        // opens, it just cannot say when its next sweep is
        geoPollStatus(row.id).catch(() => null),
      ]);
      if (!attempt.current()) return;
      setPrompts(p.prompts ?? []);
      setReport(r);
      setBrandCfg(c);
      setSchedule(s);
    } catch (e) {
      const message = attempt.failure(e, "Failed to load brand");
      if (message) onToast(message, "error");
    } finally {
      if (attempt.current()) setLoadingBrand(false);
    }
  }

  async function reloadReport(brandId: string) {
    const attempt = session.begin("report");
    try {
      const next = await geoReport(brandId);
      // A poll runs for minutes; the user may well have opened another brand
      // by the time it finishes.
      if (!attempt.current() || openBrandId.current !== brandId) return;
      setReport(next);
    } catch (e) {
      const message = attempt.failure(e, "Could not load the report");
      if (message) onToast(message, "error");
    }
  }

  async function generate() {
    if (!brand) return;
    setBusy(true);
    onToast("Drafting the prompt universe — the buyer questions we'll poll engines with…");
    try {
      const doc = await geoGeneratePrompts(brand.id);
      setPrompts(doc.prompts);
      setTab("prompts");
      onToast(`Drafted ${doc.prompts.length} prompts — review and edit them, then poll.`);
    } catch (e) {
      onToast(describeFailure(e, "Prompt generation failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function savePrompts() {
    if (!brand) return;
    setBusy(true);
    try {
      await geoSavePrompts(brand.id, prompts);
      onToast("Prompts saved");
    } catch (e) {
      onToast(describeFailure(e, "Save failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  function requestStopPoll() {
    if (!polling || stopPoll.current) return;
    stopPoll.current = true;
    setStopRequested(true);
    setPollNote({ text: "Stopping after the batch that is already paid for…", warn: false });
  }

  /** Every step of this loop is a batch of real, paid engine calls, so it is
   *  bounded three ways: the backend's terminal signal, our own stall cap, and
   *  a hard step ceiling — plus a delay between steps and a user stop control.
   *  See pollLoop.ts; the decision rules are tested there. */
  async function runPoll() {
    if (!brand || polling) return;
    setPolling(true);
    setStopRequested(false);
    setPollNote(null);
    stopPoll.current = false;
    onToast("Polling engines — each prompt runs multiple times so the numbers carry a variance band…");
    let state: PollLoopState = initialPollState();
    // Not a load, but it has the same question to answer between steps: is
    // anyone still looking? `close()` on unmount makes this false, which is
    // what `mounted = useRef(true)` was hand-rolling.
    const attempt = session.begin("poll");
    try {
      for (;;) {
        const p = await geoPollStep(brand.id, {});
        if (!attempt.current()) return;
        setProgress(p);

        const step = pollDecision(state, p, { stopRequested: stopPoll.current });
        state = step.state;
        if (step.decision.action === "stop") {
          onToast(step.decision.message, step.decision.tone);
          setPollNote({ text: step.decision.message, warn: step.decision.tone !== "ok" });
          break;
        }

        await sleepUnlessStopped(step.decision.delayMs, stopPoll);
        if (!attempt.current()) return;
        // asked to stop during the gap — do not buy another batch to find out
        if (stopPoll.current) {
          const bail = pollStoppedByUser(p);
          onToast(bail.message, bail.tone);
          setPollNote({ text: bail.message, warn: false });
          break;
        }
      }
      await reloadReport(brand.id);
      await refresh();
    } catch (e) {
      const msg = attempt.failure(e, "Polling failed");
      if (msg) {
        onToast(msg, "error");
        setPollNote({ text: `Poll stopped — ${msg}`, warn: true });
      }
    } finally {
      if (attempt.current()) {
        setPolling(false);
        setStopRequested(false);
      }
    }
  }

  async function loadAnswers(engine: string) {
    if (!brand) return;
    const brandId = brand.id;
    setAnswerEngine(engine);
    setOpenAnswer(null);
    setLoadingAnswers(true);
    const attempt = session.begin("answers");
    try {
      const res = await geoAnswers(brandId, engine ? { engine } : {});
      if (!attempt.current() || openBrandId.current !== brandId) return;
      setAnswers(res.answers);
    } catch (e) {
      const message = attempt.failure(e, "Could not load answers");
      if (message) onToast(message, "error");
    } finally {
      if (attempt.current()) setLoadingAnswers(false);
    }
  }

  async function addCustomPrompt() {
    if (!brand || newPrompt.trim().length < 5 || busy) return;
    setBusy(true);
    try {
      const universe = await geoAddCustomPrompt(brand.id, newPrompt.trim());
      setPrompts(universe.prompts ?? []);
      setNewPrompt("");
      onToast("Added — your question survives every regeneration.");
    } catch (e) {
      onToast(describeFailure(e, "Could not add the question"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function addCompetitor() {
    if (!brand || !brandCfg || !newCompetitor.trim()) return;
    const name = newCompetitor.trim();
    const next = [
      ...(brandCfg.competitors ?? []),
      { key: slugKey(name), name, aliases: [name] },
    ];
    try {
      const cfg = await geoSaveBrandConfig(brand.id, { competitors: next });
      setBrandCfg(cfg);
      setNewCompetitor("");
      // Same rule as the Competitors tab: mentions are read when an answer is
      // stored, so without the re-read this rival sits at 0% for two days.
      const result = await geoRescan(brand.id);
      await reloadReport(brand.id);
      onToast(
        result.answers_updated
          ? `${name} tracked — found in ${result.answers_updated} stored answers.`
          : `${name} tracked. Not named in any stored answer yet; future polls measure them.`,
      );
    } catch (e) {
      onToast(describeFailure(e, "Could not save competitor"), "error");
    }
  }

  /** Shared by the Overview chips and the Competitors tab, so one competitor
   *  list cannot drift into two. Throws on failure — the caller shows it. */
  async function saveCompetitors(next: GeoCompetitor[]) {
    if (!brand) return;
    setBrandCfg(await geoSaveBrandConfig(brand.id, { competitors: next }));
  }

  /** Saving the schedule re-reads the status, so the line under the header
   *  reflects the new cadence immediately instead of after a reload. */
  async function saveSchedule(patch: { auto_poll?: boolean; poll_interval_days?: number }) {
    if (!brand) return;
    try {
      setBrandCfg(await geoSaveBrandConfig(brand.id, patch));
      setSchedule(await geoPollStatus(brand.id).catch(() => null));
      onToast("Schedule saved — the next cron run honours it.");
    } catch (e) {
      onToast(describeFailure(e, "Could not save the schedule"), "error");
    }
  }

  const isCreator = !!user?.is_creator;
  const engines = globalCfg?.engines ?? {};
  const connected = Object.entries(engines).filter(([, ok]) => ok).map(([e]) => e);
  // engine_status is the honest source; fall back to the boolean map only for
  // a backend that predates it, and then claim nothing about the surface
  const engineStatus: Record<string, GeoEngineStatus> = globalCfg?.engine_status ?? {};
  const blended = report?.blended;
  const hasData = (blended?.mention.n_answers ?? 0) > 0;

  // Hero story + at most three actions — the calm-UI contract.
  const actions: { icon: string; text: string; onClick?: () => void }[] = [];
  if (!connected.length) {
    actions.push({ icon: "lock", text: "Connect an engine key (Perplexity or Gemini) in Settings → Secrets — nothing can be measured without one." });
  }
  if (prompts.length === 0) {
    actions.push({ icon: "sparkles", text: "Generate the prompt universe — the buyer questions we measure against.", onClick: user?.is_creator ? () => void generate() : undefined });
  } else if (!hasData) {
    actions.push({ icon: "refresh-cw", text: "Run the first poll to get a baseline.", onClick: () => void runPoll() });
  }
  if (hasData && report) {
    const gap = report.source_gap[0];
    if (gap) {
      actions.push({ icon: "target", text: `Earn presence on ${gap.domain} — engines cited it ${gap.count}× on your prompts where you were absent.` });
    }
    if (blended && blended.citation.rate === 0 && (blended.mention.rate ?? 0) > 0) {
      actions.push({ icon: "link", text: "You get named but never linked — publish citable, answer-first pages so engines have something to cite." });
    }
  }
  const heroActions = actions.slice(0, 3);

  const topCompetitor = report
    ? Object.entries(report.competitors)
        .map(([key, stats]) => ({ key, rate: stats.rate ?? 0 }))
        .sort((a, b) => b.rate - a.rate)[0]
    : undefined;

  return (
    <div className="mr-app geo-app">
      <header className="mr-top">
        <button className="mr-top__back" onClick={() => (brand ? setBrand(null) : onBack())} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="mr-top__id">
          <span className="mr-top__name">GEO — AI Visibility{brand ? ` · ${brand.name}` : ""}</span>
          <span className="mr-top__sub">How often AI answers name and cite each brand — measured, not guessed</span>
        </div>
        <div className="geo-engines">
          {Object.keys(ENGINE_LABELS).map((e) => {
            const st = statusOf(engineStatus, e, Boolean(engines[e as keyof typeof engines]));
            return (
              <span key={e} className={`seo-chip ${MODE_CLASS[st.mode] ?? "seo-chip--off"}`}
                    title={st.model ? `${st.means} — ${st.model}` : st.means || "not connected"}>
                {ENGINE_LABELS[e]}{modeSuffix(st.mode)}
              </span>
            );
          })}
        </div>
      </header>

      <div className="mr-body">
        {!brand && (
          <div className="mr-panel">
            <details className="geo-about">
              <summary><Icon name="info" size={15} /> What this agent does · How to use it</summary>
              <div className="geo-about__cols">
                <div>
                  <h4>What it does</h4>
                  <p>
                    When potential clients ask ChatGPT, Gemini or Perplexity things like
                    &ldquo;best intake service for law firms&rdquo;, the AI names a few brands and cites a few
                    links. This agent asks those engines the real buyer questions every week and measures —
                    not guesses — how often <strong>your</strong> brand is named, linked, and how you compare
                    to competitors.
                  </p>
                </div>
                <div>
                  <h4>How to use it</h4>
                  <ol>
                    <li>Open your brand and check <strong>Insights</strong> — it reads the data for you and lists what to fix, in order.</li>
                    <li>Once a week hit <strong>Poll now</strong> — trends over weeks are the signal; day-to-day change is AI randomness.</li>
                    <li>Work the list: earn the source-gap placements, make key pages citable with the <strong>Content Optimizer</strong>.</li>
                  </ol>
                </div>
              </div>
            </details>
            <div className="mr-panel__head">
              <h2 className="mr-panel__title">Brands</h2>
              <span className="mr-panel__sub">Open a brand to see its AI visibility and the gaps to fix.</span>
            </div>
            <div className="seo-grid">
              {brands.map((b) => (
                <div key={b.id} className="seo-card" role="button" tabIndex={0}
                     onClick={() => void openBrand(b)}
                     onKeyDown={(e) => e.key === "Enter" && void openBrand(b)}>
                  <div className="seo-card__head">
                    <span className="seo-card__name">{b.name}</span>
                    <span className="seo-card__domain">{b.domain}</span>
                  </div>
                  <div className="geo-card__meta">
                    <span>{b.prompts ? `${b.prompts} prompts` : "No prompts yet"}</span>
                    <span>{b.recent_answers ? `${b.recent_answers} answers this week` : "Not polled yet"}</span>
                    {b.competitors > 0 && <span>{b.competitors} competitors tracked</span>}
                  </div>
                </div>
              ))}
              {brands.length === 0 && brandsError && (
                <div className="geo-hero">
                  <div className="geo-hero__big geo-hero__big--muted">Couldn&apos;t load the brand registry</div>
                  <p className="geo-hero__empty">{brandsError}</p>
                  <p className="geo-note">
                    This is a failed read, not an empty registry — any brands you track are still
                    there, so adding one in the SEO agent will not fix it.
                  </p>
                  <button className="seo-btn" onClick={() => void refresh()}>Try again</button>
                </div>
              )}
              {brands.length === 0 && !brandsError && !brandsLoaded && (
                <div className="seo-empty">Reading the brand registry…</div>
              )}
              {brands.length === 0 && !brandsError && brandsLoaded && (
                <div className="seo-empty">No brands yet — add one in the SEO agent first; GEO shares its brand registry.</div>
              )}
            </div>
          </div>
        )}

        {brand && (
          <>
            <section className="geo-hero">
              <div className="geo-hero__story">
                {hasData && blended ? (
                  <>
                    <span className="geo-hero__big">{pct(blended.mention.rate)}<em>{band(blended.mention.stdev)}</em></span>
                    <p>
                      of tracked buyer conversations name {brand.name} ({blended.mention.n_answers} answers,{" "}
                      {blended.mention.n_prompts} prompts).{" "}
                      {topCompetitor && topCompetitor.rate > 0
                        ? `${report?.competitor_names[topCompetitor.key] ?? topCompetitor.key} gets named in ${pct(topCompetitor.rate)}.`
                        : "No tracked competitor is currently ahead."}{" "}
                      Engines link {brand.domain} in {pct(blended.citation.rate)} of answers that carry citations.
                    </p>
                  </>
                ) : (
                  <p className="geo-hero__empty">
                    No baseline yet. Generate the prompts, run the first poll, and the numbers appear here.
                  </p>
                )}
              </div>
              {heroActions.length > 0 && (
                <div className="geo-actions">
                  {heroActions.map((a, i) => (
                    <button key={i} className={`geo-action${a.onClick ? "" : " geo-action--static"}`}
                            onClick={a.onClick} disabled={!a.onClick}>
                      <Icon name={a.icon} size={14} /> <span>{a.text}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="geo-hero__sched">
                {(() => {
                  const line = scheduleLine(schedule, new Date());
                  const partial = partialSweepLine(schedule);
                  return (
                    <>
                      <span className={`geo-sched${line.tone === "attention" ? " geo-sched--attn" : ""}`}>
                        <Icon name="calendar" size={13} /> {line.text}
                      </span>
                      {partial && <span className="geo-sched">{partial}</span>}
                    </>
                  );
                })()}
              </div>
              <div className="geo-hero__ops">
                {/* While a poll is running this is the stop control — the run is
                    real spend, so the user must be able to end it without
                    navigating away and waiting for the daily cap to trip. */}
                <button
                  className="seo-btn seo-btn--primary"
                  disabled={polling ? stopRequested : !prompts.length}
                  onClick={() => (polling ? requestStopPoll() : void runPoll())}
                >
                  <Icon name={polling ? "pause" : "refresh-cw"} size={13} />{" "}
                  {polling ? (stopRequested ? "Stopping…" : "Stop after this step") : "Poll now"}
                </button>
                {!polling && (
                  <span className="geo-sched geo-sched--hint">
                    Only needed if you can&apos;t wait for the scheduled run — a full sweep is
                    ~400 engine calls and keeps this tab busy.
                  </span>
                )}
              </div>
              {/* What the run is actually spending, in the units it spends them
                  in — answers banked, and paid engine calls against the cap. */}
              {progress && (
                <span className="geo-progress" aria-live="polite">
                  {progress.done} of {progress.total} answers across {prompts.length}{" "}
                  {prompts.length === 1 ? "prompt" : "prompts"} · {progress.calls_used_today} of{" "}
                  {progress.daily_cap} engine calls used today
                </span>
              )}
              {pollNote && (
                <span className={`geo-progress${pollNote.warn ? " geo-progress--warn" : ""}`}>{pollNote.text}</span>
              )}
            </section>

            <nav className="geo-tabs">
              {TAB_ORDER.map((t) => (
                <button key={t} className={`geo-tab${tab === t ? " geo-tab--on" : ""}`}
                        onClick={() => { setTab(t); if (t === "answers" && !answers.length) void loadAnswers(""); }}>
                  {t === "prompts" ? `Prompts (${prompts.length})` : TAB_LABELS[t]}
                </button>
              ))}
            </nav>

            {tab === "overview" && (
              <div className="mr-panel">
                {loadingBrand && !hasData && <div className="seo-empty">Reading stored answers…</div>}
                {!loadingBrand && !hasData && (
                  <div className="seo-empty">Run a poll first — every number here comes from real engine answers.</div>
                )}
                {hasData && report && (
                  <>
                    <div className="geo-enginecards">
                      {Object.entries(report.engines).map(([engine, block]) => (
                        <div key={engine} className="geo-enginecard">
                          <div className="geo-enginecard__name">{ENGINE_LABELS[engine] ?? engine}</div>
                          <div className="geo-enginecard__num">{pct(block.mention.rate)}<em>{band(block.mention.stdev)}</em></div>
                          <div className="geo-enginecard__sub">
                            named · {block.n_answers} answers{block.n_errors ? ` · ${block.n_errors} errors` : ""}
                          </div>
                          <div className="geo-enginecard__sub">cited {pct(block.citation.rate)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mr-section">
                      <h3 className="mr-section__title">Share of voice (position-weighted)</h3>
                      {Object.entries(report.blended.sov.share)
                        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                        .map(([entity, share]) => (
                          <div key={entity} className="geo-bar">
                            <span className="geo-bar__label">
                              {entity === "self" ? brand.name : report.competitor_names[entity] ?? entity}
                            </span>
                            <span className="geo-bar__track">
                              <span className={`geo-bar__fill${entity === "self" ? " geo-bar__fill--self" : ""}`}
                                    style={{ width: `${Math.max(2, Math.round((share ?? 0) * 100))}%` }} />
                            </span>
                            <span className="geo-bar__num">{pct(share)}</span>
                          </div>
                        ))}
                      <p className="geo-note">
                        {report.blended.sov.unclaimed_answers} answers mentioned no tracked brand. Numbers are
                        sampled from {report.blended.mention.n_answers} answers over {report.days} days — AI output
                        varies run to run; the ± band is that variance, not an error.
                      </p>
                    </div>
                    <div className="mr-section">
                      <h3 className="mr-section__title">Polling schedule</h3>
                      <p className="geo-note">
                        A full sweep is ~400 engine calls. It runs on a schedule so nobody has to
                        sit and wait for it — the cron checks daily and polls a brand when it&apos;s due.
                      </p>
                      <div className="geo-sched__ctl">
                        <label className="geo-sched__label">
                          <input type="checkbox" checked={brandCfg?.auto_poll ?? true}
                                 disabled={!isCreator}
                                 onChange={(e) => void saveSchedule({ auto_poll: e.target.checked })} />
                          Poll automatically
                        </label>
                        <label className="geo-sched__label">
                          Every
                          <select className="geo-select" value={brandCfg?.poll_interval_days ?? 2}
                                  disabled={!isCreator || brandCfg?.auto_poll === false}
                                  onChange={(e) => void saveSchedule({ poll_interval_days: Number(e.target.value) })}>
                            {[1, 2, 3, 7, 14].map((d) => (
                              <option key={d} value={d}>{d === 1 ? "day" : `${d} days`}</option>
                            ))}
                          </select>
                        </label>
                        <span className="geo-sched">{scheduleLine(schedule, new Date()).text}</span>
                      </div>
                    </div>
                    <div className="mr-section">
                      <h3 className="mr-section__title">Tracked competitors</h3>
                      <div className="geo-competitors">
                        {(brandCfg?.competitors ?? []).map((c) => (
                          <span key={c.key} className="seo-chip">{c.name} · {pct(report.competitors[c.key]?.rate ?? null)}</span>
                        ))}
                        {user?.is_creator && (
                          <span className="geo-addcomp">
                            <input value={newCompetitor} placeholder="Add competitor…"
                                   onChange={(e) => setNewCompetitor(e.target.value)}
                                   onKeyDown={(e) => e.key === "Enter" && void addCompetitor()} />
                            <button className="seo-btn" onClick={() => void addCompetitor()}>Track</button>
                          </span>
                        )}
                      </div>
                      <p className="geo-note">
                        These are mention rates only. The{" "}
                        <button className="geo-linkbtn" onClick={() => setTab("competitors")}>
                          Competitors tab
                        </button>{" "}
                        scores them question by question, with citations and who is ahead where.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "prompts" && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Prompt universe</h2>
                  {user?.is_creator && (
                    <div className="geo-promptops">
                      <button className="seo-btn" disabled={busy} onClick={() => void generate()}>
                        <Icon name="sparkles" size={13} /> {prompts.length ? "Regenerate" : "Generate"}
                      </button>
                      <button className="seo-btn seo-btn--primary" disabled={busy || !prompts.length} onClick={() => void savePrompts()}>
                        Save
                      </button>
                    </div>
                  )}
                </div>
                {user?.is_creator && (
                  <div className="geo-addcomp geo-addprompt">
                    <input value={newPrompt} placeholder="Add your own buyer question — e.g. “which intake service handles Spanish-speaking clients?”"
                           onChange={(e) => setNewPrompt(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && void addCustomPrompt()} />
                    <button className="seo-btn" disabled={busy || newPrompt.trim().length < 5}
                            onClick={() => void addCustomPrompt()}>Add</button>
                  </div>
                )}
                <p className="geo-note">
                  Team-written questions are the most valuable — real objections from sales calls beat
                  anything AI drafts, and they survive regeneration. One rule: phrase them the way a
                  buyer would (&ldquo;best intake service for law firms&rdquo;), never in your own favour
                  (&ldquo;why is {brand.name} the best&rdquo;) — leading questions inflate the score and
                  teach you nothing.
                </p>
                {prompts.length === 0 && (
                  <div className="seo-empty">No prompts yet — these are the buyer questions we poll engines with.</div>
                )}
                {prompts.map((p, i) => (
                  <div key={p.id} className={`geo-prompt${p.enabled ? "" : " geo-prompt--off"}`}>
                    <input type="checkbox" checked={p.enabled} disabled={!user?.is_creator}
                           onChange={(e) => setPrompts(prompts.map((q, j) => (j === i ? { ...q, enabled: e.target.checked } : q)))} />
                    <input className="geo-prompt__text" value={p.text} disabled={!user?.is_creator}
                           onChange={(e) => setPrompts(prompts.map((q, j) => (j === i ? { ...q, text: e.target.value } : q)))} />
                    {p.source === "custom" && <span className="seo-chip seo-chip--on">yours</span>}
                    <span className={`seo-chip geo-prompt__intent geo-prompt__intent--${p.intent}`}>{p.intent}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "answers" && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Raw answers</h2>
                  <select className="geo-select" value={answerEngine} onChange={(e) => void loadAnswers(e.target.value)}>
                    <option value="">All engines</option>
                    {Object.keys(ENGINE_LABELS).map((e) => <option key={e} value={e}>{ENGINE_LABELS[e]}</option>)}
                  </select>
                </div>
                {loadingAnswers && <div className="seo-empty">Reading stored answers…</div>}
                {!loadingAnswers && answers.length === 0 && (
                  <div className="seo-empty">No stored answers for this window.</div>
                )}
                {answers.map((a, i) => (
                  <div key={`${a.prompt_id}-${a.engine}-${a.run}-${i}`} className="geo-answer">
                    <button className="geo-answer__head" onClick={() => setOpenAnswer(openAnswer === i ? null : i)}>
                      <span className="geo-answer__prompt">{a.prompt_text}</span>
                      <span className="geo-answer__chips">
                        <span className="seo-chip">{ENGINE_LABELS[a.engine] ?? a.engine} · run {a.run}</span>
                        {a.via === "openrouter" && (
                          <span className="seo-chip seo-chip--warn"
                                title={`Measured with a similar AI model${a.model ? ` (${a.model})` : ""} via OpenRouter — add the official ${ENGINE_LABELS[a.engine] ?? a.engine} key in Settings → Secrets for exact readings.`}>
                            similar model · {a.model || "openrouter"}
                          </span>
                        )}
                        {a.error ? (
                          <span className="seo-chip seo-chip--off">error</span>
                        ) : (
                          <>
                            <span className={`seo-chip ${a.brand_mentioned ? "seo-chip--on" : "seo-chip--off"}`}>
                              {a.brand_mentioned ? `named #${a.brand_position}` : "not named"}
                            </span>
                            <span className={`seo-chip ${a.brand_cited ? "seo-chip--on" : "seo-chip--off"}`}>
                              {a.brand_cited ? "cited" : "not cited"}
                            </span>
                            {a.sentiment && <span className="seo-chip">{a.sentiment}</span>}
                          </>
                        )}
                      </span>
                    </button>
                    {openAnswer === i && (
                      <div className="geo-answer__body">
                        {a.error ? <p className="geo-answer__error">{a.error}</p>
                          : a.no_aio ? <p className="geo-note">Google showed no AI Overview for this query — the AIO slot is open here, nobody wins it yet. Not counted in any rate.</p>
                          : <AnswerText text={a.text} />}
                        {a.citations.length > 0 && (
                          <div className="geo-answer__cites">
                            {a.citations.map((c, j) => (
                              <a key={j} href={c.url} target="_blank" rel="noreferrer" className="seo-chip">{c.domain}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "sources" && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Source gap — where to earn presence</h2>
                  <span className="mr-panel__sub">Domains the engines cite on your prompts in answers where you're absent.</span>
                </div>
                {loadingBrand && !report && <div className="seo-empty">Reading stored answers…</div>}
                {!loadingBrand && !report?.source_gap.length && (
                  <div className="seo-empty">No gap data yet — run a poll first.</div>
                )}
                {!!report?.source_gap.length && (
                  <table className="geo-table">
                    <thead>
                      <tr><th>Domain</th><th>Cited (you absent)</th><th>Example prompts</th></tr>
                    </thead>
                    <tbody>
                      {report.source_gap.map((g) => (
                        <tr key={g.domain}>
                          <td>{g.domain}</td>
                          <td>{g.count}×</td>
                          <td className="geo-table__examples">
                            {g.example_prompt_ids
                              .map((pid) => prompts.find((p) => p.id === pid)?.text ?? pid)
                              .join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!!report && (
                  <div className="mr-section">
                    <h3 className="mr-section__title">Most-cited domains overall</h3>
                    <div className="geo-competitors">
                      {report.blended.source_mix.map((s) => (
                        <span key={s.domain} className="seo-chip">{s.domain} · {s.count}</span>
                      ))}
                    </div>
                    <p className="geo-note">
                      Source mixes shift between engines and over time — we measure them each poll instead of assuming.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === "insights" && (
              <GeoInsights
                brand={brand}
                report={report}
                promptCount={prompts.length}
                connected={connected}
                isCreator={!!user?.is_creator}
                loading={loadingBrand}
                onGenerate={() => void generate()}
                onPoll={() => void runPoll()}
                engineStatus={engineStatus}
                goTab={(t) => { setTab(t); if (t === "answers" && !answers.length) void loadAnswers(""); }}
              />
            )}

            {tab === "plan" && (
              <GeoActionPlan brand={brand} report={report} isCreator={!!user?.is_creator} onToast={onToast} />
            )}

            {tab === "dashboard" && <GeoDashboard brand={brand} onToast={onToast} />}

            {tab === "competitors" && (
              <GeoCompare
                brand={brand}
                competitors={brandCfg?.competitors ?? []}
                isCreator={isCreator}
                onTrack={saveCompetitors}
                onToast={onToast}
                goPrompts={() => setTab("prompts")}
              />
            )}

            {tab === "optimizer" && (
              <ContentOptimizer brandId={brand.id} onToast={onToast} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
