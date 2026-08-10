"use client";

import { Fragment, type ReactNode } from "react";

/** Renders AI-engine answer text (markdown-ish) as readable content:
 *  bold, bullet/numbered lists, small headings, links, and [1][2] citation
 *  markers as quiet superscripts. Hand-rolled for exactly the subset engines
 *  emit — no raw HTML ever passes through. */

const INLINE_RE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|((?:\[\d+\])+)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [, bold, linkText, linkUrl, cites] = match;
    if (bold !== undefined) {
      out.push(<strong key={out.length}>{inline(bold)}</strong>);
    } else if (linkUrl !== undefined) {
      out.push(
        <a key={out.length} href={linkUrl} target="_blank" rel="noreferrer">{linkText}</a>,
      );
    } else if (cites !== undefined) {
      out.push(<sup key={out.length} className="geo-md__cite">{cites}</sup>);
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p" | "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet) {
      const prev = out[out.length - 1];
      if (prev?.kind === "ul") prev.items.push(bullet[1]);
      else out.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      const prev = out[out.length - 1];
      if (prev?.kind === "ol") prev.items.push(numbered[1]);
      else out.push({ kind: "ol", items: [numbered[1]] });
    } else if (heading) {
      out.push({ kind: "h", text: heading[1] });
    } else {
      out.push({ kind: "p", text: line });
    }
  }
  return out;
}

export function AnswerText({ text }: { text: string }) {
  return (
    <div className="geo-md">
      {blocks(text).map((b, i) => (
        <Fragment key={i}>
          {b.kind === "p" && <p>{inline(b.text)}</p>}
          {b.kind === "h" && <h4>{inline(b.text)}</h4>}
          {b.kind === "ul" && <ul>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>}
          {b.kind === "ol" && <ol>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>}
        </Fragment>
      ))}
    </div>
  );
}
