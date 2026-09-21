/* Pure display helpers for the MR console.
   Kept free of JSX so the logic that uses them stays unit-testable — tsconfig
   runs jsx: "preserve", so vitest cannot import a .tsx module. */

import type { MrAskAnswer, MrAskFact, MrSheetIngestResult } from "@/lib/api";

export const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString()}`;
export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString();
export const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

export const fmtMonth = (ym: string | null) =>
  ym ? new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" }) : "";

export function sourceLabel(platform: string): { src: string; tab: string } {
  if (platform?.startsWith("sheets:")) return { src: "Google Sheets", tab: platform.slice(7) };
  if (platform?.startsWith("pdf:")) return { src: "PDF upload", tab: platform.slice(4) };
  const map: Record<string, string> = { google_ads: "Google Ads", meta: "META Ads", hubspot: "HubSpot" };
  return { src: `${map[platform] ?? platform} · CSV upload`, tab: "" };
}

/** Whether to offer the Disconnect button on one connected sheet.
 *
 *  `GET /mr/sources` now answers `can_remove` per row, and
 *  `DELETE /mr/sources/{id}` answers **403** when it is false — you may
 *  disconnect a sheet you connected, an admin or creator may disconnect any,
 *  and nobody may disconnect the primary tracker. A button offered outside
 *  that is a button that only earns an error.
 *
 *  `whenUnknown` is the deploy-skew answer, and it is the load-bearing part.
 *  Vercel ships in about a minute and Cloud Run in four to six, so this code
 *  runs against the previous backend for a window every time — and a previous
 *  console outage came from exactly that, new frontend code reading a field the
 *  backend had not started sending. Absent must therefore mean "this backend
 *  has no opinion", not "no":
 *
 *  - Reading absence as `false` hides every button on every row for minutes,
 *    including the admin's — a working control silently disappears.
 *  - Reading absence as `true` unconditionally would be the permissive default
 *    that the 403 exists to remove.
 *
 *  So absence falls back to whatever the caller offered the button on before —
 *  the panel's own role check — which is safe because the field and the 403
 *  shipped in the same commit: a reply with no `can_remove` came from a backend
 *  with no gate, where that button worked. Nothing new can 403, nothing that
 *  worked disappears, and the moment the field arrives the server's answer
 *  wins outright. */
export function mayDisconnect(
  source: { primary?: boolean; can_remove?: boolean },
  opts: { whenUnknown: boolean },
): boolean {
  if (source.primary) return false;
  if (typeof source.can_remove === "boolean") return source.can_remove;
  return opts.whenUnknown;
}

/* ------------------------------------------------------------- the pull -- */

/** What the Data panel, the empty workspace and the report pickers may offer
 *  this reader.
 *
 *  `pull` is every signed-in reader. `POST /api/mr/ingest-sheet` asks for a
 *  signed-in user and nothing more, so a role gate on the button protects
 *  nothing — and it removes the one thing a member can do about a workspace
 *  that holds no data (13 of 19 production accounts held none, and the people
 *  looking at those screens are exactly the ones a role gate would exclude).
 *
 *  `edit` is the narrower right, and it stays narrow: connecting another sheet,
 *  re-profiling the workbook (a model call) and pulling again inside the
 *  "already fresh" cooldown shape what the WHOLE workspace reads or spend what
 *  everyone shares, so they are admin-or-creator. It is also the fallback
 *  `mayDisconnect` is handed while a backend has not started answering
 *  `can_remove` per row — the server's own answer wins the moment it arrives.
 *
 *  A GEO-only account is refused every `/api/mr/*` route by the scope wall
 *  (`components/hub/model.ts`), so it is offered neither: a button that can only
 *  earn a 403 is not an action. It cannot open this workspace at all, so this is
 *  belt and braces rather than a case anyone will meet.
 *
 *  Every screen asks this rather than reading a role flag of its own — the
 *  gate is pinned in `lineMap.test.ts`, which also reads the Data panel's
 *  source to prove it does. */
export function mrDataActions(
  user: { is_admin?: boolean; is_creator?: boolean; is_geo_only?: boolean } | null | undefined,
): { pull: boolean; edit: boolean } {
  if (!user || user.is_geo_only === true) return { pull: false, edit: false };
  return { pull: true, edit: user.is_admin === true || user.is_creator === true };
}

