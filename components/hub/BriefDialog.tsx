"use client";

/** Hand work to a specialist, without going to it first.
 *
 *  The prototype offered one textarea for all five, because a queued run there
 *  was an object pushed onto an array. Here the five do not take the same thing,
 *  and pretending they do would be a button that quietly does nothing:
 *
 *  - The **Graphic Designer**, the **Blog Writer** and the **PR Writer**
 *    genuinely start from a sentence and a brand, so this dialog starts their
 *    run for real and drops the reader into it.
 *  - The **SEO Analyst**, **Marketing Research** and **GEO** start from a
 *    choice this dialog cannot make for you — which property to crawl, which of
 *    ten reports to build, which engines to sweep. So they say what starting one
 *    involves and open the workspace where that choice lives, rather than
 *    accepting a brief they would throw away.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiCode, bwBrands, bwCreateRun, gdCreateRun, gdListBrands, prBrands, prCreateRun,
  type BwBrand, type GdBrandOption,
} from "@/lib/api";
import { useLoadSession } from "@/lib/load";
import { Ic } from "./Sprite";
import { AGENTS, WORKSPACE_SLUG, agentById, type HubAgent } from "./model";
import type { ToastFn } from "./context";
import { createErrorText, normaliseBrand } from "./work/pr";

/** The three that take a written brief, and what the field should say for each. */
const TAKES_BRIEF: Record<string, { label: string; placeholder: string; verb: string }> = {
  a1: {
    label: "The brief",
    placeholder: "One social creative for the cyber incident response page. Confident, plain English, no jargon.",
    verb: "Start the run",
  },
  a9: {
    label: "The topic",
    placeholder: "What a virtual receptionist actually costs — real pricing, evidence-backed, no vendor fluff.",
    verb: "Start the research",
  },
  a13: {
    label: "What's the news, in one sentence?",
    placeholder: "Legal Soft's virtual paralegals now work inside a firm's practice management system, live Nov. 12.",
    verb: "Start the draft",
  },
};

/** What the brief field says when it is left empty, where a specialist has
 *  its own words for it. */
const EMPTY_BRIEF: Record<string, string> = {
  a13: "Write the news in one sentence. Details can come later.",
};

/** The no-brands line, where a specialist's brands live somewhere else. */
const NO_BRANDS: Record<string, string> = {
  a13: "No brands are set up yet. Add one in the SEO Analyst first. PR Writer uses the same brand list.",
};


/** What the other three actually begin with, said plainly rather than pretended away. */
const OPENS_INSTEAD: Record<string, string> = {
  a2: "An SEO run is a crawl of one property. Pick the property in the workspace and it starts there — a first crawl takes a few minutes.",
  a6: "Marketing Research builds one of ten report kinds over a period you choose. Both choices live in the workspace.",
  a10: "A GEO check puts your buyer questions to five AI engines — a few hundred engine calls. The workspace shows what is already scheduled before you add to it.",
  a12: "Inbox Triage takes no brief. It reads your Gmail on its own clock and writes to your sheet; the workspace is where you connect it and see whether it is running.",
};

/** `hasCard` is the PR Writer's only: whether the brand has a brand card. */
interface BrandOpt { id: string; name: string; hasCard?: boolean }

