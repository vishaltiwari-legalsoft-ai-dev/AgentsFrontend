"use client";

/** The pieces every GEO panel is built from.
 *
 *  GEO's artifact is not a file the shop made — it is prose five answer engines
 *  wrote about the shop. So the interface is a highlighter over that prose, and
 *  the two objects below carry the whole idea: a cell that says only "did this
 *  engine say your name", and an answer rendered as the engine wrote it with
 *  the names marked.
 *
 *  One rule runs through all of it: **an engine on a stand-in is never drawn
 *  like an engine on its own API.** Two of the five come through OpenRouter, so
 *  their wording is representative rather than verbatim, and every figure they
 *  contribute to says so.
 */

import { Fragment, type ReactNode } from "react";
import type { GeoAnswer, GeoEngineStatus } from "@/lib/api";
import { blocks, inlineTokens, type InlineToken } from "@/components/console/geo/answerMd";
import { isLive } from "@/components/console/geo/provenance";
import { Ic } from "../../Sprite";
import { highlight, type NameSet } from "./highlight";

export const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  aio: "Google AI Overview",
  ai_mode: "Google AI Mode",
};

/** Short and shorter, because the ledger gives each engine a narrow column on a
 *  desktop and less on a phone. Two words in that space do not shorten, they
 *  collide. */
export const ENGINE_SHORT: Record<string, string> = {
  perplexity: "Perplexity", gemini: "Gemini", chatgpt: "ChatGPT", aio: "AIO", ai_mode: "AI Mode",
};
export const ENGINE_TINY: Record<string, string> = {
  perplexity: "Ppx", gemini: "Gem", chatgpt: "GPT", aio: "AIO", ai_mode: "AIM",
};

export const ENGINE_IDS = Object.keys(ENGINE_LABELS);

export const engineName = (id: string) => ENGINE_LABELS[id] ?? id;

/** What the surface actually is, in words, for the line under an engine's name. */
export function modeWords(st: GeoEngineStatus | undefined): string {
  if (!st) return "surface unknown";
  if (!st.connected) return "no key configured";
  if (st.mode === "native") return "live API";
  if (st.mode === "dataforseo") return "live, via DataForSEO";
  if (st.mode === "proxy") return "similar model";
  return "surface unknown";
}

/** Re-exported so a panel gets "is this engine live" from the same module it
 *  gets its engine labels from. The rule itself lives in `provenance`, with the
 *  list of surfaces it is built on — one copy, because five copies is what let
 *  the SerpAPI-to-DataForSEO switch leave four panels behind. */
export { isLive };

/* --------------------------------------------------------------- the pills -- */