/** "1 row" / "312 rows" — fixed to en-US so a message reads the same on every machine. */
const rowsOf = (rows: number) => `${rows.toLocaleString("en-US")} row${rows === 1 ? "" : "s"}`;

/** How one finished pull turned out.
 *
 *  - `fresh`   — nothing was fetched because the team's workbook data was pulled
 *                 moments ago (the cron, or a colleague). A calm success, and
 *                 the only outcome that can offer "Pull again anyway" — to an
 *                 admin or creator, never to anyone else.
 *  - `ok`      — every part landed.
 *  - `partial` — some part kept its PREVIOUS data.
 *  - `empty`   — finished, but the workbook gave back no rows. */
export type PullKind = "fresh" | "ok" | "partial" | "empty";

export interface PullOutcome {
  kind: PullKind;
  tone: "ok" | "warn";
  message: string;
  rows: number;
  tabs: number;
}

/** What one finished pull is worth saying, and in which tone.
 *
 *  A pull that came back "partial" left some component on its PREVIOUS data,
 *  and reporting that as a success is how weeks-old figures stayed on screen
 *  looking current. So the outcomes are kept apart rather than one green line:
 *  clean, partial (and which part did not land), and finished-but-empty — the
 *  last matters most to the reader who pressed the button because their
 *  workspace was blank, and who would otherwise be told "done" and shown the
 *  same blank screen.
 *
 *  `fresh` is checked FIRST. It arrives as `tabs: []` with nothing ingested,
 *  which is exactly the shape of a pull that found no rows — read in the other
 *  order, "already up to date" would be reported as "the workbook is empty".
 *
 *  `since` turns the server's `last_pulled_at` into words ("2 minutes ago");
 *  it is handed in so this module stays free of the hub's formatting, and so a
 *  test never depends on the clock. An unreadable or missing stamp says "a
 *  moment ago" — the cooldown is minutes, so that is what it means.
 *
 *  `mayEdit` decides what a "fresh" answer says next. An admin or creator is
 *  offered "Pull again anyway" beside it; anybody else is told, calmly, that
 *  waiting is the way past it — a sentence, not a dead end.
 *
 *  A pull that FAILED never reaches this function: the server answers 4xx/5xx
 *  and the caller has an error to show instead. */
export function summarisePull(
  r: Pick<MrSheetIngestResult, "tabs" | "status" | "degraded" | "last_pulled_at">,
  since: (iso: string) => string,
  mayEdit: boolean,
): PullOutcome {
  const tabs = r.tabs ?? [];
  const rows = tabs.reduce((sum, t) => sum + (t.metrics ?? 0), 0);
  const failed = tabs.filter((t) => t.error);
  const degraded = (r.degraded ?? []).filter((d) => typeof d === "string" && d.trim());
  const rowsText = rowsOf(rows);
  const tabsText = `${tabs.length.toLocaleString("en-US")} tab${tabs.length === 1 ? "" : "s"}`;

  if (r.status === "fresh") {
    const when = typeof r.last_pulled_at === "string" ? since(r.last_pulled_at).trim() : "";
    return {
      kind: "fresh",
      tone: "ok",
      message: `Already up to date — the team's workbook data was pulled ${when || "a moment ago"}.`
        + (mayEdit ? "" : " You can pull again in a couple of minutes."),
      rows,
      tabs: tabs.length,
    };
  }
  if (r.status === "partial" || failed.length > 0 || degraded.length > 0) {
    const why = degraded.length > 0 ? degraded : failed.map((t) => `${t.tab} — ${t.error}`);
    const detail = why.length > 0 ? `: ${why.join("; ")}` : "";
    return {
      kind: "partial",
      tone: "warn",
      message: `Pulled ${rowsText}, but not everything${detail}. Whatever did not land is still showing its previous data.`,
      rows,
      tabs: tabs.length,
    };
  }
  if (rows === 0) {
    return {
      kind: "empty",
      tone: "warn",
      message: "The pull finished, but the workbook gave back no rows, so there is nothing new to read. "
        + "Check that the tracker sheet still has data in it.",
      rows,
      tabs: tabs.length,
    };
  }
  return {
    kind: "ok",
    tone: "ok",
    message: `Pulled ${rowsText} across ${tabsText}. The team's workbook data is now up to date.`,
    rows,
    tabs: tabs.length,
  };
}

