"use client";

/** The brands this console watches — added, switched, and removed here.
 *
 *  Three things about this screen are decisions rather than layout:
 *
 *  1. **The list is not GEO's.** The SEO Analyst, Blog Writer and Issues read
 *     the same registry and filter on the same `enabled` flag, so a brand added
 *     here appears in theirs and a brand removed here leaves theirs. That is
 *     said once, in plain words, at the top — surprise is the failure mode, not
 *     the sharing, so it is neither hidden nor dressed as a warning.
 *  2. **Remove is not delete.** It writes `enabled: false`, which hides the
 *     brand everywhere and destroys nothing: the answers already paid for, the
 *     question set and the Search Console grant all stay. So the word "delete"
 *     appears nowhere, and the switched-off brands keep their own section on
 *     this same screen with the way back in it. A removal you cannot find your
 *     way out of is a deletion however it is worded.
 *  3. **The weekly check is the money switch.** A brand with it on is swept
 *     unattended on its cadence and every sweep is hundreds of paid engine
 *     calls; a brand with it off is only ever measured when somebody presses
 *     Check now, and its history will have holes. Both halves are written out
 *     beside every row rather than left to the position of a knob.
 *
 *  The switched-off brands come from the SEO overview, which lists the registry
 *  whole. `GET /api/geo/brands` answers with the enabled brands only — that is
 *  correct and deliberate everywhere else in GEO, and it is exactly why this
 *  screen cannot use it to draw the section that undoes a removal.
 *
 *  Every new field on the wire is read through `checkOf`, never inline: for the
 *  few minutes between a frontend deploy and its backend one the list answers
 *  without them, and this screen has to keep listing brands through that.
 */

