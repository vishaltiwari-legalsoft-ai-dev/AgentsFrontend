import { describe, expect, it } from "vitest";
import type { PrBrand, PrBrandCard, PrRunSummary, PrSignoffRow } from "@/lib/api";
import { dispositionFilename } from "../../../lib/api";
import {
  CARD_SECTIONS, FAILURE_CAUSE, MODEL_UNAVAILABLE_TEXT, NOT_STARTED, NO_CAN, SEARCH_UNAVAILABLE_TEXT,
  actionErrorText, createErrorText, nextMinorVersion, resignWarning, sectionStep,
  CANNOT_ASSIGN_REVIEWERS, speakerName, CLARIFY_SCREEN_FAILED, LEGAL_SAME_AS_COMMS, cardSaveError, cardToSend,
  apDate, apDateTime, apTime, blockerSentence, boilerplateChanged, brandNote, cardStoryLine, cardToInput,
  chipInputOf, cleanCardInput, clearedToast, conflictText, coverChips, coverCounts, coverStory, defaultBrand,
  emptyCardInput, escalationRecordLine, escalationSeat, exportFilename, firstSentence, groupRuns, isPrRunId,
  lockedBanner, markerChip, markerFor, mergeThreeWay, nextAutoStep, normaliseBrand, normaliseCard,
  normaliseRun, normaliseSummary, normaliseVersion, parseMarkers, parseView, quoteResetLine, quoteResetToast,
  readRoute, readVersionParam, researchPartialNote, retryDelayMs, rowMeta, rowTitle, runChip, sectionOf,
  sectionSummary, shouldPoll, signoffRowLabel, signoffStateText, splitSpeaker, staleCardMessage, stepErrorText,
  stepLines, stoppedLine, versionLabel, versionRow, versionStatusLabel, viewSegment, withVersionParam,
  BOILERPLATE_APPROVAL_HINT, BRAND_DOMAIN_MISSING, CANNOT_FILL_CARD, MEDIA_CONTACT_HINT, NOTHING_FOUND_ON_SITE,
  SITE_UNREADABLE, SUGGEST_SECTIONS,
  applySuggestions, confidenceOf, fillFromBody, fillFromLabel, normaliseSuggestions, readingSiteText, sectionFilled,
  sourceHost, suggestBanner, suggestChipLabel, suggestErrorText, takeSuggestion,
  type ChipInput,
} from "./pr";

/* The route, the chips, the markers and the card merge are the decisions the
 * PR Writer's screens stand on. These pin them against the contract
 * (docs/pr-writer-api.md) and the UX spec's exact copy. Times are built from
 * local Date parts so the AP formatting holds in any timezone. */

const ME = "u-me";
const PRIYA = { id: "u-priya", name: "Priya" };
const HAMID = { id: "u-hamid", name: "Hamid Kohan" };
const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

const brand = (id: string, name = id): PrBrand => ({
  id, name, domain: `${id}.com`, has_card: true, card_sections_complete: 4, card_sections_total: 11,
});
const BRANDS = [brand("legalsoft", "Legal Soft"), brand("acme", "Acme")];

const summary = (over: Partial<PrRunSummary> & { id: string }): PrRunSummary =>
  normaliseSummary({
    brand_id: "legalsoft", brand_name: "Legal Soft", news: `news of ${over.id}`,
    owner: { id: ME, name: "Me" }, is_owner: true,
    created_at: "2026-10-27T10:00:00Z", updated_at: "2026-10-27T10:00:00Z",
    status: "draft", ...over,
  });

/** A run as the server sends it, minimally — `normaliseRun` fills the rest. */
const rawRun = (over: Record<string, unknown> = {}) => ({
  id: "pr-3f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
  brand_id: "legalsoft",
  brand_name: "Legal Soft",
  brand_domain: "legalsoft.com",
  news: "Legal Soft's virtual paralegals now work inside a firm's practice management system, live Nov. 12.",
  owner: { id: ME, name: "Me" },
  status: "writing",
  next_step: "intake",
  viewer_role: "owner",
  viewer_roles: ["owner"],
  can: { run_steps: true, export: true },
  ...over,
});

/* ================================================================== route == */

describe("the route", () => {
  it("reads drafts by default, write, card, and a pr- segment as a run", () => {
    expect(parseView("")).toEqual({ kind: "drafts" });
    expect(parseView("drafts")).toEqual({ kind: "drafts" });
    expect(parseView("nonsense")).toEqual({ kind: "drafts" });
    expect(parseView("write")).toEqual({ kind: "write" });
    expect(parseView("card")).toEqual({ kind: "card" });
    expect(parseView("pr-3f9a0b1c2d3e")).toEqual({ kind: "run", runId: "pr-3f9a0b1c2d3e" });
    // The implemented ids carry 32 hex.
    const long = "pr-3f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c";
    expect(parseView(long)).toEqual({ kind: "run", runId: long });
  });

  it("writes a view back as the segment it was read from", () => {
    for (const s of ["drafts", "write", "card", "pr-abc123"]) expect(viewSegment(parseView(s))).toBe(s);
  });

  it("lights Drafts in the rail while a run is open", () => {
    expect(sectionOf({ kind: "run", runId: "pr-x1" })).toBe("drafts");
    expect(sectionOf({ kind: "card" })).toBe("card");
    expect(sectionOf({ kind: "write" })).toBe("write");
  });

  it("knows a run id from a brand id", () => {
    expect(isPrRunId("pr-3f9a0b1c2d3e")).toBe(true);
    expect(isPrRunId("legalsoft")).toBe(false);
    expect(isPrRunId("bw-topic-abc123")).toBe(false);
    expect(isPrRunId("pr-")).toBe(false);
  });

  it("opens a bare link on the brand of the viewer's most recent own run", () => {
    const runs = [
      summary({ id: "pr-1", brand_id: "legalsoft", updated_at: "2026-10-01T00:00:00Z" }),
      summary({ id: "pr-2", brand_id: "acme", updated_at: "2026-10-20T00:00:00Z" }),
      summary({ id: "pr-3", brand_id: "legalsoft", is_owner: false, updated_at: "2026-10-26T00:00:00Z" }),
    ];
    expect(defaultBrand(BRANDS, runs)).toBe("acme");
    expect(defaultBrand(BRANDS, [])).toBe("legalsoft");
    expect(defaultBrand([], runs)).toBe("");
  });

  it("puts an open run under its own brand, whatever the link says", () => {
    const runs = [summary({ id: "pr-a1", brand_id: "acme" })];
    expect(readRoute("legalsoft", "pr-a1", BRANDS, runs)).toEqual({ brandId: "acme", view: { kind: "run", runId: "pr-a1" } });
    // A run the list does not carry yet (just created) is placed by the run itself.
    expect(readRoute("legalsoft", "pr-new1", BRANDS, [], { id: "pr-new1", brand_id: "acme" }).brandId).toBe("acme");
    expect(readRoute("nope", "card", BRANDS, []).brandId).toBe("legalsoft");
  });

  it("reads and writes the older-version query without touching the route", () => {
    expect(readVersionParam("#/w/pr/legalsoft/pr-a1?v=1.0")).toBe("1.0");
    expect(readVersionParam("#/w/pr/legalsoft/pr-a1?v=1.12")).toBe("1.12");
    expect(readVersionParam("#/w/pr/legalsoft/pr-a1")).toBeNull();
    expect(readVersionParam("#/w/pr/legalsoft/pr-a1?v=latest")).toBeNull();
    expect(withVersionParam("#/w/pr/legalsoft/pr-a1", "1.0")).toBe("#/w/pr/legalsoft/pr-a1?v=1.0");
    expect(withVersionParam("#/w/pr/legalsoft/pr-a1?v=1.0", null)).toBe("#/w/pr/legalsoft/pr-a1");
    expect(withVersionParam("#/w/pr/legalsoft/pr-a1?v=0.2", "1.1")).toBe("#/w/pr/legalsoft/pr-a1?v=1.1");
  });
});

/* ============================================================ normalising == */

