/** Measurement provenance — the rules that stop the panel overstating itself.
 *
 *  Two of the four GEO "engines" can be answered by an OpenRouter stand-in
 *  model when no native key exists (`geo_engines.poll_engine`). The rate that
 *  comes back is real, but it was not measured on the product named on the
 *  chip. Two things follow, and both live here so they are testable without a
 *  component:
 *
 *    1. a proxy-measured number must be labelled as such, everywhere;
 *    2. a proxy engine must never be ranked against a native one — that
 *       difference is an artefact of the surface, not a fact about the engine,
 *       and "strongest on X, weakest on Y" reads as the latter.
 */
import type { GeoEngineMode, GeoEngineStatus } from "@/lib/api";

export type EngineRow = {
  engine: string;
  rate: number;
  n: number;
  mode: GeoEngineMode;
  model: string;
};

/** Status for an engine the backend did not describe. Pre-`engine_status`
 *  backends only sent a boolean, which cannot distinguish native from proxy —
 *  so an unknown surface claims nothing rather than claiming "native". */
export function statusOf(
  status: Record<string, GeoEngineStatus>,
  engine: string,
  connected: boolean,
): GeoEngineStatus {
  return (
    status[engine] ?? {
      connected,
      mode: connected ? "unknown" : "off",
      model: "",
      means: connected ? "measurement surface not reported by this backend" : "no key configured",
    }
  );
}

export const isProxy = (row: { mode: GeoEngineMode }) => row.mode === "proxy";

export function proxyEngines(rows: EngineRow[]): EngineRow[] {
  return rows.filter(isProxy);
}

/** The surfaces that ARE the product a buyer sees, whoever fetched them.
 *
 *  One list, one predicate, because there were five copies of this test and
 *  four of them read `native || serpapi`. When the backend retired SerpAPI for
 *  DataForSEO those four started drawing Google's AI Overview and AI Mode —
 *  the two engines that had just started working properly — as not live. A
 *  panel that has to be told about a vendor change in five places will be told
 *  in four.
 *
 *  `serpapi` stays in the list because answers fetched by it are still stored
 *  and still carry that surface; nothing produces it any more. */
const LIVE_MODES: readonly GeoEngineMode[] = ["native", "serpapi", "dataforseo"];

export const isLiveMode = (mode: GeoEngineMode | null | undefined): boolean =>
  mode != null && LIVE_MODES.includes(mode);

/** Whether a number from this engine was measured on the real product.
 *  Everything drawn as "live" anywhere in GEO goes through this. */
export const isLive = (
  st: { connected: boolean; mode: GeoEngineMode } | null | undefined,
): boolean => st?.connected === true && isLiveMode(st.mode);

/** Rows that may legitimately be ranked against each other: same surface, and
 *  at least two of them — a single row has nothing to be "strongest" against. */
export function comparableEngines(rows: EngineRow[]): EngineRow[] {
  const native = rows.filter((r) => isLiveMode(r.mode));
  return native.length >= 2 ? native : [];
}

/** Suffix appended to an engine's display name. Only proxy earns one: native,
 *  serpapi and dataforseo ARE the product, and "off" engines are never
 *  rendered as data. */
export function modeSuffix(mode: GeoEngineMode): string {
  return mode === "proxy" ? " (similar model)" : mode === "unknown" ? " (surface unknown)" : "";
}

// ---------------------------------------------------------------- engine cards

export type EngineCardState =
  /** measured inside this report's window */
  | "measured"
  /** measured before, but not inside this window — data exists, it is just old */
  | "stale"
  /** connected, never produced an answer */
  | "never"
  /** no key configured */
  | "off";

export type EngineCard = {
  engine: string;
  mode: GeoEngineMode;
  state: EngineCardState;
  /** null when nothing in this window could carry a mention */
  rate: number | null;
  /** answers a mention could have appeared in */
  measured: number;
  /** answers where the engine published nothing to appear in (AIO) */
  emptySlots: number;
  /** calls that failed outright — a dead key, an exhausted quota, an outage */
  errors: number;
  /** every row stored for this engine in this window */
  attempted: number;
  lastSeen: string | null;
  model: string;
};

