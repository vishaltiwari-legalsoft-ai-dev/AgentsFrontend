"use client";

import { useState } from "react";
import type { MrOverview } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { ChannelCard, Dot, fmtMoney, fmtMonth, fmtNum, fmtTime, sourceLabel } from "./shared";
import { DailyMovement } from "./DailyMovement";

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
  const reds = overview.flag_summary.filter((f) => f.level === "red");
  const warns = overview.flag_summary.filter((f) => f.level !== "red");

  return (
    <div className="mr-panel">
      <div className="mr-fresh">
        {overview.sources.map((s) => {
          const { src, tab } = sourceLabel(s.platform);
          return (
            <span className="mr-fresh__item" key={s.platform}>
              <Icon name="database" size={13} />
              {src}{tab ? ` · ${tab}` : ""} — pulled {fmtTime(s.generated_at)}
            </span>
          );
        })}
        <Button size="sm" variant="secondary" disabled={busy} onClick={onPull} iconLeft={<Icon name="refresh-cw" size={13} />}>
          Pull now
        </Button>
      </div>

      <div className="mr-mast">
        <span className="mr-mast__eyebrow">Marketing desk · 2026 plan</span>
        <h2 className="mr-mast__month">{fmtMonth(overview.month)}</h2>
        <span className="mr-mast__line">Latest month in the data · flagged against the 2026 goals</span>
      </div>

      {t && (
        <div className="mr-kpis mr-kpis--hero">
          {KPIS.map((k) => (
            <div className="mr-kpi" key={k.key}>
              <span className="mr-kpi__label">{k.label}{t.status?.[k.key] && <Dot s={t.status[k.key]} />}</span>
              <span className="mr-kpi__value">{k.money ? fmtMoney(t[k.key]) : fmtNum(t[k.key])}</span>
            </div>
          ))}
        </div>
      )}

      {(reds.length > 0 || warns.length > 0) && (
        <div className="mr-attn">
          {[...reds, ...warns].map((g, i) => (
            <div className="mr-attn__item" key={i}>
              <span className={`mr-attn__badge mr-attn__badge--${g.level === "red" ? "red" : "warn"}`}>{g.count}</span>
              {g.text}
            </div>
          ))}
        </div>
      )}

      <DailyMovement onToast={onToast} />

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