describe("reading a reply from a backend a deploy behind or ahead", () => {
  it("fills every container a screen iterates, with six steps in pipeline order", () => {
    const run = normaliseRun({ id: "pr-1", status: "writing", steps: [{ id: "research", state: "running" }] });
    expect(run.steps.map((s) => s.id)).toEqual(["intake", "screen", "research", "draft", "package", "notes"]);
    expect(run.steps.map((s) => s.state)).toEqual(["pending", "pending", "running", "pending", "pending", "pending"]);
    expect(run.signoffs.can_approve).toBe(false);
    expect(run.can).toEqual(NO_CAN);
    expect(run.versions).toEqual([]);
    expect(run.participants).toEqual([]);
    expect(run.markers).toEqual({ verify: 0, missing: 0, pending_quotes: 0 });
    expect(run.signoffs.rows).toEqual([]);
    expect(run.signoffs.summary).toEqual({ signed: 0, total: 0 });
    expect(run.draft).toBeNull();
    expect(run.package).toBeNull();
    expect(run.viewer_roles).toEqual(["participant"]);
  });

  it("keeps a `can` flag only when it is literally true", () => {
    const run = normaliseRun(rawRun({ can: { run_steps: true, revise: "yes", export: 1 } }));
    expect(run.can.run_steps).toBe(true);
    expect(run.can.revise).toBe(false);
    expect(run.can.export).toBe(false);
  });

  it("reads a package section the reply does not mention as not built yet", () => {
    const run = normaliseRun(rawRun({
      package: {
        sections: { seo: { state: "done" }, snippets: { state: "failed", error: "x" } },
        seo: { primary_keyword: "ai paralegal", internal_links: [{ url: "/a", anchor: "A" }] },
        distribution: { channels: [{ channel: "Trade press" }] },
      },
    }));
    expect(run.package?.sections.seo.state).toBe("done");
    expect(run.package?.sections.snippets.state).toBe("failed");
    expect(run.package?.sections.distribution.state).toBe("pending");
    expect(run.package?.sections.reviewer_notes.state).toBe("pending");
    expect(run.package?.seo?.secondary_keywords).toEqual([]);
    expect(run.package?.seo?.internal_links).toEqual([{ url: "/a", anchor: "A" }]);
    expect(run.package?.distribution?.channels[0].outlet_examples).toEqual([]);
    expect(run.package?.distribution?.wire).toEqual({ recommended: false, circuit: "", timing: "", notes: "" });
    expect(run.package?.snippets).toBeNull();
  });

  it("reads which blocks are revisable, and which claims are placeholders, with the server's rule as default", () => {
    const v = normaliseVersion({
      blocks: [{ id: "b1", kind: "lede" }, { id: "headline" }, { id: "boilerplate-1", revisable: false }, { id: "b2", revisable: false }],
      claims: [{ id: "c-1", text: "[VERIFY: customer count]" }, { id: "c-2", text: "500 firms use it.", placeholder: false }],
      quotes: [{ id: "b3", text_hash: "h1" }],
    });
    expect(v.blocks.map((b) => b.revisable)).toEqual([true, false, false, false]);
    expect(v.claims.map((c) => c.placeholder)).toEqual([true, false]);
    expect(v.quotes[0].text_hash).toBe("h1");
    expect(normaliseVersion({ quotes: [{ id: "b3" }] }).quotes[0].text_hash).toBe("");
  });

  it("gives a version's lists and a headline's character count defaults", () => {
    const v = normaliseVersion({ version: "0.1", headlines: [{ text: "Twelve chars", recommended: true }] });
    expect(v.headlines[0]).toEqual({ text: "Twelve chars", chars: 12, recommended: true });
    expect(v.blocks).toEqual([]);
    expect(v.claims).toEqual([]);
    expect(v.subheadline).toEqual({ recommended: "", alternate: "" });
  });

  it("reads a summary and a brand with their defaults", () => {
    const s = normaliseSummary({ id: "pr-1", created_at: "2026-10-01T00:00:00Z" });
    expect(s.updated_at).toBe("2026-10-01T00:00:00Z");
    expect(s.needs_you).toBeNull();
    expect(s.signoff_summary).toBeNull();
    const b = normaliseBrand({ id: "acme" });
    expect(b).toEqual({ id: "acme", name: "acme", domain: "", has_card: false, card_sections_complete: 0, card_sections_total: 11 });
  });

  it("reads a card reply with every section's flag", () => {
    const c = normaliseCard({ brand_id: "acme", exists: false, sections: { reviewers: true } });
    expect(c.revision).toBe(0);
    expect(c.card).toBeNull();
    expect(Object.keys(c.sections)).toHaveLength(11);
    expect(c.sections.reviewers).toBe(true);
    expect(c.sections.keywords).toBe(false);
  });
});

/* ================================================================== steps == */

describe("step lines", () => {
  it("say what each step is doing while it runs", () => {
    const run = normaliseRun(rawRun({
      steps: [
        { id: "intake", state: "done", result: { content_type: "product_launch", content_type_label: "Product launch", audience: "law firm partners" } },
        { id: "screen", state: "done", result: { escalated: false, category: null } },
        { id: "research", state: "running" },
      ],
    }));
    const lines = stepLines(run);
    expect(lines[0]).toMatchObject({ label: "Intake", state: "done", result: "Product launch for law firm partners." });
    expect(lines[1].result).toBe("Nothing that needs legal first.");
    expect(lines[2].result).toBe("Researching the brand card, legalsoft.com and public sources");
    expect(lines[3]).toEqual({ id: "draft", label: "Draft", state: "pending" });
  });

  it("show the step this browser just posted as running before the reply lands", () => {
    const run = normaliseRun(rawRun());
    expect(stepLines(run, "intake")[0]).toMatchObject({ state: "running", result: "Reading the brief" });
    expect(stepLines(run, "screen")[1].result).toBe("Checking for topics that need legal first");
  });

  it("count what research and drafting produced, in the spec's words", () => {
    const run = normaliseRun(rawRun({
      steps: [
        { id: "research", state: "done", result: { sources_read: 7, facts_found: 1, partial: false } },
        { id: "draft", state: "done", result: { version: "0.1", words: 512, quotes_pending: 2 } },
        { id: "package", state: "done" },
        { id: "notes", state: "done", result: { notes: 4 } },
      ],
    }));
    const lines = stepLines(run);
    expect(lines[2].result).toBe("7 sources read, 1 fact found.");
    expect(lines[3].result).toBe("512 words, 2 quotes for approval.");
    expect(lines[4].result).toBe("Package ready.");
    expect(lines[5]).toMatchObject({ label: "Notes", state: "done", result: "4 notes for reviewers." });
  });

  it("say what the notes step is doing, and count one note in the singular", () => {
    const running = normaliseRun(rawRun({ steps: [{ id: "notes", state: "running" }] }));
    expect(stepLines(running)[5].result).toBe("Writing reviewer notes");
    const one = normaliseRun(rawRun({ steps: [{ id: "notes", state: "done", result: { notes: 1 } }] }));
    expect(stepLines(one)[5].result).toBe("1 note for reviewers.");
  });

  it("count the package parts that failed, leaving reviewer notes to their own step", () => {
    const run = normaliseRun(rawRun({
      steps: [{ id: "package", state: "partial" }],
      package: { sections: { seo: { state: "done" }, distribution: { state: "failed" }, snippets: { state: "done" } } },
    }));
    expect(stepLines(run)[4].result).toBe("Package ready, but 1 part wasn't generated.");
    expect(sectionStep("reviewer_notes")).toBe("notes");
    expect(sectionStep("seo")).toBe("package");
  });

  it("say each failure honestly, and never claim nothing was drafted once a draft exists", () => {
    const err = (code: string, message = "provider said something") => ({ code, message, at: "", attempts: 1 });
    // A 424 is a bad key, a rate limit or an outage as often as an empty
    // account: the server's own sentence, else a cause that claims none.
    expect(stepErrorText(err("search_unavailable", "The search key was rejected. An admin needs to replace it."), "research"))
      .toBe("The search key was rejected. An admin needs to replace it.");
    expect(stepErrorText(err("search_unavailable", ""), "research")).toBe(SEARCH_UNAVAILABLE_TEXT);
    expect(SEARCH_UNAVAILABLE_TEXT).toBe(
      "Research couldn't run: the web search service refused the request. Nothing was drafted. An admin needs to check it.",
    );
    expect(SEARCH_UNAVAILABLE_TEXT).not.toContain("credit");
    expect(stepErrorText(err("model_unavailable"), "draft")).toBe(MODEL_UNAVAILABLE_TEXT);
    expect(MODEL_UNAVAILABLE_TEXT).toBe("The writing model isn't available right now. Nothing was drafted.");
    expect(stepErrorText(err("model_unavailable"), "package")).toBe("The writing model isn't available right now. The draft is saved.");
    expect(stepErrorText(err("model_truncated"), "draft"))
      .toBe("The writing model's answer was cut off before it finished. Your brief and earlier steps are saved.");
    expect(stepErrorText(err("model_refused"), "notes")).toBe("The writing model declined to write this. The draft is saved.");
    expect(stepErrorText(err("model_output_invalid"), "research"))
      .toBe("The writing model's answer wasn't usable, even after one repair. Your brief and earlier steps are saved.");
    expect(stepErrorText(err("screen_failed"), "screen"))
      .toBe("The check for topics that need legal first couldn't run, so nothing goes ahead until it does. Try the screen again.");
    expect(stepErrorText(err("model_timeout"), "draft")).toBe("The writing model ran out of time. Your brief and earlier steps are saved.");
    // A code this build does not know yet: the server's own sentence.
    expect(stepErrorText(err("brand_new_code", "The server's sentence."), "draft")).toBe("The server's sentence.");
    // No provider text reaches the screen for a known code (search keeps the
    // server's own sentence, which the contract makes safe to show).
    for (const code of Object.keys(FAILURE_CAUSE).filter((c) => c !== "search_unavailable")) {
      expect(stepErrorText(err(code), "draft")).not.toContain("provider said something");
    }
    const run = normaliseRun(rawRun({ status: "step_failed", next_step: "research", steps: [{ id: "research", state: "failed", error: { code: "search_unavailable", message: "" } }] }));
    expect(stepLines(run)[2]).toMatchObject({ state: "failed", error: SEARCH_UNAVAILABLE_TEXT });
  });

  it("warn when research read fewer than three sources, and only then", () => {
    const thin = normaliseRun(rawRun({ steps: [{ id: "research", state: "done", result: { sources_read: 2, facts_found: 3, partial: true } }] }));
    expect(researchPartialNote(thin)).toBe(
      "Research found 2 sources. The draft leans on your brief and the brand card, so more facts will need checking.",
    );
    const full = normaliseRun(rawRun({ steps: [{ id: "research", state: "done", result: { sources_read: 9, facts_found: 12, partial: false } }] }));
    expect(researchPartialNote(full)).toBeNull();
  });
});

