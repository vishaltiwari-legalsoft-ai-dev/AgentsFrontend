"use client";

import { useEffect, useMemo, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import { geoHistory, type GeoBrandRow, type GeoHistory, type GeoHistoryPoint } from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import {
  availableSeries, dayLabel, linePath, moveLabel, plot, scoreBand, scoreRange,
  segments, seriesValue,
} from "./trend";

/** Performance dashboard — is the GEO score going up or down?
 *
 *  The agent could always tell you where you stand today; it could not tell
 *  you whether last month's work moved anything. A point is banked when a
 *  sweep completes, so this reads stored history rather than re-deriving a
 *  rolling window that quietly forgets its own past.
 *
 *  The score's recipe is on the page. A single blended number nobody can take
 *  apart is a number nobody trusts twice, so its components and their weights
 *  are rendered next to it — including the ones that could not be measured.
 */

type Props = { brand: GeoBrandRow; onToast: ToastFn };

const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "3 months" },
  { days: 365, label: "1 year" },
];

/** Series colours come from the token file, never from literals — the panel
 *  has to hold up in both themes. Rivals cycle through the tail. */
const SERIES_COLORS = [
  "var(--brand)", "var(--accent-500)", "var(--amber-500)",
  "var(--success)", "var(--text-tertiary)", "var(--blue-400)",
];

const CHART = { width: 640, height: 190, padLeft: 34, padRight: 12, padTop: 12, padBottom: 26 };

export function GeoDashboard({ brand, onToast }: Props) {
  const [days, setDays] = useState(90);
  const [doc, setDoc] = useState<GeoHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string[]>(["score"]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    geoHistory(brand.id, days)
      .then((body) => { if (live) setDoc(body); })
      .catch((e) => onToast(e instanceof Error ? e.message : "Could not load the score history", "error"))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [brand.id, days, onToast]);

  const points = doc?.points ?? [];
  const series = useMemo(() => availableSeries(points, doc?.names ?? {}), [points, doc?.names]);
  const shown = series.filter((s) => active.includes(s.key));

  const range = useMemo(() => {
    const values = shown.flatMap((s) =>
      points.map((p) => seriesValue(p, s.key)).filter((v): v is number => v !== null),
    );
    return scoreRange(values);
  }, [points, shown]);

  const box = {
    width: CHART.width - CHART.padLeft - CHART.padRight,
    height: CHART.height - CHART.padTop - CHART.padBottom,
    range,
  };

  const current = doc?.trend.current ?? null;
  const hasChart = points.length >= 2 && shown.length > 0;

  function toggle(key: string) {
    setActive((keys) =>
      keys.includes(key)
        ? (keys.length > 1 ? keys.filter((k) => k !== key) : keys)   // never zero lines
        : [...keys, key],
    );
  }

  if (loading && !doc) {
    return <div className="mr-panel"><div className="seo-empty">Loading the score history…</div></div>;
  }

  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Performance over time</h2>
        <div className="geo-dash__windows">
          {WINDOWS.map((w) => (
            <button key={w.days} className={`geo-tab${days === w.days ? " geo-tab--on" : ""}`}
                    onClick={() => setDays(w.days)}>{w.label}</button>
          ))}
        </div>
      </div>

      {!points.length ? (
        <div className="seo-empty">
          No score history yet. A point is banked every time a full sweep finishes, so the
          first one appears after the next completed poll — and the line starts moving from
          the one after that. Sweeps smaller than {doc?.min_point_answers ?? 10} usable
          answers are a sample, not a measurement, and are left off the chart.
        </div>
      ) : (
        <>
          <div className="geo-dash__hero">
            <div className="geo-dash__score">
              <span className="geo-hero__big">
                {current?.score === null || current === null ? "—" : Math.round(current.score)}
                <em>/100</em>
              </span>
              <span className="geo-dash__band">{scoreBand(current?.score ?? null)}</span>
            </div>
            <div className="geo-dash__moves">
              <p className={`geo-dash__move geo-dash__move--${doc?.trend.since_last.direction}`}>
                <Icon
                  name={doc?.trend.since_last.direction === "down" ? "trending-down" : "trending-up"}
                  size={14}
                />{" "}
                {moveLabel(doc!.trend.since_last, "since the last sweep")}
              </p>
              <p className="geo-note">
                {moveLabel(doc!.trend.since_start, `across these ${doc?.days} days`)}{" "}
                {current
                  ? `Latest sweep: ${dayLabel(current.date)}, ${current.n_measured} usable answers over ${current.n_prompts} questions.`
                  : ""}
              </p>
            </div>
          </div>

          <div className="geo-dash__legend">
            {series.map((s, i) => {
              const on = active.includes(s.key);
              return (
                <button key={s.key} className={`geo-legend${on ? " geo-legend--on" : ""}`}
                        onClick={() => toggle(s.key)}>
                  <span className="geo-legend__dot"
                        style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  {s.label}
                </button>
              );
            })}
          </div>

          {hasChart ? (
            <svg className="geo-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`}
                 role="img"
                 aria-label={`GEO score from ${dayLabel(points[0].date)} to ${dayLabel(points[points.length - 1].date)}`}>
              <g transform={`translate(${CHART.padLeft} ${CHART.padTop})`}>
                {[range.max, (range.max + range.min) / 2, range.min].map((value, i) => {
                  const y = (i / 2) * box.height;
                  return (
                    <g key={value}>
                      <line x1={0} y1={y} x2={box.width} y2={y} className="geo-chart__grid" />
                      <text x={-8} y={y + 4} className="geo-chart__axis" textAnchor="end">
                        {Math.round(value)}
                      </text>
                    </g>
                  );
                })}
                {shown.map((s) => {
                  const colorIndex = series.findIndex((x) => x.key === s.key);
                  const color = SERIES_COLORS[colorIndex % SERIES_COLORS.length];
                  const plotted = plot(points, (p) => seriesValue(p, s.key), box);
                  return (
                    <g key={s.key}>
                      {segments(points, plotted).map((run, i) => (
                        <path key={i} d={linePath(run)} fill="none" stroke={color}
                              strokeWidth={s.key === "score" ? 2.5 : 1.5}
                              strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {plotted.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={p.point.partial ? 2.5 : 3.5}
                                fill={color}
                                className={p.point.partial ? "geo-chart__dot--partial" : undefined}>
                          <title>
                            {`${dayLabel(p.point.date)} · ${s.label} ${Math.round(p.value)}`}
                            {s.key === "score" ? "/100" : "%"}
                            {` · ${p.point.n_measured} answers`}
                            {p.point.partial ? " · thin sweep" : ""}
                            {p.point.source === "backfill" ? " · reconstructed" : ""}
                          </title>
                        </circle>
                      ))}
                    </g>
                  );
                })}
                <text x={0} y={box.height + 18} className="geo-chart__axis">
                  {dayLabel(points[0].date)}
                </text>
                <text x={box.width} y={box.height + 18} className="geo-chart__axis" textAnchor="end">
                  {dayLabel(points[points.length - 1].date)}
                </text>
              </g>
            </svg>
          ) : (
            <div className="seo-empty">
              One sweep measured so far ({dayLabel(points[0].date)}). A trend needs two —
              the next completed poll draws the first line.
            </div>
          )}

          {points.some((p) => p.partial) && (
            <p className="geo-note">
              Smaller dots are sweeps that finished on far fewer answers than the rest —
              usually a poll that ran out of daily engine calls. They are real measurements
              on a thinner sample, not a drop in visibility.
            </p>
          )}
          {points.some((p) => p.source === "backfill") && (
            <p className="geo-note">
              Points before the first live sweep were reconstructed from stored answers
              (up to {doc?.backfill_days} days back) — everything older than that was never kept.
            </p>
          )}

          <ScoreRecipe point={current} labels={doc?.component_labels ?? {}} />
          <SweepTable points={points} />
        </>
      )}
    </div>
  );
}

