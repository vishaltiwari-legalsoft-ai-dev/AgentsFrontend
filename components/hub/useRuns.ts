"use client";

/** One load of the record, shared by Home and by Runs.
 *
 *  Both panels want the same page of the same collection with different filters
 *  on it, and both have to survive the same three outcomes — in flight, empty,
 *  unreadable. `lib/load` already owns those decisions and the supersession
 *  rules behind them, so this is a thin binding over it rather than a fourth
 *  hand-rolled `let cancelled`.
 */

import { useCallback, useEffect, useState } from "react";
import { listRuns, type RunsPage, type RunsQuery } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";

export interface RunsFeed {
  state: Load<RunsPage>;
  reload: () => void;
}

/** Poll while anything is moving. A run that lands while the reader is looking
 *  at the page should appear there without a refresh, and nothing should poll
 *  when the floor is quiet. */
const LIVE_POLL_MS = 20_000;

export function useRuns(query: RunsQuery, revision: number, opts: { live?: boolean } = {}): RunsFeed {
  const session = useLoadSession();
  const [state, setState] = useState<Load<RunsPage>>(loadPending);
  const [beat, setBeat] = useState(0);

  const { limit, agent, state: runState, brand, q } = query;

  const reload = useCallback(() => setBeat((b) => b + 1), []);

  useEffect(() => {
    void session.run(
      "runs",
      (signal) => listRuns({ limit, agent, state: runState, brand, q }, { signal }),
      setState,
      "The record could not be read.",
      // A refresh that fails must not blank a page that is already working.
      { keepStale: true },
    );
  }, [session, limit, agent, runState, brand, q, revision, beat]);

  const moving = opts.live !== false
    && state.data !== null
    && (state.data.live.running > 0 || state.data.live.queued > 0);

  useEffect(() => {
    if (!moving) return;
    const t = setInterval(() => setBeat((b) => b + 1), LIVE_POLL_MS);
    return () => clearInterval(t);
  }, [moving]);

  return { state, reload };
}
