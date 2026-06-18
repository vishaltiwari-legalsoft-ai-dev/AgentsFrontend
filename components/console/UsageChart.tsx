"use client";

import { useEffect, useRef, useState } from "react";
import type { UsageDay } from "@/lib/api";

/**
 * Lightweight dependency-free line chart for the Home dashboard. Renders one
 * metric ("creatives" or "sessions") across the daily series as a gradient area
 * + line. Width is measured from the container so coordinates stay crisp (no
 * non-uniform SVG scaling); height is fixed.
 */
export function UsageChart({
  data,
  metric,
  color = "var(--brand)",
}: {
  data: UsageDay[];
  metric: "creatives" | "sessions";
  color?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  const h = 210;
  const padX = 10;
  const padTop = 16;
  const padBottom = 28;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(Math.max(260, Math.floor(cw)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const values = data.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const x = (i: number) => padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / max) * innerH;

  const gid = `usage-fill-${metric}`;
  const linePoints = data.map((d, i) => `${x(i)},${y(d[metric])}`).join(" ");
  const areaPoints =
    n > 0
      ? `${x(0)},${padTop + innerH} ` +
        data.map((d, i) => `${x(i)},${y(d[metric])}`).join(" ") +
        ` ${x(n - 1)},${padTop + innerH}`
      : "";

  // Sparse x-axis labels (first / middle / last) to avoid clutter.
  const labelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  const fmt = (day: string) => {
    const [, m, d] = day.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return m && d ? `${months[Number(m) - 1]} ${Number(d)}` : day;
  };

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width={w} height={h} role="img" aria-label={`${metric} per day`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines at 0 / 50 / 100% with the max value label */}
        {[0, 0.5, 1].map((g) => {
          const gy = padTop + innerH - g * innerH;
          return (
            <g key={g}>
              <line x1={padX} y1={gy} x2={w - padX} y2={gy} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={g === 0 ? undefined : "3 4"} />
              <text x={w - padX} y={gy - 4} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">
                {Math.round(g * max)}
              </text>
            </g>
          );
        })}

        {areaPoints && <polygon points={areaPoints} fill={`url(#${gid})`} />}
        {n > 1 && <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}

        {/* dots only when the series is short enough to read */}
        {n <= 31 &&
          data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d[metric])} r={n <= 14 ? 3 : 2.2} fill="var(--surface)" stroke={color} strokeWidth="1.6" />
          ))}

        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="10.5" fill="var(--text-tertiary)">
            {data[i] ? fmt(data[i].day) : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}
