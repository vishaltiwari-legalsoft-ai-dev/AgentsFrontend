"use client";

/** PR Writer's own pieces, each one drawn from what the run says and acting
 *  only through the callbacks it is given. None of them fetches or decides
 *  permissions: the server's `can` flags and `viewer_can_act` arrive as props,
 *  and every sentence comes from `components/hub/work/pr.ts`. */

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  prMembers,
  type PrClarify, type PrClarifyKey, type PrContentType, type PrMarker, type PrMember, type PrQuote,
  type PrRun, type PrSignoffRow, type PrSignoffs, type PrVersionSummary,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { describeFailure } from "@/lib/load";
import { andList } from "@/components/hub/model";
import {
  APPROVED_LINE, blockerSentence, escalationRecordLine, markerChip, markerFor, parseMarkers,
  signoffRowLabel, signoffStateText, signoffTone, speakerName, versionRow,
  type EscalationSeat, type MarkerSegment, type StepLine,
} from "@/components/hub/work/pr";

export const NOTE_REQUIRED = "Write why. It stays on the draft's record.";
export const VALUE_REQUIRED = "Write the confirmed value. It replaces the placeholder in the draft.";

/* ============================================================ NoteDialog == */

export interface NoteDialogProps {
  title: string;
  label: string;
  placeholder: string;
  verb: string;
  /** A line under the title, when the dialog needs one. */
  sub?: string;
  /** Withdraw is the one write whose note may be empty. */
  optional?: boolean;
  /** A consequence to read before confirming (amber, above the field). */
  warning?: string | null;
  /** A second, required field before the note — a placeholder's value. */
  value?: { label: string; placeholder: string; hint?: string };
  /** "warn" draws the dialog's own messages amber instead of red: inside the
   *  escalation pause nothing is an alarm. */
  tone?: "warn";
  /** Throws to keep the dialog open with the reason; resolves to close it. */
  onSubmit: (note: string, value: string) => Promise<void>;
  onCancel: () => void;
}

/** One required note, on the record. Mounted only while open; the caller
 *  unmounts it when `onSubmit` resolves. */
export function NoteDialog({
  title, label, placeholder, verb, sub, optional, warning, value, tone, onSubmit, onCancel,
}: NoteDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [val, setVal] = useState("");
  const msgClass = tone === "warn" ? "pr-warnmsg" : "err";
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    const t = setTimeout(() => (valueRef.current ?? area.current)?.focus(), 40);
    return () => {
      clearTimeout(t);
      if (el?.open) el.close();
    };
  }, []);

  async function submit() {
    const note = text.trim();
    const v = val.trim();
    if (value && !v) {
      setErr(VALUE_REQUIRED);
      valueRef.current?.focus();
      return;
    }
    if (!note && !optional) {
      setErr(NOTE_REQUIRED);
      area.current?.focus();
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(note, v);
    } catch (e) {
      setErr(describeFailure(e, "That could not be saved. Nothing was changed."));
      setBusy(false);
    }
  }

  return (
    <dialog
      className="dialog"
      ref={ref}
      aria-labelledby="pr-note-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
    >
      <h2 id="pr-note-title">{title}</h2>
      {sub && <p>{sub}</p>}
      {warning && <p className="pr-warnmsg pr-warnmsg--box">{warning}</p>}
      {value && (
        <label className="field">
          <span>{value.label}</span>
          <input
            ref={valueRef}
            className="pr-input"
            value={val}
            placeholder={value.placeholder}
            onChange={(e) => { setVal(e.target.value); if (err) setErr(null); }}
          />
          {value.hint && <span className="hint">{value.hint}</span>}
        </label>
      )}
      <label className="field">
        <span>{label}</span>
        <textarea
          ref={area}
          rows={3}
          value={text}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); if (err) setErr(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit(); }}
        />
        {err && <p className={msgClass} role="alert">{err}</p>}
      </label>
      <div className="dialog__actions">
        <button type="button" className="btn btn--quiet" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn--mark" onClick={() => void submit()} disabled={busy}>
          {busy ? "Saving…" : verb}
        </button>
      </div>
    </dialog>
  );
}

/* ======================================================= AddPeopleDialog == */

/** "Add people": workspace members who are not on the run yet. They can read
 *  and download the draft; they get no write actions (contract §2.3). */
