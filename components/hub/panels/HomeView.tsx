"use client";

/** Home — greeted by name, then four questions in order, and it stops.
 *
 *  How did the week go, what needs me, what do I start, who have I been leaning
 *  on. The full record is one click away on Runs; putting it here as well made
 *  the front page a wall to read past.
 *
 *  Two of these are fetched and one is authored. The blockers above your list
 *  come from the issues record — one line per problem, already in plain words —
 *  plus the SEO overview's per-brand fix counts; the week's figures and the
 *  live rows come from the record. The list itself is yours, kept in this browser
 *  — which the panel says, because a list that quietly does not follow you to
 *  another machine is worse than one that admits it.
 */

import { useEffect, useState } from "react";
import { getIssues, seoOverview, type IssueFix, type IssuesPayload, type SeoOverview } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub } from "../context";
import { LIVE_AGENTS, WORKSPACE_SLUG, Cap, agentById, greeting, n, word } from "../model";
import { Ic } from "../Sprite";
import { Mono, Oops, PageHead, RuleHead, Wait } from "../ui";
import { Ledger } from "../RunLedger";
import { useRuns } from "../useRuns";
import { JOBS } from "../jobs";
import { daysBetween, shiftDay, todayKey, useTasks, type Task } from "../useTasks";
import { dayLabel } from "../format";
import { homeIssues, needsBrandTag, routeForFix } from "./issues";

/** How far back the day pager goes. The same seven days every other figure on
 *  this page uses. */
const OLDEST_BACK = 6;

