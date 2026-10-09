/** The Team report template panel's decisions, with no React and no DOM.
 *
 *  Everything a screen has to *decide* lives here so the MR suite can prove it:
 *  which sentence the band's template line says, which state an error reply is
 *  (by its `code`, never its wording), what the history table lists, where
 *  arranging by hand starts, and the arrange model itself — reorder, show/hide,
 *  rename, and nothing else. The theme and each section's options go back to
 *  the server exactly as they came.
 *
 *  Plain `.ts` with type-only imports from the API: the suite runs without the
 *  `@/` alias and cannot import a `.tsx` module.
 */

import type {
  MrLayout, MrLayoutSection, MrTemplateLine, MrTemplateListing, MrTemplatePlaceholder,
  MrTemplatePreview, MrTemplateProblem, MrTemplateVersion,
} from "@/lib/api";

/* -------------------------------- previews -------------------------------- */

/** The only part of a reading the viewer is ever given: the server's
 *  `preview_html` (rendered with its Content-Security-Policy) and why there is
 *  none. A check's `sanitized_html` is the stored template text, emitted
 *  WITHOUT that CSP — it goes back to the server on save and is never shown,
 *  so it is dropped here rather than trusted to go unread further down. */
export const previewOf = (reading: MrTemplatePreview): MrTemplatePreview => ({
  preview_html: reading.preview_html,
  preview_unavailable_reason: reading.preview_unavailable_reason,
  preview_unavailable_code: reading.preview_unavailable_code,
});

/** Whether a missing preview holds Save — by its code, and only for
 *  `template_failed`: THIS template does not render. No figures yet
 *  (`no_data`) or a store read that failed for now (`store_unavailable`) are
 *  not the template's fault, so Save stays open with the reason shown; the
 *  server renders the template once more before it stores it. */
export const previewHoldsSave = (p: MrTemplatePreview): boolean =>
  !p.preview_html && p.preview_unavailable_code === "template_failed";

/** The sentence where a preview would be, or null when there is a preview —
 *  or no answer yet. */
export function noPreviewLine(p: MrTemplatePreview): string | null {
  if (p.preview_html || !p.preview_unavailable_reason) return null;
  return previewHoldsSave(p)
    ? `This template doesn't render with your figures: ${clause(p.preview_unavailable_reason)}. It can't be saved as it is.`
    : `There's no preview: ${clause(p.preview_unavailable_reason)}. You can still save it — it is checked again when you do.`;
}

/* --------------------------------- people --------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Oct 2026" in the reader's own calendar, or null for a stamp that does
 *  not parse. `withYear: false` gives "3 Oct". */
export function dayOf(iso: string | null | undefined, withYear = true): string | null {
  const d = new Date(iso || "");
  if (!iso || Number.isNaN(d.getTime())) return null;
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${day} ${d.getFullYear()}` : day;
}

/** A person as the panel names them: "you" for the one reading the screen,
 *  else their display name, else the email the change was recorded under. */
export function who(
  email: string | null | undefined,
  me: string | null | undefined,
  name?: string | null,
): string {
  if (email && me && email.toLowerCase() === me.toLowerCase()) return "you";
  return name || email || "someone";
}

/** A server reason as the opening of a sentence the panel finishes. */
export const clause = (reason: string | null | undefined): string =>
  (reason || "").trim().replace(/[.\s]+$/, "");

/* ------------------------------ the band's line --------------------------- */

/** "The team's reports use the built-in template." / "The team's reports use
 *  version 4, set by Priya Shah on 3 Oct 2026."
 *
 *  `null` is a backend older than team templates, where every build IS the
 *  built-in. `kind: null` is the server saying it could not read its template
 *  store — said as that, never as the built-in. */
export function templateBandLine(line: MrTemplateLine | null, me?: string | null): string {
  if (!line || line.kind === "builtin") return "The team's reports use the built-in template.";
  if (line.kind === null) return "Which template the team's reports use could not be read just now.";
  const which = line.number !== null ? `version ${line.number}` : "the team's own template";
  const day = dayOf(line.set_at);
  return (line.set_by || line.set_by_name) && day
    ? `The team's reports use ${which}, set by ${who(line.set_by, me, line.set_by_name)} on ${day}.`
    : `The team's reports use ${which}.`;
}

/* ------------------------------ version history --------------------------- */

export const versionLabel = (v: Pick<MrTemplateVersion, "kind" | "number">): string =>
  v.kind === "builtin" ? "Built-in" : v.number !== null ? `Version ${v.number}` : "A team version";

