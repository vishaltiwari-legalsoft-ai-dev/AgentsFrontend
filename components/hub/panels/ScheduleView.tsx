"use client";

/** Schedule — every job that runs on its own clock, and whether it actually ran.
 *
 *  Read-only on purpose: schedule changes happen in Google Cloud Scheduler, and
 *  a button here that pretended otherwise would be the Integrations page's old
 *  lie in a new place. The panel exists because a dead cron once went unnoticed
 *  for weeks — so the one thing it must never do is draw a healthy page out of
 *  a scheduler it could not read. `scheduler_ok: false` is a successful load of
 *  an honest partial: the rows are the registry's expectations, drawn with no
 *  green and no red, because nothing live stands behind them.
 *
 *  The decisions — band membership, order, the cron-to-words reading, the
 *  opening statement — live in `./schedule.ts`, where `schedule.test.ts` proves
 *  them. This file only draws what those functions decide.
 */

import { useEffect, useState } from "react";
import { getCronJobs, type CronJob, type CronJobsPayload } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub } from "../context";
import { ago, clock, dayLabel, until } from "../format";
import { agentById } from "../model";
import { Blank, Oops, PageHead, RuleHead, Unknown, Wait } from "../ui";
import {
  classify, headline, scheduleWords, statement,
  type RowState, type ScheduleRow, type Statement,
} from "./schedule";

const NO_VALUE = "The scheduler reported no value here";

export function ScheduleView() {
  const { revision } = useHub();
  const session = useLoadSession();
  const [jobs, setJobs] = useState<Load<CronJobsPayload>>(loadPending);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    void session.run(
      "cron-jobs",
      (signal) => getCronJobs({ signal }),
      setJobs,
      "The schedule could not be read.",
      { keepStale: true },
    );
  }, [session, revision, beat]);

  const data = jobs.data;
  const page = data ? classify(data) : null;
  useHeadline(page ? headline(page) : "reading the schedule");

  if (jobs.phase === "loading" && !data) return <Wait what="Reading the schedule" rows={3} />;
  if (jobs.phase === "failed" && !data) {
    return (
      <Oops
        what="The schedule could not be read."
        error={jobs.error || ""}
        onRetry={() => setBeat((b) => b + 1)}
      />
    );
  }
  if (!data || !page) return null;

  const checking = jobs.phase === "loading";
  const at = clock(data.generated_at);
  const footer = (
    <p className="prio__from">
      Checked{at ? ` at ${at}` : ""} ·{" "}
      <button
        type="button"
        className="aside--go"
        disabled={checking}
        onClick={() => setBeat((b) => b + 1)}
      >
        {checking ? "checking…" : "refresh"}
      </button>
    </p>
  );

  /* The honest partial: expectations only, no live claims in either colour. */
  if (page.mode === "registry") {
    const st = statement(page);
    return (
      <>
        <PageHead statement={<StatementText s={st} />} lede={st.lede} />
        <Oops
          what="The scheduler could not be read."
          error={[data.scheduler_error, "The rows below are the registry's expectations only — nothing here is live."]
            .filter(Boolean).join(" ")}
          onRetry={() => setBeat((b) => b + 1)}
        />
        {page.onClock.length > 0 && (
          <section className="band">
            <RuleHead
              title="Expected by the registry"
              note="Live state unconfirmed."
              aside={<span className="aside">{page.onClock.length} job{page.onClock.length === 1 ? "" : "s"}</span>}
            />
            <div className="hooks">
              {page.onClock.map((r) => <JobRow key={r.job.id} row={r} />)}
            </div>
          </section>
        )}
        {footer}
      </>
    );
  }

  if (page.counts.total === 0) {
    return (
      <>
        <Blank title="Nothing is on the clock">
          No scheduled jobs exist in this environment. When a job is created in Cloud
          Scheduler and registered in the backend, it appears here with its purpose and
          its timetable.
        </Blank>
        {footer}
      </>
    );
  }

  const st = statement(page);
  return (
    <>
      <PageHead statement={<StatementText s={st} />} lede={st.lede} />

      {page.needsLook.length > 0 && (
        <section className="band">
          <RuleHead
            title="Needs a look"
            note="Missing, failed, or undocumented — most serious first."
            aside={<span className="aside">{page.needsLook.length}</span>}
          />
          <div className="hooks">
            {page.needsLook.map((r) => <JobRow key={r.job.id} row={r} />)}
          </div>
        </section>
      )}

      {page.onClock.length > 0 && (
        <section className="band">
          <RuleHead
            title="On the clock"
            note="What each job does, and when it next fires."
            aside={<span className="aside">{page.onClock.length} job{page.onClock.length === 1 ? "" : "s"}</span>}
          />
          <div className="hooks">
            {page.onClock.map((r) => <JobRow key={r.job.id} row={r} />)}
          </div>
        </section>
      )}

      {footer}
    </>
  );
}

function StatementText({ s }: { s: Statement }) {
  return <>{s.pre}{s.strong && <b>{s.strong}</b>}{s.post}</>;
}

/* ---------------------------------------------------------------- one row -- */

const TAG: Record<RowState, { label: string; cls: string }> = {
  healthy: { label: "On schedule", cls: " is-on" },
  failed: { label: "Failed", cls: " is-bad" },
  paused: { label: "Paused", cls: "" },
  neverRan: { label: "Not yet run", cls: "" },
  unregistered: { label: "Unregistered", cls: "" },
  dead: { label: "Missing", cls: " is-bad" },
  unconfirmed: { label: "Unconfirmed", cls: "" },
};

const UNREGISTERED_WHAT =
  "Running in production with no entry in the registry — nothing documents what it "
  + "is for. Register it, or remove it from Cloud Scheduler.";

