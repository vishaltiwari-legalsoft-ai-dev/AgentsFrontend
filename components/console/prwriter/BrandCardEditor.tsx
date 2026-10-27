"use client";

/** The brand card: what every PR draft for a brand knows before it starts —
 *  who reviews, the dateline, the approved boilerplate, the spokespeople.
 *
 *  Saving is a full replace with optimistic concurrency (contract §5.1): the
 *  editor sends the revision it loaded, and a `409 stale_card` carries the card
 *  someone else saved since. "Load their version and keep mine" then merges
 *  field by field (`mergeThreeWay`), and any field both people changed shows
 *  the reader's own text beside it to copy back.
 *
 *  "Fill from website" asks the backend to draft the card from the brand's
 *  public pages (`POST …/card/suggest`). Nothing is saved by that: the
 *  suggestions land in the form (`applySuggestions`, never over a filled
 *  section), each prefilled section wears a chip naming its source, and the
 *  reader saves through the same PUT as any other edit. Reviewers are never
 *  suggested. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  apiBody, apiCode, prSaveCard, prSuggestCard,
  type PrBrandCardInput, type PrBrandCardResponse, type PrCardSection, type PrMember, type PrSuggestSection,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { describeFailure } from "@/lib/load";
import type { ToastFn } from "@/components/hub/context";
import {
  BOILERPLATE_APPROVAL_HINT, CARD_SECTIONS, MEDIA_CONTACT_HINT, NOTHING_FOUND_ON_SITE, SUGGESTION_AVAILABLE,
  applySuggestions, boilerplateChanged, cardSaveError, cardStoryLine, cardToInput, cardToSend, conflictText,
  fillFromBody, fillFromLabel, mergeThreeWay, normaliseCard, normaliseSuggestions, readingSiteText, retryDelayMs,
  sectionSummary, staleCardMessage, suggestBanner, suggestChipLabel, suggestErrorText, takeSuggestion,
  type MergeConflict, type PrCardSuggestions, type PrSectionSuggestion,
} from "@/components/hub/work/pr";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BrandCardEditorProps {
  brandId: string;
  brandName: string;
  /** The brand's site, as the backend knows it; empty from an older backend. */
  brandDomain: string;
  card: PrBrandCardResponse;
  canEdit: boolean;
  members: PrMember[];
  onSaved: (card: PrBrandCardResponse) => void;
  onToast: ToastFn;
}

type Path = string;

/** What the site drafted and where it went: sections prefilled, sections the
 *  reader had already filled (suggestion offered beside them), sections the
 *  site had nothing for. Cleared on discard and on save. */
interface SuggestState {
  result: PrCardSuggestions;
  applied: Set<PrSuggestSection>;
  held: Set<PrSuggestSection>;
  missing: Set<PrSuggestSection>;
}

/** How many `409 suggest_running` waits before giving up and saying so. */
const MAX_SUGGEST_WAITS = 10;

