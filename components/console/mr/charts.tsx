"use client";

import { useState, type ReactNode } from "react";

import { barAxisMax, niceTicks } from "./chartScale";

/* Fixed channel identity colors — chart-scoped `--mr-ch-*` vars in mr.css,
   validator-passed per theme (see the 2026-07-21 charts-redesign spec).
   CHANNEL_ORDER is the validated stack/legend adjacency — never re-sort. */
export const CHANNEL_COLORS: Record<string, string> = {
  Google: "var(--mr-ch-google)",
  Email: "var(--mr-ch-email)",
  META: "var(--mr-ch-meta)",
  Websites: "var(--mr-ch-web)",
  Organic: "var(--mr-ch-organic)",
  LinkedIn: "var(--mr-ch-li)",
};
export const CHANNEL_ORDER = ["Google", "Email", "META", "Websites", "Organic", "LinkedIn"];
export const channelColor = (ch: string) => CHANNEL_COLORS[ch] ?? "var(--gray-400)";

export const fmtK = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
const mon = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "short" });

export function ChartCard({ title, children, legend, aside }: {
  title: string; children: ReactNode; legend?: ReactNode; aside?: ReactNode;
}) {
  return (
    <div className="mr-chart">
      <div className="mr-chart__head">
        <h4 className="mr-section__title">{title}</h4>
        {aside}
      </div>
      {children}
      {legend && <div className="mr-chart__legend">{legend}</div>}
    </div>
  );
}

/* Hover tooltip. Positioned in viewBox coordinates (the svg is 100% wide, so
   percentages survive responsive scaling). */