export function BriefDialog({
  agentId, agents, onClose, onToast, onOpenWork, onQueued,
}: {
  agentId: string | null;
  /** The specialists this reader may hand work to. The brand lists behind the
   *  two that take a written brief are `/api/gd/*` and `/api/blog/*` reads, so
   *  a picker offering one outside the allowance is a form that 403s the
   *  moment it opens. The caller filters; this dialog only draws what it gets. */
  agents: HubAgent[];
  onClose: () => void;
  onToast: ToastFn;
  onOpenWork: (slug: string, subject?: string, section?: string) => void;
  onQueued: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const session = useLoadSession();

  const [who, setWho] = useState<string>(agentId || agents[0]?.id || "");
  const [text, setText] = useState("");
  const [facts, setFacts] = useState("");
  const [factsOpen, setFactsOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // The server has no idempotency token for a PR run, so a second press while
  // the first is in flight must not file a second one. State lags a render;
  // the ref does not.
  const inFlight = useRef(false);
  const [brands, setBrands] = useState<BrandOpt[] | null>(null);
  const [brand, setBrand] = useState<string>("");
  const [brandErr, setBrandErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = agentId !== null;
  const takes = TAKES_BRIEF[who];

  useEffect(() => {
    if (agentId) setWho(agentId);
  }, [agentId]);

  // Reset between openings: a dialog opened for the Blog Writer that comes back
  // still holding the Graphic Designer's brief is a run filed against the wrong
  // specialist.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setText("");
      setFacts("");
      setFactsOpen(false);
      setErr(null);
      el.showModal();
      setTimeout(() => area.current?.focus(), 40);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // The brand list is per specialist, and only the two that take a brief need one.
  useEffect(() => {
    if (!open || !takes) return;
    let dead = false;
    setBrands(null);
    setBrandErr(null);
    const load: Promise<BrandOpt[]> = who === "a1"
      ? gdListBrands().then((r) => r.brands as GdBrandOption[])
      : who === "a13"
        ? prBrands().then((r) => (r?.brands || []).map(normaliseBrand).map((b) => ({ id: b.id, name: b.name, hasCard: b.has_card })))
        : bwBrands().then((r) => (r.brands as BwBrand[]).map((b) => ({ id: b.id, name: b.name })));
    load
      .then((list) => {
        if (dead) return;
        setBrands(list);
        setBrand((prev) => (list.some((b) => b.id === prev) ? prev : list[0]?.id || ""));
      })
      .catch((e: unknown) => {
        if (dead) return;
        setBrands([]);
        setBrandErr(e instanceof Error ? e.message : "Could not load the brand list.");
      });
    return () => { dead = true; };
    // `session` is not a dependency: it lives for the component, not the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, who, takes]);

  const start = useCallback(async () => {
    if (inFlight.current) return;
    const brief = text.trim();
    if (!brief) {
      setErr(EMPTY_BRIEF[who] || "Write what you want made. One or two sentences is enough.");
      area.current?.focus();
      return;
    }
    if (!brand) {
      setErr("Pick the brand this is for.");
      return;
    }
    setErr(null);
    setBusy(true);
    inFlight.current = true;
    const agent = agentById(who);
    try {
      if (who === "a1") {
        const run = await gdCreateRun(brand, { creative_brief: { brief } });
        onQueued();
        onClose();
        // The studio cannot reopen a run by id yet — it always starts at its
        // setup screen — so the toast says where the run actually is rather
        // than claiming it is open.
        onToast(`${agent?.name} has your brief. The run is recorded on Runs; the studio opens at setup.`, "ok");
        onOpenWork("art", run.id, "studio");
      } else if (who === "a13") {
        // Runs intake and screen before it answers; the button stays disabled.
        const run = await prCreateRun({ brand_id: brand, news: brief, facts: facts.trim() || undefined });
        onQueued();
        onClose();
        onToast("PR Writer is reading your brief. The draft fills in step by step.", "ok");
        // Opening their own run is what starts its steps, so the person lands on it.
        onOpenWork("pr", brand, run.id);
      } else {
        const run = await bwCreateRun({ brand_id: brand, topic: brief });
        onQueued();
        onClose();
        onToast(`${agent?.name} is researching. Its draft fills in as rounds land.`, "ok");
        // The route names the run, under its brand. Opening their own run
        // mid-research is what starts its rounds, so the person lands on it.
        onOpenWork("blog", brand, run.id);
      }
    } catch (e: unknown) {
      // A run that did not start must never look like one that did.
      if (who === "a13") {
        setErr(createErrorText(apiCode(e), e instanceof Error ? e.message : null));
      } else {
        setErr(e instanceof Error ? e.message : "The run could not be started. Nothing was filed.");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [text, facts, brand, who, onQueued, onClose, onToast, onOpenWork]);

  const agent = agentById(who);

  return (
    <dialog
      className="dialog"
      ref={dialog}
      aria-labelledby="brief-title"
      onClose={onClose}
      onCancel={onClose}
    >
      {/* A <dialog> has to stay mounted to be openable; its contents do not, and
          leaving them mounted meant a closed dialog kept a live "Loading brands"
          row in the document on every panel. */}
      {open && (<>
      <h2 id="brief-title">Hand work to a specialist</h2>
      <p id="brief-who">
        {agent ? agent.makes : "Every specialist takes a brief in its own words. Pick who this is for."}
      </p>

      {/* One specialist is not a choice, so it is not drawn as one. */}
      {agents.length > 1 && (
        <div className="picker" role="radiogroup" aria-label="Specialist">
          {agents.map((a) => (
            <button
              type="button"
              key={a.id}
              role="radio"
              aria-checked={a.id === who}
              className={`pick${a.id === who ? " is-on" : ""}`}
              onClick={() => { setWho(a.id); setErr(null); }}
            >
              <span className="mono" aria-hidden="true">{a.mono}</span>
              <span><b>{a.name}</b><em>{a.role}</em></span>
            </button>
          ))}
        </div>
      )}

      {takes ? (
        <>
          <label className="field">
            <span>Brand</span>
            {brands === null ? (
              <p className="wait"><i className="wait__spin" aria-hidden="true" />Loading brands…</p>
            ) : brands.length === 0 ? (
              <p className="err">
                {brandErr || NO_BRANDS[who] || `No brands are set up yet. Add one in ${agent?.name}'s workspace first.`}
              </p>
            ) : (
              <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {who === "a13" && brands?.find((b) => b.id === brand)?.hasCard === false && (
              <span className="hint">
                {brands.find((b) => b.id === brand)?.name} has no brand card yet. You can still draft. Brand details will show as [VERIFY] placeholders.
              </span>
            )}
          </label>

          <label className="field">
            <span>{takes.label}</span>
            <textarea
              ref={area}
              rows={4}
              value={text}
              onChange={(e) => { setText(e.target.value); if (err) setErr(null); }}
              placeholder={takes.placeholder}
            />
            {err && <p className="err">{err}</p>}
          </label>

          {who === "a13" && (
            <>
              <button type="button" className="bw-collapse" aria-expanded={factsOpen} onClick={() => setFactsOpen(!factsOpen)}>
                <Ic name="chevron" className={factsOpen ? "pr-rot90" : undefined} />
                Add facts or quotes you already have (optional)
              </button>
              {factsOpen && (
                <label className="field pr-brief-facts">
                  <span className="pr-sr">Facts or quotes you already have</span>
                  <textarea
                    rows={4}
                    value={facts}
                    onChange={(e) => setFacts(e.target.value)}
                    placeholder="Dates, figures and where they come from, an approved quote, the embargo time. PR Writer cites this as coming from you."
                  />
                </label>
              )}
            </>
          )}

          <div className="dialog__actions">
            <button type="button" className="btn btn--quiet" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--mark"
              onClick={start}
              disabled={busy || !brands || brands.length === 0}
            >
              <Ic name="send" />
              {busy ? "Starting…" : takes.verb}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lede" style={{ margin: "14px 0 0" }}>{OPENS_INSTEAD[who]}</p>
          <div className="dialog__actions">
            <button type="button" className="btn btn--quiet" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--mark"
              onClick={() => { onClose(); onOpenWork(WORKSPACE_SLUG[who]); }}
            >
              <Ic name="chevron" />
              Open {agent?.name}
            </button>
          </div>
        </>
      )}
      </>)}
    </dialog>
  );
}

export { AGENTS };
