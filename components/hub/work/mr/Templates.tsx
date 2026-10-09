"use client";

/** The team's report template: one for the whole workspace, which any member
 *  may change (the owner's decision — no admin gate).
 *
 *  One screen, opened inline under the Vendor Performance band rather than in a
 *  dialog, because a preview needs the width. It leads with one drop zone: the
 *  server decides from the file's bytes whether it is a sample to read (PDF or
 *  picture, one model call) or an HTML template to check (no call), so the
 *  panel never asks which kind it is.
 *
 *  Every preview is the server's HTML in the shared sandboxed viewer
 *  (`reportFrame.ts`) — a template is HTML a team member uploaded, and it never
 *  runs in this origin. Every state is chosen by the reply's `code`, and
 *  placeholder problems, missing figures and the daily limit are never red.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  apiBody, apiCode, apiStatus, mrActivateTemplate, mrPreviewTemplateLayout,
  mrReadTemplateSample, mrSaveTemplate, mrTemplateLayout, mrTemplateStarterFileUrl,
  readTemplateProblems,
  type MrLayout, type MrTemplateHtmlCheck, type MrTemplateListing, type MrTemplatePlaceholder,
  type MrTemplatePreview, type MrTemplateProblem, type MrTemplateSampleReading,
  type MrTemplateSave, type MrTemplateVersion,
} from "@/lib/api";
import { useLoadSession, type Load } from "@/lib/load";
import { vendorStamp } from "@/components/console/mr/reportMeta";
import { Ic } from "../../Sprite";
import { Oops, RuleHead, Wait } from "../../ui";
import type { ToastFn } from "../../context";
import { ReportFrame } from "./reportFrame";
import {
  arrange, clause, handPlan, historyRows, layoutOf, madeBy, madeFrom, matchedLine, moveRow,
  moveRowTo, noPreviewLine, previewHoldsSave, previewOf, problemParts, problemsHeading,
  rateLimitedLine, readFailure, readingsLeftLine, removedLine, renameRow, sameLayout,
  sectionTitles, sectionTypes, setByLine, showRow, switchedLine, versionLabel,
  type Arrangement, type ArrangeRow,
} from "./templateModel";

/** Where the panel is. One at a time, so a reading in flight and a preview
 *  being arranged can never both be on screen. */
type Step =
  | { kind: "start" }
  | { kind: "reading"; file: File }
  | { kind: "opening" }
  | { kind: "upload"; reason: string; unsupported: { title: string; description: string }[] }
  | { kind: "reader"; file: File; reason: string; billed: boolean }
  | { kind: "check"; file: File; reason: string }
  | { kind: "html"; file: File; check: MrTemplateHtmlCheck }
  | {
      kind: "arrange";
      /** What a save records as the version's origin. */
      source: { source_kind: "pdf" | "image" | "builder"; filename: string | null };
      reading: MrTemplateSampleReading | null;
      /** One quiet line about where the sections came from, when it needs saying. */
      note: string | null;
      arrangement: Arrangement;
      preview: MrTemplatePreview;
      /** The layout the preview on screen was rendered from. */
      previewKey: string;
      previewing: boolean;
      previewError: string | null;
    };

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.html,.htm,application/pdf,image/png,image/jpeg,text/html";
const keyOf = (layout: MrLayout) => JSON.stringify(layout);

