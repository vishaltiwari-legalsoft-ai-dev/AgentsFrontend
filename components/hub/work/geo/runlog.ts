/** The run ledger's arithmetic, kept pure so it can be tested without a DOM.
 *
 *  Two lists describe the same history from different sides: `points` are the
 *  measurements (one per day, oldest→newest), `runs` are the sweeps' own
 *  records (newest first) — including sweeps that died before measuring
 *  anything and so have no point at all. The ledger shows both, merged by day,
 *  because "the score moved" and "the check half-ran" are only readable
 *  together.
 *
 *  Honesty rules, same as everywhere in GEO: a value nobody measured is `null`
 *  and prints as "—", never as 0. A run without a point is a row, not a hole.
 */

/** The merge needs almost nothing from either record, so it asks for almost
 *  nothing — the component passes the full API shapes through unchanged. */
export interface PointLike { date: string }
export interface RunLike { day: string; score: number | null }

export interface LedgerPair<P extends PointLike, R extends RunLike> {
  /** stable render key */
  key: string;
  day: string;
  point: P | null;
  run: R | null;
}

/** Pair every measured day with the sweep that produced it, and keep the
 *  sweeps that produced nothing.
 *
 *  - `runs` come newest-first; when one day holds several (a manual run beside
 *    the scheduled one), the day's point attaches to the newest run that
 *    actually scored — else the newest — and the rest stand as their own rows.
 *  - A point with no run (stored before the run log existed) is still a row.
 *  - Output is newest-first by day; rows inside one day keep the runs' order.
 */
export function mergeRunLedger<P extends PointLike, R extends RunLike>(
  points: P[],
  runs: R[],
): LedgerPair<P, R>[] {
  const pointByDay = new Map<string, P>();
  for (const p of points) pointByDay.set(p.date, p);

  // Which run of each day carries that day's point: the first (newest) that
  // scored, else the first seen.
  const claimant = new Map<string, R>();
  for (const r of runs) {
    const held = claimant.get(r.day);
    if (!held || (held.score === null && r.score !== null)) claimant.set(r.day, r);
  }

  const rows: LedgerPair<P, R>[] = [];
  const pairedDays = new Set<string>();
  runs.forEach((r, i) => {
    const point = claimant.get(r.day) === r ? pointByDay.get(r.day) ?? null : null;
    if (point) pairedDays.add(r.day);
    rows.push({ key: `run:${r.day}:${i}`, day: r.day, point, run: r });
  });
  for (const p of points) {
    if (!claimant.has(p.date)) rows.push({ key: `pt:${p.date}`, day: p.date, point: p, run: null });
  }

  // Newest first. Days are YYYYMMDD so string order is date order; the sort is
  // stable, so several runs on one day keep the order the backend sent.
  return rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/* ------------------------------------------------------------- formatting -- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9m 40s". Under a minute "40s", over an hour "1h 4m". `null` = the sweep
 *  left no usable timestamps — "—", never "0s". */
export function durationLabel(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s) || s < 0) return "—";
  const t = Math.round(s);
  if (t < 60) return `${t}s`;
  const m = Math.floor(t / 60);
  const rest = t % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

/** An ISO timestamp as "29 Aug, 2:14 am", in the reader's own clock.
 *  Unparseable or missing → "—". */
export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const h24 = d.getHours();
  const h = h24 % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${mm} ${h24 < 12 ? "am" : "pm"}`;
}

/** A week's Monday as "24 Aug". Takes "YYYY-MM-DD" or "YYYYMMDD" — the two
 *  spellings the backend has used — and returns "" for anything else rather
 *  than "Invalid Date". */
export function weekLabel(start: string | null | undefined): string {
  const digits = (start ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const mo = +digits.slice(4, 6);
  const day = +digits.slice(6, 8);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return "";
  return `${day} ${MONTHS[mo - 1]}`;
}

/** "+6" / "−3" / "±0"; null → "—" (no earlier scored week to compare against —
 *  not the same thing as no change). */
export function deltaLabel(d: number | null | undefined): string {
  if (d === null || d === undefined || !Number.isFinite(d)) return "—";
  const r = Math.round(d);
  if (r > 0) return `+${r}`;
  if (r < 0) return `−${-r}`;
  return "±0";
}

export function deltaTone(d: number | null | undefined): "is-up" | "is-down" | "" {
  if (d === null || d === undefined || !Number.isFinite(d)) return "";
  const r = Math.round(d);
  return r > 0 ? "is-up" : r < 0 ? "is-down" : "";
}

/** Who started the sweep, in plain words. An unknown trigger value from a
 *  newer backend passes through rather than being mislabeled. */
export function triggerLabel(t: string | null | undefined): string {
  if (!t) return "—";
  if (t === "cron") return "scheduled";
  if (t === "manual") return "manual";
  return t;
}

/** What ended the sweep. "finished" when it completed; otherwise the recorded
 *  reason with its underscores read out, falling back to the terminal reason,
 *  then to plain "stopped early". */
export function outcomeLabel(run: {
  completed: boolean;
  stopped_because?: string | null;
  terminal_reason?: string | null;
}): string {
  if (run.completed) return "finished";
  const why = run.stopped_because && run.stopped_because !== "completed"
    ? run.stopped_because
    : run.terminal_reason;
  return why ? why.replace(/_/g, " ") : "stopped early";
}

/** Where the Action Plan stood when the sweep ran — the column that says
 *  whether planned work was actually moving while the score did. */
export function planLabel(p: { done: number; total: number } | null | undefined): string {
  if (p === undefined) return "—";
  if (p === null) return "no plan yet";
  return `plan ${p.done}/${p.total} done`;
}

/** Total errored calls across engines. Missing map → 0 errors recorded. */
export function errorCount(errors: Record<string, number> | null | undefined): number {
  if (!errors) return 0;
  return Object.values(errors).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/** The sentence over the weekly bars. Leads with the move since the last check
 *  when one is known, then says where this week's average stands. */
export function weeklyHeadline(
  sinceLast: { change: number | null; direction: string } | null | undefined,
  latestScore: number | null,
): string {
  const standing = latestScore === null
    ? "this week has no measurable score yet"
    : `this week's average is ${Math.round(latestScore)}`;
  if (!sinceLast || sinceLast.change === null || sinceLast.direction === "unknown") {
    return `${standing[0].toUpperCase()}${standing.slice(1)}.`;
  }
  const pts = Math.abs(Math.round(sinceLast.change));
  const unit = pts === 1 ? "point" : "points";
  const lead = sinceLast.direction === "up"
    ? `Up ${pts} ${unit} since the last check`
    : sinceLast.direction === "down"
      ? `Down ${pts} ${unit} since the last check`
      : "No change since the last check";
  return `${lead}; ${standing}.`;
}
