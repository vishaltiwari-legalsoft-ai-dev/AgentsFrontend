"use client";

/** Runs — the record, in the shape you compare work in.
 *
 *  One line a run, every fact in its own column, sorted on any of them, with the
 *  artifact opening as a detail row underneath.
 *
 *  The prototype's table had a **Cost** column and totalled it in the footer.
 *  There is no such column here, and its absence is the point: `runs` rows carry
 *  who, what, which agent and when, and nothing about tokens or dollars, because
 *  the activity trail was never asked to record them. A cost column filled from
 *  an account-level 30-day figure divided by a run count would look exactly like
 *  a measurement and be a guess. The footer totals what the record can stand
 *  behind — how many runs, and how long they took where anybody timed them.
 */

import { useMemo, useState } from "react";
import type { RunRow, RunState } from "@/lib/api";
import { useHeadline, useHub } from "../context";
import { LIVE_AGENTS, WORKSPACE_SLUG, agentById, n } from "../model";
import { Ic } from "../Sprite";
import { Facet, Mono, Oops, PageHead, RuleHead, STATE_LABEL, Wait } from "../ui";
import { RunRowCard } from "../RunLedger";
import { clock, dayLabel, took } from "../format";
import { useRuns } from "../useRuns";

type SortKey = "state" | "title" | "agent" | "brand" | "action" | "when" | "took";

interface Col {
  key: SortKey;
  label: string;
  num?: boolean;
  wide?: boolean;
  value: (r: RunRow) => string | number | null;
}

// Problems first when you sort by state: a failed run is the one you came
// looking for.
const STATE_RANK: Record<RunState, number> = { failed: 0, running: 1, queued: 2, done: 3 };

const COLS: Col[] = [
  { key: "state", label: "State", value: (r) => STATE_RANK[r.state] },
  { key: "title", label: "Run", wide: true, value: (r) => r.title.toLowerCase() },
  { key: "agent", label: "Specialist", value: (r) => r.agent_name.toLowerCase() },
  { key: "brand", label: "Brand", value: (r) => (r.brand || "").toLowerCase() },
  { key: "action", label: "What was filed", value: (r) => r.action.toLowerCase() },
  { key: "when", label: "Started", num: true, value: (r) => r.created_at },
  // A run nobody timed has no place in a duration ranking, so it sinks.
  { key: "took", label: "Took", num: true, value: (r) => r.took_seconds },
];

const STATES: RunState[] = ["done", "running", "failed", "queued"];

