"use client";

/** Home — the field guide, contained.
 *
 *  Orientation, in three moves that stay out of each other's way: how the hub
 *  works in one slim line, the specialists in a single master–detail module
 *  (their list on the left, one manual open on the right — never six cards
 *  fighting down the page), and the FAQ in two quiet columns. Everything
 *  operational lives where it belongs — what needs you on Issues, what is
 *  running on Runs — and the two links at the foot go there.
 *
 *  Nothing here is fetched. The guide is authored (`../guide`), so the front
 *  page opens instantly and can never greet somebody with an error card.
 */

import { useState } from "react";
import { useHeadline, useHub } from "../context";
import Cosmos from "../Cosmos";
import { FAQS, GUIDES } from "../guide";
import { JOBS } from "../jobs";
import { WORKSPACE_SLUG, agentsFor, greeting, word, type HubAgent } from "../model";
import { Ic } from "../Sprite";
import { Mono, RuleHead } from "../ui";

export function HomeView() {
  const { user, openWork, openBrief, go, toast } = useHub();

  useHeadline("the field guide to your specialists");

  const firstName = (user.name || user.email || "").split(/[\s@]/)[0] || "there";
  const mine = agentsFor(user);

  // The cosmos and the manual share one selection: picking a planet up in
  // the hero opens that specialist's manual below — the decoration is also
  // a door.
  const [picked, setPicked] = useState<string | null>(null);
  const pickFromCosmos = (id: string) => {
    setPicked(id);
    document.getElementById("specialists")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openSlug = (agentId: string, section?: string) => {
    const slug = WORKSPACE_SLUG[agentId];
    if (slug) openWork(slug, "", section || "");
    else toast("That specialist has no workspace yet.", "warn");
  };

  return (
    <>
      {/* The hero: the greeting choreographed line by line on the left, and
          on the right the cosmos — AI at the centre, the staff in orbit
          around it (see Cosmos). */}
      <div className="hero">
        <div className="hero__copy">
          <p className="statement">
            <span className="hero__line"><span>{greeting()}, {firstName}.</span></span>
            <span className="hero__line">
              <span>You have <b>{word(mine.length)} specialist{mine.length === 1 ? "" : "s"}</b> on staff.</span>
            </span>
          </p>
          <p className="lede">
            <span className="hgw">
              <span><b>1</b> Brief one</span>
              <i aria-hidden="true" />
              <span><b>2</b> Watch the run on Runs</span>
              <i aria-hidden="true" />
              <span><b>3</b> Collect it in the workspace</span>
            </span>
          </p>
        </div>

        <div className="hero__stage">
          <Cosmos agents={mine} onPick={pickFromCosmos} />
        </div>
      </div>

      {mine.length > 0 && (
        <section className="band" id="specialists">
          <RuleHead
            title="The specialists"
            note="Pick one — its manual opens beside the list, and takes a minute to read."
          />
          <GuideModule
            agents={mine}
            selected={picked ?? mine[0].id}
            onSelect={setPicked}
            onBrief={openBrief}
            onOpen={openSlug}
          />
        </section>
      )}

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

/* -------------------------------------------------- the specialists module -- */

function GuideModule({
  agents, selected, onSelect, onBrief, onOpen,
}: {
  agents: HubAgent[];
  selected: string;
  onSelect: (id: string) => void;
  onBrief: (agentId: string) => void;
  onOpen: (agentId: string, section?: string) => void;
}) {
  const agent = agents.find((a) => a.id === selected) || agents[0];
  const guide = GUIDES[agent.id];
  const jobs = JOBS[agent.id] || [];

  return (
    <div className="hgm">
      <nav className="hgm__list" aria-label="Specialists">
        {agents.map((a) => (
          <button
            type="button"
            key={a.id}
            className={`hgm__row${a.id === agent.id ? " is-on" : ""}`}
            aria-current={a.id === agent.id ? "true" : undefined}
            onClick={() => onSelect(a.id)}
          >
            <Mono agent={a} />
            <span className="hgm__who">
              <b>{a.name}</b>
              <em>{a.role}</em>
            </span>
          </button>
        ))}
      </nav>

      <article className="hgm__detail" key={agent.id}>
        <header className="hgm__head">
          <div className="hgm__id">
            <b>{agent.name}</b>
            <em>{agent.desc}</em>
          </div>
          <span className="hgm__acts">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => onOpen(agent.id)}>
              Open workspace
            </button>
          </span>
        </header>

        {guide && (
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
        )}
      </article>
    </div>
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
