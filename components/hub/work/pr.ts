/** PR Writer — the decisions behind the workspace, with no React in them.
 *
 *  The route is the truth: `#/w/pr/<brandId>/<view>`, where the view is
 *  `drafts` (the default), `write`, `card`, or a run id `pr-…`; an older
 *  version rides the hash query as `?v=1.0`. Everything a screen decides from
 *  a run — which chip a row wears, what each step line says, which marker a
 *  `[VERIFY: …]` token is, why a draft cannot be Approved yet — follows from
 *  the run alone, so it lives here, provable in `pr.test.ts`, and
 *  `PrWorkspace.tsx` / `PrWriter.tsx` only wire it.
 *
 *  Three things are load-bearing:
 *
 *  1. **The server decides, the client maps.** Status, `needs_you` and `can`
 *     come from the backend (`docs/pr-writer-api.md` §4). Nothing here
 *     recomputes who may do what; it only says it in words.
 *  2. **Every reply is read with defaults.** Vercel and Cloud Run deploy at
 *     different times, so a field the other side does not send yet must read
 *     as its empty value, never as a crash (`normalise*`).
 *  3. **Only the owner's browser runs steps.** Each step is paid work; a
 *     teammate opening the draft never starts one (`nextAutoStep`).
 */

import type {
  PrBlockers, PrBrand, PrBrandCard, PrBrandCardInput, PrBrandCardResponse, PrCan, PrCardSection,
  PrClarify, PrEscalation, PrMarker, PrPackage, PrPackageSection, PrQuote, PrRun, PrRunSummary,
  PrSignoffRow, PrSignoffs, PrStep, PrStepId, PrUserRef, PrVersion, PrVersionSummary,
} from "@/lib/api";
import { andList } from "../model";
import { draftCountLabel } from "./blog";

/* =================================================================== route == */

export type PrView =
  | { kind: "drafts" }
  | { kind: "write" }
  | { kind: "card" }
  | { kind: "run"; runId: string };

/** Run ids are minted as `pr-<12 hex>` (contract §0). */
export const isPrRunId = (s: string): boolean => /^pr-[0-9a-z]+$/i.test(s);

export function parseView(section: string): PrView {
  if (section === "write") return { kind: "write" };
  if (section === "card") return { kind: "card" };
  if (isPrRunId(section)) return { kind: "run", runId: section };
  return { kind: "drafts" };
}

export function viewSegment(view: PrView): string {
  return view.kind === "run" ? view.runId : view.kind;
}

/** Which workspace section the rail lights: a run is one of the drafts. */
export const sectionOf = (view: PrView): "drafts" | "write" | "card" =>
  view.kind === "run" ? "drafts" : view.kind;

const byUpdated = (a: { updated_at: string }, b: { updated_at: string }): number =>
  (b.updated_at || "").localeCompare(a.updated_at || "");

/** The brand a bare `#/w/pr` opens on: the brand of the viewer's most recently
 *  touched own run, else the first brand. A brand no longer listed is skipped. */
export function defaultBrand(brands: PrBrand[], runs: PrRunSummary[]): string {
  const listed = new Set(brands.map((b) => b.id));
  const mine = runs.filter((r) => r.is_owner && listed.has(r.brand_id)).sort(byUpdated);
  return mine[0]?.brand_id || brands[0]?.id || "";
}

/** The route's two segments as a brand and a view. An open run sits under its
 *  own brand whatever the link says, so the work bar never marks a brand the
 *  draft does not belong to. */
export function readRoute(
  subject: string,
  section: string,
  brands: PrBrand[],
  runs: PrRunSummary[],
  opened: { id: string; brand_id: string } | null = null,
): { brandId: string; view: PrView } {
  const listed = (id: string | undefined): id is string => !!id && brands.some((b) => b.id === id);
  const view = parseView(section);
  const owner = view.kind === "run"
    ? (runs.find((r) => r.id === view.runId) ?? (opened?.id === view.runId ? opened : null))?.brand_id
    : undefined;
  const brandId = listed(owner) ? owner : listed(subject) ? subject : defaultBrand(brands, runs);
  return { brandId, view };
}

const VERSION_RE = /^\d+\.\d+$/;

/** The older version a link asks for (`#/w/pr/<brand>/<run>?v=1.0`), or null. */
export function readVersionParam(hash: string): string | null {
  const q = hash.indexOf("?");
  if (q < 0) return null;
  const v = new URLSearchParams(hash.slice(q + 1)).get("v");
  return v && VERSION_RE.test(v) ? v : null;
}

/** The hash with `?v=` set to `version`, or taken off when it is null. */
export function withVersionParam(hash: string, version: string | null): string {
  const q = hash.indexOf("?");
  const base = q < 0 ? hash : hash.slice(0, q);
  const params = new URLSearchParams(q < 0 ? "" : hash.slice(q + 1));
  if (version) params.set("v", version);
  else params.delete("v");
  const rest = params.toString();
  return rest ? `${base}?${rest}` : base;
}

/* ============================================================ normalising == */

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown): boolean => v === true;
const arr = <T>(v: unknown, f: (x: unknown) => T): T[] => (Array.isArray(v) ? v.map(f) : []);
const user = (v: unknown): PrUserRef | null => {
  const o = rec(v);
  return typeof o.id === "string" ? { id: o.id, name: str(o.name) || o.id } : null;
};
const userOr = (v: unknown, d: PrUserRef): PrUserRef => user(v) ?? d;
const NOBODY: PrUserRef = { id: "", name: "Someone" };

export const STEP_IDS: readonly PrStepId[] = ["intake", "screen", "research", "draft", "package", "notes"];
const PACKAGE_SECTIONS: readonly PrPackageSection[] = ["seo", "distribution", "snippets", "reviewer_notes"];

export const NO_CAN: PrCan = {
  run_steps: false, answer_clarify: false, add_escalation_note: false, withdraw: false,
  clear_escalation: false, keep_paused: false, close_escalation: false, revise: false,
  send_for_review: false, record_quote_approval: false, approve: false, add_people: false, export: false,
};

const blockers = (v: unknown): PrBlockers => {
  const o = rec(v);
  return { verify: num(o.verify), missing: num(o.missing), pending_quotes: num(o.pending_quotes) };
};

function step(v: unknown, id: PrStepId): PrStep {
  const o = rec(v);
  const e = o.error ? rec(o.error) : null;
  const state = str(o.state, "pending") as PrStep["state"];
  return {
    id,
    state,
    started_at: strOrNull(o.started_at),
    finished_at: strOrNull(o.finished_at),
    result: o.result && typeof o.result === "object" && !Array.isArray(o.result) ? (o.result as Rec) : null,
    error: e ? {
      code: str(e.code, "model_unavailable"),
      message: str(e.message), at: str(e.at), attempts: num(e.attempts),
    } : null,
  };
}

