"use client";

/** Ask the workbook a question, and see which tabs it had to open.
 *
 *  The desk this replaces answers in a chat bubble with no sources, so an answer
 *  and a guess look the same. Every answer here names the tabs behind it, and
 *  the wait is shown rather than hidden — reading nine tabs is the part that
 *  takes time, and hiding it would make the answer look looked-up instead of
 *  read.
 *
 *  The suggestions are starting points, not canned answers: each one goes to the
 *  same endpoint as anything typed, and what comes back is what the model made
 *  of the real tabs.
 */

import { useCallback, useRef, useState } from "react";
import { mrAsk, type MrAskAnswer } from "@/lib/api";
import { readNarrative } from "@/components/console/mr/format";
import { PageHead, RuleHead } from "../../ui";
import { n, word } from "../../model";
import type { ToastFn } from "../../context";
import type { MrData_ } from "../MrWorkspace";

/** Questions this workbook can genuinely answer, phrased the way somebody at
 *  the desk would ask them. They are prompts, not stored answers. */
const SUGGESTIONS = [
  "Which vendor had the best cost per qualified demo this month?",
  "Where is the money going that is not producing demos?",
  "Which campaign's no-show rate got worse since last month?",
  "Are we on pace against budget, and which vendor is driving that?",
  "What changed most since the last snapshot?",
  "Which brand is bringing the most booked demos, and at what cost?",
];

interface Turn {
  q: string;
  pending: boolean;
  answer?: MrAskAnswer;
  error?: string;
}

export function MrAsk({ data, onToast }: { data: MrData_; onToast: ToastFn }) {
  const [thread, setThread] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const busy = thread.some((t) => t.pending);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setThread((t) => [...t, { q, pending: true }]);
    setText("");
    try {
      const answer = await mrAsk(q);
      setThread((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, pending: false, answer } : x)));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "That question could not be answered.";
      // A question that failed must not sit there looking like a thin answer.
      setThread((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, pending: false, error: message } : x)));
      onToast(message, "error");
    }
  }, [busy, onToast]);

  const asked = thread.length > 0;
  const left = SUGGESTIONS.filter((s) => !thread.some((t) => t.q === s));

  return (
    <>
      <PageHead
        statement={<>Ask the workbook <b>a question</b> and see which tabs it had to open.</>}
        lede="The desk this replaces answers in a chat bubble with no sources, so an answer and a guess look the same. Every answer here names the tabs behind it."
      />

      {asked ? (
        <>
          <div className="thr">
            {thread.map((t, i) => <AskCard turn={t} key={i} />)}
          </div>
          {left.length > 0 && (
            <section className="band askmore">
              <p className="askmore__l">Still unasked</p>
              <div className="askmore__r">
                {left.map((q) => (
                  <button type="button" className="chip" key={q} onClick={() => void ask(q)} disabled={busy}>
                    {q}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="band band--first">
          <RuleHead
            title="What it can answer"
            note={`These read the same ${n(data.overview.sources.length)} sources the rest of the agent reads, so an answer cannot disagree with the desk.`}
          />
          <div className="sugg">
            {SUGGESTIONS.map((q) => (
              <button type="button" className="sug" key={q} onClick={() => void ask(q)} disabled={busy}>
                <span className="sug__q">{q}</span>
                <span className="sug__m">Reads the tracker tabs</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="band askbox">
        <label className="askbox__l" htmlFor="ask-in">Ask something else</label>
        <div className="askbox__r">
          <input
            id="ask-in"
            ref={box}
            type="text"
            value={text}
            placeholder="e.g. which vendor had the best cost per demo in July?"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void ask(text); }}
            disabled={busy}
          />
          <button type="button" className="btn btn--solid" onClick={() => void ask(text)} disabled={busy || !text.trim()}>
            {busy ? "Reading…" : "Ask"}
          </button>
        </div>
        <p className="dim">
          Answered from the workbook this agent already pulled — {word(data.overview.sources.length)}{" "}
          source{data.overview.sources.length === 1 ? "" : "s"}, nothing newer than the last pull.
          There is no advertising API behind it, so an answer cannot be more current than the sheet.
        </p>
      </section>
    </>
  );
}

function AskCard({ turn }: { turn: Turn }) {
  if (turn.pending) {
    return (
      <article className="qa">
        <p className="qa__q">{turn.q}</p>
        <p className="qa__wait">
          <span className="qa__dots"><i /><i /><i /></span>
          Finding the tabs that can answer this, and reading them.
        </p>
      </article>
    );
  }

  if (turn.error) {
    return (
      <article className="qa">
        <p className="qa__q">{turn.q}</p>
        <div className="qa__a">
          <p className="qa__warn">
            This question was not answered: {turn.error} Nothing above is a partial answer — the read
            did not complete.
          </p>
        </div>
      </article>
    );
  }

  const a = turn.answer!;
  const { summary, recommend } = readNarrative(a.answer);

  return (
    <article className="qa">
      <p className="qa__q">{turn.q}</p>
      <div className="qa__a">
        {(summary || a.answer).split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
        {recommend && (
          <div className="qa__rec"><b>Recommend</b><span>{recommend}</span></div>
        )}
        <div className="qa__src">
          <span className="qa__srcl">Read</span>
          {a.used_tabs.length > 0
            ? a.used_tabs.map((tab) => <span className="tabchip" key={tab}>{tab}</span>)
            : <span className="tabchip">no tab it could stand behind</span>}
          <span className="tabchip tabchip--t">
            {a.timeframe || "no period it could stand behind"}
          </span>
        </div>
      </div>
    </article>
  );
}
