"use client";

import type { MrInsight, MrTrends } from "@/lib/api";
import { Area, CHANNEL_ORDER, ChartCard, Lollipop, NestedArea, ShareArea, channelColor } from "./charts";

export function DeskBoard({ trends, redLine }: { trends: MrTrends | null; redLine?: number | null }) {
  if (!trends || !trends.has_data) return null;
  const t = trends;

  const months = t.monthly.map((m) => m.month);
  // The channel order is the validated palette adjacency, never data order.
  const orderIx = (n: string) => { const i = CHANNEL_ORDER.indexOf(n); return i === -1 ? 99 : i; };
  const channels = Object.entries(t.channels).sort((a, b) => orderIx(a[0]) - orderIx(b[0]));
  const ranked = t.vendors.filter((v) => v.cpql !== null)
    .sort((a, b) => (a.cpql ?? 0) - (b.cpql ?? 0)).slice(0, 8);

  const lastM = t.monthly[t.monthly.length - 1];
  const qualifyRate = lastM && lastM.leads > 0
    ? Math.round((lastM.qualified_leads / lastM.leads) * 100)
    : null;

  // Route by kind, never by words in the text — each insight lands in exactly
  // one place. Older cached runs have no kind; they fall through to the strip.
  const pace = t.insights.find((i) => i.kind === "pace");
  const efficiency = t.insights.filter((i) => i.kind === "efficiency");
  const strip = t.insights.filter((i) => i !== pace && !efficiency.includes(i));

  return (
    <div className="mr-board">
      {strip.length > 0 && (
        <div className="mr-wire">
          {strip.map((i, n) => (
            <span className={`mr-wire__item mr-wire__item--${i.level}`} key={n}>{i.text}</span>
          ))}
        </div>
      )}

      <div className="mr-hero">
        <div className="mr-hero__head">
          <h4 className="mr-section__title">
            Spend<span className="mr-hero__range">January → today</span>
          </h4>
          {pace && <span className={`mr-hero__pace mr-hero__pace--${pace.level}`}>{pace.text}</span>}
        </div>
        <Area data={t.monthly.map((m) => ({ month: m.month, value: m.spend }))} money />
      </div>

      <div className="mr-board__grid">
        <ChartCard title="Leads vs qualified"
          aside={qualifyRate !== null && (
            <span className="mr-chart__aside"><b>{qualifyRate}%</b> qualify</span>
          )}
          legend={
            <>
              <span className="mr-chart__key"><i style={{ background: "var(--gray-500)" }} /> Leads</span>
              <span className="mr-chart__key"><i style={{ background: "var(--brand)" }} /> Qualified</span>
            </>
          }>
          <NestedArea months={months}
            leads={t.monthly.map((m) => m.leads)}
            qualified={t.monthly.map((m) => m.qualified_leads)} />
        </ChartCard>

        <ChartCard title="Channel mix (share of spend)" legend={
          channels.map(([name]) => (
            <span className="mr-chart__key" key={name}>
              <i style={{ background: channelColor(name) }} /> {name}
            </span>
          ))
        }>
          <ShareArea months={months} segments={channels.map(([name, pts]) => ({
            name, color: channelColor(name),
            values: months.map((mm) => pts.find((p) => p.month === mm)?.spend ?? 0),
          }))} />
        </ChartCard>

        <ChartCard title="Cost per qualified lead · by vendor (MTD)">
          {ranked.length ? (
            <>
              <Lollipop money redLine={redLine} data={ranked.map((v) => ({ label: v.vendor, value: v.cpql as number }))} />
              {efficiency.map((i, n) => (
                <p className={`mr-chart__note mr-chart__note--${i.level}`} key={n}>{i.text}</p>
              ))}
            </>
          ) : (
            <p className="mr-doc__none">No vendor has qualified leads yet this month.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
