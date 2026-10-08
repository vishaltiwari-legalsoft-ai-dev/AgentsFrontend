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
 *  The guide is not fetched. It is authored (`../guide`), so the front page
 *  opens instantly and can never greet somebody with an error card. The two
 *  usage blocks between the hero and the specialists are fetched — what your
 *  reportees asked of the agents, and for an admin what humans ran per month —
 *  and they own their own loading: the hero and the guide never wait on them,
 *  and a failure there is one card below the greeting, never the greeting.
 */

import { useCallback, useEffect, useState } from "react";
import {
  apiStatus, teamUsage,
  type HumansMonth, type HumansUsage, type TeamReportee, type TeamUsage, type TeamUsageTeam,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub } from "../context";
import Cosmos from "../Cosmos";
import { FAQS, GUIDES } from "../guide";
import { JOBS } from "../jobs";
import { WORKSPACE_SLUG, agentsFor, greeting, n, word, type HubAgent } from "../model";
import { ago, clock } from "../format";
import {
  ROW_NOTE, agentChips, hasExtras, monthLabel, monthsNewestFirst, rowState,
  summaryNote, teamSummary, usersByRuns, windowNote,
} from "../teamUsage";
import { Ic } from "../Sprite";
import { Blank, Oops, RuleHead, Wait } from "../ui";

