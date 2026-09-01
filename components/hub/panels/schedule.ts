/** Schedule — the decisions behind the Schedule panel.
 *
 *  Pure on purpose, like `./issues.ts`: which band a job lands in, the order
 *  inside a band, the plain-language reading of a cron expression, and the
 *  statement the page opens with are all rules, not I/O, so they live here
 *  where `schedule.test.ts` can prove them in node with no DOM.
 *
 *  The one rule that must not be missed: `origin: "registry_only"` means two
 *  different things. With `scheduler_ok` true it is a dead cron — the backend
 *  expects the job and the scheduler does not have it, the exact failure that
 *  once went unnoticed for weeks. With `scheduler_ok` false EVERY row arrives
 *  registry-only because expectations were all that could be read, so nothing
 *  is "missing", nothing is "on schedule", and the whole page is the honest
 *  partial: dead-cron detection is simply not evaluated.
 */

import type { CronJob, CronJobsPayload } from "@/lib/api";
import { Cap, n, word } from "../model";

/* ------------------------------------------------------------ row states -- */

export type RowState =
  | "dead"          // scheduler ok, registry expects it, scheduler lacks it
  | "failed"        // enabled and registered, last attempt did not succeed
  | "unregistered"  // firing in production with no registry entry
  | "paused"        // in the scheduler, deliberately not firing
  | "neverRan"      // enabled, no attempt on record yet
  | "healthy"       // enabled, last attempt succeeded
  | "unconfirmed";  // scheduler unread — registry expectation only

export interface ScheduleRow {
  job: CronJob;
  state: RowState;
}

export interface ScheduleCounts {
  dead: number;
  failed: number;
  unregistered: number;
  paused: number;
  total: number;
}

export interface SchedulePage {
  /** "live" — the scheduler answered and every row carries its real state.
   *  "registry" — the honest partial: rows are expectations, nothing is live. */
  mode: "live" | "registry";
  /** Dead, then failed, then unregistered — most serious first. Always empty
   *  in registry mode: a row cannot be missing from a scheduler nobody read. */
  needsLook: ScheduleRow[];
  /** Everything else — soonest next fire first, paused last. In registry mode
   *  this is every row, in arrival order, all "unconfirmed". */
  onClock: ScheduleRow[];
  counts: ScheduleCounts;
}

/** A paused job whose last run failed counts as paused, not failed — pausing
 *  it was a decision, and the failure is history until someone resumes it. An
 *  unregistered job stays "unregistered" whatever its live state: the defect
 *  is the missing record, and the row's note carries the last attempt. */
function stateOf(job: CronJob): RowState {
  if (job.origin === "registry_only") return "dead";
  if (job.origin === "live_only") return "unregistered";
  if (job.state === "PAUSED") return "paused";
  if (job.last_attempt && !job.last_attempt.ok) return "failed";
  if (!job.last_attempt) return "neverRan";
  return "healthy";
}

const NEED_ORDER: readonly RowState[] = ["dead", "failed", "unregistered"];