/** Why an engine that HAS rows in the window still carries no rate.
 *
 *  "Google published no AI Overview" and "our own call failed" are opposite
 *  facts, and the panel printed the flattering one for both: an AIO engine
 *  whose every call errored rendered as "nothing to appear in: 0 of 0 queries
 *  returned no AI Overview". Nobody reading that would go check the key. The
 *  reason is decided here so a component cannot re-mix them.
 */
export type BlankReason = "errors" | "no_answer_published" | "mixed" | "nothing_stored";

export function blankReason(card: Pick<EngineCard, "errors" | "emptySlots">): BlankReason {
  if (card.errors > 0 && card.emptySlots > 0) return "mixed";
  if (card.errors > 0) return "errors";
  if (card.emptySlots > 0) return "no_answer_published";
  return "nothing_stored";
}

type BlockLike = {
  mention: { rate: number | null };
  n_answers: number;
  n_measured?: number;
  n_errors?: number;
  n_no_aio?: number;
};

/** One card per engine we know about — including the ones with nothing in this
 *  window.
 *
 *  An engine used to be rendered only if the window contained its answers, so
 *  Google AIO disappeared from the panel entirely once its data aged past seven
 *  days. AIO runs once per prompt where chat engines run three times, so it is
 *  always the first to age out, and vanishing reads as "this engine is broken"
 *  rather than "this engine was last measured on the 11th".
 */
export function engineCards(
  engines: Record<string, BlockLike | undefined>,
  lastSeen: Record<string, string>,
  status: Record<string, GeoEngineStatus>,
  known: string[],
): EngineCard[] {
  const cards = known.map((engine): EngineCard => {
    const block = engines[engine];
    const st = statusOf(status, engine, Boolean(block));
    const seen = lastSeen[engine] || null;
    const measured = block ? block.n_measured ?? block.n_answers : 0;
    const inWindow = Boolean(block && block.n_answers > 0);
    return {
      engine,
      mode: st.mode,
      state: inWindow ? "measured" : seen ? "stale" : st.mode === "off" ? "off" : "never",
      rate: inWindow ? block!.mention.rate : null,
      measured,
      emptySlots: block?.n_no_aio ?? 0,
      errors: block?.n_errors ?? 0,
      attempted: block?.n_answers ?? 0,
      lastSeen: seen,
      model: st.model,
    };
  });
  // measured first (best rate leading), then stale, then never/off — the cards
  // that carry a number should not sit below the ones that do not
  const rank: Record<EngineCardState, number> = { measured: 0, stale: 1, never: 2, off: 3 };
  return cards.sort((a, b) =>
    rank[a.state] - rank[b.state] || (b.rate ?? -1) - (a.rate ?? -1) || a.engine.localeCompare(b.engine));
}

/* ------------------------------------------ how many were asked for, and why */

/** How an engine is asked, from `/geo/config`'s `engine_specs`.
 *
 *  Read rather than mirrored. This console used to carry its own
 *  `SERP_ENGINES = ["aio", "ai_mode"]` and `CHAT_RUNS_PER_PROMPT = 3`, which is
 *  the same shape of defect as the "four AI engines" line that stayed wrong for
 *  months: a copy of a fact starts lying the day the fact changes.
 *
 *  `kind` is not a union on purpose — an engine kind this build has never heard
 *  of must read as "not billed", not fail to compile. */
export interface EngineSpecLike {
  /** "chat" is sampled repeatedly; "serp" is a billed Google snapshot */
  kind: string;
  /** readings of each question one check buys */
  runs_per_prompt: number;
  /** the question intents this engine is spent on; null = every question */
  intents: string[] | null;
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];
const inWords = (count: number) => COUNT_WORDS[count] ?? String(count);

