"use client";

import { useEffect, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import { mrPortfolio, mrTrends, type MrOverview, type MrPortfolio, type MrTrends } from "@/lib/api";
import { LIVE_REFRESH_MS, loadPending, useLoadSession, type Load } from "@/lib/load";
import { Button, Icon } from "@/lib/kit-ui";
import { ChannelCard, Dot, fmtMoney, fmtMonth, fmtNum, fmtTime, sourceLabel } from "./shared";
import { DailyMovement } from "./DailyMovement";
import { DeskBoard } from "./DeskBoard";
import { Spark } from "./charts";
import { readPace } from "./pace";
import { vendorSummaryRows } from "./vendorSummary";

/* The official ledger — the eight agreed metrics, judged against the desk's own
   benchmarks. Sourced from the vendor snapshots (portfolio); falls back to the
   pulled tracker totals when no snapshot exists yet. Row-building, the status
   rules and which cells the tracker cannot fill live in ./vendorSummary. */
function OfficialLedger({ p, t, error }: {
  p: MrPortfolio | null;
  t: MrOverview["totals"];
  /** Set only when the portfolio read actually failed. Without it this panel
   *  says "needs a vendor snapshot" for a read that never came back, and the
   *  desk goes and takes a snapshot that changes nothing. */
  error: string | null;
}) {
  const rows = vendorSummaryRows(p, t);
  if (!rows.length) return null;
  return (
    <section className="mr-led" aria-label="Official vendor summary">
      <div className="mr-led__head">
        <h3 className="mr-led__title">Official summary</h3>
        {p ? (
          <span className="mr-led__meta">
            {p.vendors} vendors · {p.month} MTD · as of {p.date}
          </span>
        ) : error ? (
          <span className="mr-led__meta">
            From the pulled tracker · the vendor snapshots didn&apos;t load ({error}), so this is
            not a missing snapshot — it is a failed read
          </span>
        ) : (
          <span className="mr-led__meta">
            From the pulled tracker · qualified-demo and services-sold need a vendor snapshot
          </span>
        )}
      </div>
      {rows.map((row, i) => (
        <div className="mr-led__row" key={i}>
          {row.map((c) => (
            <div className="mr-led__cell" key={c.label}>
              <b className={c.status ? `mr-led__fig mr-led__fig--${c.status}` : "mr-led__fig"}>
                {c.value}
              </b>
              <span className="mr-led__label">{c.label}</span>
              {c.note && <span className="mr-led__note">{c.note}</span>}
            </div>
          ))}
        </div>
      ))}
      <PaceSpine p={p} />
    </section>
  );
}

/* The signature: one track answering the desk's standing question — for the day
   we're on, is the money ahead or behind? Both halves already ship on the
   portfolio endpoint; the Overview simply never read them. */
function PaceSpine({ p }: { p: MrPortfolio | null }) {
  const pace = readPace(p);
  if (!pace) return null;
  const verdict =
    pace.state === "on"
      ? "on pace"
      : `${fmtMoney(pace.deltaMoney)} ${pace.state} pace`;
  return (
    <div className={`mr-pace mr-pace--${pace.state}`}>
      <div className="mr-pace__bar">
        <div className="mr-pace__track">
          <div className="mr-pace__fill" style={{ width: `${pace.barPct}%` }} />
          <div
            className="mr-pace__mark"
            style={{ left: `${Math.min(100, pace.expectedPct)}%` }}
            aria-hidden
          />
        </div>
      </div>
      <div className="mr-pace__read">
        <span className="mr-pace__verdict">{verdict}</span>
        <span className="mr-pace__detail">
          {pace.spentPct}% of budget spent · {pace.expectedPct}% expected by day {pace.day} of {pace.daysInMonth}
        </span>
      </div>
    </div>
  );
}

/* A pull that brings back no tracker tabs keeps the previous datasets — by
   design, so a Sheets blip costs a stale figure rather than a blank board. The
   cost of that design is that stale and fresh look identical, which is how a
   month of old vendor figures sat under a fresh headline unnoticed. The board
   is a monthly grid refreshed daily, so anything past two days is not "recent". */
const STALE_AFTER_DAYS = 2;

function StaleBanner({ pulledAt }: { pulledAt: string | null }) {
  if (!pulledAt) return null;
  const ms = Date.now() - new Date(pulledAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (!(days >= STALE_AFTER_DAYS)) return null;
  return (
    <div className="mr-stale" role="status">
      <Icon name="alert-triangle" size={14} />
      <span>
        <b>These vendor figures are {days} days old.</b> The last successful tracker
        pull was {fmtTime(pulledAt)} — pulls since then brought back no tabs, so the
        sheet and this board can have drifted. Hit “Pull now” and read the message it returns.
      </span>
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

export function OverviewView({ overview, busy, onPull, onGotoData, onToast }: {
  overview: MrOverview | null;
  busy: boolean;
  onPull: () => void;
  onGotoData: () => void;
  onToast: ToastFn;
}) {
  const session = useLoadSession();
  const [trends, setTrends] = useState<Load<MrTrends>>(loadPending);
  const [portfolio, setPortfolio] = useState<Load<MrPortfolio>>(loadPending);
  const [showSources, setShowSources] = useState(false);

  /** Two defects lived in this effect. There was no mount guard, so a reply
   *  that landed after the user left wrote state into a dead tree. And
   *  `.catch(() => setTrends(null))` meant one failed 3-minute poll replaced
   *  numbers that had genuinely been received with an empty board — the
   *  refresh was strictly more destructive than not refreshing at all.
   *  `keepStale` on the background runs is the fix: an unattended failure
   *  leaves the last good read alone and only records the phase. */
  useEffect(() => {
    const load = (background: boolean) => {
      void session.run("trends", () => mrTrends(), setTrends,
        "Couldn't load the trend history", { keepStale: background });
      void session.run("portfolio", (signal) => mrPortfolio({ signal }), setPortfolio,
        "Couldn't load the vendor snapshots", { keepStale: background });
    };
    load(false);
    // Matches the 3-minute cloud pull, so the board tracks the sheet live.
    const id = window.setInterval(() => load(true), LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [session]);

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

      <StaleBanner pulledAt={latestPull} />

      <div className="mr-mast">
        <span className="mr-mast__eyebrow">Marketing desk · 2026 plan</span>
        <h2 className="mr-mast__month">{fmtMonth(overview.month)}</h2>
        <span className="mr-mast__line">Latest month in the data · flagged against the 2026 goals</span>
      </div>

      {t && (
        <div className="mr-kpis mr-kpis--hero">
          {KPIS.map((k) => {
            const series = trends.data?.monthly.map((m) =>
              k.key === "spend" ? m.spend
              : k.key === "leads" ? m.leads
              : k.key === "qualified_leads" ? m.qualified_leads
              : k.key === "demos_completed" ? m.demos_completed
              // Was `m.cpql` — the cost-per-COMPLETED-demo tile was drawing the
              // cost-per-qualified-LEAD trend under it. The trends row carries
              // both inputs, so the right series is one division away.
              : m.demos_completed ? m.spend / m.demos_completed : 0);
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

      <OfficialLedger
        p={portfolio.data}
        t={t}
        error={portfolio.phase === "failed" && !portfolio.data ? portfolio.error : null}
      />

      <DeskBoard trends={trends.data} redLine={portfolio.data?.benchmarks.cpql_red ?? null} />

      <DailyMovement onToast={onToast} />

      {Object.keys(overview.channels).length > 0 && (
        <h3 className="mr-section__title" style={{ marginTop: 6 }}>
          Channels · {fmtMonth(overview.month)}
        </h3>
      )}
      <div className="mr-cards">
        {Object.entries(overview.channels).map(([name, a]) => (
          <ChannelCard key={name} name={name} a={a} collapsible />
        ))}
      </div>

    </div>
  );
}
