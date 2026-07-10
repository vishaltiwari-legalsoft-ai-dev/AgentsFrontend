"use client";

import { useEffect, useState } from "react";
import { mrPortfolio, mrTrends, type MrOverview, type MrPortfolio, type MrTrends } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { ChannelCard, Dot, fmtMoney, fmtMonth, fmtNum, fmtTime, sourceLabel } from "./shared";
import { DailyMovement } from "./DailyMovement";
import { DeskBoard } from "./DeskBoard";
import { Spark } from "./charts";

/* Green "official" vendor summary — the eight agreed metrics in two rows.
   Sourced from the vendor snapshots (portfolio); falls back to the pulled
   tracker totals when no snapshot exists yet. */
function VendorSummaryGreen({ p, t }: { p: MrPortfolio | null; t: MrOverview["totals"] }) {
  const cells: { label: string; value: string }[][] = p
    ? [
        [
          { label: "Spend", value: fmtMoney(p.total_spend) },
          { label: "Qualified Leads", value: fmtNum(p.qualified_leads) },
          { label: "Qualified Demos Booked", value: fmtNum(p.qual_demos_booked) },
          { label: "Demos Completed", value: fmtNum(p.demos_completed) },
        ],
        [
          { label: "Cost per Qualified Lead", value: fmtMoney(p.cost_per_qualified_lead) },
          { label: "Cost per Qualified Demo", value: fmtMoney(p.cost_per_qual_demo_booked) },
          { label: "Cost per Completed Demo", value: fmtMoney(p.cost_per_demo_completed) },
          { label: "Total Services Sold (Act.)", value: fmtNum(p.services_sold) },
        ],
      ]
    : t
      ? [
          [
            { label: "Spend", value: fmtMoney(t.spend) },
            { label: "Qualified Leads", value: fmtNum(t.qualified_leads) },
            { label: "Qualified Demos Booked", value: fmtNum(t.demos_booked) },
            { label: "Demos Completed", value: fmtNum(t.demos_completed) },
          ],
          [
            { label: "Cost per Qualified Lead", value: fmtMoney(t.cost_per_qualified_lead) },
            { label: "Cost per Qualified Demo", value: fmtMoney(t.cost_per_demo_booked) },
            { label: "Cost per Completed Demo", value: fmtMoney(t.cost_per_demo_completed) },
            { label: "Total Services Sold (Act.)", value: "—" },
          ],
        ]
      : [];
  if (!cells.length) return null;
  return (
    <div className="mr-vsum">
      <div className="mr-vsum__head">
        <h3 className="mr-section__title">Vendor summary · official</h3>
        {p && <span className="mr-vsum__meta">{p.vendors} vendors · {p.month} MTD · as of {p.date}</span>}
      </div>
      {cells.map((row, i) => (
        <div className="mr-vsum__row" key={i}>
          {row.map((c) => (
            <div className="mr-vsum__cell" key={c.label}>
              <b>{c.value}</b>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const KPIS = [
  { key: "spend", label: "Spend", money: true },
  { key: "leads", label: "Leads", money: false },
  { key: "qualified_leads", label: "Qualified leads", money: false },
  { key: "demos_completed", label: "Demos completed", money: false },
  { key: "cost_per_demo_completed", label: "Cost / demo completed", money: true },
] as const;

const TEASERS = ["How did we perform this month?", "Where are we wasting spend?"];

export function OverviewView({ overview, busy, onPull, onAsk, onGotoData, onToast }: {
  overview: MrOverview | null;
  busy: boolean;
  onPull: () => void;
  onAsk: (q: string) => void;
  onGotoData: () => void;
  onToast: (m: string) => void;
}) {
  const [teaser, setTeaser] = useState("");
  const [trends, setTrends] = useState<MrTrends | null>(null);
  const [portfolio, setPortfolio] = useState<MrPortfolio | null>(null);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    mrTrends().then(setTrends).catch(() => setTrends(null));
    mrPortfolio().then(setPortfolio).catch(() => setPortfolio(null));
  }, []);

  if (!overview) {
    return <div className="mr-panel"><div className="mr-empty">Reading the agent&apos;s data…</div></div>;
  }

  if (!overview.has_data) {
    return (
      <div className="mr-panel">
        <div className="mr-onb">
          <Icon name="bar-chart-3" size={28} />
          <h2 className="mr-onb__title">Let&apos;s get your marketing data in</h2>
          <p className="mr-onb__sub">
            This agent reads the live performance tracker, flags campaigns against the 2026 goals,
            answers questions with real numbers, and writes the recurring reports.
          </p>
          <ol className="mr-onb__steps">
            <li><b>Pull the live tracker</b> — one click, reads the consolidated Google Sheet.</li>
            <li><b>Check the Overview</b> — this page fills with the month&apos;s KPIs and flags.</li>
            <li><b>Ask or generate</b> — interrogate the data, or produce a report deliverable.</li>
          </ol>
          <div className="mr-onb__actions">
            <Button variant="brand" disabled={busy} onClick={onPull} iconLeft={<Icon name="refresh-cw" size={15} />}>
              Pull live Google Sheet
            </Button>
            <Button variant="secondary" onClick={onGotoData} iconLeft={<Icon name="upload" size={14} />}>
              Upload a CSV instead
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const t = overview.totals;
  const latestPull = overview.sources.reduce<string | null>(
    (m, s) => (s.generated_at && (!m || s.generated_at > m) ? s.generated_at : m), null);

  return (
    <div className="mr-panel">
      <div className="mr-fresh">
        <span className="mr-fresh__item">
          <Icon name="database" size={13} />
          {overview.sources.length} source{overview.sources.length === 1 ? "" : "s"} · last pulled {fmtTime(latestPull)}
        </span>
        <button className="mr-chip" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources}>
          Sources
        </button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onPull} iconLeft={<Icon name="refresh-cw" size={13} />}>
          Pull now
        </Button>
      </div>
      {showSources && (
        <div className="mr-srcpop" role="dialog" aria-label="Data sources">
          <div className="mr-srcpop__head">
            <h4 className="mr-section__title">Where the data was pulled from</h4>
            <button className="mr-top__back" onClick={() => setShowSources(false)} aria-label="Close sources">
              <Icon name="x" size={14} />
            </button>
          </div>
          {overview.sources.map((s) => {
            const { src, tab } = sourceLabel(s.platform);
            return (
              <div className="mr-srcpop__row" key={s.platform}>
                <span>{src}{tab ? ` · ${tab}` : ""}</span>
                <span>{s.metrics} metrics · pulled {fmtTime(s.generated_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mr-mast">
        <span className="mr-mast__eyebrow">Marketing desk · 2026 plan</span>
        <h2 className="mr-mast__month">{fmtMonth(overview.month)}</h2>
        <span className="mr-mast__line">Latest month in the data · flagged against the 2026 goals</span>
      </div>

      {t && (
        <div className="mr-kpis mr-kpis--hero">
          {KPIS.map((k) => {
            const series = trends?.monthly.map((m) =>
              k.key === "spend" ? m.spend
              : k.key === "leads" ? m.leads
              : k.key === "qualified_leads" ? m.qualified_leads
              : k.key === "demos_completed" ? m.demos_completed
              : m.cpql ?? 0);
            return (
              <div className="mr-kpi" key={k.key}>
                <span className="mr-kpi__label">{k.label}{t.status?.[k.key] && <Dot s={t.status[k.key]} />}</span>
                <span className="mr-kpi__value">{k.money ? fmtMoney(t[k.key]) : fmtNum(t[k.key])}</span>
                {series && series.length > 1 && <Spark values={series} />}
              </div>
            );
          })}
        </div>
      )}

      <VendorSummaryGreen p={portfolio} t={t} />

      <DeskBoard trends={trends} />

      <DailyMovement onToast={onToast} />

      {Object.keys(overview.channels).length > 0 && (
        <h3 className="mr-section__title" style={{ marginTop: 6 }}>
          Channels · {fmtMonth(overview.month)}
        </h3>
      )}
      <div className="mr-cards">
        {Object.entries(overview.channels).map(([name, a]) => (
          <ChannelCard key={name} name={name} a={a} />
        ))}
      </div>

      <div className="mr-teaser">
        <div className="mr-ask__box">
          <textarea
            className="mr-ask__input" rows={1}
            placeholder="Ask anything about this data…"
            value={teaser}
            onChange={(e) => setTeaser(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (teaser.trim()) onAsk(teaser.trim());
              }
            }}
          />
          <Button variant="brand" disabled={!teaser.trim()} onClick={() => onAsk(teaser.trim())}
            iconLeft={<Icon name="sparkles" size={15} />}>Ask</Button>
        </div>
        <div className="mr-sugg">
          {TEASERS.map((q) => <button key={q} className="mr-chip" onClick={() => onAsk(q)}>{q}</button>)}
        </div>
      </div>
    </div>
  );
}
