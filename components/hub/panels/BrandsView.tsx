"use client";

/** Brands — who is working for whom, right now.
 *
 *  One card per brand under management. Inside it, every specialist that has
 *  touched the brand in the recent window, with its live state first: working
 *  this minute, queued, or resting since its last run. The figures come off
 *  the same run record Runs reads — this panel only regroups it by brand, so
 *  the two can never disagree.
 */

import type { RunRow } from "@/lib/api";
import { useHeadline, useHub } from "../context";
import { clock, dayLabel } from "../format";
import { WORKSPACE_SLUG, canOpenAgent, n } from "../model";
import { Ic } from "../Sprite";
import { Blank, Oops, PageHead, RuleHead, Wait } from "../ui";
import { useRuns } from "../useRuns";

interface AgentWork {
  agentId: string;
  agentName: string;
  running: number;
  queued: number;
  total: number;
  latest: RunRow;
}

/** The brand's crew, live states first, then by most recent touch. */
function crewFor(runs: RunRow[]): AgentWork[] {
  const by = new Map<string, AgentWork>();
  for (const r of runs) {
    const w = by.get(r.agent_id) || {
      agentId: r.agent_id, agentName: r.agent_name, running: 0, queued: 0, total: 0, latest: r,
    };
    w.total += 1;
    if (r.state === "running") w.running += 1;
    if (r.state === "queued") w.queued += 1;
    if (r.created_at > w.latest.created_at) w.latest = r;
    by.set(r.agent_id, w);
  }
  return [...by.values()].sort((a, b) => {
    const live = (w: AgentWork) => (w.running ? 2 : w.queued ? 1 : 0);
    if (live(a) !== live(b)) return live(b) - live(a);
    return a.latest.created_at < b.latest.created_at ? 1 : -1;
  });
}

export function BrandsView() {
  const { user, revision, openWork, toast } = useHub();
  const { state: feed, reload } = useRuns({ limit: 200 }, revision);
  const page = feed.data;

  const brands = page?.facets.brands || [];
  const working = page ? new Set(page.runs.filter((r) => r.state === "running").map((r) => r.brand)).size : 0;
  useHeadline(page ? `${n(brands.length)} brands · ${n(working)} with work running now` : "reading the record");

  if (feed.phase === "failed" && !page) {
    return <Oops what="The record could not be read." error={feed.error || ""} onRetry={reload} />;
  }
  if (!page) return <Wait what="Reading the record" rows={4} />;

  const open = (agentId: string) => {
    const slug = WORKSPACE_SLUG[agentId];
    if (!slug || !canOpenAgent(agentId, user)) {
      toast("That specialist is not open to your account.", "warn");
      return;
    }
    openWork(slug);
  };

  return (
    <>
      <PageHead
        statement={
          working === 0
            ? <>Nothing is running for any brand <b>this minute</b>.</>
            : <><b>{working === 1 ? "One brand has" : `${n(working)} brands have`} work running</b> right now.</>
        }
        lede="Every brand under management, and the specialists on it — working this minute, queued, or resting since their last run. Open a specialist to see the work itself."
      />

      <section className="band">
        <RuleHead
          title="Under management"
          note="Drawn from the same record Runs reads, regrouped by brand."
          aside={<span className="aside">{n(brands.length)} brands</span>}
        />

        {brands.length === 0 ? (
          <Blank title="No brand has been worked yet.">
            Hand a specialist a brief and the brand it ran against appears here, with its crew.
          </Blank>
        ) : (
          <div className="bgrid">
            {brands.map((b) => {
              const runs = page.runs.filter((r) => r.brand === b.name);
              const crew = crewFor(runs);
              const liveNow = crew.reduce((s, w) => s + w.running, 0);
              return (
                <article className="bcard" key={b.name}>
                  <header className="bcard__head">
                    <b>{b.name}</b>
                    <em>{n(b.count)} run{b.count === 1 ? "" : "s"} on record</em>
                    <span className={`bcard__now${liveNow ? " is-live" : ""}`}>
                      {liveNow ? <><i aria-hidden="true" />{liveNow === 1 ? "working now" : `${liveNow} working now`}</> : "quiet"}
                    </span>
                  </header>
                  {crew.length === 0 ? (
                    <p className="bcard__none">Nothing in the recent window.</p>
                  ) : (
                    <div className="bcard__rows">
                      {crew.map((w) => (
                        <button type="button" className="bcard__row" key={w.agentId} onClick={() => open(w.agentId)} title={w.latest.title}>
                          <span className="rt__ai" data-a={w.agentId} aria-hidden="true"><Ic name={w.agentId} /></span>
                          <b>{w.agentName}</b>
                          {w.running > 0 ? (
                            <em className="bst is-run"><i aria-hidden="true" />Working now</em>
                          ) : w.queued > 0 ? (
                            <em className="bst is-q">Queued</em>
                          ) : (
                            <em className="bst">Last {dayLabel(w.latest.created_at)[0].toLowerCase()} {clock(w.latest.created_at)}</em>
                          )}
                          <u>{n(w.total)} run{w.total === 1 ? "" : "s"}</u>
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