import { useEffect, useState } from "react";
import {
  apiStatus, geoCreateBrand, geoSaveBrandConfig, seoOverview,
  type GeoBrandRow, type SeoBrandCard,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { checkLine, checkOf, checkToggleWords } from "@/components/console/geo/schedule";
import { Ic } from "../../Sprite";
import { Blank, Oops, PageHead, RuleHead, Wait } from "../../ui";
import { n } from "../../model";
import { useHub, type ToastFn } from "../../context";
import {
  SHARED_LIST_NOTE, brandFormProblem, createdWords, duplicateHint, editorGate,
  questionsCell, removeConfirmWords, removedWords, restoredWords,
} from "./edits";

/** A brand this console just created, kept on screen after the toast has gone.
 *  It is the only place the next step is stated where the reader is standing. */
interface JustAdded {
  id: string;
  name: string;
  /** The backend created the brand but could not seed its GEO settings. Shown
   *  verbatim: the brand exists, and its schedule is not what we asked for. */
  warning: string | null;
}

export function GeoBrands({
  brands, onGo, onToast,
}: {
  brands: GeoBrandRow[];
  onGo: (brandId: string, section: string) => void;
  onToast: ToastFn;
}) {
  const { user, revision, bumpRevision } = useHub();
  const session = useLoadSession();

  const { mayEdit, reason: readOnlyWhy } = editorGate(user);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  /** The line under a refused create that only a 409 earns — it names the way
   *  forward for the id that is already taken. */
  const [hint, setHint] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState<JustAdded | null>(null);

  /** Which row is mid-write, and which row is asking to be confirmed. Separate:
   *  a confirmation is not a save, and a row must not look busy while it waits
   *  for an answer. */
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [off, setOff] = useState<Load<SeoBrandCard[]>>(loadPending);

  useEffect(() => {
    void session.run(
      "geo-off-brands",
      (s) => seoOverview({ signal: s }).then(
        (r) => r.brands.filter((c) => c.brand?.enabled === false),
      ),
      setOff,
      "The switched-off brands could not be read.",
      { keepStale: true },
    );
    // `revision` is bumped by every write on this screen, which is what brings
    // a brand across from one list to the other without a page reload.
  }, [session, revision]);

  const now = new Date();
  const offList = off.data || [];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = brandFormProblem(name, url, brands);
    if (problem) {
      setErr(problem);
      setHint(null);
      return;
    }
    setErr(null);
    setHint(null);
    setAdding(true);
    try {
      const r = await geoCreateBrand({ name: name.trim(), url: url.trim() });
      setName("");
      setUrl("");
      setMade({ id: r.brand.id, name: r.brand.name, warning: r.warning ?? null });
      onToast(createdWords(r.brand.name), r.warning ? "warn" : "ok");
      bumpRevision();
    } catch (e2: unknown) {
      // 409 "already here" and 422 "that is not a brand" are answers, not
      // failures, and they are shown in the backend's own words. Only the 409
      // earns the hint, because only the 409 has somewhere to send you.
      setErr(e2 instanceof Error ? e2.message : "That brand was not added.");
      setHint(apiStatus(e2) === 409 ? duplicateHint : null);
    } finally {
      setAdding(false);
    }
  };

  const setCheck = async (row: GeoBrandRow, on: boolean) => {
    setRowBusy(row.id);
    try {
      await geoSaveBrandConfig(row.id, { auto_poll: on });
      onToast(checkToggleWords(row.name, on, checkOf(row).intervalDays), "ok");
      bumpRevision();
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "That switch was not saved.", "error");
    } finally {
      setRowBusy(null);
    }
  };

  const setEnabled = async (brand: { id: string; name: string }, enabled: boolean) => {
    setRowBusy(brand.id);
    try {
      await geoSaveBrandConfig(brand.id, { enabled });
      setConfirmId(null);
      onToast(enabled ? restoredWords(brand.name) : removedWords(brand.name), "ok");
      bumpRevision();
    } catch (e: unknown) {
      onToast(
        e instanceof Error ? e.message
          : `${brand.name} was not switched ${enabled ? "on" : "off"}.`,
        "error",
      );
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <>
      <PageHead
        statement={
          brands.length === 0
            ? <>No brand is being watched yet.</>
            : <>This console is watching <b>{n(brands.length)} brand{brands.length === 1 ? "" : "s"}</b>.</>
        }
        lede={SHARED_LIST_NOTE}
      />

      {mayEdit ? (
        <section className="band">
          <RuleHead
            title="Add a brand"
            note="It arrives with no questions and its scheduled check off, so it costs nothing until you say so."
          />
          <form onSubmit={add} noValidate>
            <div className="inline">
              <label className="field">
                <span>Brand name</span>
                <input
                  className="inp"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (err) { setErr(null); setHint(null); } }}
                  placeholder="Legal Soft"
                />
              </label>
              <label className="field">
                <span>Website</span>
                <input
                  className="inp"
                  type="text"
                  inputMode="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (err) { setErr(null); setHint(null); } }}
                  placeholder="legalsoft.com"
                />
              </label>
            </div>
            <div className="inline" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn--solid" disabled={adding}>
                <Ic name="plus" />
                {adding ? "Adding…" : "Add brand"}
              </button>
            </div>
          </form>
          <p className="help" style={{ marginTop: 10 }}>
            Paste the address of any page on the site — we keep the domain, which is what
            Search Console and citation matching are keyed on.
          </p>
          {err && <p className="err" role="alert" style={{ marginTop: 10 }}>{err}</p>}
          {hint && <p className="help" role="alert" style={{ marginTop: 6 }}>{hint}</p>}

          {made && (
            <div className="brow__made" role="status">
              <b>{made.name} is on the list, and on the SEO Analyst&apos;s, Blog Writer&apos;s and Issues&apos; too.</b>
              <p>
                It has no questions yet and its scheduled check is off, so nothing is being
                measured and nothing is being spent. Buyer questions are what a check asks —
                until it has some, there is nothing to run.
              </p>
              {made.warning && <p className="err" role="alert">{made.warning}</p>}
              <button
                type="button"
                className="btn btn--solid btn--sm"
                onClick={() => onGo(made.id, "questions")}
              >
                <Ic name="ask" />
                Write its questions
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="soon-note">{readOnlyWhy}</p>
      )}

      <section className="band">
        <RuleHead
          title="Watched"
          note="The switch is what decides whether a brand is measured on a schedule — and paid for on one. Off means it is only ever checked when somebody presses Check now."
        />
        {brands.length === 0 ? (
          <Blank title="Nothing is being watched yet">
            {mayEdit
              ? "Add the first brand above. It will arrive with no questions and its scheduled check off, so nothing runs until you write its questions and switch it on."
              : "A GEO editor adds the first one. Until then there is nothing for the engines to be asked about."}
          </Blank>
        ) : (
          <div className="rows">
            {brands.map((row) => {
              const check = checkOf(row);
              const line = checkLine(check, now);
              const busy = rowBusy === row.id;
              const confirming = confirmId === row.id;
              return (
                <div className="srow" key={row.id}>
                  <div className="srow__t">
                    <b>{row.name}</b>
                    <span>
                      {row.domain || "no domain on record"} · {questionsCell(row.prompts)} question
                      {row.prompts === 1 ? "" : "s"} · {line.text}
                    </span>
                    {confirming && (
                      <span className="brow__ask">{removeConfirmWords(row.name)}</span>
                    )}
                  </div>
                  <div className="srow__c is-auto brow__c">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={check.on === null ? "mixed" : check.on}
                      aria-label={`Scheduled check for ${row.name}`}
                      className={`sw${check.on ? " is-on" : ""}`}
                      disabled={!mayEdit || busy || check.on === null}
                      title={line.text}
                      onClick={() => void setCheck(row, !check.on)}
                    >
                      <i aria-hidden="true" />
                      <span>
                        {check.on === null ? "Not reported" : check.on ? "On" : "Off"}
                      </span>
                    </button>
                    {mayEdit && (confirming ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() => void setEnabled(row, false)}
                          disabled={busy}
                        >
                          {busy ? "Removing…" : "Yes, remove"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() => setConfirmId(null)}
                          disabled={busy}
                        >
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => setConfirmId(row.id)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="band">
        <RuleHead
          title={`Switched off${offList.length ? ` — ${n(offList.length)}` : ""}`}
          note="Removed from the panel, not deleted. Everything each one measured is still stored, and switching it back on returns it to every agent that shares this list."
        />
        {off.phase === "loading" && !off.data && <Wait what="Reading the switched-off brands" rows={2} />}
        {off.phase === "failed" && !off.data && (
          <Oops
            what="The switched-off brands could not be read."
            error={off.error || ""}
            onRetry={bumpRevision}
          />
        )}
        {off.data && offList.length === 0 && (
          <Blank title="None">
            No brand has been switched off. A brand you remove above lands here, with the
            way back beside it.
          </Blank>
        )}
        {offList.length > 0 && (
          <div className="rows">
            {offList.map((card) => {
              const busy = rowBusy === card.brand.id;
              return (
                <div className="srow" key={card.brand.id}>
                  <div className="srow__t">
                    <b>{card.brand.name}</b>
                    <span>
                      {card.brand.domain || "no domain on record"} · not measured, not billed,
                      and hidden from GEO, the SEO Analyst, Blog Writer and Issues while it is off.
                    </span>
                  </div>
                  <div className="srow__c is-auto brow__c">
                    {mayEdit ? (
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => void setEnabled(card.brand, true)}
                        disabled={busy}
                      >
                        <Ic name="up" />
                        {busy ? "Switching on…" : "Switch back on"}
                      </button>
                    ) : (
                      <span className="tag">Off</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