export function normaliseVersionSummary(v: unknown): PrVersionSummary {
  const o = rec(v);
  return {
    version: str(o.version),
    created_at: str(o.created_at),
    created_by: user(o.created_by),
    kind: str(o.kind, "revision") as PrVersionSummary["kind"],
    what_changed: str(o.what_changed),
    quote_resets: arr(o.quote_resets, (q) => ({ quote_id: str(rec(q).quote_id), speaker_name: str(rec(q).speaker_name) })),
    locked: bool(o.locked),
    locked_at: strOrNull(o.locked_at),
  };
}

export function normaliseVersion(v: unknown): PrVersion {
  const o = rec(v);
  const sub = rec(o.subheadline);
  return {
    ...normaliseVersionSummary(v),
    headlines: arr(o.headlines, (h) => {
      const x = rec(h);
      return { text: str(x.text), chars: num(x.chars, str(x.text).length), recommended: bool(x.recommended) };
    }),
    subheadline: { recommended: str(sub.recommended), alternate: str(sub.alternate) },
    news_angle: str(o.news_angle),
    blocks: arr(o.blocks, (b) => {
      const x = rec(b);
      const id = str(x.id);
      return {
        id, kind: str(x.kind, "body"), text: str(x.text),
        // Only body blocks (b1…) are revisable; a reply without the flag reads
        // it from the id, which is what the server decides it from.
        revisable: typeof x.revisable === "boolean" ? x.revisable : /^b\d+$/.test(id),
        claim_ids: arr(x.claim_ids, (c) => str(c)), cites: arr(x.cites, (c) => str(c)),
        quote_id: strOrNull(x.quote_id), last_comment: strOrNull(x.last_comment),
      };
    }),
    claims: arr(o.claims, (c) => {
      const x = rec(c);
      const s = rec(x.source);
      const ver = x.verified ? rec(x.verified) : null;
      return {
        id: str(x.id), n: num(x.n), text: str(x.text), block_id: str(x.block_id),
        placeholder: typeof x.placeholder === "boolean" ? x.placeholder : /^\[VERIFY:/.test(str(x.text).trim()),
        status_reason: str(x.status_reason),
        source: {
          kind: str(s.kind, "none") as PrVersion["claims"][number]["source"]["kind"],
          label: str(s.label), url: strOrNull(s.url), date: strOrNull(s.date),
        },
        date_checked: strOrNull(x.date_checked),
        status: str(x.status, "sourced") as PrVersion["claims"][number]["status"],
        owner_to_confirm: strOrNull(x.owner_to_confirm),
        verified: ver ? { by: userOr(ver.by, NOBODY), note: str(ver.note), at: str(ver.at) } : null,
      };
    }),
    quotes: arr(o.quotes, (q): PrQuote => {
      const x = rec(q);
      const a = rec(x.approval);
      return {
        id: str(x.id), block_id: str(x.block_id), speaker_name: str(x.speaker_name), speaker_title: str(x.speaker_title),
        organization: strOrNull(x.organization), text: str(x.text), text_hash: str(x.text_hash),
        approval: {
          state: a.state === "approved" ? "approved" : "pending",
          recorded_by: user(a.recorded_by), evidence: strOrNull(a.evidence), at: strOrNull(a.at),
        },
        reset_in_version: strOrNull(x.reset_in_version),
      };
    }),
    markers: arr(o.markers, (m): PrMarker => {
      const x = rec(m);
      return {
        id: str(x.id), kind: str(x.kind, "verify") as PrMarker["kind"], block_id: str(x.block_id),
        token: str(x.token), label: str(x.label), claim_id: strOrNull(x.claim_id), quote_id: strOrNull(x.quote_id),
        resolved: bool(x.resolved),
      };
    }),
  };
}

function clarify(v: unknown): PrClarify | null {
  if (!v || typeof v !== "object") return null;
  const o = rec(v);
  const ct = rec(o.content_type);
  return {
    state: str(o.state, "open") as PrClarify["state"],
    fields: arr(o.fields, (f) => {
      const x = rec(f);
      return { key: str(x.key) as PrClarify["fields"][number]["key"], label: str(x.label), guess: strOrNull(x.guess), answer: strOrNull(x.answer) };
    }),
    content_type: {
      value: str(ct.value, "press_release") as PrClarify["content_type"]["value"],
      guessed: bool(ct.guessed),
      options: arr(ct.options, (op) => ({ value: str(rec(op).value) as PrClarify["content_type"]["value"], label: str(rec(op).label) })),
    },
    answered_at: strOrNull(o.answered_at),
  };
}

function escalation(v: unknown): PrEscalation | null {
  if (!v || typeof v !== "object") return null;
  const o = rec(v);
  const c = rec(o.clearer);
  return {
    state: str(o.state, "paused") as PrEscalation["state"],
    category: str(o.category),
    category_label: str(o.category_label) || str(o.category).replace(/_/g, " "),
    excerpt: str(o.excerpt),
    reason: str(o.reason),
    raised_at: strOrNull(o.raised_at),
    clearer: { role: str(c.role, "comms_lead") as PrEscalation["clearer"]["role"], user: user(c.user) },
    notes: arr(o.notes, (n) => {
      const x = rec(n);
      return { kind: str(x.kind, "requester") as PrEscalation["notes"][number]["kind"], by: userOr(x.by, NOBODY), at: str(x.at), text: str(x.text) };
    }),
  };
}

function signoffs(v: unknown): PrSignoffs {
  const o = rec(v);
  const s = rec(o.summary);
  return {
    version: strOrNull(o.version),
    rows: arr(o.rows, (r): PrSignoffRow => {
      const x = rec(r);
      const kind = x.kind === "quote" ? "quote" : "role";
      return {
        id: str(x.id) as PrSignoffRow["id"], kind, label: str(x.label), assignee: user(x.assignee),
        fallback: bool(x.fallback), unassigned: bool(x.unassigned),
        state: str(x.state, kind === "quote" ? "pending" : "waiting") as PrSignoffRow["state"],
        version: strOrNull(x.version), by: user(x.by), at: strOrNull(x.at), note: strOrNull(x.note),
        viewer_can_act: bool(x.viewer_can_act),
      };
    }),
    summary: { signed: num(s.signed), total: num(s.total) },
    blockers: blockers(o.blockers),
    approved: bool(o.approved),
    can_approve: bool(o.can_approve),
  };
}

function pkg(v: unknown): PrPackage | null {
  if (!v || typeof v !== "object") return null;
  const o = rec(v);
  const secs = rec(o.sections);
  const sections = {} as PrPackage["sections"];
  for (const k of PACKAGE_SECTIONS) {
    const x = rec(secs[k]);
    // A section the reply does not mention has not been built yet.
    const state = x.state === "done" || x.state === "failed" ? x.state : "pending";
    sections[k] = { state, error: strOrNull(x.error) };
  }
  const seo = o.seo && typeof o.seo === "object" ? rec(o.seo) : null;
  const dist = o.distribution && typeof o.distribution === "object" ? rec(o.distribution) : null;
  const snip = o.snippets && typeof o.snippets === "object" ? rec(o.snippets) : null;
  const strs = (x: unknown) => arr(x, (y) => str(y)).filter(Boolean);
  const wire = dist ? rec(dist.wire) : {};
  return {
    based_on_version: str(o.based_on_version),
    sections,
    seo: seo ? {
      seo_title: str(seo.seo_title), meta_description: str(seo.meta_description), slug: str(seo.slug),
      internal_links: arr(seo.internal_links, (l) => ({ url: str(rec(l).url), anchor: str(rec(l).anchor) })),
      external_link: seo.external_link ? { url: str(rec(seo.external_link).url), why: str(rec(seo.external_link).why) } : null,
      images: arr(seo.images, (i) => ({ description: str(rec(i).description), alt_text: str(rec(i).alt_text) })),
      hashtags: strs(seo.hashtags),
      social_summary: str(seo.social_summary),
      primary_keyword: str(seo.primary_keyword),
      secondary_keywords: strs(seo.secondary_keywords),
    } : null,
    distribution: dist ? {
      channels: arr(dist.channels, (c) => {
        const x = rec(c);
        return {
          channel: str(x.channel), why: str(x.why), outlet_examples: strs(x.outlet_examples),
          timing: str(x.timing), pitch_angle: str(x.pitch_angle), reporter_beat: str(x.reporter_beat),
        };
      }),
      wire: { recommended: bool(wire.recommended), circuit: str(wire.circuit), timing: str(wire.timing), notes: str(wire.notes) },
      embargo_notes: str(dist.embargo_notes),
    } : null,
    snippets: snip ? {
      linkedin_post: str(snip.linkedin_post), social_summary: str(snip.social_summary), reporter_pitch: str(snip.reporter_pitch),
    } : null,
    reviewer_notes: Array.isArray(o.reviewer_notes)
      ? arr(o.reviewer_notes, (n) => ({ kind: str(rec(n).kind, "assumption") as "assumption", text: str(rec(n).text) }))
      : null,
  };
}

/** A run as the screen reads it: every container present, every flag a
 *  boolean, and the six steps always six and in pipeline order. */
export function normaliseRun(v: unknown): PrRun {
  const o = rec(v);
  const c = rec(o.can);
  const can = { ...NO_CAN };
  for (const k of Object.keys(NO_CAN) as (keyof PrCan)[]) can[k] = bool(c[k]);
  const stepsIn = Array.isArray(o.steps) ? o.steps.map(rec) : [];
  const rv = rec(o.reviewers);
  const roles = arr(o.viewer_roles, (r) => str(r)).filter(Boolean) as PrRun["viewer_roles"];
  const role = (str(o.viewer_role) || roles[0] || "participant") as PrRun["viewer_role"];
  return {
    id: str(o.id),
    brand_id: str(o.brand_id),
    brand_name: str(o.brand_name),
    brand_domain: str(o.brand_domain),
    has_card: bool(o.has_card),
    news: str(o.news),
    facts: str(o.facts),
    owner: userOr(o.owner, NOBODY),
    created_at: str(o.created_at),
    updated_at: str(o.updated_at),
    status: str(o.status, "writing") as PrRun["status"],
    next_step: (strOrNull(o.next_step) as PrStepId | null),
    steps: STEP_IDS.map((id) => step(stepsIn.find((s) => s.id === id), id)),
    content_type: strOrNull(o.content_type) as PrRun["content_type"],
    content_type_label: strOrNull(o.content_type_label),
    audience: strOrNull(o.audience),
    clarify: clarify(o.clarify),
    escalation: escalation(o.escalation),
    reviewers: { comms_lead: user(rv.comms_lead), brand_owner: user(rv.brand_owner), legal: user(rv.legal) },
    fallback_admins: arr(o.fallback_admins, user).filter((u): u is PrUserRef => !!u),
    participants: arr(o.participants, (p) => {
      const x = rec(p);
      return {
        user: userOr(x.user, NOBODY),
        roles: arr(x.roles, (r) => str(r)) as PrRun["viewer_roles"],
        added_by: user(x.added_by), added_at: str(x.added_at),
      };
    }),
    viewer_role: role,
    viewer_roles: roles.length ? roles : [role],
    needs_you: (strOrNull(o.needs_you) as PrRun["needs_you"]),
    can,
    current_version: strOrNull(o.current_version),
    versions: arr(o.versions, normaliseVersionSummary),
    draft: o.draft && typeof o.draft === "object" ? normaliseVersion(o.draft) : null,
    markers: blockers(o.markers),
    signoffs: signoffs(o.signoffs),
    package: pkg(o.package),
  };
}

export function normaliseSummary(v: unknown): PrRunSummary {
  const o = rec(v);
  const s = o.signoff_summary ? rec(o.signoff_summary) : null;
  return {
    id: str(o.id), brand_id: str(o.brand_id), brand_name: str(o.brand_name),
    news: str(o.news), headline: strOrNull(o.headline), content_type_label: strOrNull(o.content_type_label),
    owner: userOr(o.owner, NOBODY), is_owner: bool(o.is_owner),
    created_at: str(o.created_at), updated_at: str(o.updated_at) || str(o.created_at),
    status: str(o.status, "writing") as PrRunSummary["status"],
    next_step: strOrNull(o.next_step) as PrStepId | null,
    running_step: strOrNull(o.running_step) as PrStepId | null,
    failed_step: strOrNull(o.failed_step) as PrStepId | null,
    current_version: strOrNull(o.current_version),
    signoff_summary: s ? { signed: num(s.signed), total: num(s.total) } : null,
    needs_you: strOrNull(o.needs_you) as PrRunSummary["needs_you"],
    viewer_role: (str(o.viewer_role) || "participant") as PrRunSummary["viewer_role"],
  };
}

export function normaliseBrand(v: unknown): PrBrand {
  const o = rec(v);
  return {
    id: str(o.id), name: str(o.name) || str(o.id), domain: str(o.domain),
    has_card: bool(o.has_card),
    card_sections_complete: num(o.card_sections_complete),
    card_sections_total: num(o.card_sections_total, CARD_SECTIONS.length),
  };
}

/* ================================================================== steps == */

export const STEP_LABEL: Record<PrStepId, string> = {
  intake: "Intake", screen: "Screen", research: "Research", draft: "Draft", package: "Package", notes: "Notes",
};

/** The step's name inside a sentence: "Stopped at research". */
const stepWord = (id: PrStepId | null | undefined): string => (id ? STEP_LABEL[id].toLowerCase() : "a step");

const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

export interface StepLine {
  id: PrStepId;
  label: string;
  state: PrStep["state"];
  /** What it is doing (running) or what it found (done / partial). */
  result?: string;
  /** Why it stopped (failed). */
  error?: string;
}

export const SEARCH_UNAVAILABLE_TEXT =
  "Research couldn't run: the web search service is out of credit. Nothing was drafted. An admin needs to top it up.";
export const MODEL_UNAVAILABLE_TEXT = "The writing model isn't available right now. Nothing was drafted.";

/** What went wrong, for each code the backend can fail with (contract §0.2),
 *  said as a cause. Each caller adds what that means where it happened:
 *  nothing filed, nothing drafted, nothing changed. Never provider text. */
export const FAILURE_CAUSE: Record<string, string> = {
  search_unavailable: "Research couldn't run: the web search service is out of credit.",
  credential_missing: "A key PR Writer needs isn't configured, so an admin has to add it.",
  model_unavailable: "The writing model isn't available right now.",
  model_truncated: "The writing model's answer was cut off before it finished.",
  model_refused: "The writing model declined to write this.",
  model_output_invalid: "The writing model's answer wasn't usable, even after one repair.",
  model_timeout: "The writing model ran out of time.",
  screen_failed: "The check for topics that need legal first couldn't run, so nothing goes ahead until it does.",
  cap_reached: "This draft has reached a size limit.",
  store_failed: "PR Writer could not read or save this draft.",
};

/** Steps whose failure leaves no draft behind. Package and notes run on a
 *  draft that already exists, so their failure must not say otherwise. */
const BEFORE_DRAFT: ReadonlySet<string> = new Set(["intake", "screen", "research", "draft"]);

/** A failed step in words. The spec's two named failures keep its exact
 *  sentences; the rest is the cause plus what is still safe. */
export function stepErrorText(error: PrStep["error"], step: PrStepId | null = null): string {
  if (!error) return "This step stopped. It can run again.";
  const early = !step || BEFORE_DRAFT.has(step);
  if (error.code === "search_unavailable") return SEARCH_UNAVAILABLE_TEXT;
  if (error.code === "model_unavailable") {
    return early ? MODEL_UNAVAILABLE_TEXT : `${FAILURE_CAUSE.model_unavailable} The draft is saved.`;
  }
  if (error.code === "credential_missing") return `${FAILURE_CAUSE.credential_missing} ${early ? "Nothing was drafted." : "The draft is saved."}`;
  if (error.code === "screen_failed") return `${FAILURE_CAUSE.screen_failed} Try the screen again.`;
  const cause = FAILURE_CAUSE[error.code];
  if (cause) return `${cause} ${early ? "Your brief and earlier steps are saved." : "The draft is saved."}`;
  return error.message || "This step stopped. It can run again.";
}

/** A failed edit or decision (revise, verify, remove, review, approve…). */
export function actionErrorText(code: string | null, message: string | null, fallback: string): string {
  if (code === "cap_reached") return "This draft has reached a size limit, so nothing was changed.";
  if (code === "approval_blocked") return message || "It can't be approved yet. Nothing was changed.";
  const cause = code ? FAILURE_CAUSE[code] : undefined;
  if (cause) return `${cause} Nothing was changed.`;
  return message || fallback;
}

export const NOT_STARTED = "The run could not be started. Nothing was filed.";

/** A failed `POST /runs`: intake runs inside it, and when intake fails
 *  nothing is filed. A refusal about the brief keeps the server's sentence. */
export function createErrorText(code: string | null, message: string | null): string {
  if ((code === "news_required" || code === "too_long") && message) return message;
  const cause = code ? FAILURE_CAUSE[code] : undefined;
  return cause ? `${cause} Nothing was filed.` : NOT_STARTED;
}

function runningText(id: PrStepId, run: PrRun): string {
  switch (id) {
    case "intake": return "Reading the brief";
    case "screen": return "Checking for topics that need legal first";
    case "research": return `Researching the brand card, ${run.brand_domain || "the brand's site"} and public sources`;
    case "draft": return "Writing the draft";
    case "package": return "Building the fact-check, SEO, distribution plan and snippets";
    case "notes": return "Writing reviewer notes";
  }
}

function doneText(s: PrStep, run: PrRun): string {
  const r = rec(s.result);
  switch (s.id) {
    case "intake": {
      const type = str(r.content_type_label) || run.content_type_label || "Press release";
      const audience = str(r.audience) || run.audience || "";
      return audience ? `${cap(type)} for ${audience}.` : `${cap(type)}.`;
    }
    case "screen":
      return bool(r.escalated)
        ? `Flagged for comms and legal: this news touches ${run.escalation?.category_label || str(r.category) || "a sensitive topic"}.`
        : "Nothing that needs legal first.";
    case "research":
      return `${plural(num(r.sources_read), "source")} read, ${plural(num(r.facts_found), "fact")} found.`;
    case "draft":
      return `${plural(num(r.words), "word")}, ${plural(num(r.quotes_pending), "quote")} for approval.`;
    case "package": {
      const failed = run.package
        ? PACKAGE_PARTS.filter((k) => run.package!.sections[k].state === "failed").length
        : 0;
      return s.state === "partial" && failed
        ? `Package ready, but ${plural(failed, "part")} ${failed === 1 ? "wasn't" : "weren't"} generated.`
        : "Package ready.";
    }
    case "notes": {
      const n = num(r.notes, run.package?.reviewer_notes?.length ?? 0);
      return `${plural(n, "note")} for reviewers.`;
    }
  }
}

/** The sections the package step builds; reviewer notes are their own step. */
const PACKAGE_PARTS: readonly PrPackageSection[] = ["seo", "distribution", "snippets"];

/** Which step rebuilds a package section: notes are their own request. */
export const sectionStep = (section: PrPackageSection): PrStepId => (section === "reviewer_notes" ? "notes" : "package");

/** The six step lines, in order. `inFlight` is the step this browser has
 *  just POSTed: the server still reads it `pending` until the reply lands, and
 *  the line should already say what it is doing. */
export function stepLines(run: PrRun, inFlight: PrStepId | null = null): StepLine[] {
  return run.steps.map((s) => {
    const state = s.id === inFlight && (s.state === "pending" || s.state === "failed") ? "running" : s.state;
    const line: StepLine = { id: s.id, label: STEP_LABEL[s.id], state };
    if (state === "running") line.result = runningText(s.id, run);
    else if (state === "done" || state === "partial") line.result = doneText(s, run);
    else if (state === "failed") line.error = stepErrorText(s.error, s.id);
    return line;
  });
}

/** Research that read fewer than three sources is not a failure, but the draft
 *  leans on the brief, and the reader should know before reading it. */
export function researchPartialNote(run: PrRun): string | null {
  const s = run.steps.find((x) => x.id === "research");
  const r = rec(s?.result);
  if (!s || s.state !== "done" || !bool(r.partial)) return null;
  return `Research found ${plural(num(r.sources_read), "source")}. The draft leans on your brief and the brand card, so more facts will need checking.`;
}

export const isOwner = (run: Pick<PrRun, "viewer_roles" | "owner">, meId: string): boolean =>
  run.viewer_roles.includes("owner") || (!!meId && run.owner.id === meId);

/** The step the owner's browser should POST next on its own, or null.
 *
 *  Only while the run is `writing`, only when the server says this viewer may
 *  run steps (`can.run_steps` is owner-and-next-step), and never a step that
 *  failed: a failure waits for the person to press Try again, so a broken
 *  provider is not billed in a loop. */
export function nextAutoStep(run: PrRun): PrStepId | null {
  if (!run.can.run_steps || !run.next_step || run.status !== "writing") return null;
  const s = run.steps.find((x) => x.id === run.next_step);
  if (!s || s.state === "failed" || s.state === "done") return null;
  return run.next_step;
}

/** The steps that are actually running on the server now. */
export const runningStep = (run: PrRun): PrStepId | null =>
  run.steps.find((s) => s.state === "running")?.id ?? null;

/** What a teammate sees when the owner's browser is not driving the run. */
export function stoppedLine(run: PrRun, meId: string): string | null {
  if (run.status !== "writing" || isOwner(run, meId) || runningStep(run)) return null;
  if (!run.next_step) return null;
  return `Stopped at ${stepWord(run.next_step)}. It carries on when ${run.owner.name} opens it.`;
}

/** Whether teammates' screens should re-read the run on a timer (contract
 *  §5.2: every 15 s while it is writing or paused). */
export const shouldPoll = (status: PrRun["status"]): boolean =>
  status === "writing" || status === "escalated";

export const POLL_MS = 15_000;

/** How long to wait on a `409 step_running` before reading the run again. */
export function retryDelayMs(retryAfterS: unknown): number {
  const s = typeof retryAfterS === "number" && Number.isFinite(retryAfterS) ? retryAfterS : 5;
  return Math.min(30, Math.max(2, s)) * 1000;
}

/* ================================================================== chips == */

export type ChipTone = "brand" | "neutral" | "warn" | "ok" | "danger" | "muted";
export interface Chip { text: string; tone: ChipTone }

export type ChipInput = Pick<PrRunSummary,
  "status" | "needs_you" | "running_step" | "next_step" | "failed_step" | "signoff_summary" | "is_owner">;

/** The drafts list's chip (UX §9; contract §4.1 "Status to UX chip"). When
 *  the run needs this viewer, that is what the chip says — in the brand's
 *  colour — whatever else is true of it. */
export function runChip(r: ChipInput): Chip {
  if (r.needs_you === "details") return { text: "Needs your details", tone: "brand" };
  if (r.needs_you === "clearance") return { text: "Needs your clearance", tone: "brand" };
  if (r.needs_you === "sign_off") return { text: "Needs your sign-off", tone: "brand" };
  switch (r.status) {
    case "writing":
      if (r.running_step || !r.next_step) return { text: "Writing…", tone: "neutral" };
      return {
        text: r.is_owner ? `Stopped at ${stepWord(r.next_step)}: open to continue` : `Stopped at ${stepWord(r.next_step)}`,
        tone: "neutral",
      };
    case "needs_details": return { text: "Waiting for details", tone: "neutral" };
    case "escalated": return { text: "With comms and legal", tone: "warn" };
    case "step_failed": {
      const id = r.failed_step || r.next_step;
      return { text: `${id ? STEP_LABEL[id] : "A step"} failed`, tone: "danger" };
    }
    case "draft": return { text: "Draft", tone: "neutral" };
    case "in_review":
      return {
        text: r.signoff_summary ? `In review: ${r.signoff_summary.signed} of ${r.signoff_summary.total} signed` : "In review",
        tone: "neutral",
      };
    case "changes_asked": return { text: "Changes asked", tone: "warn" };
    case "approved": return { text: "Approved", tone: "ok" };
    case "withdrawn": return { text: "Withdrawn", tone: "muted" };
    case "closed": return { text: "Closed without drafting", tone: "muted" };
    default: return { text: String(r.status || "Draft"), tone: "neutral" };
  }
}

/** The same chip for an open run, read from the full run. */
export function chipInputOf(run: PrRun, meId: string): ChipInput {
  return {
    status: run.status,
    needs_you: run.needs_you,
    running_step: runningStep(run),
    next_step: run.next_step,
    failed_step: run.steps.find((s) => s.state === "failed")?.id ?? null,
    signoff_summary: run.signoffs.version ? run.signoffs.summary : null,
    is_owner: isOwner(run, meId),
  };
}

/* ============================================================ drafts list == */

export interface RunGroups { waiting: PrRunSummary[]; yours: PrRunSummary[]; shared: PrRunSummary[] }

/** UX §9's three groups (contract §5.2): what needs you, what you started,
 *  and what you were added to. Most recently touched first in each. */
export function groupRuns(runs: PrRunSummary[]): RunGroups {
  const sorted = [...runs].sort(byUpdated);
  return {
    waiting: sorted.filter((r) => r.needs_you != null),
    yours: sorted.filter((r) => r.needs_you == null && r.is_owner),
    shared: sorted.filter((r) => r.needs_you == null && !r.is_owner),
  };
}

export const runsFor = (runs: PrRunSummary[], brandId: string): PrRunSummary[] =>
  runs.filter((r) => r.brand_id === brandId);

/** The work bar's muted figure for a brand: what waits on you first, else the
 *  draft count. */
export function brandNote(runs: PrRunSummary[], brandId: string): string {
  const mine = runsFor(runs, brandId);
  const waiting = mine.filter((r) => r.needs_you != null).length;
  return waiting > 0 ? `${waiting.toLocaleString("en-US")} waiting on you` : draftCountLabel(mine.length);
}

/** A row's title: the recommended headline, or the one-sentence news until a
 *  headline exists. */
export const rowTitle = (r: Pick<PrRunSummary, "headline" | "news">): string =>
  (r.headline || "").trim() || r.news;

/** "Press release · You · Oct. 28 · v1.2" — parts that are not known yet are
 *  left out rather than shown as blanks. */
export function rowMeta(r: PrRunSummary): string {
  return [
    r.content_type_label ? cap(r.content_type_label) : "",
    r.is_owner ? "You" : r.owner.name,
    apDate(r.created_at),
    r.current_version ? versionLabel(r.current_version) : "",
  ].filter(Boolean).join(" · ");
}

/* ================================================================ markers == */

export type MarkerSegment =
  | { kind: "text"; text: string }
  | { kind: "verify" | "missing"; token: string; label: string }
  | { kind: "quote"; token: string; label: string; name: string; title: string };

/** `[VERIFY: x]`, `[MISSING: x]` and `[QUOTE – PENDING APPROVAL: Name, Title]`.
 *  The quote marker's dash is an en dash in the contract; a hyphen or an em
 *  dash is read the same, because a model will write either. */
const MARKER_RE = /\[(VERIFY|MISSING):\s*([^\]]*?)\s*\]|\[QUOTE\s*[–—-]\s*PENDING APPROVAL:\s*([^\]]*?)\s*\]/g;

