"use client";

/** PR Writer (a13) — one brand's PR drafts → the brief → a run → its package.
 *
 *  The screen answers one question: can this news go out under this brand,
 *  and if not, what is still in the way and who has to clear it?
 *
 *  Which view is on screen is the route's decision, handed down by
 *  `PrWorkspace`; the desk moves only by asking `onNavigate`. What a viewer
 *  may do is the server's `can` and `viewer_can_act`, never re-derived here.
 *  Every write answers with the whole fresh run, which replaces the one on
 *  screen (contract §1), so there is no local bookkeeping to drift.
 *
 *  Only the owner's browser runs steps — each one is paid search and model
 *  work — and it runs them one POST at a time until `next_step` is null.
 *  Teammates' screens re-read the run every 15 s while it is writing or
 *  paused, so a clearance or a finished step reaches them without a reload. */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  apiBody, apiCode, prAddPeople, prApprove, prAskChanges, prCard, prClarify, prCreateRun, prEscalation, prExport,
  prMembers, prRecordQuote, prRemoveClaim, prRevise, prRun, prSendForReview, prSignOff, prStep, prVerifyClaim,
  prVersion,
  type PrBlock, type PrBrand, type PrBrandCardResponse, type PrClaim, type PrClarifyKey, type PrContentType,
  type PrEscalationAction, type PrExportFormat, type PrMember, type PrPackageSection, type PrRun as PrRunDoc,
  type PrRunSummary, type PrSignoffRow, type PrStepId, type PrVersion,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { describeFailure, useLoadSession } from "@/lib/load";
import { andList } from "@/components/hub/model";
import { useReportWork } from "@/lib/work";
import type { ToastFn } from "@/components/hub/context";
import { Oops, Wait } from "@/components/hub/ui";
import {
  CLARIFY_SCREEN_FAILED, POLL_MS, STEP_LABEL, actionErrorText, apDate, chipInputOf, clearedToast, coverChips, coverCounts, coverStory,
  createErrorText, escalationRecordLine, escalationSeat, exportFilename, groupRuns, isOwner, lockedBanner, nextAutoStep,
  normaliseCard, normaliseRun, normaliseVersion, quoteResetLine, quoteResetToast, researchPartialNote, resignWarning,
  retryDelayMs, rowMeta, rowTitle, runChip, sectionStep, shouldPoll, speakerName, stepLines, stoppedLine, versionLabel,
  versionStatusLabel,
  type Chip, type PrView,
} from "@/components/hub/work/pr";
import {
  AddPeopleDialog, ClarifyCard, EscalationCard, NoteDialog, PrMarkerText, SignoffPanel, StepList, VersionList,
  type MarkerHit,
} from "./PrParts";
import { BrandCardEditor } from "./BrandCardEditor";

const EMPTY_NEWS = "Write the news in one sentence. Details can come later.";
const LEAVE_HINT = "You can leave this page. Each step is saved; opening the draft again carries on from where it stopped.";

/** Conflicts that mean "the run moved under you": re-read it and let the
 *  fresh state decide what happens next. */
const MOVED = new Set(["step_out_of_order", "needs_details", "run_paused", "run_closed", "run_locked", "stale_version",
  "clarify_closed", "escalation_not_open", "not_in_review", "no_draft", "package_not_ready", "already_locked",
  "approval_blocked", "conflict"]);

/** Step failures the backend saves on the step, so a re-read shows them. */
const SAVED_ON_STEP = new Set(["search_unavailable", "credential_missing", "model_unavailable", "model_truncated",
  "model_refused", "model_output_invalid", "screen_failed", "model_timeout"]);

/** A refusal's reason in words, from the error's code and its extras. */
function refusal(e: unknown, fallback: string): string {
  const code = apiCode(e);
  const detail = (apiBody(e).detail ?? {}) as Record<string, unknown>;
  if (code === "approval_blocked" && Array.isArray(detail.blockers) && detail.blockers.length) {
    return `It can't be approved yet: ${andList(detail.blockers.map(String))}.`;
  }
  return actionErrorText(code, code ? (e instanceof Error ? e.message : null) : null, describeFailure(e, fallback));
}

const SECTION_NAME: Record<PrPackageSection, string> = {
  seo: "SEO", distribution: "Distribution plan", snippets: "Social and pitch snippets", reviewer_notes: "Reviewer notes",
};

type Disclosure = "versions" | "headlines" | "quotes" | "facts" | "notes" | "angle" | "seo" | "distribution" | "snippets";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ChipView({ chip }: { chip: Chip }) {
  return <span className={`bw-chip pr-chip--${chip.tone}`}>{chip.text}</span>;
}

export interface PrWriterProps {
  onToast: ToastFn;
  /** Every brand, from the workspace's one read. */
  brands: PrBrand[];
  /** This brand's runs the viewer takes part in. */
  drafts: PrRunSummary[];
  brandId: string;
  view: PrView;
  meId: string;
  /** The older version the route asks for (`?v=`), or null for the current. */
  viewing: string | null;
  onViewVersion: (version: string | null) => void;
  /** Move the route: `view` is `drafts`, `write`, `card` or a run id. */
  onNavigate: (brandId: string, view: string) => void;
  /** A run was created or moved — the workspace re-reads the list. */
  onRunsChanged: () => void;
  onRunOpened?: (run: PrRunDoc) => void;
}

