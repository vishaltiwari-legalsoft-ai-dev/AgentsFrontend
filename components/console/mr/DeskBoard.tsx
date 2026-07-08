"use client";

import type { MrInsight, MrTrends } from "@/lib/api";
import { Area, ChartCard, HBars, Lines, StackedBars, channelColor } from "./charts";

function pick(insights: MrInsight[], test: (t: string) => boolean): MrInsight[] {
  return insights.filter((i) => test(i.text.toLowerCase()));
}

export function DeskBoard({ trends }: { trends: MrTrends | null }) {
  if (!trends || !trends.has_data) return null;
  const t = trends;

  const months = t.monthly.map((m) => m.month);
  const channels = Object.entries(t.channels);
  const ranked = t.vendors.filter((v) => v.cpql !== null)
    .sort((a, b) => (a.cpql ?? 0) - (b.cpql ?? 0)).slice(0, 8);

  const pace = pick(t.insights, (s) => s.includes("pace"))[0];
  const efficiency = pick(t.insights, (s) => s.includes("qualified lead") && !s.includes("zero"));
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
        <ChartCard title="Leads vs qualified">
          <Lines months={months} series={[
            { name: "Leads", color: "var(--gray-400)", values: t.monthly.map((m) => m.leads) },
            { name: "Qualified", color: "var(--brand)", values: t.monthly.map((m) => m.qualified_leads) },
          ]} />
        </ChartCard>

        <ChartCard title="Channel mix (spend)" legend={
          channels.map(([name]) => (
            <span className="mr-chart__key" key={name}>
              <i style={{ background: channelColor(name) }} /> {name}
            </span>
          ))
        }>
          <StackedBars months={months} segments={channels.map(([name, pts]) => ({
            name, color: channelColor(name),
            values: months.map((mm) => pts.find((p) => p.month === mm)?.spend ?? 0),
          }))} />
        </ChartCard>

        <ChartCard title="Cost per qualified lead · by vendor (MTD)">
          {ranked.length ? (
            <>
              <HBars money data={ranked.map((v) => ({ label: v.vendor, value: v.cpql as number }))} />
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
