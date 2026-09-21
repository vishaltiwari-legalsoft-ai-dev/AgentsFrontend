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
 *
 *  An answer is shown with how it was made, not just what it says: whether a
 *  model wrote it at all, which period it resolved to, which figures its
 *  `[f12]` markers stand on, and anything the backend could not check. Every
 *  one of those fields is optional on the wire, and an absent one draws nothing
 *  — never a default that looks like a finding.
 */

import { Fragment, useCallback, useRef, useState, type CSSProperties } from "react";
import { mrAsk, type MrAskAnswer, type MrAskFact } from "@/lib/api";
import {
  askCaveat, askPeriodLabel, askProvenance, citedFacts, citeTitle, citeTokens, notModelWritten,
  readNarrative, type CiteToken,
} from "@/components/console/mr/format";
import { PageHead, RuleHead } from "../../ui";
import type { ToastFn } from "../../context";

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

export function MrAsk({ onToast }: { onToast: ToastFn }) {
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
            note="Every sheet connected on the Data panel is read to answer. The desk counts the primary tracker, and another sheet only if it was included in the dashboard — so an answer can use a sheet the desk does not."
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
          Answered from the connected sheets as they stand when you ask, not from the last pull — so
          an answer can be newer than the desk. There is no advertising API behind it, so an answer
          cannot be more current than the sheet.
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
  const made = askProvenance(a);
  const period = askPeriodLabel(a);
  const caveat = askCaveat(a);
  const paragraphs = (summary || a.answer).split("\n\n").map((p) => citeTokens(p, a.facts));
  const recTokens = citeTokens(recommend, a.facts);
  const cited = citedFacts([...paragraphs.flat(), ...recTokens]);

  return (
    <article className="qa">
      <p className="qa__q">{turn.q}</p>
      <div className="qa__a">
        {/* First, before a word of the text: a listing read straight off the tabs
            must not be taken for an analysis by anyone who stops reading early. */}
        {!made.ai && (
          <p className="qa__warn" role="note">
            <b>Not written by the model.</b> {notModelWritten(made.reason)}
          </p>
        )}
        {paragraphs.map((tokens, i) => <p key={i}><Cited tokens={tokens} /></p>)}
        {recommend && (
          <div className="qa__rec"><b>Recommend</b><span><Cited tokens={recTokens} /></span></div>
        )}
        {caveat && (
          <p className="qa__warn" role="note"><b>Check before you rely on it.</b> {caveat}</p>
        )}
        <div className="qa__src">
          <span className="qa__srcl">Read</span>
          {a.used_tabs.length > 0
            ? a.used_tabs.map((tab) => <span className="tabchip" key={tab}>{tab}</span>)
            : <span className="tabchip">no tab it could stand behind</span>}
          {/* Only the period the backend resolved. Never `timeframe`: on an
              older backend that is the granularity ("monthly"), which is not a
              period, and no chip is truer than a wrong one. */}
          {period && <span className="tabchip tabchip--t">{period}</span>}
        </div>
        {/* The chips carry their source in a hover, and a hover does not exist
            on a touch screen or from a keyboard — so the same words are listed. */}
        {cited.length > 0 && (
          <details className="shut">
            <summary>Where {cited.length === 1 ? "the cited figure" : `the ${cited.length} cited figures`} came from</summary>
            <ul className="cov__miss">
              {cited.map((f) => (
                <li key={f.id}>
                  <b>{f.id}</b> · {f.label}
                  {citeTitle(f) && <em> — {citeTitle(f)}</em>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

/** Answer text with its `[f12]` markers drawn as source chips. With no facts —
 *  an older backend — this is the text and nothing else. */
function Cited({ tokens }: { tokens: CiteToken[] }) {
  return (
    <>
      {tokens.map((t, i) => (
        "cite" in t ? <Cite fact={t.cite} key={i} /> : <Fragment key={i}>{t.text}</Fragment>
      ))}
    </>
  );
}

/** Inline with the sentence, so it borrows the tab chip rather than adding a
 *  new one; only the lift and the cursor are its own. The size is stated here
 *  because `.qa__rec span` sets 14px on every span under the Recommend line,
 *  chips included, and would otherwise make them larger there than in the body
 *  (11px is `.tabchip`'s own size). Focusable so a keyboard reader reaches it,
 *  and labelled in words for a screen reader. */
const CITE: CSSProperties = { margin: "0 2px", verticalAlign: "1px", cursor: "help", fontSize: 11 };

function Cite({ fact }: { fact: MrAskFact }) {
  const where = citeTitle(fact);
  return (
    <span
      className="tabchip"
      style={CITE}
      tabIndex={0}
      role="note"
      title={where || fact.label}
      aria-label={`Source ${fact.id}: ${fact.label}${where ? ` — ${where}` : ""}`}
    >
      {fact.id}
    </span>
  );
}