export function BrandCardEditor({ brandId, brandName, brandDomain, card, canEdit, members, onSaved, onToast }: BrandCardEditorProps) {
  const [base, setBase] = useState<PrBrandCardInput>(() => cardToInput(card.card));
  const [revision, setRevision] = useState(card.revision);
  const [mine, setMine] = useState<PrBrandCardInput>(() => cardToInput(card.card));
  const [started, setStarted] = useState(card.exists);
  const [approval, setApproval] = useState({ approved_by: "", approved_on: "" });
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [stale, setStale] = useState<PrBrandCardResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [legalErr, setLegalErr] = useState<string | null>(null);
  const canEditReviewers = canEdit && card.can_edit_reviewers;
  const [open, setOpen] = useState<Partial<Record<PrCardSection, boolean>>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  // The form the reply merges into is the one on screen when it lands, not
  // the one when the request left; and an unmounted editor writes nothing.
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const complete = CARD_SECTIONS.filter((s) => card.sections[s.id]).length;
  const dirty = JSON.stringify(mine) !== JSON.stringify(base);
  const newBoilerplate = boilerplateChanged(base, mine);
  const locked = !canEdit || saving || suggesting;

  const nameOf = (id: string | null): string => {
    if (!id) return "nobody named";
    const m = members.find((x) => x.id === id);
    if (m) return m.name;
    const r = card.card?.reviewers;
    const known = [r?.comms_lead, r?.brand_owner, r?.legal].find((u) => u?.id === id);
    return known?.name || "a former member";
  };

  const conflictAt = (path: Path) => conflicts.find((c) => c.path === path);
  const set = (fn: (c: PrBrandCardInput) => void) => {
    setMine((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    if (err) setErr(null);
    if (legalErr) setLegalErr(null);
  };

  async function save() {
    if (newBoilerplate && (!approval.approved_by.trim() || !approval.approved_on)) {
      setErr("Say who approved the new boilerplate and on what date. It is recorded with the card.");
      return;
    }
    setSaving(true);
    setErr(null);
    setLegalErr(null);
    try {
      const raw = await prSaveCard(brandId, {
        base_revision: revision,
        card: cardToSend(base, mine, canEditReviewers),
        ...(newBoilerplate ? { boilerplate_approval: { approved_by: approval.approved_by.trim(), approved_on: approval.approved_on } } : {}),
      });
      const saved = normaliseCard(raw);
      const input = cardToInput(saved.card);
      setBase(input);
      setMine(input);
      setRevision(saved.revision);
      setConflicts([]);
      setApproval({ approved_by: "", approved_on: "" });
      setSuggest(null);
      onSaved(saved);
      onToast(`${brandName}'s card is saved. New drafts use it from now on.`, "ok");
    } catch (e) {
      const code = apiCode(e);
      const detail = apiBody(e).detail as Record<string, unknown> | undefined;
      const placed = cardSaveError(code, detail?.field);
      if (code === "stale_card") {
        setStale(normaliseCard(detail?.current));
      } else if (placed?.where === "reviewers.legal") {
        setLegalErr(placed.text);
        setOpen((o) => ({ ...o, reviewers: true }));
      } else if (placed) {
        setErr(placed.text);
      } else {
        setErr(describeFailure(e, "The card could not be saved. Nothing was changed."));
      }
    } finally {
      setSaving(false);
    }
  }

  function loadTheirs() {
    if (!stale) return;
    const theirs = cardToInput(stale.card);
    const { merged, conflicts: found } = mergeThreeWay(base, mine, theirs);
    setBase(theirs);
    setMine(merged);
    setRevision(stale.revision);
    setConflicts(found);
    setStale(null);
    // Their open groups are where the reader has to look.
    setOpen((o) => {
      const next = { ...o };
      for (const c of found) next[c.path.split(".")[0] as PrCardSection] = true;
      return next;
    });
  }

  function discard() {
    setMine(base);
    setConflicts([]);
    setApproval({ approved_by: "", approved_on: "" });
    setErr(null);
    setSuggest(null);
    setSuggestErr(null);
  }

  /** Ask the backend to draft the card from the site, then merge what came
   *  back into the form. On `409 suggest_running` (another tab, a double
   *  click) wait `retry_after_s` and ask again, never starting a second
   *  read. Nothing is saved here. */
  async function runSuggest() {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestErr(null);
    setErr(null);
    try {
      let raw: unknown = null;
      for (let waits = 0; raw === null; waits++) {
        try {
          raw = await prSuggestCard(brandId);
        } catch (e) {
          if (apiCode(e) !== "suggest_running" || waits >= MAX_SUGGEST_WAITS) throw e;
          const detail = (apiBody(e).detail ?? {}) as Record<string, unknown>;
          await sleep(retryDelayMs(detail.retry_after_s));
          if (!alive.current) return;
        }
      }
      if (!alive.current) return;
      const result = normaliseSuggestions(raw);
      const { next, applied, held, missing } = applySuggestions(mineRef.current, result.suggestions);
      setMine(next);
      setSuggest({ result, applied: new Set(applied), held: new Set(held), missing: new Set(missing) });
      setStarted(true);
      // Prefilled sections open so the reader checks them; held ones show
      // their offer on the closed row.
      setOpen((o) => {
        const nextOpen = { ...o };
        for (const s of applied) nextOpen[s] = true;
        return nextOpen;
      });
    } catch (e) {
      if (!alive.current) return;
      const code = apiCode(e);
      setSuggestErr(code ? suggestErrorText(code, e instanceof Error ? e.message : null) : describeFailure(e, suggestErrorText(null, null)));
    } finally {
      if (alive.current) setSuggesting(false);
    }
  }

  function takeHeld<K extends PrSuggestSection>(section: K) {
    const sug = suggest?.result.suggestions[section] as PrSectionSuggestion<K> | undefined;
    if (!sug) return;
    setMine((prev) => takeSuggestion(prev, section, sug));
    setSuggest((s) => {
      if (!s) return s;
      const held = new Set(s.held); held.delete(section);
      const applied = new Set(s.applied); applied.add(section);
      return { ...s, held, applied };
    });
    if (err) setErr(null);
  }

  if (!started) {
    return (
      <div className="mr-panel">
        <div className="blank">
          <b>No brand card for {brandName} yet.</b>
          <p>
            Drafts still work. Boilerplate, spokespeople and media contact show as [VERIFY] placeholders, and sign-off goes to
            workspace admins until reviewers are named here.
          </p>
          {canEdit && (
            <>
              <p>{fillFromBody(brandDomain)}</p>
              {suggestErr && <p className="err" role="alert">{suggestErr}</p>}
              <div className="pr-actions">
                <button type="button" className="bw-btn bw-btn--primary" disabled={suggesting} onClick={() => void runSuggest()}>
                  {suggesting ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="globe" size={14} />}
                  {fillFromLabel(brandDomain)}
                </button>
                <button type="button" className="bw-btn" disabled={suggesting} onClick={() => { setStarted(true); setOpen({ reviewers: true }); }}>
                  Start blank
                </button>
              </div>
              {suggesting && <p className="pr-reading" role="status">{readingSiteText(brandDomain)}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- suggestions -- */

  const suggestionOf = <K extends PrSuggestSection>(section: K): PrSectionSuggestion<K> | undefined =>
    suggest?.result.suggestions[section] as PrSectionSuggestion<K> | undefined;

  /** The closed row's marker: what the site drafted here, or that it is
   *  waiting to replace the reader's own text. */
  const suggestMark = (id: PrCardSection): ReactNode => {
    if (!suggest || id === "reviewers") return null;
    const sug = suggestionOf(id);
    if (!sug) return null;
    if (suggest.held.has(id)) return <span className="bw-chip pr-chip--brand">{SUGGESTION_AVAILABLE}</span>;
    if (!suggest.applied.has(id)) return null;
    return (
      <span className="bw-chip pr-chip--neutral pr-suggested">
        <i className={`pr-dot pr-dot--${sug.confidence}`} aria-hidden="true" />
        {suggestChipLabel(sug)}
      </span>
    );
  };

  /** Above a section's fields: the source to open, the backend's note, the
   *  Replace offer on a section the reader had already filled, or that the
   *  site had nothing. */
  const suggestRow = (id: PrCardSection): ReactNode => {
    if (!suggest || id === "reviewers") return null;
    const sug = suggestionOf(id);
    if (!sug) {
      return suggest.missing.has(id) ? <p className="bw-hint">{NOTHING_FOUND_ON_SITE}</p> : null;
    }
    const source = sug.sources[0];
    const held = suggest.held.has(id);
    return (
      <div className="pr-suggest">
        {source ? (
          <a className="bw-chip pr-chip--neutral pr-suggested" href={source} target="_blank" rel="noopener noreferrer"
            title={held ? `Suggested from ${source}` : `Open ${source}`}>
            <i className={`pr-dot pr-dot--${sug.confidence}`} aria-hidden="true" />
            {suggestChipLabel(sug)}
            <Icon name="external-link" size={11} />
            <span className="pr-sr">, {sug.confidence} confidence, opens in a new tab</span>
          </a>
        ) : (
          <span className="bw-chip pr-chip--neutral pr-suggested">
            <i className={`pr-dot pr-dot--${sug.confidence}`} aria-hidden="true" />
            {suggestChipLabel(sug)}
          </span>
        )}
        {sug.note && <span className="pr-suggest__note">{sug.note}</span>}
        {held && !locked && (
          <button type="button" className="bw-btn pr-suggest__take" onClick={() => takeHeld(id)}>
            Replace with the site&apos;s version
          </button>
        )}
      </div>
    );
  };

  /* ---------------------------------------------------------- field kit -- */

  const conflictBox = (path: Path) => {
    const c = conflictAt(path);
    if (!c) return null;
    return (
      <div className="pr-conflict">
        <span>Your unsaved text</span>
        <textarea readOnly rows={Math.min(6, conflictText(c.mine).split("\n").length + 1)} value={conflictText(c.mine)} />
      </div>
    );
  };

  const text = (label: string, path: Path, value: string, onChange: (v: string) => void, opts: { multiline?: boolean; placeholder?: string; type?: string } = {}) => (
    <label className="pr-form__row">
      <span>{label}</span>
      {opts.multiline ? (
        <textarea className="pr-input" rows={3} value={value} placeholder={opts.placeholder} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="pr-input" type={opts.type || "text"} value={value} placeholder={opts.placeholder} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      )}
      {conflictBox(path)}
    </label>
  );

  /** A list of strings, one per line. Blank lines survive editing and are
   *  dropped on save. */
  const lines = (label: string, path: Path, value: string[], onChange: (v: string[]) => void, placeholder?: string) => (
    <label className="pr-form__row">
      <span>{label} <em className="pr-form__hint">One per line.</em></span>
      <textarea className="pr-input" rows={Math.max(3, value.length + 1)} value={value.join("\n")} placeholder={placeholder}
        disabled={locked} onChange={(e) => onChange(e.target.value.split("\n"))} />
      {conflictBox(path)}
    </label>
  );

  /** A list of rows, each a few short fields. */
  function rows<K extends string>(
    path: Path,
    items: Record<K, string>[],
    fields: readonly { key: K; label: string }[],
    onChange: (next: Record<K, string>[]) => void,
    addLabel: string,
  ) {
    const blank = Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<K, string>;
    return (
      <div className="pr-rowsfield">
        {items.map((item, i) => (
          <div className="pr-rowsfield__row" key={i}>
            {fields.map((f) => (
              <label key={f.key} className="pr-form__row">
                <span>{f.label}</span>
                <input className="pr-input" value={item[f.key]} disabled={locked}
                  onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />
              </label>
            ))}
            {!locked && (
              <button type="button" className="bw-btn pr-rowsfield__rm" aria-label={`Remove row ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <button type="button" className="bw-btn" onClick={() => onChange([...items, { ...blank }])}>
            <Icon name="plus" size={14} /> {addLabel}
          </button>
        )}
        {conflictBox(path)}
      </div>
    );
  }

  const reviewer = (label: string, key: keyof PrBrandCardInput["reviewers"]) => {
    // Without the right to assign reviewers the names are read-only, and the
    // save sends the loaded ids back unchanged (`cardToSend`).
    if (!canEditReviewers) {
      return (
        <div className="pr-form__row">
          <span>{label}</span>
          <span className="pr-readonly">{base.reviewers[key] ? nameOf(base.reviewers[key]) : "Nobody named"}</span>
        </div>
      );
    }
    const value = mine.reviewers[key];
    const listed = !value || members.some((m) => m.id === value);
    const fieldErr = key === "legal" ? legalErr : null;
    return (
      <label className="pr-form__row">
        <span>{label}</span>
        <select className="pr-input" value={value || ""} disabled={locked}
          aria-invalid={fieldErr ? true : undefined}
          aria-describedby={fieldErr ? "pr-legal-err" : undefined}
          onChange={(e) => set((c) => { c.reviewers[key] = e.target.value || null; })}>
          <option value="">Nobody named</option>
          {!listed && value && <option value={value}>{nameOf(value)}</option>}
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {fieldErr && <p className="err" id="pr-legal-err" role="alert">{fieldErr}</p>}
        {conflictBox(`reviewers.${key}`)}
      </label>
    );
  };

  const body: Record<PrCardSection, ReactNode> = {
    reviewers: (
      <>
        {reviewer("Comms lead", "comms_lead")}
        {reviewer("Brand owner", "brand_owner")}
        {reviewer("Legal", "legal")}
        {canEdit && !canEditReviewers && (
          <p className="bw-hint">Only workspace admins can change who reviews this brand&apos;s drafts.</p>
        )}
      </>
    ),
    identity: (
      <>
        {text("Legal name", "identity.legal_name", mine.identity.legal_name, (v) => set((c) => { c.identity.legal_name = v; }))}
        {text("Short name", "identity.short_name", mine.identity.short_name, (v) => set((c) => { c.identity.short_name = v; }))}
        {text("Website", "identity.website", mine.identity.website, (v) => set((c) => { c.identity.website = v; }), { type: "url" })}
        {text("Newsroom", "identity.newsroom_url", mine.identity.newsroom_url, (v) => set((c) => { c.identity.newsroom_url = v; }), { type: "url" })}
        {text("Headquarters city", "identity.hq_city", mine.identity.hq_city, (v) => set((c) => { c.identity.hq_city = v; }))}
        {text("Headquarters state", "identity.hq_state", mine.identity.hq_state, (v) => set((c) => { c.identity.hq_state = v; }))}
        {text("Dateline", "identity.dateline", mine.identity.dateline, (v) => set((c) => { c.identity.dateline = v; }), { placeholder: "WOODLAND HILLS, Calif." })}
      </>
    ),
    boilerplate: (
      <>
        {text("Boilerplate", "boilerplate.text", mine.boilerplate.text, (v) => set((c) => { c.boilerplate.text = v; }), { multiline: true })}
        {card.card?.boilerplate.approved_by && !newBoilerplate && (
          <p className="bw-hint">
            Approved by {card.card.boilerplate.approved_by}
            {card.card.boilerplate.approved_on ? ` on ${card.card.boilerplate.approved_on}` : ""}.
          </p>
        )}
        {newBoilerplate && (
          <>
            {suggest?.applied.has("boilerplate") && <p className="bw-hint">{BOILERPLATE_APPROVAL_HINT}</p>}
            <div className="pr-form__pair">
              {text("Approved by", "", approval.approved_by, (v) => setApproval((a) => ({ ...a, approved_by: v })))}
              {text("Approved on", "", approval.approved_on, (v) => setApproval((a) => ({ ...a, approved_on: v })), { type: "date" })}
            </div>
          </>
        )}
      </>
    ),
    messaging: (
      <>
        {text("Mission", "messaging.mission", mine.messaging.mission, (v) => set((c) => { c.messaging.mission = v; }), { multiline: true })}
        {text("Positioning", "messaging.positioning", mine.messaging.positioning, (v) => set((c) => { c.messaging.positioning = v; }), { multiline: true })}
        {lines("Key messages (up to three)", "messaging.key_messages", mine.messaging.key_messages, (v) => set((c) => { c.messaging.key_messages = v; }))}
      </>
    ),
    proof_points: rows("proof_points", mine.proof_points,
      [{ key: "claim", label: "Claim" }, { key: "source", label: "Source" }, { key: "date", label: "Date" }] as const,
      (v) => set((c) => { c.proof_points = v; }), "Add a proof point"),
    spokespeople: rows("spokespeople", mine.spokespeople,
      [{ key: "name", label: "Name" }, { key: "title", label: "Title" }, { key: "topics", label: "Topics" },
        { key: "quote_style", label: "Quote style" }, { key: "approval_contact", label: "Who approves their quotes" }] as const,
      (v) => set((c) => { c.spokespeople = v; }), "Add a spokesperson"),
    product_names: lines("Product names, exactly as written", "product_names", mine.product_names, (v) => set((c) => { c.product_names = v; }), "LegalSoft Intake™"),
    avoid: (
      <>
        {lines("Words to avoid", "avoid.words", mine.avoid.words, (v) => set((c) => { c.avoid.words = v; }))}
        {text("Competitor policy", "avoid.competitor_policy", mine.avoid.competitor_policy, (v) => set((c) => { c.avoid.competitor_policy = v; }), { multiline: true })}
      </>
    ),
    media_contact: (
      <>
        {text("Name", "media_contact.name", mine.media_contact.name, (v) => set((c) => { c.media_contact.name = v; }))}
        {text("Title", "media_contact.title", mine.media_contact.title, (v) => set((c) => { c.media_contact.title = v; }))}
        {text("Email", "media_contact.email", mine.media_contact.email, (v) => set((c) => { c.media_contact.email = v; }), { type: "email" })}
        {text("Phone", "media_contact.phone", mine.media_contact.phone, (v) => set((c) => { c.media_contact.phone = v; }), { type: "tel" })}
        {suggest && <p className="bw-hint">{MEDIA_CONTACT_HINT}</p>}
      </>
    ),
    press_kit: rows("press_kit", mine.press_kit, [{ key: "label", label: "Label" }, { key: "url", label: "Link" }] as const,
      (v) => set((c) => { c.press_kit = v; }), "Add a link"),
    keywords: lines("Priority keywords", "keywords", mine.keywords, (v) => set((c) => { c.keywords = v; })),
  };

  return (
    <div className="mr-panel pr-card">
      <div className="mr-panel__head bw-head">
        <div className="bw-head__text">
          <h2 className="mr-panel__title">Brand card for {brandName}</h2>
          <span className="mr-panel__sub">{cardStoryLine(brandName, complete)}</span>
          {!canEdit && <span className="bw-hint">Only the comms lead and workspace admins can change this card.</span>}
        </div>
        {canEdit && (
          <div className="pr-actions">
            <button type="button" className="bw-btn" disabled={saving || suggesting} onClick={() => void runSuggest()}
              aria-describedby={suggesting ? "pr-suggest-status" : undefined}>
              {suggesting ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="globe" size={14} />}
              Suggest from website
            </button>
            <button type="button" className="bw-btn" disabled={saving || suggesting || !dirty} onClick={discard}>Discard changes</button>
            <button type="button" className="bw-btn bw-btn--primary" disabled={saving || suggesting || (!dirty && card.exists)} onClick={() => void save()}>
              {saving ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="check" size={14} />}
              Save card
            </button>
          </div>
        )}
      </div>

      {suggesting && <p className="pr-reading" id="pr-suggest-status" role="status">{readingSiteText(brandDomain)}</p>}
      {suggestErr && <p className="err" role="alert">{suggestErr}</p>}
      {suggest && !suggesting && (
        <div className="pr-suggest-banner" role="status">
          <Icon name="globe" size={14} />
          <p>{suggestBanner(suggest.result.read_pages.length)}</p>
        </div>
      )}

      {stale && (
        <div className="pr-stale" role="alert">
          <p>{staleCardMessage(stale)}</p>
          <button type="button" className="bw-btn bw-btn--primary" onClick={loadTheirs}>Load their version and keep mine</button>
        </div>
      )}
      {conflicts.length > 0 && (
        <p className="bw-hint">
          {conflicts.length === 1 ? "One field was" : `${conflicts.length} fields were`} changed by both of you. Theirs is in the
          field; yours is underneath to copy back.
        </p>
      )}
      {err && <p className="err" role="alert">{err}</p>}

      <div className="pr-groups">
        {CARD_SECTIONS.map((s) => (
          <details
            key={s.id}
            className="pr-group"
            open={!!open[s.id]}
            onToggle={(e) => {
              const isOpen = (e.currentTarget as HTMLDetailsElement).open;
              setOpen((o) => (!!o[s.id] === isOpen ? o : { ...o, [s.id]: isOpen }));
            }}
          >
            <summary>
              <Icon name={open[s.id] ? "chevron-down" : "chevron-right"} size={14} />
              <b>{s.label}</b>
              {card.sections[s.id] && <Icon name="check" size={13} className="pr-group__ok" />}
              {!open[s.id] && suggestMark(s.id)}
              {!open[s.id] && <span className="pr-group__sum">{sectionSummary(s.id, mine, nameOf)}</span>}
            </summary>
            <div className="pr-group__body pr-form">
              {suggestRow(s.id)}
              {body[s.id]}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
