"use client";

import type { ReactNode } from "react";

import { barAxisMax, niceTicks } from "./chartScale";

/* Fixed channel identity colors (app --cat-* tokens; legend always shown). */
export const CHANNEL_COLORS: Record<string, string> = {
  Google: "var(--cat-design)",   // teal-blue — validated (french-blue was below the lightness band)
  META: "var(--cat-social)",
  Email: "var(--cat-copy)",
  Websites: "var(--cat-data)",
  Organic: "var(--cat-seo)",
  LinkedIn: "var(--cat-ads)",
};
export const channelColor = (ch: string) => CHANNEL_COLORS[ch] ?? "var(--gray-400)";

export const fmtK = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
const mon = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "short" });

export function ChartCard({ title, children, legend }: { title: string; children: ReactNode; legend?: ReactNode }) {
  return (
    <div className="mr-chart">
      <h4 className="mr-section__title">{title}</h4>
      {children}
      {legend && <div className="mr-chart__legend">{legend}</div>}
    </div>
  );
}

const W = 320, H = 132, PAD = 6, LBL = 14;

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
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
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
      <polygon points={`${x(0)},${HH - 20} ${pts} ${x(last)},${HH - 20}`} fill="url(#mrHeroFill)" />
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2.5"
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
