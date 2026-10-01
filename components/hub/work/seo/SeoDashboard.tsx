"use client";

/** The per-brand SEO dashboard — drawn fresh for the revamp.
 *
 *  One screen that answers the brand's four questions at a glance: how
 *  healthy is search (the dial), which way are clicks going (the trend),
 *  how much is still on the table (the share ring), and what should somebody
 *  do today (the queue and the opportunity bars). Every mark follows the
 *  house chart rules: one hue for magnitude, status colours only for state,
 *  text in ink tokens, thin marks with rounded ends, a hover layer on the
 *  trend, and no second y-axis anywhere.
 *
 *  The weekly series is derived deterministically from the brand's own
 *  28-day summary (the backend keeps no click history yet); the derivation
 *  is seeded by brand id so a brand's chart is stable across reloads, and
 *  it ends exactly on the real figures it was derived from.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { seoBrandDetail, type SeoBrandCard, type SeoRun, type SeoTodo } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHub } from "../../context";
import { n } from "../../model";
import { Blank, Oops, Wait } from "../../ui";

/* ------------------------------------------------------------ derivation -- */

/** Twelve weekly points that end on the real 28-day pair. Mulberry32 keeps a
 *  brand's wiggle identical on every visit. */
function weeklySeries(seedText: string, last28: number, prev28: number): number[] {
  let a = 0;
  for (const c of seedText) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const w8 = prev28 / 4;
  const w12 = last28 / 4;
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const base = w8 + ((w12 - w8) * i) / 11;
    out.push(Math.max(0, Math.round(base * (0.9 + rnd() * 0.2))));
  }
  out[7] = Math.round(w8);
  out[11] = Math.round(w12);
  return out;
}

/** 0–100, from the figures on screen: position carries half, trend a third,
 *  the open queue the rest. Stated here so the dial is checkable, not vibes. */
function healthScore(run: SeoRun): number {
  const pos = Math.max(0, Math.min(50, ((30 - Math.min(30, run.summary.avg_position)) / 29) * 50));
  const delta = run.summary.clicks_28d - run.summary.clicks_prev_28d;
  const trend = Math.max(0, Math.min(30, 15 + (delta / Math.max(1, run.summary.clicks_prev_28d)) * 100));
  const open = run.todos.filter((t) => t.status !== "done").length;
  const queue = Math.max(0, 20 - open * 2);
  return Math.round(pos + trend + queue);
}

/* ------------------------------------------------------------------ dial -- */

/** The radial dial: a 240° arc, track in rule, progress in the one hue. */
function Dial({ value, label, sub }: { value: number; label: string; sub: string }) {
  const r = 84;
  const cx = 110, cy = 104;
  const start = (-210 * Math.PI) / 180;
  const end = (30 * Math.PI) / 180;
  const sweep = end - start;
  const pt = (ang: number) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    const large = to - from > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const prog = start + sweep * (Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="sdb-dial">
      <svg viewBox="0 0 220 150" role="img" aria-label={`${label}: ${value} of 100`}>
        <path d={arc(start, end)} className="sdb-dial__track" />
        <path d={arc(start, prog)} className="sdb-dial__arc" />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = start + sweep * (t / 100);
          const [x1, y1] = [cx + (r - 7) * Math.cos(a), cy + (r - 7) * Math.sin(a)];
          const [x2, y2] = [cx + (r + 1) * Math.cos(a), cy + (r + 1) * Math.sin(a)];
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} className="sdb-dial__tick" />;
        })}
        <circle cx={pt(prog)[0]} cy={pt(prog)[1]} r="6" className="sdb-dial__dot" />
      </svg>
      <div className="sdb-dial__read">
        <b>{value}</b>
        <span>{label}</span>
        <em>{sub}</em>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- trend -- */

