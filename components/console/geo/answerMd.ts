/** Pure parsing for AI-engine answer text (markdown-ish subset). Kept free of
 *  JSX so vitest covers it — the freeze bug lived exactly here. */

export type InlineToken =
  | { t: "text"; text: string }
  | { t: "bold"; children: InlineToken[] }
  | { t: "link"; text: string; url: string }
  | { t: "cite"; text: string };

export type Block =
  | { kind: "p" | "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

export function inlineTokens(text: string): InlineToken[] {
  // fresh regex per call — a shared global-flag regex has ONE lastIndex, and
  // recursing for bold content reset it, looping the outer scan forever
  // (page-freeze bug, 2026-08-11)
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|((?:\[\d+\])+)/g;
  const out: InlineToken[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push({ t: "text", text: text.slice(last, match.index) });
    const [, bold, linkText, linkUrl, cites] = match;
    if (bold !== undefined) out.push({ t: "bold", children: inlineTokens(bold) });
    else if (linkUrl !== undefined) out.push({ t: "link", text: linkText, url: linkUrl });
    else if (cites !== undefined) out.push({ t: "cite", text: cites });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: "text", text: text.slice(last) });
  return out;
}

export function blocks(text: string): Block[] {
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