/** "Sample: September-board.pdf" / "HTML: ours.html" / "Arranged by hand". */
export function madeFrom(v: Pick<MrTemplateVersion, "kind" | "source_kind" | "filename">): string {
  if (v.kind === "builtin") return "Built in";
  const file = v.filename || "an unnamed file";
  switch (v.source_kind) {
    case "pdf":
    case "image": return `Sample: ${file}`;
    case "html": return `HTML: ${file}`;
    case "builder": return "Arranged by hand";
    default: return v.filename || "—";
  }
}

/** The history table: saved versions newest first, the built-in pinned last.
 *  The built-in row is in use when the active template is the built-in, and
 *  carries who switched back to it. */
export function historyRows(listing: Pick<MrTemplateListing, "versions" | "active">): MrTemplateVersion[] {
  const activeBuiltin = !listing.active || listing.active.kind === "builtin";
  const builtin: MrTemplateVersion = {
    id: "builtin", kind: "builtin", number: null, source_kind: null, filename: null,
    created_by: null, created_by_name: null, created_at: null,
    set_by: activeBuiltin ? listing.active?.set_by ?? null : null,
    set_by_name: activeBuiltin ? listing.active?.set_by_name ?? null : null,
    set_at: activeBuiltin ? listing.active?.set_at ?? null : null,
    active: activeBuiltin,
  };
  return [...listing.versions.filter((v) => v.kind !== "builtin"), builtin];
}

/** Who made a version, for the By column. */
export const madeBy = (v: MrTemplateVersion, me?: string | null): string =>
  v.created_by || v.created_by_name ? who(v.created_by, me, v.created_by_name) : "—";

/** "Set by Rahul Mehta on 5 Oct" — under "In use" only when the version was
 *  made active by switching back to it, not when it is simply the newest save. */
export function setByLine(v: MrTemplateVersion, me?: string | null): string | null {
  if (!v.active || !(v.set_by || v.set_by_name)) return null;
  if (v.kind !== "builtin" && v.set_by === v.created_by && v.set_at === v.created_at) return null;
  const name = who(v.set_by, me, v.set_by_name);
  const day = dayOf(v.set_at, false);
  return day ? `Set by ${name} on ${day}` : `Set by ${name}`;
}

/** The toast after a switch. */
export const switchedLine = (v: Pick<MrTemplateVersion, "kind" | "number">): string =>
  v.kind === "builtin"
    ? "Switched to the built-in template. The team's next report will use it."
    : `Switched to ${versionLabel(v).toLowerCase()}. The team's next report will use it.`;

/* -------------------------------- readings -------------------------------- */

/** "3 sample readings left today for the team." — only once it is worth
 *  saying (three or fewer), and never as a zero: none left is the
 *  rate-limited sentence instead. */
export function readingsLeftLine(left: number | null): string | null {
  if (left === null || left > 3 || left <= 0) return null;
  return `${left} sample reading${left === 1 ? "" : "s"} left today for the team.`;
}

/** The rate-limited sentence, as the spec writes it. Arranging by hand always
 *  has somewhere to start now, so it is always named. */
export function rateLimitedLine(perDay: number | null): string {
  const used = perDay !== null ? `today's ${perDay} sample readings` : "today's sample readings";
  return `The team has used ${used}. Try again tomorrow; HTML templates and arranging by hand work now.`;
}

/** What an error reply from reading a file IS, chosen by its code.
 *
 *  - `limit`: the day's readings are spent — calm, never red.
 *  - `reader`: the AI reader (key, provider, timeout, an unusable answer) —
 *    the spec's Oops, with arrange-by-hand as the way on.
 *  - `check`: an HTML file the checker could not run on — an Oops with Try
 *    again; nothing was checked and nothing was saved.
 *  - `upload`: the file itself (not a sample we take, unreadable, encrypted,
 *    too big — including the 413 refused on size before auth — nothing
 *    matched) — a calm note with the server's reason and another file.
 *
 *  An unknown code is placed by its status, so a code added later still lands
 *  somewhere true: 5xx is the reader's, anything else is the upload's. */
export type ReadFailure = "limit" | "reader" | "check" | "upload";

const READER_CODES = new Set([
  "no_key", "offline", "provider_error", "timeout", "refused", "truncated", "invalid_output",
]);

export function readFailure(code: string | null, status: number | null): ReadFailure {
  if (code === "rate_limited" || status === 429) return "limit";
  if (code === "check_unavailable") return "check";
  if (code && READER_CODES.has(code)) return "reader";
  if (code === null && status === null) return "reader";   // no reply at all
  return status !== null && status >= 500 ? "reader" : "upload";
}

/* ----------------------------- an HTML template --------------------------- */

const REMOVED_WORDS: Record<string, [string, string]> = {
  scripts: ["script", "scripts"],
  handlers: ["event handler", "event handlers"],
  external_urls: ["outside address", "outside addresses"],
  unsafe_urls: ["unsafe link", "unsafe links"],
  elements: ["unsupported element", "unsupported elements"],
  attributes: ["unsupported attribute", "unsupported attributes"],
  css_rules: ["style rule", "style rules"],
};