export function HomeView() {
  const { user, revision, openWork, openBrief, go, toast } = useHub();
  const session = useLoadSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const [seo, setSeo] = useState<Load<SeoOverview>>(loadPending);
  const [issues, setIssues] = useState<Load<IssuesPayload>>(loadPending);
  const [beat, setBeat] = useState(0);

  const { state: feed, reload } = useRuns({ limit: 60 }, revision);
  const page = feed.data;

  useEffect(() => {
    void session.run(
      "seo-overview",
      (signal) => seoOverview({ signal }),
      setSeo,
      "What is outstanding could not be read.",
      { keepStale: true },
    );
    void session.run(
      "issues",
      (signal) => getIssues({ signal }),
      setIssues,
      "What is wrong could not be read.",
      { keepStale: true },
    );
  }, [session, revision, beat]);

  const tasks = useTasks();
  const today = todayKey();
  const [day, setDay] = useState(today);

  const weekDone = page?.week.done ?? null;
  const running = page?.live.running ?? 0;
  const queued = page?.live.queued ?? 0;

  useHeadline(
    page
      ? `${n(weekDone ?? 0)} finished this week · ${n(running)} running · ${n(queued + tasks.open)} on your list`
      : "reading the record",
  );

  const firstName = (user.name || user.email || "").split(/[\s@]/)[0] || "there";
  const live = (page?.runs || []).filter((r) => r.state === "running" || r.state === "queued");

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
            {weekDone === null
              ? <>Reading what your specialists made this week.</>
              : weekDone === 0
                ? <>Your specialists made <b>nothing</b> this week.</>
                : <>Your specialists made <b>{word(weekDone)} thing{weekDone === 1 ? "" : "s"}</b> this week.</>}
          </>
        }
        lede="Anything that needs you is at the top. Below that: start something, and how the week actually went."
      />

      <YourList
        day={day}
        setDay={setDay}
        tasks={tasks}
        blockers={<Blockers seo={seo} issues={issues} onRetry={() => setBeat((b) => b + 1)} failedThisWeek={page?.week.failed ?? 0} go={go} openWork={openWork} />}
      />

      <section className="band">
        <RuleHead title="Start something" note="Pick the specialist, then the job. Nothing needs typing." />
        <ComposeRow onBrief={openBrief} onOpen={openSlug} />
      </section>

      <ThisWeek page={page} onBrief={openBrief} />

      {feed.phase === "failed" && !page ? (
        <Oops what="The record could not be read." error={feed.error || ""} onRetry={reload} />
      ) : !page ? (
        <Wait what="Reading the record" rows={3} />
      ) : live.length > 0 ? (
        <section className="band">
          <RuleHead
            title="Right now"
            note="What is running, and what is waiting behind it."
            aside={
              <button type="button" className="aside aside--go" onClick={() => go("runs")}>
                {page.total === null ? "The whole record" : `All ${n(page.total)} runs`}
                <Ic name="chevron" />
              </button>
            }
          />
          <Ledger
            runs={live}
            grouped={false}
            openId={openId}
            onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
            onOpenWorkspace={(id) => openSlug(id)}
          />
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- the shop's blockers -- */

/** One line per problem, most severe first, and never a paragraph. The lines
 *  come from the issues record — the backend has already turned each raw
 *  signal ("<HttpError 403 …>") into a sentence a person can act on — topped
 *  by the one rule only this page can see (failed runs this week) and tailed
 *  by the per-brand fix counts the SEO overview carries. */
function Blockers({
  seo, issues, onRetry, failedThisWeek, go, openWork,
}: {
  seo: Load<SeoOverview>;
  issues: Load<IssuesPayload>;
  onRetry: () => void;
  failedThisWeek: number;
  go: (p: "runs" | "issues" | "settings") => void;
  openWork: (slug: string, subject?: string, section?: string) => void;
}) {
  const seoDown = seo.phase === "failed" && !seo.data;
  const issuesDown = issues.phase === "failed" && !issues.data;
  if ((seo.phase === "loading" && !seo.data) || (issues.phase === "loading" && !issues.data)) {
    return <Wait what="Checking what the shop needs from you" />;
  }
  if (seoDown && issuesDown) {
    return <Oops what="Could not read what is outstanding." error={issues.error || seo.error || ""} onRetry={onRetry} />;
  }

  const openFix = (fix: IssueFix) => {
    const to = routeForFix(fix);
    if (to.kind === "panel") go(to.panel);
    else openWork(to.workspace, to.subject, to.section);
  };

  const pick = issues.data ? homeIssues(issues.data) : { top: [], more: false, remaining: 0 };
  const brands = seo.data?.brands || [];
  const items: {
    key: string; bad?: boolean; brand?: string; title: string; note: string;
    act?: string; run?: () => void;
  }[] = [];

  if (failedThisWeek > 0) {
    items.push({
      key: "failed",
      bad: true,
      title: `${word(failedThisWeek)} run${failedThisWeek === 1 ? "" : "s"} failed this week`,
      note: "A failed run is kept on purpose. Open it to see where it stopped.",
      act: "Open the record",
      run: () => go("runs"),
    });
  }

  // A read that failed is a blocker in its own right — never a silent gap the
  // reader would take for health.
  if (issuesDown) {
    items.push({
      key: "issues-down",
      bad: true,
      title: "What is wrong could not be read",
      note: issues.error || "The issues record did not answer.",
      act: "Try again",
      run: onRetry,
    });
  }

  pick.top.forEach((i) => {
    const fix = i.fix;
    items.push({
      key: `is-${i.id}`,
      bad: i.severity === "high",
      brand: needsBrandTag(i) ? i.brand : undefined,
      title: i.title,
      note: i.detail,
      act: fix?.label,
      run: fix ? () => openFix(fix) : undefined,
    });
  });

  if (seoDown) {
    items.push({
      key: "seo-down",
      bad: true,
      title: "What is outstanding could not be read",
      note: seo.error || "The SEO overview did not answer.",
      act: "Try again",
      run: onRetry,
    });
  }

  brands.forEach((b) => {
    const count = b.last_run?.todo_count ?? 0;
    if (count === 0) return;
    items.push({
      key: `fx-${b.brand.id}`,
      title: `${n(count)} open fix${count === 1 ? "" : "es"} on ${b.brand.name}`,
      note: "Ranked by what each one is worth, highest first.",
      act: "Work the list",
      run: () => openWork("seo", b.brand.id, "fixes"),
    });
  });

  if (!items.length && !pick.more) return null;

  return (
    <>
      <ol className="prio">
        {items.map((i) => (
          <li className={`prio__i${i.bad ? " is-bad" : ""}`} key={i.key}>
            <span className="prio__n" aria-hidden="true">!</span>
            <div>
              {i.brand && (
                <>
                  <span><span className="tag">{i.brand}</span></span>{" "}
                </>
              )}
              <b>{i.title}</b> <span>{i.note}</span>
            </div>
            {i.act && i.run && <button type="button" onClick={i.run}>{i.act}</button>}
          </li>
        ))}
        {pick.more && (
          <li className="prio__i" key="more">
            <span className="prio__n" aria-hidden="true">·</span>
            <div>
              <span>
                {pick.remaining > 0
                  ? `${Cap(word(pick.remaining))} more ${pick.remaining === 1 ? "is" : "are"} on the full list.`
                  : "The full list carries the detail."}
              </span>
            </div>
            <button type="button" onClick={() => go("issues")}>All issues</button>
          </li>
        )}
      </ol>
      {items.length > 0 && (
        <p className="prio__from">
          {items.length === 1 ? "That one came" : `Those ${items.length} came`} from the shop, so{" "}
          {items.length === 1 ? "it cannot" : "they cannot"} be ticked —{" "}
          {items.length === 1 ? "it clears" : "they clear"} once fixed.
        </p>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- your list -- */

function YourList({
  day, setDay, tasks, blockers,
}: {
  day: string;
  setDay: (d: string) => void;
  tasks: ReturnType<typeof useTasks>;
  blockers: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const today = todayKey();
  const isToday = day === today;
  const back = daysBetween(day, today);
  const [short, long] = dayLabel(`${day}T12:00:00`);

  const mine = tasks.forDay(day);
  const open = mine.filter((t) => !t.done);
  const shut = mine.filter((t) => t.done);

  const line = (t: Task) => (
    <li className={`task${t.done ? " is-done" : ""}`} key={t.id}>
      <button
        type="button"
        className="task__tick"
        role="checkbox"
        aria-checked={t.done}
        disabled={!isToday}
        onClick={() => tasks.tick(t.id)}
        aria-label={`${t.done ? "Reopen" : "Finish"}: ${t.text}`}
      >
        <Ic name="check" />
      </button>
      <span className="task__t">
        {t.text}
        {!t.done && isToday && daysBetween(t.day, today) > 0 && (
          <em className="task__age" title={`Raised on ${dayLabel(`${t.day}T12:00:00`)[1]}`}>
            {daysBetween(t.day, today)}d
          </em>
        )}
      </span>
      {isToday && (
        <span className="task__ops">
          {!t.done && (
            <button type="button" onClick={() => tasks.lift(t.id)} aria-label={`Move up: ${t.text}`}>
              <Ic name="up" />
            </button>
          )}
          <button type="button" onClick={() => tasks.drop(t.id)} aria-label={`Delete: ${t.text}`}>
            <Ic name="x" />
          </button>
        </span>
      )}
    </li>
  );

  return (
    <section className="band">
      <RuleHead
        title="Your list"
        note={
          isToday
            ? "Yours to rank, kept in this browser. Anything unfinished stays here until it is done."
            : `What was raised and what was crossed off on ${long}. Past days are read-only.`
        }
        aside={
          <span className="days">
            <button
              type="button"
              className="days__b"
              disabled={back >= OLDEST_BACK}
              onClick={() => setDay(shiftDay(day, -1))}
              aria-label="Previous day"
            >
              <Ic name="chevron" />
            </button>
            <b>{short}</b>
            <button
              type="button"
              className="days__b"
              disabled={isToday}
              onClick={() => setDay(shiftDay(day, 1))}
              aria-label="Next day"
            >
              <Ic name="chevron" />
            </button>
          </span>
        }
      />

      {isToday && (
        <form
          className="add"
          onSubmit={(e) => { e.preventDefault(); tasks.add(text); setText(""); }}
        >
          <span className="add__x" aria-hidden="true"><Ic name="plus" /></span>
          <input
            type="text"
            maxLength={140}
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add something you need to do"
            aria-label="Add a task to your list"
          />
          <button type="submit" className="btn btn--quiet btn--sm">Add</button>
        </form>
      )}

      {isToday && blockers}

      {!tasks.ready ? (
        <Wait what="Opening your list" />
      ) : open.length ? (
        <ol className="tasks">{open.map(line)}</ol>
      ) : (
        <p className="calm">
          {isToday
            ? "Nothing on your list."
            : shut.length
              ? `Everything raised on ${long} was crossed off.`
              : "Nothing was raised on this day."}
        </p>
      )}

      {shut.length > 0 && (
        <details className="shut" open={!isToday}>
          <summary>{shut.length} crossed off{isToday ? " today" : ""}</summary>
          <ol className="tasks">{shut.map(line)}</ol>
        </details>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- start something -- */

function ComposeRow({
  onBrief, onOpen,
}: {
  onBrief: (agentId: string) => void;
  onOpen: (agentId: string, section?: string) => void;
}) {
  const [who, setWho] = useState(LIVE_AGENTS[0].id);
  const agent = agentById(who)!;
  const jobs = JOBS[who] || [];

  return (
    <div className="compose">
      <div className="compose__top">
        <div className="compose__who" role="radiogroup" aria-label="Which specialist">
          {LIVE_AGENTS.map((a) => (
            <button
              type="button"
              key={a.id}
              role="radio"
              aria-checked={a.id === who}
              aria-label={a.name}
              title={a.name}
              className={a.id === who ? "is-on" : ""}
              onClick={() => setWho(a.id)}
            >
              {a.mono}
            </button>
          ))}
        </div>
        <p className="compose__says">
          <b>{agent.name}</b> hands back {agent.makes.replace(/^A /, "a ").replace(/\.$/, "")}. Pick a job, or open it.
        </p>
      </div>

      <div className="compose__jobs">
        {jobs.map((j) => (
          <button
            type="button"
            className="job"
            key={j.label}
            title={j.brief || `Opens ${agent.name} at ${j.label}`}
            onClick={() => (j.brief ? onBrief(who) : onOpen(who, j.section))}
          >
            <b>{j.label}</b>
            <span>{j.spec}</span>
          </button>
        ))}
      </div>

      <div className="compose__else">
        <p className="compose__hint">
          Or hand it something of your own — {agent.name} asks for what it needs before it starts.
        </p>
        <span className="compose__acts">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => onOpen(who)}>
            Open {agent.name}
          </button>
          <button type="button" className="btn btn--mark btn--sm compose__go" onClick={() => onBrief(who)}>
            <Ic name="send" />
            Give it work
          </button>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ this week -- */

/** Who you actually leaned on, over the same seven days every other figure here
 *  uses. The prototype put each specialist's 30-day spend beside its name; that
 *  figure does not exist per agent — nothing records it — so this counts runs,
 *  which it can. */
function ThisWeek({ page, onBrief }: { page: { week: { total: number; by_agent: { id: string; name: string; count: number }[] } } | null; onBrief: (id: string) => void }) {
  if (!page) return null;
  const rows = page.week.by_agent;
  if (!rows.length) return null;

  const top = rows[0];
  const max = top.count || 1;
  const topAgent = agentById(top.id);

  return (
    <section className="band">
      <RuleHead
        title="This week"
        note="Which specialist you leaned on over the last seven days, and how often."
        aside={<span className="aside">{n(page.week.total)} runs</span>}
      />

      {topAgent && (
        <div className="lean">
          <Mono agent={topAgent} size="lg" />
          <div>
            <b>{topAgent.name}</b>
            <p>
              Your most-used specialist this week — {word(top.count)} of {word(page.week.total)} runs.
            </p>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => onBrief(top.id)}>
            <Ic name="send" />
            Give it a job
          </button>
        </div>
      )}

      <div className="usage">
        {rows.map((r, i) => {
          const a = agentById(r.id);
          return (
            <div className="use" key={r.id}>
              <span className="use__k">
                <Mono agent={{ mono: a?.mono || r.name.slice(0, 2).toUpperCase() }} size="sm" />
                <em>{r.name}</em>
              </span>
              <span className="use__bar">
                <i style={{ transform: `scaleX(${(r.count / max).toFixed(3)})` }} className={i === 0 ? "is-top" : ""} />
              </span>
              <span className="use__v">{r.count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
