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
 *  at least two of them — a single row has nothing to be "strongest" against. */
export function comparableEngines(rows: EngineRow[]): EngineRow[] {
  const native = rows.filter((r) => r.mode === "native" || r.mode === "serpapi");
  return native.length >= 2 ? native : [];
}

/** Suffix appended to an engine's display name. Only proxy earns one: native
 *  and serpapi ARE the product, and "off" engines are never rendered as data. */
export function modeSuffix(mode: GeoEngineMode): string {
  return mode === "proxy" ? " (proxy)" : mode === "unknown" ? " (surface unknown)" : "";
}
