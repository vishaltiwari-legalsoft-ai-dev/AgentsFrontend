"use client";

import type { MrChannelAgg, MrFlagGroup, MrReport, MrReportKind, MrSource } from "@/lib/api";
import { ChannelCard, fmtMoney, fmtNum, fmtTime, readNarrative, sourceLabel, verdict } from "./shared";
import { REPORT_META } from "./reportMeta";

const CAMPAIGN_KINDS: MrReportKind[] = ["daily_summary", "weekly_summary", "threshold_alert"];

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mr-doc__sec">
      <div className="mr-doc__sechead">
        <span className="mr-doc__secnum">{String(n).padStart(2, "0")}</span>
        <h3 className="mr-doc__sectitle">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function CampaignDetail({ s }: { s: Record<string, unknown> }) {
  const channels = (s.channels ?? {}) as Record<string, MrChannelAgg>;
  const totals = s.totals as MrChannelAgg | undefined;
  return (
    <>
      {totals && (
        <div className="mr-kpis">
          <div className="mr-kpi"><span className="mr-kpi__label">Total spend</span><span className="mr-kpi__value">{fmtMoney(totals.spend)}</span></div>
          <div className="mr-kpi"><span className="mr-kpi__label">Demos completed</span><span className="mr-kpi__value">{fmtNum(totals.demos_completed)}</span></div>
          <div className="mr-kpi"><span className="mr-kpi__label">Cost / completed</span><span className="mr-kpi__value">{fmtMoney(totals.cost_per_demo_completed)}</span></div>
          <div className="mr-kpi"><span className="mr-kpi__label">Qualified leads</span><span className="mr-kpi__value">{fmtNum(totals.qualified_leads)}</span></div>
        </div>
      )}
      <div className="mr-cards">
        {Object.entries(channels).map(([name, a]) => <ChannelCard key={name} name={name} a={a} />)}
      </div>
    </>
  );
}

