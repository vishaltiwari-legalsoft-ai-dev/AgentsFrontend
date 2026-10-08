"use client";

/** The three ask-us-something forms: feedback, a problem, and the big one —
 *  requesting a whole new specialist from the header.
 *
 *  Each one is a `POST /api/asks`, which lands in the admins' inbox on the
 *  Admin panel. A send that fails keeps the dialog open with the text intact
 *  and the backend's own sentence under the form — never a success toast for
 *  something nobody received. The submit button is disabled until there is
 *  something to send, and again while the send is in flight.
 */

import { useEffect, useState } from "react";
import { submitAsk, type AskKind } from "@/lib/api";
import { describeFailure } from "@/lib/load";
import { Ic } from "./Sprite";
import type { ToastFn } from "./context";

export type { AskKind };

const COPY: Record<AskKind, { title: string; lede: string; sent: string; cta: string }> = {
  feedback: {
    title: "Submit feedback",
    lede: "What is working, what is rubbing wrong — plain words are perfect. Goes straight to the admins' inbox.",
    sent: "Feedback sent to the admins.",
    cta: "Send feedback",
  },
  issue: {
    title: "Report a problem",
    lede: "Say what went wrong and where it happened. Goes straight to the admins' inbox.",
    sent: "Problem sent to the admins.",
    cta: "Report the problem",
  },
  agent: {
    title: "Request a new agent",
    lede: "Describe the specialist you wish was on staff. The clearer the job, the faster it gets sized up. Goes straight to the admins' inbox.",
    sent: "Sent to the admins — it is in their inbox now.",
    cta: "Submit request",
  },
};

export function RequestDialog({
  kind, open, onClose, onToast,
}: {
  kind: AskKind;
  open: boolean;
  onClose: () => void;
  onToast: ToastFn;
}) {
  const [main, setMain] = useState("");
  const [name, setName] = useState("");
  const [gets, setGets] = useState("");
  const [where, setWhere] = useState("");
  const [cadence, setCadence] = useState("On demand");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // A reopened form is a fresh form.
  useEffect(() => {
    if (open) {
      setMain(""); setName(""); setGets(""); setWhere(""); setCadence("On demand");
      setSending(false); setErr(null);
    }
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const c = COPY[kind];
  const ready = kind === "agent" ? main.trim() !== "" && name.trim() !== "" : main.trim() !== "";

  const submit = async () => {
    if (!ready || sending) return;
    setSending(true);
    setErr(null);
    const fields = kind === "agent"
      ? { name, job: main, gets, cadence }
      : kind === "issue" ? { where, note: main } : { note: main };
    try {
      await submitAsk({ kind, ...fields, page: window.location.hash });
      onToast(c.sent, "ok");
      onClose();
    } catch (e) {
      // The backend's `detail` as it came; a timeout keeps its own sentence.
      setErr(describeFailure(e, "It could not be sent. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rqd" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rqd__card" role="dialog" aria-modal="true" aria-label={c.title} aria-busy={sending}>
        <header className="rqd__head">
          <h3>{c.title}</h3>
          <button type="button" className="rqd__x" onClick={onClose} aria-label="Close">
            <Ic name="x" />
          </button>
        </header>
        <p>{c.lede}</p>

        {kind === "agent" && (
          <>
            <label>
              What should it be called?
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Social Scheduler, PR Writer, Review Responder…" autoFocus />
            </label>
            <label>
              What should it do, in plain words?
              <textarea rows={4} value={main} onChange={(e) => setMain(e.target.value)}
                placeholder="Every Monday it should plan the week's posts across our channels and queue them for approval…" />
            </label>
            <label>
              What should it hand back?
              <input className="inp" value={gets} onChange={(e) => setGets(e.target.value)}
                placeholder="A dated posting calendar, ready to approve" />
            </label>
            <label>
              How often would you use it?
              <select className="sel" value={cadence} onChange={(e) => setCadence(e.target.value)}>
                <option>On demand</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </label>
          </>
        )}

        {kind === "issue" && (
          <label>
            Where did it happen?
            <input className="inp" value={where} onChange={(e) => setWhere(e.target.value)}
              placeholder="Agents · SEO dashboard · a run…" autoFocus />
          </label>
        )}

        {kind !== "agent" && (
          <label>
            {kind === "issue" ? "What went wrong?" : "What should we know?"}
            <textarea rows={4} value={main} onChange={(e) => setMain(e.target.value)}
              placeholder={kind === "issue"
                ? "What you pressed, what you expected, what happened instead."
                : "The more specific, the more useful — a screen, a moment, a wish."}
              autoFocus={kind === "feedback"} />
          </label>
        )}

        {err && <p className="rqd__err" role="alert">{err}</p>}

        <div className="rqd__ops">
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--solid btn--sm" disabled={!ready || sending} onClick={submit}>
            {sending ? "Sending…" : c.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