/** "We removed 1 script. Templates can't run code; everything else is kept."
 *
 *  Every kind that was taken out is named, because "everything else is kept"
 *  would be false if a handler or an outside address went too. Comments are
 *  not content and are not counted. Null when nothing was removed. */
export function removedLine(removed: Record<string, number>): string | null {
  const parts = Object.entries(REMOVED_WORDS).flatMap(([key, [one, many]]) => {
    const n = removed[key] || 0;
    return n > 0 ? [`${n} ${n === 1 ? one : many}`] : [];
  });
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  const onlyScripts = parts.length === 1 && (removed.scripts || 0) > 0;
  return `We removed ${list}. Templates can't run code`
    + (onlyScripts ? "" : " or load anything from outside") + "; everything else is kept.";
}

/** "2 placeholders aren't recognised, so this template can't be saved." — the
 *  spec's line when every problem is a placeholder; otherwise it does not
 *  call them placeholders. */
export function problemsHeading(errors: MrTemplateProblem[]): string {
  const n = errors.length;
  if (errors.every((e) => e.placeholder)) {
    return n === 1
      ? "1 placeholder isn't recognised, so this template can't be saved."
      : `${n} placeholders aren't recognised, so this template can't be saved.`;
  }
  return n === 1
    ? "1 problem stops this template from being saved."
    : `${n} problems stop this template from being saved.`;
}

/** One row: "Line 14", "{{totl_spend}}", "Did you mean {{total_spend}}?" — the
 *  suggestion when there is one, else the server's own message. */
export function problemParts(e: MrTemplateProblem): { line: string | null; placeholder: string | null; text: string } {
  return {
    line: e.line !== null ? `Line ${e.line}` : null,
    placeholder: e.placeholder,
    text: e.suggestion ? `Did you mean ${e.suggestion}?` : e.message,
  };
}

/** "We matched 6 sections. Here they are with your September 2026 figures." */
export function matchedLine(count: number | null, month: string | null): string {
  const matched = count === null ? "We matched your sample's sections."
    : `We matched ${count} section${count === 1 ? "" : "s"}.`;
  return month ? `${matched} Here they are with your ${month} figures.` : matched;
}

/* ------------------------- where arranging starts ------------------------- */

/** Where "Arrange sections by hand" starts, with no sample read:
 *
 *  - the built-in in use (or none said) → the built-in's layout, which the
 *    listing carries as `default_layout`;
 *  - a layout version in use → that version's own sections, one read of
 *    `GET /report-templates/{id}/layout` (the list stays bodiless);
 *  - an HTML version in use → it has no sections to arrange, so the built-in's,
 *    and one quiet line saying so. */
export type HandPlan =
  | { from: "builtin"; note: string | null }
  | { from: "version"; id: string };

export function handPlan(active: MrTemplateVersion | null): HandPlan {
  if (!active || active.kind === "builtin") return { from: "builtin", note: null };
  if (active.kind === "html") {
    const which = active.number !== null ? `Version ${active.number}` : "The team's template";
    return { from: "builtin",
             note: `${which} is an HTML template, which has no sections to arrange, so this starts from the built-in layout.` };
  }
  return { from: "version", id: active.id };
}

/* ---------------------------- arranging by hand --------------------------- */

/** Sections that are always in the report, so they are listed but not moved
 *  or hidden. The server adds the data-gaps note and the footer to every
 *  layout itself; showing them as optional would be a control that lies. */
export const PINNED_TOP: readonly string[] = ["header"];
export const PINNED_BOTTOM: readonly string[] = ["data_gaps", "footer"];
const PINNED = new Set([...PINNED_TOP, ...PINNED_BOTTOM]);

export interface ArrangeRow {
  key: string;
  type: string;
  /** The section's own title; null means the registry's. */
  title: string | null;
  options: Record<string, unknown>;
  shown: boolean;
}

export interface Arrangement {
  theme?: Record<string, unknown>;
  top: ArrangeRow[];
  rows: ArrangeRow[];
  bottom: ArrangeRow[];
}

/** Every section type the server can render, in its registry's order, read
 *  off the block placeholders (`{{chart:benchmark_movers}}` → `benchmark_movers`). */
export function sectionTypes(placeholders: MrTemplatePlaceholder[]): string[] {
  const out: string[] = [];
  for (const p of placeholders) {
    const m = /^\{\{\s*([a-z_]+):([a-z_]+)\s*\}\}$/.exec(p.token);
    if (m && m[1] !== "scalar" && !out.includes(m[2])) out.push(m[2]);
  }
  return out;
}

