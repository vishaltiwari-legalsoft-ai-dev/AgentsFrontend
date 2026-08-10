"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserConfig, browserDigest, browserDigests, browserExtensionBlob, browserPairingCode,
  browserRun, browserRuns, browserSaveConfig, browserStatus, browserStopRun,
  type BrowserDigest, type BrowserDigestRow, type BrowserRun, type BrowserRunRow,
  type BrowserStatus, type BrowserWatchRule,
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
  const [tab, setTab] = useState<"runs" | "digests">("runs");
  const [digestRows, setDigestRows] = useState<BrowserDigestRow[]>([]);
  const [openDigest, setOpenDigest] = useState<BrowserDigest | null>(null);
  const [rules, setRules] = useState<BrowserWatchRule[]>([]);
  const [newRule, setNewRule] = useState("");
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useReportWork(busy);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [info, list, digests, cfg] = await Promise.all([
        browserStatus(), browserRuns(), browserDigests(), browserConfig(),
      ]);
      setStatus(info);
      setStatusError("");
      setRows(list.runs);
      setDigestRows(digests.digests);
      setRules(cfg.watch_rules);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Couldn't reach the backend.");
    } finally {
      setBusy(false);
    }
  }, []);

  const saveRules = async (next: BrowserWatchRule[]) => {
    const previous = rules;
    setRules(next);
    try {
      const saved = await browserSaveConfig(next);
      setRules(saved.watch_rules);
    } catch (err) {
      setRules(previous);
      onToast(err instanceof Error ? err.message : "Couldn't save that.");
    }
  };

  const addRule = async () => {
    const text = newRule.trim();
    if (!text) return;
    setNewRule("");
    await saveRules([...rules, { text, enabled: true }]);
  };

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

  const downloadExtension = async () => {
    setBusy(true);
    try {
      const blob = await browserExtensionBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "agentos-browser-agent.zip";
      link.click();
      URL.revokeObjectURL(url);
      setShowInstall(true);
      onToast("Downloaded. Unzip it, then follow the steps below.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Couldn't download the extension.");
    } finally {
      setBusy(false);
    }
  };

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

  const openDigestDetail = async (id: string) => {
    setBusy(true);
    try {
      setOpenDigest(await browserDigest(id));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Couldn't load that digest.");
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
          <button
            className="ba-btn ba-btn-primary"
            onClick={() => void downloadExtension()}
            type="button"
            disabled={busy || (status ? !status.can_download : false)}
          >
            Download the extension
          </button>
          <button className="ba-btn" onClick={copyPairingCode} type="button">
            Copy pairing code
          </button>
          <button className="ba-btn" onClick={() => setShowInstall((v) => !v)} type="button">
            {showInstall ? "Hide setup" : "How to install"}
          </button>
        </div>
        {statusError ? (
          <p className="ba-note ba-note-warn">{statusError}</p>
        ) : status ? (
          <p className={`ba-note${status.can_download ? "" : " ba-note-warn"}`}>
            {status.can_download
              ? `Signed in as ${status.email}. Extension v${status.extension_version} — ` +
                "the side panel shows the version you have installed, and warns you when it's " +
                `older than this. Runs stop after ${status.step_cap} steps` +
                (status.blocked.length
                  ? `; ${status.blocked.length} domains are off-limits.`
                  : ".")
              : `The extension is limited to company accounts, and ${status.email} isn't one — ` +
                "sign in with your work address to download it."}
          </p>
        ) : null}
      </div>

      {showInstall && (
        <div className="ba-install">
          <p className="ba-install-lead">
            Takes about two minutes, and you don&apos;t need to write any code. Chrome will warn
            you that the extension is in &quot;developer mode&quot; — that is normal for an
            in-house tool that isn&apos;t published on the Chrome Web Store.
          </p>
          <ol>
            <li>
              <b>Download the extension</b> using the button above. It saves
              <code> agentos-browser-agent.zip</code>.
            </li>
            <li>
              <b>Unzip it.</b> Right-click the file → <i>Extract All</i>. You&apos;ll get a folder
              — remember where it is, and don&apos;t delete it later. Chrome reads the extension
              from this folder every time it starts.
            </li>
            <li>
              <b>Open Chrome&apos;s extensions page.</b> Type <code>chrome://extensions</code> in
              the address bar and press Enter.
            </li>
            <li>
              <b>Turn on Developer mode</b> using the switch in the top-right corner. This is what
              lets Chrome load an extension from a folder instead of the Web Store.
            </li>
            <li>
              <b>Click &quot;Load unpacked&quot;</b> (top-left) and select the folder you unzipped.
              The AgentOS Browser Agent should now appear in your list.
            </li>
            <li>
              <b>Connect it.</b> Click the extension&apos;s icon in the toolbar to open its side
              panel, press <b>Copy pairing code</b> at the top of this page, paste it into the
              panel, and press <i>Connect</i>. It should then say &quot;Connected as&quot; with
              your email.
            </li>
          </ol>
          <p className="ba-install-note">
            Stuck on the last step? The code expires after a week — press <b>Copy pairing code</b>
            again to get a fresh one.
          </p>
        </div>
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

          {openRun.plan && (
            <div className="ba-plan">
              <h4 className="ba-subhead">
                {openRun.plan.planned ? "The plan" : "No plan — worked straight from the task"}
              </h4>
              {openRun.plan.plan_error && (
                <p className="ba-note ba-note-warn">
                  Planning didn&apos;t run: {openRun.plan.plan_error}
                </p>
              )}
              {openRun.plan.subtasks.map((sub, i) => (
                <details key={sub.id} className="ba-sub" open={sub.status !== "done"}>
                  <summary>
                    <span className={`ba-sub-n${sub.status === "done" ? " ba-sub-n--done" : ""}`}>
                      {sub.status === "done" ? "✓" : i + 1}
                    </span>
                    {sub.title}
                  </summary>
                  <p className="ba-sub-goal">{sub.goal}</p>
                  {sub.steps.length > 0 && (
                    <ol className="ba-sub-steps">
                      {sub.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  )}
                  {sub.edge_cases.length > 0 && (
                    <ul className="ba-sub-edges">
                      {sub.edge_cases.map((edge) => (
                        <li key={edge.risk}>
                          <b>If {edge.risk}</b> — {edge.handle}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="ba-sub-done">Finished when: {sub.done_when}</p>
                </details>
              ))}
            </div>
          )}

          <ol className="ba-steps">
            {openRun.steps.map((step) => (
              <li key={step.seq} className={step.result && !step.result.ok ? "ba-step-bad" : ""}>
                <span className="ba-step-n">{step.seq}</span>
                <span className="ba-step-text">
                  {stepLine(step)}
                  {step.sensitive && <b className="ba-flag">needed your OK</b>}
                  {step.saw_page && <b className="ba-flag">looked at the page</b>}
                  {step.result && !step.result.ok && (
                    <em className="ba-step-err">{step.result.error}</em>
                  )}
                </span>
              </li>
            ))}
            {openRun.steps.length === 0 && <li className="ba-empty">No steps yet.</li>}
          </ol>
        </div>
      ) : openDigest ? (
        <div className="ba-detail">
          <button className="ba-back" onClick={() => setOpenDigest(null)} type="button">
            <Icon name="arrow-left" size={16} /> All digests
          </button>
          <h3>{openDigest.headline}</h3>
          <p className="ba-note">
            {openDigest.pages_seen} pages visited · {openDigest.tabs_open} tabs open ·{" "}
            {when(openDigest.at)}
          </p>

          {openDigest.themes.map((theme) => (
            <div key={theme.title} className="ba-theme">
              <b>{theme.title}</b>
              <span>{theme.detail}</span>
            </div>
          ))}

          {openDigest.open_loops.length > 0 && (
            <>
              <h4 className="ba-subhead">Loose ends</h4>
              <ul className="ba-loops">
                {openDigest.open_loops.map((loop) => (
                  <li key={loop}>{loop}</li>
                ))}
              </ul>
            </>
          )}

          {openDigest.alerts.map((alert) => (
            <div key={alert.rule} className="ba-alert">
              <b>{alert.rule}</b>
              <span>
                {alert.count} matching page{alert.count === 1 ? "" : "s"}
              </span>
              <ul>
                {alert.pages.map((page) => (
                  <li key={page.url}>
                    <a href={page.url} target="_blank" rel="noreferrer">
                      {page.title || page.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="ba-runs">
          <div className="ba-tabs">
            <button
              className={`ba-tab${tab === "runs" ? " ba-tab--on" : ""}`}
              onClick={() => setTab("runs")}
              type="button"
            >
              Runs
            </button>
            <button
              className={`ba-tab${tab === "digests" ? " ba-tab--on" : ""}`}
              onClick={() => setTab("digests")}
              type="button"
            >
              Tab digests
            </button>
          </div>

          {tab === "runs" ? (
            rows.length === 0 ? (
              <p className="ba-empty">
                Nothing yet. Start a task from the extension&apos;s side panel and it will appear here.
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
            )
          ) : (
            <>
              <p className="ba-note">
                The extension notes which pages you visit, entirely on your machine, and sends
                nothing until you ask it for a digest from the side panel.
              </p>

              <div className="ba-rules">
                <h4 className="ba-subhead">Tell me when you see…</h4>
                {rules.length === 0 && (
                  <p className="ba-empty">
                    No watch topics yet. Add one and it will be flagged in every digest.
                  </p>
                )}
                <ul>
                  {rules.map((rule, i) => (
                    <li key={`${rule.text}-${i}`}>
                      <span>{rule.text}</span>
                      <button
                        className="ba-rule-x"
                        type="button"
                        aria-label={`Remove ${rule.text}`}
                        onClick={() => void saveRules(rules.filter((_, j) => j !== i))}
                      >
                        <Icon name="trash-2" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="ba-rule-add">
                  <input
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addRule();
                    }}
                    placeholder="e.g. billing, or a client's name"
                  />
                  <button className="ba-btn" onClick={() => void addRule()} type="button">
                    Add
                  </button>
                </div>
              </div>

              {digestRows.length === 0 ? (
                <p className="ba-empty">
                  No digests yet. Press &quot;What&apos;s happening in my tabs?&quot; in the
                  extension to make one.
                </p>
              ) : (
                <ul>
                  {digestRows.map((row) => (
                    <li key={row.id}>
                      <button
                        className="ba-run"
                        type="button"
                        onClick={() => void openDigestDetail(row.id)}
                      >
                        <span className="ba-run-goal">{row.headline}</span>
                        <span className="ba-run-meta">
                          {row.pages_seen} pages
                          {row.alerts > 0 ? ` · ${row.alerts} flagged` : ""} · {when(row.at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