/** The schedule in words, with the honest fallback keeping its `<code>`. */
function SchedText({ cron, tz }: { cron: string; tz: string }) {
  const w = scheduleWords(cron, tz);
  if (w.kind === "words") return <>{w.text}</>;
  return <>On the schedule <code>{w.cron}</code> ({w.tz})</>;
}

/** "Wednesday 3 September 02:00" — the fold's way of naming a firing. */
function fireLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} ${d.getDate()} ${month} ${clock(iso)}`;
}

function JobRow({ row }: { row: ScheduleRow }) {
  const { job, state } = row;
  const [open, setOpen] = useState(false);

  const agent = job.agent_id ? agentById(job.agent_id) : undefined;
  const stamped = state !== "unregistered" && agent;

  const sched = job.schedule
    ? <SchedText cron={job.schedule.cron} tz={job.schedule.timezone} />
    : <Unknown why="The scheduler reported no schedule" />;

  /* WHEN — the schedule in words, then the next-fire line. */
  const expected = state === "dead" || state === "unconfirmed";
  const whenLine1 = expected ? <>Expected {sched}</> : sched;
  let whenLine2: React.ReactNode = null;
  if (state === "healthy" || state === "neverRan") {
    whenLine2 = job.next_time ? <>Next {until(job.next_time)}</> : <Unknown why={NO_VALUE} />;
  } else if (state === "failed") {
    whenLine2 = job.next_time ? <>Tries again {until(job.next_time)}</> : <Unknown why={NO_VALUE} />;
  } else if (state === "paused") {
    whenLine2 = <>Will not fire while paused</>;
  } else if (state === "unregistered") {
    whenLine2 = job.state === "PAUSED"
      ? <>Will not fire while paused</>
      : job.next_time ? <>Next {until(job.next_time)}</> : <Unknown why={NO_VALUE} />;
  } else if (state === "dead") {
    whenLine2 = <>Not scheduled</>;
  }

  /* Status — one tag, one quiet note under it. */
  const tag = TAG[state];
  const last = job.last_attempt;
  let note: React.ReactNode = null;
  if (state === "healthy" && last) note = <>Ran {ago(last.time)}</>;
  else if (state === "failed" && last) note = <>Failed {ago(last.time)}</>;
  else if (state === "paused" && last) note = <>Last ran {ago(last.time)}</>;
  else if (state === "neverRan") {
    note = job.next_time ? <>First run {until(job.next_time)}</> : <Unknown why={NO_VALUE} />;
  } else if (state === "unregistered") {
    note = last ? <>{last.ok ? "Ran" : "Failed"} {ago(last.time)}</> : <>No attempt on record</>;
  } else if (state === "dead") note = <>Not in the scheduler</>;
  else if (state === "unconfirmed") note = <>Nothing live to report</>;

  const agentTail = job.agent_label ?? agent?.name ?? null;

  return (
    <div className="hook">
      <span className={`hook__g${stamped ? "" : " off"}`} aria-hidden="true">
        {stamped ? stamped.mono : "??"}
      </span>

      <div className="hook__id">
        <b>{state === "unregistered" ? job.id : (job.name ?? job.id)}</b>
        {state === "unregistered"
          ? <span>{UNREGISTERED_WHAT}</span>
          : job.purpose && <span>{job.purpose}</span>}
      </div>

      <div className="hook__use">
        <b>When</b>
        <div>{whenLine1}</div>
        {whenLine2 !== null && <div>{whenLine2}</div>}
      </div>

      <span className="hook__st">
        <span className={`tag${tag.cls}`}>{tag.label}</span>
        {note !== null && <span className="hook__note">{note}</span>}
      </span>

      <span className="hook__act">
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : "Details"}
        </button>
      </span>

      {open && (
        <div className="cronfold">
          <dl>
            {job.why_time && (
              <div>
                <dt>Why this time</dt>
                <dd>{job.why_time}</dd>
              </div>
            )}
            <div>
              <dt>Exact schedule</dt>
              <dd>
                {job.schedule
                  ? <><code>{job.schedule.cron}</code> · {job.schedule.timezone}</>
                  : <Unknown why={NO_VALUE} />}
              </dd>
            </div>
            <div>
              <dt>Calls</dt>
              <dd><code>{job.endpoint}</code></dd>
            </div>
            <div>
              <dt>Job</dt>
              <dd>
                <code>{job.id}</code>
                {agentTail && <> · {agentTail}{job.agent_id ? ` (${job.agent_id})` : ""}</>}
              </dd>
            </div>
            <div>
              <dt>Last attempt</dt>
              <dd>
                {state === "unconfirmed"
                  ? <Unknown why={NO_VALUE} />
                  : last
                    ? `${dayLabel(last.time)[0]} ${clock(last.time)} — ${last.ok ? "OK" : "Failed"}`
                    : "No attempt on record"}
              </dd>
              {state === "dead" && (
                <dd>
                  Recreate the job in Cloud Scheduler, or retire the registry entry if it
                  is no longer wanted.
                </dd>
              )}
            </div>
            <div>
              <dt>Next</dt>
              <dd>
                {state === "unconfirmed" ? <Unknown why={NO_VALUE} />
                  : state === "paused" ? "None while paused"
                    : state === "dead" ? "None — not scheduled"
                      : job.next_time ? fireLabel(job.next_time) : <Unknown why={NO_VALUE} />}
              </dd>
            </div>
          </dl>
          <p className="cronfold__note">
            Read-only for now. Schedule changes happen in Google Cloud Scheduler; editing
            from here comes later.
          </p>
        </div>
      )}
    </div>
  );
}
