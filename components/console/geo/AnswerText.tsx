"use client";

import { Fragment, type ReactNode } from "react";
import { blocks, inlineTokens, type InlineToken } from "./answerMd";

/** Renders AI-engine answer text (markdown-ish) as readable content:
 *  bold, bullet/numbered lists, small headings, links, and [1][2] citation
 *  markers as quiet superscripts. Parsing lives in answerMd.ts (pure, tested);
 *  no raw HTML ever passes through. */

function renderInline(tokens: InlineToken[]): ReactNode[] {
  return tokens.map((tok, i) => {
    if (tok.t === "bold") return <strong key={i}>{renderInline(tok.children)}</strong>;
    if (tok.t === "link") {
      return (
        <a key={i} href={tok.url} target="_blank" rel="noreferrer">{tok.text}</a>
      );
    }
    if (tok.t === "cite") return <sup key={i} className="geo-md__cite">{tok.text}</sup>;
    return <Fragment key={i}>{tok.text}</Fragment>;
  });
}

const inline = (text: string) => renderInline(inlineTokens(text));

export function AnswerText({ text }: { text: string }) {
  return (
    <div className="geo-md">
      {blocks(text).map((b, i) => (
        <Fragment key={i}>
          {b.kind === "p" && <p>{inline(b.text)}</p>}
          {b.kind === "h" && <h4>{inline(b.text)}</h4>}
          {b.kind === "ul" && <ul>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>}
          {b.kind === "ol" && <ol>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>}
          {b.kind === "table" && (
            <div className="geo-md__tw">
              <table className="geo-md__table">
                <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
                <tbody>
                  {b.rows.map((row, j) => (
                    <tr key={j}>{row.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>
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