export function HomeView() {
  const { user, revision, openWork, openBrief, go, toast } = useHub();

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

      {/* A GEO-only account is refused this read with a 403, like every other
          route outside its allowance, so it is never asked. */}
      {!user.is_geo_only && <UsageBlocks revision={revision} />}

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

/* ------------------------------------------------------ the usage blocks -- */

/** One read for both bands, bound to `lib/load` the way `useRuns` is. Re-read
 *  when the console's revision moves and when the window regains focus — a
 *  manager glancing back at the tab after a reportee's run should see it —
 *  and nothing more aggressive than that.
 *
 *  A 404 is the backend not serving this endpoint yet (the frontend deploys
 *  minutes ahead of Cloud Run), and the right rendering of that is nothing:
 *  `data` becomes `null` while the phase is `ready`, which the blocks read as
 *  "no sections". Every other failure is shown, with a retry. */
function useTeamUsage(revision: number) {
  const session = useLoadSession();
  const [state, setState] = useState<Load<TeamUsage | null>>(loadPending);
  const [beat, setBeat] = useState(0);
  const reload = useCallback(() => setBeat((b) => b + 1), []);

  useEffect(() => {
    void session.run(
      "team-usage",
      (signal) => teamUsage(3, { signal }).catch((e: unknown) => {
        if (apiStatus(e) === 404) return null;
        throw e;
      }),
      setState,
      "Usage could not be read.",
      // A focus refresh that fails must not blank numbers already on screen.
      { keepStale: true },
    );
  }, [session, revision, beat]);

  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  return { state, reload };
}

function UsageBlocks({ revision }: { revision: number }) {
  const { state, reload } = useTeamUsage(revision);
  const data = state.data;

  if (state.phase === "failed" && !data) {
    return (
      <section className="band tu">
        <Oops what="Usage could not be read." error={state.error || ""} onRetry={reload} />
      </section>
    );
  }
  if (state.phase === "loading" && !data) {
    return <div className="tu tu--wait"><Wait what="Reading usage" /></div>;
  }
  // Ready with nothing: the backend does not serve this yet, or the reader is
  // a plain member. Home is exactly what it was.
  if (!data || !hasExtras(data)) return null;

  return (
    <>
      {data.team && <TeamBand team={data.team} />}
      {data.humans && <HumansBand humans={data.humans} generatedAt={data.generated_at} />}
    </>
  );
}

/* --- your team --- */

function TeamBand({ team }: { team: TeamUsageTeam }) {
  const rows = team.reportees;
  const summary = teamSummary(team);
  const who = `${n(rows.length)} reportee${rows.length === 1 ? "" : "s"}`;

  return (
    <section className="band tu">
      <RuleHead
        title="Your team"
        note="What your reportees asked of the specialists — today, the last seven days, this month."
        aside={<span className="aside">{who}</span>}
      />
      {rows.length === 0 ? (
        <Blank title="Nobody reports to you on the chart yet.">
          When the chart lists someone under you, what they ask of the specialists appears here.
        </Blank>
      ) : (
        <div className="tu__scroll">
          <table className="tbl tu__tbl">
            <caption className="vh">Agent usage by your reportees</caption>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col" className="num">Today</th>
                <th scope="col" className="num">Week</th>
                <th scope="col" className="num">Month</th>
                <th scope="col">Agents</th>
                <th scope="col">Last run</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <ReporteeRow key={`${r.user_id ?? r.email ?? r.name}-${i}`} r={r} />)}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{n(team.totals.today)}</td>
                <td className="num">{n(team.totals.week)}</td>
                <td className="num">{n(team.totals.month)}</td>
                <td colSpan={2} className="dim">{summaryNote(summary)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="tu__foot">{windowNote(team)}</p>
    </section>
  );
}

/** A row that is not counted shows why, where its figures would be — never a
 *  zero, which would be a claim that this person did nothing. */
function ReporteeRow({ r }: { r: TeamReportee }) {
  const state = rowState(r);
  const chips = state === "counted" ? agentChips(r.by_agent) : [];

  return (
    <tr className={`tu__r is-${state}`}>
      <td>
        <b>{r.name}</b>
        {r.title && <span className="sub">{r.title}</span>}
      </td>
      {state === "counted" ? (
        <>
          <td className="num">{n(r.today)}</td>
          <td className="num">{n(r.week)}</td>
          <td className="num">{n(r.month)}</td>
          <td>
            {chips.length > 0 ? (
              <ul className="chips tu__chips" aria-label={`Specialists ${r.name} used this month`}>
                {chips.map((c) => (
                  <li key={c.id} className="chip" title={`${c.name}: ${n(c.count)} this month`}>
                    <span className="chip__n">{n(c.count)}</span>{c.name}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="dim">—</span>
            )}
          </td>
          <td className="dim">
            {r.last_run_at ? <span title={r.last_run_at}>{ago(r.last_run_at)}</span> : "—"}
          </td>
        </>
      ) : (
        <>
          <td colSpan={3}>
            <span className={`tag${state === "unread" ? " is-bad" : ""}`}>{ROW_NOTE[state]}</span>
          </td>
          <td className="dim">—</td>
          <td className="dim">—</td>
        </>
      )}
    </tr>
  );
}

/* --- by humans --- */

function HumansBand({ humans, generatedAt }: { humans: HumansUsage; generatedAt: string }) {
  const months = monthsNewestFirst(humans.months);
  const at = clock(generatedAt);

  return (
    <section className="band tu">
      <RuleHead
        title="Agent usage by humans"
        note={humans.excluded}
        aside={at ? <span className="aside">as of {at}</span> : undefined}
      />
      {months.length === 0 ? (
        <Blank title="Nothing has been recorded yet.">
          Runs that people start appear here by month, with who started them.
        </Blank>
      ) : (
        <div className="tu__months">
          {months.map((m) => <MonthFold key={m.year_month} month={m} />)}
        </div>
      )}
    </section>
  );
}

/** A native disclosure: the month line is the control, the people are inside. */
function MonthFold({ month }: { month: HumansMonth }) {
  const users = usersByRuns(month.by_user);
  const label = monthLabel(month.year_month);

  return (
    <details className="tu__month">
      <summary>
        <b>{label}</b>
        <span className="num">{n(month.runs)} run{month.runs === 1 ? "" : "s"}</span>
        <span className="num">{n(month.users)} {month.users === 1 ? "person" : "people"}</span>
        <Ic name="chevron" />
      </summary>
      {users.length === 0 ? (
        <p className="tu__none">Nobody is on record for this month.</p>
      ) : (
        <div className="tu__scroll">
          <table className="tbl tu__tbl">
            <caption className="vh">Who ran the specialists in {label}</caption>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Email</th>
                <th scope="col" className="num">Runs</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td><b>{u.name || u.email}</b></td>
                  <td className="dim">{u.email}</td>
                  <td className="num">{n(u.runs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
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
            <span className="hgm__ic" data-a={a.id} aria-hidden="true"><Ic name={a.id} /></span>
            <span className="hgm__who">
              <b>{a.name}</b>
              <em>{a.role}</em>
            </span>
          </button>
        ))}
      </nav>

      <article className="hgm__detail" key={agent.id}>
        <header className="hgm__head">
          <span className="hgm__badge" data-a={agent.id} aria-hidden="true"><Ic name={agent.id} /></span>
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
