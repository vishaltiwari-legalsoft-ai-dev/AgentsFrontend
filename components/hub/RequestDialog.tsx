"use client";

/** The three ask-us-something forms: feedback, a problem, and the big one —
 *  requesting a whole new specialist from the header.
 *
 *  Nothing here writes to the backend, because no endpoint records these yet.
 *  A submission is kept in localStorage (so the console can grow an outbox
 *  later without losing what people already said) and answered with a toast.
 *  The forms stay honest: a submit button that would send nothing is disabled.
 */

import { useEffect, useState } from "react";
import { Ic } from "./Sprite";
import type { ToastFn } from "./context";

export type AskKind = "feedback" | "issue" | "agent";

/** The toast and the note under the form say the same true thing: nothing is
 *  sent anywhere yet. A "filed — we're on it" that reached nobody would be a
 *  canned success, which this console does not do. */
const COPY: Record<AskKind, { title: string; lede: string; thanks: string; cta: string }> = {
  feedback: {
    title: "Submit feedback",
    lede: "What is working, what is rubbing wrong — plain words are perfect.",
    thanks: "Feedback kept on this device. Nobody is notified yet — tell the team directly for now.",
    cta: "Keep feedback",
  },
  issue: {
    title: "Report a problem",
    lede: "Say what went wrong and where it happened.",
    thanks: "Problem kept on this device. Nobody is notified yet — tell the team directly for now.",
    cta: "Keep the note",
  },
  agent: {
    title: "Request a new agent",
    lede: "Describe the specialist you wish was on staff. The clearer the job, the faster it gets sized up.",
    thanks: "Request kept on this device. Nobody is notified yet — tell the team directly for now.",
    cta: "Keep the request",
  },
};

const KEPT_LOCALLY =
  "For now this is kept in this browser only — no endpoint receives it and nobody is notified.";

function keep(kind: AskKind, body: Record<string, string>) {
  try {
    const k = "agentos.asks";
    const prev = JSON.parse(localStorage.getItem(k) || "[]") as unknown[];
    prev.push({ kind, at: new Date().toISOString(), ...body });
    localStorage.setItem(k, JSON.stringify(prev));
  } catch {
    /* storage off — the toast still answers the person */
  }
}

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

  // A reopened form is a fresh form.
  useEffect(() => {
    if (open) { setMain(""); setName(""); setGets(""); setWhere(""); setCadence("On demand"); }
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

  const submit = () => {
    if (!ready) return;
    keep(kind, kind === "agent"
      ? { name, job: main, gets, cadence }
      : kind === "issue" ? { where, what: main } : { note: main });
    onToast(c.thanks, "ok");
    onClose();
  };

  return (
    <div className="rqd" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rqd__card" role="dialog" aria-modal="true" aria-label={c.title}>
        <header className="rqd__head">
          <h3>{c.title}</h3>
          <button type="button" className="rqd__x" onClick={onClose} aria-label="Close">
            <Ic name="x" />
          </button>
        </header>
        <p>{c.lede}</p>
        <p className="rqd__kept" role="note">{KEPT_LOCALLY}</p>

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

        <div className="rqd__ops">
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--solid btn--sm" disabled={!ready} onClick={submit}>
            {c.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
