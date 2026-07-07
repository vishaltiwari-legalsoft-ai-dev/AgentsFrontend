"use client";

import type { MrChannelAgg, MrMetricStatus } from "@/lib/api";

export const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString()}`;
export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString();
export const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

export const fmtMonth = (ym: string | null) =>
  ym ? new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" }) : "";

export function sourceLabel(platform: string): { src: string; tab: string } {
  if (platform?.startsWith("sheets:")) return { src: "Google Sheets", tab: platform.slice(7) };
  const map: Record<string, string> = { google_ads: "Google Ads", meta: "META Ads", hubspot: "HubSpot" };
  return { src: `${map[platform] ?? platform} · CSV upload`, tab: "" };
}

/** Split narrative into summary + trailing "Recommend:" line (strips md noise). */
export function readNarrative(markdown: string): { summary: string; recommend: string } {
  let body = (markdown || "").replace(/^#\s.*\n+/, "").replace(/\*\*/g, "").trim();
  body = body.replace(/^\[[a-z_]+\]\s*\(offline summary\)\s*/i, "").trim();
  const m = body.match(/recommend:\s*(.*)$/is);
  if (m) return { summary: body.slice(0, m.index).trim(), recommend: m[1].trim() };
  return { summary: body, recommend: "" };
}

export const splitAnswer = readNarrative; // ask answers share the same shape

export function verdict(reds: number, warns: number): { cls: string; label: string } {
  if (reds > 0) return { cls: "bad", label: `${reds} red flag${reds === 1 ? "" : "s"}` };
  if (warns > 0) return { cls: "warn", label: "Watch" };
  return { cls: "good", label: "On track" };
}

export function Dot({ s }: { s: MrMetricStatus | undefined }) {
  return <span className={`mr-dot${s && s !== "na" ? ` mr-dot--${s}` : ""}`} aria-hidden />;
}

export function MetricRow({ label, value, goal, status }: {
  label: string; value: number | null | undefined; goal?: string; status?: MrMetricStatus;
}) {
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

export function ChannelCard({ name, a }: { name: string; a: MrChannelAgg }) {
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