export function splitSpeaker(label: string): { name: string; title: string } {
  const i = label.indexOf(",");
  if (i < 0) return { name: label.trim(), title: "" };
  return { name: label.slice(0, i).trim(), title: label.slice(i + 1).trim() };
}

/** A block's text cut into plain runs and marker tokens, in order. Joining
 *  every segment's text (or token) gives the input back exactly. */
export function parseMarkers(text: string): MarkerSegment[] {
  const out: MarkerSegment[] = [];
  const re = new RegExp(MARKER_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1]) {
      out.push({ kind: m[1] === "VERIFY" ? "verify" : "missing", token: m[0], label: m[2] });
    } else {
      const { name, title } = splitSpeaker(m[3]);
      out.push({ kind: "quote", token: m[0], label: m[3], name, title });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** The server's marker for a token in a block, matched on the exact token. */
export function markerFor(markers: PrMarker[], blockId: string, token: string): PrMarker | undefined {
  return markers.find((m) => m.block_id === blockId && m.token === token);
}

export type MarkerTone = "warn" | "missing" | "quote" | "ok";
export interface MarkerChip { text: string; tone: MarkerTone }

/** A marker's chip. Resolution comes from the server's overlay (`resolved`,
 *  the quote's approval), never from the text, because a locked version keeps
 *  its tokens after a claim is verified. */
export function markerChip(
  seg: Exclude<MarkerSegment, { kind: "text" }>,
  marker?: PrMarker,
  quote?: PrQuote,
): MarkerChip {
  if (seg.kind === "verify") {
    return marker?.resolved ? { text: "Verified", tone: "ok" } : { text: `Verify: ${seg.label}`, tone: "warn" };
  }
  if (seg.kind !== "quote") return { text: `Missing: ${seg.label}`, tone: "missing" };
  const name = quote?.speaker_name || seg.name || "the speaker";
  if (quote?.approval.state === "approved" || (!quote && marker?.resolved)) {
    const at = quote?.approval.at ? `, ${apDate(quote.approval.at)}` : "";
    return { text: `Approved by ${name}${at}`, tone: "ok" };
  }
  return { text: `Waiting for ${name}'s approval`, tone: "quote" };
}

/** "Changed in v1.2. Needs Hamid Kohan's approval again." */
export function quoteResetLine(q: PrQuote): string | null {
  if (!q.reset_in_version || q.approval.state === "approved") return null;
  return `Changed in ${versionLabel(q.reset_in_version)}. Needs ${q.speaker_name}'s approval again.`;
}

/** The toast after a revision that changed a quote's text (its id, so its
 *  approval) — read from the newest version's `quote_resets`. */
export function quoteResetToast(next: Pick<PrRun, "versions" | "current_version">, before: string | null): string | null {
  if (!next.current_version || next.current_version === before) return null;
  const newest = next.versions[next.versions.length - 1];
  const names = (newest?.quote_resets || []).map((q) => q.speaker_name).filter(Boolean);
  if (!names.length) return null;
  if (names.length === 1) return `Quote changed. ${names[0]}'s approval is back to pending.`;
  return `Quotes changed. ${andList(names.map((n) => `${n}'s`))} approvals are back to pending.`;
}

/* ================================================================== cover == */

/** "3 facts to verify, 2 quotes awaiting approval." */
export function coverCounts(m: PrBlockers): string {
  const parts = [
    m.verify ? `${plural(m.verify, "fact")} to verify` : "",
    m.pending_quotes ? `${plural(m.pending_quotes, "quote")} awaiting approval` : "",
    m.missing ? `${plural(m.missing, "detail")} missing` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : "Nothing left to verify or approve.";
}

export interface CoverChip { key: "verify" | "quotes" | "missing"; text: string; tone: "warn" | "neutral" | "missing" }

export function coverChips(m: PrBlockers): CoverChip[] {
  const out: CoverChip[] = [];
  if (m.verify) out.push({ key: "verify", text: `${m.verify} to verify`, tone: "warn" });
  if (m.pending_quotes) out.push({ key: "quotes", text: `${plural(m.pending_quotes, "quote")} pending`, tone: "neutral" });
  if (m.missing) out.push({ key: "missing", text: `${m.missing} missing`, tone: "missing" });
  return out;
}

/** "Press release for Legal Soft. Virtual paralegals now work inside…" */
export function coverStory(run: Pick<PrRun, "content_type_label" | "brand_name">, newsAngle: string): string {
  const type = cap(run.content_type_label || "Press release");
  const first = firstSentence(newsAngle);
  return first ? `${type} for ${run.brand_name}. ${first}` : `${type} for ${run.brand_name}.`;
}

export function firstSentence(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";
  const m = /^.+?[.!?](?=\s|$)/.exec(t);
  return m ? m[0] : t;
}

/** The cover's status pill: "Draft v0.3" / "In review v1.0" / "Approved v2.0". */
export function versionStatusLabel(run: Pick<PrRun, "current_version" | "versions" | "status" | "signoffs">): string | null {
  const v = run.current_version;
  if (!v) return null;
  const summary = run.versions.find((x) => x.version === v);
  if (run.status === "approved" || run.signoffs.approved) return `Approved ${versionLabel(v)}`;
  if (summary?.locked) return `In review ${versionLabel(v)}`;
  return `Draft ${versionLabel(v)}`;
}

/** Why the draft cannot be Approved yet, or null when nothing besides the
 *  sign-offs stands in the way (Rule 3: open [MISSING] markers block too). */
export function blockerSentence(b: PrBlockers): string | null {
  const parts: string[] = [];
  if (b.verify) parts.push(`${plural(b.verify, "fact")} still ${b.verify === 1 ? "needs" : "need"} checking`);
  if (b.pending_quotes) parts.push(`${plural(b.pending_quotes, "quote")} ${b.pending_quotes === 1 ? "is" : "are"} waiting for approval`);
  if (b.missing) parts.push(`${plural(b.missing, "missing detail")} still ${b.missing === 1 ? "needs" : "need"} filling in`);
  if (!parts.length) return null;
  return `This draft can't be marked approved yet: ${andList(parts)}. Clear these before sending for review, so reviewers sign off once.`;
}

/* =============================================================== versions == */

export const versionLabel = (v: string): string => `v${v}`;

/** The label an edit of `v` writes: one minor step on ("1.2" → "1.3",
 *  "1.9" → "1.10"). Labels are strings, never floats. */
export function nextMinorVersion(v: string | null): string {
  const m = /^(\d+)\.(\d+)$/.exec(v || "");
  return m ? `${m[1]}.${Number(m[2]) + 1}` : "0.1";
}

/** Shown in the Mark verified dialog when verifying would start a new review
 *  round: verifying writes a version, and sign-offs attach to a version. */
export function resignWarning(run: Pick<PrRun, "current_version" | "signoffs">): string | null {
  const signed = run.signoffs.rows.some((r) => r.kind === "role" && (r.state === "signed_off" || r.state === "changes_asked"));
  if (!signed) return null;
  return `This creates ${versionLabel(nextMinorVersion(run.current_version))} and asks reviewers to sign off again.`;
}

const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

const asDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/** AP style, local time: "Oct. 28". */
export function apDate(iso: string | null | undefined): string {
  const d = asDate(iso);
  return d ? `${AP_MONTHS[d.getMonth()]} ${d.getDate()}` : "";
}

/** AP style, local time: "3:10 p.m.", "9 a.m.", "noon", "midnight". */
export function apTime(iso: string | null | undefined): string {
  const d = asDate(iso);
  if (!d) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  if (m === 0 && h === 12) return "noon";
  if (m === 0 && h === 0) return "midnight";
  const h12 = h % 12 || 12;
  const mm = m ? `:${String(m).padStart(2, "0")}` : "";
  return `${h12}${mm} ${h < 12 ? "a.m." : "p.m."}`;
}

export function apDateTime(iso: string | null | undefined): string {
  const d = apDate(iso);
  const t = apTime(iso);
  return d && t ? `${d}, ${t}` : d;
}

/** "v1.2 · Oct. 29, 3:10 p.m. · Priya · Tightened the lede…" */
export function versionRow(s: PrVersionSummary): string {
  return [
    versionLabel(s.version),
    apDateTime(s.created_at),
    s.created_by?.name || "PR Writer",
    s.what_changed,
  ].filter(Boolean).join(" · ");
}

/** The banner over an older version, and the way back to the current one. */
export function lockedBanner(viewed: PrVersionSummary, current: string | null): { text: string; link: string | null } {
  const text = viewed.locked
    ? `You're reading ${versionLabel(viewed.version)}, locked when it went for review on ${apDate(viewed.locked_at || viewed.created_at)}. It can't be changed.`
    : `You're reading ${versionLabel(viewed.version)}, an earlier version. It can't be changed.`;
  const link = current && current !== viewed.version ? `Open the current version (${versionLabel(current)})` : null;
  return { text, link };
}

/* =============================================================== sign-off == */

export function signoffRowLabel(row: PrSignoffRow): string {
  if (row.kind === "quote") return row.label;
  const who = row.assignee?.name || (row.fallback ? "workspace admins" : row.unassigned ? "nobody named yet" : "");
  return who ? `${row.label}: ${who}` : row.label;
}

export function signoffStateText(row: PrSignoffRow): string {
  switch (row.state) {
    case "signed_off":
      return [`Signed off${row.version ? ` ${versionLabel(row.version)}` : ""}`, apDate(row.at)].filter(Boolean).join(", ");
    case "changes_asked": return "Asked for changes";
    case "approved": return ["Approved", apDate(row.at)].filter(Boolean).join(", ");
    default: return "Waiting";
  }
}

export type SignoffTone = "neutral" | "ok" | "warn";
export const signoffTone = (row: PrSignoffRow): SignoffTone =>
  row.state === "signed_off" || row.state === "approved" ? "ok" : row.state === "changes_asked" ? "warn" : "neutral";

export const APPROVED_LINE = "Approved for your team to send. PR Writer never sends anything; download the final version.";

/* ============================================================= escalation == */

export type EscalationSeat = "reviewer" | "requester" | "viewer";

/** Which version of the escalation panel this viewer gets. The server's `can`
 *  says what they may do; this only picks the panel. */
export function escalationSeat(run: Pick<PrRun, "can" | "viewer_roles" | "owner">, meId: string): EscalationSeat {
  const c = run.can;
  if (c.clear_escalation || c.keep_paused || c.close_escalation) return "reviewer";
  if (isOwner(run, meId)) return "requester";
  return "viewer";
}

const NOTE_VERB: Record<PrEscalation["notes"][number]["kind"], string> = {
  requester: "Note from",
  keep_paused: "Kept paused by",
  clear: "Cleared by",
  close: "Closed by",
  withdraw: "Withdrawn by",
};

/** "Cleared by Priya, Oct. 28: Legal reviewed the announcement wording." */
export function escalationRecordLine(n: PrEscalation["notes"][number]): string {
  const head = [`${NOTE_VERB[n.kind] || "Note from"} ${n.by.name}`, apDate(n.at)].filter(Boolean).join(", ");
  return n.text.trim() ? `${head}: ${n.text.trim()}` : `${head}.`;
}

/** The toast after a clear. Only the owner's browser runs steps, so a clear by
 *  anyone else does not start drafting; it says when it will. */
export function clearedToast(run: Pick<PrRun, "owner" | "viewer_roles">, meId: string): string {
  return isOwner(run, meId)
    ? "Cleared. Drafting has started."
    : `Cleared. Drafting starts when ${run.owner.name} opens the draft.`;
}

/* ============================================================= brand card == */

export const CARD_SECTIONS: readonly { id: PrCardSection; label: string }[] = [
  { id: "reviewers", label: "Reviewers" },
  { id: "identity", label: "Identity and dateline" },
  { id: "boilerplate", label: "Boilerplate" },
  { id: "messaging", label: "Messaging" },
  { id: "proof_points", label: "Proof points" },
  { id: "spokespeople", label: "Spokespeople" },
  { id: "product_names", label: "Product names" },
  { id: "avoid", label: "Words to avoid and competitor policy" },
  { id: "media_contact", label: "Media contact" },
  { id: "press_kit", label: "Press kit links" },
  { id: "keywords", label: "Priority keywords" },
];

export function emptyCardInput(): PrBrandCardInput {
  return {
    reviewers: { comms_lead: null, brand_owner: null, legal: null },
    identity: { legal_name: "", short_name: "", website: "", newsroom_url: "", hq_city: "", hq_state: "", dateline: "" },
    boilerplate: { text: "" },
    messaging: { mission: "", positioning: "", key_messages: [] },
    proof_points: [],
    spokespeople: [],
    product_names: [],
    avoid: { words: [], competitor_policy: "" },
    media_contact: { name: "", title: "", email: "", phone: "" },
    press_kit: [],
    keywords: [],
  };
}

/** The editor's state from a stored card: reviewers as ids, the boilerplate's
 *  server-stamped approval left behind (it is shown, never edited as text). */
export function cardToInput(card: PrBrandCard | null | undefined): PrBrandCardInput {
  const e = emptyCardInput();
  if (!card) return e;
  const c = rec(card);
  const r = rec(c.reviewers);
  const id = (v: unknown) => user(v)?.id ?? null;
  const strs = (v: unknown) => arr(v, (x) => str(x));
  const objs = <K extends string>(v: unknown, keys: readonly K[]) =>
    arr(v, (x) => Object.fromEntries(keys.map((k) => [k, str(rec(x)[k])])) as Record<K, string>);
  const fill = <T extends Record<string, string>>(base: T, v: unknown): T => {
    const o = rec(v);
    const out = { ...base };
    for (const k of Object.keys(base) as (keyof T)[]) out[k] = str(o[k as string]) as T[keyof T];
    return out;
  };
  const msg = rec(c.messaging);
  const avoid = rec(c.avoid);
  return {
    reviewers: { comms_lead: id(r.comms_lead), brand_owner: id(r.brand_owner), legal: id(r.legal) },
    identity: fill(e.identity, c.identity),
    boilerplate: { text: str(rec(c.boilerplate).text) },
    messaging: { mission: str(msg.mission), positioning: str(msg.positioning), key_messages: strs(msg.key_messages) },
    proof_points: objs(c.proof_points, ["claim", "source", "date"] as const),
    spokespeople: objs(c.spokespeople, ["name", "title", "topics", "quote_style", "approval_contact"] as const),
    product_names: strs(c.product_names),
    avoid: { words: strs(avoid.words), competitor_policy: str(avoid.competitor_policy) },
    media_contact: fill(e.media_contact, c.media_contact),
    press_kit: objs(c.press_kit, ["label", "url"] as const),
    keywords: strs(c.keywords),
  };
}

/** What is sent on save: text trimmed, blank list entries and blank rows
 *  dropped, at most three key messages. */
export function cleanCardInput(input: PrBrandCardInput): PrBrandCardInput {
  const t = (s: string) => s.trim();
  const list = (a: string[]) => a.map(t).filter(Boolean);
  const rows = <T extends Record<string, string>>(a: T[]) =>
    a.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, t(v)])) as T)
      .filter((r) => Object.values(r).some(Boolean));
  const obj = <T extends Record<string, string>>(o: T) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, t(v)])) as T;
  return {
    reviewers: { ...input.reviewers },
    identity: obj(input.identity),
    boilerplate: { text: t(input.boilerplate.text) },
    messaging: {
      mission: t(input.messaging.mission),
      positioning: t(input.messaging.positioning),
      key_messages: list(input.messaging.key_messages).slice(0, 3),
    },
    proof_points: rows(input.proof_points),
    spokespeople: rows(input.spokespeople),
    product_names: list(input.product_names),
    avoid: { words: list(input.avoid.words), competitor_policy: t(input.avoid.competitor_policy) },
    media_contact: obj(input.media_contact),
    press_kit: rows(input.press_kit),
    keywords: list(input.keywords),
  };
}

