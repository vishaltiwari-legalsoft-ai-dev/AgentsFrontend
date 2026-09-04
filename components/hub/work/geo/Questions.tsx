"use client";

/** The buyer questions we ask, and who is asking them.
 *
 *  Phrased the way somebody shopping would type them. A question like "why is
 *  Legal Soft the best" does not match how people actually ask, and the answer
 *  that comes back tells you nothing — which is why the help text says so where
 *  somebody is about to write one.
 *
 *  Two things beyond the single-line form:
 *
 *  - **A whole list can be pasted at once**, one question per line. The outcome
 *    is reported both ways — what went in AND what was skipped, with the reason
 *    per line — because partial acceptance is the normal result of a paste, not
 *    an error to dress up as success or failure.
 *  - **A question can carry the buyer persona who would ask it.** Tag them and
 *    the coverage readout splits by persona, which is how you find out whether
 *    the people you built this for are the ones the engines show you to.
 *  - **Questions are deleted one at a time or many at once.** Both go through
 *    the one save this screen has — the whole set, replaced — so a selection is
 *    ordinary state, not a second delete rail. Emptying the set is allowed and
 *    is confirmed by its own sentence, and a save that fails keeps the
 *    selection on screen with the server's own words beside it: a delete that
 *    did not happen must never look like one that did.
 *
 *  Writing questions and personas is creator-only on the backend. Rather than
 *  let a member type into a field whose save will be refused, the forms are not
 *  drawn for them and the reason is on screen.
 */

