"use client";

/** Agents — a specialist is defined by what it hands back.
 *
 *  So that is what this page leads with, alongside the last three things each
 *  one actually produced, read off the record rather than described.
 *
 *  The prototype also printed a 30-day spend per specialist. Nothing in this
 *  backend records one: the activity trail stores who ran what, and OpenRouter
 *  bills the account, not the agent. Splitting an account total across agents by
 *  run count would look like a measurement and be arithmetic on a guess, so the
 *  card carries what is real — how many runs are stored, and how many landed
 *  this week.
 */

import { useState } from "react";
import type { RunRow } from "@/lib/api";
import { useHeadline, useHub } from "../context";
import { AGENTS, LIVE_AGENTS, WORKSPACE_SLUG, n } from "../model";
import { Mono, Oops, PageHead, RuleHead, Tile, Wait } from "../ui";
import { useRuns } from "../useRuns";
import { workspaceByAgent } from "../workspaces";

export function AgentsView() {
  const { revision, openWork, openBrief, toast } = useHub();
  const { state: feed, reload } = useRuns({ limit: 200 }, revision);
  const page = feed.data;

  const [openId] = useState<string | null>(null);
  void openId;

  const soon = AGENTS.filter((a) => !a.live);
  useHeadline(`${LIVE_AGENTS.length} live · ${soon.length} not built yet`);

  const recent = (id: string): RunRow[] =>
    (page?.runs || []).filter((r) => r.agent_id === id && r.state === "done").slice(0, 3);

  const runsFor = (id: string) => page?.facets.agents.find((a) => a.id === id)?.count ?? null;
  const weekFor = (id: string) => page?.week.by_agent.find((a) => a.id === id)?.count ?? 0;

  const open = (agentId: string) => {
    const slug = WORKSPACE_SLUG[agentId];
    if (slug) openWork(slug);
    else toast("That specialist has no workspace yet.", "warn");
  };

  return (
    <>
      <PageHead
        statement={
          <>
            {LIVE_AGENTS.length === 5 ? "Five specialists are working." : `${LIVE_AGENTS.length} specialists are working.`}{" "}
            <b>{soon.length} more</b> {soon.length === 1 ? "is" : "are"} not built yet.
          </>
        }
        lede="A specialist is defined by what it hands back, so that is what this page leads with — alongside the last three things each one actually produced."
      />

      <section className="band">
        <RuleHead
          title="Working now"
          note="Each takes a brief in plain words and returns one kind of artifact."
          aside={<span className="aside">{LIVE_AGENTS.length} of {AGENTS.length}</span>}
        />

        {feed.phase === "failed" && !page && (
          <Oops what="Could not read what each one has made." error={feed.error || ""} onRetry={reload} />
        )}

        <div className="roster">
          {LIVE_AGENTS.map((a) => {
            const made = recent(a.id);
            const stored = runsFor(a.id);
            const wk = weekFor(a.id);
            const ws = workspaceByAgent(a.id);
            return (
              <article className="spec" key={a.id}>
                <Mono agent={a} size="lg" />
                <div className="spec__id">
                  <h3>{a.name}</h3>
                  <p>{a.desc}</p>
                  {ws && (
                    <div className="spec__models">
                      {ws.sections.map((s) => <span key={s.id}>{s.label}</span>)}
                    </div>
                  )}
                </div>

                <div className="spec__makes"><b>Hands back</b>{a.makes}</div>

                <div>
                  <div className="strip">
                    {!page ? (
                      <span className="tile is-queued" aria-hidden="true" />
                    ) : made.length ? (
                      made.map((r) => (
                        <Tile key={r.id} state={r.state} image={r.image} alt={r.title} mono={a.mono} />
                      ))
                    ) : (
                      <span className="tile is-queued" aria-hidden="true" />
                    )}
                  </div>
                  <span className="strip__cap">
                    {!page ? "Reading the record" : made.length ? `Last ${made.length} handed back` : "Nothing handed back yet"}
                  </span>
                </div>

                <div className="spec__runs">
                  <u>Stored</u>
                  <b>{stored === null ? <Wait what="" /> : n(stored)}</b>
                  <em>{wk === 0 ? "none this week" : `${n(wk)} this week`}</em>
                </div>

                <div className="spec__ops">
                  {ws && (
                    <button type="button" className="btn btn--solid btn--sm" onClick={() => open(a.id)}>
                      Open workspace
                    </button>
                  )}
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => openBrief(a.id)}>
                    Give it work
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="band">
        <RuleHead
          title="Not built yet"
          note="Listed so you know what is coming and can stop waiting for what is not."
          aside={<span className="aside">{soon.length} planned</span>}
        />
        <div className="roster">
          {soon.map((a) => (
            <article className="spec spec--soon" key={a.id}>
              <Mono agent={a} size="lg" tone="is-soon" />
              <div className="spec__id">
                <h3>{a.name}</h3>
                <p>{a.desc}</p>
              </div>
              <div className="spec__makes"><b>Would hand back</b>{a.makes}</div>
              <span className="tag">Not available</span>
            </article>
          ))}
        </div>
        <p className="soon-note">
          Teams — several specialists working one brief in sequence — is the next thing after these.
          There is nothing to show yet, so there is no page for it.
        </p>
      </section>
    </>
  );
}