function TT({ x, w, top, title, rows }: {
  x: number; w: number; top?: string;
  title: string;
  rows: { name: string; color?: string; value: string }[];
}) {
  const left = Math.min(Math.max(x - 62, 2), w - 132);
  return (
    <div className="mr-tt" style={{ left: `${(left / w) * 100}%`, top: top ?? 0 }}>
      <div className="mr-tt__title">{title}</div>
      {rows.map((r) => (
        <div className="mr-tt__row" key={r.name}>
          {r.color && <i style={{ background: r.color }} />}
          <span>{r.name}</span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/* Maps a mouse event to the nearest month index in viewBox units. */
function nearestIndex(e: React.MouseEvent<SVGSVGElement>, count: number, step: number): number {
  const r = e.currentTarget.getBoundingClientRect();
  const vx = ((e.clientX - r.left) / r.width) * W;
  return Math.min(Math.max(Math.round((vx - PAD) / step), 0), count - 1);
}

const monLong = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "long" });

/* Catmull-Rom → cubic Bézier through every point. Tension < 1 damps overshoot;
   adjacent share bands smooth the SAME edge points, so they still tile exactly. */
function curve(pts: { x: number; y: number }[], t = 0.75): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t, c1y = p1.y + ((p2.y - p0.y) / 6) * t;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t, c2y = p2.y - ((p3.y - p1.y) / 6) * t;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

const W = 320, H = 132, PAD = 6, LBL = 14;
/* Board panels draw on a larger canvas so strokes and type render ~1:1. */
const W2 = 460, H2 = 200;

/* Tiny sparkline for KPI cells — the number's 7-month trail. */
export function Spark({ values, width = 72, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const y = (v: number) => height - 2 - (v / max) * (height - 4);
  const pts = values.map((v, i) => `${i * step},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mr-spark" role="img" aria-hidden>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill="currentColor" opacity="0.12" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5"
        pathLength={1} className="mr-draw" />
      <circle cx={width} cy={y(values[values.length - 1])} r="2" fill="currentColor" />
    </svg>
  );
}

/* Hero area chart — the board's one big moment. Brand-gradient fill, selective
   labels (first / peak / current), pulsing endpoint on the live month. */
// HGUT is the axis gutter. Without it the tick labels and the first point's value
// label were both drawn at x=HPAD and printed on top of each other.
const HW = 680, HH = 170, HPAD = 10, HGUT = 42;

export function Area({ data, money }: { data: { month: string; value: number }[]; money?: boolean }) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = (HW - HGUT - HPAD) / (data.length - 1);
  const y = (v: number) => HH - 20 - (v / max) * (HH - 56);
  const x = (i: number) => HGUT + i * step;
  const pn = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const peak = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  const last = data.length - 1;
  const lbl = (v: number) => (money ? fmtK(v) : Math.round(v).toLocaleString());
  // Label the peak and the live endpoint only. The first point used to be labeled
  // too, which is where it collided with the axis.
  const labeled = new Set([peak, last]);
  return (
    <svg viewBox={`0 0 ${HW} ${HH + LBL}`} className="mr-chart__svg" role="img">
      <defs>
        <linearGradient id="mrHeroFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {niceTicks(max).ticks.map((v) => (
        <g key={v}>
          <line x1={HGUT} x2={HW - HPAD} y1={y(v)} y2={y(v)}
            stroke="var(--border-subtle)" strokeWidth="1" />
          <text x={HGUT - 8} y={y(v)} textAnchor="end" dominantBaseline="middle"
            className="mr-chart__axis">{money ? fmtK(v) : Math.round(v).toLocaleString()}</text>
        </g>
      ))}
      <path d={`${curve(pn)} L${x(last)},${HH - 20} L${x(0)},${HH - 20} Z`} fill="url(#mrHeroFill)" />
      <path d={curve(pn)} fill="none" stroke="var(--brand)" strokeWidth="2.5"
        strokeLinejoin="round" pathLength={1} className="mr-draw" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={x(i)} cy={y(d.value)} r={i === last ? 4 : 2.5}
            fill={i === last ? "var(--accent)" : "var(--brand)"}>
            <title>{`${new Date(`${d.month}-01T00:00:00`).toLocaleString(undefined, { month: "long" })}: ${lbl(d.value)}`}</title>
          </circle>
          {i === last && <circle cx={x(i)} cy={y(d.value)} r="4" fill="var(--accent)" className="mr-pulse" />}
          {labeled.has(i) && (
            <text x={x(i)} y={y(d.value) - 10} textAnchor={i === last ? "end" : "middle"}
              className="mr-chart__val--lg">{lbl(d.value)}</text>
          )}
          <text x={x(i)} y={HH + 6} textAnchor="middle" className="mr-chart__axis">
            {new Date(`${d.month}-01T00:00:00`).toLocaleString(undefined, { month: "short" })}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Columns({ data, money }: { data: { month: string; value: number }[]; money?: boolean }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = (W - PAD * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + LBL}`} className="mr-chart__svg" role="img">
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (H - 26), 2);
        const x = PAD + i * bw;
        return (
          <g key={d.month}>
            <title>{`${mon(d.month)}: ${money ? fmtK(d.value) : Math.round(d.value).toLocaleString()}`}</title>
            <rect x={x + 3} y={H - h} width={bw - 6} height={h} rx="3" fill="var(--brand)"
              className="mr-grow" style={{ animationDelay: `${i * 45}ms` }} />
            <text x={x + bw / 2} y={H - h - 5} textAnchor="middle" className="mr-chart__val">
              {money ? fmtK(d.value) : Math.round(d.value).toLocaleString()}
            </text>
            <text x={x + bw / 2} y={H + 11} textAnchor="middle" className="mr-chart__axis">{mon(d.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Lines({ series, months }: {
  series: { name: string; color: string; values: number[]; dash?: boolean }[];
  months: string[];
}) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const step = (W - PAD * 2) / Math.max(months.length - 1, 1);
  const y = (v: number) => H - 12 - (v / max) * (H - 34);

  // End-value labels only (names live in the legend); nudge apart on collision.
  const endYs = series.map((s) => y(s.values[s.values.length - 1] ?? 0) - 6);
  for (let i = 1; i < endYs.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.abs(endYs[i] - endYs[j]) < 11) {
        endYs[i] = endYs[i] <= endYs[j] ? endYs[j] - 11 : endYs[j] + 11;
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H + LBL}`} className="mr-chart__svg" role="img">
      {series.map((s, si) => (
        <g key={s.name}>
          <polyline fill="none" stroke={s.color} strokeWidth="2"
            strokeDasharray={s.dash ? "5 4" : undefined}
            points={s.values.map((v, i) => `${PAD + i * step},${y(v)}`).join(" ")} />
          {s.values.map((v, i) => (
            <circle key={i} cx={PAD + i * step} cy={y(v)} r="2.6" fill={s.color}>
              <title>{`${s.name} · ${mon(months[i])}: ${v.toLocaleString()}`}</title>
            </circle>
          ))}
          {/* Text wears text ink, never the series colour — the line right beside
              it carries identity, and the legend names it. */}
          <text x={W - PAD} y={endYs[si]} textAnchor="end"
            className="mr-chart__val">
            {(s.values[s.values.length - 1] ?? 0).toLocaleString()}
          </text>
        </g>
      ))}
      {months.map((m, i) => (
        <text key={m} x={PAD + i * step} y={H + 11} textAnchor="middle" className="mr-chart__axis">{mon(m)}</text>
      ))}
    </svg>
  );
}

export function StackedBars({ months, segments }: {
  months: string[];
  segments: { name: string; color: string; values: number[] }[];
}) {
  const totals = months.map((_, i) => segments.reduce((n, s) => n + (s.values[i] || 0), 0));
  const max = Math.max(...totals, 1);
  const bw = (W - PAD * 2) / months.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + LBL}`} className="mr-chart__svg" role="img">
      {months.map((m, i) => {
        let yTop = H;
        return (
          <g key={m}>
            {segments.map((s) => {
              const v = s.values[i] || 0;
              if (v <= 0) return null;
              const h = (v / max) * (H - 20);
              yTop -= h;
              return (
                <rect key={s.name} x={PAD + i * bw + 3} y={yTop} width={bw - 6} height={Math.max(h - 2, 1)}
                  rx="2" fill={s.color}>
                  <title>{`${s.name} · ${mon(m)}: ${fmtK(v)}`}</title>
                </rect>
              );
            })}
            <text x={PAD + i * bw + bw / 2} y={H + 11} textAnchor="middle" className="mr-chart__axis">{mon(m)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* Ranked vendors against a decision line.
 *
 * Two things this fixes over a plain ranked bar chart. Labels sit on their own
 * line above the bar rather than in a 118px gutter — real vendor names look like
 * "AgencyBell LS Meta (Stopped)" and every one was being truncated. And the axis
 * scales to the red line rather than the data, because a single $4,800 vendor
 * flattened the whole $118-$410 pack into stubs. Anything past the line runs off
 * the end: clipped, marked with a chevron, and labelled with its real value. */
export function HBars({ data, money, redLine }: {
  data: { label: string; value: number }[];
  money?: boolean;
  redLine?: number | null;
}) {
  const max = barAxisMax(data.map((d) => d.value), redLine);
  const rowH = 30, barY = 13, valW = 46;
  const h = data.length * rowH + (redLine ? 12 : 0);
  const track = W - valW;
  const lineX = redLine ? (redLine / max) * track : 0;
  const showLine = !!redLine && lineX < track;
  const fmt = (v: number) => (money ? fmtK(v) : v.toLocaleString());
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="mr-chart__svg" role="img">
      {showLine && (
        <g>
          <line x1={lineX} x2={lineX} y1={0} y2={data.length * rowH}
            stroke="var(--red-500)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={lineX} y={h - 2} textAnchor="middle" className="mr-chart__axis">
            {fmt(redLine!)} line
          </text>
        </g>
      )}
      {data.map((d, i) => {
        const over = !!redLine && d.value >= redLine;
        const clipped = d.value > max;
        // A clipped bar stops short so the chevrons past its end read as "keeps
        // going" — otherwise $4.8k and $1.1k end at nearly the same x and a 4x
        // difference looks like a rounding error.
        const w = clipped ? track - 8 : Math.max((d.value / max) * track, 2);
        const y = i * rowH;
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${fmt(d.value)}${over ? " — over the line" : ""}`}</title>
            <text x={0} y={y + 8} className="mr-chart__axis">{d.label}</text>
            <rect x={0} y={y + barY} width={w} height={8} rx="4"
              fill={over ? "var(--red-500)" : "var(--brand)"}
              className="mr-grow-x" style={{ animationDelay: `${i * 45}ms` }} />
            {clipped && [0, 5].map((dx) => (
              <path key={dx} d={`M${w + 2 + dx} ${y + barY + 1} l3.5 3 l-3.5 3`} fill="none"
                stroke="var(--red-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            <text x={W} y={y + barY + 7} textAnchor="end"
              className={over ? "mr-chart__val mr-chart__val--bad" : "mr-chart__val"}>
              {fmt(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Nested area — the funnel read. Leads is a light neutral envelope, Qualified a
 * brand area inside it; the visible gap between the two IS the unqualified loss. */
export function NestedArea({ months, leads, qualified }: {
  months: string[]; leads: number[]; qualified: number[];
}) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(...leads, ...qualified, 1);
  const GUT = 38, RPAD = 12, TOP = 16, BOT = H2 - 24;
  const step = (W2 - GUT - RPAD) / Math.max(months.length - 1, 1);
  const x = (i: number) => GUT + i * step;
  const y = (v: number) => BOT - (v / max) * (BOT - TOP);
  const pts = (vals: number[]) => vals.map((v, i) => ({ x: x(i), y: y(v) }));
  const areaPath = (vals: number[]) =>
    `${curve(pts(vals))} L${x(vals.length - 1)},${BOT} L${x(0)},${BOT} Z`;
  const last = months.length - 1;
  return (
    <div className="mr-chartwrap" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W2} ${H2}`} className="mr-chart__svg" role="img"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const vx = ((e.clientX - r.left) / r.width) * W2;
          setHi(Math.min(Math.max(Math.round((vx - GUT) / step), 0), months.length - 1));
        }}>
        <defs>
          <linearGradient id="mrNestQual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="mrNestLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gray-400)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gray-400)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {niceTicks(max).ticks.map((v) => (
          <g key={v}>
            <line x1={GUT} x2={W2 - RPAD} y1={y(v)} y2={y(v)} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={GUT - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="mr-chart__ax2">
              {v.toLocaleString()}
            </text>
          </g>
        ))}
        <path d={areaPath(leads)} fill="url(#mrNestLeads)" />
        <path d={curve(pts(leads))} fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinejoin="round" />
        <path d={areaPath(qualified)} fill="url(#mrNestQual)" />
        <path d={curve(pts(qualified))} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
        {hi !== null && (
          <line x1={x(hi)} x2={x(hi)} y1={TOP} y2={BOT} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {[leads, qualified].map((vals, k) => (
          <circle key={k} cx={x(hi ?? last)} cy={y(vals[hi ?? last] ?? 0)} r={k === 0 ? 3.5 : 4.5}
            fill={k === 0 ? "var(--gray-500)" : "var(--brand)"}
            stroke="var(--surface-card)" strokeWidth="2" />
        ))}
        <text x={x(last) + 2} y={y(leads[last] ?? 0) - 10} textAnchor="end" className="mr-chart__v2">
          {(leads[last] ?? 0).toLocaleString()}
        </text>
        <text x={x(last) + 2} y={y(qualified[last] ?? 0) + 18} textAnchor="end" className="mr-chart__v2">
          {(qualified[last] ?? 0).toLocaleString()}
        </text>
        {months.map((m, i) => (
          <text key={m} x={x(i)} y={H2 - 6} textAnchor="middle" className="mr-chart__ax2">{mon(m)}</text>
        ))}
      </svg>
      {hi !== null && (
        <TT x={x(hi)} w={W2} title={monLong(months[hi])} rows={[
          { name: "Leads", color: "var(--gray-500)", value: (leads[hi] ?? 0).toLocaleString() },
          { name: "Qualified", color: "var(--brand)", value: (qualified[hi] ?? 0).toLocaleString() },
          { name: "Rate", value: leads[hi] ? `${Math.round(((qualified[hi] ?? 0) / leads[hi]) * 100)}%` : "—" },
        ]} />
      )}
    </div>
  );
}

/* 100% share area — the mix read. Total spend lives in the hero chart; this one
 * only answers "which way is the money shifting". Bands keep a 2px surface
 * stroke so adjacent fills never touch. */
export function ShareArea({ months, segments }: {
  months: string[];
  segments: { name: string; color: string; values: number[] }[];
}) {
  const [hi, setHi] = useState<number | null>(null);
  const totals = months.map((_, i) => segments.reduce((n, s) => n + (s.values[i] || 0), 0));
  const share = (si: number, i: number) => (totals[i] > 0 ? (segments[si].values[i] || 0) / totals[i] : 0);
  const GUT = 38, RPAD = 12, TOP = 16, BOT = H2 - 24;
  const step = (W2 - GUT - RPAD) / Math.max(months.length - 1, 1);
  const x = (i: number) => GUT + i * step;
  const y = (s: number) => BOT - s * (BOT - TOP);
  // Cumulative band edges: band si spans [cum(si), cum(si+1)].
  const cum = (si: number, i: number) => {
    let n = 0;
    for (let k = 0; k < si; k++) n += share(k, i);
    return n;
  };
  const edge = (si: number) =>
    months.map((_, i) => ({ x: x(i), y: y(cum(si, i) + share(si, i)) }));
  const bandPath = (si: number) => {
    const lower = months.map((_, i) => ({ x: x(i), y: y(cum(si, i)) }));
    const upper = edge(si);
    // Smooth both edges; the reversed upper edge mirrors exactly, so adjacent
    // bands (which share these points) keep tiling without gaps.
    return `${curve(lower)} L${upper[upper.length - 1].x},${upper[upper.length - 1].y} ${curve([...upper].reverse()).replace(/^M/, "L")} Z`;
  };
  return (
    <div className="mr-chartwrap" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W2} ${H2}`} className="mr-chart__svg" role="img"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const vx = ((e.clientX - r.left) / r.width) * W2;
          setHi(Math.min(Math.max(Math.round((vx - GUT) / step), 0), months.length - 1));
        }}>
        {[0, 0.5, 1].map((s) => (
          <g key={s}>
            <line x1={GUT} x2={W2 - RPAD} y1={y(s)} y2={y(s)} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={GUT - 8} y={y(s)} textAnchor="end" dominantBaseline="middle" className="mr-chart__ax2">
              {Math.round(s * 100)}%
            </text>
          </g>
        ))}
        {segments.map((s, si) => (
          <path key={s.name} d={bandPath(si)} fill={s.color}
            stroke="var(--surface-card)" strokeWidth="2" strokeLinejoin="round" />
        ))}
        {hi !== null && (
          <line x1={x(hi)} x2={x(hi)} y1={TOP} y2={BOT} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {months.map((m, i) => (
          <text key={m} x={x(i)} y={H2 - 6} textAnchor="middle" className="mr-chart__ax2">{mon(m)}</text>
        ))}
      </svg>
      {hi !== null && (
        <TT x={x(hi)} w={W2} title={monLong(months[hi])} rows={segments.map((s, si) => ({
          name: s.name, color: s.color,
          value: totals[hi] > 0 ? `${Math.round(share(si, hi) * 100)}% · ${fmtK(s.values[hi] || 0)}` : "—",
        }))} />
      )}
    </div>
  );
}

/* Lollipop ranking against the decision line — same read as HBars with far less
 * ink: a 2px stem and a 10px dot per vendor. Over-the-line rows keep the red
 * value text, so color never carries the verdict alone. */
export function Lollipop({ data, money, redLine }: {
  data: { label: string; value: number }[];
  money?: boolean;
  redLine?: number | null;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const max = barAxisMax(data.map((d) => d.value), redLine);
  const rowH = 38, dotY = 25, valW = 58;
  const h = data.length * rowH + (redLine ? 16 : 0);
  const track = W2 - valW;
  const lineX = redLine ? (redLine / max) * track : 0;
  const showLine = !!redLine && lineX < track;
  const fmt = (v: number) => (money ? fmtK(v) : v.toLocaleString());
  return (
    <div className="mr-chartwrap" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W2} ${h}`} className="mr-chart__svg" role="img">
        {showLine && (
          <g>
            <line x1={lineX} x2={lineX} y1={0} y2={data.length * rowH}
              stroke="var(--red-500)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={lineX} y={h - 3} textAnchor="middle" className="mr-chart__ax2">
              {fmt(redLine!)} line
            </text>
          </g>
        )}
        {data.map((d, i) => {
          const over = !!redLine && d.value >= redLine;
          const clipped = d.value > max;
          const cx = clipped ? track - 12 : Math.max((d.value / max) * track, 5);
          const yTop = i * rowH;
          const color = over ? "var(--red-500)" : "var(--brand)";
          return (
            <g key={d.label} onMouseEnter={() => setHi(i)}>
              {hi === i && (
                <rect x={-4} y={yTop + 1} width={W2 + 8} height={rowH - 4} rx="8" fill="var(--surface-hover)" />
              )}
              <text x={0} y={yTop + 12} className="mr-chart__lbl">{d.label}</text>
              <line x1={0} x2={track} y1={yTop + dotY} y2={yTop + dotY}
                stroke="var(--border-subtle)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1={0} x2={cx} y1={yTop + dotY} y2={yTop + dotY}
                stroke={color} strokeWidth="2.5" strokeLinecap="round"
                className="mr-grow-x" style={{ animationDelay: `${i * 45}ms` }} />
              <circle cx={cx} cy={yTop + dotY} r="5.5" fill={color}
                stroke="var(--surface-card)" strokeWidth="2.5" />
              {clipped && [0, 6].map((dx) => (
                <path key={dx} d={`M${track - 1 + dx} ${yTop + dotY - 3.5} l4 3.5 l-4 3.5`} fill="none"
                  stroke="var(--red-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              <text x={W2} y={yTop + dotY + 4} textAnchor="end"
                className={over ? "mr-chart__v2 mr-chart__v2--bad" : "mr-chart__v2"}>
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
      {hi !== null && redLine != null && (
        <TT x={Math.min((data[hi].value / max) * track, track)} w={W2}
          top={`${((hi * rowH) / h) * 100}%`}
          title={data[hi].label}
          rows={[
            { name: "CPQL (MTD)", value: fmt(data[hi].value) },
            {
              name: data[hi].value >= redLine ? "Over line by" : "Under line by",
              value: fmt(Math.abs(data[hi].value - redLine)),
            },
          ]} />
      )}
    </div>
  );
}
