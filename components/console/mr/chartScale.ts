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

export function niceTicks(dataMax: number, count = 3): Scale {
  const safe = dataMax > 0 ? dataMax : 1;
  const step = niceStep(safe / count);
  const ticks: number[] = [];
  for (let v = 0; v <= safe + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return { ticks, max: ticks[ticks.length - 1] };
}
