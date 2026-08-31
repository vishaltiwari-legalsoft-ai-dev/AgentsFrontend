"use client";

/** The plan: what to do about it, in waves.
 *
 *  Two things make this plan different from a list of tactics, and both are
 *  surfaced rather than hidden:
 *
 *  - **Every venue is a real place, found in your own citations or in search.**
 *    The plan carries its own provenance, and any action the backend refused
 *    because it named a venue it could not verify is shown here too. A plan
 *    that silently shrank is worth investigating.
 *  - **The baseline is frozen.** Progress is measured against the check the
 *    plan was written from, not against a moving target, so a wave "working"
 *    cannot be an artefact of the question set changing underneath it.
 */

import { useEffect, useState } from "react";
import {
  geoStrategyActionUpdate, geoStrategyGenerate, geoStrategyGet,
  type GeoStrategyAction, type GeoStrategyDoc,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { assigneeToSave } from "./edits";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { Cap, n, word } from "../../model";
import { useHub, type ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import { Figure, Figures, Gauge, rate } from "./parts";

const NEXT: Record<GeoStrategyAction["status"], GeoStrategyAction["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
  skipped: "todo",
};

const STATUS_WORDS: Record<GeoStrategyAction["status"], string> = {
  todo: "To do", in_progress: "In progress", done: "Done", skipped: "Skipped",
};

export function GeoPlan({ data, onToast }: { data: GeoData; onToast: ToastFn }) {
  const { user } = useHub();
  const session = useLoadSession();
  const [doc, setDoc] = useState<Load<GeoStrategyDoc>>(loadPending);
  const [busy, setBusy] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);

  const mayGenerate = user.is_creator === true;

  useEffect(() => {
    void session.run(
      "geo-strategy",
      (s) => geoStrategyGet(data.brandId, { signal: s }),
      setDoc,
      "The plan could not be read.",
      { keepStale: true },
    );
  }, [session, data.brandId, beat]);

  const plan = doc.data?.current || null;
  const actions = (plan?.waves || []).flatMap((w) => w.actions);
  const done = actions.filter((a) => a.status === "done").length;
  const total = actions.length;

  const move = async (a: GeoStrategyAction) => {
    setBusy(a.id);
    try {
      const next = await geoStrategyActionUpdate(data.brandId, a.id, { status: NEXT[a.status] });
      setDoc({ phase: "ready", data: next, error: null });
    } catch (e: unknown) {
      // A status that did not save must not be left looking saved.
      onToast(e instanceof Error ? e.message : "That change did not save.", "error");
    } finally {
      setBusy(null);
    }
  };

  /** Hand an action to someone — any signed-in user may, matching the server
   *  gate on the same endpoint the status click uses. */
  const assign = async (a: GeoStrategyAction, assignee: string) => {
    setBusy(`assign:${a.id}`);
    try {
      const next = await geoStrategyActionUpdate(data.brandId, a.id, { assignee });
      setDoc({ phase: "ready", data: next, error: null });
      onToast(assignee ? `Assigned to ${assignee}.` : "Assignment cleared.", "ok");
    } catch (e: unknown) {
      // An assignment that did not save must not be left looking saved.
      onToast(e instanceof Error ? e.message : "That assignment did not save.", "error");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("generate");
    onToast("Reading your citations and searching for real venues. This takes a minute.", "ok");
    try {
      const next = await geoStrategyGenerate(data.brandId);
      setDoc({ phase: "ready", data: next, error: null });
      onToast("A new plan is written, from the current check.", "ok");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "The plan could not be written.", "error");
    } finally {
      setBusy(null);
    }
  };

  if (doc.phase === "loading" && !doc.data) return <Wait what="Reading the plan" rows={6} />;
  if (doc.phase === "failed" && !doc.data) {
    return <Oops what="The plan could not be read." error={doc.error || ""} onRetry={() => setBeat((b) => b + 1)} />;
  }

  if (!plan) {
    return (
      <>
        <PageHead
          statement={<>No plan has been <b>written yet</b>.</>}
          lede="A plan is built from the current check: the questions you are losing, and the venues your own citations already point at."
        />
        <Blank
          title="Nothing to work from yet"
          action={
            mayGenerate ? (
              <button type="button" className="btn btn--mark btn--sm" onClick={generate} disabled={busy === "generate"}>
                {busy === "generate" ? "Writing the plan…" : "Write the plan"}
              </button>
            ) : undefined
          }
        >
          {mayGenerate
            ? "It reads your stored citations and searches for real places to be listed — it never invents a venue."
            : "Writing a plan is creator-only. Ask a creator to generate one for this brand."}
        </Blank>
      </>
    );
  }

  const base = plan.baseline;
  const blended = data.report.blended;

  return (
    <>
      <PageHead
        statement={
          total === 0
            ? <>The plan has <b>no moves in it</b>.</>
            : done === 0
              ? <>{Cap(word(total))} move{total === 1 ? "" : "s"}. <b>None done yet.</b></>
              : done === total
                ? <>{Cap(word(total))} move{total === 1 ? "" : "s"}, <b>all of them done</b>.</>
                : <>{Cap(word(total))} moves. <b>{Cap(word(done))} done</b>, {word(total - done)} to go.</>
        }
        lede={plan.summary}
      />

      <Figures>
        <Figure value={rate(blended.mention.rate)}>
          of answers name you now, against {rate(base.mention_rate)} when this plan was written
        </Figure>
        <Figure value={rate(blended.citation.rate)}>
          link your site now, against {rate(base.citation_rate)} at the baseline
        </Figure>
        <Figure value={n(total - done)}>
          move{total - done === 1 ? "" : "s"} still open of {n(total)}
        </Figure>
      </Figures>
      <Gauge fill={blended.mention.rate ?? 0} />

      <section className="band">
        <RuleHead
          title="Measured against a frozen baseline"
          note={`Taken from the check on ${new Date(base.measured_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}. Progress against a moving target is not progress.`}
        />
        <table className="tbl">
          <thead><tr><th>Measure</th><th className="num">At baseline</th><th className="num">Now</th></tr></thead>
          <tbody>
            <tr>
              <td>Answers that name you</td>
              <td className="num">{rate(base.mention_rate)}</td>
              <td className="num">{rate(blended.mention.rate)}</td>
            </tr>
            <tr>
              <td>Answers that link your site</td>
              <td className="num">{rate(base.citation_rate)}</td>
              <td className="num">{rate(blended.citation.rate)}</td>
            </tr>
            <tr>
              <td>Questions with no mention of you</td>
              <td className="num">{n(base.missing_questions_count)}</td>
              <td className="num">{n((data.report.prompt_rollup || []).filter((r) => r.self_rate === 0).length)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {plan.waves.map((w, i) => {
        const wdone = w.actions.filter((a) => a.status === "done").length;
        return (
          <section className="wave" key={`${w.weeks}-${i}`}>
            <div className="wave__head">
              <h3>{w.weeks} — {w.title}</h3>
              <b>{wdone} of {w.actions.length} done</b>
            </div>
            <p className="lede" style={{ margin: "0 0 var(--s4)", maxWidth: "76ch" }}>
              {w.objective} <em style={{ fontStyle: "normal", color: "var(--fg-3)" }}>{w.why_evidence}</em>
            </p>
            {w.actions.map((a) => (
              <div className="pjob" key={a.id}>
                <button
                  type="button"
                  className="state"
                  data-s={a.status === "in_progress" ? "doing" : a.status}
                  onClick={() => void move(a)}
                  disabled={busy === a.id}
                  title="Click to move this on"
                >
                  {busy === a.id ? "Saving…" : STATUS_WORDS[a.status]}
                </button>
                <div>
                  <h4>{a.title}</h4>
                  {/* Both lines are guarded: plans written before these fields
                      existed must render exactly as they always did. */}
                  {a.why_evidence && (
                    <p style={{ margin: "0 0 3px" }}><b>Why:</b> {a.why_evidence}</p>
                  )}
                  {a.expected_impact && (
                    <p style={{ margin: "0 0 3px" }}><b>Expected result:</b> {a.expected_impact}</p>
                  )}
                  <p>
                    {a.deliverable}
                    {a.venue && (
                      <>
                        {" — "}
                        <a href={a.venue.url} target="_blank" rel="noreferrer">{a.venue.name}</a>
                        {a.venue.cited_where_absent > 0 && (
                          <span className="opt"> (cited {n(a.venue.cited_where_absent)}× on questions you are absent from)</span>
                        )}
                      </>
                    )}
                  </p>
                  {a.steps && a.steps.length > 0 && (
                    <ol className="pjob__steps">
                      {a.steps.map((s, k) => <li key={k}>{s}</li>)}
                    </ol>
                  )}
                  <p className="opt" style={{ fontSize: 11 }}>
                    {a.owner_role} · {a.effort} effort, {a.impact} impact · {a.kpi}: {a.target}
                    {a.kpi_coerced === true && (
                      <>
                        {" "}
                        <span
                          className="tag"
                          title="The plan named a measure that is not on the allowed list, so the nearest one was used. The target sentence may read slightly off its measure."
                        >
                          KPI guessed
                        </span>
                      </>
                    )}
                  </p>
                  <div style={{ marginTop: 6 }}>
                    {/* Keyed on the saved value so a successful save resets the
                        box's internal editing state by remounting it. */}
                    <Assignee
                      key={a.assignee || ""}
                      action={a}
                      busy={busy === `assign:${a.id}`}
                      onSave={(next) => void assign(a, next)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {plan.venues && (
        <section className="band">
          <RuleHead
            title="Where these venues came from"
            note="Named rather than invented — the provenance is part of the plan."
          />
          <p className="lede" style={{ maxWidth: "76ch" }}>
            Searched {n(plan.venues.searched)} source{plan.venues.searched === 1 ? "" : "s"} in the{" "}
            {plan.venues.category} category, finding{" "}
            {Object.entries(plan.venues.counts).map(([k, v]) => `${n(v)} ${k}`).join(", ") || "nothing"}.
            {plan.venues.complete ? "" : " The search did not complete, so this list is partial."}
          </p>
          {plan.venues.errors.length > 0 && (
            <p className="help">Errors while searching: {plan.venues.errors.join("; ")}</p>
          )}
        </section>
      )}

      {plan.dropped_actions && plan.dropped_actions.length > 0 && (
        <section className="band">
          <RuleHead
            title="Refused while writing this plan"
            note="Actions that named a venue we could not verify. Shown rather than swallowed — a plan that silently shrank is worth investigating."
          />
          <table className="tbl">
            <thead><tr><th>Action</th><th>Venue</th><th>Why it was dropped</th></tr></thead>
            <tbody>
              {plan.dropped_actions.map((d, i) => (
                <tr key={`${d.title}-${i}`}>
                  <td>{d.title}</td>
                  <td>{d.venue}</td>
                  <td>{d.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {mayGenerate && (
        <section className="band">
          <RuleHead title="Write it again" note="From the current check, against a fresh baseline." />
          <p className="lede" style={{ maxWidth: "72ch" }}>
            Regenerating replaces the plan and its baseline. Anything you have moved to Done is
            recorded against the plan you moved it on, not carried across.
          </p>
          <button type="button" className="btn btn--quiet btn--sm" onClick={generate} disabled={busy === "generate"}>
            {busy === "generate" ? "Writing the plan…" : "Write a new plan"}
          </button>
        </section>
      )}
    </>
  );
}

/** WHO does this move: a compact assign box, open to any signed-in user —
 *  the server gates this PUT at reader level, so the UI does not pretend it
 *  is creator-only.
 *
 *  Unassigned, it rests as an input. Assigned, it reads "assigned to X" and a
 *  click reopens the box. Enter or blur saves; a blur that changed nothing
 *  saves nothing. The parent remounts this component (keyed on the saved
 *  value) when a save lands, which is what closes the box. */
function Assignee({ action, busy, onSave }: {
  action: GeoStrategyAction;
  busy: boolean;
  onSave: (next: string) => void;
}) {
  const assigned = (action.assignee || "").trim();
  const [editing, setEditing] = useState(assigned === "");
  const [draft, setDraft] = useState(assigned);

  if (!editing) {
    return (
      <button
        type="button"
        className="btn btn--quiet btn--sm"
        onClick={() => setEditing(true)}
        title="Click to change or clear"
      >
        assigned to {assigned}
      </button>
    );
  }

  const commit = () => {
    const next = assigneeToSave(action.assignee, draft);
    if (next === null) {
      // Nothing changed. An assigned box closes back to its label; an
      // unassigned one simply stays an input — that is its resting state.
      if (assigned) setEditing(false);
      return;
    }
    onSave(next);
  };

  return (
    <input
      className="inp pjob__assign"
      value={draft}
      placeholder="assign to…"
      autoComplete="off"
      aria-label={`Assign "${action.title}" to someone`}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        // Enter blurs, and the blur is the one save path — no double fire.
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
      }}
      onBlur={commit}
    />
  );
}