/** Whether a save changes the boilerplate text (Rule 4: it then needs who
 *  approved it and when). */
export const boilerplateChanged = (base: PrBrandCardInput, mine: PrBrandCardInput): boolean =>
  base.boilerplate.text.trim() !== mine.boilerplate.text.trim();

export interface MergeConflict { path: string; mine: unknown; theirs: unknown }

const isPlain = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Per-field three-way merge for the stale-card case (UX §8).
 *
 *  `base` is what the editor loaded, `mine` the unsaved edits, `theirs` the
 *  card someone else saved since. Objects merge field by field; a list or a
 *  text is one field. A field only one side changed takes that side; a field
 *  both changed the same way is that value; a field both changed differently
 *  takes theirs and is reported, so the editor can show "Your unsaved text"
 *  beside it for the reader to copy back. */
export function mergeThreeWay<T>(base: T, mine: T, theirs: T): { merged: T; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];
  const walk = (b: unknown, m: unknown, t: unknown, path: string): unknown => {
    if (isPlain(m) && isPlain(t)) {
      const bo = isPlain(b) ? b : {};
      const out: Rec = {};
      for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
        out[k] = walk(bo[k], m[k], t[k], path ? `${path}.${k}` : k);
      }
      return out;
    }
    if (same(m, b)) return t;
    if (same(t, b) || same(m, t)) return m;
    conflicts.push({ path, mine: m, theirs: t });
    return t;
  };
  return { merged: walk(base, mine, theirs, "") as T, conflicts };
}