/** What the number is made of. Weights are the renormalised ones the backend
 *  actually used, so the bars and the score agree. */
function ScoreRecipe({ point, labels }: { point: GeoHistoryPoint | null; labels: Record<string, string> }) {
  if (!point || point.score === null) return null;
  const parts = Object.entries(point.components ?? {});
  return (
    <div className="mr-section">
      <h3 className="mr-section__title">What the score is made of</h3>
      {parts.map(([key, value]) => (
        <div key={key} className="geo-bar">
          <span className="geo-bar__label">
            {labels[key] ?? key}
            <em className="geo-recipe__weight">{Math.round((point.weights?.[key] ?? 0) * 100)}% of score</em>
          </span>
          <span className="geo-bar__track">
            <span className="geo-bar__fill geo-bar__fill--self"
                  style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
          </span>
          <span className="geo-bar__num">{Math.round(value * 100)}%</span>
        </div>
      ))}
      {(point.missing ?? []).length > 0 && (
        <p className="geo-note">
          Not measurable in this sweep: {(point.missing ?? []).map((m) => labels[m] ?? m).join(", ")}.
          Those parts were left out and the remaining weights rescaled — a part we could not
          measure is not scored as a zero.
        </p>
      )}
    </div>
  );
}

function SweepTable({ points }: { points: GeoHistoryPoint[] }) {
  const rows = [...points].reverse();
  return (
    <details className="geo-plan__more">
      <summary>Every sweep ({rows.length})</summary>
      <div className="geo-plan__moreBody">
        <table className="geo-table">
          <thead>
            <tr><th>Sweep</th><th>Score</th><th>Named</th><th>Cited</th><th>Answers</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.date}>
                <td>
                  {dayLabel(p.date)}
                  {p.source === "backfill" && <span className="seo-chip">reconstructed</span>}
                </td>
                <td>{p.score === null ? "—" : p.score.toFixed(1)}</td>
                <td>{p.mention_rate === null ? "—" : `${Math.round(p.mention_rate * 100)}%`}</td>
                <td>{p.citation_rate === null ? "—" : `${Math.round(p.citation_rate * 100)}%`}</td>
                <td>{p.n_measured}{p.partial ? " (thin)" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