export function RunsView() {
  const { revision, openWork, toast } = useHub();
  const [agent, setAgent] = useState("all");
  const [state, setState] = useState<string>("all");
  const [brand, setBrand] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "when", dir: -1 });

  // The facets and the free-text filter are applied by the backend over the
  // caller's whole window, not by this component over one page — otherwise
  // narrowing would only ever search what happened to be loaded.
  const { state: feed, reload } = useRuns({ limit: 200, agent, state, brand, q }, revision);
  const page = feed.data;

  const totalLine = page
    ? page.total === null
      ? `showing the last ${n(page.scanned)}`
      : `${n(page.total)} stored · showing the last ${n(page.scanned)}`
    : "reading the record";
  useHeadline(totalLine);

  const sorted = useMemo(() => {
    if (!page) return [];
    const col = COLS.find((c) => c.key === sort.key) || COLS[5];
    return [...page.runs].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (x === y) return a.created_at < b.created_at ? 1 : -1;
      return (x > y ? 1 : -1) * sort.dir;
    });
  }, [page, sort]);

  const filtered = agent !== "all" || state !== "all" || brand !== "all" || q.trim() !== "";

  const clear = () => {
    setAgent("all"); setState("all"); setBrand("all"); setQ("");
  };

  const openAgent = (agentId: string) => {
    const slug = WORKSPACE_SLUG[agentId];
    if (!slug) {
      toast("That specialist has no workspace yet.", "warn");
      return;
    }
    openWork(slug);
  };

  if (feed.phase === "failed" && !page) {
    return <Oops what="The record could not be read." error={feed.error || ""} onRetry={reload} />;
  }
  if (!page) {
    return (
      <>
        <PageHead
          statement="Every run is kept, including the ones that failed."
          lede="Reading the record."
        />
        <Wait what="Reading the record" rows={6} />
      </>
    );
  }

  const failed = page.facets.states.failed || 0;
  const totalKnown = page.total;

  return (
    <>
      <PageHead
        statement={
          failed === 0
            ? <>Every run is kept, and <b>none of them failed</b>.</>
            : <>Every run is kept, including the <b>{failed === 1 ? "one that failed" : `${n(failed)} that failed`}</b>.</>
        }
        lede={
          <>
            {totalKnown === null
              ? "The total could not be counted just now. "
              : `${n(totalKnown)} runs are stored across your specialists. `}
            This is the most recent {n(page.scanned)}
            {page.window_complete ? "" : ", which is as far back as one page reads"}. Narrow it below.
          </>
        }
      />

      <div className="facets">
        <Facet on={agent === "all"} label="All specialists" onClick={() => setAgent("all")} />
        {LIVE_AGENTS.map((a) => {
          const f = page.facets.agents.find((x) => x.id === a.id);
          return (
            <Facet
              key={a.id}
              on={agent === a.id}
              label={a.name}
              count={f?.count ?? 0}
              onClick={() => setAgent(a.id)}
            />
          );
        })}
      </div>

      {page.facets.brands.length > 0 && (
        <div className="facets">
          <Facet on={brand === "all"} label="Every brand" onClick={() => setBrand("all")} />
          {page.facets.brands.map((b) => (
            <Facet key={b.name} on={brand === b.name} label={b.name} count={b.count} onClick={() => setBrand(b.name)} />
          ))}
        </div>
      )}

      <div className="facets" style={{ marginBottom: 20 }}>
        <Facet on={state === "all"} label="Any outcome" onClick={() => setState("all")} />
        {STATES.map((s) => (
          <Facet
            key={s}
            on={state === s}
            label={STATE_LABEL[s]}
            count={page.facets.states[s] ?? 0}
            onClick={() => setState(s)}
          />
        ))}
      </div>

      <RuleHead
        title={filtered ? "Filtered" : "Everything"}
        note="Sort by any column. Open a run for what it made."
        aside={
          <label className="find">
            <span className="vh">Filter these runs by name, specialist or brand</span>
            <Ic name="search" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              placeholder={`Filter ${n(page.runs.length)} run${page.runs.length === 1 ? "" : "s"}`}
            />
          </label>
        }
      />

      {page.runs.length === 0 ? (
        <div className="empty">
          <h4>{filtered ? "Nothing matches those filters" : "Nothing has run yet"}</h4>
          <p>
            {filtered
              ? "Clear a filter to see the rest of the work."
              : "Hand a specialist a brief and its run lands here — finished, failed or still going."}
          </p>
          {filtered && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={clear}>Clear filters</button>
          )}
        </div>
      ) : (
        <div className="tw">
          <table className="rt">
            <caption className="vh">Runs, sortable by any column</caption>
            <thead>
              <tr>
                {COLS.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={`${c.num ? "num" : ""}${c.wide ? " wide" : ""}`}
                      aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) => (s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.key === "when" ? -1 : 1 }))
                        }
                      >
                        {c.label}
                        <i aria-hidden="true">{on ? (sort.dir === 1 ? "▲" : "▼") : "◆"}</i>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const open = r.id === openId;
                const a = agentById(r.agent_id);
                const d = took(r.took_seconds);
                return (
                  <RunTableRow
                    key={r.id}
                    run={r}
                    open={open}
                    mono={a?.mono || r.agent_name.slice(0, 2).toUpperCase()}
                    duration={d}
                    onToggle={() => setOpenId(open ? null : r.id)}
                    onOpenWorkspace={openAgent}
                    cols={COLS.length}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  {n(page.runs.length)} run{page.runs.length === 1 ? "" : "s"}
                  {totalKnown !== null && page.runs.length < totalKnown ? ` of ${n(totalKnown)} stored` : ""}
                </td>
                <td className="num dim">total</td>
                <td className="num">{totalTook(page.runs)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section className="band">
        <RuleHead
          title="What is standing behind this"
          note="The record carries who ran what, on which agent, against which brand, and when."
        />
        <p className="lede" style={{ maxWidth: "72ch" }}>
          It does not carry a cost or a token count for a single run, because nothing writes one —
          so there is no spend column here, rather than a spend column filled with an estimate. The
          account-level 30-day figures in the header come straight from OpenRouter and are the real
          measure of what this console spends.
        </p>
      </section>
    </>
  );
}

function totalTook(runs: RunRow[]): string {
  const secs = runs.map((r) => r.took_seconds).filter((s): s is number => s !== null && s > 0);
  if (!secs.length) return "—";
  const total = secs.reduce((a, b) => a + b, 0);
  return took(total) || "—";
}

function RunTableRow({
  run, open, mono, duration, onToggle, onOpenWorkspace, cols,
}: {
  run: RunRow;
  open: boolean;
  mono: string;
  duration: string | null;
  onToggle: () => void;
  onOpenWorkspace: (agentId: string) => void;
  cols: number;
}) {
  return (
    <>
      <tr className={`rt__r ${run.state}${open ? " is-open" : ""}`}>
        <td><span className={`st ${run.state}`}><i />{STATE_LABEL[run.state]}</span></td>
        <td className="wide">
          <button type="button" className="rt__open" aria-expanded={open} title={run.title} onClick={onToggle}>
            <span>{run.title}</span>
            <Ic name="chevron" />
          </button>
        </td>
        <td>
          <span className="rt__who">
            <Mono agent={{ mono }} size="sm" />
            <em>{run.agent_name}</em>
          </span>
        </td>
        <td className="dim">{run.brand || "—"}</td>
        <td><span className="dim">{run.action || "—"}</span></td>
        <td className="num dim">
          {dayLabel(run.created_at)[0]} <span className="rt__hm">{clock(run.created_at)}</span>
        </td>
        <td className={`num${duration ? "" : " dim"}`}>{duration || "—"}</td>
      </tr>
      {open && (
        <tr className="rt__d">
          <td colSpan={cols}>
            <RunRowCard run={run} open onToggle={onToggle} onOpenWorkspace={onOpenWorkspace} />
          </td>
        </tr>
      )}
    </>
  );
}
