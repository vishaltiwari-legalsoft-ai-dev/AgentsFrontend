/* Parse an agent narrative into renderable blocks. (Named proseBlocks, not
   prose, so it cannot collide with the Prose.tsx component on case-insensitive
   filesystems — tsc rejects two modules differing only in casing.)
   The reports and the Ask card both receive plain text whose only structure is
   line-based — a lead line, "- " bullet findings, an optional pipe table and a
   trailing Recommend line. Rendering that as one <p> is what made the Ask answer
   an unreadable wall, so the shape is parsed here and kept under test. */

export type ProseBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; rows: string[][] };

const BULLET = /^[-•*]\s+/;
const TABLE_ROW = /^\|.*\|$/;
const SEPARATOR_CELL = /^:?-{2,}:?$/;

export function proseBlocks(text: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  let items: string[] = [];
  let rows: string[][] = [];

  const flush = () => {
    if (items.length) {
      blocks.push({ kind: "ul", items });
      items = [];
    }
    if (rows.length) {
      blocks.push({ kind: "table", rows });
      rows = [];
    }
  };

  for (const raw of (text || "").split(/\n/)) {
    const line = raw.replace(/^#+\s*/, "").replace(/^-{3,}$/, "").trim();
    if (!line) {
      flush();
      continue;
    }
    if (BULLET.test(line)) {
      if (rows.length) flush();
      items.push(line.replace(BULLET, ""));
      continue;
    }
    if (TABLE_ROW.test(line)) {
      if (items.length) flush();
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (!cells.every((c) => SEPARATOR_CELL.test(c))) rows.push(cells);
      continue;
    }
    flush();
    blocks.push({ kind: "p", text: line.replace(/^>\s*/, "") });
  }
  flush();
  return blocks;
}
