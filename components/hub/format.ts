/** Turning what the backend stores into what the console reads.
 *
 *  The prototype's dates were day numbers in a fixed August, so "Today" was a
 *  comparison against a constant. These are real ISO timestamps in the caller's
 *  own zone, which brings two problems a prototype does not have: a timestamp
 *  formatted on the server and again in the browser must not disagree, and a
 *  duration the trail never recorded must not come out as `0s`.
 */

/** Clock time in the reader's zone, 24-hour, as the ledger prints it. */
export function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** [big, small] — the pair a day divider in the ledger shows. */
export function dayLabel(iso: string, now = new Date()): [string, string] {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ["Earlier", ""];
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  if (days === 0) return ["Today", `${weekday} ${date}`];
  if (days === 1) return ["Yesterday", `${weekday} ${date}`];
  if (days < 7) return [weekday, date];
  return [date, d.toLocaleDateString("en-US", { year: "numeric" })];
}

/** The calendar day an ISO timestamp falls on, in the reader's zone. Used to
 *  group the ledger, so two runs either side of midnight UTC still land under
 *  the day the reader remembers them happening. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `3m 04s`. `null` in means the trail never timed this run, and the caller is
 *  expected to render the em dash rather than a zero. */
export function took(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** How long until, in the words someone says out loud — `ago`'s future mirror.
 *  A time already past (or right now) reads "any moment now": a next-run time
 *  the clock has walked past means the job is due, not that anything broke. */
export function until(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.round((d.getTime() - now.getTime()) / 1000);
  if (secs < 60) return "any moment now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `on ${d.toLocaleDateString("en-US", { day: "numeric", month: "long" })}`;
}

/** How long ago, in the words someone says out loud. */
export function ago(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long" });
}