const fireTime = (job: CronJob): number => {
  if (!job.next_time) return Number.POSITIVE_INFINITY;
  const t = Date.parse(job.next_time);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

export function classify(payload: CronJobsPayload): SchedulePage {
  const total = payload.jobs.length;

  if (!payload.scheduler_ok) {
    return {
      mode: "registry",
      needsLook: [],
      onClock: payload.jobs.map((job) => ({ job, state: "unconfirmed" as const })),
      counts: { dead: 0, failed: 0, unregistered: 0, paused: 0, total },
    };
  }

  const rows = payload.jobs.map((job) => ({ job, state: stateOf(job) }));
  const needsLook = NEED_ORDER.flatMap((s) => rows.filter((r) => r.state === s));
  const ticking = rows
    .filter((r) => r.state === "healthy" || r.state === "neverRan")
    .sort((a, b) => fireTime(a.job) - fireTime(b.job));
  const paused = rows.filter((r) => r.state === "paused");

  return {
    mode: "live",
    needsLook,
    onClock: [...ticking, ...paused],
    counts: {
      dead: rows.filter((r) => r.state === "dead").length,
      failed: rows.filter((r) => r.state === "failed").length,
      unregistered: rows.filter((r) => r.state === "unregistered").length,
      paused: paused.length,
      total,
    },
  };
}

/* ------------------------------------------------------------- statement -- */

/** The opening sentence, split so the view can set the marked span in `<b>`
 *  without this module holding any JSX. `strong` null means nothing in the
 *  sentence is emphasised. */
export interface Statement {
  pre: string;
  strong: string | null;
  post: string;
  lede: string;
}

/** Priority: dead > failed > unregistered > paused > healthy. The view renders
 *  `Blank` for a live page with zero jobs before ever asking for a statement,
 *  so `counts.total` is at least 1 here in live mode. */
export function statement(page: SchedulePage): Statement {
  const { dead, failed, unregistered, paused, total } = page.counts;

  if (page.mode === "registry") {
    return {
      pre: "The scheduler could not be read.",
      strong: null,
      post: "",
      lede: "The registry below says what should be running. Whether it is actually running could not be confirmed just now.",
    };
  }

  if (dead > 0) {
    return {
      pre: `${Cap(word(dead))} scheduled job${dead === 1 ? "" : "s"} ${dead === 1 ? "is" : "are"} `,
      strong: "missing from the scheduler.",
      post: "",
      lede: "A job the backend expects is not in the scheduler, so whatever it refreshed is quietly going stale. This is the failure that has gone unnoticed before — it is named first.",
    };
  }

  if (failed > 0) {
    return {
      pre: `${Cap(word(failed))} of ${word(total)} jobs `,
      strong: `failed ${failed === 1 ? "its" : "their"} last run`,
      post: ".",
      lede: "The schedule is intact, but the last attempt did not succeed. Until the next successful run, that job's data stands still.",
    };
  }

  if (unregistered > 0) {
    return {
      pre: `${Cap(word(unregistered))} job${unregistered === 1 ? "" : "s"} ${unregistered === 1 ? "is" : "are"} `,
      strong: "running with no record of why",
      post: ".",
      lede: "A job is firing in production that the registry does not document. It should be registered — or removed.",
    };
  }

  if (paused > 0) {
    const lede = "A paused job is a choice, not a fault — it simply will not fire until it is resumed.";
    const ticking = total - paused;
    if (ticking === 0) return { pre: "Everything is paused.", strong: null, post: "", lede };
    return {
      pre: `${Cap(word(ticking))} job${ticking === 1 ? "" : "s"} on the clock. `,
      strong: `${Cap(word(paused))} paused.`,
      post: "",
      lede,
    };
  }

  return {
    pre: total === 1
      ? "The one scheduled job ran when it was supposed to."
      : `All ${word(total)} jobs ran when they were supposed to.`,
    strong: null,
    post: "",
    lede: "Each job below runs on its own clock — no person starts it. This page says what each one does, why it runs when it runs, and whether the last run actually happened.",
  };
}

/** The shell's headline: the count, then the worst thing true right now. */
export function headline(page: SchedulePage): string {
  const { dead, failed, unregistered, paused, total } = page.counts;
  if (page.mode === "registry") return `${n(total)} expected · scheduler not read`;
  if (total === 0) return "nothing on the clock";
  const worst =
    dead > 0 ? `${n(dead)} missing`
      : failed > 0 ? `${n(failed)} failed`
        : unregistered > 0 ? `${n(unregistered)} unregistered`
          : paused > 0 ? `${n(paused)} paused`
            : "all on time";
  return `${n(total)} on the clock · ${worst}`;
}

/* ------------------------------------------------- the schedule, in words -- */

/** Zone label the sentences use. Only the two zones this workspace actually
 *  schedules in get a short name; anything else keeps its IANA name rather
 *  than guessing an abbreviation. */
export function tzLabel(timezone: string): string {
  if (timezone === "Asia/Kolkata") return "IST";
  if (timezone === "UTC") return "UTC";
  return timezone;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** 12-hour clock, the way the sentence says it: "2:00 AM", "3:30 AM". */
function clock12(hour: number, minute: number): string {
  const half = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${half}`;
}

/** A cron expression as either a plain sentence or, when the pattern is one
 *  this reader does not cover, the raw expression handed back honestly for the
 *  view to set in `<code>` — never a wrong paraphrase. */
export type ScheduleWords =
  | { kind: "words"; text: string }
  | { kind: "raw"; cron: string; tz: string };

export function scheduleWords(cron: string, timezone: string): ScheduleWords {
  const tz = tzLabel(timezone);
  const parts = cron.trim().split(/\s+/);

  if (parts.length === 5) {
    const [min, hour, dom, mon, dow] = parts;
    const everyMin = /^\*\/(\d+)$/.exec(min);
    const everyHour = /^\*\/(\d+)$/.exec(hour);
    const rest = (fields: string[]) => fields.every((f) => f === "*");

    if (everyMin && rest([hour, dom, mon, dow])) {
      const step = Number(everyMin[1]);
      return { kind: "words", text: step === 1 ? "Every minute" : `Every ${step} minutes` };
    }

    if (/^\d+$/.test(min) && everyHour && rest([dom, mon, dow])) {
      const step = Number(everyHour[1]);
      return { kind: "words", text: step === 1 ? "Every hour" : `Every ${step} hours` };
    }

    if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
      const time = clock12(Number(hour), Number(min));
      if (rest([dom, mon, dow])) {
        return { kind: "words", text: `Daily at ${time} ${tz}` };
      }
      if (dom === "*" && mon === "*" && /^\d$/.test(dow) && Number(dow) <= 7) {
        return { kind: "words", text: `Every ${WEEKDAYS[Number(dow) % 7]} at ${time} ${tz}` };
      }
      if (/^\d+$/.test(dom) && mon === "*" && dow === "*") {
        return { kind: "words", text: `Monthly on day ${Number(dom)} at ${time} ${tz}` };
      }
    }
  }

  return { kind: "raw", cron, tz };
}

/** The one-string form, for the tests and for anywhere that cannot mark the
 *  raw expression up. The view renders `scheduleWords` itself so the fallback
 *  keeps its `<code>`. */
export function humanSchedule(cron: string, timezone: string): string {
  const w = scheduleWords(cron, timezone);
  return w.kind === "words" ? w.text : `On the schedule ${w.cron} (${w.tz})`;
}
