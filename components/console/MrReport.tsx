"use client";

import type { MrReport, MrReportKind } from "@/lib/api";

const TITLES: Record<MrReportKind, string> = {
  daily_summary: "Daily Performance Summary",
  weekly_summary: "Weekly Performance Summary",
  threshold_alert: "Campaign Threshold Alert",
  competitor_digest: "Competitor Change Digest",
  opportunity_report: "Media Opportunity Report",
  utm_attribution: "UTM Attribution Summary",
  icp_signal: "ICP Audience Signal",
};

const EYEBROWS: Record<MrReportKind, string> = {
  daily_summary: "Daily · Marketing",
  weekly_summary: "Weekly · Marketing",
  threshold_alert: "Triggered · Alert",
  competitor_digest: "Weekly · Competitive intel",
  opportunity_report: "Bi-weekly · Partnerships",
  utm_attribution: "Weekly · Attribution",
  icp_signal: "Monthly · Audience",
};

const CAMPAIGN_KINDS: MrReportKind[] = ["daily_summary", "weekly_summary", "threshold_alert"];

/* ------------------------------- helpers -------------------------------- */

const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString()}`;
const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString();

type Status = "good" | "warn" | "bad" | "na";
interface ChannelAgg {
  spend: number;
  leads: number;
  qualified_leads: number;
  demos_booked: number;
  demos_completed: number;
  cost_per_lead: number | null;
  cost_per_qualified_lead: number | null;
  cost_per_demo_booked: number | null;
  cost_per_demo_completed: number | null;
  cac: number | null;
  goal?: { cpd_booked_low: number; cpd_booked_high: number; cpd_completed_low: number; cpd_completed_high: number } | null;
  status?: Partial<Record<string, Status>>;
}
interface FlagGroup { metric: string; level: string; count: number; text: string }

/** Split the narrative into a summary + a "Recommend:" line, stripping the
 *  leading "# Title", any stray markdown asterisks, and offline markers. */
function readNarrative(markdown: string): { summary: string; recommend: string } {
  let body = (markdown || "").replace(/^#\s.*\n+/, "").replace(/\*\*/g, "").trim();
  body = body.replace(/^\[[a-z_]+\]\s*\(offline summary\)\s*/i, "").trim();
  const m = body.match(/recommend:\s*(.*)$/is);
  if (m) {
    return { summary: body.slice(0, m.index).trim(), recommend: m[1].trim() };
  }
  return { summary: body, recommend: "" };
}

function verdict(reds: number, warns: number): { cls: string; label: string } {
  if (reds > 0) return { cls: "bad", label: `${reds} red flag${reds === 1 ? "" : "s"}` };
  if (warns > 0) return { cls: "warn", label: "Watch" };
  return { cls: "good", label: "On track" };
}

function Dot({ s }: { s: Status | undefined }) {
  return <span className={`mr-dot${s && s !== "na" ? ` mr-dot--${s}` : ""}`} aria-hidden />;
}

function MetricRow({ label, value, goal, status }: { label: string; value: number | null; goal?: string; status?: Status }) {
  return (
    <div className="mr-row">
      <span className="mr-row__label">
        {label}
        {goal && <span className="mr-row__goal">{goal}</span>}
      </span>
      <span className="mr-row__val">
        {fmtMoney(value)}
        {status && <Dot s={status} />}
      </span>
    </div>
  );
}

function ChannelCard({ name, a }: { name: string; a: ChannelAgg }) {
  const g = a.goal;
  const st = a.status ?? {};
  return (
    <div className="mr-card">
      <div className="mr-card__top"><span className="mr-card__chan">{name}</span></div>
      <div className="mr-card__spend">{fmtMoney(a.spend)}<small>Spend</small></div>
      <div className="mr-counts">
        <div className="mr-count"><b>{fmtNum(a.leads)}</b><span>Leads</span></div>
        <div className="mr-count"><b>{fmtNum(a.qualified_leads)}</b><span>Qualified</span></div>
        <div className="mr-count"><b>{fmtNum(a.demos_booked)}</b><span>Booked</span></div>
        <div className="mr-count"><b>{fmtNum(a.demos_completed)}</b><span>Completed</span></div>
      </div>
      <div className="mr-rows">
        <MetricRow label="Cost / Lead" value={a.cost_per_lead} />
        <MetricRow label="Cost / Qualified Lead" value={a.cost_per_qualified_lead} goal="target $200–400" status={st.cost_per_qualified_lead} />
        <MetricRow label="Cost / Demo Booked" value={a.cost_per_demo_booked} goal={g ? `goal $${g.cpd_booked_low}–${g.cpd_booked_high}` : undefined} status={st.cost_per_demo_booked} />
        <MetricRow label="Cost / Demo Completed" value={a.cost_per_demo_completed} goal={g ? `goal $${g.cpd_completed_low}–${g.cpd_completed_high}` : undefined} status={st.cost_per_demo_completed} />
        <MetricRow label="CAC" value={a.cac} goal="target ≤ $2,500" status={st.cac} />
      </div>
    </div>
  );
}

/* ------------------------------- views ---------------------------------- */

function CampaignView({ s }: { s: Record<string, unknown> }) {
  const channels = (s.channels ?? {}) as Record<string, ChannelAgg>;
  const totals = s.totals as ChannelAgg | undefined;
  const groups = (s.flag_summary ?? []) as FlagGroup[];

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

      {groups.length > 0 && (
        <div className="mr-section">
          <h3 className="mr-section__title">What needs attention</h3>
          <div className="mr-attn">
            {groups.map((g, i) => (
              <div className="mr-attn__item" key={i}>
                <span className={`mr-attn__badge mr-attn__badge--${g.level === "red" ? "red" : "warn"}`}>{g.count}</span>
                {g.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mr-cards">
        {Object.entries(channels).map(([name, a]) => (
          <ChannelCard key={name} name={name} a={a} />
        ))}
      </div>
    </>
  );
}

function AttributionView({ s }: { s: Record<string, unknown> }) {
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
        <div className="mr-section">
          <h3 className="mr-section__title">Practice areas by qualified rate</h3>
          <table className="mr-table">
            <thead><tr><th>Practice area</th><th>Leads</th><th>Qualified rate</th></tr></thead>
            <tbody>
              {areas.map((r) => (
                <tr key={r.practice_area}><td>{r.practice_area || "—"}</td><td>{fmtNum(r.total)}</td><td>{Math.round(r.qualified_rate * 100)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function OpportunityView({ s }: { s: Record<string, unknown> }) {
  const ranked = (s.ranked ?? []) as { name: string; type: string; icp_score: number; audience_size: number }[];
  if (!ranked.length) return null;
  return (
    <div className="mr-section">
      <h3 className="mr-section__title">Ranked opportunities</h3>
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
    </div>
  );
}

function CompetitorView({ s }: { s: Record<string, unknown> }) {
  const comps = (s.competitors ?? []) as { competitor: string; changed: boolean; summary: string }[];
  if (!comps.length) return null;
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

/* ------------------------------- root ----------------------------------- */

export function MrReportView({ report }: { report: MrReport }) {
  const kind = report.kind;
  const s = report.structured ?? {};
  const isCampaign = CAMPAIGN_KINDS.includes(kind);
  const { summary, recommend } = readNarrative(report.markdown ?? "");
  const ts = report.generated_at ? new Date(report.generated_at) : null;

  const groups = (s.flag_summary ?? []) as FlagGroup[];
  const reds = groups.filter((g) => g.level === "red").reduce((n, g) => n + g.count, 0);
  const warns = groups.filter((g) => g.level !== "red").reduce((n, g) => n + g.count, 0);
  const v = verdict(reds, warns);

  return (
    <div className="mr-rpt">
      <div className="mr-rpt__head">
        <div>
          <div className="mr-rpt__eyebrow">{EYEBROWS[kind]}</div>
          <h2 className="mr-rpt__title">{TITLES[kind] ?? kind}</h2>
        </div>
        <div className="mr-head-right">
          {isCampaign && <span className={`mr-verdict mr-verdict--${v.cls}`}>{v.label}</span>}
          {ts && <span className="mr-rpt__ts">{ts.toLocaleString()}</span>}
        </div>
      </div>

      {summary && (
        <div className="mr-agent">
          <div className="mr-agent__label">Agent read</div>
          <p className="mr-agent__text">{summary}</p>
          {recommend && (
            <div className="mr-rec"><b>Recommend</b><span>{recommend}</span></div>
          )}
        </div>
      )}

      {isCampaign && <CampaignView s={s} />}
      {kind === "utm_attribution" && <AttributionView s={s} />}
      {(kind === "opportunity_report" || kind === "icp_signal") && <OpportunityView s={s} />}
      {kind === "competitor_digest" && <CompetitorView s={s} />}
    </div>
  );
}

export default MrReportView;
