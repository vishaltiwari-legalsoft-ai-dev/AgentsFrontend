"use client";

import { useEffect, useState } from "react";
import { mrTrends, type MrTrends } from "@/lib/api";
import { ChartCard, Columns, HBars, Lines, StackedBars, channelColor } from "./charts";

export function DeskBoard() {
  const [t, setT] = useState<MrTrends | null>(null);

  useEffect(() => {
    mrTrends().then(setT).catch(() => setT(null));
  }, []);

  if (!t || !t.has_data) return null;

  const months = t.monthly.map((m) => m.month);
  const channels = Object.entries(t.channels);
  const ranked = t.vendors.filter((v) => v.cpql !== null)
    .sort((a, b) => (a.cpql ?? 0) - (b.cpql ?? 0)).slice(0, 8);

  return (
    <div className="mr-board">
      {t.insights.length > 0 && (
        <div className="mr-insights">
          <h4 className="mr-section__title">Desk read · computed from the numbers</h4>
          {t.insights.map((i, n) => (
            <div className={`mr-insight mr-insight--${i.level}`} key={n}>{i.text}</div>
          ))}
        </div>
      )}

      <div className="mr-board__grid">
        <ChartCard title="Spend by month">
          <Columns data={t.monthly.map((m) => ({ month: m.month, value: m.spend }))} money />
        </ChartCard>

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
            <HBars money data={ranked.map((v) => ({ label: v.vendor, value: v.cpql as number }))} />
          ) : (
            <p className="mr-doc__none">No vendor has qualified leads yet this month.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
