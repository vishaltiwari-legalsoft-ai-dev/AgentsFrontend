"use client";

import type { ReactNode } from "react";

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
            <rect x={x + 3} y={H - h} width={bw - 6} height={h} rx="3" fill="var(--brand)" />
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
  series: { name: string; color: string; values: number[] }[];
  months: string[];
}) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const step = (W - PAD * 2) / Math.max(months.length - 1, 1);
  const y = (v: number) => H - 12 - (v / max) * (H - 34);
  return (
    <svg viewBox={`0 0 ${W} ${H + LBL}`} className="mr-chart__svg" role="img">
      {series.map((s) => (
        <g key={s.name}>
          <polyline fill="none" stroke={s.color} strokeWidth="2"
            points={s.values.map((v, i) => `${PAD + i * step},${y(v)}`).join(" ")} />
          {s.values.map((v, i) => (
            <circle key={i} cx={PAD + i * step} cy={y(v)} r="2.6" fill={s.color}>
              <title>{`${s.name} · ${mon(months[i])}: ${v.toLocaleString()}`}</title>
            </circle>
          ))}
          <text x={W - PAD} y={y(s.values[s.values.length - 1] ?? 0) - 6} textAnchor="end"
            className="mr-chart__val" fill={s.color}>
            {s.name} {(s.values[s.values.length - 1] ?? 0).toLocaleString()}
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

export function HBars({ data, money }: { data: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = 22;
  const h = data.length * rowH + 4;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="mr-chart__svg" role="img">
      {data.map((d, i) => {
        const w = Math.max((d.value / max) * (W - 130), 3);
        const y = 2 + i * rowH;
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${money ? fmtK(d.value) : d.value.toLocaleString()}`}</title>
            <text x={0} y={y + 14} className="mr-chart__axis">{d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label}</text>
            <rect x={118} y={y + 4} width={w} height={12} rx="3" fill="var(--brand)" />
            <text x={124 + w} y={y + 14} className="mr-chart__val">{money ? fmtK(d.value) : d.value.toLocaleString()}</text>
          </g>
        );
      })}
    </svg>
  );
}
