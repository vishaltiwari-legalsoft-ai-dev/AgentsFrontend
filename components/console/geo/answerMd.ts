/** Pure parsing for AI-engine answer text (markdown-ish subset). Kept free of
 *  JSX so vitest covers it — the freeze bug lived exactly here. */

export type InlineToken =
  | { t: "text"; text: string }
  | { t: "bold"; children: InlineToken[] }
  | { t: "link"; text: string; url: string }
  | { t: "cite"; text: string };

export type Block =
  | { kind: "p" | "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

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

/* ------------------------------------------------------------------ tables --
 *
 * Engines answer comparison questions with a markdown table more often than
 * with anything else, and until this existed those lines fell through to the
 * paragraph branch — so the reader got `| Need | Best option |` and then
 * `|---|---|` as two sentences. That is the answer's most structured content
 * rendered as its least readable.
 *
 * Only the pipe form is handled, and only when a separator row follows the
 * header, because that is the shape engines actually emit. Anything else stays
 * a paragraph rather than being guessed at.
 */

const isTableLine = (line: string) => line.includes("|") && /^\|?.*\|.*$/.test(line);

/** `|---|:--:|` and friends — the row that makes the line above it a header. */
const isSeparator = (line: string) =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

export function blocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // A table is the only construct here that needs to look ahead, so it is
    // checked first: its header line is otherwise a perfectly good paragraph.
    if (isTableLine(line) && i + 1 < lines.length && isSeparator(lines[i + 1].trim())) {
      const head = cells(line);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const row = lines[j].trim();
        if (!row || !isTableLine(row) || isSeparator(row)) break;
        const got = cells(row);
        // Pad or trim to the header's width so the rendered table can never
        // have a ragged row that shifts the columns under it.
        while (got.length < head.length) got.push("");
        rows.push(got.slice(0, head.length));
      }
      out.push({ kind: "table", head, rows });
      i = j - 1;
      continue;
    }

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
