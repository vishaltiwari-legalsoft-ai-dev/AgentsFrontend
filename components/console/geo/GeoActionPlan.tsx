"use client";

import { useEffect, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  geoStrategyActionStatus, geoStrategyGenerate, geoStrategyGet,
  type GeoBrandRow, type GeoReport, type GeoStrategyAction, type GeoStrategyDoc,
  type GeoStrategyVenue,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { useReportWork } from "@/lib/work";

/** Action Plan — the strategy the data asked for, with its own scoreboard.
 *  Every plan stores the numbers it was built on (the baseline); this tab
 *  compares them live against this week's report, so "is it working?" is a
 *  glance, not a meeting. Statuses are team-editable checklists. */

type Props = {
  brand: GeoBrandRow;
  report: GeoReport | null;
  isCreator: boolean;
  onToast: ToastFn;
};

const KPI_LABELS: Record<string, string> = {
  mention_rate: "Named in answers",
  citation_rate: "Linked as source",
  sov_self: "Share of voice",
  aio_named_rate: "Named in Google AIO",
  aio_cited_rate: "Cited by Google AIO",
  source_gap_top_count: "Top source gap (citations missed)",
  missing_questions_count: "Questions you're invisible on",
};

const STATUS_CYCLE: Record<GeoStrategyAction["status"], GeoStrategyAction["status"]> = {
  todo: "in_progress", in_progress: "done", done: "todo", skipped: "todo",
};

const STATUS_LABELS: Record<GeoStrategyAction["status"], string> = {
  todo: "To do", in_progress: "In progress", done: "Done", skipped: "Skipped",
};

const VENUE_KIND_LABEL: Record<string, string> = {
  community: "community", listicle: "round-up", review: "review platform",
  forum: "forum", video: "video",
};

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

/** The place, as a link you can actually open. Every venue here survived
 *  verification against the discovered list, so the URL resolves — which is
 *  the whole difference between a plan and a paragraph of advice. */
function VenueLine({ venue }: { venue: GeoStrategyVenue | null }) {
  if (!venue) {
    return <span className="geo-plan__venue geo-plan__venue--own">On our own site</span>;
  }
  return (
    <span className="geo-plan__venue">
      <Icon name="map-pin" size={13} />
      <a href={venue.url} target="_blank" rel="noreferrer">{venue.name}</a>
      <span className="geo-plan__kind">{VENUE_KIND_LABEL[venue.kind] ?? venue.kind}</span>
      {venue.cited_where_absent > 0 && (
        <span className="geo-plan__cited" title="Times the engines cited this source on your tracked questions in answers that never named you">
          cited {venue.cited_where_absent}×
        </span>
      )}
    </span>
  );
}


export function GeoActionPlan({ brand, report, isCreator, onToast }: Props) {
  const [doc, setDoc] = useState<GeoStrategyDoc | null>(null);
  const [busy, setBusy] = useState(false);

  useReportWork(busy);

  useEffect(() => {
    geoStrategyGet(brand.id).then(setDoc).catch(() => undefined);
  }, [brand.id]);

  async function generate() {
    if (busy) return;
    setBusy(true);
    try {
      setDoc(await geoStrategyGenerate(brand.id));
      onToast("Plan drafted from this week's measured numbers.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not generate the plan", "error");
    } finally {
      setBusy(false);
    }
  }

  async function cycleStatus(action: GeoStrategyAction) {
    try {
      setDoc(await geoStrategyActionStatus(brand.id, action.id, STATUS_CYCLE[action.status]));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not update the action", "error");
    }
  }

  async function skip(action: GeoStrategyAction) {
    try {
      setDoc(await geoStrategyActionStatus(brand.id, action.id, "skipped"));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not update the action", "error");
    }
  }

  const plan = doc?.current;

  // live "current" values computed with the SAME formulas as the baseline —
  // a kpi with no honest live twin simply shows baseline → target
  const live: Record<string, number | undefined> = report ? {
    mention_rate: report.blended.mention.rate ?? undefined,
    citation_rate: report.blended.citation.rate ?? undefined,
    sov_self: report.blended.sov.share.self ?? undefined,
    aio_named_rate: report.engines.aio?.mention.rate ?? undefined,
    source_gap_top_count: report.source_gap[0]?.count,
    missing_questions_count: report.prompt_rollup?.filter((r) => r.self_rate === 0).length,
  } : {};

  const fmt = (kpi: string, v: number | undefined) =>
    v === undefined ? "—" : kpi.endsWith("_count") ? String(Math.round(v)) : pct(v);

  if (!plan) {
    return (
      <div className="mr-panel">
        <div className="geo-hero">
          <div className="geo-hero__big">No plan yet</div>
          <p className="geo-hero__story">
            The Action Plan turns this week&apos;s measured numbers into an execution-grade strategy:
            which placements to earn, which pages to publish, who owns each step, and the exact
            metric each step should move — with a scoreboard that tracks itself on every poll.
          </p>
          {isCreator ? (
            <button className="seo-btn seo-btn--primary" disabled={busy} onClick={() => void generate()}>
              {busy ? "Drafting from your data (about a minute)…" : "Generate the plan"}
            </button>
          ) : (
            <p className="geo-note">Ask a creator to generate the first plan.</p>
          )}
        </div>
      </div>
    );
  }

  // A stored plan from before waves, or any payload this build does not
  // understand, must degrade to a message. Indexing it took the whole console
  // down with a client-side exception -- losing Insights, Prompts and Answers
  // too -- to render one tab.
  const waves = (plan.waves ?? []).filter((w) => Array.isArray(w?.actions));
  if (waves.length === 0) {
    return (
      <div className="mr-panel">
        <div className="geo-hero">
          <div className="geo-hero__big">Plan needs regenerating</div>
          <p className="geo-hero__story">
            This plan was saved in an older format that this version cannot lay out as waves.
            Everything else about the brand still works — regenerate to get the plan back, with
            named venues and a week-by-week order.
          </p>
          {isCreator ? (
            <button className="seo-btn seo-btn--primary" disabled={busy} onClick={() => void generate()}>
              {busy ? "Drafting from your data (about a minute)…" : "Regenerate the plan"}
            </button>
          ) : (
            <p className="geo-note">Ask a creator to regenerate it.</p>
          )}
        </div>
      </div>
    );
  }

  const allActions = waves.flatMap((w) => w.actions);
  const done = allActions.filter((a) => a.status === "done").length;
  const kpis = [...new Set(allActions.map((a) => a.kpi))].filter((k) => KPI_LABELS[k]);
  const targetFor = (kpi: string) => allActions.find((a) => a.kpi === kpi)?.target ?? "";

  return (
    <div className="mr-panel">
      <div className="geo-hero">
        <div className="geo-hero__big">{done}/{allActions.length} done</div>
        <p className="geo-hero__story">{plan.summary}</p>
      </div>

      <div className="mr-section">
        <h3 className="mr-section__title">Scoreboard — is the plan working?</h3>
        <table className="geo-table">
          <thead>
            <tr><th>Metric</th><th>When plan was made</th><th>Now</th><th>90-day target</th></tr>
          </thead>
          <tbody>
            {kpis.map((kpi) => {
              const base = plan.baseline[kpi];
              const now = live[kpi];
              return (
                <tr key={kpi}>
                  <td>{KPI_LABELS[kpi]}</td>
                  <td>{fmt(kpi, typeof base === "number" ? base : undefined)}</td>
                  <td>{fmt(kpi, now)}</td>
                  <td>{targetFor(kpi)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="geo-note">
          Baseline frozen on {plan.baseline.measured_at?.slice(0, 10)} from {plan.baseline.n_answers} real
          answers; &ldquo;Now&rdquo; updates with every poll using the same formulas.
        </p>
      </div>

      {waves.map((wave) => {
        const waveDone = wave.actions.filter((a) => a.status === "done").length;
        return (
          <div key={`${wave.weeks}-${wave.title}`} className="mr-section geo-wave">
            <div className="geo-wave__head">
              <span className="geo-wave__num">Week {wave.weeks}</span>
              <h3 className="mr-section__title geo-wave__title">{wave.title}</h3>
              <span className="geo-wave__count">{waveDone}/{wave.actions.length} done</span>
            </div>
            <p className="geo-plan__objective">{wave.objective}</p>

            {wave.actions.map((action) => (
              <div key={action.id} className={`geo-plan__action${action.status === "done" ? " geo-plan__action--done" : ""}${action.status === "skipped" ? " geo-plan__action--skipped" : ""}`}>
                <button className={`seo-chip opt-history geo-plan__status geo-plan__status--${action.status}`}
                        onClick={() => void cycleStatus(action)}
                        title="Click to move: To do → In progress → Done">
                  {STATUS_LABELS[action.status]}
                </button>
                <div className="geo-plan__body">
                  {/* Three lines by default — what, where, and what you end up
                      with. Everything a person needs only once they have decided
                      to start sits behind the disclosure below. */}
                  <strong className="geo-plan__title">{action.title}</strong>
                  <span className="geo-plan__where">
                    <VenueLine venue={action.venue} />
                    <span className="geo-plan__owner">{action.owner_role}</span>
                  </span>
                  {action.deliverable && (
                    <span className="geo-plan__deliverable">
                      <Icon name="package" size={13} />
                      <span>You&apos;ll produce <strong>{action.deliverable}</strong></span>
                    </span>
                  )}

                  <details className="geo-plan__more">
                    <summary>
                      {action.steps?.length
                        ? `How to do it — ${action.steps.length} steps`
                        : "Detail and evidence"}
                    </summary>
                    <div className="geo-plan__moreBody">
                      {!!action.steps?.length && (
                        <ol className="geo-plan__steps">
                          {action.steps.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                      )}
                      {action.detail && <p className="geo-plan__detail">{action.detail}</p>}
                      {action.why_evidence && (
                        <p className="geo-plan__evidence">Why this is worth doing: {action.why_evidence}</p>
                      )}
                      <div className="geo-plan__meta">
                        <span className="seo-chip">effort: {action.effort}</span>
                        <span className="seo-chip">impact: {action.impact}</span>
                        <span className="seo-chip">moves: {KPI_LABELS[action.kpi] ?? action.kpi} → {action.target}</span>
                        {action.status !== "skipped" && (
                          <button className="geo-plan__skip" onClick={() => void skip(action)}>skip this</button>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {plan.venues && (
        <p className="geo-note">
          Venues were found by live search for &ldquo;{plan.venues.category}&rdquo; plus the domains
          your own polls show engines citing.
          {!plan.venues.complete && (
            <> <strong>This list is partial</strong> — {plan.venues.errors.length
              ? plan.venues.errors.join("; ")
              : "some discovery searches did not run"}. Regenerate once search is available
              to widen it.</>
          )}
        </p>
      )}

      {!!plan.dropped_actions?.length && (
        <p className="geo-note geo-plan__dropped">
          {plan.dropped_actions.length} suggested {plan.dropped_actions.length === 1 ? "action was" : "actions were"} dropped
          because {plan.dropped_actions.length === 1 ? "it named a place" : "they named places"} we
          could not verify ({plan.dropped_actions.map((d) => d.venue).join(", ")}). We&apos;d rather
          show you a shorter plan than send you to a dead link.
        </p>
      )}

      <p className="geo-note">{plan.expectations}</p>
      <div className="geo-plan__foot">
        <span className="geo-note">Generated {plan.generated_at?.slice(0, 10)}.</span>
        {isCreator && (
          <button className="seo-btn" disabled={busy} onClick={() => void generate()}>
            {busy ? "Re-drafting…" : "Regenerate from this week's data"}
          </button>
        )}
      </div>
    </div>
  );
}
