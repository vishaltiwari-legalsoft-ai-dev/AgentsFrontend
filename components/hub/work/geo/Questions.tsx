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
 *
 *  Writing questions and personas is creator-only on the backend. Rather than
 *  let a member type into a field whose save will be refused, the forms are not
 *  drawn for them and the reason is on screen.
 */

import { useEffect, useState } from "react";
import {
  geoAddPromptsBulk, geoGeneratePrompts, geoPrompts, geoSavePersonas, geoSavePrompts,
  type GeoPromptUniverse,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { Ic } from "../../Sprite";
import { Facet, PageHead, RuleHead, Oops, Wait } from "../../ui";
import { n } from "../../model";
import { useHub, type ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import {
  bucketLabel, coverageWords, labelProblem, MAX_PERSONAS, outcomeWords,
  personaLabel, promptCount,
} from "./personas";

const INTENT_WORDS: Record<string, string> = {
  brand: "asks about you by name",
  category: "asks about the category",
  problem: "describes the problem, not the product",
};

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
  const [intent, setIntent] = useState("category");
  const [bulkOut, setBulkOut] = useState<{ added: number; skipped: { text: string; reason: string }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"add" | "regen" | "save" | "personas" | null>(null);
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
    setErr(null);
    setBusy("add");
    try {
      const r = await geoAddPromptsBulk(data.brandId, {
        text: clean,
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
              <form className="inline" onSubmit={add} noValidate>
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
                <button type="submit" className="btn btn--solid" disabled={busy === "add"}>
                  <Ic name="plus" />
                  {busy === "add" ? "Adding…" : "Add question"}
                </button>
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
                <div className="inline">
                  {personas.length > 0 && (
                    <label className="field field--tight">
                      <span>Asked by</span>
                      <select className="sel" value={chosen} onChange={(e) => setPersona(e.target.value)}>
                        <option value="">No persona</option>
                        {personas.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="field" style={{ flex: "0 1 280px" }}>
                    <span>What each line asks</span>
                    <select className="sel" value={intent} onChange={(e) => setIntent(e.target.value)}>
                      <option value="category">{INTENT_WORDS.category}</option>
                      <option value="problem">{INTENT_WORDS.problem}</option>
                      <option value="brand">{INTENT_WORDS.brand}</option>
                    </select>
                  </label>
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
          note="An unchecked question is skipped on the next check. Nothing already stored is deleted."
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
                  <label>
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      disabled={!mayEdit || busy === "save"}
                      onChange={(e) => void toggle(p.id, e.target.checked)}
                    />
                    {p.text}
                    {p.source === "custom" && <span className="opt"> · written by your team</span>}
                    <span className="opt"> · {INTENT_WORDS[p.intent] || p.intent}</span>
                    {who && <span className="tag">{who}</span>}
                  </label>
                  {!r ? (
                    <span className="n">not asked yet</span>
                  ) : (
                    <span className={`n ${hit === 0 ? "miss" : "hit"}`}>
                      {hit === 0 ? "never named" : `named by ${hit}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
