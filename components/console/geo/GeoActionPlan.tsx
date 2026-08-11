"use client";

import { useEffect, useState } from "react";
import {
  geoStrategyActionStatus, geoStrategyGenerate, geoStrategyGet,
  type GeoBrandRow, type GeoReport, type GeoStrategyAction, type GeoStrategyDoc,
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
  onToast: (m: string) => void;
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

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

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
      onToast(e instanceof Error ? e.message : "Could not generate the plan");
    } finally {
      setBusy(false);
    }
  }

  async function cycleStatus(action: GeoStrategyAction) {
    try {
      setDoc(await geoStrategyActionStatus(brand.id, action.id, STATUS_CYCLE[action.status]));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not update the action");
    }
  }

  async function skip(action: GeoStrategyAction) {
    try {
      setDoc(await geoStrategyActionStatus(brand.id, action.id, "skipped"));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not update the action");
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

  const allActions = plan.pillars.flatMap((p) => p.actions);
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

      {plan.pillars.map((pillar) => (
        <div key={pillar.title} className="mr-section">
          <h3 className="mr-section__title">{pillar.title}</h3>
          <p className="geo-plan__objective">{pillar.objective}</p>
          <p className="geo-note">Why: {pillar.why_evidence}</p>
          {pillar.actions.map((action) => (
            <div key={action.id} className={`geo-plan__action${action.status === "done" ? " geo-plan__action--done" : ""}${action.status === "skipped" ? " geo-plan__action--skipped" : ""}`}>
              <button className={`seo-chip opt-history geo-plan__status geo-plan__status--${action.status}`}
                      onClick={() => void cycleStatus(action)}
                      title="Click to move: To do → In progress → Done">
                {STATUS_LABELS[action.status]}
              </button>
              <div className="geo-plan__body">
                <strong>{action.title}</strong>
                <span>{action.detail}</span>
                <div className="geo-plan__meta">
                  <span className="seo-chip">{action.owner_role}</span>
                  <span className="seo-chip">effort: {action.effort}</span>
                  <span className="seo-chip">impact: {action.impact}</span>
                  <span className="seo-chip">{action.timeframe_weeks} wk</span>
                  <span className="seo-chip">moves: {KPI_LABELS[action.kpi] ?? action.kpi} → {action.target}</span>
                  {action.status !== "skipped" && (
                    <button className="geo-plan__skip" onClick={() => void skip(action)}>skip</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="mr-section">
        <h3 className="mr-section__title">How we monitor this</h3>
        <p className="geo-plan__objective">{plan.monitoring.cadence}</p>
        <p className="geo-plan__objective"><strong>Weekly ritual:</strong> {plan.monitoring.review_ritual}</p>
        {plan.monitoring.leading_indicators.length > 0 && (
          <ul className="geo-plan__leading">
            {plan.monitoring.leading_indicators.map((x) => <li key={x}>{x}</li>)}
          </ul>
        )}
      </div>

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
