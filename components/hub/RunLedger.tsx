"use client";

/** The ledger: one run a line, leading with the thing it made.
 *
 *  The prototype's row could print the figure a run produced — `1024 × 1024`,
 *  `18 fixes`, `4 engines` — because its dataset carried one per run. The
 *  activity trail records no such figure, and this console will not compute a
 *  plausible-looking one from a title. So the row leads with the picture when
 *  there is a picture, and otherwise with the specialist's stamp, and the
 *  second line carries what the trail actually holds: who made it, when, how
 *  long it took when anybody timed it, and for which brand.
 */

import { useState } from "react";
import type { RunRow } from "@/lib/api";
import { Ic } from "./Sprite";
import { Mono, StateCell, Tile } from "./ui";
import { agentById } from "./model";
import { clock, dayKey, dayLabel, took } from "./format";
import { useArtifact } from "./useArtifact";

function agentStamp(agentId: string, agentName: string) {
  const known = agentById(agentId);
  if (known) return known;
  // A row from an agent this build does not know about still gets a stamp
  // rather than a blank square: two letters off the name it was filed under.
  const letters = (agentName || agentId || "??").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return { id: agentId, mono: letters || "??", name: agentName || agentId };
}

export function RunRowCard({
  run, open, onToggle, onOpenWorkspace,
}: {
  run: RunRow;
  open: boolean;
  onToggle: () => void;
  onOpenWorkspace?: (agentId: string) => void;
}) {
  const a = agentStamp(run.agent_id, run.agent_name);
  const duration = took(run.took_seconds);
  const line = [a.name, clock(run.created_at), duration].filter(Boolean).join(" · ");

  return (
    <div className={`rrow${open ? " is-open" : ""}`}>
      <button type="button" className="rrow__btn" aria-expanded={open} onClick={onToggle}>
        <Tile state={run.state} image={run.image} alt={run.title} mono={a.mono} />
        <Mono agent={a} tone={run.state === "running" ? "is-running" : run.state === "failed" ? "is-failed" : ""} />
        <span className="rrow__what">
          <b>{run.title}</b>
          <span>{line}</span>
        </span>
        <span className="rrow__yield">
          <b>{run.action || "—"}</b>
          <span>{run.state === "running" ? "in progress" : duration || "not timed"}</span>
        </span>
        <span className="rrow__meta brand">{run.brand || "No brand"}</span>
        <StateCell state={run.state} />
        <span className="rrow__chev"><Ic name="chevron" /></span>
      </button>

      <div className="rrow__body">
        <div className="rrow__inner">
          <div className="rrow__pad">
            <div className="art__head">
              <div>
                <h4>{run.title}</h4>
                <p>
                  {a.name}
                  {run.brand ? ` · ${run.brand}` : ""}
                  {` · ${dayLabel(run.created_at)[1] || run.day} · ${clock(run.created_at)}`}
                  {duration ? ` · ${duration}` : ""}
                </p>
              </div>
              {onOpenWorkspace && agentById(run.agent_id) && (
                <div className="art__acts">
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => onOpenWorkspace(run.agent_id)}
                  >
                    Open {a.name}
                    <Ic name="chevron" />
                  </button>
                </div>
              )}
            </div>
            <RunDetail run={run} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the record actually holds about one run.
 *
 *  Where the prototype rendered a full artifact — the picture with its four
 *  stages, the draft with its citations, the report with its figures — the trail
 *  holds a pointer and a sentence. So this shows the picture when the run made
 *  one, and otherwise says plainly what the row is, rather than dressing four
 *  fields as an artifact viewer.
 */
function RunDetail({ run }: { run: RunRow }) {
  // The picture is fetched with the caller's token; an <img src> cannot.
  const art = useArtifact(run.state === "done" ? run.image : null);

  if (run.state === "failed") {
    return (
      <div className="art">
        <div className="fail">
          <h4>The run stopped</h4>
          <p>
            It was filed as <b>{run.status_raw || "failed"}</b>. The record keeps failed runs on
            purpose — a run that vanishes is one nobody learns from.
          </p>
          <p>Open the specialist to see the state it stopped in, and start it again from there.</p>
        </div>
      </div>
    );
  }

  if (run.state === "queued" || run.state === "running") {
    return (
      <div className="art">
        <div className="empty" style={{ textAlign: "left" }}>
          <h4>{run.state === "running" ? "Still working" : "Not started"}</h4>
          <p style={{ marginLeft: 0 }}>
            {run.state === "running"
              ? "This run is in progress. What it makes appears here once it lands."
              : "This run has not started. It begins when the specialist ahead of it is free."}
          </p>
        </div>
      </div>
    );
  }

  if (run.image && art.phase !== "gone") {
    return (
      <div className="art art--image">
        <figure className="shot" style={{ margin: 0 }}>
          {art.phase === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art.url} alt={run.title} loading="lazy" />
          ) : (
            <span className="shot__wait" role="status"><i className="wait__spin" aria-hidden="true" />Fetching the file</span>
          )}
          <figcaption>{run.title}</figcaption>
        </figure>
        <div>
          <div className="art__head">
            <div>
              <h4>The kept version</h4>
              <p>This is the image the run finished on, as it was archived.</p>
            </div>
          </div>
          <p className="lede" style={{ margin: "12px 0 0", fontSize: 12 }}>
            Filed as <b>{run.action || "a run"}</b>{run.brand ? ` for ${run.brand}` : ""}. The stages
            behind it live in the Graphic Designer&apos;s workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="art">
      <div className="figs">
        <div className="fig"><b>{run.action || "—"}</b><span>What was filed</span></div>
        <div className="fig"><b>{run.brand || "None"}</b><span>Brand</span></div>
        <div className="fig"><b>{took(run.took_seconds) || "Not timed"}</b><span>Took</span></div>
        <div className="fig"><b>{run.user || "—"}</b><span>Filed by</span></div>
      </div>
      <p className="lede" style={{ margin: "14px 0 0", fontSize: 12 }}>
        The record keeps who ran what, when, and against which brand. What the run produced lives
        with the specialist that made it — open it above to read the thing itself.
      </p>
    </div>
  );
}

/** The grouped ledger. `grouped` puts a day divider above each new date; Home
 *  turns it off, because a list of five live rows is not a diary. */
export function Ledger({
  runs, grouped = true, openId, onToggle, onOpenWorkspace,
}: {
  runs: RunRow[];
  grouped?: boolean;
  openId: string | null;
  onToggle: (id: string) => void;
  onOpenWorkspace?: (agentId: string) => void;
}) {
  let last: string | null = null;
  const out: React.ReactNode[] = [];

  runs.forEach((r) => {
    const key = dayKey(r.created_at);
    if (grouped && key !== last) {
      last = key;
      const count = runs.filter((x) => dayKey(x.created_at) === key).length;
      const [big, small] = dayLabel(r.created_at);
      out.push(
        <div className="rday" key={`d-${key}`}>
          <b>{big}</b><span>{small}</span><u>{count} run{count === 1 ? "" : "s"}</u>
        </div>,
      );
    }
    out.push(
      <RunRowCard
        key={r.id}
        run={r}
        open={r.id === openId}
        onToggle={() => onToggle(r.id)}
        onOpenWorkspace={onOpenWorkspace}
      />,
    );
  });

  return <div className="rledger">{out}</div>;
}
