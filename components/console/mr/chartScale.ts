/* Axis scale for the desk charts.

   The hero used fractions of the data max for its gridlines, so a $63k peak drew
   ticks at $16k / $31k / $47k. Those are arithmetically fine and unreadable — an
   axis should land on numbers a person would say out loud. */

export interface Scale {
  /** Tick values, ascending, always starting at 0. */
  ticks: number[];
  /** The top tick — what the plot should scale against. */
  max: number;
}

const NICE = [1, 2, 2.5, 5, 10];

/** Largest 1 / 2 / 2.5 / 5 / 10 x 10^n step at or below `rough`, so the ticks
 *  it generates stay inside the data range. */
function niceStep(rough: number): number {
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const fit = [...NICE].reverse().find((n) => n <= norm) ?? 1;
  return fit * mag;
}

/** Axis top for a ranked bar chart that is judged against a threshold.
 *
 *  Scaling to the data max lets one outlier ($4,800 against a $118-$410 pack)
 *  squash every other bar flat. When the chart has a decision line, that line is
 *  what the reader is measuring against — so put it at mid-axis and let the
 *  outliers run off the end, where they are clipped and labelled with their real
 *  value. If nothing comes near the line, fall back to the data so the bars fill
 *  the track instead of hugging the left edge. */
export function barAxisMax(values: number[], redLine?: number | null): number {
  const dataMax = Math.max(...values, 0);
  if (!redLine) return dataMax || 1;
  return Math.max(Math.min(dataMax, redLine * 2), 1);
}

export function niceTicks(dataMax: number, count = 3): Scale {
  const safe = dataMax > 0 ? dataMax : 1;
  const step = niceStep(safe / count);
  const ticks: number[] = [];
  for (let v = 0; v <= safe + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return { ticks, max: ticks[ticks.length - 1] };
}