/** Why an engine's answer count is the number it is. */
export type CoverageState =
  /** every answer the window asked for is stored */
  | "complete"
  /** fewer than the window asked for, and `why` says by how many */
  | "short"
  /** dropped from checks — the month's shared search credit is spent */
  | "paused"
  /** no check ran inside this window at all */
  | "no_checks"
  /** nothing to ask it: no question in the list needs this engine */
  | "none"
  /** the wire is missing a number this cannot be worked out without */
  | "unknown";

export interface EngineCoverage {
  state: CoverageState;
  /** the fraction, e.g. "102 of 170 asked across 5 checks" — or a bare count
   *  when there is no honest denominator to divide by */
  count: string;
  /** why that number is what it is, in plain words. Empty when nothing on the
   *  wire supports saying anything. */
  why: string;
}

export interface CoverageInput {
  /** answers stored for this engine in the window — `n_answers`, NOT
   *  `n_measured`: `n_expected` excludes nothing, so the numerator that matches
   *  it is every row the ask produced, failed calls and empty overviews
   *  included. */
  got: number;
  /** `n_expected`: what ONE check of this engine owes. Per check, where every
   *  other count in the block is per window — pairing it with `n_answers`
   *  unscaled renders "350 of 70 asked", which is worse than the unexplained
   *  numbers this was built to explain. */
  expected?: number | null;
  /** `n_sweeps`: checks the brand actually ran inside the window. The scaling
   *  factor, and zero is a real answer — say so, never divide by it. */
  sweeps?: number | null;
  /** calls that failed outright */
  errors?: number;
  /** questions Google published no AI Overview for */
  emptySlots?: number;
  /** how this engine is asked. Absent until `/geo/config` carries
   *  `engine_specs`; then no cadence is claimed, only the arithmetic. */
  spec?: EngineSpecLike | null;
  /** `search_credit_spent`: the month's billed-search budget is gone, so the
   *  billed engines are frozen. On `/report`, so it survives a refresh. */
  creditSpent?: boolean;
  creditUsed?: number | null;
  creditLimit?: number | null;
  /** `serp_capped_since`: when the pause began */
  pausedSince?: string | null;
  /** `engine_last_seen[engine]`: when this engine last answered */
  lastSeen?: string | null;
  /** the report's OWN window, already clamped — not the one we asked for */
  days?: number | null;
  timeZone?: string;
}

/** "28 Aug", or null when there is no usable date — this console does not
 *  invent one. */
export function shortDate(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(at);
}

const whole = (x: number | null | undefined) =>
  typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;

/** A count on the wire, or null when the field is absent. The difference is the
 *  whole deploy-skew rule: absent means "we cannot say", never zero. */
const counted = (x: number | null | undefined): number | null =>
  typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.round(x)) : null;

const num = (x: number) => x.toLocaleString("en-US");

/** How this engine is asked, in words, derived from its spec rather than from a
 *  list of engine ids kept here. Empty when the spec has not landed. */
function cadenceWords(spec: EngineSpecLike | null | undefined): string {
  if (!spec) return "";
  const runs = Math.max(1, whole(spec.runs_per_prompt) || 1);
  const reading = `${inWords(runs)} reading${runs === 1 ? "" : "s"} of every question`;
  return restrictedToDiscovery(spec)
    ? `${reading}, and only the ones that do not already name you`
    : reading;
}

/** Whether this engine skips the questions that already name the brand. Read
 *  off the spec's own intent list, so it stays true if the split changes. */
const restrictedToDiscovery = (spec: EngineSpecLike | null | undefined): boolean =>
  Array.isArray(spec?.intents) && !spec.intents.includes("brand");

/** Facts about the rows that DID run. Neither explains a shortfall — a failed
 *  call still stores a row, so both are inside `n_answers` — but "the call
 *  failed" sends somebody to check a key and "Google published nothing" does
 *  not, so they are never merged into one clause. */
function rowNotes(errors: number, empty: number): string[] {
  const notes: string[] = [];
  if (errors > 0) notes.push(`${num(errors)} of them failed`);
  if (empty > 0) notes.push(`Google published nothing on ${num(empty)}`);
  return notes;
}