describe("who drives the steps", () => {
  it("runs the next step on its own only for the owner, while writing", () => {
    expect(nextAutoStep(normaliseRun(rawRun()))).toBe("intake");
    // A teammate: the server says no.
    expect(nextAutoStep(normaliseRun(rawRun({ can: { run_steps: false } })))).toBeNull();
    // Paused, or waiting on details: never.
    expect(nextAutoStep(normaliseRun(rawRun({ status: "escalated" })))).toBeNull();
    expect(nextAutoStep(normaliseRun(rawRun({ status: "needs_details", next_step: "research" })))).toBeNull();
    expect(nextAutoStep(normaliseRun(rawRun({ next_step: null })))).toBeNull();
  });

  it("never retries a failed step without the person pressing Try again", () => {
    const failed = normaliseRun(rawRun({ status: "writing", next_step: "draft", steps: [{ id: "draft", state: "failed" }] }));
    expect(nextAutoStep(failed)).toBeNull();
  });

  it("tells a teammate where the run stopped and who carries it on", () => {
    const run = normaliseRun(rawRun({ next_step: "research", owner: PRIYA, viewer_role: "legal", viewer_roles: ["legal"], can: {} }));
    expect(stoppedLine(run, ME)).toBe("Stopped at research. It carries on when Priya opens it.");
    expect(stoppedLine(normaliseRun(rawRun()), ME)).toBeNull();
    const live = normaliseRun(rawRun({ owner: PRIYA, viewer_roles: ["legal"], steps: [{ id: "intake", state: "running" }] }));
    expect(stoppedLine(live, ME)).toBeNull();
  });

  it("polls only while writing or paused, and waits a sane time on a busy step", () => {
    expect(shouldPoll("writing")).toBe(true);
    expect(shouldPoll("escalated")).toBe(true);
    expect(shouldPoll("in_review")).toBe(false);
    expect(retryDelayMs(8)).toBe(8000);
    expect(retryDelayMs(undefined)).toBe(5000);
    expect(retryDelayMs(600)).toBe(30000);
    expect(retryDelayMs(0)).toBe(2000);
  });
});

/* ================================================================== chips == */

describe("the drafts list's chip", () => {
  const chip = (over: Partial<ChipInput>) => runChip({
    status: "draft", needs_you: null, running_step: null, next_step: null, failed_step: null,
    signoff_summary: null, is_owner: true, ...over,
  });

  it("says what the run needs from you first, in the brand's colour", () => {
    expect(chip({ status: "needs_details", needs_you: "details" })).toEqual({ text: "Needs your details", tone: "brand" });
    expect(chip({ status: "escalated", needs_you: "clearance" })).toEqual({ text: "Needs your clearance", tone: "brand" });
    expect(chip({ status: "in_review", needs_you: "sign_off" })).toEqual({ text: "Needs your sign-off", tone: "brand" });
    expect(chip({ status: "changes_asked", needs_you: "sign_off" })).toEqual({ text: "Needs your sign-off", tone: "brand" });
  });

  it("says writing only while a step is actually running", () => {
    expect(chip({ status: "writing", running_step: "draft", next_step: "draft" })).toEqual({ text: "Writing…", tone: "neutral" });
    expect(chip({ status: "writing", next_step: "research" }).text).toBe("Stopped at research: open to continue");
    expect(chip({ status: "writing", next_step: "research", is_owner: false }).text).toBe("Stopped at research");
  });

  it("maps every other status to the spec's chip and tone", () => {
    expect(chip({ status: "escalated" })).toEqual({ text: "With comms and legal", tone: "warn" });
    expect(chip({ status: "step_failed", failed_step: "research" })).toEqual({ text: "Research failed", tone: "danger" });
    expect(chip({ status: "draft" })).toEqual({ text: "Draft", tone: "neutral" });
    expect(chip({ status: "in_review", signoff_summary: { signed: 2, total: 5 } })).toEqual({ text: "In review: 2 of 5 signed", tone: "neutral" });
    expect(chip({ status: "changes_asked" })).toEqual({ text: "Changes asked", tone: "warn" });
    expect(chip({ status: "approved" })).toEqual({ text: "Approved", tone: "ok" });
    expect(chip({ status: "withdrawn" })).toEqual({ text: "Withdrawn", tone: "muted" });
    expect(chip({ status: "closed" })).toEqual({ text: "Closed without drafting", tone: "muted" });
  });

  it("reads the same chip off a full run", () => {
    const run = normaliseRun(rawRun({ status: "step_failed", next_step: "draft", steps: [{ id: "draft", state: "failed" }] }));
    expect(runChip(chipInputOf(run, ME))).toEqual({ text: "Draft failed", tone: "danger" });
  });
});