/** A conflicting value as text the reader can copy. */
export function conflictText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v.map((x) => (isPlain(x) ? Object.values(x).filter(Boolean).join(" · ") : String(x))).join("\n");
  }
  return JSON.stringify(v);
}

export function cardStoryLine(brandName: string, complete: number, total = CARD_SECTIONS.length): string {
  return `${brandName}'s card is ${complete} of ${total} sections complete. Missing sections show as [VERIFY] in every draft.`;
}

/** "Priya saved this card at 3:42 p.m., after you opened it. Your changes
 *  aren't saved yet." — from the 409's `current` card. */
export function staleCardMessage(current: Pick<PrBrandCardResponse, "updated_by" | "updated_at">): string {
  const who = current.updated_by?.name || "Someone";
  const at = apTime(current.updated_at);
  return `${who} saved this card${at ? ` at ${at}` : ""}, after you opened it. Your changes aren't saved yet.`;
}

export function normaliseCard(v: unknown): PrBrandCardResponse {
  const o = rec(v);
  const sections = rec(o.sections);
  const out: PrBrandCardResponse["sections"] = {};
  for (const s of CARD_SECTIONS) out[s.id] = bool(sections[s.id]);
  return {
    brand_id: str(o.brand_id), brand_name: str(o.brand_name),
    exists: bool(o.exists), revision: num(o.revision),
    updated_at: strOrNull(o.updated_at), updated_by: user(o.updated_by),
    can_edit: bool(o.can_edit), sections: out,
    card: o.card && typeof o.card === "object" ? (o.card as PrBrandCard) : null,
  };
}

