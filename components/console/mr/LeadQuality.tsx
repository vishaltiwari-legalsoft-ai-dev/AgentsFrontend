"use client";

import { useEffect, useState } from "react";
import { mrLeadAnalysis, type MrLeadAnalysis } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { fmtMoney, fmtMonth, fmtNum } from "./shared";

const withPct = (n: number, rate: number | null) =>
  rate === null || rate === undefined ? fmtNum(n) : `${fmtNum(n)} (${rate.toFixed(0)}%)`;

/* Per-vendor lead-quality card: the lead sheet's Meeting Outcome / Deal Stage
   picture for the latest month. Story line first, red only for real flags —
   the flag messages carry the fix direction (lead quality vs booking vs offer). */
export function LeadQuality({ slug }: { slug: string }) {
  const [data, setData] = useState<MrLeadAnalysis | null>(null);
  /** Kept apart from `data`. Collapsing a failure into `null` made this card
   *  disappear exactly as it does when the vendor genuinely has no lead rows,
   *  so a dead lead-analysis read looked like "no lead data" — the one reading
   *  that stops the user asking why. */
  const [error, setError] = useState<string | null>(null);
  /** Bumped by "Try again" to re-run the load. */
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // `mrLeadAnalysis` takes no signal, so an unmounted card is guarded here
    // rather than by aborting the request.
    let live = true;
    setError(null);
    mrLeadAnalysis().then(
      (d) => {
        if (!live) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => {
        if (!live) return;
        setData(null);
        setError(e instanceof Error && e.message.trim() ? e.message : "Lead analysis failed to load");
      },
    );
    return () => { live = false; };
  }, [retry]);

  if (error) {
    return (
      <div className="mr-port mr-port--vendor">
        <h4 className="mr-section__title">Lead quality</h4>
        <p className="mr-lead__story">
          Couldn&rsquo;t read the lead analysis, so this vendor&rsquo;s demo and deal-stage numbers are
          missing here — missing, not zero.
        </p>
        <p className="mr-lead__note">{error}</p>
        <div style={{ marginTop: 8 }}>
          <Button size="sm" variant="secondary" onClick={() => setRetry((n) => n + 1)}
            iconLeft={<Icon name="refresh-cw" size={13} />}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Loaded, and this vendor simply has no lead row this month — the honest
  // nothing-to-show, and the only case that may still render nothing at all.
  const month = data?.has_data && data.latest_month ? data.months?.[data.latest_month] : undefined;
  const v = month?.vendors.find((x) => x.slug === slug);
  if (!data?.latest_month || !v) return null;

  const flagged = new Set(v.flags.map((f) => f.metric));
  const cells: { label: string; value: string; bad?: boolean }[] = [
    { label: "Demos booked", value: fmtNum(v.booked) },
    { label: "Completed", value: withPct(v.completed, v.completed_rate_pct), bad: flagged.has("zero_completed") },
    { label: "No-shows", value: withPct(v.no_show, v.no_show_rate_pct), bad: flagged.has("no_show_rate") },
    { label: "Canceled", value: withPct(v.canceled, v.canceled_rate_pct), bad: flagged.has("canceled_rate") },
    { label: "Bad leads", value: withPct(v.bad_lead, v.bad_lead_rate_pct), bad: flagged.has("bad_lead_rate") },
    { label: "Upcoming", value: fmtNum(v.pending) },
    { label: "Contract sent", value: fmtNum(v.deal_stages.contract_sent ?? 0) },
    { label: "Hot leads", value: fmtNum(v.deal_stages.hot_leads ?? 0) },
    { label: "Services sold", value: fmtNum(v.services_sold) },
    { label: "MRR", value: fmtMoney(v.mrr) },
  ];

  return (
    <div className="mr-port mr-port--vendor">
      <h4 className="mr-section__title">
        Lead quality · {fmtMonth(data.latest_month)}
        {data.tab && <span className="mr-lead__src"> · from &ldquo;{data.tab}&rdquo;</span>}
      </h4>
      <p className="mr-lead__story">{v.story}</p>
      {v.flags.length > 0 && (
        <ul className="mr-lead__flags">
          {v.flags.map((f) => <li key={f.metric}>{f.message}</li>)}
        </ul>
      )}
      <div className="mr-port__grid">
        {cells.map((c) => (
          <div className="mr-port__cell" key={c.label}>
            <b className={c.bad ? "mr-port__val--bad" : undefined}>{c.value}</b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      {!v.tracker && (
        <p className="mr-lead__note">
          Not matched to a tracker vendor tab this month — the QL-ratio / booking-rate check couldn&rsquo;t run.
        </p>
      )}
    </div>
  );
}
