"use client";

/** Agents — the roster, reduced to the three things a reader actually needs:
 *  who the specialist is, what it does, and the button that launches it.
 *
 *  Each card wears the specialist's own mark (one Lucide face per agent, keyed
 *  by id in the sprite map) instead of a letter stamp, and carries nothing
 *  else: no run counts, no artifact strips, no section chips. The record of
 *  what each one produced lives on Runs, where the record belongs.
 */

import { useHeadline, useHub } from "../context";
import { AGENTS, Cap, LIVE_AGENTS, WORKSPACE_SLUG, agentsFor, word } from "../model";
import { Ic } from "../Sprite";
import { PageHead, RuleHead } from "../ui";

export function AgentsView() {
  const { user, openWork, toast } = useHub();

  // This rail entry is how GEO is reached, so it stays for a scoped account —
  // but the four specialists it cannot open are not drawn as cards it can
  // press, and the roadmap of unbuilt ones is not its business either.
  const mine = agentsFor(user);
  const scoped = mine.length < LIVE_AGENTS.length;
  const soon = scoped ? [] : AGENTS.filter((a) => !a.live);
  useHeadline(
    scoped
      ? `${mine.length} open to you · ${LIVE_AGENTS.length} live in this workspace`
      : `${LIVE_AGENTS.length} live · ${soon.length} not built yet`,
  );

  const launch = (agentId: string) => {
    const slug = WORKSPACE_SLUG[agentId];
    if (slug) openWork(slug);
    else toast("That specialist has no workspace yet.", "warn");
  };

  return (
    <>
      <PageHead
        statement={
          scoped ? (
            <>
              {mine.length === 1 ? <><b>{mine[0].name}</b> is open to you.</> : <><b>{mine.length} specialists</b> are open to you.</>}
            </>
          ) : (
            <>
              {Cap(word(LIVE_AGENTS.length))} specialists are working.{" "}
              <b>{soon.length} more</b> {soon.length === 1 ? "is" : "are"} not built yet.
            </>
          )
        }
        lede="Each one takes a brief in plain words and hands back one kind of finished thing. Launch the one whose work you need."
      />

      <section className="band">
        <RuleHead
          title="Working now"
          note="Launch opens the specialist's workspace."
          aside={<span className="aside">{scoped ? `${mine.length} of ${LIVE_AGENTS.length} live` : `${LIVE_AGENTS.length} of ${AGENTS.length}`}</span>}
        />

        <div className="acards">
          {mine.map((a) => (
            <article className="acard" key={a.id}>
              <span className="acard__ic"><Ic name={a.id} /></span>
              <h3>{a.name}</h3>
              <p>{a.desc}</p>
              <button type="button" className="acard__go" onClick={() => launch(a.id)}>
                Launch
                <Ic name="chevron" />
              </button>
            </article>
          ))}
        </div>

        {scoped && (
          <p className="soon-note">
            The rest of the roster belongs to this workspace but is not open to your account, so it
            is not listed here.
          </p>
        )}
      </section>

      {!scoped && (
      <section className="band">
        <RuleHead
          title="Not built yet"
          note="Listed so you know what is coming and can stop waiting for what is not."
          aside={<span className="aside">{soon.length} planned</span>}
        />
        <div className="acards">
          {soon.map((a) => (
            <article className="acard is-soon" key={a.id}>
              <span className="acard__ic"><Ic name={a.id} /></span>
              <h3>{a.name}</h3>
              <p>{a.desc}</p>
              <span className="acard__soon">Not available yet</span>
            </article>
          ))}
        </div>
        <p className="soon-note">
          Teams — several specialists working one brief in sequence — is the next thing after these.
          There is nothing to show yet, so there is no page for it.
        </p>
      </section>
      )}
    </>
  );
}
