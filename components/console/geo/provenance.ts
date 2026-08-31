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

/** Rows that may legitimately be ranked against each other: same surface, and
 *  at least two of them — a single row has nothing to be "strongest" against.
 *  `serpapi` and `dataforseo` both count: each fetches the real consumer
 *  Google surface, only the vendor differs. */
export function comparableEngines(rows: EngineRow[]): EngineRow[] {
  const native = rows.filter(
    (r) => r.mode === "native" || r.mode === "serpapi" || r.mode === "dataforseo",
  );
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
