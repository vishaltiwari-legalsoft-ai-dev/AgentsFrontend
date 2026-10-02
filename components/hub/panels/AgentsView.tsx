"use client";

/** Agents — the staff, drawn as the product's hero shelf.
 *
 *  Six deep-ink cards on the white paper, one per specialist. Each card
 *  carries the agent's own hue as an aurora in the glass, its own mark in a
 *  glowing chip, the role as an eyebrow, one sentence of work, and Launch.
 *  Nothing else: the record of what each one produced lives on Runs.
 *
 *  The five that are only promised are a quiet list, not a second grid —
 *  they are information, not merchandise.
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
            <article className="acard" data-a={a.id} key={a.id}>
              <span className="acard__aur" aria-hidden="true" />
              <span className="acard__ic"><Ic name={a.id} /></span>
              <span className="acard__role"><i aria-hidden="true" />{a.role}</span>
              <h3>{a.name}</h3>
              <p title={a.desc}>{a.desc}</p>
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
        <div className="asoon">
          {soon.map((a) => (
            <div className="asoon__row" key={a.id}>
              <span className="asoon__ic"><Ic name={a.id} /></span>
              <b>{a.name}</b>
              <span>{a.desc}</span>
              <em>Not yet</em>
            </div>
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