const join = (clauses: (string | null | undefined)[]) =>
  clauses.filter((c): c is string => Boolean(c)).join(" · ");

/** How much of what an engine was asked for came back, and why that is not the
 *  same number as the engine beside it.
 *
 *  The team read ~120 answers from each chat engine beside ~34 from Google's
 *  two and filed it as a bug. It is not one: a chat engine is sampled several
 *  times per question because its wording varies between readings, and Google's
 *  two are asked once, only on the questions that do not already name the
 *  brand, because every one of those is a paid search call.
 *
 *  Two numbers make that sayable and NEITHER is optional to the arithmetic:
 *  `n_expected` is per check, `n_sweeps` is how many checks ran in the window.
 *  Missing either, this says nothing rather than dividing a per-window count by
 *  a per-check expectation — which renders "350 of 70 asked".
 */
export function engineCoverage(input: CoverageInput): EngineCoverage {
  const got = whole(input.got);
  const errors = whole(input.errors);
  const empty = whole(input.emptySlots);
  const perCheck = counted(input.expected);
  const sweeps = counted(input.sweeps);
  const billed = input.spec?.kind === "serp";
  const cadence = cadenceWords(input.spec);
  const notes = rowNotes(errors, empty);
  const stored = got > 0 ? `${num(got)} answer${got === 1 ? "" : "s"} stored` : "nothing stored";

  // The window's real expectation: what one check owes, times the checks that
  // ran. Null when either half is missing, or when no check ran at all.
  const owed = perCheck !== null && sweeps !== null && sweeps > 0 ? perCheck * sweeps : null;
  const across = sweeps !== null && sweeps > 1 ? ` across ${num(sweeps)} checks` : "";
  const asked = owed === null ? null : `${num(got)} of ${num(owed)} asked${across}`;

  // Paused first, and still against the scaled expectation: five checks owed
  // AI Overview 170 and the credit bought two of them, so "68 of 170 asked"
  // is the shortfall. "68 of 68" would dress the hole up as a full set.
  if (billed && input.creditSpent === true) {
    const used = counted(input.creditUsed);
    const limit = counted(input.creditLimit);
    const spend = limit !== null && used !== null ? ` (${num(used)} of ${num(limit)} used)` : "";
    const since = shortDate(input.pausedSince, input.timeZone);
    const seen = shortDate(input.lastSeen, input.timeZone);
    return {
      state: "paused",
      count: asked ?? stored,
      why: join([
        `paused — this month's search credit is spent${spend}`,
        since ? `none since ${since}` : seen ? `last answer ${seen}` : null,
      ]),
    };
  }

  // A number this cannot be worked out without is not on the wire yet. Say
  // nothing: Vercel is live four to six minutes before Cloud Run, and a
  // denominator invented in that window is the bug, not the fix.
  if (perCheck === null || sweeps === null) return { state: "unknown", count: "", why: "" };

  if (sweeps === 0) {
    return {
      state: "no_checks",
      count: stored,
      why: join([
        input.days ? `no check ran in the last ${num(input.days)} days` : "no check ran in this window",
        ...notes,
      ]),
    };
  }

  if (perCheck === 0) {
    return {
      state: "none",
      count: "not asked",
      why: restrictedToDiscovery(input.spec)
        ? "no question needs it — every one of yours already names you"
        : "no questions are enabled for it",
    };
  }

  const owedNow = perCheck * sweeps;

  // More stored than the window asks for: the question list shrank since these
  // landed, or a check was hand-driven at a bigger sample. "190 of 170 asked"
  // reads as a broken counter, so it prints the count it is sure of.
  if (got > owedNow) {
    return {
      state: "complete",
      count: stored,
      why: join([cadence, "more than your current list asks for, so some are from questions since removed", ...notes]),
    };
  }

  if (got === owedNow) return { state: "complete", count: asked!, why: join([cadence, ...notes]) };

  return {
    state: "short",
    count: asked!,
    why: join([cadence, `${num(owedNow - got)} never ran`, ...notes]),
  };
}
