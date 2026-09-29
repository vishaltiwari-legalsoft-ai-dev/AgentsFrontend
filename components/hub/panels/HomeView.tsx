"use client";

/** Home — the field guide.
 *
 *  The old front page tried to be a dashboard: a personal list, the shop's
 *  blockers, a composer, usage bars and the live ledger, all at once — and
 *  read as none of them. What people actually asked of it was orientation:
 *  which specialists exist, how do I use each one, and the handful of
 *  questions everyone has in their first week.
 *
 *  So Home now answers exactly that, in three moves: how the hub works in one
 *  strip, a usage manual per specialist (with its quick-start jobs folded
 *  inside), and the FAQ. Everything operational lives where it belongs —
 *  what needs you on Issues, what is running on Runs — and the two quiet
 *  links at the foot go there.
 *
 *  Nothing here is fetched. The guide is authored (`../guide`), so the front
 *  page opens instantly and can never greet somebody with an error card.
 */

import { useState } from "react";
import { useHeadline, useHub } from "../context";
import { FAQS, GUIDES } from "../guide";
import { JOBS } from "../jobs";
import { WORKSPACE_SLUG, agentsFor, greeting, word, type HubAgent } from "../model";
import { Ic } from "../Sprite";
import { Mono, PageHead, RuleHead } from "../ui";

export function HomeView() {
  const { user, openWork, openBrief, go, toast } = useHub();

  useHeadline("the field guide to your specialists");

  const firstName = (user.name || user.email || "").split(/[\s@]/)[0] || "there";
  const mine = agentsFor(user);

  const openSlug = (agentId: string, section?: string) => {
    const slug = WORKSPACE_SLUG[agentId];
    if (slug) openWork(slug, "", section || "");
    else toast("That specialist has no workspace yet.", "warn");
  };

  return (
    <>
      <PageHead
        statement={
          <>
            {greeting()}, {firstName}.<br />
            You have <b>{word(mine.length)} specialist{mine.length === 1 ? "" : "s"}</b> on staff.
          </>
        }
        lede="Each one is a colleague with a single job. Below: how the hub works, how to put each specialist to work, and the questions everyone asks."
      />

      <section className="band">
        <div className="hgw">
          <div className="hgw__s">
            <span className="hgw__n" aria-hidden="true">1</span>
            <b>Brief it</b>
            <p>Pick a specialist and hand it work — a ready-made job, or a brief in your own words.</p>
          </div>
          <div className="hgw__s">
            <span className="hgw__n" aria-hidden="true">2</span>
            <b>It runs</b>
            <p>Every job files a run you can watch on Runs — queued, running, done. Failures are kept and say where they stopped.</p>
          </div>
          <div className="hgw__s">
            <span className="hgw__n" aria-hidden="true">3</span>
            <b>Collect the work</b>
            <p>The finished thing waits in the specialist's workspace — creatives are archived to the Library as well.</p>
          </div>
        </div>
      </section>

      <section className="band">
        <RuleHead
          title="The specialists"
          note="Open a manual for the path through a first run — each one takes about a minute to read."
        />
        <div className="hg">
          {mine.map((a) => (
            <GuideCard key={a.id} agent={a} onBrief={openBrief} onOpen={openSlug} />
          ))}
        </div>
      </section>

      <section className="band">
        <RuleHead title="Questions everyone asks" note="The first-week questions, answered once." />
        <Faqs />
      </section>

      <p className="hgfoot">
        Looking for what needs you?{" "}
        <button type="button" onClick={() => go("issues")}>Issues</button>
        {" "}· Watching something run?{" "}
        <button type="button" onClick={() => go("runs")}>Runs</button>
      </p>
    </>
  );
}

/* ------------------------------------------------------------ one manual -- */

function GuideCard({
  agent, onBrief, onOpen,
}: {
  agent: HubAgent;
  onBrief: (agentId: string) => void;
  onOpen: (agentId: string, section?: string) => void;
}) {
  const guide = GUIDES[agent.id];
  const jobs = JOBS[agent.id] || [];

  return (
    <article className="hg__card">
      <header className="hg__top">
        <Mono agent={agent} size="lg" />
        <div className="hg__id">
          <b>{agent.name}</b>
          <em>{agent.role}</em>
        </div>
      </header>

      <p className="hg__what">{agent.desc}</p>

      {guide && (
        <details className="hg__more">
          <summary>
            <Ic name="chevron" />
            How to use it
          </summary>

          <div className="hg__manual">
            <p className="hg__when">
              <b>Reach for it when:</b> {guide.when}
            </p>

            <ol className="hg__steps">
              {guide.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>

            <p className="hg__gets">
              <b>You get:</b> {guide.gets}
            </p>

            {guide.tip && (
              <p className="hg__tip">
                <b>Worth knowing:</b> {guide.tip}
              </p>
            )}

            {jobs.length > 0 && (
              <div className="hg__jobs" aria-label={`Ready-made jobs for ${agent.name}`}>
                {jobs.map((j) => (
                  <button
                    type="button"
                    key={j.label}
                    className="hg__job"
                    title={j.brief || `Opens ${agent.name} at ${j.label}`}
                    onClick={() => (j.brief ? onBrief(agent.id) : onOpen(agent.id, j.section))}
                  >
                    <b>{j.label}</b>
                    <span>{j.spec}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      <footer className="hg__acts">
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => onOpen(agent.id)}>
          Open workspace
        </button>
        <button type="button" className="btn btn--mark btn--sm" onClick={() => onBrief(agent.id)}>
          <Ic name="send" />
          Give it work
        </button>
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------------- FAQ -- */

/** One open at a time: reading two answers at once is never the goal, and a
 *  page of all-open accordions is just a long document with extra chrome. */
function Faqs() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="hgfaq">
      {FAQS.map((f, i) => (
        <details
          key={f.q}
          open={open === i}
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open) setOpen(i);
            else if (open === i) setOpen(null);
          }}
        >
          <summary>
            {f.q}
            <Ic name="plus" />
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