export function PrWriter({
  onToast, brands, drafts, brandId, view, meId, viewing, onViewVersion, onNavigate, onRunsChanged, onRunOpened,
}: PrWriterProps) {
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const runId = view.kind === "run" ? view.runId : "";
  const session = useLoadSession();

  /* ------------------------------------------------------------- write -- */
  const [news, setNews] = useState("");
  const [facts, setFacts] = useState("");
  const [factsOpen, setFactsOpen] = useState(false);
  const [writeErr, setWriteErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // State lags a render behind; a second Ctrl+Enter in the same tick must not
  // file a second run (there is no idempotency token on the server).
  const creatingRef = useRef(false);

  /* --------------------------------------------------------------- run -- */
  const [run, setRun] = useState<PrRunDoc | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [older, setOlder] = useState<PrVersion | null>(null);
  const [olderErr, setOlderErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<PrStepId | null>(null);
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Partial<Record<Disclosure, boolean>>>({});
  const [verifying, setVerifying] = useState<PrClaim | null>(null);
  const [addingPeople, setAddingPeople] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);

  /* -------------------------------------------------------------- card -- */
  const [card, setCard] = useState<PrBrandCardResponse | null>(null);
  const [members, setMembers] = useState<PrMember[] | null>(null);
  const [cardErr, setCardErr] = useState<string | null>(null);
  const [cardBeat, setCardBeat] = useState(0);

  const openRef = useRef<string | null>(null);
  /** The one step loop allowed to keep going; replacing or clearing it
   *  disowns the old one, which then writes nothing. */
  const loopRef = useRef<{ stop: boolean } | null>(null);
  const brandRef = useRef(brandId);
  brandRef.current = brandId;

  useReportWork(!!busy || !!inFlight || creating);

  const fail = useCallback((e: unknown, fallback: string) => onToast(refusal(e, fallback), "error"), [onToast]);

  /** Lands a reply on screen only while its run is still the one open. */
  const land = useCallback((next: PrRunDoc): boolean => {
    if (openRef.current !== next.id) return false;
    setRun(next);
    return true;
  }, []);

  /* ------------------------------------------------------- step driving -- */

  /** POSTs `next_step` until there is nothing left to run, the run stops on a
   *  person (details, a pause, a failure), or the reader leaves. `force` runs
   *  one named step first — Try again. */
  const drive = useCallback(async (start: PrRunDoc, force: PrStepId | null = null) => {
    const me = { stop: false };
    loopRef.current = me;
    const owns = () => loopRef.current === me && openRef.current === start.id;
    let current = start;
    let step: PrStepId | null = force ?? nextAutoStep(current);
    const conflicts: Record<string, number> = {};
    setDriveErr(null);
    try {
      while (owns() && step) {
        setInFlight(step);
        try {
          current = normaliseRun(await prStep(current.id, step));
        } catch (e) {
          if (!owns()) return;
          const code = apiCode(e);
          if (code === "step_running") {
            // Another tab (or a double click) is inside this step. Wait it out
            // and read the run; never fire a second copy.
            const detail = apiBody(e).detail as Record<string, unknown> | undefined;
            await sleep(retryDelayMs(detail?.retry_after_s));
          } else if (!code || !MOVED.has(code)) {
            // 424 / 502 / 504 are saved on the step, so the re-read shows them.
            // Anything else (a dropped connection, our own timeout) is not, so
            // it is said here.
            if (!code || !SAVED_ON_STEP.has(code)) setDriveErr(refusal(e, `${STEP_LABEL[step]} could not run.`));
            try { current = normaliseRun(await prRun(current.id)); } catch { /* keep what is on screen */ }
            if (owns()) land(current);
            break;
          }
          conflicts[step] = (conflicts[step] || 0) + 1;
          if (conflicts[step] > 20) break;
          if (!owns()) return;
          current = normaliseRun(await prRun(current.id));
        }
        if (!owns()) return;
        land(current);
        step = nextAutoStep(current);
      }
    } catch (e) {
      if (owns()) setDriveErr(describeFailure(e, "The draft could not be read."));
    } finally {
      if (loopRef.current === me) {
        loopRef.current = null;
        setInFlight(null);
      }
      onRunsChanged();
    }
  }, [land, onRunsChanged]);

  // The run the route names. Steps pick back up on open only for the owner.
  useEffect(() => {
    openRef.current = runId || null;
    setRun(null);
    setRunErr(null);
    setDriveErr(null);
    setComments({});
    setOpen({});
    setVerifying(null);
    setAddingPeople(false);
    if (!runId) return;
    const attempt = session.begin("run");
    prRun(runId, { signal: attempt.signal }).then(
      (raw) => {
        if (!attempt.current() || openRef.current !== runId) return;
        const full = normaliseRun(raw);
        setRun(full);
        onRunOpened?.(full);
        if (nextAutoStep(full)) void drive(full);
      },
      (e: unknown) => {
        const message = attempt.failure(e, "This draft could not be opened.");
        if (message && openRef.current === runId) setRunErr(message);
      },
    );
    return () => {
      openRef.current = null;
      loopRef.current = null;
      setInFlight(null);
      setBusy(null);
    };
    // `drive` and `onRunOpened` are rebuilt with the workspace; only the run
    // the route names decides whether this runs again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, runId]);

  const shown = run && run.id === runId ? run : null;
  const status = shown?.status;

  // The poll below must not restart every time `drive` is rebuilt.
  const driveRef = useRef(drive);
  driveRef.current = drive;

  // Teammates (and the owner, while paused) follow the run on a timer.
  useEffect(() => {
    if (!shown || !status || !shouldPoll(status)) return;
    const id = shown.id;
    const timer = setInterval(() => {
      if (loopRef.current || openRef.current !== id) return;
      prRun(id).then((raw) => {
        if (loopRef.current || openRef.current !== id) return;
        const next = normaliseRun(raw);
        land(next);
        // Cleared by a reviewer while the owner had it open: carry on from
        // here. A run that was already writing is not restarted by the poll;
        // if its loop stopped, it stopped for a reason the screen is showing.
        if (status === "escalated" && nextAutoStep(next)) void driveRef.current(next);
      }, () => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [shown?.id, status, land]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Download menu closes on a click anywhere else, or Escape.
  useEffect(() => {
    if (!dlOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".pr-menu")) setDlOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDlOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dlOpen]);

  // An older version, when the route asks for one.
  const current = shown?.current_version ?? null;
  const wantOlder = !!shown && !!viewing && viewing !== current;
  useEffect(() => {
    setOlder(null);
    setOlderErr(null);
    if (!runId || !viewing || !wantOlder) return;
    const attempt = session.begin("version");
    prVersion(runId, viewing, { signal: attempt.signal }).then(
      (raw) => { if (attempt.current()) setOlder(normaliseVersion(raw)); },
      (e: unknown) => {
        const message = attempt.failure(e, "That version could not be opened.");
        if (message) setOlderErr(message);
      },
    );
  }, [session, runId, viewing, wantOlder]);

  // The brand card and the member list, for the card view.
  useEffect(() => {
    setCard(null);
    setCardErr(null);
    if (view.kind !== "card" || !brandId) return;
    const attempt = session.begin("card");
    Promise.all([prCard(brandId, { signal: attempt.signal }), prMembers({ signal: attempt.signal })]).then(
      ([c, m]) => {
        if (!attempt.current()) return;
        setCard(normaliseCard(c));
        setMembers(Array.isArray(m?.members) ? m.members : []);
      },
      (e: unknown) => {
        const message = attempt.failure(e, "The brand card could not be read.");
        if (message) setCardErr(message);
      },
    );
  }, [session, brandId, view.kind, cardBeat]);

  /* ------------------------------------------------------------ actions -- */

  /** One write on the open run. Resolves true when it landed; on failure it
   *  re-reads the run when the run moved, and rethrows when `rethrow` (a
   *  dialog shows the reason in place) or toasts. */
  async function act(
    key: string,
    call: () => Promise<PrRunDoc>,
    opts: {
      fallback: string;
      rethrow?: boolean;
      after?: (next: PrRunDoc, before: PrRunDoc) => void;
      /** Revise and remove-claim: one model-backed edit per run at a time.
       *  On `409 revision_running` wait `retry_after_s`, re-read, and send
       *  again — but only while the version is still the one this edit was
       *  written against; never over someone else's new text. */
      waitOnBusy?: boolean;
      /** A code this action words its own way. */
      errorText?: (code: string | null) => string | null;
    } = { fallback: "That didn't save." },
  ): Promise<boolean> {
    if (!shown) return false;
    const before = shown;
    setBusy(key);
    try {
      let raw: PrRunDoc | null = null;
      for (let waits = 0; raw === null; waits++) {
        try {
          raw = await call();
        } catch (e) {
          if (!opts.waitOnBusy || apiCode(e) !== "revision_running" || waits >= 10) throw e;
          const detail = (apiBody(e).detail ?? {}) as Record<string, unknown>;
          await sleep(retryDelayMs(detail.retry_after_s));
          if (openRef.current !== before.id) return false;
          const fresh = normaliseRun(await prRun(before.id));
          land(fresh);
          if (fresh.current_version !== before.current_version) {
            onToast("Someone else changed this draft while yours waited. Read it again, then send your change.", "warn");
            return false;
          }
        }
      }
      const next = normaliseRun(raw);
      if (land(next)) opts.after?.(next, before);
      onRunsChanged();
      return true;
    } catch (e) {
      const code = apiCode(e);
      if (code && MOVED.has(code)) {
        prRun(before.id).then((raw) => land(normaliseRun(raw)), () => undefined);
      }
      if (opts.rethrow) throw e;
      if (openRef.current === before.id) {
        const own = opts.errorText?.(code);
        if (own) onToast(own, "error");
        else fail(e, opts.fallback);
      }
      return false;
    } finally {
      if (openRef.current === before.id) setBusy(null);
    }
  }

  async function startRun() {
    if (!brand || creatingRef.current) return;
    const text = news.trim();
    if (!text) {
      setWriteErr(EMPTY_NEWS);
      return;
    }
    const { id } = brand;
    creatingRef.current = true;
    setCreating(true);
    setWriteErr(null);
    try {
      const created = normaliseRun(await prCreateRun({ brand_id: id, news: text, facts: facts.trim() || undefined }));
      setNews("");
      setFacts("");
      onRunsChanged();
      onToast("PR Writer is reading your brief. The draft fills in step by step.", "ok");
      if (brandRef.current === id) onNavigate(id, created.id);
    } catch (e) {
      setWriteErr(createErrorText(apiCode(e), e instanceof Error ? e.message : null));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function retryStep(id: PrStepId) {
    if (!shown || loopRef.current) return;
    void drive(shown, id);
  }

  async function answerClarify(mode: "answers" | "placeholders", answers: Partial<Record<PrClarifyKey, string>>, type: PrContentType) {
    await act("clarify", () => prClarify(shown!.id, mode === "answers" ? { mode, answers, content_type: type } : { mode, content_type: type }), {
      fallback: "Your details could not be saved.",
      // The answers are screened like the brief: a sensitive one comes back
      // as an escalated run (the pause card renders from it), and a screen
      // that could not run saves nothing and leaves the card open.
      errorText: (code) => (code === "screen_failed" ? CLARIFY_SCREEN_FAILED : null),
      after: (next) => { if (nextAutoStep(next)) void drive(next); },
    });
  }

  const escalate = (action: PrEscalationAction) => async (note: string) => {
    await act(`esc-${action}`, () => prEscalation(shown!.id, action, note), {
      fallback: "That could not be saved.",
      rethrow: true,
      after: (next) => {
        if (action === "clear") {
          onToast(clearedToast(next, meId), "ok");
          if (nextAutoStep(next)) void drive(next);
        }
        if (action === "withdraw") onToast("Request withdrawn. Nothing was drafted.", "ok");
        if (action === "close") onToast("Closed without drafting. The note stays on its record.", "ok");
      },
    });
  };

  async function revise(block: PrBlock) {
    const comment = (comments[block.id] ?? "").trim();
    if (!shown || !comment || busy || !shown.current_version) return;
    const ok = await act(`revise-${block.id}`, () => prRevise(shown.id, block.id, comment, shown.current_version!), {
      waitOnBusy: true,
      fallback: "The revision didn't save.",
      after: (next, before) => {
        const t = quoteResetToast(next, before.current_version);
        if (t) onToast(t, "warn");
      },
    });
    if (ok) setComments((c) => ({ ...c, [block.id]: "" }));
  }

  async function removeClaim(claim: PrClaim) {
    if (!shown?.current_version || busy) return;
    await act(`remove-${claim.id}`, () => prRemoveClaim(shown.id, claim.id, shown.current_version!), {
      waitOnBusy: true,
      fallback: "The claim could not be removed.",
      after: (next, before) => {
        const t = quoteResetToast(next, before.current_version);
        if (t) onToast(t, "warn");
      },
    });
  }

  async function sendForReview() {
    if (!shown?.current_version || busy) return;
    await act("review", () => prSendForReview(shown.id, shown.current_version!), {
      fallback: "It could not be sent for review.",
      after: (next) => onToast(`Sent for review. ${versionLabel(next.current_version || "")} is locked; reviewers can sign off now.`, "ok"),
    });
  }

  async function approve() {
    if (!shown?.signoffs.version || busy) return;
    await act("approve", () => prApprove(shown.id, shown.signoffs.version!), {
      fallback: "It could not be marked approved.",
      after: () => onToast("Approved. PR Writer never sends anything; download the final version.", "ok"),
    });
  }

  async function signOff(row: PrSignoffRow) {
    if (!shown?.signoffs.version) return;
    await act(`sign-${row.id}`, () => prSignOff(shown.id, row.id, shown.signoffs.version!), { fallback: "Your sign-off didn't save." });
  }

  async function exportRun(format: PrExportFormat) {
    if (!shown) return;
    setDlOpen(false);
    const version = viewing && viewing !== shown.current_version ? viewing : shown.current_version || "";
    try {
      const { blob, filename } = await prExport(shown.id, format, version || undefined);
      download(blob, filename || exportFilename(shown, version || "0.1", format));
    } catch (e) {
      fail(e, "The download didn't start.");
    }
  }

  /** Opens a disclosure and brings one of its rows into view. */
  function reveal(which: Disclosure, targetId?: string) {
    setOpen((o) => ({ ...o, [which]: true }));
    requestAnimationFrame(() => {
      const el = document.getElementById(targetId || `pr-${which}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  function onMarker(hit: MarkerHit, block: PrBlock) {
    if (hit.seg.kind === "verify") reveal("facts", hit.marker?.claim_id ? `pr-claim-${hit.marker.claim_id}` : undefined);
    else if (hit.seg.kind === "quote") reveal("quotes", hit.marker?.quote_id ? `pr-quote-${hit.marker.quote_id}` : undefined);
    else {
      // A [MISSING] is filled by a revision (contract §8): its row is the
      // block's own comment line.
      const input = document.getElementById(`pr-comment-${block.id}`) as HTMLInputElement | null;
      if (input) {
        input.scrollIntoView({ block: "center", behavior: "smooth" });
        input.focus({ preventScroll: true });
      } else {
        reveal("notes");
      }
    }
  }

  /* ------------------------------------------------------------- render -- */

  return (
    <div className="mr-app bw-app pr-app">
      {shown && (
        <header className="mr-top">
          <ChipView chip={runChip(chipInputOf(shown, meId))} />
          {inFlight && <span className="bw-hint"><Icon name="loader-circle" size={13} className="bw-spin" /> {STEP_LABEL[inFlight]}</span>}
        </header>
      )}

      <div className="mr-body">
        {view.kind === "drafts" && brand && (
          <DraftsList brand={brand} drafts={drafts} onOpen={(id) => onNavigate(brand.id, id)} onWrite={() => onNavigate(brand.id, "write")} />
        )}

        {view.kind === "write" && brand && (
          <div className="mr-panel pr-write">
            <div className="mr-panel__head bw-head">
              <div className="bw-head__text">
                <h2 className="mr-panel__title">Write a PR draft</h2>
                <span className="mr-panel__sub">One sentence is enough. PR Writer works out the type, angle and audience.</span>
              </div>
            </div>
            <label className="pr-form__row">
              <span>What&apos;s the news, in one sentence?</span>
              <textarea
                className="bw-topic"
                rows={3}
                value={news}
                placeholder="Legal Soft's virtual paralegals now work inside a firm's practice management system, live Nov. 12."
                onChange={(e) => { setNews(e.target.value); if (writeErr) setWriteErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void startRun(); }}
              />
            </label>
            {!brand.has_card && (
              <p className="bw-hint">{brand.name} has no brand card yet. You can still draft. Brand details will show as [VERIFY] placeholders.</p>
            )}
            <button type="button" className="bw-collapse" aria-expanded={factsOpen} onClick={() => setFactsOpen(!factsOpen)}>
              <Icon name={factsOpen ? "chevron-down" : "chevron-right"} size={14} />
              Add facts or quotes you already have (optional)
            </button>
            {factsOpen && (
              <textarea
                className="bw-topic bw-topic--notes"
                aria-label="Facts or quotes you already have"
                rows={4}
                value={facts}
                placeholder="Dates, figures and where they come from, an approved quote, the embargo time. PR Writer cites this as coming from you."
                onChange={(e) => setFacts(e.target.value)}
              />
            )}
            {writeErr && <p className="err" role="alert">{writeErr}</p>}
            <div className="pr-actions">
              <button type="button" className="bw-btn bw-btn--primary" disabled={creating} onClick={() => void startRun()}>
                {creating ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="pen-line" size={14} />}
                Start the draft
              </button>
            </div>
          </div>
        )}

        {view.kind === "card" && brand && (
          cardErr ? (
            <Oops what="The brand card could not be read." error={cardErr} onRetry={() => setCardBeat((b) => b + 1)} />
          ) : !card || !members ? (
            <Wait what={`Reading ${brand.name}'s brand card`} rows={4} />
          ) : (
            <BrandCardEditor
              key={`${brandId}-${card.revision}-${card.exists}`}
              brandId={brandId}
              brandName={brand.name}
              brandDomain={brand.domain}
              card={card}
              canEdit={card.can_edit}
              members={members}
              onSaved={(c) => { setCard(c); onRunsChanged(); }}
              onToast={onToast}
            />
          )
        )}

        {view.kind === "run" && !shown && (
          <div className="mr-panel">
            {runErr ? (
              <div className="bw-empty" role="alert">
                {runErr}{" "}
                <button type="button" className="bw-btn" onClick={() => onNavigate(brandId, "drafts")}>Back to drafts</button>
              </div>
            ) : (
              <div className="bw-empty" role="status">
                <Icon name="loader-circle" size={14} className="bw-spin" /> Opening the draft…
              </div>
            )}
          </div>
        )}

        {shown && (
          <RunView
            run={shown}
            meId={meId}
            inFlight={inFlight}
            driveErr={driveErr}
            busy={busy}
            viewing={viewing}
            older={older}
            olderErr={olderErr}
            open={open}
            setOpen={setOpen}
            comments={comments}
            setComments={setComments}
            dlOpen={dlOpen}
            setDlOpen={setDlOpen}
            onRetry={retryStep}
            onBack={() => onNavigate(brandId, "drafts")}
            onClarify={(answers, type) => void answerClarify("answers", answers, type)}
            onSkipClarify={(type) => void answerClarify("placeholders", {}, type)}
            onEscalation={escalate}
            onRevise={(b) => void revise(b)}
            onVerify={(c) => setVerifying(c)}
            onRemoveClaim={(c) => void removeClaim(c)}
            onSendForReview={() => void sendForReview()}
            onExport={(f) => void exportRun(f)}
            onAddPeople={() => setAddingPeople(true)}
            onViewVersion={onViewVersion}
            onSignOff={(row) => void signOff(row)}
            onApprove={() => void approve()}
            onAskChanges={async (row, note) => {
              await act(`ask-${row.id}`, () => prAskChanges(shown.id, row.id, shown.signoffs.version || "", note), { fallback: "That didn't save.", rethrow: true });
            }}
            onRecordQuote={async (row, evidence) => {
              const quoteId = row.id.startsWith("quote:") ? row.id.slice(6) : row.id;
              // The approval binds to the text the reader saw: a quote edited
              // since answers 409 stale_version instead of approving new words.
              const quote = shown.draft?.quotes.find((q) => q.id === quoteId);
              await act(`quote-${quoteId}`, () => prRecordQuote(shown.id, quoteId, evidence, quote?.text_hash || ""), {
                fallback: "That didn't save.", rethrow: true,
              });
            }}
            onReveal={reveal}
            onMarker={onMarker}
          />
        )}
      </div>

      {verifying && shown && (
        <NoteDialog
          title="Mark this fact verified"
          sub={verifying.text}
          warning={resignWarning(shown)}
          value={verifying.placeholder ? {
            label: "The confirmed value",
            placeholder: "More than 500 law firms",
            hint: "It replaces the placeholder wherever the draft prints it.",
          } : undefined}
          label="Source or who confirmed it"
          placeholder="Confirmed by Priya from the October CRM export."
          verb="Mark verified"
          onSubmit={async (note, value) => {
            const version = shown.current_version || "";
            await act(`verify-${verifying.id}`, () => prVerifyClaim(shown.id, verifying.id, {
              version, note, ...(verifying.placeholder ? { value } : {}),
            }), { fallback: "That didn't save.", rethrow: true });
            setVerifying(null);
          }}
          onCancel={() => setVerifying(null)}
        />
      )}
      {addingPeople && shown && (
        <AddPeopleDialog
          run={shown}
          onSubmit={async (ids) => {
            await act("people", () => prAddPeople(shown.id, ids), {
              fallback: "Nobody was added.",
              rethrow: true,
              after: () => onToast(ids.length === 1 ? "Added. They can read and download this draft." : `${ids.length} people added. They can read and download this draft.`, "ok"),
            });
            setAddingPeople(false);
          }}
          onCancel={() => setAddingPeople(false)}
        />
      )}
    </div>
  );
}

/* ============================================================ DraftsList == */

function DraftsList({ brand, drafts, onOpen, onWrite }: {
  brand: PrBrand;
  drafts: PrRunSummary[];
  onOpen: (runId: string) => void;
  onWrite: () => void;
}) {
  const groups = groupRuns(drafts);
  const sets: [string, PrRunSummary[]][] = [
    ["Waiting on you", groups.waiting],
    ["Yours", groups.yours],
    ["Shared with you", groups.shared],
  ];
  return (
    <div className="mr-panel">
      <div className="mr-panel__head bw-head">
        <div className="bw-head__text">
          <h2 className="mr-panel__title">PR drafts for {brand.name}</h2>
        </div>
        <button type="button" className="bw-btn bw-btn--primary" onClick={onWrite}>
          <Icon name="pen-line" size={14} /> Write a PR draft
        </button>
      </div>
      {drafts.length === 0 ? (
        <div className="bw-empty">
          No PR drafts for {brand.name} yet. Write one sentence about the news; PR Writer researches, drafts and packages it for review.
        </div>
      ) : (
        <div className="bw-runs">
          {sets.map(([label, rows]) => rows.length > 0 && (
            <Fragment key={label}>
              <span className="bw-runs__label">{label}</span>
              {rows.map((r) => {
                const chip = runChip(r);
                return (
                  <button type="button" key={r.id} className="bw-runrow" onClick={() => onOpen(r.id)}>
                    <span className="bw-runrow__main">
                      <span className="bw-runrow__topic">{rowTitle(r)}</span>
                      <span className="bw-runrow__meta">{rowMeta(r)}</span>
                    </span>
                    <ChipView chip={chip} />
                  </button>
                );
              })}
            </Fragment>
          ))}
          <p className="bw-hint pr-foot">You see drafts you started, review, or were added to.</p>
        </div>
      )}
    </div>
  );
}

/* =============================================================== RunView == */

interface RunViewProps {
  run: PrRunDoc;
  meId: string;
  inFlight: PrStepId | null;
  driveErr: string | null;
  busy: string | null;
  viewing: string | null;
  older: PrVersion | null;
  olderErr: string | null;
  open: Partial<Record<Disclosure, boolean>>;
  setOpen: (fn: (o: Partial<Record<Disclosure, boolean>>) => Partial<Record<Disclosure, boolean>>) => void;
  comments: Record<string, string>;
  setComments: (fn: (c: Record<string, string>) => Record<string, string>) => void;
  dlOpen: boolean;
  setDlOpen: (v: boolean) => void;
  onRetry: (id: PrStepId) => void;
  onBack: () => void;
  onClarify: (answers: Partial<Record<PrClarifyKey, string>>, type: PrContentType) => void;
  onSkipClarify: (type: PrContentType) => void;
  onEscalation: (action: PrEscalationAction) => (note: string) => Promise<void>;
  onRevise: (block: PrBlock) => void;
  onVerify: (claim: PrClaim) => void;
  onRemoveClaim: (claim: PrClaim) => void;
  onSendForReview: () => void;
  onExport: (format: PrExportFormat) => void;
  onAddPeople: () => void;
  onViewVersion: (version: string | null) => void;
  onSignOff: (row: PrSignoffRow) => void;
  onApprove: () => void;
  onAskChanges: (row: PrSignoffRow, note: string) => Promise<void>;
  onRecordQuote: (row: PrSignoffRow, evidence: string) => Promise<void>;
  onReveal: (which: Disclosure, targetId?: string) => void;
  onMarker: (hit: MarkerHit, block: PrBlock) => void;
}

function RunView(p: RunViewProps) {
  const { run, meId, busy } = p;
  const owner = isOwner(run, meId);
  const terminal = run.status === "withdrawn" || run.status === "closed";
  const pipeline = run.status === "writing" || run.status === "step_failed" || run.status === "needs_details";
  const lines = stepLines(run, p.inFlight);
  const partial = researchPartialNote(run);
  const stopped = stoppedLine(run, meId);
  const hasError = lines.some((l) => l.state === "failed");

  /* ------------------------------------------------- escalation / closed -- */
  if (run.status === "escalated" && run.escalation) {
    return (
      <EscalationCard
        run={run}
        seat={escalationSeat(run, meId)}
        onClear={p.onEscalation("clear")}
        onKeepPaused={p.onEscalation("keep-paused")}
        onCloseRun={p.onEscalation("close")}
        onWithdraw={p.onEscalation("withdraw")}
        onAddNote={p.onEscalation("notes")}
      />
    );
  }

  if (terminal) {
    return (
      <div className="mr-panel">
        <div className="mr-panel__head bw-head">
          <div className="bw-head__text">
            <h2 className="mr-panel__title">{run.news}</h2>
            <span className="mr-panel__sub">
              {run.status === "withdrawn" ? "Withdrawn. Nothing was drafted." : "Closed without drafting."}
            </span>
          </div>
        </div>
        {run.escalation && run.escalation.notes.length > 0 && (
          <ul className="pr-record">
            {run.escalation.notes.map((n, i) => <li key={i}>{escalationRecordLine(n)}</li>)}
          </ul>
        )}
      </div>
    );
  }

  const doc = p.viewing && p.viewing !== run.current_version ? p.older : run.draft;
  const viewingOlder = !!p.viewing && p.viewing !== run.current_version;
  const viewedSummary = viewingOlder ? run.versions.find((v) => v.version === p.viewing) : undefined;

  return (
    <>
      {/* -------------------------------------------------- the pipeline -- */}
      {pipeline && (
        <div className="mr-panel">
          <div className="mr-panel__head bw-head">
            <div className="bw-head__text">
              <h2 className="mr-panel__title">{run.news}</h2>
              <span className="mr-panel__sub">{LEAVE_HINT}</span>
            </div>
          </div>
          <StepList steps={lines} onRetry={run.can.run_steps && !p.inFlight ? p.onRetry : undefined}>
            {partial && <p className="bw-note">{partial}</p>}
            {stopped && <p className="bw-hint">{stopped}</p>}
            {p.driveErr && <p className="err" role="alert">{p.driveErr}</p>}
            {run.escalation?.state === "cleared" && run.escalation.notes
              .filter((n) => n.kind === "clear")
              .map((n, i) => <p key={i} className="bw-hint">{escalationRecordLine(n)}</p>)}
            {hasError && !run.draft && (
              <div className="pr-actions">
                <button type="button" className="bw-btn" onClick={p.onBack}>Back to drafts</button>
              </div>
            )}
          </StepList>
        </div>
      )}

      {run.status === "needs_details" && run.clarify?.state === "open" && (
        run.can.answer_clarify ? (
          <ClarifyCard
            clarify={run.clarify}
            busy={busy === "clarify"}
            onSubmit={p.onClarify}
            onSkip={p.onSkipClarify}
          />
        ) : (
          <div className="mr-panel"><p className="bw-hint">Waiting for {run.owner.name} to add a few details.</p></div>
        )
      )}

      {/* ---------------------------------------------------- the package -- */}
      {run.draft && (
        <>
          {viewingOlder && (
            p.olderErr ? (
              <Oops what="That version could not be opened." error={p.olderErr} actions={
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => p.onViewVersion(null)}>Open the current version</button>
              } />
            ) : !doc ? (
              <Wait what={`Opening ${versionLabel(p.viewing || "")}`} />
            ) : null
          )}
          {doc && (
            <PackageView {...p} doc={doc} viewingOlder={viewingOlder} viewedSummary={viewedSummary} owner={owner} />
          )}
        </>
      )}
    </>
  );
}

/* =========================================================== PackageView == */

function PackageView(p: RunViewProps & {
  doc: PrVersion;
  viewingOlder: boolean;
  viewedSummary: PrRunDoc["versions"][number] | undefined;
  owner: boolean;
}) {
  const { run, doc, busy, open, setOpen } = p;
  const editable = !p.viewingOlder && run.can.revise;
  const recommended = doc.headlines.find((h) => h.recommended) ?? doc.headlines[0];
  const others = doc.headlines.filter((h) => h !== recommended);
  const markers = p.viewingOlder
    ? {
      verify: doc.markers.filter((m) => m.kind === "verify" && !m.resolved).length,
      missing: doc.markers.filter((m) => m.kind === "missing").length,
      pending_quotes: doc.markers.filter((m) => m.kind === "quote_pending" && !m.resolved).length,
    }
    : run.markers;
  const statusLabel = p.viewingOlder
    ? `${p.viewedSummary?.locked ? "Locked" : "Earlier"} ${versionLabel(doc.version)}`
    : versionStatusLabel(run);
  const banner = p.viewingOlder && p.viewedSummary ? lockedBanner(p.viewedSummary, run.current_version) : null;
  const pkg = run.package;
  const failedSections = pkg ? (Object.keys(SECTION_NAME) as PrPackageSection[]).filter((k) => pkg.sections[k].state === "failed") : [];
  const toVerify = doc.claims.filter((c) => c.status === "needs_confirmation").length;
  const pendingQuotes = doc.quotes.filter((q) => q.approval.state === "pending").length;
  const toggle = (k: Disclosure) => (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = e.currentTarget.open;
    setOpen((o) => (!!o[k] === isOpen ? o : { ...o, [k]: isOpen }));
  };

  return (
    <>
      {/* ------------------------------------------------------- cover -- */}
      <div className="mr-panel pr-cover">
        <div className="mr-panel__head bw-head">
          <div className="bw-head__text">
            {statusLabel && <span className={`bw-status${run.status === "approved" && !p.viewingOlder ? " pr-status--ok" : ""}`}>{statusLabel}</span>}
            <h2 className="mr-panel__title pr-cover__title">{recommended?.text || run.news}</h2>
            <span className="mr-panel__sub">{coverStory(run, doc.news_angle)}</span>
            <span className="mr-panel__sub">{coverCounts(markers)}</span>
            {run.escalation?.state === "cleared" && run.escalation.notes
              .filter((n) => n.kind === "clear")
              .map((n, i) => <span key={i} className="bw-hint">{escalationRecordLine(n)}</span>)}
          </div>
        </div>
        {coverChips(markers).length > 0 && (
          <div className="pr-chips">
            {coverChips(markers).map((c) => (
              <button
                key={c.key}
                type="button"
                className={`bw-chip pr-chip--${c.tone === "missing" ? "missing" : c.tone}`}
                onClick={() => {
                  if (c.key === "verify") p.onReveal("facts");
                  else if (c.key === "quotes") p.onReveal("quotes");
                  else document.querySelector<HTMLElement>("[data-marker='missing']")?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
              >
                {c.text}
              </button>
            ))}
          </div>
        )}
        <div className="pr-actions">
          {run.can.send_for_review && !p.viewingOlder && (
            <button type="button" className="bw-btn bw-btn--primary" disabled={!!busy} onClick={p.onSendForReview}>
              {busy === "review" ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="lock" size={14} />}
              Send for review
            </button>
          )}
          {run.can.export && (
            <span className="pr-menu">
              <button type="button" className="bw-btn" aria-expanded={p.dlOpen} aria-haspopup="menu" onClick={() => p.setDlOpen(!p.dlOpen)}>
                <Icon name="download" size={14} /> Download
              </button>
              {p.dlOpen && (
                <span className="pr-menu__list" role="menu">
                  <button type="button" role="menuitem" className="bw-btn" onClick={() => p.onExport("docx")}>.docx</button>
                  <button type="button" role="menuitem" className="bw-btn" onClick={() => p.onExport("md")}>Markdown</button>
                </span>
              )}
            </span>
          )}
          {run.can.add_people && (
            <button type="button" className="bw-btn" onClick={p.onAddPeople}>
              <Icon name="users" size={14} /> Add people
            </button>
          )}
        </div>
        {run.versions.length > 0 && (
          <details className="bw-ledger" open={!!open.versions} onToggle={toggle("versions")}>
            <summary>Versions ({run.versions.length})</summary>
            <VersionList versions={run.versions} viewing={p.viewing} current={run.current_version} onView={p.onViewVersion} />
          </details>
        )}
      </div>

      {/* ------------------------------------------------------- draft -- */}
      <div className="mr-panel pr-draft">
        {banner && (
          <div className="bw-hint pr-banner">
            <Icon name="lock" size={13} /> {banner.text}{" "}
            {banner.link && <button type="button" className="pr-link" onClick={() => p.onViewVersion(null)}>{banner.link}</button>}
          </div>
        )}
        {(others.length > 0 || doc.subheadline.alternate) && (
          <details className="bw-ledger" open={!!open.headlines} onToggle={toggle("headlines")}>
            <summary>{others.length === 1 ? "1 other headline" : `${others.length} other headlines`}</summary>
            <ul className="pr-list">
              {others.map((h, i) => <li key={i}>{h.text} <em className="pr-meta">{h.chars} characters</em></li>)}
              {doc.subheadline.alternate && (
                <li><em className="pr-meta">Alternate subheadline</em> {doc.subheadline.alternate}</li>
              )}
            </ul>
          </details>
        )}
        <div className="bw-blocks">
          {doc.blocks.map((block) => (
            <div key={block.id} className={`bw-block pr-block pr-block--${block.kind}`}>
              <p className="bw-block__text">
                <PrMarkerText
                  text={block.text}
                  blockId={block.id}
                  markers={doc.markers}
                  quotes={doc.quotes}
                  onMarker={(hit) => p.onMarker(hit, block)}
                />
              </p>
              {block.kind === "quote" && block.quote_id && (() => {
                const q = doc.quotes.find((x) => x.id === block.quote_id);
                const line = q ? quoteResetLine(q) : null;
                return line ? <p className="bw-note">{line}</p> : null;
              })()}
              {editable && block.revisable && (
                <div className="bw-block__commentrow">
                  <input
                    id={`pr-comment-${block.id}`}
                    className="bw-comment"
                    aria-label={`Ask for a change to this ${block.kind.replace(/_/g, " ")}`}
                    placeholder="Ask for a change: tighten, reframe, fix a fact…"
                    value={p.comments[block.id] ?? ""}
                    onChange={(e) => p.setComments((c) => ({ ...c, [block.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") p.onRevise(block); }}
                  />
                  <button
                    type="button"
                    className="bw-btn"
                    disabled={!!busy || !(p.comments[block.id] ?? "").trim()}
                    onClick={() => p.onRevise(block)}
                  >
                    {busy === `revise-${block.id}` ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="corner-down-left" size={14} />}
                    Revise
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------- sign-off -- */}
      {!p.viewingOlder && (
        <SignoffPanel
          signoffs={run.signoffs}
          busy={busy}
          canApprove={run.can.approve}
          onApprove={p.onApprove}
          onSignOff={p.onSignOff}
          onAskChanges={p.onAskChanges}
          onRecordQuote={p.onRecordQuote}
          onShowFacts={() => p.onReveal("facts")}
          onShowQuotes={() => p.onReveal("quotes")}
        />
      )}

      {/* ------------------------------------------- everything else -- */}
      <div className="mr-panel pr-package">
        <div className="mr-panel__head">
          <h2 className="mr-panel__title">Everything else in the package</h2>
          {pkg && pkg.based_on_version && pkg.based_on_version !== doc.version && (
            <span className="mr-panel__sub">Built on {versionLabel(pkg.based_on_version)}.</span>
          )}
        </div>

        <details className="bw-ledger" id="pr-quotes" tabIndex={-1} open={!!open.quotes} onToggle={toggle("quotes")}>
          <summary>Quotes ({pendingQuotes} pending)</summary>
          {doc.quotes.length === 0 ? <p className="bw-hint">No quotes in this version.</p> : (
            <ul className="pr-list">
              {doc.quotes.map((q) => {
                const reset = quoteResetLine(q);
                return (
                  <li key={q.id} id={`pr-quote-${q.id}`} tabIndex={-1} className="pr-quote">
                    <blockquote>{q.text}</blockquote>
                    <span className="pr-meta">
                      {q.speaker_name}{q.speaker_title ? `, ${q.speaker_title}` : ""}{q.organization ? `, ${q.organization}` : ""}
                    </span>
                    <span className={`bw-chip pr-chip--${q.approval.state === "approved" ? "ok" : "neutral"}`}>
                      {q.approval.state === "approved"
                        ? `Approved by ${speakerName(q.speaker_name)}${q.approval.at ? `, ${apDate(q.approval.at)}` : ""}`
                        : `Waiting for ${speakerName(q.speaker_name)}'s approval`}
                    </span>
                    {q.approval.evidence && <span className="pr-meta">{q.approval.evidence}</span>}
                    {reset && <span className="bw-note">{reset}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </details>

        <details className="bw-ledger" id="pr-facts" tabIndex={-1} open={!!open.facts} onToggle={toggle("facts")}>
          <summary>Fact-check ({doc.claims.length} claim{doc.claims.length === 1 ? "" : "s"}, {toVerify} to verify)</summary>
          {doc.claims.length === 0 ? <p className="bw-hint">No claims in this version.</p> : (
            <ol className="pr-claims">
              {doc.claims.map((c) => (
                <li key={c.id} id={`pr-claim-${c.id}`} tabIndex={-1} className={`pr-claim pr-claim--${c.status}`}>
                  <span className="pr-claim__text">{c.n ? `${c.n}. ` : ""}{c.text}</span>
                  <span className="pr-meta">
                    {c.source.url
                      ? <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.label || c.source.url}</a>
                      : c.source.label || "No source"}
                    {c.source.date ? ` · ${c.source.date}` : ""}
                    {c.owner_to_confirm ? ` · ${c.owner_to_confirm} to confirm` : ""}
                  </span>
                  {c.status_reason && <span className="pr-meta">{c.status_reason}</span>}
                  <span className={`bw-chip pr-chip--${c.status === "verified" ? "ok" : c.status === "needs_confirmation" ? "warn" : c.status === "removed" ? "muted" : "neutral"}`}>
                    {c.status === "verified" ? "Verified" : c.status === "needs_confirmation" ? "To verify" : c.status === "removed" ? "Removed" : "Sourced"}
                  </span>
                  {c.verified && (
                    <span className="pr-meta">Verified by {c.verified.by.name}{c.verified.at ? `, ${apDate(c.verified.at)}` : ""}: {c.verified.note}</span>
                  )}
                  {!p.viewingOlder && run.can.revise && c.status !== "removed" && (
                    <span className="pr-actions">
                      {c.status !== "verified" && (
                        <button type="button" className="bw-btn" disabled={!!busy} onClick={() => p.onVerify(c)}>
                          <Icon name="check" size={14} /> Mark verified
                        </button>
                      )}
                      {!c.placeholder && c.block_id && (
                        <button type="button" className="bw-btn" disabled={!!busy} onClick={() => p.onRemoveClaim(c)}>
                          {busy === `remove-${c.id}` ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="x" size={14} />}
                          Remove this claim
                        </button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </details>

        <details className="bw-ledger" id="pr-notes" tabIndex={-1} open={!!open.notes} onToggle={toggle("notes")}>
          <summary>Reviewer notes ({pkg?.reviewer_notes?.length ?? 0})</summary>
          <PackagePart section="reviewer_notes" run={run} owner={p.owner} onRetry={p.onRetry}>
            {pkg?.reviewer_notes && (pkg.reviewer_notes.length === 0 ? <p className="bw-hint">Nothing to flag.</p> : (
              <ul className="pr-list">{pkg.reviewer_notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul>
            ))}
          </PackagePart>
        </details>

        <details className="bw-ledger" open={!!open.angle} onToggle={toggle("angle")}>
          <summary>News angle</summary>
          <p className="pr-prose">{doc.news_angle || "No news angle in this version."}</p>
        </details>

        <details className="bw-ledger" open={!!open.seo} onToggle={toggle("seo")}>
          <summary>SEO</summary>
          <PackagePart section="seo" run={run} owner={p.owner} onRetry={p.onRetry}>
            {pkg?.seo && (
              <dl className="pr-dl">
                <dt>Primary keyword</dt><dd>{pkg.seo.primary_keyword}</dd>
                {pkg.seo.secondary_keywords.length > 0 && (<><dt>Secondary keywords</dt><dd>{pkg.seo.secondary_keywords.join(", ")}</dd></>)}
                <dt>SEO title</dt><dd>{pkg.seo.seo_title}</dd>
                <dt>Meta description</dt><dd>{pkg.seo.meta_description}</dd>
                <dt>Slug</dt><dd>{pkg.seo.slug}</dd>
                {pkg.seo.internal_links.length > 0 && (<><dt>Internal links</dt><dd>
                  {pkg.seo.internal_links.map((l, i) => <span key={i} className="pr-dl__line">{l.anchor ? `${l.anchor} · ` : ""}{l.url}</span>)}
                </dd></>)}
                {pkg.seo.external_link && (<><dt>External link</dt><dd>{pkg.seo.external_link.url}{pkg.seo.external_link.why ? ` · ${pkg.seo.external_link.why}` : ""}</dd></>)}
                {pkg.seo.images.length > 0 && (<><dt>Images</dt><dd>
                  {pkg.seo.images.map((im, i) => <span key={i} className="pr-dl__line">{im.description} · Alt text: {im.alt_text}</span>)}
                </dd></>)}
                {pkg.seo.social_summary && (<><dt>Social summary</dt><dd>{pkg.seo.social_summary}</dd></>)}
                {pkg.seo.hashtags.length > 0 && (<><dt>Hashtags</dt><dd>{pkg.seo.hashtags.join(" ")}</dd></>)}
              </dl>
            )}
          </PackagePart>
        </details>

        <details className="bw-ledger" open={!!open.distribution} onToggle={toggle("distribution")}>
          <summary>Distribution plan</summary>
          <PackagePart section="distribution" run={run} owner={p.owner} onRetry={p.onRetry}>
            {pkg?.distribution && (
              <>
                <ul className="pr-list">
                  {pkg.distribution.channels.map((c, i) => (
                    <li key={i}>
                      <b>{c.channel}</b>{c.timing ? ` · ${c.timing}` : ""}{c.why ? ` · ${c.why}` : ""}
                      {c.pitch_angle && <span className="pr-dl__line pr-meta">Angle: {c.pitch_angle}</span>}
                      {(c.reporter_beat || c.outlet_examples.length > 0) && (
                        <span className="pr-dl__line pr-meta">
                          {[c.reporter_beat && `Beat: ${c.reporter_beat}`, c.outlet_examples.length > 0 && `For example ${c.outlet_examples.join(", ")}`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {(pkg.distribution.wire.circuit || pkg.distribution.wire.notes) && (
                  <p className="pr-prose">
                    Wire: {pkg.distribution.wire.recommended ? "recommended" : "not recommended"}
                    {[pkg.distribution.wire.circuit, pkg.distribution.wire.timing, pkg.distribution.wire.notes].filter(Boolean).map((x) => ` · ${x}`).join("")}
                  </p>
                )}
                {pkg.distribution.embargo_notes && <p className="pr-prose">Embargo: {pkg.distribution.embargo_notes}</p>}
                <p className="bw-hint">PR Writer never sends anything. This is the plan for your team.</p>
              </>
            )}
          </PackagePart>
        </details>

        <details className="bw-ledger" open={!!open.snippets} onToggle={toggle("snippets")}>
          <summary>Social and pitch snippets</summary>
          <PackagePart section="snippets" run={run} owner={p.owner} onRetry={p.onRetry}>
            {pkg?.snippets && (
              <dl className="pr-dl">
                <dt>LinkedIn post</dt><dd className="pr-prose">{pkg.snippets.linkedin_post}</dd>
                <dt>Social summary</dt><dd className="pr-prose">{pkg.snippets.social_summary}</dd>
                <dt>Reporter pitch</dt><dd className="pr-prose">{pkg.snippets.reporter_pitch}</dd>
              </dl>
            )}
          </PackagePart>
        </details>

        {failedSections.length > 0 && !p.owner && (
          <p className="bw-hint">{failedSections.length === 1 ? "One part" : `${failedSections.length} parts`} of the package weren&apos;t generated. {run.owner.name} can try them again.</p>
        )}
      </div>
    </>
  );
}

/** One package section: its body, "still being built", or "{Section} wasn't
 *  generated." with Try again for the owner. SEO, distribution and snippets
 *  retry with POST /steps/package (only the failed sections re-run); reviewer
 *  notes are their own step. */
function PackagePart({ section, run, owner, onRetry, children }: {
  section: PrPackageSection;
  run: PrRunDoc;
  owner: boolean;
  onRetry: (id: PrStepId) => void;
  children: React.ReactNode;
}) {
  const pkg = run.package;
  const stepId = sectionStep(section);
  const step = run.steps.find((s) => s.id === stepId);
  if (!pkg || pkg.sections[section].state === "pending") {
    return <p className="bw-hint">{step?.state === "running" ? "Still being built." : "Not built yet."}</p>;
  }
  if (pkg.sections[section].state === "failed") {
    return (
      <div className="pr-failed">
        <p>{SECTION_NAME[section]} wasn&apos;t generated.</p>
        {owner && (
          <button type="button" className="bw-btn" onClick={() => onRetry(stepId)}>
            <Icon name="refresh-cw" size={14} /> Try again
          </button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