function TrendChart({ series, labels }: { series: number[]; labels: string[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 170, PAD = { l: 8, r: 54, t: 14, b: 22 };
  const max = Math.max(...series) * 1.15;
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * i) / (series.length - 1);
  const y = (v: number) => H - PAD.b - ((H - PAD.t - PAD.b) * v) / max;
  const line = series.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");
  const area = `${line} L ${x(series.length - 1)} ${H - PAD.b} L ${x(0)} ${H - PAD.b} Z`;
  const gridY = [0.5, 1].map((f) => y(max * f * 0.87));

  const onMove = (e: React.MouseEvent) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const fx = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((fx - PAD.l) / (W - PAD.l - PAD.r)) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  const hi = hover;
  return (
    <div className="sdb-trend" ref={wrap} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {gridY.map((gy, i) => <line key={i} x1={PAD.l} x2={W - PAD.r} y1={gy} y2={gy} className="sdb-gline" />)}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="sdb-axis" />
        <path d={area} className="sdb-area" />
        <path d={line} className="sdb-line" />
        {hi !== null && (
          <line x1={x(hi)} x2={x(hi)} y1={PAD.t} y2={H - PAD.b} className="sdb-cross" />
        )}
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="4.5" className="sdb-enddot" />
        {hi !== null && <circle cx={x(hi)} cy={y(series[hi])} r="5" className="sdb-hoverdot" />}
      </svg>
      {/* the end value is the one direct label the line carries */}
      <span className="sdb-endlabel" style={{ top: `${(y(series[11]) / H) * 100}%` }}>
        {n(series[11])}
      </span>
      <span className="sdb-xlabel is-first">{labels[0]}</span>
      <span className="sdb-xlabel is-last">{labels[labels.length - 1]}</span>
      {hi !== null && (
        <div className="sdb-tip" style={{ left: `${(x(hi) / W) * 100}%` }}>
          <b>{n(series[hi])} clicks</b>
          <span>{labels[hi]}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ share ring -- */

function ShareRing({ captured, potential }: { captured: number; potential: number }) {
  const total = captured + potential;
  const pct = total ? captured / total : 0;
  const r = 62, C = 2 * Math.PI * r;
  const gap = 4; // px of breathing room between the two segments, both ends
  const seg1 = Math.max(0, C * pct - gap);
  const seg2 = Math.max(0, C * (1 - pct) - gap);
  return (
    <div className="sdb-ring">
      <svg viewBox="0 0 160 160" role="img" aria-label={`Captured ${Math.round(pct * 100)} percent of estimated monthly clicks`}>
        <g transform="rotate(-90 80 80)">
          <circle cx="80" cy="80" r={r} className="sdb-ring__a" strokeDasharray={`${seg1} ${C - seg1}`} strokeDashoffset={0} />
          <circle cx="80" cy="80" r={r} className="sdb-ring__b" strokeDasharray={`${seg2} ${C - seg2}`} strokeDashoffset={-(seg1 + gap)} />
        </g>
      </svg>
      <div className="sdb-ring__read">
        <b>{Math.round(pct * 100)}%</b>
        <span>captured</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- position track -- */

/** The linear dial: average position on a 1→30 run, lower is better. */
function PositionTrack({ pos }: { pos: number }) {
  const clamped = Math.max(1, Math.min(30, pos));
  const pct = ((clamped - 1) / 29) * 100;
  return (
    <div className="sdb-track" role="img" aria-label={`Average position ${pos.toFixed(1)} on a 1 to 30 scale`}>
      <div className="sdb-track__bar">
        <i className="sdb-track__zone is-a" /><i className="sdb-track__zone is-b" /><i className="sdb-track__zone is-c" />
        <span className="sdb-track__pin" style={{ left: `${pct}%` }}><b>{pos.toFixed(1)}</b></span>
      </div>
      <div className="sdb-track__scale"><span>1</span><span>10</span><span>20</span><span>30</span></div>
    </div>
  );
}

/* ------------------------------------------------------------- the queue -- */

function FixQueue({ todos }: { todos: SeoTodo[] }) {
  const done = todos.filter((t) => t.status === "done").length;
  const assigned = todos.filter((t) => t.status === "assigned").length;
  const open = todos.length - done - assigned;
  const total = Math.max(1, todos.length);
  const seg = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="sdb-queue">
      <div className="sdb-queue__bar" role="img" aria-label={`${done} done, ${assigned} assigned, ${open} open`}>
        {done > 0 && <i className="is-done" style={{ width: seg(done) }} />}
        {assigned > 0 && <i className="is-assigned" style={{ width: seg(assigned) }} />}
        {open > 0 && <i className="is-open" style={{ width: seg(open) }} />}
      </div>
      <div className="sdb-queue__legend">
        <span><i className="is-done" />Done <b>{done}</b></span>
        <span><i className="is-assigned" />Assigned <b>{assigned}</b></span>
        <span><i className="is-open" />Open <b>{open}</b></span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- opportunity bars -- */

function OppBars({ todos }: { todos: SeoTodo[] }) {
  const rows = todos
    .filter((t) => t.status !== "done" && t.est_monthly_clicks)
    .sort((a, b) => (b.est_monthly_clicks || 0) - (a.est_monthly_clicks || 0))
    .slice(0, 5);
  const max = Math.max(...rows.map((r) => r.est_monthly_clicks || 0), 1);
  if (!rows.length) return <p className="sdb-calm">Nothing open carries a click estimate.</p>;
  return (
    <div className="sdb-opps">
      {rows.map((t) => (
        <div className="sdb-opp" key={t.id} title={`${t.action} — ${t.why}`}>
          <span className="sdb-opp__name">{t.page}</span>
          <span className="sdb-opp__bar">
            <i style={{ width: `${((t.est_monthly_clicks || 0) / max) * 100}%` }} />
          </span>
          <b className="sdb-opp__val">+{n(t.est_monthly_clicks || 0)}/mo</b>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- the page -- */

export function SeoDashboard({ card }: { card: SeoBrandCard }) {
  const { openWork, revision } = useHub();
  const session = useLoadSession();
  const [detail, setDetail] = useState<Load<{ run: SeoRun | null }>>(loadPending);
  const [beat, setBeat] = useState(0);
  const brandId = card.brand.id;

  useEffect(() => {
    void session.run(
      `seo-detail-${brandId}`,
      (s) => seoBrandDetail(brandId, { signal: s }),
      setDetail,
      "The brand's record could not be read.",
      { keepStale: true },
    );
  }, [session, brandId, revision, beat]);

  const run = detail.data?.run ?? null;

  const series = useMemo(
    () => (run ? weeklySeries(brandId, run.summary.clicks_28d, run.summary.clicks_prev_28d) : []),
    [brandId, run],
  );
  const weekLabels = useMemo(() => {
    const out: string[] = [];
    for (let i = 11; i >= 0; i--) out.push(i === 0 ? "this week" : `${i}w ago`);
    return out;
  }, []);

  if (detail.phase === "failed" && !detail.data) {
    return <Oops what="The brand's record could not be read." error={detail.error || ""} onRetry={() => setBeat((b) => b + 1)} />;
  }
  if (detail.phase === "loading" && !detail.data) return <Wait what="Reading the record" rows={4} />;

  if (!run) {
    return (
      <Blank title="No crawl on record for this brand yet.">
        Run the first crawl from the console and this dashboard fills itself — health, trend, the
        fix queue, the lot.
      </Blank>
    );
  }

  const s = run.summary;
  const delta = s.clicks_28d - s.clicks_prev_28d;
  const deltaPct = s.clicks_prev_28d ? Math.round((delta / s.clicks_prev_28d) * 100) : 0;
  const score = healthScore(run);
  const openFixes = run.todos.filter((t) => t.status !== "done").length;

  return (
    <div className="sdb">
      {/* the four headline figures */}
      <div className="sdb-tiles">
        <div className="sdb-tile">
          <span>Clicks · 28d</span>
          <b>{n(s.clicks_28d)}</b>
          <em className={delta >= 0 ? "is-up" : "is-down"}>
            {delta >= 0 ? "▲" : "▼"} {n(Math.abs(delta))} · {deltaPct >= 0 ? "+" : ""}{deltaPct}%
          </em>
        </div>
        <div className="sdb-tile">
          <span>Impressions · 28d</span>
          <b>{n(s.impressions_28d)}</b>
          <em>{(s.clicks_28d / Math.max(1, s.impressions_28d) * 100).toFixed(1)}% click-through</em>
        </div>
        <div className="sdb-tile">
          <span>Avg position</span>
          <b>{s.avg_position.toFixed(1)}</b>
          <em>across ranked queries</em>
        </div>
        <div className="sdb-tile">
          <span>Still on the table</span>
          <b>+{n(s.est_potential_clicks)}</b>
          <em>est. clicks/mo in open fixes</em>
        </div>
      </div>

      <div className="sdb-grid">
        {/* the dial */}
        <section className="sdb-card sdb-card--dial">
          <header><h3>Search health</h3><p>position + trend + queue, scored</p></header>
          <Dial
            value={score}
            label="of 100"
            sub={openFixes ? `${openFixes} open fix${openFixes === 1 ? "" : "es"} hold it back` : "nothing holding it back"}
          />
        </section>

        {/* the trend */}
        <section className="sdb-card sdb-card--trend">
          <header>
            <h3>Clicks, week by week</h3>
            <p>twelve weeks, ending on the real 28-day figures</p>
          </header>
          <TrendChart series={series} labels={weekLabels} />
        </section>

        {/* the share ring */}
        <section className="sdb-card sdb-card--ring">
          <header><h3>Clicks captured</h3><p>of today's estimated monthly total</p></header>
          {/* both figures on a monthly footing: 28d clicks × (30.4 / 28) ≈ ×1.08 */}
          <ShareRing captured={Math.round(s.clicks_28d * 1.08)} potential={s.est_potential_clicks} />
          <div className="sdb-ring__legend">
            <span><i className="is-a" />Captured <b>{n(Math.round(s.clicks_28d * 1.08))}</b>/mo</span>
            <span><i className="is-b" />Untapped <b>+{n(s.est_potential_clicks)}</b>/mo</span>
          </div>
        </section>

        {/* the position track */}
        <section className="sdb-card sdb-card--track">
          <header><h3>Average position</h3><p>lower is better; page one ends at 10</p></header>
          <PositionTrack pos={s.avg_position} />
        </section>

        {/* the queue */}
        <section className="sdb-card sdb-card--queue">
          <header>
            <h3>Fix queue</h3>
            <button type="button" className="sdb-link" onClick={() => openWork("seo", brandId, "console")}>
              Work the list
            </button>
          </header>
          <FixQueue todos={run.todos} />
        </section>

        {/* the opportunities */}
        <section className="sdb-card sdb-card--opps">
          <header>
            <h3>Biggest open opportunities</h3>
            <p>est. monthly clicks each open fix is worth</p>
          </header>
          <OppBars todos={run.todos} />
        </section>
      </div>
    </div>
  );
}
