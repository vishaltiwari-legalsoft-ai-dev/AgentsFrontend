/** What the panel says about polling now that a cron does it.
 *
 *  A sweep is ~400 engine calls. Driven from the browser that was half an hour
 *  of a tab held open; the cron runs it unattended every `interval_days`. So
 *  the header's job changed: it no longer narrates a progress bar, it answers
 *  "is my data current, and when does it refresh next".
 *
 *  Pure so the wording — including the cases with no data to state — is pinned
 *  by tests rather than by whatever a component happened to render.
 */
import type { GeoBrandRow, GeoPollStatus } from "@/lib/api";

const DAY_MS = 86_400_000;

/** "18 Aug" — short, unambiguous, no year unless it differs from today's. */
export function shortDate(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC",
  });
}

/** Whole days from `now` to `iso`, rounded up: a sweep due in 4 hours is
 *  "tomorrow", not "in 0 days". Negative when already due. */
export function daysUntil(iso: string, now: Date): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.ceil((target - now.getTime()) / DAY_MS);
}

export function relativeDue(iso: string, now: Date): string {
  const days = daysUntil(iso, now);
  if (days <= 0) return "due now";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export type ScheduleLine = { text: string; tone: "normal" | "attention" };

/** The one line under the brand header. Never invents a date: a brand that has
 *  never completed a sweep says exactly that. */
export function scheduleLine(status: GeoPollStatus | null, now: Date): ScheduleLine {
  if (!status) return { text: "Checking schedule…", tone: "normal" };
  if (!status.auto_poll) {
    return {
      text: "Scheduled polling is off for this brand — data refreshes only when you poll manually.",
      tone: "attention",
    };
  }
  const every = status.interval_days === 1 ? "every day" : `every ${status.interval_days} days`;
  if (!status.last_completed_at) {
    return {
      text: `Never polled yet — the scheduled sweep runs ${every} and will pick this brand up on its next fire.`,
      tone: "attention",
    };
  }
  const last = shortDate(status.last_completed_at, now);
  if (!status.next_due_at) return { text: `Last polled ${last}.`, tone: "normal" };
  return {
    text: `Last polled ${last} · next ${shortDate(status.next_due_at, now)} (${relativeDue(status.next_due_at, now)}), ${every}.`,
    tone: "normal",
  };
}

/** Shown only while a sweep is genuinely mid-flight, so a completed brand does
 *  not carry a stale "120 of 400" forever. */
export function partialSweepLine(status: GeoPollStatus | null): string | null {
  if (!status || status.total === 0 || status.pending === 0 || status.done === 0) return null;
  return `Sweep in progress: ${status.done} of ${status.total} answers collected — the rest resume on the next scheduled run.`;
}

/* --------------------------------- one row ---------------------------------- */

/** The scheduled check as ONE row of the brand list reports it.
 *
 *  `scheduleLine` above answers for the brand that is open, off `poll/status`.
 *  This answers for every row in a list, off the three fields
 *  `GET /api/geo/brands` carries per brand — so the Brands screen draws N
 *  switches from one request rather than N.
 *
 *  All three fields are optional, and reading them lives here rather than at a
 *  call site because the honest answer during a deploy is *we do not know yet*:
 *  Vercel is live about a minute after a push and Cloud Run four to six minutes
 *  after, so for those few minutes the list answers without them. Defaulting to
 *  `false` would tell somebody a brand that IS checked weekly costs them
 *  nothing; defaulting to `true` would tell them a brand nobody watches is
 *  watched. Both are claims the wire never made, so `on` and `intervalDays` go
 *  null and the panel draws the same honest dash it draws for any figure it has
 *  no source for.
 */
export interface BrandCheck {
  /** null = the backend did not report it (deploy skew), NOT "off". */
  on: boolean | null;
  intervalDays: number | null;
  /** null when the brand has never completed a sweep: it is due on the next
   *  run, not on some invented date. */
  nextDueAt: string | null;
}

type BrandCheckFields = Pick<GeoBrandRow, "auto_poll" | "poll_interval_days" | "next_due_at">;

export function checkOf(row: BrandCheckFields | null | undefined): BrandCheck {
  return {
    on: typeof row?.auto_poll === "boolean" ? row.auto_poll : null,
    intervalDays: typeof row?.poll_interval_days === "number" ? row.poll_interval_days : null,
    nextDueAt: row?.next_due_at ?? null,
  };
}

/** "every day" / "every 7 days", or null when the cadence was not reported. */
export function cadenceWords(intervalDays: number | null): string | null {
  if (intervalDays === null) return null;
  return intervalDays === 1 ? "every day" : `every ${intervalDays} days`;
}

export type CheckLine = { text: string; tone: "normal" | "attention" | "unknown" };

/** What a row says beside its switch.
 *
 *  Never a bare "on" or "off". This switch decides whether a brand costs money
 *  on a schedule, and what an off brand costs instead is gaps in its history —
 *  so both halves of that are said in words every time, not left to the reader
 *  to infer from the position of a knob.
 */
export function checkLine(check: BrandCheck, now: Date): CheckLine {
  if (check.on === null) {
    return {
      text: "Not reported yet. This console goes live a few minutes before the backend "
        + "that answers for the schedule — reload shortly to see it.",
      tone: "unknown",
    };
  }
  if (!check.on) {
    return {
      text: "Off. This brand is checked only when someone presses Check now, so its "
        + "history will have gaps.",
      tone: "attention",
    };
  }
  const cadence = cadenceWords(check.intervalDays);
  const every = cadence ? `Checked ${cadence}` : "Checked on a schedule";
  if (!check.nextDueAt) {
    return {
      text: `${every}, and paid for on that cadence. Never checked yet, so the next `
        + "scheduled run picks it up.",
      tone: "normal",
    };
  }
  return {
    text: `${every}, and paid for on that cadence. Next ${shortDate(check.nextDueAt, now)}`
      + ` — ${relativeDue(check.nextDueAt, now)}.`,
    tone: "normal",
  };
}

/** The toast after the switch is flipped. Both directions state the
 *  consequence rather than the setting: switching it on starts spending on a
 *  cadence, switching it off starts leaving holes in the record. */
export function checkToggleWords(name: string, on: boolean, intervalDays: number | null): string {
  if (!on) {
    return `${name} will now be checked only when someone presses Check now, `
      + "so expect gaps in its history.";
  }
  const cadence = cadenceWords(intervalDays);
  return `${name} will now be checked ${cadence ?? "on its schedule"} without anyone asking, `
    + "and each run spends engine calls.";
}
