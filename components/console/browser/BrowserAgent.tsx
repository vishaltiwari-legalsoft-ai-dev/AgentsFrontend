"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserPairingCode, browserRun, browserRuns, browserStatus, browserStopRun,
  type BrowserRun, type BrowserRunRow, type BrowserStatus,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { useReportWork } from "@/lib/work";

/** Browser Agent (a11) — the console half of the Chrome-extension web copilot.
 *  The extension does the work inside the user's own browser; this panel hands
 *  out the pairing code and shows what the agent actually did, step by step.
 *  Honesty rule: we never claim the extension is connected — we only report
 *  what the backend has seen. */

const AUTH_KEY = "agentos.auth";
const LIVE_POLL_MS = 3000;

const STATUS_WORDS: Record<string, string> = {
  running: "Working",
  awaiting_confirmation: "Waiting for your OK",
  awaiting_user: "Waiting for your answer",
  completed: "Done",
  failed: "Couldn't finish",
  stopped: "Stopped by you",
};

const isLive = (status: string) =>
  status === "running" || status.startsWith("awaiting");

function storedToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as { token?: string }).token ?? null : null;
  } catch {
    return null;
  }
}

function when(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function stepLine(step: BrowserRun["steps"][number]): string {
  const { action } = step;
  const why = action.why ? ` — ${action.why}` : "";
  if (action.kind === "done") return action.summary || "Finished";
  if (action.kind === "fail") return action.reason || "Gave up";
  if (action.url) return `${action.kind} ${action.url}${why}`;
  return `${action.kind}${why}`;
}

export function BrowserAgent({
  onToast,
  onBack,
}: {
  onToast: (m: string) => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [rows, setRows] = useState<BrowserRunRow[]>([]);
  const [openRun, setOpenRun] = useState<BrowserRun | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useReportWork(busy);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [info, list] = await Promise.all([browserStatus(), browserRuns()]);
      setStatus(info);
      setStatusError("");
      setRows(list.runs);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Couldn't reach the backend.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Follow a live run while it's open, then stop polling on its own.
  useEffect(() => {
    if (!openRun || !isLive(openRun.status)) return;
    liveTimer.current = setTimeout(async () => {
      try {
        const fresh = await browserRun(openRun.id);
        setOpenRun(fresh);
        if (!isLive(fresh.status)) void refresh();
      } catch {
        /* transient — the next open will re-fetch */
      }
    }, LIVE_POLL_MS);
    return () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
  }, [openRun, refresh]);

  const copyPairingCode = async () => {
    const token = storedToken();
    if (!token) {
      onToast("Sign in again — no session token found in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(browserPairingCode(token, status?.email));
      onToast("Pairing code copied — paste it into the extension's side panel.");
    } catch {
      onToast("Couldn't reach the clipboard. Allow clipboard access and retry.");
    }
  };

  const openDetail = async (id: string) => {
    setBusy(true);
    try {
      setOpenRun(await browserRun(id));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Couldn't load that run.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async (id: string) => {
    try {
      await browserStopRun(id);
      onToast("Run stopped.");
      if (openRun?.id === id) setOpenRun(await browserRun(id));
      void refresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Couldn't stop that run.");
    }
  };

  return (
    <section className="ba">
      <header className="ba-head">
        <button className="ba-back" onClick={onBack} type="button">
          <Icon name="arrow-left" size={16} /> Agents
        </button>
        <h2>Browser Agent</h2>
      </header>

      <div className="ba-hero">
        <p className="ba-story">
          Your web copilot works inside your own Chrome — the tabs you are already
          signed into. You give it a task in the side panel, it takes one step at a
          time, and anything consequential waits for your approval.
        </p>
        <div className="ba-actions">
          <button className="ba-btn ba-btn-primary" onClick={copyPairingCode} type="button">
            Copy pairing code
          </button>
          <button className="ba-btn" onClick={() => setShowInstall((v) => !v)} type="button">
            {showInstall ? "Hide setup" : "How to install"}
          </button>
          <button className="ba-btn" onClick={() => void refresh()} type="button" disabled={busy}>
            Refresh runs
          </button>
        </div>
        {statusError ? (
          <p className="ba-note ba-note-warn">{statusError}</p>
        ) : status ? (
          <p className="ba-note">
            Signed in as {status.email}. Runs stop after {status.step_cap} steps
            {status.blocked.length ? `; ${status.blocked.length} domains are off-limits` : ""}.
          </p>
        ) : null}
      </div>

      {showInstall && (
        <ol className="ba-install">
          <li>
            In <code>browser-extension/</code>, run <code>npm install &amp;&amp; npm run build</code>.
          </li>
          <li>
            Open <code>chrome://extensions</code>, turn on Developer mode, choose
            <b> Load unpacked</b>, and select the <code>dist/</code> folder.
          </li>
          <li>Click the extension icon to open its side panel.</li>
          <li>Press <b>Copy pairing code</b> above, paste it in, and press Connect.</li>
        </ol>
      )}

      {openRun ? (
        <div className="ba-detail">
          <div className="ba-detail-head">
            <button className="ba-back" onClick={() => setOpenRun(null)} type="button">
              <Icon name="arrow-left" size={16} /> All runs
            </button>
            {isLive(openRun.status) && (
              <button className="ba-btn" onClick={() => void stop(openRun.id)} type="button">
                Stop this run
              </button>
            )}
          </div>
          <h3>{openRun.goal}</h3>
          <p className="ba-note">
            {STATUS_WORDS[openRun.status] ?? openRun.status} · {openRun.steps_used} of{" "}
            {openRun.step_cap} steps · {openRun.mode === "monitor" ? "watch only" : "acting"} ·{" "}
            {when(openRun.updated_at)}
          </p>

          {openRun.summary && <p className="ba-summary">{openRun.summary}</p>}
          {openRun.fail_reason && <p className="ba-note ba-note-warn">{openRun.fail_reason}</p>}

          <ol className="ba-steps">
            {openRun.steps.map((step) => (
              <li key={step.seq} className={step.result && !step.result.ok ? "ba-step-bad" : ""}>
                <span className="ba-step-n">{step.seq}</span>
                <span className="ba-step-text">
                  {stepLine(step)}
                  {step.sensitive && <b className="ba-flag">needed your OK</b>}
                  {step.result && !step.result.ok && (
                    <em className="ba-step-err">{step.result.error}</em>
                  )}
                </span>
              </li>
            ))}
            {openRun.steps.length === 0 && <li className="ba-empty">No steps yet.</li>}
          </ol>
        </div>
      ) : (
        <div className="ba-runs">
          <h3>Recent runs</h3>
          {rows.length === 0 ? (
            <p className="ba-empty">
              Nothing yet. Start a task from the extension's side panel and it will appear here.
            </p>
          ) : (
            <ul>
              {rows.map((run) => (
                <li key={run.id}>
                  <button className="ba-run" onClick={() => void openDetail(run.id)} type="button">
                    <span className="ba-run-goal">{run.goal}</span>
                    <span className="ba-run-meta">
                      {STATUS_WORDS[run.status] ?? run.status} · {run.steps_used} steps ·{" "}
                      {when(run.updated_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