function AttributionDetail({ s }: { s: Record<string, unknown> }) {
  const attr = s.attribution as { pct: number; attributed: number; total: number } | undefined;
  const areas = (s.best_practice_areas ?? []) as { practice_area: string; total: number; qualified_rate: number }[];
  return (
    <>
      {attr && (
        <div className="mr-kpis">
          <div className="mr-kpi"><span className="mr-kpi__label">Attributed</span><span className="mr-kpi__value">{attr.pct}%</span></div>
          <div className="mr-kpi"><span className="mr-kpi__label">Leads attributed</span><span className="mr-kpi__value">{fmtNum(attr.attributed)}</span></div>
          <div className="mr-kpi"><span className="mr-kpi__label">Total leads</span><span className="mr-kpi__value">{fmtNum(attr.total)}</span></div>
        </div>
      )}
      {areas.length > 0 && (
        <table className="mr-table">
          <thead><tr><th>Practice area</th><th>Leads</th><th>Qualified rate</th></tr></thead>
          <tbody>
            {areas.map((r) => (
              <tr key={r.practice_area}><td>{r.practice_area || "—"}</td><td>{fmtNum(r.total)}</td><td>{Math.round(r.qualified_rate * 100)}%</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function OpportunityDetail({ s }: { s: Record<string, unknown> }) {
  const ranked = (s.ranked ?? []) as { name: string; type: string; icp_score: number; audience_size: number }[];
  if (!ranked.length) return <p className="mr-doc__none">No opportunities in the current dataset.</p>;
  return (
    <table className="mr-table">
      <thead><tr><th>Name</th><th>Type</th><th>Audience</th><th>ICP fit</th></tr></thead>
      <tbody>
        {ranked.map((o) => (
          <tr key={o.name}>
            <td>{o.name}</td><td>{o.type}</td><td>{fmtNum(o.audience_size)}</td>
            <td><span className={`mr-pill ${o.icp_score >= 0.7 ? "mr-pill--good" : "mr-pill--warn"}`}>{Math.round(o.icp_score * 100)}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompetitorDetail({ s }: { s: Record<string, unknown> }) {
  const comps = (s.competitors ?? []) as { competitor: string; changed: boolean; summary: string }[];
  if (!comps.length) return <p className="mr-doc__none">No competitor scans in the current dataset.</p>;
  return (
    <div className="mr-cards">
      {comps.map((c) => (
        <div className="mr-card" key={c.competitor}>
          <div className="mr-card__top">
            <span className="mr-card__chan">{c.competitor}</span>
            <span className={`mr-pill ${c.changed ? "mr-pill--warn" : "mr-pill--good"}`}>{c.changed ? "Changed" : "No change"}</span>
          </div>
          <p className="mr-row__label" style={{ margin: 0 }}>{c.summary}</p>
        </div>
      ))}
    </div>
  );
}

export function MrReportDoc({ report }: { report: MrReport }) {
  const meta = REPORT_META[report.kind] ?? { label: report.kind, eyebrow: "Report", desc: "" };
  const s = report.structured ?? {};
  const isCampaign = CAMPAIGN_KINDS.includes(report.kind);
  const { summary, recommend } = readNarrative(report.markdown ?? "");
  const groups = (s.flag_summary ?? []) as MrFlagGroup[];
  const reds = groups.filter((g) => g.level === "red").reduce((n, g) => n + g.count, 0);
  const warns = groups.filter((g) => g.level !== "red").reduce((n, g) => n + g.count, 0);
  const v = verdict(reds, warns);
  const sources = (report.sources ?? []) as MrSource[];

  let n = 0;
  const next = () => ++n;

  return (
    <article className="mr-doc">
      <header className="mr-doc__head">
        <div className="mr-doc__eyebrow">{meta.eyebrow}</div>
        <div className="mr-doc__titlerow">
          <h2 className="mr-doc__title">{meta.label}</h2>
          {isCampaign && <span className={`mr-doc__stamp mr-doc__stamp--${v.cls}`}>{v.label}</span>}
        </div>
        <div className="mr-doc__meta">
          <span>Generated {fmtTime(report.generated_at)}</span>
          <span>·</span>
          <span>Marketing Research agent</span>
        </div>
      </header>

      {summary && (
        <Section n={next()} title="Executive summary">
          <p className="mr-doc__prose">{summary}</p>
          {recommend && <div className="mr-doc__callout"><b>Recommend</b><span>{recommend}</span></div>}
        </Section>
      )}

      {isCampaign && groups.length > 0 && (
        <Section n={next()} title="What needs attention">
          <div className="mr-attn">
            {groups.map((g, i) => (
              <div className="mr-attn__item" key={i}>
                <span className={`mr-attn__badge mr-attn__badge--${g.level === "red" ? "red" : "warn"}`}>{g.count}</span>
                {g.text}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section n={next()} title="Performance detail">
        {isCampaign && <CampaignDetail s={s} />}
        {report.kind === "utm_attribution" && <AttributionDetail s={s} />}
        {(report.kind === "opportunity_report" || report.kind === "icp_signal") && <OpportunityDetail s={s} />}
        {report.kind === "competitor_digest" && <CompetitorDetail s={s} />}
      </Section>

      <Section n={next()} title="Appendix — data & provenance">
        <div className="mr-doc__foot">
          {sources.length > 0 ? (
            sources.map((src) => {
              const { src: label, tab } = sourceLabel(src.platform);
              return (
                <div className="mr-doc__srcrow" key={src.platform}>
                  <span>{label}{tab ? ` · ${tab}` : ""}</span>
                  <span>pulled {fmtTime(src.generated_at)} · {src.metrics} metrics{src.leads ? ` · ${src.leads} leads` : ""}</span>
                </div>
              );
            })
          ) : (
            <p className="mr-doc__none">Source details weren&apos;t recorded for this run (generated before provenance tracking).</p>
          )}
          <div className="mr-doc__srcrow mr-doc__srcrow--muted">
            <span>Run ID</span><span>{report.id}</span>
          </div>
        </div>
      </Section>
    </article>
  );
}