export function AddPeopleDialog({ run, onSubmit, onCancel }: {
  run: PrRun;
  onSubmit: (userIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [members, setMembers] = useState<PrMember[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    let dead = false;
    prMembers().then(
      (r) => { if (!dead) setMembers(Array.isArray(r?.members) ? r.members : []); },
      (e: unknown) => { if (!dead) { setMembers([]); setLoadErr(describeFailure(e, "The member list could not be read.")); } },
    );
    return () => {
      dead = true;
      if (el?.open) el.close();
    };
  }, []);

  const on = new Set(run.participants.map((p) => p.user.id));
  const offered = (members || []).filter((m) => !on.has(m.id));

  async function submit() {
    if (!picked.size) {
      setErr("Pick at least one person.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit([...picked]);
    } catch (e) {
      setErr(describeFailure(e, "Nobody was added."));
      setBusy(false);
    }
  }

  return (
    <dialog className="dialog" ref={ref} aria-labelledby="pr-people-title" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id="pr-people-title">Add people</h2>
      <p>They can read and download this draft. Sign-off stays with the reviewers named on it.</p>
      {members === null ? (
        <p className="wait"><i className="wait__spin" aria-hidden="true" />Reading the members…</p>
      ) : loadErr ? (
        <p className="err">{loadErr}</p>
      ) : offered.length === 0 ? (
        <p className="bw-hint">Everyone in the workspace is already on this draft.</p>
      ) : (
        <fieldset className="pr-people">
          <legend className="pr-sr">Members</legend>
          {offered.map((m) => (
            <label key={m.id} className="pr-people__row">
              <input
                type="checkbox"
                checked={picked.has(m.id)}
                onChange={(e) => setPicked((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(m.id); else next.delete(m.id);
                  return next;
                })}
              />
              <span><b>{m.name}</b> <em>{m.email}</em></span>
            </label>
          ))}
        </fieldset>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="dialog__actions">
        <button type="button" className="btn btn--quiet" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn--mark" onClick={() => void submit()} disabled={busy || !offered.length}>
          {busy ? "Adding…" : "Add to this draft"}
        </button>
      </div>
    </dialog>
  );
}

/* ============================================================== StepList == */

const STEP_ICON: Record<StepLine["state"], { name: string; spin?: boolean }> = {
  pending: { name: "circle" },
  running: { name: "loader-circle", spin: true },
  done: { name: "check" },
  partial: { name: "check" },
  failed: { name: "alert-triangle" },
};

/** The five visible steps. A failed step is the only red on the page, and it
 *  says what happened and how to go on. */
export function StepList({ steps, onRetry, children }: {
  steps: StepLine[];
  /** Offered on a failed step when this viewer may run it. */
  onRetry?: (id: StepLine["id"]) => void;
  /** Notes under the list: the partial-research warning, a stopped line. */
  children?: ReactNode;
}) {
  return (
    <div className="pr-steps">
      <ol className="pr-steps__list">
        {steps.map((s) => {
          const ic = STEP_ICON[s.state];
          return (
            <li key={s.id} className={`pr-step pr-step--${s.state}`} aria-current={s.state === "running" ? "step" : undefined}>
              <Icon name={ic.name} size={15} className={ic.spin ? "bw-spin pr-step__ic" : "pr-step__ic"} />
              <span className="pr-step__body">
                <b className="pr-step__label">{s.label}</b>
                {s.result && <span className="pr-step__result">{s.result}</span>}
                {s.error && <span className="err pr-step__err" role="alert">{s.error}</span>}
                {s.error && onRetry && (
                  <span className="pr-step__acts">
                    <button type="button" className="bw-btn" onClick={() => onRetry(s.id)}>
                      <Icon name="refresh-cw" size={14} /> Try {s.label.toLowerCase()} again
                    </button>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {children}
    </div>
  );
}

/* ============================================================ ClarifyCard == */

/** Once, after the screen step: only the fields intake found missing, each
 *  pre-filled with the agent's guess. Either button closes it for good. */
export function ClarifyCard({ clarify, busy, onSubmit, onSkip }: {
  clarify: PrClarify;
  busy: boolean;
  onSubmit: (answers: Partial<Record<PrClarifyKey, string>>, contentType: PrContentType) => void;
  onSkip: (contentType: PrContentType) => void;
}) {
  const [answers, setAnswers] = useState<Partial<Record<PrClarifyKey, string>>>(() =>
    Object.fromEntries(clarify.fields.map((f) => [f.key, f.answer ?? f.guess ?? ""])));
  const [type, setType] = useState<PrContentType>(clarify.content_type.value);
  // Which button sent the card, so its own spinner turns, not the other's.
  const [pressed, setPressed] = useState<"answers" | "placeholders" | null>(null);
  const options = clarify.content_type.options.length
    ? clarify.content_type.options
    : [{ value: clarify.content_type.value, label: clarify.content_type.value.replace(/_/g, " ") }];

  return (
    <div className="mr-panel pr-clarify">
      <div className="mr-panel__head bw-head">
        <div className="bw-head__text">
          <h2 className="mr-panel__title">A few details would make this draft real</h2>
          <span className="mr-panel__sub">Anything you leave blank becomes a [VERIFY] placeholder you can fill in later.</span>
        </div>
      </div>
      <form
        className="pr-form"
        onSubmit={(e) => { e.preventDefault(); if (!busy) { setPressed("answers"); onSubmit(answers, type); } }}
      >
        <label className="pr-form__row">
          <span>Content type</span>
          <select className="pr-input" value={type} onChange={(e) => setType(e.target.value as PrContentType)} disabled={busy}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {clarify.fields.map((f) => (
          <label key={f.key} className="pr-form__row">
            <span>{f.label}</span>
            <input
              className="pr-input"
              value={answers[f.key] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
              disabled={busy}
            />
          </label>
        ))}
        <div className="pr-actions">
          <button type="submit" className="bw-btn bw-btn--primary" disabled={busy}>
            {busy && pressed !== "placeholders" ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="pen-line" size={14} />}
            Draft with these
          </button>
          <button type="button" className="bw-btn" disabled={busy} onClick={() => { setPressed("placeholders"); onSkip(type); }}>
            {busy && pressed === "placeholders" && <Icon name="loader-circle" size={14} className="bw-spin" />}
            Draft with placeholders
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================= EscalationCard == */

type EscalationDialog = "note" | "withdraw" | "clear" | "keep" | "close" | null;

/** The pause for comms and legal. Amber, never red: a pause, not an alarm.
 *  Every decision opens a note that stays on the draft's record. */
export function EscalationCard({ run, seat, onClear, onKeepPaused, onCloseRun, onWithdraw, onAddNote }: {
  run: PrRun;
  seat: EscalationSeat;
  onClear: (note: string) => Promise<void>;
  onKeepPaused: (note: string) => Promise<void>;
  onCloseRun: (note: string) => Promise<void>;
  onWithdraw: (note: string) => Promise<void>;
  onAddNote: (note: string) => Promise<void>;
}) {
  const [dialog, setDialog] = useState<EscalationDialog>(null);
  const esc = run.escalation;
  if (!esc) return null;
  const c = run.can;
  const names = [...new Set([run.reviewers.comms_lead?.name, run.reviewers.legal?.name].filter((x): x is string => !!x))];
  const who = names.length ? andList(names) : "workspace admins";
  const look = names.length === 1 ? "looks" : "look";
  const close = () => setDialog(null);
  const done = (fn: (n: string) => Promise<void>) => async (note: string) => { await fn(note); close(); };

  return (
    <div className="mr-panel pr-escalation">
      <div className="mr-panel__head bw-head">
        <div className="bw-head__text">
          <span className="bw-status pr-status--warn">Waiting for comms and legal</span>
          <p className="pr-escalation__body">
            This news touches {esc.category_label || "a sensitive topic"}, so {who} {look} at it before anything is
            written. Nothing has been drafted. This page updates as soon as they clear it.
          </p>
          {seat !== "requester" && (
            <span className="bw-hint">Requested by {run.owner.name}.</span>
          )}
        </div>
      </div>

      {esc.excerpt && (
        <figure className="pr-flagged">
          <figcaption>What PR Writer flagged</figcaption>
          <blockquote>{esc.excerpt}</blockquote>
          {esc.reason && <span className="bw-hint">{esc.reason}</span>}
        </figure>
      )}

      {esc.notes.length > 0 && (
        <ul className="pr-record">
          {esc.notes.map((n, i) => <li key={i}>{escalationRecordLine(n)}</li>)}
        </ul>
      )}

      <div className="pr-actions">
        {seat === "reviewer" && (
          <>
            {c.clear_escalation && (
              <button type="button" className="bw-btn bw-btn--primary" onClick={() => setDialog("clear")}>
                <Icon name="check" size={14} /> Clear to draft
              </button>
            )}
            {c.keep_paused && (
              <button type="button" className="bw-btn" onClick={() => setDialog("keep")}>
                <Icon name="pause" size={14} /> Keep paused
              </button>
            )}
            {c.close_escalation && (
              <button type="button" className="bw-btn" onClick={() => setDialog("close")}>
                <Icon name="x" size={14} /> Close without drafting
              </button>
            )}
          </>
        )}
        {seat === "requester" && (
          <>
            {c.add_escalation_note && (
              <button type="button" className="bw-btn" onClick={() => setDialog("note")}>
                <Icon name="sticky-note" size={14} /> Add a note for reviewers
              </button>
            )}
            {c.withdraw && (
              <button type="button" className="bw-btn" onClick={() => setDialog("withdraw")}>
                Withdraw request
              </button>
            )}
          </>
        )}
      </div>

      {dialog === "clear" && (
        <NoteDialog
          title="Clear to draft"
          label="Why this is safe to draft"
          placeholder="Legal reviewed the announcement wording on Oct. 28; no client names."
          verb="Clear to draft"
          tone="warn"
          onSubmit={done(onClear)}
          onCancel={close}
        />
      )}
      {dialog === "keep" && (
        <NoteDialog
          title="Keep paused"
          label="What still has to happen first"
          placeholder="Waiting on outside counsel's read of the settlement terms."
          verb="Keep paused"
          tone="warn"
          onSubmit={done(onKeepPaused)}
          onCancel={close}
        />
      )}
      {dialog === "close" && (
        <NoteDialog
          title="Close without drafting"
          label="Why this won't be drafted"
          placeholder="We won't announce this; legal advises no statement."
          verb="Close without drafting"
          sub="Nothing is drafted and the request ends. The note stays on its record."
          tone="warn"
          onSubmit={done(onCloseRun)}
          onCancel={close}
        />
      )}
      {dialog === "note" && (
        <NoteDialog
          title="Add a note for reviewers"
          label="Your note"
          placeholder="The embargo lifts Nov. 12 at 9 a.m. ET; the client has agreed to be named."
          verb="Add the note"
          tone="warn"
          onSubmit={done(onAddNote)}
          onCancel={close}
        />
      )}
      {dialog === "withdraw" && (
        <NoteDialog
          title="Withdraw this request"
          label="Why (optional)"
          placeholder="We'll announce this next quarter instead."
          verb="Withdraw request"
          optional
          tone="warn"
          onSubmit={done(onWithdraw)}
          onCancel={close}
        />
      )}
    </div>
  );
}

/* ========================================================== PrMarkerText == */

export type MarkerHit = { seg: Exclude<MarkerSegment, { kind: "text" }>; marker?: PrMarker; quote?: PrQuote };

/** A block's text with every marker drawn as a chip. Each chip is a button
 *  that opens the row it stands for. */
export function PrMarkerText({ text, blockId, markers, quotes, onMarker }: {
  text: string;
  blockId: string;
  markers: PrMarker[];
  quotes: PrQuote[];
  onMarker: (hit: MarkerHit) => void;
}) {
  const segs = parseMarkers(text);
  return (
    <>
      {segs.map((seg, i) => {
        if (seg.kind === "text") return <Fragment key={i}>{seg.text}</Fragment>;
        const marker = markerFor(markers, blockId, seg.token);
        const quote = marker?.quote_id ? quotes.find((q) => q.id === marker.quote_id) : undefined;
        const chip = markerChip(seg, marker, quote);
        return (
          <button
            key={i}
            type="button"
            className={`pr-mark pr-mark--${chip.tone}`}
            data-marker={seg.kind}
            title={seg.token}
            onClick={() => onMarker({ seg, marker, quote })}
          >
            {chip.text}
          </button>
        );
      })}
    </>
  );
}

/* ========================================================== SignoffPanel == */

type SignoffDialog = { kind: "ask" | "quote"; row: PrSignoffRow } | null;

/** Who has signed what. Only the named person sees the buttons on their own
 *  row (`viewer_can_act`, from the server); a quote row is the comms lead's to
 *  record, on the speaker's behalf, with the evidence. */
export function SignoffPanel({
  signoffs, busy, canApprove, onApprove, onSignOff, onAskChanges, onRecordQuote, onShowFacts, onShowQuotes,
}: {
  signoffs: PrSignoffs;
  busy: string | null;
  /** This viewer is the one who marks it approved (the comms lead, or a
   *  fallback admin when the run has none). */
  canApprove: boolean;
  onApprove: () => void;
  onSignOff: (row: PrSignoffRow) => void;
  onAskChanges: (row: PrSignoffRow, note: string) => Promise<void>;
  onRecordQuote: (row: PrSignoffRow, evidence: string) => Promise<void>;
  onShowFacts: () => void;
  onShowQuotes: () => void;
}) {
  const [dialog, setDialog] = useState<SignoffDialog>(null);
  const blocked = signoffs.approved ? null : blockerSentence(signoffs.blockers);
  const b = signoffs.blockers;
  // Enabled only when the server says it can be approved and nothing is open.
  const ready = signoffs.can_approve && !!signoffs.version && !b.verify && !b.missing && !b.pending_quotes;
  const close = () => setDialog(null);
  const speaker = (row: PrSignoffRow) => speakerName(row.label.replace(/^Quote:\s*/, ""));

  return (
    <div className="mr-panel pr-signoff" id="pr-signoff">
      <div className="mr-panel__head bw-head">
        <div className="bw-head__text">
          <h2 className="mr-panel__title">Sign-off</h2>
          <span className="mr-panel__sub">
            {signoffs.version
              ? `${signoffs.summary.signed} of ${signoffs.summary.total} signed on v${signoffs.version}.`
              : "Reviewers sign off once the draft is sent for review."}
          </span>
        </div>
        {signoffs.approved && <span className="bw-chip pr-chip--ok">Approved</span>}
        {!signoffs.approved && (canApprove || signoffs.can_approve) && (
          <button
            type="button"
            className="bw-btn bw-btn--primary"
            disabled={!!busy || !ready}
            title={ready ? undefined : "Every sign-off, fact and quote has to be cleared first."}
            onClick={onApprove}
          >
            {busy === "approve" ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="shield-check" size={14} />}
            Mark approved
          </button>
        )}
      </div>

      {signoffs.approved && <p className="pr-approved">{APPROVED_LINE}</p>}

      {blocked && (
        <div className="pr-blocked">
          <p>{blocked}</p>
          <div className="pr-actions">
            {signoffs.blockers.verify > 0 && (
              <button type="button" className="pr-link" onClick={onShowFacts}>Show the facts</button>
            )}
            {signoffs.blockers.pending_quotes > 0 && (
              <button type="button" className="pr-link" onClick={onShowQuotes}>Show the quotes</button>
            )}
          </div>
        </div>
      )}

      <ul className="pr-rows">
        {signoffs.rows.map((row) => (
          <li key={row.id} className="pr-row">
            <span className="pr-row__who">{signoffRowLabel(row)}</span>
            <span className={`bw-chip pr-chip--${signoffTone(row)}`}>{signoffStateText(row)}</span>
            {row.state === "changes_asked" && row.note && <span className="pr-row__note">{row.note}</span>}
            {row.viewer_can_act && (
              <span className="pr-row__acts">
                {row.kind === "role" ? (
                  <>
                    <button
                      type="button"
                      className="bw-btn bw-btn--primary"
                      disabled={!!busy || !signoffs.version}
                      onClick={() => onSignOff(row)}
                    >
                      {busy === `sign-${row.id}` ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="check" size={14} />}
                      Sign off
                    </button>
                    <button type="button" className="bw-btn" disabled={!!busy || !signoffs.version} onClick={() => setDialog({ kind: "ask", row })}>
                      Ask for changes
                    </button>
                  </>
                ) : row.state !== "approved" ? (
                  <button type="button" className="bw-btn" disabled={!!busy} onClick={() => setDialog({ kind: "quote", row })}>
                    Record approval
                  </button>
                ) : null}
              </span>
            )}
          </li>
        ))}
      </ul>

      {dialog?.kind === "ask" && (
        <NoteDialog
          title="Ask for changes"
          label="What needs to change"
          placeholder="The second paragraph overstates the launch date; use legal's wording."
          verb="Ask for changes"
          onSubmit={async (note) => { await onAskChanges(dialog.row, note); close(); }}
          onCancel={close}
        />
      )}
      {dialog?.kind === "quote" && (
        <NoteDialog
          title="Record quote approval"
          label={`How did ${speaker(dialog.row)} approve it?`}
          placeholder="Approved by email to Priya, Oct. 28, 4:12 p.m."
          verb="Record approval"
          onSubmit={async (evidence) => { await onRecordQuote(dialog.row, evidence); close(); }}
          onCancel={close}
        />
      )}
    </div>
  );
}

/* ============================================================ VersionList == */

export function VersionList({ versions, viewing, current, onView }: {
  versions: PrVersionSummary[];
  /** The version on screen. */
  viewing: string | null;
  current: string | null;
  onView: (version: string | null) => void;
}) {
  const newestFirst = [...versions].reverse();
  return (
    <ul className="pr-versions">
      {newestFirst.map((v) => {
        const on = v.version === (viewing || current);
        return (
          <li key={v.version}>
            <button
              type="button"
              className={`pr-version${on ? " is-on" : ""}`}
              aria-current={on ? "true" : undefined}
              onClick={() => onView(v.version === current ? null : v.version)}
            >
              {v.locked && <Icon name="lock" size={12} />}
              <span>{versionRow(v)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
