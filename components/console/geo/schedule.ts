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
import type { GeoPollStatus } from "@/lib/api";

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