describe("the drafts list", () => {
  it("groups waiting on you, yours, and shared with you, latest first", () => {
    const runs = [
      summary({ id: "pr-a", updated_at: "2026-10-01T00:00:00Z" }),
      summary({ id: "pr-b", is_owner: false, updated_at: "2026-10-03T00:00:00Z" }),
      summary({ id: "pr-c", is_owner: false, needs_you: "sign_off", updated_at: "2026-10-02T00:00:00Z" }),
      summary({ id: "pr-d", updated_at: "2026-10-04T00:00:00Z" }),
      summary({ id: "pr-e", needs_you: "details", updated_at: "2026-10-05T00:00:00Z" }),
    ];
    const g = groupRuns(runs);
    expect(g.waiting.map((r) => r.id)).toEqual(["pr-e", "pr-c"]);
    expect(g.yours.map((r) => r.id)).toEqual(["pr-d", "pr-a"]);
    expect(g.shared.map((r) => r.id)).toEqual(["pr-b"]);
  });

  it("notes what waits on you in the work bar before the draft count", () => {
    const runs = [
      summary({ id: "pr-a" }), summary({ id: "pr-b", needs_you: "clearance" }),
      summary({ id: "pr-c", needs_you: "sign_off" }), summary({ id: "pr-d", brand_id: "acme" }),
    ];
    expect(brandNote(runs, "legalsoft")).toBe("2 waiting on you");
    expect(brandNote(runs, "acme")).toBe("1 draft");
    expect(brandNote(runs, "nobody")).toBe("No drafts");
  });

  it("titles a row by its headline, or the news until there is one", () => {
    expect(rowTitle({ headline: "Legal Soft puts paralegals inside the PMS", news: "n" })).toBe("Legal Soft puts paralegals inside the PMS");
    expect(rowTitle({ headline: null, news: "One sentence of news." })).toBe("One sentence of news.");
    expect(rowTitle({ headline: "  ", news: "One sentence of news." })).toBe("One sentence of news.");
  });

  it("writes the row's meta line, leaving out what is not known yet", () => {
    const created = local(2026, 10, 28, 9, 0);
    expect(rowMeta(summary({ id: "pr-a", content_type_label: "press release", current_version: "1.2", created_at: created })))
      .toBe("Press release · You · Oct. 28 · v1.2");
    expect(rowMeta(summary({ id: "pr-b", is_owner: false, owner: PRIYA, created_at: created })))
      .toBe("Priya · Oct. 28");
  });
});

/* ================================================================ markers == */

describe("inline markers", () => {
  it("cuts a block into text and the three marker kinds, losslessly", () => {
    const text = "The firm serves [VERIFY: customer count from Priya] firms. Boilerplate: [MISSING: boilerplate]. "
      + "[QUOTE – PENDING APPROVAL: Hamid Kohan, CEO]";
    const segs = parseMarkers(text);
    expect(segs.map((s) => s.kind)).toEqual(["text", "verify", "text", "missing", "text", "quote"]);
    expect(segs[1]).toEqual({ kind: "verify", token: "[VERIFY: customer count from Priya]", label: "customer count from Priya" });
    expect(segs[3]).toMatchObject({ kind: "missing", label: "boilerplate" });
    expect(segs[5]).toEqual({
      kind: "quote", token: "[QUOTE – PENDING APPROVAL: Hamid Kohan, CEO]", label: "Hamid Kohan, CEO",
      name: "Hamid Kohan", title: "CEO",
    });
    expect(segs.map((s) => (s.kind === "text" ? s.text : s.token)).join("")).toBe(text);
  });

  it("reads a quote marker written with a hyphen or an em dash too", () => {
    expect(parseMarkers("[QUOTE - PENDING APPROVAL: Ana Ruiz, VP Sales]")[0]).toMatchObject({ kind: "quote", name: "Ana Ruiz" });
    expect(parseMarkers("[QUOTE — PENDING APPROVAL: Ana Ruiz]")[0]).toMatchObject({ kind: "quote", name: "Ana Ruiz", title: "" });
  });

  it("leaves text with no markers, or a lookalike, as one text run", () => {
    expect(parseMarkers("Plain [note] text.")).toEqual([{ kind: "text", text: "Plain [note] text." }]);
    expect(parseMarkers("")).toEqual([]);
  });

  it("splits a speaker at the first comma only", () => {
    expect(splitSpeaker("Hamid Kohan, CEO, Legal Soft")).toEqual({ name: "Hamid Kohan", title: "CEO, Legal Soft" });
  });

  it("reads a pending quote whose speaker is still a placeholder as one marker, with no stray bracket", () => {
    const token = "[QUOTE – PENDING APPROVAL: [VERIFY: spokesperson name], [VERIFY: exact title]]";
    const text = `"We built this for firms," the spokesperson said.\n${token} Then more text.`;
    const segs = parseMarkers(text);
    expect(segs.map((s) => s.kind)).toEqual(["text", "quote", "text"]);
    expect(segs[1]).toEqual({
      kind: "quote", token, label: "[VERIFY: spokesperson name], [VERIFY: exact title]",
      name: "[VERIFY: spokesperson name]", title: "[VERIFY: exact title]",
    });
    expect(segs[2]).toEqual({ kind: "text", text: " Then more text." });
    expect(segs.map((s) => (s.kind === "text" ? s.text : s.token)).join("")).toBe(text);
    expect(segs.filter((s) => s.kind === "text").map((s) => (s as { text: string }).text).join("")).not.toMatch(/^\]|\s\]/);
    // A comma inside a placeholder does not split the speaker.
    expect(splitSpeaker("[VERIFY: name, from Priya], CEO")).toEqual({ name: "[VERIFY: name, from Priya]", title: "CEO" });
    // A plain [VERIFY] next to the quote marker still parses on its own.
    expect(parseMarkers(`[VERIFY: launch date] ${token}`).map((s) => s.kind)).toEqual(["verify", "text", "quote"]);
  });

  it("names a placeholder speaker as the speaker in every sentence", () => {
    expect(speakerName("[VERIFY: spokesperson name]")).toBe("the speaker");
    expect(speakerName("")).toBe("the speaker");
    expect(speakerName("Hamid Kohan")).toBe("Hamid Kohan");
    const [quote] = parseMarkers("[QUOTE – PENDING APPROVAL: [VERIFY: spokesperson name], [VERIFY: exact title]]") as
      Exclude<ReturnType<typeof parseMarkers>[number], { kind: "text" }>[];
    expect(markerChip(quote)).toEqual({ text: "Waiting for the speaker's approval", tone: "quote" });
  });

  it("matches a token to the server's marker by block and exact token", () => {
    const markers = [
      { id: "m1", kind: "verify" as const, block_id: "b1", token: "[VERIFY: x]", label: "x", claim_id: "c1", quote_id: null, resolved: false },
      { id: "m2", kind: "verify" as const, block_id: "b2", token: "[VERIFY: x]", label: "x", claim_id: "c2", quote_id: null, resolved: true },
    ];
    expect(markerFor(markers, "b2", "[VERIFY: x]")?.id).toBe("m2");
    expect(markerFor(markers, "b3", "[VERIFY: x]")).toBeUndefined();
  });

  it("chips each marker in the spec's words, resolution from the server's overlay", () => {
    const [verify] = parseMarkers("[VERIFY: launch date]") as Exclude<ReturnType<typeof parseMarkers>[number], { kind: "text" }>[];
    expect(markerChip(verify)).toEqual({ text: "Verify: launch date", tone: "warn" });
    expect(markerChip(verify, { resolved: true } as never)).toEqual({ text: "Verified", tone: "ok" });
    const [missing] = parseMarkers("[MISSING: media contact]") as typeof verify[];
    expect(markerChip(missing)).toEqual({ text: "Missing: media contact", tone: "missing" });
    const [quote] = parseMarkers("[QUOTE – PENDING APPROVAL: Hamid Kohan, CEO]") as typeof verify[];
    expect(markerChip(quote)).toEqual({ text: "Waiting for Hamid Kohan's approval", tone: "quote" });
    const approved = {
      id: "q1", block_id: "b", speaker_name: "Hamid Kohan", speaker_title: "CEO", organization: null, text: "", text_hash: "h1",
      approval: { state: "approved" as const, recorded_by: PRIYA, evidence: "email", at: local(2026, 10, 28, 16, 12) },
      reset_in_version: null,
    };
    expect(markerChip(quote, undefined, approved)).toEqual({ text: "Approved by Hamid Kohan, Oct. 28", tone: "ok" });
  });

  it("says a changed quote needs approval again, and toasts it once", () => {
    const q = {
      id: "q2", block_id: "b", speaker_name: "Hamid Kohan", speaker_title: "CEO", organization: null, text: "", text_hash: "h2",
      approval: { state: "pending" as const, recorded_by: null, evidence: null, at: null }, reset_in_version: "1.2",
    };
    expect(quoteResetLine(q)).toBe("Changed in v1.2. Needs Hamid Kohan's approval again.");
    expect(quoteResetLine({ ...q, reset_in_version: null })).toBeNull();
    const run = normaliseRun(rawRun({
      current_version: "1.2",
      versions: [{ version: "1.1" }, { version: "1.2", quote_resets: [{ quote_id: "q2", speaker_name: "Hamid Kohan" }] }],
    }));
    expect(quoteResetToast(run, "1.1")).toBe("Quote changed. Hamid Kohan's approval is back to pending.");
    expect(quoteResetToast(run, "1.2")).toBeNull();
  });
});

