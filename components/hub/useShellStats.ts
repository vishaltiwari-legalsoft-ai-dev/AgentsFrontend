"use client";

/** The figures the shell itself carries: the rail's counts and footer line, and
 *  the account block in the header.
 *
 *  Every one of them is fetched. A count that has not arrived is simply absent
 *  from the rail rather than rendered as `0`, because a zero beside "Runs" is a
 *  claim — that nothing has ever run — and this hook is not in a position to
 *  make it. Same for the account block: when the OpenRouter key is not
 *  configured the block is empty, not a row of dashes pretending to be figures.
 */

import { useEffect, useState } from "react";
import { getIssues, getNews, loadLibrary, listRuns } from "@/lib/api";
import { LIVE_AGENTS, n, type PanelId } from "./model";

interface OrStats {
  configured: boolean;
  error?: boolean;
  totalCredits?: number | null;
  totalUsage?: number | null;
  tokens30d?: number | null;
  spend30d?: number | null;
}

export interface SpendCell {
  label: string;
  value: string;
}

export interface ShellStats {
  counts: Partial<Record<PanelId, number>>;
  railStat: string;
  spend: SpendCell[];
  hasNews: boolean;
}

function fmtTokens(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

export function useShellStats(enabled: boolean, revision: number): ShellStats {
  const [counts, setCounts] = useState<Partial<Record<PanelId, number>>>({ agents: LIVE_AGENTS.length });
  const [totalRuns, setTotalRuns] = useState<number | null>(null);
  const [spend, setSpend] = useState<SpendCell[]>([]);
  const [hasNews, setHasNews] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let dead = false;

    const load = () => {
      // The account block. A missing key is not an error — it is a console
      // running without OpenRouter, and the right rendering of that is nothing.
      fetch("/api/or-stats")
        .then((r) => r.json())
        .then((s: OrStats) => {
          if (dead) return;
          if (!s.configured || s.error) { setSpend([]); return; }
          const cells: SpendCell[] = [];
          if (s.tokens30d != null) cells.push({ label: "Tokens 30d", value: fmtTokens(s.tokens30d) });
          if (s.totalCredits != null && s.totalUsage != null) {
            cells.push({ label: "Credits left", value: usd0(s.totalCredits - s.totalUsage) });
          }
          if (s.spend30d != null) cells.push({ label: "Spend 30d", value: usd0(s.spend30d) });
          setSpend(cells);
        })
        .catch(() => { if (!dead) setSpend([]); });

      loadLibrary(1)
        .then((brands) => { if (!dead) setCounts((c) => ({ ...c, library: brands.length })); })
        .catch(() => { /* the rail simply carries no count */ });

      // The badge counts what deserves attention — high + medium. Low-severity
      // rows are in the panel but do not earn a number on the rail.
      getIssues()
        .then((p) => {
          if (!dead) setCounts((c) => ({ ...c, issues: p.counts.high + p.counts.medium }));
        })
        .catch(() => { /* no count rather than a wrong one */ });

      listRuns({ limit: 1 })
        .then((r) => {
          if (dead) return;
          setTotalRuns(r.total);
          // A count that could not be read leaves the rail without one, rather
          // than putting a 0 beside "Runs" — which is a claim, not a blank.
          if (r.total !== null) setCounts((c) => ({ ...c, runs: r.total as number }));
        })
        .catch(() => { /* no count rather than a wrong one */ });

      getNews()
        .then((news) => { if (!dead) setHasNews(!!news.text); })
        .catch(() => { if (!dead) setHasNews(false); });
    };

    load();
    window.addEventListener("focus", load);
    return () => {
      dead = true;
      window.removeEventListener("focus", load);
    };
  }, [enabled, revision]);

  const live = `${LIVE_AGENTS.length} specialists live`;
  const railStat = totalRuns === null ? live : `${n(totalRuns)} runs · ${live}`;

  return { counts, railStat, spend, hasNews };
}