/** One line under a closed card group, so the card reads without opening it. */
export function sectionSummary(
  id: PrCardSection,
  c: PrBrandCardInput,
  nameOf: (userId: string | null) => string,
): string {
  const n = (a: unknown[], one: string) => (a.length ? plural(a.length, one) : "None yet");
  switch (id) {
    case "reviewers":
      return `Comms lead: ${nameOf(c.reviewers.comms_lead)} · Brand owner: ${nameOf(c.reviewers.brand_owner)} · Legal: ${nameOf(c.reviewers.legal)}`;
    case "identity": return [c.identity.legal_name, c.identity.dateline].filter(Boolean).join(" · ") || "Not filled in";
    case "boilerplate": return c.boilerplate.text ? firstSentence(c.boilerplate.text) : "Not written yet";
    case "messaging": return c.messaging.positioning || "Not filled in";
    case "proof_points": return n(c.proof_points, "proof point");
    case "spokespeople": return c.spokespeople.length ? andList(c.spokespeople.map((s) => s.name).filter(Boolean)) || n(c.spokespeople, "spokesperson") : "None yet";
    case "product_names": return c.product_names.filter(Boolean).join(", ") || "None yet";
    case "avoid": return n(c.avoid.words.filter(Boolean), "word");
    case "media_contact": return [c.media_contact.name, c.media_contact.email].filter(Boolean).join(" · ") || "Not filled in";
    case "press_kit": return n(c.press_kit, "link");
    case "keywords": return c.keywords.filter(Boolean).join(", ") || "None yet";
  }
}

/* ================================================================= export == */

const slug = (s: string): string =>
  s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s-]+/g, "-").slice(0, 40) || "draft";

/** The download's name when the server's `Content-Disposition` did not come
 *  through: `<Brand>_<ContentType>_v<version>.<ext>`. */
export function exportFilename(run: Pick<PrRun, "brand_name" | "content_type_label">, version: string, format: "docx" | "md"): string {
  return `${slug(run.brand_name)}_${slug(run.content_type_label || "PR draft")}_v${version}.${format}`;
}