/* ================================================================== cover == */

describe("the cover panel", () => {
  it("counts what is open and chips each count", () => {
    expect(coverCounts({ verify: 3, missing: 0, pending_quotes: 2 })).toBe("3 facts to verify, 2 quotes awaiting approval.");
    expect(coverCounts({ verify: 1, missing: 1, pending_quotes: 0 })).toBe("1 fact to verify, 1 detail missing.");
    expect(coverCounts({ verify: 0, missing: 0, pending_quotes: 0 })).toBe("Nothing left to verify or approve.");
    expect(coverChips({ verify: 3, missing: 1, pending_quotes: 2 })).toEqual([
      { key: "verify", text: "3 to verify", tone: "warn" },
      { key: "quotes", text: "2 quotes pending", tone: "neutral" },
      { key: "missing", text: "1 missing", tone: "missing" },
    ]);
  });

  it("tells the story from the type, the brand and the angle's first sentence", () => {
    expect(coverStory({ content_type_label: "product launch", brand_name: "Legal Soft" }, "Paralegals move into the PMS. More detail follows."))
      .toBe("Product launch for Legal Soft. Paralegals move into the PMS.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });

  it("labels the version as draft, in review or approved", () => {
    const base = normaliseRun(rawRun({ current_version: "0.3", versions: [{ version: "0.3" }] }));
    expect(versionStatusLabel(base)).toBe("Draft v0.3");
    const locked = normaliseRun(rawRun({ status: "in_review", current_version: "1.0", versions: [{ version: "1.0", locked: true }] }));
    expect(versionStatusLabel(locked)).toBe("In review v1.0");
    const approved = normaliseRun(rawRun({ status: "approved", current_version: "2.0", versions: [{ version: "2.0", locked: true }] }));
    expect(versionStatusLabel(approved)).toBe("Approved v2.0");
    expect(versionStatusLabel(normaliseRun(rawRun()))).toBeNull();
  });

  it("explains what stops Approved, missing details included (Rule 3)", () => {
    expect(blockerSentence({ verify: 3, missing: 0, pending_quotes: 2 })).toBe(
      "This draft can't be marked approved yet: 3 facts still need checking and 2 quotes are waiting for approval. "
      + "Clear these before sending for review, so reviewers sign off once.",
    );
    expect(blockerSentence({ verify: 1, missing: 1, pending_quotes: 1 })).toBe(
      "This draft can't be marked approved yet: 1 fact still needs checking, 1 quote is waiting for approval and "
      + "1 missing detail still needs filling in. Clear these before sending for review, so reviewers sign off once.",
    );
    expect(blockerSentence({ verify: 0, missing: 0, pending_quotes: 0 })).toBeNull();
  });
});

/* =============================================================== versions == */

describe("versions", () => {
  it("formats dates and times in AP style", () => {
    expect(apDate(local(2026, 10, 28))).toBe("Oct. 28");
    expect(apDate(local(2026, 9, 3))).toBe("Sept. 3");
    expect(apDate(local(2026, 6, 1))).toBe("June 1");
    expect(apTime(local(2026, 10, 29, 15, 10))).toBe("3:10 p.m.");
    expect(apTime(local(2026, 10, 29, 9, 0))).toBe("9 a.m.");
    expect(apTime(local(2026, 10, 29, 12, 0))).toBe("noon");
    expect(apTime(local(2026, 10, 29, 0, 5))).toBe("12:05 a.m.");
    expect(apDateTime(local(2026, 10, 29, 15, 10))).toBe("Oct. 29, 3:10 p.m.");
    expect(apDate("not a date")).toBe("");
  });

  it("steps a version label one minor version on, as a string", () => {
    expect(nextMinorVersion("0.3")).toBe("0.4");
    expect(nextMinorVersion("1.0")).toBe("1.1");
    expect(nextMinorVersion("1.9")).toBe("1.10");
    expect(nextMinorVersion(null)).toBe("0.1");
  });

  it("warns that verifying starts a new review round only once someone has signed", () => {
    const row = (state: string) => ({ id: "legal", kind: "role", label: "Legal", assignee: PRIYA, state, viewer_can_act: false });
    const waiting = normaliseRun(rawRun({ current_version: "1.0", signoffs: { version: "1.0", rows: [row("waiting")] } }));
    expect(resignWarning(waiting)).toBeNull();
    const signed = normaliseRun(rawRun({ current_version: "1.0", signoffs: { version: "1.0", rows: [row("signed_off")] } }));
    expect(resignWarning(signed)).toBe("This creates v1.1 and asks reviewers to sign off again.");
    const asked = normaliseRun(rawRun({ current_version: "1.2", signoffs: { version: "1.2", rows: [row("changes_asked")] } }));
    expect(resignWarning(asked)).toBe("This creates v1.3 and asks reviewers to sign off again.");
  });

  it("labels versions as v + the label, never as a float", () => {
    expect(versionLabel("1.0")).toBe("v1.0");
    expect(versionLabel("1.12")).toBe("v1.12");
  });

  it("writes a version row with who and what changed", () => {
    expect(versionRow({
      version: "1.2", created_at: local(2026, 10, 29, 15, 10), created_by: PRIYA, kind: "revision",
      what_changed: "Tightened the lede; changed Hamid Kohan's quote (approval reset)",
      quote_resets: [], locked: false, locked_at: null,
    })).toBe("v1.2 · Oct. 29, 3:10 p.m. · Priya · Tightened the lede; changed Hamid Kohan's quote (approval reset)");
    expect(versionRow({
      version: "0.1", created_at: local(2026, 10, 27, 9, 0), created_by: null, kind: "draft",
      what_changed: "", quote_resets: [], locked: false, locked_at: null,
    })).toBe("v0.1 · Oct. 27, 9 a.m. · PR Writer");
  });

  it("bans editing an older version with the spec's banner and a way back", () => {
    const v10 = {
      version: "1.0", created_at: local(2026, 10, 28, 10, 0), created_by: PRIYA, kind: "review_lock" as const,
      what_changed: "Sent for review", quote_resets: [], locked: true, locked_at: local(2026, 10, 28, 10, 0),
    };
    expect(lockedBanner(v10, "1.2")).toEqual({
      text: "You're reading v1.0, locked when it went for review on Oct. 28. It can't be changed.",
      link: "Open the current version (v1.2)",
    });
    expect(lockedBanner({ ...v10, version: "0.2", locked: false, locked_at: null }, "1.2").text)
      .toBe("You're reading v0.2, an earlier version. It can't be changed.");
    expect(lockedBanner(v10, "1.0").link).toBeNull();
  });
});

/* =============================================================== sign-off == */

describe("sign-off rows", () => {
  const row = (over: Partial<PrSignoffRow>): PrSignoffRow => ({
    id: "comms_lead", kind: "role", label: "Comms lead", assignee: PRIYA, fallback: false, unassigned: false,
    state: "waiting", version: null, by: null, at: null, note: null, viewer_can_act: false, ...over,
  });

  it("names who each row is waiting on", () => {
    expect(signoffRowLabel(row({}))).toBe("Comms lead: Priya");
    expect(signoffRowLabel(row({ id: "legal", label: "Legal", assignee: null, fallback: true }))).toBe("Legal: workspace admins");
    expect(signoffRowLabel(row({ id: "legal", label: "Legal", assignee: null, unassigned: true }))).toBe("Legal: nobody named yet");
    expect(signoffRowLabel(row({ id: "quote:q1", kind: "quote", label: "Quote: Hamid Kohan", assignee: null }))).toBe("Quote: Hamid Kohan");
  });

  it("says each row's state in the spec's words", () => {
    expect(signoffStateText(row({}))).toBe("Waiting");
    expect(signoffStateText(row({ state: "signed_off", version: "1.0", at: local(2026, 10, 28, 11) }))).toBe("Signed off v1.0, Oct. 28");
    expect(signoffStateText(row({ state: "changes_asked" }))).toBe("Asked for changes");
    expect(signoffStateText(row({ kind: "quote", state: "pending" }))).toBe("Waiting");
    expect(signoffStateText(row({ kind: "quote", state: "approved", at: local(2026, 10, 28, 16) }))).toBe("Approved, Oct. 28");
  });
});

/* ============================================================= escalation == */

describe("the escalation stop", () => {
  it("seats the viewer as reviewer, requester or onlooker from what they may do", () => {
    const reviewer = normaliseRun(rawRun({ owner: PRIYA, viewer_roles: ["legal"], can: { clear_escalation: true, keep_paused: true, close_escalation: true } }));
    expect(escalationSeat(reviewer, ME)).toBe("reviewer");
    const requester = normaliseRun(rawRun({ can: { withdraw: true, add_escalation_note: true } }));
    expect(escalationSeat(requester, ME)).toBe("requester");
    const onlooker = normaliseRun(rawRun({ owner: PRIYA, viewer_role: "participant", viewer_roles: ["participant"], can: {} }));
    expect(escalationSeat(onlooker, ME)).toBe("viewer");
  });

  it("writes the record line for each kind of note", () => {
    const at = local(2026, 10, 28, 14, 0);
    expect(escalationRecordLine({ kind: "clear", by: PRIYA, at, text: "Legal reviewed the wording; no client names." }))
      .toBe("Cleared by Priya, Oct. 28: Legal reviewed the wording; no client names.");
    expect(escalationRecordLine({ kind: "requester", by: HAMID, at, text: "Embargo is firm." }))
      .toBe("Note from Hamid Kohan, Oct. 28: Embargo is firm.");
    expect(escalationRecordLine({ kind: "withdraw", by: HAMID, at, text: "" })).toBe("Withdrawn by Hamid Kohan, Oct. 28.");
  });

  it("only promises drafting has started when the clearer is the owner", () => {
    expect(clearedToast(normaliseRun(rawRun({ owner: PRIYA, viewer_roles: ["legal"] })), ME))
      .toBe("Cleared. Drafting starts when Priya opens the draft.");
    expect(clearedToast(normaliseRun(rawRun({ viewer_roles: ["owner", "legal"] })), ME)).toBe("Cleared. Drafting has started.");
  });
});

/* ============================================================= brand card == */

const storedCard = (over: Partial<PrBrandCard> = {}): PrBrandCard => ({
  reviewers: { comms_lead: PRIYA, brand_owner: null, legal: HAMID },
  identity: { legal_name: "Legal Soft LLC", short_name: "Legal Soft", website: "https://legalsoft.com", newsroom_url: "",
    hq_city: "Woodland Hills", hq_state: "Calif.", dateline: "WOODLAND HILLS, Calif." },
  boilerplate: { text: "Legal Soft builds software for law firms.", approved_by: "Priya", approved_on: "2026-10-01",
    changed_by: PRIYA, changed_at: "2026-10-01T10:00:00Z" },
  messaging: { mission: "", positioning: "Software for firms.", key_messages: ["One", "Two"] },
  proof_points: [{ claim: "500 firms", source: "CRM", date: "2026-09" }],
  spokespeople: [{ name: "Hamid Kohan", title: "CEO", topics: "", quote_style: "", approval_contact: "" }],
  product_names: ["LegalSoft Intake™"],
  avoid: { words: ["revolutionary"], competitor_policy: "" },
  media_contact: { name: "Priya", title: "Comms", email: "priya@example.com", phone: "" },
  press_kit: [],
  keywords: ["virtual paralegal"],
  ...over,
});

describe("the brand card editor", () => {
  it("lists all eleven sections", () => {
    expect(CARD_SECTIONS).toHaveLength(11);
    expect(cardStoryLine("Legal Soft", 4)).toBe(
      "Legal Soft's card is 4 of 11 sections complete. Missing sections show as [VERIFY] in every draft.",
    );
  });

  it("turns a stored card into the editor's input: reviewers as ids, approval left behind", () => {
    const input = cardToInput(storedCard());
    expect(input.reviewers).toEqual({ comms_lead: "u-priya", brand_owner: null, legal: "u-hamid" });
    expect(input.boilerplate).toEqual({ text: "Legal Soft builds software for law firms." });
    expect(input.spokespeople[0].name).toBe("Hamid Kohan");
    expect(cardToInput(null)).toEqual(emptyCardInput());
    // A card from an older backend missing a whole section still reads.
    expect(cardToInput({ ...storedCard(), press_kit: undefined } as unknown as PrBrandCard).press_kit).toEqual([]);
  });

  it("cleans what it sends: trimmed, blank rows dropped, three key messages at most", () => {
    const input = cardToInput(storedCard());
    input.keywords = ["  virtual paralegal ", "", "intake"];
    input.messaging.key_messages = ["a", "b", "c", "d"];
    input.press_kit = [{ label: "", url: "" }, { label: "Logos", url: " https://x.test/logos " }];
    const clean = cleanCardInput(input);
    expect(clean.keywords).toEqual(["virtual paralegal", "intake"]);
    expect(clean.messaging.key_messages).toEqual(["a", "b", "c"]);
    expect(clean.press_kit).toEqual([{ label: "Logos", url: "https://x.test/logos" }]);
  });

  it("sends the loaded reviewers back unchanged unless the viewer may assign them", () => {
    const base = cardToInput(storedCard());
    const mine = structuredClone(base);
    mine.reviewers.legal = "u-someone-else";
    mine.keywords = [" intake ", ""];
    const asLead = cardToSend(base, mine, false);
    expect(asLead.reviewers).toEqual({ comms_lead: "u-priya", brand_owner: null, legal: "u-hamid" });
    expect(asLead.keywords).toEqual(["intake"]);
    expect(cardToSend(base, mine, true).reviewers.legal).toBe("u-someone-else");
    // An older reply without the flag reads as "may not assign".
    expect(normaliseCard({ can_edit: true }).can_edit_reviewers).toBe(false);
  });

  it("places a refused save where the reader can fix it", () => {
    expect(cardSaveError("cannot_assign_reviewers", undefined)).toEqual({ where: "form", text: CANNOT_ASSIGN_REVIEWERS });
    expect(CANNOT_ASSIGN_REVIEWERS).toBe("Only workspace admins can change who reviews this brand's drafts. Nothing was saved.");
    expect(cardSaveError("invalid_card", "reviewers.legal")).toEqual({ where: "reviewers.legal", text: LEGAL_SAME_AS_COMMS });
    expect(LEGAL_SAME_AS_COMMS).toBe("Legal review needs a different person from the comms lead.");
    expect(cardSaveError("invalid_card", "identity.website")).toBeNull();
    expect(cardSaveError("too_long", "boilerplate.text")).toBeNull();
    expect(CLARIFY_SCREEN_FAILED).toBe(
      "PR Writer couldn't check these details for topics that need legal first. Nothing was saved; try again.",
    );
  });

  it("knows when a save changes the boilerplate", () => {
    const base = cardToInput(storedCard());
    expect(boilerplateChanged(base, { ...base, boilerplate: { text: " Legal Soft builds software for law firms. " } })).toBe(false);
    expect(boilerplateChanged(base, { ...base, boilerplate: { text: "Something new." } })).toBe(true);
  });

  it("summarises a closed group in one line", () => {
    const input = cardToInput(storedCard());
    const nameOf = (id: string | null) => (id === "u-priya" ? "Priya" : id === "u-hamid" ? "Hamid Kohan" : "nobody");
    expect(sectionSummary("reviewers", input, nameOf)).toBe("Comms lead: Priya · Brand owner: nobody · Legal: Hamid Kohan");
    expect(sectionSummary("identity", input, nameOf)).toBe("Legal Soft LLC · WOODLAND HILLS, Calif.");
    expect(sectionSummary("press_kit", input, nameOf)).toBe("None yet");
    expect(sectionSummary("proof_points", input, nameOf)).toBe("1 proof point");
  });

  it("names who saved first in the stale-card message", () => {
    expect(staleCardMessage({ updated_by: PRIYA, updated_at: local(2026, 10, 28, 15, 42) }))
      .toBe("Priya saved this card at 3:42 p.m., after you opened it. Your changes aren't saved yet.");
  });
});

describe("the three-way card merge", () => {
  const base = cardToInput(storedCard());

  it("keeps my change where they did not touch the field, and theirs where I did not", () => {
    const mine = structuredClone(base);
    mine.identity.newsroom_url = "https://legalsoft.com/news";
    const theirs = structuredClone(base);
    theirs.media_contact.phone = "555-0100";
    const { merged, conflicts } = mergeThreeWay(base, mine, theirs);
    expect(conflicts).toEqual([]);
    expect(merged.identity.newsroom_url).toBe("https://legalsoft.com/news");
    expect(merged.media_contact.phone).toBe("555-0100");
  });

  it("takes the shared value when both made the same change", () => {
    const mine = structuredClone(base);
    const theirs = structuredClone(base);
    mine.keywords = ["virtual paralegal", "intake"];
    theirs.keywords = ["virtual paralegal", "intake"];
    expect(mergeThreeWay(base, mine, theirs)).toEqual({ merged: mine, conflicts: [] });
  });

  it("takes theirs on a real conflict and hands mine back to copy", () => {
    const mine = structuredClone(base);
    const theirs = structuredClone(base);
    mine.boilerplate.text = "My boilerplate.";
    theirs.boilerplate.text = "Their boilerplate.";
    mine.reviewers.brand_owner = "u-me";
    theirs.reviewers.brand_owner = "u-other";
    const { merged, conflicts } = mergeThreeWay(base, mine, theirs);
    expect(merged.boilerplate.text).toBe("Their boilerplate.");
    expect(merged.reviewers.brand_owner).toBe("u-other");
    expect(conflicts).toEqual([
      { path: "reviewers.brand_owner", mine: "u-me", theirs: "u-other" },
      { path: "boilerplate.text", mine: "My boilerplate.", theirs: "Their boilerplate." },
    ]);
  });

  it("treats a list as one field", () => {
    const mine = structuredClone(base);
    const theirs = structuredClone(base);
    mine.proof_points = [...base.proof_points, { claim: "Mine", source: "", date: "" }];
    theirs.proof_points = [];
    const { conflicts } = mergeThreeWay(base, mine, theirs);
    expect(conflicts.map((c) => c.path)).toEqual(["proof_points"]);
    expect(conflictText(conflicts[0].mine)).toBe("500 firms · CRM · 2026-09\nMine");
  });

  it("merges against an empty base when the card was created under me", () => {
    const empty = emptyCardInput();
    const mine = structuredClone(empty);
    mine.keywords = ["mine"];
    const theirs = cardToInput(storedCard());
    const { merged, conflicts } = mergeThreeWay(empty, mine, theirs);
    expect(conflicts.map((c) => c.path)).toEqual(["keywords"]);
    expect(merged.identity.legal_name).toBe("Legal Soft LLC");
  });
});

/* ===================================================== fill from website == */

describe("fill from website", () => {
  const reply = {
    brand_id: "legalsoft",
    generated_at: "2026-10-28T10:00:00Z",
    read_pages: [
      { url: "https://www.legalsoft.com/about", title: "About" },
      { url: "https://www.legalsoft.com/newsroom", title: "Newsroom" },
      { url: "", title: "dropped: no url" },
    ],
    suggestions: {
      identity: {
        // The card's own keys: `hq_state` spelled out, the AP form in `dateline`.
        value: { legal_name: "Legal Soft LLC", website: "https://legalsoft.com", hq_city: "Woodland Hills", hq_state: "California", dateline: "WOODLAND HILLS, Calif." },
        sources: ["https://www.legalsoft.com/about"], confidence: "high", note: "From the footer.",
      },
      boilerplate: { value: { text: "Legal Soft builds software for law firms." }, sources: ["https://www.legalsoft.com/about"], confidence: "medium", note: null },
      product_names: { value: ["LegalSoft Intake™", "  "], sources: [], confidence: "low" },
      press_kit: { value: [{ label: "Logos", url: "https://legalsoft.com/press" }], sources: ["https://legalsoft.com/press"] },
      keywords: { value: [" ", ""], sources: ["https://legalsoft.com"], confidence: "high", note: "empty once cleaned" },
      reviewers: { value: { comms_lead: { id: "u-x", name: "X" } }, sources: [], confidence: "high", note: "never read" },
      some_future_section: { value: "ignored", sources: [], confidence: "high", note: "" },
    },
  };

  it("never lists reviewers among the sections the site can draft", () => {
    expect(SUGGEST_SECTIONS).toHaveLength(10);
    expect(SUGGEST_SECTIONS).not.toContain("reviewers");
  });

  it("reads the reply with defaults: the card's shape and keys per section, empty values dropped", () => {
    const s = normaliseSuggestions(reply);
    expect(s.generated_at).toBe("2026-10-28T10:00:00Z");
    expect(s.read_pages).toEqual([
      { url: "https://www.legalsoft.com/about", title: "About" },
      { url: "https://www.legalsoft.com/newsroom", title: "Newsroom" },
    ]);
    // Identity reads `hq_state` and `dateline` under the card's own keys; a
    // field the reply leaves out is "".
    expect(s.suggestions.identity?.value).toEqual({
      legal_name: "Legal Soft LLC", short_name: "", website: "https://legalsoft.com", newsroom_url: "",
      hq_city: "Woodland Hills", hq_state: "California", dateline: "WOODLAND HILLS, Calif.",
    });
    expect(s.suggestions.identity?.confidence).toBe("high");
    expect(s.suggestions.identity?.note).toBe("From the footer.");
    // Boilerplate is `{ text }`; a null note reads as "".
    expect(s.suggestions.boilerplate?.value).toEqual({ text: "Legal Soft builds software for law firms." });
    expect(s.suggestions.boilerplate?.note).toBe("");
    // A bare string for boilerplate still reads.
    expect(normaliseSuggestions({ suggestions: { boilerplate: { value: "Plain." } } }).suggestions.boilerplate?.value).toEqual({ text: "Plain." });
    // An earlier spelling of the press-kit key still lands.
    expect(normaliseSuggestions({ suggestions: { press_kit_links: { value: [{ label: "L", url: "https://x" }] } } }).suggestions.press_kit?.value)
      .toEqual([{ label: "L", url: "https://x" }]);
    // A missing confidence reads as low; a missing note as "".
    expect(s.suggestions.press_kit?.value).toEqual([{ label: "Logos", url: "https://legalsoft.com/press" }]);
    expect(s.suggestions.press_kit?.confidence).toBe("low");
    expect(s.suggestions.press_kit?.note).toBe("");
    expect(s.suggestions.product_names?.value).toEqual(["LegalSoft Intake™", "  "]);
    // Blank-only keywords are nothing found; reviewers and unknown keys never land.
    expect(s.suggestions.keywords).toBeUndefined();
    expect(Object.keys(s.suggestions).sort()).toEqual(["boilerplate", "identity", "press_kit", "product_names"]);
    // No body at all is a reply with nothing in it, not a crash.
    expect(normaliseSuggestions(undefined)).toEqual({ generated_at: null, read_pages: [], suggestions: {} });
  });

  it("maps confidence, with anything unknown read as low", () => {
    expect(confidenceOf("high")).toBe("high");
    expect(confidenceOf("medium")).toBe("medium");
    expect(confidenceOf("low")).toBe("low");
    expect(confidenceOf("certain")).toBe("low");
    expect(confidenceOf(undefined)).toBe("low");
  });

  it("knows a filled section from an empty one, ignoring blanks", () => {
    const e = emptyCardInput();
    expect(sectionFilled("identity", e)).toBe(false);
    expect(sectionFilled("identity", { ...e, identity: { ...e.identity, hq_city: "  " } })).toBe(false);
    expect(sectionFilled("identity", { ...e, identity: { ...e.identity, hq_city: "LA" } })).toBe(true);
    expect(sectionFilled("product_names", { ...e, product_names: ["", " "] })).toBe(false);
    expect(sectionFilled("press_kit", { ...e, press_kit: [{ label: "", url: " " }] })).toBe(false);
    expect(sectionFilled("press_kit", { ...e, press_kit: [{ label: "", url: "https://x" }] })).toBe(true);
    expect(sectionFilled("boilerplate", { ...e, boilerplate: { text: " x " } })).toBe(true);
  });

  it("fills empty sections, never overwrites a filled one, and names what the site had nothing for", () => {
    const s = normaliseSuggestions(reply).suggestions;
    const mine = cardToInput(storedCard({ identity: { ...storedCard().identity, legal_name: "", website: "", hq_city: "", hq_state: "", dateline: "", short_name: "", newsroom_url: "" }, product_names: [] }));
    const { next, applied, held, missing } = applySuggestions(mine, s);
    // Empty on my side → prefilled, in the card's section order.
    expect(applied).toEqual(["identity", "product_names", "press_kit"]);
    expect(next.identity.legal_name).toBe("Legal Soft LLC");
    expect(next.product_names).toEqual(["LegalSoft Intake™", "  "]);
    expect(next.press_kit).toEqual([{ label: "Logos", url: "https://legalsoft.com/press" }]);
    // Filled on my side → kept exactly, suggestion held.
    expect(held).toEqual(["boilerplate"]);
    expect(next.boilerplate).toEqual(mine.boilerplate);
    expect(missing).toEqual(["messaging", "proof_points", "spokespeople", "avoid", "media_contact", "keywords"]);
    // Reviewers are untouched, and the form I started from is not mutated.
    expect(next.reviewers).toEqual(mine.reviewers);
    expect(mine.boilerplate.text).toBe("Legal Soft builds software for law firms.");
    expect(mine.identity.legal_name).toBe("");
  });

  it("lets the reader take one held suggestion over their own text", () => {
    const s = normaliseSuggestions(reply).suggestions;
    const mine = cardToInput(storedCard({ boilerplate: { ...storedCard().boilerplate, text: "Our own words." } }));
    const next = takeSuggestion(mine, "boilerplate", s.boilerplate!);
    expect(next.boilerplate.text).toBe("Legal Soft builds software for law firms.");
    expect(mine.boilerplate.text).toBe("Our own words.");
    expect(next.identity).toEqual(mine.identity);
  });

  it("labels the chip with the first source's host", () => {
    expect(sourceHost("https://www.legalsoft.com/about?x=1")).toBe("legalsoft.com");
    expect(sourceHost("not a url")).toBe("");
    expect(suggestChipLabel({ sources: ["https://www.legalsoft.com/about", "https://other.com"] })).toBe("Suggested · legalsoft.com");
    expect(suggestChipLabel({ sources: [] })).toBe("Suggested");
    expect(suggestChipLabel({ sources: ["nope"] })).toBe("Suggested");
  });

  it("words the empty state, the wait and the banner around the brand's site", () => {
    expect(fillFromLabel("legalsoft.com")).toBe("Fill from legalsoft.com");
    expect(fillFromLabel("")).toBe("Fill from website");
    expect(fillFromBody("legalsoft.com")).toBe(
      "PR Writer reads legalsoft.com's public pages and drafts the card. You check it, fix anything wrong and save. Reviewers are always chosen by you.",
    );
    expect(readingSiteText("legalsoft.com")).toBe("Reading legalsoft.com's public pages. About a minute.");
    expect(readingSiteText("")).toBe("Reading the website's public pages. About a minute.");
    expect(suggestBanner(6)).toBe("Drafted from 6 pages. Nothing is saved yet: check each section, then Save card.");
    expect(suggestBanner(1)).toBe("Drafted from 1 page. Nothing is saved yet: check each section, then Save card.");
    expect(suggestBanner(0)).toBe("Drafted from the site. Nothing is saved yet: check each section, then Save card.");
    expect(NOTHING_FOUND_ON_SITE).toBe("Nothing found on the site.");
    expect(BOILERPLATE_APPROVAL_HINT).toBe("Needs the comms lead's approval before it counts.");
    expect(MEDIA_CONTACT_HINT).toBe("Only shown if the site publishes one.");
  });

  it("says what a failed suggest means, per the contract's codes", () => {
    // 424 search / key: the server's sentence, since only it knows which key or why.
    expect(suggestErrorText("search_unavailable", "Serper credits are exhausted.")).toBe("Serper credits are exhausted.");
    expect(suggestErrorText("search_unavailable", "  ")).toBe(SEARCH_UNAVAILABLE_TEXT);
    expect(suggestErrorText("credential_missing", "The search key isn't configured.")).toBe("The search key isn't configured.");
    expect(suggestErrorText("credential_missing", null)).toBe("A key PR Writer needs isn't configured, so an admin has to add it. Nothing changed.");
    // 424 model_unavailable, the 502s and the 504: one sentence, never provider text.
    for (const code of ["model_unavailable", "model_truncated", "model_refused", "model_output_invalid", "model_timeout"]) {
      expect(suggestErrorText(code, "The writing model didn't respond after 3 tries. The card wasn't changed.")).toBe(SITE_UNREADABLE);
    }
    expect(SITE_UNREADABLE).toBe("PR Writer couldn't read the site right now. Nothing changed.");
    // 422 no domain, 403 no right to edit.
    expect(suggestErrorText("brand_domain_missing", "x")).toBe(BRAND_DOMAIN_MISSING);
    expect(BRAND_DOMAIN_MISSING).toBe("This brand has no website on record. Add its domain in the SEO Analyst first.");
    expect(suggestErrorText("cannot_edit_card", "x")).toBe(CANNOT_FILL_CARD);
    expect(CANNOT_FILL_CARD).toBe("Only the comms lead or an admin can fill this card.");
    // Anything else keeps the server's sentence, or the generic line.
    expect(suggestErrorText("brand_not_found", "No such brand.")).toBe("No such brand.");
    expect(suggestErrorText(null, null)).toBe(SITE_UNREADABLE);
  });
});

/* ============================================================ error copy == */

describe("errors outside a step", () => {
  it("says nothing was filed when creating a run fails, keeping the server's sentence for a bad brief", () => {
    expect(createErrorText("news_required", "Write the news in one sentence. Details can come later."))
      .toBe("Write the news in one sentence. Details can come later.");
    expect(createErrorText("too_long", "The news is over 600 characters.")).toBe("The news is over 600 characters.");
    expect(createErrorText("model_unavailable", "x")).toBe("The writing model isn't available right now. Nothing was filed.");
    expect(createErrorText("model_refused", "x")).toBe("The writing model declined to write this. Nothing was filed.");
    expect(createErrorText(null, null)).toBe(NOT_STARTED);
    expect(createErrorText("brand_not_found", "That brand isn't listed.")).toBe(NOT_STARTED);
  });

  it("says nothing was changed when an edit fails on the model, and names a size cap", () => {
    expect(actionErrorText("model_output_invalid", "provider text", "fallback"))
      .toBe("The writing model's answer wasn't usable, even after one repair. Nothing was changed.");
    expect(actionErrorText("cap_reached", "x", "fallback")).toBe("This draft has reached a size limit, so nothing was changed.");
    expect(actionErrorText("stale_version", "Someone revised this first.", "fallback")).toBe("Someone revised this first.");
    expect(actionErrorText(null, null, "fallback")).toBe("fallback");
  });
});

/* ================================================================= export == */

describe("the download's name", () => {
  it("takes the server's Content-Disposition name when it comes through", () => {
    expect(dispositionFilename('attachment; filename="LegalSoft_PressRelease_Paralegals_v1.0_2026-10-28.docx"'))
      .toBe("LegalSoft_PressRelease_Paralegals_v1.0_2026-10-28.docx");
    expect(dispositionFilename("attachment; filename*=UTF-8''Legal%20Soft_v1.0.md")).toBe("Legal Soft_v1.0.md");
    expect(dispositionFilename(null)).toBeNull();
  });

  it("falls back to brand, type and version", () => {
    expect(exportFilename({ brand_name: "Legal Soft", content_type_label: "Product launch" }, "1.2", "docx"))
      .toBe("Legal-Soft_Product-launch_v1.2.docx");
    expect(exportFilename({ brand_name: "Acme", content_type_label: null }, "0.1", "md")).toBe("Acme_PR-draft_v0.1.md");
  });
});
