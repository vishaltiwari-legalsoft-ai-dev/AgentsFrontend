"use client";

/** The brand card: what every PR draft for a brand knows before it starts —
 *  who reviews, the dateline, the approved boilerplate, the spokespeople.
 *
 *  Saving is a full replace with optimistic concurrency (contract §5.1): the
 *  editor sends the revision it loaded, and a `409 stale_card` carries the card
 *  someone else saved since. "Load their version and keep mine" then merges
 *  field by field (`mergeThreeWay`), and any field both people changed shows
 *  the reader's own text beside it to copy back. */

import { useState, type ReactNode } from "react";
import {
  apiBody, apiCode, prSaveCard,
  type PrBrandCardInput, type PrBrandCardResponse, type PrCardSection, type PrMember,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { describeFailure } from "@/lib/load";
import type { ToastFn } from "@/components/hub/context";
import {
  CARD_SECTIONS, boilerplateChanged, cardStoryLine, cardToInput, cleanCardInput, conflictText, mergeThreeWay, normaliseCard, sectionSummary, staleCardMessage, type MergeConflict,
} from "@/components/hub/work/pr";

export interface BrandCardEditorProps {
  brandId: string;
  brandName: string;
  card: PrBrandCardResponse;
  canEdit: boolean;
  members: PrMember[];
  onSaved: (card: PrBrandCardResponse) => void;
  onToast: ToastFn;
}

type Path = string;

export function BrandCardEditor({ brandId, brandName, card, canEdit, members, onSaved, onToast }: BrandCardEditorProps) {
  const [base, setBase] = useState<PrBrandCardInput>(() => cardToInput(card.card));
  const [revision, setRevision] = useState(card.revision);
  const [mine, setMine] = useState<PrBrandCardInput>(() => cardToInput(card.card));
  const [started, setStarted] = useState(card.exists);
  const [approval, setApproval] = useState({ approved_by: "", approved_on: "" });
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [stale, setStale] = useState<PrBrandCardResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Partial<Record<PrCardSection, boolean>>>({});

  const complete = CARD_SECTIONS.filter((s) => card.sections[s.id]).length;
  const dirty = JSON.stringify(mine) !== JSON.stringify(base);
  const newBoilerplate = boilerplateChanged(base, mine);
  const locked = !canEdit || saving;

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
  };

  async function save() {
    if (newBoilerplate && (!approval.approved_by.trim() || !approval.approved_on)) {
      setErr("Say who approved the new boilerplate and on what date. It is recorded with the card.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const raw = await prSaveCard(brandId, {
        base_revision: revision,
        card: cleanCardInput(mine),
        ...(newBoilerplate ? { boilerplate_approval: { approved_by: approval.approved_by.trim(), approved_on: approval.approved_on } } : {}),
      });
      const saved = normaliseCard(raw);
      const input = cardToInput(saved.card);
      setBase(input);
      setMine(input);
      setRevision(saved.revision);
      setConflicts([]);
      setApproval({ approved_by: "", approved_on: "" });
      onSaved(saved);
      onToast(`${brandName}'s card is saved. New drafts use it from now on.`, "ok");
    } catch (e) {
      if (apiCode(e) === "stale_card") {
        const detail = apiBody(e).detail as Record<string, unknown> | undefined;
        setStale(normaliseCard(detail?.current));
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
            <button type="button" className="bw-btn bw-btn--primary" onClick={() => { setStarted(true); setOpen({ reviewers: true }); }}>
              <Icon name="plus" size={14} /> Start the card
            </button>
          )}
        </div>
      </div>
    );
  }

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
    const value = mine.reviewers[key];
    const listed = !value || members.some((m) => m.id === value);
    return (
      <label className="pr-form__row">
        <span>{label}</span>
        <select className="pr-input" value={value || ""} disabled={locked}
          onChange={(e) => set((c) => { c.reviewers[key] = e.target.value || null; })}>
          <option value="">Nobody named</option>
          {!listed && value && <option value={value}>{nameOf(value)}</option>}
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
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
          <div className="pr-form__pair">
            {text("Approved by", "", approval.approved_by, (v) => setApproval((a) => ({ ...a, approved_by: v })))}
            {text("Approved on", "", approval.approved_on, (v) => setApproval((a) => ({ ...a, approved_on: v })), { type: "date" })}
          </div>
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
            <button type="button" className="bw-btn" disabled={saving || !dirty} onClick={discard}>Discard changes</button>
            <button type="button" className="bw-btn bw-btn--primary" disabled={saving || (!dirty && card.exists)} onClick={() => void save()}>
              {saving ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="check" size={14} />}
              Save card
            </button>
          </div>
        )}
      </div>

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
              {!open[s.id] && <span className="pr-group__sum">{sectionSummary(s.id, mine, nameOf)}</span>}
            </summary>
            <div className="pr-group__body pr-form">{body[s.id]}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
