"use client";

import type { MrChannelAgg, MrMetricStatus } from "@/lib/api";
import { fmtMoney, fmtNum } from "./format";

// The pure display helpers live in ./format so unit tests can import them
// without pulling JSX in; re-exported here so existing call sites are unchanged.
export {
  fmtMoney, fmtNum, fmtTime, fmtMonth, sourceLabel, readNarrative, splitAnswer, verdict,
} from "./format";

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