/** Whether "Pull again anyway" is drawn after this outcome: only after "already
 *  up to date", and only for a reader who may edit the workspace. The server is
 *  about to refuse `force` to anybody else, so the button is not offered rather
 *  than offered and refused. */
export const offersForcedPull = (kind: PullKind, mayEdit: boolean): boolean =>
  kind === "fresh" && mayEdit;

/** The body of `POST /api/mr/ingest-sheet`. `force` goes out only when it was
 *  asked for AND this reader may edit — a normal pull sends nothing at all, and
 *  a member can never send it, whatever handler ends up calling this. */
export const pullBody = (force: boolean, mayEdit: boolean): { force?: true } =>
  force && mayEdit ? { force: true } : {};

/* -------------------------------------------------------------- the ask -- */

/** The narrative with markdown noise removed — the heading line and bold — and
 *  nothing else touched. The `(offline summary)` marker is NOT noise: it is the
 *  only in-band tell that a text is a canned listing rather than a model's
 *  answer, so it stays. */
function plainNarrative(markdown: string): string {
  return (markdown || "").replace(/^#\s.*\n+/, "").replace(/\*\*/g, "").trim();
}

/** The marker a deterministic fallback text opens with: `[kind] (offline summary)`. */
const OFFLINE_MARKER = /^\[[a-z_]+\]\s*\(offline summary\)/i;

/** Whether the text says, in its own opening words, that no model wrote it. */
export const isOfflineSummary = (markdown: string): boolean =>
  OFFLINE_MARKER.test(plainNarrative(markdown));

/** Split narrative into summary + trailing "Recommend:" line (strips md noise).
 *
 *  The `(offline summary)` marker used to be stripped here, so the one line
 *  that told a reader the text was canned was removed before anything could
 *  show it. It is left in the text now and surfaced as a badge by
 *  `askProvenance`. */
export function readNarrative(markdown: string): { summary: string; recommend: string } {
  const body = plainNarrative(markdown);
  const m = body.match(/recommend:\s*(.*)$/is);
  if (m) return { summary: body.slice(0, m.index).trim(), recommend: m[1].trim() };
  return { summary: body, recommend: "" };
}

export const splitAnswer = readNarrative; // ask answers share the same shape

/** Whether a model wrote this answer, and if not, why.
 *
 *  Two independent signals, and either one is enough to say no: the backend's
 *  `ai: false`, and the `(offline summary)` marker a fallback text opens with.
 *  The marker is what an older backend gives, and a reply that carries the
 *  marker is not model-written whatever else it claims.
 *
 *  Absent `ai` reads as TRUE — an older backend sent the text and nothing else,
 *  and a model wrote it — and that is the only place absence is read as
 *  "fine": the reason is null unless it was given, never invented. */
export function askProvenance(
  a: Pick<MrAskAnswer, "answer" | "ai" | "fallback_reason">,
): { ai: boolean; reason: string | null } {
  const given = typeof a.fallback_reason === "string" ? a.fallback_reason.trim() : "";
  if (a.ai === false || isOfflineSummary(a.answer)) return { ai: false, reason: given || null };
  return { ai: true, reason: null };
}

/** The words that go under the "Not written by the model" badge. */
export function notModelWritten(reason: string | null): string {
  const tail = "What follows is the figures read straight from the tabs, not an analysis of them.";
  const why = (reason ?? "").trim();
  if (!why) return tail;
  const sentence = why[0].toUpperCase() + why.slice(1);
  return `${/[.!?]$/.test(sentence) ? sentence : `${sentence}.`} ${tail}`;
}

/** The period the question resolved to, or null.
 *
 *  Only `period_label` is ever shown. `timeframe` is not a fallback for it: on
 *  an older backend it is the granularity the question implied — the word
 *  "monthly" — and printing that as if it were a period is what this replaces.
 *  No label means no chip, not a placeholder. */
export function askPeriodLabel(a: Pick<MrAskAnswer, "period_label">): string | null {
  return typeof a.period_label === "string" && a.period_label.trim() ? a.period_label.trim() : null;
}

const MAX_LISTED = 6;

/** One plain note about what the answer could not stand behind, or null when
 *  the backend flagged nothing.
 *
 *  Two different things are folded into it on purpose — numbers in the text
 *  that could not be matched to a figure, and rows the read left out — because
 *  they are the same message to the reader: this answer is not fully checked.
 *  Two boxes would read as two alarms; this is a caution, not one. */
export function askCaveat(a: Pick<MrAskAnswer, "unverified_numbers" | "omitted">): string | null {
  const nums = (Array.isArray(a.unverified_numbers) ? a.unverified_numbers : [])
    .map((v) => String(v).trim())
    .filter(Boolean);
  const cut = (Array.isArray(a.omitted) ? a.omitted : [])
    .filter((o) => o && typeof o.tab === "string" && o.tab.trim() && Number(o.rows) > 0);
  const parts: string[] = [];

  if (nums.length > 0) {
    const shown = nums.slice(0, MAX_LISTED).join(", ");
    const more = nums.length > MAX_LISTED ? ` and ${nums.length - MAX_LISTED} more` : "";
    parts.push(
      nums.length === 1
        ? `One figure in this answer, ${shown}, could not be matched to the workbook.`
        : `${nums.length} figures in this answer could not be matched to the workbook: ${shown}${more}.`,
    );
    parts.push("Check them against the sheet before you rely on them.");
  }
  if (cut.length > 0) {
    parts.push(
      cut.length === 1
        ? `${rowsOf(Number(cut[0].rows))} of ${cut[0].tab} ${Number(cut[0].rows) === 1 ? "was" : "were"} left out of what was read.`
        : `Some rows were left out of what was read: ${cut
          .map((o) => `${Number(o.rows).toLocaleString("en-US")} of ${o.tab}`).join(", ")}.`,
    );
    parts.push("The answer cannot speak for them.");
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** A piece of answer text: plain, or a marker that resolved to a figure. */
export type CiteToken = { text: string } | { cite: MrAskFact };

/** Split answer text at its `[f12]`-style markers.
 *
 *  A marker becomes a `cite` token ONLY when every id inside the brackets is a
 *  fact the answer actually carries. `[f99]` with no such fact, a bracketed
 *  phrase, or a markdown link stays exactly as written — a chip that pointed at
 *  nothing would be a source the answer did not have. With no facts at all the
 *  text comes back whole, so an older backend renders as it always did.
 *
 *  The tokens, concatenated with each marker written back, are the input. */
const CITE_GROUP = /\[([A-Za-z][\w-]*(?:\s*[,;]\s*[A-Za-z][\w-]*)*)\]/g;

export function citeTokens(
  text: string,
  facts: readonly MrAskFact[] | null | undefined,
): CiteToken[] {
  if (!text) return [];
  const byId = new Map<string, MrAskFact>();
  for (const f of Array.isArray(facts) ? facts : []) {
    if (f && typeof f.id === "string" && f.id) byId.set(f.id, f);
  }
  if (byId.size === 0) return [{ text }];

  const out: CiteToken[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE_GROUP)) {
    const ids = m[1].split(/\s*[,;]\s*/);
    if (!ids.every((id) => byId.has(id))) continue;
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    for (const id of ids) out.push({ cite: byId.get(id)! });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `2026-07` as "July 2026"; anything else as it came. Spelled out here rather
 *  than through `toLocaleString`, so a hover reads the same on every machine. */
function monthWords(month: string | null | undefined): string {
  const raw = (month ?? "").trim();
  const hit = /^(\d{4})-(\d{2})$/.exec(raw);
  const i = hit ? Number(hit[2]) - 1 : -1;
  return hit && i >= 0 && i < 12 ? `${MONTH_NAMES[i]} ${hit[1]}` : raw;
}

/** Where one cited figure came from: tab, month, basis — whichever it carries. */
export function citeTitle(f: Pick<MrAskFact, "tab" | "month" | "basis">): string {
  return [f.tab, monthWords(f.month), f.basis]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

/** The distinct figures a set of tokens cites, in the order first cited. */
export function citedFacts(tokens: readonly CiteToken[]): MrAskFact[] {
  const seen = new Set<string>();
  const out: MrAskFact[] = [];
  for (const t of tokens) {
    if (!("cite" in t) || seen.has(t.cite.id)) continue;
    seen.add(t.cite.id);
    out.push(t.cite);
  }
  return out;
}

export function verdict(reds: number, warns: number): { cls: string; label: string } {
  if (reds > 0) return { cls: "bad", label: `${reds} red flag${reds === 1 ? "" : "s"}` };
  if (warns > 0) return { cls: "warn", label: "Watch" };
  return { cls: "good", label: "On track" };
}