export function EnginePills({ status }: { status: Record<string, GeoEngineStatus> }) {
  return (
    <div className="engines">
      {ENGINE_IDS.map((id) => {
        const st = status[id];
        const live = isLive(st);
        return (
          <span
            key={id}
            className={`eng-pill${live ? "" : " is-proxy"}`}
            title={st?.means || "This backend did not report how this engine is measured."}
          >
            <i aria-hidden="true" />
            {ENGINE_LABELS[id] ?? id}
            <span>{st?.connected ? (live ? "live" : st.mode === "proxy" ? "similar model" : st.mode) : "off"}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- the answers -- */

function renderInline(tokens: InlineToken[], names: NameSet, keyBase: string): ReactNode[] {
  return tokens.map((tok, i) => {
    const key = `${keyBase}-${i}`;
    if (tok.t === "bold") return <strong key={key}>{renderInline(tok.children, names, key)}</strong>;
    if (tok.t === "link") return <a key={key} href={tok.url} target="_blank" rel="noreferrer">{tok.text}</a>;
    if (tok.t === "cite") return <sup key={key} className="geo-md__cite">{tok.text}</sup>;
    return (
      <Fragment key={key}>
        {highlight(tok.text, names).map((seg, j) =>
          seg.kind === "mark"
            ? <mark key={j} className={seg.who === "self" ? "you" : "them"}>{seg.text}</mark>
            : <Fragment key={j}>{seg.text}</Fragment>)}
      </Fragment>
    );
  });
}

/** The engine's own words, with the names marked. No raw HTML passes through —
 *  the parsing is `answerMd`, which is pure and separately tested. */
export function AnswerProse({ text, names }: { text: string; names: NameSet }) {
  return (
    <div className="ans__text">
      {blocks(text).map((b, i) => (
        <Fragment key={i}>
          {b.kind === "p" && <p>{renderInline(inlineTokens(b.text), names, `p${i}`)}</p>}
          {b.kind === "h" && <h4>{renderInline(inlineTokens(b.text), names, `h${i}`)}</h4>}
          {b.kind === "ul" && <ul>{b.items.map((it, j) => <li key={j}>{renderInline(inlineTokens(it), names, `u${i}${j}`)}</li>)}</ul>}
          {b.kind === "ol" && <ol>{b.items.map((it, j) => <li key={j}>{renderInline(inlineTokens(it), names, `o${i}${j}`)}</li>)}</ol>}
          {b.kind === "table" && (
            <div className="ans__tw">
              <table className="ans__table">
                <thead>
                  <tr>{b.head.map((c, j) => <th key={j}>{renderInline(inlineTokens(c), names, `th${i}${j}`)}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((c, k) => <td key={k}>{renderInline(inlineTokens(c), names, `td${i}${j}${k}`)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** One engine's answer: who said it, on what surface, what it did with your
 *  name, and then the words. */
export function AnswerCard({
  answer, status, names,
}: {
  answer: GeoAnswer;
  status: Record<string, GeoEngineStatus>;
  names: NameSet;
}) {
  const st = status[answer.engine];
  const live = isLive(st);
  const named = answer.brand_mentioned === true;

  if (answer.error) {
    return (
      <div className="ans">
        <div className="ans__by">
          <b>{engineName(answer.engine)}</b>
          <span className={live ? "live" : "proxy"}>{modeWords(st)}</span>
        </div>
        <p className="ans__err">
          This engine did not answer: {answer.error}. Nothing is counted from it, rather than a zero
          being counted as a miss.
        </p>
      </div>
    );
  }

  if (answer.no_aio) {
    return (
      <div className="ans">
        <div className="ans__by">
          <b>{engineName(answer.engine)}</b>
          <span className={live ? "live" : "proxy"}>{modeWords(st)}</span>
        </div>
        <p className="ans__err">
          Google published no AI Overview for this question, so there was nothing for you to appear
          in. Left out of every rate rather than counted as a miss.
        </p>
      </div>
    );
  }

  return (
    <div className="ans">
      <div className="ans__by">
        <b>{engineName(answer.engine)}</b>
        <span className={live ? "live" : "proxy"}>{modeWords(st)}</span>
        {named ? (
          <em>
            {answer.brand_position ? `position ${answer.brand_position} · ` : ""}
            {answer.brand_cited ? "linked your site" : "no link"}
          </em>
        ) : (
          <em className="absent">not named</em>
        )}
      </div>
      <div>
        <AnswerProse text={answer.text} names={names} />
        {answer.citations.length > 0 && (
          <p className="ans__cites">
            Cited {answer.citations.slice(0, 6).map((c, i) => (
              <Fragment key={c.url || i}>
                {i > 0 ? ", " : ""}
                <a href={c.url} target="_blank" rel="noreferrer">{c.domain || c.url}</a>
              </Fragment>
            ))}
            {answer.citations.length > 6 ? ` and ${answer.citations.length - 6} more` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- the ledger -- */

export interface LedgerRow {
  id: string;
  text: string;
  /** Engines that said your name on this question. */
  enginesHit: string[];
  /** Engines that answered it at all. */
  enginesAsked: string[];
  n: number;
  selfRate: number;
}

/** A cell says one thing: did this engine say your name. Position and link
 *  status are words in the expanded row, where there is space to label them.
 *
 *  A cell for an engine that was never asked is not a miss — it is a blank, and
 *  drawing it as a miss would count an absence of measurement as an absence of
 *  the brand. That distinction is the whole reason this panel exists.
 */
export function QuestionLedger({
  rows, openId, onToggle, children, engines,
}: {
  rows: LedgerRow[];
  openId: string | null;
  onToggle: (id: string) => void;
  /** What to draw inside the opened row. */
  children: (row: LedgerRow) => ReactNode;
  engines?: string[];
}) {
  const ids = engines && engines.length ? engines : ENGINE_IDS;
  return (
    <>
      <div className="lhead" aria-hidden="true">
        <span>Buyer question</span>
        {ids.map((id) => (
          <span key={id}><b>{ENGINE_SHORT[id] ?? id}</b><i>{ENGINE_TINY[id] ?? id}</i></span>
        ))}
        <span />
      </div>
      <div className="ledger">
        {rows.map((r) => {
          const hit = r.enginesHit.length;
          const open = r.id === openId;
          return (
            <div className={`lrow${hit === 0 ? " is-gap" : ""}${open ? " is-open" : ""}`} key={r.id}>
              <button type="button" className="lrow__btn" aria-expanded={open} onClick={() => onToggle(r.id)}>
                <span className="lrow__q">
                  {r.text}
                  <em>
                    {hit === 0
                      ? "No engine said your name"
                      : `Named by ${hit} of ${r.enginesAsked.length || ids.length} · read what they said`}
                  </em>
                </span>
                {ids.map((id) => {
                  const asked = r.enginesAsked.length === 0 || r.enginesAsked.includes(id);
                  const named = r.enginesHit.includes(id);
                  return (
                    <span key={id} className={`cell${named ? " is-named" : ""}${asked ? "" : " is-blank"}`}>
                      <span className="sr">
                        {engineName(id)}: {!asked ? "not asked" : named ? "named" : "not named"}
                      </span>
                      {!named && <span aria-hidden="true">{asked ? "—" : ""}</span>}
                    </span>
                  );
                })}
                <span className="lrow__chev" aria-hidden="true"><Ic name="chevron" /></span>
              </button>
              <div className="lbody"><div><div className="inner">{open && children(r)}</div></div></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- figures -- */

export function Figures({ children, keyed }: { children: ReactNode; keyed?: boolean }) {
  return <div className={`figures${keyed ? " figures--key" : ""}`}>{children}</div>;
}

export function Figure({ value, title, children, tone }: {
  value: ReactNode;
  title?: string;
  children?: ReactNode;
  tone?: "linked" | "bare" | "absent";
}) {
  return (
    <div className="figure">
      {tone && <i className={`key${tone === "bare" ? " key--bare" : tone === "absent" ? " key--absent" : ""}`} aria-hidden="true" />}
      <b>{value}</b>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
    </div>
  );
}

export function Gauge({ fill }: { fill: number }) {
  return <div className="gaugebar"><i style={{ ["--fill" as string]: String(Math.max(0, Math.min(1, fill))) }} /></div>;
}

/** A rate the backend could not measure. Never a zero: a zero says "never
 *  named", which is a measurement nobody made. */
export const rate = (x: number | null | undefined): string =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;