import { useEffect, useRef, useState } from "react";
import {
  geoAddPromptsBulk, geoGeneratePrompts, geoPrompts, geoSavePersonas, geoSavePrompts,
  type GeoAskedIntent, type GeoPromptUniverse,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { Ic } from "../../Sprite";
import { Facet, PageHead, RuleHead, Oops, Wait } from "../../ui";
import { n } from "../../model";
import { useHub, type ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import {
  ASKED_CHOICES, ASKED_WHY, askedChoiceProblem, bucketLabel, coverageWords,
  deleteAftermathWords, deleteConfirmWords, deletedWords, intentWords, labelProblem,
  MAX_PERSONAS, outcomeWords, personaLabel, promptCount, selectionWords, stillListed,
} from "./personas";

const PASTE_EXAMPLE =
  "1. which intake service handles Spanish-speaking clients?\n" +
  "2. best virtual receptionist for a solo law firm\n" +
  "3. how do law firms answer calls after hours?";

export function GeoQuestions({ data, onToast }: { data: GeoData; onToast: ToastFn }) {
  const { user } = useHub();
  const session = useLoadSession();
  const [uni, setUni] = useState<Load<GeoPromptUniverse>>(loadPending);
  const [mode, setMode] = useState<"one" | "many">("one");
  const [text, setText] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [persona, setPersona] = useState("");
  // No default. What this is set to decides whether the question is also put
  // to Google's billed search engines, so it is asked of the person writing it
  // rather than assumed on their behalf — assuming it is what was being paid for.
  const [intent, setIntent] = useState<GeoAskedIntent | "">("");
  const [bulkOut, setBulkOut] = useState<{ added: number; skipped: { text: string; reason: string }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"add" | "regen" | "save" | "personas" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  // Which questions are ticked for deletion, the confirm that stands between a
  // selection and the save, and the words the server used if that save failed.
  // Separate from `removing`: one row's confirmation is not a selection, and
  // the row's own checkbox is the on/off switch, not a tick box.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const keepBtn = useRef<HTMLButtonElement | null>(null);
  // The personas disclosure's own form and its row-level remove confirmation.
  const [pLabel, setPLabel] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pErr, setPErr] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);

  const mayEdit = user.is_creator === true;

  useEffect(() => {
    void session.run(
      "geo-prompts",
      (s) => geoPrompts(data.brandId, { signal: s }),
      setUni,
      "The question set could not be read.",
      { keepStale: true },
    );
  }, [session, data.brandId, beat]);

  const prompts = uni.data?.prompts || [];
  // A backend from before personas existed simply does not send the field.
  const personas = uni.data?.personas || [];
  const coverage = data.report.persona_rollup || [];
  const rollup = data.report.prompt_rollup || [];
  const askedOf = new Map(rollup.map((r) => [r.prompt_id, r]));

  // The selected persona may have been removed since it was picked; sending a
  // gone key would tag new questions with a persona that no longer exists.
  const chosen = personas.some((p) => p.key === persona) ? persona : "";

  // The selection, read through the current list every time. A tick left over
  // from a set that has since been regenerated is neither counted nor sent.
  const pickedIds = stillListed(prompts, picked);

  // A form nobody has submitted yet is not an invalid one: the choice is marked
  // as missing only once the reader has been told it is.
  const askedInvalid = !intent && err === askedChoiceProblem("");

  const ready = (u: GeoPromptUniverse) => setUni({ phase: "ready", data: u, error: null });

  const switchMode = (m: "one" | "many") => {
    setMode(m);
    setErr(null);
    setBulkOut(null);
  };

  /** The single line goes through the same paste endpoint so it can carry the
   *  persona; a one-line paste that was refused comes back as one skip, and the
   *  skip's reason is the error to show. */
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (clean.length < 10) {
      setErr("At least ten characters. Write it the way somebody shopping would type it.");
      return;
    }
    const unchosen = askedChoiceProblem(intent);
    if (unchosen || !intent) {
      setErr(unchosen);
      return;
    }
    setErr(null);
    setBusy("add");
    try {
      const r = await geoAddPromptsBulk(data.brandId, {
        text: clean,
        intent,
        ...(chosen ? { persona: chosen } : {}),
      });
      ready(r.universe);
      if (r.added.length === 0) {
        setErr(r.skipped[0]?.reason || "That question was not saved.");
      } else {
        setText("");
        onToast("Added. It goes to every engine on the next check.", "ok");
      }
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "That question was not saved.");
    } finally {
      setBusy(null);
    }
  };

  const addAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = bulkText.trim();
    if (!clean) {
      setErr("Paste at least one question first.");
      return;
    }
    const unchosen = askedChoiceProblem(intent);
    if (unchosen || !intent) {
      setErr(unchosen);
      return;
    }
    setErr(null);
    setBusy("add");
    try {
      const r = await geoAddPromptsBulk(data.brandId, {
        text: clean,
        intent,
        ...(chosen ? { persona: chosen } : {}),
      });
      ready(r.universe);
      setBulkOut({ added: r.added.length, skipped: r.skipped });
      if (r.added.length > 0) {
        setBulkText("");
        onToast(`${outcomeWords(r.added.length, r.skipped.length)}. New questions go to every engine on the next check.`, "ok");
      }
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "The list was not saved.");
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy("regen");
    try {
      const r = await geoGeneratePrompts(data.brandId);
      ready(r);
      onToast("Drafts regenerated. Questions you wrote yourself, and your personas, are untouched.", "ok");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "The drafts could not be regenerated.", "error");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    const u = uni.data;
    if (!u) return;
    ready({ ...u, prompts: u.prompts.map((p) => (p.id === id ? { ...p, enabled } : p)) });
    setBusy("save");
    try {
      const r = await geoSavePrompts(
        data.brandId,
        u.prompts.map((p) => (p.id === id ? { ...p, enabled } : p)),
      );
      ready(r);
    } catch (e: unknown) {
      // A toggle that did not save must not be left looking saved.
      ready(u);
      onToast(e instanceof Error ? e.message : "That change did not save.", "error");
    } finally {
      setBusy(null);
    }
  };

  /** Delete a set of questions — one row's, or a whole selection's.
   *
   *  There is one delete on this screen and it is the save this screen already
   *  had: the universe, minus what went. Clearing it out entirely is allowed;
   *  the confirm above says so in its own sentence rather than the screen
   *  refusing after the fact.
   *
   *  Nothing is drawn as gone before the save answers, so there is no optimistic
   *  state to unwind — a refusal leaves the list, and the selection behind it,
   *  exactly as the reader left them, with the server's own words on screen. */
  const removeMany = async (ids: string[]) => {
    const u = uni.data;
    if (!u || ids.length === 0) return;
    const gone = new Set(ids);
    setDelErr(null);
    setBusy("save");
    try {
      const r = await geoSavePrompts(data.brandId, u.prompts.filter((p) => !gone.has(p.id)));
      ready(r);
      setPicked(new Set());
      setConfirmBulk(false);
      setRemoving(null);
      onToast(deletedWords(ids.length), "ok");
    } catch (e: unknown) {
      const why = e instanceof Error ? e.message : "The question set could not be saved.";
      setDelErr(why);
      onToast(why, "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = (id: string) => removeMany([id]);

  const tick = (id: string, on: boolean) => {
    setDelErr(null);
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const clearPicked = () => {
    setPicked(new Set());
    setConfirmBulk(false);
    setDelErr(null);
  };

  // A confirm that appears below the reader's click is not announced by
  // appearing. Focus lands on the way out of it, never on the destructive half.
  useEffect(() => {
    if (confirmBulk) keepBtn.current?.focus();
  }, [confirmBulk]);

  const addPersona = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pLabel.trim();
    const problem = labelProblem(clean, personas);
    if (problem) {
      setPErr(problem);
      return;
    }
    setPErr(null);
    setBusy("personas");
    try {
      const r = await geoSavePersonas(data.brandId, {
        personas: [
          ...personas.map((p) => ({ key: p.key, label: p.label, description: p.description || undefined })),
          { label: clean, description: pDesc.trim() || undefined },
        ],
      });
      ready(r);
      setPLabel("");
      setPDesc("");
      onToast(`${clean} added. New questions can carry it now.`, "ok");
    } catch (e2: unknown) {
      setPErr(e2 instanceof Error ? e2.message : "That persona was not saved.");
    } finally {
      setBusy(null);
    }
  };

  const removePersona = async (key: string) => {
    const gone = personas.find((p) => p.key === key);
    setBusy("personas");
    try {
      const r = await geoSavePersonas(data.brandId, {
        personas: personas
          .filter((p) => p.key !== key)
          .map((p) => ({ key: p.key, label: p.label, description: p.description || undefined })),
      });
      ready(r);
      setConfirmKey(null);
      onToast(`${gone?.label || "Persona"} removed. Its questions are kept, just untagged.`, "ok");
    } catch (e2: unknown) {
      onToast(e2 instanceof Error ? e2.message : "That persona was not removed.", "error");
    } finally {
      setBusy(null);
    }
  };

  const on = prompts.filter((p) => p.enabled).length;

  return (
    <>
      <PageHead
        statement={<>These are the <b>buyer questions</b> we ask.</>}
        lede="Phrase them the way somebody shopping would type them. A question like “why is Legal Soft the best” does not match how people actually ask, and the answer that comes back tells you nothing."
      />

      {mayEdit ? (
        <section className="band">
          <div className="facets">
            <Facet on={mode === "one"} label="One at a time" onClick={() => switchMode("one")} />
            <Facet on={mode === "many"} label="Paste a list" onClick={() => switchMode("many")} />
          </div>

          {mode === "one" ? (
            <>
              <form onSubmit={add} noValidate>
                <div className="inline">
                  <label className="field">
                    <span>Add a buyer question</span>
                    <input
                      className="inp"
                      type="text"
                      value={text}
                      onChange={(e) => { setText(e.target.value); if (err) setErr(null); }}
                      placeholder="which intake service handles Spanish-speaking clients?"
                    />
                  </label>
                  {personas.length > 0 && (
                    <label className="field field--tight">
                      <span>Asked by</span>
                      <select className="sel" value={chosen} onChange={(e) => setPersona(e.target.value)}>
                        <option value="">No persona</option>
                        {personas.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <AskedChoice
                  name="asked-one"
                  legend="Which kind of question is this?"
                  value={intent}
                  invalid={askedInvalid}
                  onChange={(v) => { setIntent(v); if (err) setErr(null); }}
                />
                <div className="inline" style={{ marginTop: 12 }}>
                  <button type="submit" className="btn btn--solid" disabled={busy === "add"}>
                    <Ic name="plus" />
                    {busy === "add" ? "Adding…" : "Add question"}
                  </button>
                </div>
              </form>
              <p className="help" style={{ marginTop: 10 }}>
                At least ten characters. Questions you write here survive a regenerate.
              </p>
            </>
          ) : (
            <>
              <form onSubmit={addAll} noValidate>
                <label className="field">
                  <span>Paste buyer questions — one per line</span>
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => { setBulkText(e.target.value); if (err) setErr(null); }}
                    placeholder={PASTE_EXAMPLE}
                  />
                </label>
                {personas.length > 0 && (
                  <div className="inline">
                    <label className="field field--tight">
                      <span>Asked by</span>
                      <select className="sel" value={chosen} onChange={(e) => setPersona(e.target.value)}>
                        <option value="">No persona</option>
                        {personas.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                <AskedChoice
                  name="asked-many"
                  legend="What is every line you pasted?"
                  value={intent}
                  invalid={askedInvalid}
                  onChange={(v) => { setIntent(v); if (err) setErr(null); }}
                />
                <div className="inline" style={{ marginTop: 12 }}>
                  <button type="submit" className="btn btn--solid" disabled={busy === "add"}>
                    <Ic name="plus" />
                    {busy === "add" ? "Adding…" : "Add all"}
                  </button>
                </div>
              </form>
              <p className="help" style={{ marginTop: 10 }}>
                Numbering and bullets are fine — each line becomes one question. A line that cannot
                be added is listed below with its reason; the rest go in regardless.
              </p>
              {bulkOut && (
                <div style={{ marginTop: 10 }} role="status">
                  <p className="help"><b>{outcomeWords(bulkOut.added, bulkOut.skipped.length)}</b></p>
                  {bulkOut.skipped.length > 0 && (
                    <ul className="listy" style={{ marginTop: 6 }}>
                      {bulkOut.skipped.map((s, i) => (
                        <li key={i}>
                          <span className="row-text">
                            {s.text} <span className="opt">— {s.reason}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
          {err && <p className="err" role="alert" style={{ marginTop: 10 }}>{err}</p>}
        </section>
      ) : (
        <p className="soon-note">
          Writing and regenerating questions is creator-only, so the form is not shown here rather
          than offered and then refused on save. The set below is what is being asked.
        </p>
      )}

      <section className="band">
        <details className="shut">
          <summary>Personas{personas.length > 0 ? ` — ${n(personas.length)} defined` : ""}</summary>
          <p className="help" style={{ marginTop: 8, maxWidth: 640 }}>
            A persona is the buyer a question belongs to — “solo attorney”, “firm office
            manager”. Tag questions with one and the coverage readout splits by it, so you can
            see which buyers the engines actually show you to.
          </p>

          {personas.length > 0 ? (
            <ul className="listy" style={{ marginTop: 12 }}>
              {personas.map((p) => {
                const count = promptCount(prompts, p.key);
                const confirming = confirmKey === p.key;
                return (
                  <li key={p.key}>
                    <span className="row-text">
                      <b>{p.label}</b>
                      {p.description && <span className="opt"> · {p.description}</span>}
                      {confirming && (
                        <span className="opt" style={{ display: "block" }}>
                          Remove {p.label}? Its {n(count)} question{count === 1 ? " stays" : "s stay"} in
                          the set, just untagged.
                        </span>
                      )}
                    </span>
                    <span className="n">{n(count)} question{count === 1 ? "" : "s"}</span>
                    {mayEdit && (confirming ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() => void removePersona(p.key)}
                          disabled={busy === "personas"}
                        >
                          {busy === "personas" ? "Removing…" : "Yes, remove"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() => setConfirmKey(null)}
                          disabled={busy === "personas"}
                        >
                          No, keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => setConfirmKey(p.key)}
                        disabled={busy === "personas"}
                      >
                        Remove
                      </button>
                    ))}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="help" style={{ marginTop: 10 }}>
              {mayEdit
                ? "None yet. Add the first one below."
                : "A creator has not defined personas for this brand yet."}
            </p>
          )}

          {mayEdit && (
            personas.length >= MAX_PERSONAS ? (
              <p className="help" style={{ marginTop: 10 }}>
                Eight personas is the ceiling — remove one before adding another.
              </p>
            ) : (
              <form className="inline" style={{ marginTop: 12 }} onSubmit={addPersona} noValidate>
                <label className="field field--tight">
                  <span>Persona</span>
                  <input
                    className="inp"
                    value={pLabel}
                    autoComplete="off"
                    placeholder="Solo attorney"
                    onChange={(e) => { setPLabel(e.target.value); if (pErr) setPErr(null); }}
                  />
                </label>
                <label className="field">
                  <span>Who that is <span className="opt">(one line, optional)</span></span>
                  <input
                    className="inp"
                    value={pDesc}
                    autoComplete="off"
                    placeholder="Runs their own practice, answers their own phone"
                    onChange={(e) => setPDesc(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn btn--quiet" disabled={busy === "personas"}>
                  {busy === "personas" ? "Saving…" : "Add persona"}
                </button>
              </form>
            )
          )}
          {pErr && <p className="err" role="alert" style={{ marginTop: 10 }}>{pErr}</p>}
          {!mayEdit && personas.length > 0 && (
            <p className="help" style={{ marginTop: 10 }}>Editing personas is creator-only.</p>
          )}
        </details>
      </section>

      {coverage.length > 0 && (
        <section className="band">
          <RuleHead
            title="Which buyers see you"
            note="Per persona: how often these engines named you on that buyer's questions — whether the people you built this for are the ones finding you."
          />
          <ul className="listy">
            {coverage.map((r) => (
              <li key={r.persona || "untagged"}>
                <span className="row-text">
                  <b>{bucketLabel(personas, r.persona)}</b> — {coverageWords(r)}
                </span>
                <span className="n">{n(r.n_answers)} answer{r.n_answers === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="band">
        <RuleHead
          title="In the current set"
          note={mayEdit
            ? "An unchecked question is skipped on the next check; Delete removes it from the set for good. Tick the box at the left of a row to delete several at once. Either way, answers already measured stay in reports until they age out of the window."
            : "An unchecked question is skipped on the next check. Answers already measured stay in reports until they age out of the window."}
          aside={
            mayEdit
              ? (
                <button type="button" className="btn btn--quiet btn--sm" onClick={regenerate} disabled={busy === "regen"}>
                  {busy === "regen" ? "Regenerating…" : "Regenerate drafts"}
                </button>
              )
              : <span className="aside">{n(on)} of {n(prompts.length)} on</span>
          }
        />

        {mayEdit && prompts.length > 0 && (
          <div className="filters" role="group" aria-label="Delete several questions">
            <button
              type="button" className="btn btn--quiet btn--sm"
              onClick={() => { setDelErr(null); setPicked(new Set(prompts.map((p) => p.id))); }}
              disabled={busy === "save" || pickedIds.length === prompts.length}
            >
              Select all {n(prompts.length)}
            </button>
            <button
              type="button" className="btn btn--quiet btn--sm"
              onClick={clearPicked}
              disabled={busy === "save" || pickedIds.length === 0}
            >
              Clear selection
            </button>
            <button
              type="button" className="btn btn--quiet btn--sm"
              onClick={() => setConfirmBulk(true)}
              disabled={busy === "save" || pickedIds.length === 0}
            >
              <Ic name="x" />
              {pickedIds.length === 0 ? "Delete selected" : `Delete ${n(pickedIds.length)} selected`}
            </button>
            <p className="help" aria-live="polite">{selectionWords(pickedIds.length, prompts.length)}</p>
          </div>
        )}

        {confirmBulk && pickedIds.length > 0 && (
          <div
            role="alertdialog"
            aria-label="Confirm deleting questions"
            onKeyDown={(e) => { if (e.key === "Escape") setConfirmBulk(false); }}
            style={{
              border: "1px solid var(--rule-hard)", borderRadius: "var(--r-card)",
              background: "var(--surface)", padding: "var(--s4)", marginBottom: "var(--s4)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              {deleteConfirmWords(pickedIds.length, prompts.length)}
            </p>
            <p className="help" style={{ marginTop: 6, maxWidth: "72ch" }}>
              {deleteAftermathWords(data.days)}
            </p>
            <div className="inline" style={{ marginTop: 12 }}>
              <button
                type="button" className="btn btn--solid btn--sm"
                onClick={() => void removeMany(pickedIds)} disabled={busy === "save"}
              >
                {busy === "save" ? "Deleting…" : `Yes, delete ${n(pickedIds.length)}`}
              </button>
              <button
                ref={keepBtn} type="button" className="btn btn--quiet btn--sm"
                onClick={() => setConfirmBulk(false)} disabled={busy === "save"}
              >
                Keep them
              </button>
            </div>
          </div>
        )}

        {/* A delete that was refused leaves the ticks exactly where they were, and
            says why in the server's own words — re-pressing is then a decision. */}
        {delErr && (
          <p className="err" role="alert" style={{ marginBottom: "var(--s4)" }}>
            Nothing was deleted — {delErr}
          </p>
        )}

        {uni.phase === "loading" && !uni.data ? (
          <Wait what="Reading the question set" rows={5} />
        ) : uni.phase === "failed" && !uni.data ? (
          <Oops what="The question set could not be read." error={uni.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : prompts.length === 0 ? (
          <div className="empty">
            <h4>No questions yet</h4>
            <p>
              {mayEdit
                ? "Generate a first set of drafts, then edit them into the words your buyers actually use."
                : "A creator has not written the question set for this brand yet."}
            </p>
            {mayEdit && (
              <button type="button" className="btn btn--mark btn--sm" onClick={regenerate} disabled={busy === "regen"}>
                Generate drafts
              </button>
            )}
          </div>
        ) : (
          <ul className="listy">
            {prompts.map((p) => {
              const r = askedOf.get(p.id);
              const hit = r?.engines_hit.length ?? 0;
              const who = personaLabel(personas, p.persona);
              return (
                <li key={p.id}>
                  {/* Selection, not the on/off switch beside it. Its own control
                      because ticking a row to delete it and turning a row off are
                      different acts with different consequences. */}
                  {mayEdit && (
                    <input
                      type="checkbox"
                      checked={picked.has(p.id)}
                      disabled={busy === "save"}
                      title="Select for deletion"
                      aria-label={`Select “${p.text}” for deletion`}
                      onChange={(e) => tick(p.id, e.target.checked)}
                    />
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      disabled={!mayEdit || busy === "save"}
                      onChange={(e) => void toggle(p.id, e.target.checked)}
                    />
                    {p.text}
                    {p.source === "custom" && <span className="opt"> · written by your team</span>}
                    <span className="opt"> · {intentWords(p.intent)}</span>
                    {who && <span className="tag">{who}</span>}
                  </label>
                  {!r ? (
                    <span className="n">not asked yet</span>
                  ) : (
                    <span className={`n ${hit === 0 ? "miss" : "hit"}`}>
                      {hit === 0 ? "never named" : `named by ${hit}`}
                    </span>
                  )}
                  {mayEdit && (removing === p.id ? (
                    <>
                      <button
                        type="button" className="btn btn--quiet btn--sm"
                        onClick={() => void remove(p.id)} disabled={busy === "save"}
                      >
                        {busy === "save" ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        type="button" className="btn btn--quiet btn--sm"
                        onClick={() => setRemoving(null)} disabled={busy === "save"}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button" className="btn btn--quiet btn--sm"
                      aria-label={`Delete "${p.text}"`}
                      // The last question is a full clear, so it goes through the
                      // confirm that says so rather than the row's two-word one.
                      onClick={() => {
                        if (prompts.length === 1) {
                          setDelErr(null);
                          setPicked(new Set([p.id]));
                          setConfirmBulk(true);
                        } else {
                          setRemoving(p.id);
                        }
                      }}
                      disabled={busy === "save"}
                    >
                      Delete
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/** The one thing a person must decide before a question can be sent.
 *
 *  Two options, in the words of somebody writing a question rather than the
 *  words the API takes, and nothing preselected: what this is set to decides
 *  whether the question is also put to Google's billed search engines, and the
 *  bill for guessing it was already paid once. Radios rather than a menu so
 *  both options — and the cost line under them — are read without opening
 *  anything.
 */
function AskedChoice({
  name, legend, value, invalid, onChange,
}: {
  name: string;
  legend: string;
  value: GeoAskedIntent | "";
  invalid: boolean;
  onChange: (v: GeoAskedIntent) => void;
}) {
  return (
    <fieldset style={{ border: 0, margin: "14px 0 0", padding: 0, minWidth: 0 }}>
      <legend className="help" style={{ padding: 0, marginBottom: 7 }}>{legend}</legend>
      <div style={{ display: "grid", gap: 7 }}>
        {ASKED_CHOICES.map((c) => (
          <label
            key={c.value}
            style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, cursor: "pointer" }}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={value === c.value}
              aria-invalid={invalid || undefined}
              onChange={() => onChange(c.value)}
              style={{ marginTop: 1, width: 15, height: 15, accentColor: "var(--fg)", flex: "0 0 auto" }}
            />
            {c.label}
          </label>
        ))}
      </div>
      <p className="help" style={{ marginTop: 7, maxWidth: "72ch" }}>{ASKED_WHY}</p>
    </fieldset>
  );
}