export function TemplatePanel({ listing, me, onChanged, onRetry, onClose, onToast }: {
  listing: Load<MrTemplateListing>;
  /** The reader's email — the backend records people by theirs. */
  me: string | null;
  /** A template was saved or switched: re-read the listing and the band's line. */
  onChanged: () => void;
  onRetry: () => void;
  onClose: () => void;
  onToast: ToastFn;
}) {
  const session = useLoadSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLElement>(null);
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [over, setOver] = useState(false);
  // Today's readings, as the last reply said — newer than the listing's.
  const [left, setLeft] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  // `check`: the server could not check the HTML — an Oops with Try again.
  const [saveError, setSaveError] = useState<{ text: string; tone: "calm" | "err" | "check" } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switched, setSwitched] = useState<{ line: string; back: Pick<MrTemplateVersion, "id" | "kind" | "number"> } | null>(null);

  const data = listing.data;
  const placeholders = data?.placeholders ?? [];
  const types = sectionTypes(placeholders);
  const titles = sectionTitles(placeholders);
  const readingsLeft = left ?? data?.readings_left_today ?? null;
  const month = data?.examples_from?.label ?? null;

  useEffect(() => { top.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, []);
  useEffect(() => { setLeft(null); }, [data]);

  const toStart = () => { setStep({ kind: "start" }); setSaveError(null); setConfirming(false); };

  /** Arrange a layout: rows from it, then a fresh preview only if the rows are
   *  not exactly what the given preview was rendered from. */
  const openArrange = useCallback((
    layout: MrLayout,
    source: { source_kind: "pdf" | "image" | "builder"; filename: string | null },
    reading: MrTemplateSampleReading | null,
    note: string | null = null,
  ) => {
    const arrangement = arrange(layout, types);
    // The reading's own preview stands while the rows render exactly what it
    // was made from. Pinning the header and footer can add a section the
    // sample did not have; then the key differs and the effect below asks again.
    const current = reading !== null && sameLayout(layoutOf(arrangement), reading.layout);
    setSaveError(null);
    setStep({
      kind: "arrange", source, reading, note, arrangement,
      preview: reading
        ? previewOf(reading)
        : { preview_html: null, preview_unavailable_reason: null, preview_unavailable_code: null },
      previewKey: current ? keyOf(layoutOf(arrangement)) : "",
      previewing: false,
      previewError: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join(",")]);

  /** "Arrange sections by hand", with no sample read. It always has somewhere
   *  to start (see `handPlan`): the built-in's layout from the listing, or the
   *  version in use, read once from its layout route. */
  const arrangeByHand = useCallback(async () => {
    if (!data) return;
    const plan = handPlan(data.active);
    const builder = { source_kind: "builder" as const, filename: null };
    setSaveError(null);
    if (plan.from === "builtin" && data.default_layout) {
      openArrange(data.default_layout, builder, null, plan.note);
      return;
    }
    setStep({ kind: "opening" });
    const attempt = session.begin("tpl-hand");
    try {
      const got = await mrTemplateLayout(plan.from === "version" ? plan.id : "builtin");
      if (!attempt.current()) return;
      openArrange(got.layout, builder, null, plan.from === "builtin" ? plan.note : null);
    } catch (e: unknown) {
      const message = attempt.failure(e, "The template's sections could not be opened.");
      if (message === null) return;
      if (apiCode(e) === "not_a_layout" && data.default_layout) {
        // The version in use turned out to be HTML (the listing was behind):
        // the built-in's sections, said in the same quiet line.
        openArrange(data.default_layout, builder, null,
          `${clause(message)}. This starts from the built-in layout.`);
        return;
      }
      setStep({ kind: "start" });
      onToast(`${clause(message)}. Nothing was changed.`, "error");
      if (apiCode(e) === "not_found") onChanged();
    }
  }, [data, session, openArrange, onToast, onChanged]);

  /* ------------------------------ reading a file ------------------------------ */

  const read = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    setSaveError(null);
    setStep({ kind: "reading", file });
    const attempt = session.begin("tpl-read");
    try {
      const reading = await mrReadTemplateSample(file);
      if (!attempt.current()) return;
      if (reading.source_kind === "html") {
        setStep({ kind: "html", file, check: reading });
        return;
      }
      if (reading.readings_left_today !== null) setLeft(reading.readings_left_today);
      openArrange(reading.layout,
        { source_kind: reading.source_kind, filename: reading.upload.filename ?? file.name }, reading);
    } catch (e: unknown) {
      const message = attempt.failure(e, "The sample could not be read.");
      if (message === null) return;
      const body = apiBody(e);
      if (typeof body.readings_left_today === "number") setLeft(body.readings_left_today);
      const failure = readFailure(apiCode(e), apiStatus(e));
      if (failure === "limit") {
        setLeft(0);
        setStep({ kind: "start" });
      } else if (failure === "reader") {
        setStep({ kind: "reader", file, reason: message, billed: body.billed === true });
      } else if (failure === "check") {
        setStep({ kind: "check", file, reason: message });
      } else {
        const unsupported = Array.isArray(body.unsupported)
          ? body.unsupported.map((u) => {
              const o = (u && typeof u === "object" ? u : {}) as Record<string, unknown>;
              return { title: typeof o.title === "string" && o.title ? o.title : "A section",
                       description: typeof o.description === "string" ? o.description : "" };
            })
          : [];
        setStep({ kind: "upload", reason: message, unsupported });
      }
    }
  }, [session, openArrange]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(e.dataTransfer.files?.[0]);
  };

  /* ------------------------------- the preview -------------------------------- */

  const arrangeLayout = step.kind === "arrange" ? layoutOf(step.arrangement) : null;
  const arrangeKey = arrangeLayout ? keyOf(arrangeLayout) : "";
  const shownKey = step.kind === "arrange" ? step.previewKey : "";

  // Refreshes after each change. Debounced so typing a title asks once, and on
  // its own slot so a newer arrangement supersedes an older answer.
  useEffect(() => {
    if (!arrangeLayout || arrangeKey === shownKey) return;
    const timer = setTimeout(async () => {
      const attempt = session.begin("tpl-preview");
      setStep((s) => (s.kind === "arrange" ? { ...s, previewing: true } : s));
      try {
        const preview = await mrPreviewTemplateLayout(arrangeLayout);
        if (!attempt.current()) return;
        setStep((s) => (s.kind === "arrange"
          ? { ...s, preview, previewKey: arrangeKey, previewing: false, previewError: null } : s));
      } catch (e: unknown) {
        const message = attempt.failure(e, "The preview could not be updated.");
        if (message === null) return;
        setStep((s) => (s.kind === "arrange"
          ? { ...s, previewKey: arrangeKey, previewing: false, previewError: message } : s));
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangeKey, shownKey]);

  const edit = (change: (a: Arrangement) => Arrangement) =>
    setStep((s) => (s.kind === "arrange" ? { ...s, arrangement: change(s.arrangement) } : s));

  /* --------------------------------- saving ----------------------------------- */

  const save = async () => {
    if (step.kind !== "arrange" && step.kind !== "html") return;
    setSaving(true);
    setSaveError(null);
    try {
      // `sanitized_html` goes back to the server, which checks it again and
      // stores its own result. It is never shown: it carries no CSP, and the
      // only thing the viewer is given is `previewOf(check)`.
      const body: MrTemplateSave = step.kind === "html"
        ? { source_kind: "html", filename: step.check.upload.filename ?? step.file.name,
            html: step.check.sanitized_html ?? await step.file.text() }
        : { source_kind: step.source.source_kind, filename: step.source.filename,
            layout: layoutOf(step.arrangement) };
      const version = await mrSaveTemplate(body);
      onToast(version?.number != null
        ? `Saved as version ${version.number}. The team's next report will use it.`
        : "Saved. The team's next report will use it.", "ok");
      setConfirming(false);
      toStart();
      setSwitched(null);
      onChanged();
    } catch (e: unknown) {
      setConfirming(false);
      const code = apiCode(e);
      const reason = e instanceof Error ? e.message : "";
      const problems = readTemplateProblems(apiBody(e).errors);
      if (code === "template_invalid" && step.kind === "html" && problems.length) {
        // The server's re-check found what the first check did not: show it as
        // the same list, with no Save.
        setStep({ ...step, check: { ...step.check, errors: problems, can_save: false } });
      } else if (code === "template_invalid") {
        setSaveError({ tone: "calm", text: `This template doesn't render with your figures: ${clause(reason)}. It can't be saved as it is.` });
      } else if (code === "check_unavailable") {
        // The checker could not run: the file was not checked, so it was not
        // saved. Try again sends the same save.
        setSaveError({ tone: "check", text: reason || "The template checker could not run just now." });
      } else if (code === "invalid_layout" || code === "invalid_template" || code === "too_large") {
        // `too_large` is the 413 on the body's size (refused before auth) or
        // the 422 from the store; the server's reason says which limit.
        setSaveError({ tone: "calm", text: `${clause(reason)}. Nothing was saved.` });
      } else {
        const text = apiStatus(e) === 404
          ? "Team templates are not switched on for this server any more. Nothing was saved."
          : `${clause(reason) || "The template was not saved"}. Nothing was saved.`;
        setSaveError({ tone: "err", text });
        onToast(text, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------- switching --------------------------------- */

  const activate = async (v: Pick<MrTemplateVersion, "id" | "kind" | "number">, undo = false) => {
    const before = data?.active ?? null;
    setSwitching(true);
    try {
      const now = (await mrActivateTemplate(v.id)) ?? { ...v };
      setSwitched(undo || !before ? null : { line: switchedLine(now), back: before });
      if (undo) onToast(switchedLine(now), "ok");
      onChanged();
    } catch (e: unknown) {
      onToast(apiCode(e) === "not_found"
        ? "That version is no longer in the team's history. Nothing was switched."
        : `${clause(e instanceof Error ? e.message : "") || "The template was not switched"}. Nothing was switched.`,
        "error");
      if (apiCode(e) === "not_found") onChanged();
    } finally {
      setSwitching(false);
    }
  };

  /* ---------------------------------- render ---------------------------------- */

  const fileInput = (
    <input
      ref={fileRef}
      id="mr-template-file"
      className="tdrop__in"
      type="file"
      accept={ACCEPT}
      onChange={(e) => void read(e.target.files?.[0])}
    />
  );
  const choose = () => fileRef.current?.click();

  return (
    <section className="band tpl" id="mr-team-template" ref={top} aria-label="Team report template">
      <RuleHead
        title="Team report template"
        note="One template for every Vendor Performance report the team builds. Anyone on the team can change it, and every change is kept."
        aside={<button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>Close</button>}
      />

      {!data ? (
        listing.phase === "failed" ? (
          <Oops what="The team's template could not be read." error={listing.error || ""} onRetry={onRetry} />
        ) : (
          <Wait what="Reading the team's template" rows={3} />
        )
      ) : (
        <>
          {step.kind === "start" && (
            <>
              <div
                className={`tdrop${over ? " is-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
              >
                {fileInput}
                <label htmlFor="mr-template-file" className="tdrop__z">
                  <Ic name="upload" />
                  <b>Drop a sample report here, or choose a file</b>
                  <span>
                    A PDF or picture of a report you like. We match its sections, order, colours
                    and fonts to the figures we have.
                  </span>
                </label>
              </div>

              {readingsLeft === 0 ? (
                <p className="calm" role="status">{rateLimitedLine(data.readings_per_day)}</p>
              ) : readingsLeftLine(readingsLeft) && (
                <p className="calm">{readingsLeftLine(readingsLeft)}</p>
              )}

              <div className="ops">
                <button type="button" className="btn btn--solid btn--sm" onClick={choose}>
                  <Ic name="upload" />Upload a sample report
                </button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => void arrangeByHand()}>
                  Arrange sections by hand
                </button>
                {data.active && data.active.kind !== "builtin" && (
                  <button type="button" className="btn btn--quiet btn--sm" disabled={switching}
                    onClick={() => void activate({ id: "builtin", kind: "builtin", number: null })}>
                    Use built-in template
                  </button>
                )}
              </div>

              {switched && (
                <p className="calm" role="status">
                  {switched.line}{" "}
                  <button type="button" className="btn btn--quiet btn--sm" disabled={switching}
                    onClick={() => { const back = switched.back; setSwitched(null); void activate(back, true); }}>
                    Undo
                  </button>
                </p>
              )}

              {data.versions.length > 0 && (
                <details className="shut">
                  <summary>Earlier versions ({data.versions.length})</summary>
                  <History listing={data} me={me} switching={switching} onSwitch={(v) => void activate(v)} />
                </details>
              )}

              <details className="shut">
                <summary>Building your own HTML template</summary>
                <Placeholders placeholders={placeholders} month={month} onToast={onToast} />
              </details>
            </>
          )}

          {step.kind === "reading" && (
            <Wait what={`Reading ${step.file.name}. This takes a few seconds`} />
          )}

          {step.kind === "opening" && <Wait what="Opening the template's sections" />}

          {step.kind === "check" && (
            <>
              {fileInput}
              <Oops
                what="We couldn't check your template, so nothing was saved."
                error={step.reason}
                onRetry={() => void read(step.file)}
              />
              <p className="calm"><button type="button" className="btn btn--quiet btn--sm" onClick={toStart}>Back</button></p>
            </>
          )}

          {step.kind === "upload" && (
            <>
              {fileInput}
              <p className="calm" role="status">{step.reason}</p>
              {step.unsupported.length > 0 && <Unsupported items={step.unsupported} />}
              <div className="ops">
                <button type="button" className="btn btn--solid btn--sm" onClick={choose}>
                  <Ic name="upload" />Choose another file
                </button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={toStart}>Back</button>
              </div>
            </>
          )}

          {step.kind === "reader" && (
            <>
              {fileInput}
              <Oops
                what="We couldn't read your sample."
                error={`${clause(step.reason)}. Nothing was saved.${step.billed ? " It still counts as one of today's readings." : ""}`}
                actions={
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => void arrangeByHand()}>
                    Arrange sections by hand
                  </button>
                }
                onRetry={() => void read(step.file)}
              />
              <p className="calm"><button type="button" className="btn btn--quiet btn--sm" onClick={toStart}>Back</button></p>
            </>
          )}

          {step.kind === "html" && (
            <HtmlCheck
              check={step.check}
              fileInput={fileInput}
              onUpload={choose}
              onSave={() => setConfirming(true)}
              onDiscard={toStart}
              examplesFrom={month}
            />
          )}

          {step.kind === "arrange" && (
            <>
              {step.note && <p className="calm" role="note">{step.note}</p>}
              {step.reading && (
                <>
                  <p className="calm">{matchedLine(step.reading.matched_count, month)}</p>
                  {step.reading.unsupported.length > 0
                    ? <Unsupported items={step.reading.unsupported} />
                    : <p className="calm">Every section in your sample was matched.</p>}
                </>
              )}
              <div className="tarr">
                <SectionList arrangement={step.arrangement} titles={titles} onEdit={edit} />
                <div className="tarr__v">
                  <PreviewPane preview={step.preview} busy={step.previewing} error={step.previewError} />
                </div>
              </div>
              <div className="ops" style={{ marginTop: 14 }}>
                {/* Held while the preview on screen is not of these rows yet, and
                    when the server says THIS template does not render
                    (`template_failed`) — never on the guess that a missing
                    preview means a broken template. */}
                <button type="button" className="btn btn--solid btn--sm" onClick={() => setConfirming(true)}
                  disabled={saving || arrangeKey !== step.previewKey || previewHoldsSave(step.preview)}>
                  Save for the whole team
                </button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={toStart}>Discard</button>
              </div>
            </>
          )}

          {saveError && (saveError.tone === "check" ? (
            <Oops
              what="We couldn't check your template, so nothing was saved."
              error={saveError.text}
              onRetry={() => void save()}
            />
          ) : (
            <p className={saveError.tone === "calm" ? "calm" : "err"} role={saveError.tone === "calm" ? "status" : "alert"}>
              {saveError.text}
            </p>
          ))}
        </>
      )}

      {confirming && (
        <ConfirmSave saving={saving} onCancel={() => setConfirming(false)} onSave={() => void save()} />
      )}
    </section>
  );
}

/* --------------------------------- the parts --------------------------------- */

function Unsupported({ items }: { items: { title: string; description: string }[] }) {
  return (
    <div className="cov">
      <p className="cov__n">Not supported yet ({items.length})</p>
      <p className="cov__w">
        Your sample has these, but we have no figures for them, so they're left out rather than
        made up.
      </p>
      <ul className="cov__miss">
        {items.map((u, i) => (
          <li key={i}><b>{u.title}</b>{u.description ? <em> — {u.description}</em> : null}</li>
        ))}
      </ul>
    </div>
  );
}

/** The preview, or why there is none — chosen by `preview_unavailable_code`:
 *  `template_failed` is the spec's "doesn't render" sentence and Save is held;
 *  `no_data` and `store_unavailable` show the server's reason and leave Save
 *  open (the server renders it once more before storing it).
 *
 *  Shows only `preview_html`, the server's render WITH its CSP, and only in
 *  the sandboxed viewer. The prop type refuses an object carrying
 *  `sanitized_html` (emitted without the CSP), so handing it a whole HTML
 *  check is a compile error — pass `previewOf(check)`. */
function PreviewPane({ preview, busy, error }: {
  preview: MrTemplatePreview & { sanitized_html?: never };
  busy: boolean;
  error: string | null;
}) {
  const missing = noPreviewLine(preview);
  return (
    <>
      {busy && <Wait what="Updating the preview" />}
      {error && <p className="calm" role="status">{clause(error)}. The preview below is from before that change.</p>}
      {preview.preview_html ? (
        <ReportFrame html={preview.preview_html} title="Preview of this template with your figures" />
      ) : missing ? (
        <p className="calm" role="status">{missing}</p>
      ) : !busy && (
        <Wait what="Preparing the preview" rows={6} />
      )}
    </>
  );
}

/** Sections in report order. Pinned ones are listed where they always sit and
 *  carry "Always shown"; every other one can be moved (buttons, or dragged by
 *  its grip), shown or hidden, and renamed. */
function SectionList({ arrangement, titles, onEdit }: {
  arrangement: Arrangement;
  titles: Record<string, string>;
  onEdit: (change: (a: Arrangement) => Arrangement) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const label = (r: ArrangeRow) => titles[r.type] || r.type;
  const pinned = (r: ArrangeRow) => (
    <li className="tsec__r is-pinned" key={r.key}>
      <span className="tsec__t">{r.title || label(r)}</span>
      <span className="tag">Always shown</span>
    </li>
  );
  const last = arrangement.rows.length - 1;

  return (
    <ol className="tsec" aria-label="Sections, in report order">
      {arrangement.top.map(pinned)}
      {arrangement.rows.map((r, i) => (
        <li
          key={r.key}
          className={`tsec__r${r.shown ? "" : " is-hidden"}${dragging === r.key ? " is-dragging" : ""}`}
          onDragOver={(e) => { if (dragging) e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging) onEdit((a) => moveRowTo(a, dragging, r.key));
            setDragging(null);
          }}
        >
          {/* Only the grip drags, so selecting text in the title never starts
              one. The Move buttons are the keyboard's way to do the same. */}
          <span
            className="tsec__g"
            aria-hidden="true"
            draggable
            onDragStart={(e) => { setDragging(r.key); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => setDragging(null)}
          >
            <Ic name="grip" />
          </span>
          {/* The title has the row's first line to itself, so a section's full
              name is readable; Show and the moves sit on the line under it. In
              that order in the DOM too, so the focus order is the visual one. */}
          <input
            className="inp tsec__in"
            value={r.title ?? ""}
            placeholder={label(r)}
            maxLength={200}
            aria-label={`Title for ${label(r)}`}
            onChange={(e) => onEdit((a) => renameRow(a, r.key, e.target.value))}
          />
          <label className="tsec__show">
            <input
              type="checkbox"
              checked={r.shown}
              onChange={(e) => onEdit((a) => showRow(a, r.key, e.target.checked))}
              aria-label={`Show ${label(r)}`}
            />
            Show
          </label>
          <span className="tsec__mv">
            <button type="button" className="btn btn--quiet btn--sm" disabled={i === 0}
              aria-label={`Move ${label(r)} up`} onClick={() => onEdit((a) => moveRow(a, r.key, -1))}>
              <Ic name="up" />
            </button>
            <button type="button" className="btn btn--quiet btn--sm" disabled={i === last}
              aria-label={`Move ${label(r)} down`} onClick={() => onEdit((a) => moveRow(a, r.key, 1))}>
              <Ic name="down" />
            </button>
          </span>
        </li>
      ))}
      {arrangement.bottom.map(pinned)}
    </ol>
  );
}

/** An HTML file, checked: what was removed, then either the problems (with
 *  line numbers and a suggestion) and no Save, or the preview and Save. */
function HtmlCheck({ check, fileInput, onUpload, onSave, onDiscard, examplesFrom }: {
  check: MrTemplateHtmlCheck;
  fileInput: ReactNode;
  onUpload: () => void;
  onSave: () => void;
  onDiscard: () => void;
  examplesFrom: string | null;
}) {
  const removed = removedLine(check.removed);
  const problems: MrTemplateProblem[] = check.errors;
  return (
    <>
      {fileInput}
      {removed && <p className="calm" role="status">{removed}</p>}
      {problems.length > 0 ? (
        <>
          <div className="cov">
            <p className="cov__n">{problemsHeading(problems)}</p>
            <ul className="tprob">
              {problems.map((e, i) => {
                const p = problemParts(e);
                return (
                  <li key={i}>
                    {p.line && <span className="tprob__l">{p.line}</span>}
                    {p.placeholder && <code>{p.placeholder}</code>}
                    <span>{p.text}</span>
                  </li>
                );
              })}
            </ul>
            <p className="cov__w">Fix the file and upload it again to see the preview.</p>
          </div>
          <div className="ops" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--solid btn--sm" onClick={onUpload}>
              <Ic name="upload" />Upload the fixed file
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onDiscard}>Discard</button>
          </div>
        </>
      ) : check.can_save ? (
        <>
          {examplesFrom && check.preview_html && <p className="calm">Here it is with your {examplesFrom} figures.</p>}
          <PreviewPane preview={previewOf(check)} busy={false} error={null} />
          <div className="ops" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--solid btn--sm" onClick={onSave}
              disabled={previewHoldsSave(check)}>
              Save for the whole team
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onDiscard}>Discard</button>
          </div>
        </>
      ) : (
        <>
          <p className="calm" role="status">
            {check.preview_unavailable_reason
              ? `This file can't be saved as a template: ${clause(check.preview_unavailable_reason)}.`
              : "This file can't be saved as a template."}
          </p>
          <div className="ops">
            <button type="button" className="btn btn--solid btn--sm" onClick={onUpload}>
              <Ic name="upload" />Upload another file
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onDiscard}>Discard</button>
          </div>
        </>
      )}
    </>
  );
}

/** The confirmation every save goes through: the template is the whole team's. */
function ConfirmSave({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div
      className="rqd"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
      onKeyDown={(e) => { if (e.key === "Escape" && !saving) onCancel(); }}
    >
      <div className="rqd__card" role="dialog" aria-modal="true" aria-labelledby="mr-tpl-save-h">
        <header className="rqd__head">
          <h3 id="mr-tpl-save-h">Save this template for the whole team?</h3>
          <button type="button" className="rqd__x" onClick={onCancel} aria-label="Close" disabled={saving}>
            <Ic name="x" />
          </button>
        </header>
        <p>
          From the next report on, every Vendor Performance report anyone on the team builds will
          use it. Reports already built won't change. You can switch back to any earlier version.
        </p>
        <div className="rqd__ops">
          <button type="button" className="btn btn--quiet btn--sm" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn--solid btn--sm" onClick={onSave} disabled={saving} autoFocus>
            {saving ? "Saving…" : "Save for the whole team"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Every version the team has saved, newest first, and the built-in last. */
function History({ listing, me, switching, onSwitch }: {
  listing: MrTemplateListing;
  me: string | null;
  switching: boolean;
  onSwitch: (v: MrTemplateVersion) => void;
}) {
  return (
    <div className="tw">
      <table className="rt">
        <thead><tr><th>Version</th><th>Made from</th><th>By</th><th>When</th><th /></tr></thead>
        <tbody>
          {historyRows(listing).map((v) => {
            const setBy = setByLine(v, me);
            return (
              <tr key={v.id}>
                <td><b>{versionLabel(v)}</b></td>
                <td className="dim">{madeFrom(v)}</td>
                <td className="dim">{madeBy(v, me)}</td>
                <td className="dim">{vendorStamp(v.created_at) ?? "—"}</td>
                <td>
                  {v.active ? (
                    <>
                      <span className="tag is-on">In use</span>
                      {setBy && <span className="tpl__set">{setBy}</span>}
                    </>
                  ) : (
                    <button type="button" className="btn btn--quiet btn--sm" disabled={switching}
                      onClick={() => onSwitch(v)}>
                      Switch to this
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The placeholder vocabulary, each with its live value, and the starter file. */
function Placeholders({ placeholders, month, onToast }: {
  placeholders: MrTemplatePlaceholder[];
  month: string | null;
  onToast: ToastFn;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p className="calm">
        Write the report as HTML and put a placeholder wherever a figure or a section goes, then
        drop the file above. Checking a file costs no sample reading. Templates can't run code, so
        scripts are removed.
      </p>
      <div className="ops">
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              saveFile(await mrTemplateStarterFileUrl(), "vendor-report-template-starter.html");
            } catch (e: unknown) {
              onToast(`${clause(e instanceof Error ? e.message : "") || "The starter could not be fetched"}.`, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Ic name="download" />{busy ? "Preparing…" : "Download starter HTML"}
        </button>
      </div>
      {placeholders.length > 0 && (
        <>
          {month && <p className="rep__n">The values shown are from {month}.</p>}
          <div className="tw">
            <table className="rt">
              <tbody>
                {placeholders.map((p) => (
                  <tr key={p.token}>
                    <td><code>{p.token}</code></td>
                    <td>
                      {p.title && <b>{p.title}</b>}
                      {p.description && <span className="tpl__set">{p.description}</span>}
                    </td>
                    <td className="dim">{p.example !== null ? `Now ${p.example}` : ""}</td>
                    <td><CopyToken token={p.token} onToast={onToast} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function CopyToken({ token, onToast }: { token: string; onToast: ToastFn }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      aria-label={`Copy ${token}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(token);
          setCopied(true);
        } catch {
          onToast("This browser did not allow copying. Select the placeholder and copy it instead.", "error");
        }
      }}
    >
      <Ic name="copy" />{copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Hand an object URL to the browser as a download, then let it go. Never
 *  navigated to: the `download` attribute saves it, and every caller hands in
 *  a PDF or bytes re-typed so a browser cannot render them. */
export function saveFile(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Not revoked at once: some browsers still read the URL a moment after the
  // click. Ten seconds is long past that and short of leaking it for the session.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
