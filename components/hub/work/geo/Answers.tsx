"use client";

/** Every answer, as the engine wrote it — folded into per-question bands.
 *
 *  Grouped by question rather than listed flat, because an answer only means
 *  something beside the other engines' answers to the same question. And the
 *  bands are closed by default: forty open answers is a wall, one open question
 *  is a page. The header of a closed band still carries the verdict — the same
 *  named/blank squares the Overview ledger uses — so a scroll down the closed
 *  list is already a reading of the whole window.
 */

import { useEffect, useMemo, useState } from "react";
import { geoAnswers, type GeoAnswer } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { Ic } from "../../Sprite";
import { PageHead, Oops, Wait } from "../../ui";
import { n } from "../../model";
import type { GeoData } from "../GeoWorkspace";
import { AnswerCard, ENGINE_IDS, ENGINE_SHORT, ENGINE_TINY, engineName } from "./parts";
import { bandsFrom, cellOf, factsOf, personaWords, type NamedFilter } from "./answerBands";

export function GeoAnswers({ data }: { data: GeoData }) {
  const session = useLoadSession();
  const [all, setAll] = useState<Load<GeoAnswer[]>>(loadPending);
  const [engine, setEngine] = useState<string>("all");
  const [status, setStatus] = useState<NamedFilter>("all");
  const [term, setTerm] = useState("");
  // Bands the reader opened or closed by hand. Everything else follows the
  // default: first band open, the rest closed — unless a filter is narrowing
  // the list, in which case every match opens, because a filter that answers
  // with a row of closed doors has not answered.
  const [chosen, setChosen] = useState<Record<string, boolean>>({});

  // The engine filter goes to the backend — it is a stored field, and asking
  // for one engine's answers is much less to send than all four. Naming and
  // free text are filtered here, over what came back.
  useEffect(() => {
    void session.run(
      "geo-answers-all",
      (s) => geoAnswers(
        data.brandId,
        { days: data.days, ...(engine === "all" ? {} : { engine }) },
        { signal: s },
      ).then((r) => r.answers),
      setAll,
      "The stored answers could not be read.",
      { keepStale: true },
    );
  }, [session, data.brandId, data.days, engine]);

  const filtering = engine !== "all" || status !== "all" || term.trim() !== "";

  // A new filter is a new question to the page; rows opened by hand under the
  // old one do not carry over.
  useEffect(() => { setChosen({}); }, [engine, status, term]);

  const bands = useMemo(
    () => bandsFrom(all.data || [], { status, term }, data.report.prompt_rollup || []),
    [all.data, status, term, data.report.prompt_rollup],
  );

  const isOpen = (id: string, i: number) => chosen[id] ?? (filtering || i === 0);
  const allOpen = bands.length > 0 && bands.every((b, i) => isOpen(b.id, i));
  const setEvery = (open: boolean) =>
    setChosen(Object.fromEntries(bands.map((b) => [b.id, open])));

  const shown = bands.reduce((s, b) => s + b.rows.length, 0);
  const total = all.data?.length ?? 0;

  return (
    <>
      <PageHead
        statement={<>Every answer, <b>as the engine wrote it</b>.</>}
        lede={
          <>
            {n(total)} stored answer{total === 1 ? "" : "s"} from the last {data.days} days, one
            band per question. Open a band to read what each engine wrote — your name is marked in
            marigold, a tracked competitor in blue.
          </>
        }
      />

      <div className="filters">
        <label className="sr" htmlFor="geo-fe">Engine</label>
        <select id="geo-fe" value={engine} onChange={(e) => setEngine(e.target.value)}>
          <option value="all">All engines</option>
          {ENGINE_IDS.map((id) => <option key={id} value={id}>{engineName(id)}</option>)}
        </select>

        <label className="sr" htmlFor="geo-fs">Result</label>
        <select id="geo-fs" value={status} onChange={(e) => setStatus(e.target.value as NamedFilter)}>
          <option value="all">Named and not named</option>
          <option value="named">Named only</option>
          <option value="gap">Not named only</option>
        </select>

        <label className="sr" htmlFor="geo-ft">Search answer text</label>
        <input
          type="search"
          id="geo-ft"
          placeholder="Search the answer text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />

        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => setEvery(!allOpen)}
          disabled={bands.length === 0}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>

        <p className="help" aria-live="polite">
          {all.data ? `${n(shown)} of ${n(total)} answers` : "reading"}
        </p>
      </div>

      {all.phase === "loading" && !all.data ? (
        <Wait what="Reading the stored answers" rows={5} />
      ) : all.phase === "failed" && !all.data ? (
        <Oops what="The stored answers could not be read." error={all.error || ""} onRetry={data.reload} />
      ) : total === 0 ? (
        <div className="empty">
          <h4>Nothing is stored for this window</h4>
          <p>Run a check from the Overview and the answers land here as each engine replies.</p>
        </div>
      ) : bands.length === 0 ? (
        <div className="empty">
          <h4>Nothing stored matches</h4>
          <p>No answer fits that combination. Clear the search box, or switch back to all engines.</p>
        </div>
      ) : (
        <>
          <div className="lhead" aria-hidden="true">
            <span>Buyer question</span>
            {ENGINE_IDS.map((id) => (
              <span key={id}><b>{ENGINE_SHORT[id] ?? id}</b><i>{ENGINE_TINY[id] ?? id}</i></span>
            ))}
            <span />
          </div>
          <div className="ledger">
            {bands.map((b, i) => {
              const open = isOpen(b.id, i);
              const { named, measured } = factsOf(b.rows);
              return (
                <div
                  key={b.id}
                  className={`lrow${measured > 0 && named === 0 ? " is-gap" : ""}${open ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="lrow__btn"
                    aria-expanded={open}
                    onClick={() => setChosen((c) => ({ ...c, [b.id]: !open }))}
                  >
                    <span className="lrow__q">
                      {b.text}
                      {b.persona && <span className="tag">{personaWords(b.persona)}</span>}
                      <em>
                        {measured === 0
                          ? "Nothing usable came back — open to see why"
                          : named === 0
                            ? "No stored answer to this question named you"
                            : `Named in ${n(named)} of ${n(measured)} stored answer${measured === 1 ? "" : "s"} · open to read them`}
                      </em>
                    </span>
                    {ENGINE_IDS.map((id) => {
                      const cell = cellOf(b.rows, id);
                      return (
                        <span
                          key={id}
                          className={`cell${cell === "named" ? " is-named" : ""}${cell === "none" ? " is-blank" : ""}`}
                        >
                          <span className="sr">
                            {engineName(id)}: {cell === "named" ? "named you" : cell === "answered" ? "answered, did not name you" : "no stored answer"}
                          </span>
                          {cell !== "named" && <span aria-hidden="true">{cell === "answered" ? "—" : ""}</span>}
                        </span>
                      );
                    })}
                    <span className="lrow__chev" aria-hidden="true"><Ic name="chevron" /></span>
                  </button>
                  <div className="lbody">
                    <div>
                      <div className="inner">
                        {open && b.rows.map((a, j) => (
                          <AnswerCard
                            key={`${a.engine}-${a.run}-${j}`}
                            answer={a}
                            status={data.status}
                            names={data.names}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
