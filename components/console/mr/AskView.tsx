"use client";

import { useEffect, useRef, useState } from "react";
import { mrAsk, type MrAskAnswer } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { Prose } from "./Prose";
import { splitAnswer } from "./shared";

const SUGGESTED = [
  "How did we perform this month?",
  "Which platform gave the most qualified leads?",
  "Where are we wasting spend?",
  "How do leads compare month over month?",
];

interface Entry { question: string; answer: MrAskAnswer | null }

export function AskView({ seed, onSeedConsumed, onToast }: {
  seed: string | null;
  onSeedConsumed: () => void;
  onToast: (m: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Entry[]>([]);
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || asking) return;
    setQuestion("");
    setAsking(true);
    setThread((t) => [...t, { question: query, answer: null }]);
    try {
      const a = await mrAsk(query);
      setThread((t) => t.map((e, i) => (i === t.length - 1 ? { ...e, answer: a } : e)));
    } catch (e) {
      setThread((t) => t.slice(0, -1));
      onToast(e instanceof Error ? e.message : "Ask failed");
    } finally {
      setAsking(false);
    }
  }

  useEffect(() => {
    if (seed) {
      onSeedConsumed();
      void ask(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread]);

  return (
    <div className="mr-panel mr-askv">
      {thread.length === 0 && (
        <div className="mr-askv__hero">
          <h2 className="mr-panel__title">Ask the agent</h2>
          <span className="mr-panel__sub">
            Ask anything about the marketing data. The agent finds the right tab(s) and answers with the real numbers.
          </span>
          <div className="mr-sugg">
            {SUGGESTED.map((q) => (
              <button key={q} className="mr-chip" onClick={() => void ask(q)} disabled={asking}>{q}</button>
            ))}
          </div>
        </div>
      )}

      <div className="mr-thread">
        {thread.map((e, i) => {
          const ans = e.answer ? splitAnswer(e.answer.answer) : null;
          return (
            <div className="mr-qa" key={i}>
              <div className="mr-qa__q">{e.question}</div>
              {!e.answer || !ans ? (
                <div className="mr-empty">Finding the right data and reading it…</div>
              ) : (
                <div className="mr-ans">
                  <div className="mr-ans__text"><Prose text={ans.summary} /></div>
                  {ans.recommend && <div className="mr-rec"><b>Recommend</b><span>{ans.recommend}</span></div>}
                  {e.answer.used_tabs.length > 0 && (
                    <div className="mr-ans__src">
                      <span className="mr-ans__src-label">Sources</span>
                      {e.answer.used_tabs.map((t) => (
                        <span className="mr-srcchip" key={t}><Icon name="layout-grid" size={12} /> {t}</span>
                      ))}
                      {e.answer.timeframe && <span className="mr-srcchip">⏱ {e.answer.timeframe}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="mr-ask__box mr-askv__box">
        <textarea
          className="mr-ask__input"
          rows={2}
          placeholder="e.g. Which channel had the best cost per demo in June?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(question);
            }
          }}
        />
        <Button variant="brand" disabled={asking || !question.trim()} onClick={() => void ask(question)}
          iconLeft={<Icon name={asking ? "loader-circle" : "sparkles"} size={15} className={asking ? "cworkbar__spin" : undefined} />}>
          {asking ? "Thinking…" : "Ask"}
        </Button>
      </div>
    </div>
  );
}
