/** Marking the names inside an engine's answer.
 *
 *  The whole point of the GEO workspace is reading what four engines wrote
 *  about you, so the interface is a highlighter: your name in marigold, a
 *  tracked rival in blue, everything else left alone. That means finding the
 *  names inside prose the engines wrote, which has three traps in it:
 *
 *  1. **Spelling is the measurement.** Engines write `Smith.ai`, never
 *     `smith ai`. The backend already matches on a derived alias list
 *     (`match_names` on a comparison row), and this must mark exactly what that
 *     list contains — a highlighter that is looser than the matcher would paint
 *     mentions the figures above it did not count.
 *  2. **A name inside a word is not a name.** `Ruby` must not light up inside
 *     `Rubyist`, and a dot in `Smith.ai` is a literal, not "any character".
 *  3. **Longest first.** With both `Legal Soft` and `Legal Soft Academy`
 *     tracked, matching the shorter one first would leave `Academy` bare and
 *     split one mention into two.
 *
 *  Pure and separately tested, because getting it wrong is a visual claim about
 *  data that is otherwise correct.
 */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "mark"; text: string; who: "self" | "rival" };

export interface NameSet {
  /** Every spelling that counts as us. */
  self: readonly string[];
  /** Every spelling that counts as a tracked rival. */
  rivals: readonly string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A name is a whole word, not a substring. `\b` alone is wrong at the edges of
 *  names that end in punctuation — `Smith.ai` ends on a letter but `Acme Corp.`
 *  does not — so the boundary is asserted against the characters either side. */
const WORDISH = /[A-Za-z0-9]/;

function isBoundary(text: string, at: number): boolean {
  if (at < 0 || at >= text.length) return true;
  return !WORDISH.test(text[at]);
}

interface Candidate {
  name: string;
  who: "self" | "rival";
}

/** Split `text` into runs, marking every occurrence of a tracked name.
 *
 *  Names are tried longest-first so a longer tracked name always wins over a
 *  shorter one it contains, and `self` wins a tie with a rival: being told the
 *  engine named *you* is the more important of the two readings.
 */
export function highlight(text: string, names: NameSet): Segment[] {
  const candidates: Candidate[] = [
    ...names.self.map((name) => ({ name, who: "self" as const })),
    ...names.rivals.map((name) => ({ name, who: "rival" as const })),
  ]
    .filter((c) => c.name.trim().length >= 2)
    .sort((a, b) => b.name.length - a.name.length || (a.who === "self" ? -1 : 1));

  if (!candidates.length || !text) return text ? [{ kind: "text", text }] : [];

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const pattern = new RegExp(unique.map((c) => escapeRe(c.name)).join("|"), "gi");
  const whoOf = new Map(unique.map((c) => [c.name.toLowerCase(), c.who]));

  const out: Segment[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    // A name that is part of a longer word is not a mention of it.
    if (!isBoundary(text, start - 1) || !isBoundary(text, end)) {
      pattern.lastIndex = start + 1;
      continue;
    }
    if (start > cursor) out.push({ kind: "text", text: text.slice(cursor, start) });
    out.push({ kind: "mark", text: m[0], who: whoOf.get(m[0].toLowerCase()) ?? "rival" });
    cursor = end;
  }

  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor) });
  return out;
}

/** The spellings to search for, from what the backend actually matched on.
 *
 *  `match_names` is what the comparison row was scored with, so it is the only
 *  honest source. It is optional on the wire — a browser can be running this
 *  build against the previous API for minutes after a deploy — so the name
 *  falls back to itself rather than the highlighter going blank.
 */
export function namesFrom(
  self: { name: string; match_names?: string[] } | null,
  rivals: readonly { name: string; match_names?: string[] }[],
): NameSet {
  const spellings = (r: { name: string; match_names?: string[] }) =>
    (r.match_names && r.match_names.length ? r.match_names : [r.name]).filter(Boolean);
  return {
    self: self ? spellings(self) : [],
    rivals: rivals.flatMap(spellings),
  };
}