/** Each section type's name as the report prints it: the block placeholder's
 *  own `title`. A placeholder without one (a backend older than the field) is
 *  spelled out from its key, so a section never shows as blank — and its
 *  description is never parsed for a name. */
export function sectionTitles(placeholders: MrTemplatePlaceholder[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of placeholders) {
    const m = /^\{\{\s*[a-z_]+:([a-z_]+)\s*\}\}$/.exec(p.token);
    if (m) out[m[1]] = p.title || humanise(m[1]);
  }
  return out;
}

export const humanise = (type: string): string => {
  const words = type.replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : type;
};

const row = (s: MrLayoutSection, key: string, shown: boolean): ArrangeRow =>
  ({ key, type: s.type, title: s.title, options: s.options, shown });

/** A layout as rows to arrange. Its own sections keep their order and are
 *  shown; the pinned ones go to their ends (added when the layout left them
 *  out — the server would add them anyway); every other section type the
 *  server knows is listed after, hidden, so it can be switched on. */
export function arrange(layout: MrLayout, allTypes: string[] = []): Arrangement {
  const top: ArrangeRow[] = [];
  const bottom: ArrangeRow[] = [];
  const rows: ArrangeRow[] = [];
  layout.sections.forEach((s, i) => {
    const key = `${s.type}-${i}`;
    if (PINNED_TOP.includes(s.type)) {
      if (!top.some((r) => r.type === s.type)) top.push(row(s, key, true));
    } else if (PINNED_BOTTOM.includes(s.type)) {
      if (!bottom.some((r) => r.type === s.type)) bottom.push(row(s, key, true));
    } else {
      rows.push(row(s, key, true));
    }
  });
  for (const type of PINNED_TOP) {
    if (!top.some((r) => r.type === type)) top.push(row({ type, title: null, options: {} }, `${type}-pin`, true));
  }
  for (const type of PINNED_BOTTOM) {
    if (!bottom.some((r) => r.type === type)) bottom.push(row({ type, title: null, options: {} }, `${type}-pin`, true));
  }
  bottom.sort((a, b) => PINNED_BOTTOM.indexOf(a.type) - PINNED_BOTTOM.indexOf(b.type));
  const present = new Set(rows.map((r) => r.type));
  for (const type of allTypes) {
    if (!PINNED.has(type) && !present.has(type)) {
      rows.push(row({ type, title: null, options: {} }, `${type}-extra`, false));
    }
  }
  return { ...(layout.theme ? { theme: layout.theme } : {}), top, rows, bottom };
}

const section = (r: ArrangeRow): MrLayoutSection =>
  ({ type: r.type, title: r.title && r.title.trim() ? r.title.trim() : null, options: r.options });

/** The layout an arrangement stands for: what is previewed and what is saved.
 *  Hidden rows are left out; nothing else about a section is changed. */
export function layoutOf(a: Arrangement): MrLayout {
  const sections = [...a.top, ...a.rows.filter((r) => r.shown), ...a.bottom].map(section);
  return a.theme ? { theme: a.theme, sections } : { sections };
}

/** Whether two layouts render the same — so an arrangement that changed
 *  nothing does not ask for a preview the server already gave. */
export const sameLayout = (a: MrLayout, b: MrLayout): boolean =>
  JSON.stringify(a.sections.map((s) => [s.type, s.title || null, s.options]))
    === JSON.stringify(b.sections.map((s) => [s.type, s.title || null, s.options]));

/** One row up (-1) or down (+1). The ends do nothing. */
export function moveRow(a: Arrangement, key: string, delta: -1 | 1): Arrangement {
  const i = a.rows.findIndex((r) => r.key === key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= a.rows.length) return a;
  const rows = [...a.rows];
  [rows[i], rows[j]] = [rows[j], rows[i]];
  return { ...a, rows };
}

/** A dragged row dropped onto another's place. */
export function moveRowTo(a: Arrangement, fromKey: string, toKey: string): Arrangement {
  const from = a.rows.findIndex((r) => r.key === fromKey);
  const to = a.rows.findIndex((r) => r.key === toKey);
  if (from < 0 || to < 0 || from === to) return a;
  const rows = [...a.rows];
  const [moved] = rows.splice(from, 1);
  rows.splice(to, 0, moved);
  return { ...a, rows };
}

export const showRow = (a: Arrangement, key: string, shown: boolean): Arrangement =>
  ({ ...a, rows: a.rows.map((r) => (r.key === key ? { ...r, shown } : r)) });

export const renameRow = (a: Arrangement, key: string, title: string): Arrangement =>
  ({ ...a, rows: a.rows.map((r) => (r.key === key ? { ...r, title: title || null } : r)) });
