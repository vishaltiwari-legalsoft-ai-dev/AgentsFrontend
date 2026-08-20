/** The performance dashboard's geometry and wording.
 *
 *  A score chart has two ways to lie and both are easy to ship by accident:
 *  drawing a straight line across a gap where nothing was measured, and
 *  auto-scaling the y-axis so a two-point wobble looks like a collapse. The
 *  series is sparse on purpose — one point per completed sweep, every two
 *  days — so both cases are the normal case here.
 *
 *  Pure: no component, no network, no dates from the machine clock.
 */
import type { GeoHistoryPoint, GeoTrendMove } from "@/lib/api";

export type Pt = { x: number; y: number; point: GeoHistoryPoint; value: number };

/** "20260819" → "19 Aug". Anything else → "" rather than "Invalid Date". */
export function dayLabel(compact: string): string {
  if (!/^\d{8}$/.test(compact)) return "";
  const date = new Date(
    Date.UTC(+compact.slice(0, 4), +compact.slice(4, 6) - 1, +compact.slice(6, 8)),
  );
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Y-axis bounds for a 0-100 score.
 *
 *  Padded around the data instead of pinned to 0-100 (a 6-point move on a
 *  full axis is invisible), but never tighter than `minSpan` — otherwise
 *  noise between two near-identical sweeps fills the whole chart and reads as
 *  a crash. Clamped to the scale the number actually lives on.
 */
export function scoreRange(values: number[], minSpan = 20): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 100 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.25, (minSpan - (hi - lo)) / 2, 2);
  return {
    min: Math.max(0, Math.floor(lo - pad)),
    max: Math.min(100, Math.ceil(hi + pad)),
  };
}

/** Plot points for a series, in SVG user units. Points with no value are
 *  dropped — they keep their x slot so the time axis stays honest. */
export function plot(
  points: GeoHistoryPoint[],
  pick: (p: GeoHistoryPoint) => number | null | undefined,
  box: { width: number; height: number; range: { min: number; max: number } },
): Pt[] {
  const span = Math.max(box.range.max - box.range.min, 1);
  const lastIndex = Math.max(points.length - 1, 1);
  const out: Pt[] = [];
  points.forEach((point, i) => {
    const value = pick(point);
    if (value === null || value === undefined || Number.isNaN(value)) return;
    out.push({
      x: (i / lastIndex) * box.width,
      y: box.height - ((value - box.range.min) / span) * box.height,
      value,
      point,
    });
  });
  return out;
}

/** Contiguous runs of plotted points.
 *
 *  A gap in the middle of the series means a sweep produced nothing usable,
 *  and the line must BREAK there. Joining across it would draw a measurement
 *  that was never taken.
 */
export function segments(points: GeoHistoryPoint[], plotted: Pt[]): Pt[][] {
  const index = new Map(plotted.map((p) => [p.point, p] as const));
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (const point of points) {
    const hit = index.get(point);
    if (hit) {
      run.push(hit);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

export function linePath(run: Pt[]): string {
  if (!run.length) return "";
  return run.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** The sentence under the big number. Never "0.0 pts" for a first
 *  measurement — there is nothing to have moved from yet. */
export function moveLabel(move: GeoTrendMove, when: string): string {
  if (move.direction === "unknown" || move.change === null) {
    return `First measurement — no ${when} to compare against yet.`;
  }
  if (move.direction === "flat") return `Unchanged ${when}.`;
  const arrow = move.direction === "up" ? "Up" : "Down";
  return `${arrow} ${Math.abs(move.change).toFixed(1)} points ${when}.`;
}

export function moveTone(move: GeoTrendMove): "up" | "down" | "flat" | "unknown" {
  return move.direction;
}

/** Plain-language reading of a 0-100 GEO score. Deliberately coarse: the
 *  score's job is direction over time, not a grade to defend to two decimals. */
export function scoreBand(score: number | null): string {
  if (score === null) return "Not measured";
  if (score >= 60) return "Strong";
  if (score >= 35) return "Growing";
  if (score >= 15) return "Early days";
  return "Barely visible";
}

/** The series a dashboard can draw, given what was actually measured.
 *  A rival with no measurement in any point is not offered as a line. */
export function availableSeries(
  points: GeoHistoryPoint[],
  names: Record<string, string>,
): { key: string; label: string; kind: "score" | "rate" | "rival" }[] {
  const series: { key: string; label: string; kind: "score" | "rate" | "rival" }[] = [
    { key: "score", label: "GEO score", kind: "score" },
  ];
  const has = (pick: (p: GeoHistoryPoint) => number | null | undefined) =>
    points.some((p) => {
      const v = pick(p);
      return v !== null && v !== undefined;
    });
  if (has((p) => p.mention_rate)) series.push({ key: "mention_rate", label: "Named", kind: "rate" });
  if (has((p) => p.citation_rate)) series.push({ key: "citation_rate", label: "Cited", kind: "rate" });
  if (has((p) => p.sov_self)) series.push({ key: "sov_self", label: "Share of voice", kind: "rate" });
  const rivals = new Set<string>();
  points.forEach((p) => {
    Object.entries(p.competitors || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) rivals.add(key);
    });
  });
  [...rivals].sort().forEach((key) =>
    series.push({ key: `rival:${key}`, label: names[key] || key, kind: "rival" }),
  );
  return series;
}

/** Read one series' value off a point. Rates are scaled to the score's 0-100
 *  axis so "named %" and "GEO score" can share one chart without a second
 *  axis nobody reads. */
export function seriesValue(point: GeoHistoryPoint, key: string): number | null {
  if (key === "score") return point.score;
  if (key.startsWith("rival:")) {
    const rate = point.competitors?.[key.slice(6)];
    return rate === null || rate === undefined ? null : rate * 100;
  }
  const rate = (point as unknown as Record<string, number | null>)[key];
  return rate === null || rate === undefined ? null : rate * 100;
}
