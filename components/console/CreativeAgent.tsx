"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  creativeAcknowledge,
  creativeApprove,
  creativeArtifactBlob,
  creativeAutonomous,
  creativeCreate,
  creativeGenerate,
  creativeGet,
  creativeOverride,
  creativePlan,
  creativeTypes,
  creativeUpdatePlanText,
  type CreativeArtifact,
  type CreativePlan,
  type CreativeRun,
  type CreativeStep,
  type CreativeTypeMeta,
} from "@/lib/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
import { Button, Icon } from "@/lib/kit-ui";
import { useReportWork } from "@/lib/work";

/* --------------------------------------------------------------------------
   Creative Agent — the dedicated rail for brochures, decks, carousels & blog
   visuals. Routed here from the Studio start screen when the user picks a type
   beyond a standard social post. Plans the piece (reviewable), grounds it in
   brand precedent, then generates a real PDF / PPTX / image set — manually or
   autonomously (with the mandatory warning + acknowledgement), and logs every
   decision. Human override is always one click away.
   -------------------------------------------------------------------------- */

const STEP_BY_STATE: Record<string, number> = {
  INTENT: 0,
  STRATEGY: 1,
  LAYOUT: 2,
  OUTPUT: 3,
  DONE: 3,
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function CreativeAgent({
  brandId,
  brandName,
  creativeType,
  onToast,
  onBack,
}: {
  brandId: string | null;
  brandName?: string;
  creativeType: string;
  onToast: (m: string) => void;
  onBack: () => void;
}) {
  const [meta, setMeta] = useState<{
    types: CreativeTypeMeta[];
    steps: CreativeStep[];
    warning: string;
    engines: Record<string, boolean>;
  } | null>(null);
  const [run, setRun] = useState<CreativeRun | null>(null);
  const [brief, setBrief] = useState("");
  const [autonomous, setAutonomous] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  // Carousel only: whether each slide carries copy ("text") or is the on-brand
  // image with just the brand logo ("images_only").
  const [textMode, setTextMode] = useState<"text" | "images_only">("text");
  // Per-slide copy the user edits before generation (text mode), keyed by frame index.
  const [frameEdits, setFrameEdits] = useState<Record<number, { headline: string; body: string }>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  useReportWork(busy || generating);
  const [showWarning, setShowWarning] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    creativeTypes()
      .then((d) =>
        setMeta({ types: d.types, steps: d.steps, warning: d.autonomous_warning, engines: d.engines }),
      )
      .catch((e) => onToast((e as Error).message));
  }, [onToast]);

  // Drive a long generation (manual generate OR autonomous) while polling the run
  // so slides appear as they finish instead of after one long blocking spinner.
  const runWithProgress = useCallback(
    async (runId: string, fire: () => Promise<CreativeRun>, doneToast: string) => {
      setGenerating(true);
      let active = true;
      const poll = async () => {
        while (active) {
          await sleep(2000);
          try {
            const r = await creativeGet(runId);
            if (mounted.current) setRun(r);
            if (r.state === "DONE") active = false;
          } catch {
            /* transient — keep polling */
          }
        }
      };
      const polling = poll();
      try {
        const final = await fire();
        if (mounted.current) {
          setRun(final);
          onToast(doneToast);
        }
      } catch (e) {
        if (mounted.current) onToast((e as Error).message);
      } finally {
        active = false;
        await polling;
        if (mounted.current) setGenerating(false);
      }
    },
    [onToast],
  );

  const typeMeta = meta?.types.find((t) => t.key === creativeType);
  const engineReady = meta ? meta.engines[creativeType] !== false : true;
  const activeStep = run ? STEP_BY_STATE[run.state] ?? 0 : -1;
  const isCarousel = creativeType === "carousel";
  // Whether the user is editing per-slide copy (carousel in text mode, plan ready).
  const editingCopy = isCarousel && run?.text_mode !== "images_only";

  // Seed the editable per-slide fields whenever a fresh plan arrives (initial plan
  // or a regenerate). User keystrokes update frameEdits only, not run.plan, so this
  // effect does not fight typing — it re-fires solely when the server plan changes.
  useEffect(() => {
    const frames = run?.plan?.frames;
    if (!frames) return;
    const seed: Record<number, { headline: string; body: string }> = {};
    for (const f of frames) seed[f.index] = { headline: f.headline ?? "", body: f.body ?? "" };
    setFrameEdits(seed);
  }, [run?.plan]);

  const wrap = useCallback(
    async (fn: () => Promise<CreativeRun>, toast?: string) => {
      setBusy(true);
      try {
        const r = await fn();
        setRun(r);
        if (toast) onToast(toast);
        return r;
      } catch (e) {
        onToast((e as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [onToast],
  );

  // Begin: manual → create + plan; autonomous → create, then gate on the warning.
  const begin = async () => {
    if (autonomous) {
      setShowWarning(true);
      return;
    }
    const r = await wrap(() =>
      creativeCreate({
        creative_type: creativeType,
        brand_id: brandId,
        brief,
        text_mode: isCarousel ? textMode : "text",
      }),
    );
    if (r) await wrap(() => creativePlan(r.id, { count }), "Plan ready — review it below");
  };

  // User acknowledged the autonomous warning → create, ack, run end-to-end.
  const confirmAutonomous = async () => {
    setShowWarning(false);
    const r = await wrap(() =>
      creativeCreate({
        creative_type: creativeType,
        brand_id: brandId,
        brief,
        autonomous: true,
        text_mode: isCarousel ? textMode : "text",
      }),
    );
    if (!r) return;
    const acked = await wrap(() => creativeAcknowledge(r.id));
    if (!acked) return;
    // Autonomous plans + approves + generates in one call — poll so the user sees
    // slides stream in rather than staring at a spinner for minutes.
    await runWithProgress(
      acked.id,
      () => creativeAutonomous(acked.id, { count }),
      "Autonomous run complete",
    );
  };

  const regenerate = () => run && wrap(() => creativePlan(run.id, { count }), "Plan regenerated");
  const approveAndGenerate = async () => {
    if (!run) return;
    // Carousel text mode: push the user's exact per-slide copy into the plan first,
    // so the rendered slides carry the headlines/sub-text they typed.
    if (editingCopy && run.plan?.frames) {
      const frames = run.plan.frames.map((f) => ({
        index: f.index,
        headline: frameEdits[f.index]?.headline ?? f.headline,
        body: frameEdits[f.index]?.body ?? f.body,
      }));
      const updated = await wrap(() => creativeUpdatePlanText(run.id, frames));
      if (!updated) return;
    }
    const a = await wrap(() => creativeApprove(run.id));
    if (a) await runWithProgress(a.id, () => creativeGenerate(a.id), "Creative generated");
  };
  const takeControl = () => run && wrap(() => creativeOverride(run.id), "You now have manual control");

  const download = async (art: CreativeArtifact) => {
    try {
      const url = await creativeArtifactBlob(art.url);
      const a = document.createElement("a");
      a.href = url;
      a.download = art.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      onToast((e as Error).message);
    }
  };

  /* ------------------------------- SETUP -------------------------------- */
  if (!run) {
    return (
      <div className="gdwrap gdwrap--idle">
        <div className="gdlaunch crea-setup">
          <button className="gdminibtn" onClick={onBack}>
            <Icon name="arrow-left" size={14} /> Back to creative types
          </button>
          <span className="gdlaunch__eyebrow">
            <Icon name="sparkles" size={12} /> Creative Agent
          </span>
          <h2 className="gdlaunch__title">{typeMeta?.label ?? creativeType}</h2>
          {typeMeta && (
            <p className="crea-note">
              {typeMeta.notes}
              <br />
              <strong>Output:</strong> {typeMeta.output_format.toUpperCase()} ·{" "}
              {typeMeta.aspect_ratio} · {brandName ?? brandId}
            </p>
          )}

          {!engineReady && (
            <div className="crea-banner crea-banner--warn">
              <Icon name="triangle-alert" size={14} /> The {typeMeta?.output_format.toUpperCase()}{" "}
              engine isn’t installed on the server. You can still plan; generation needs the
              dependency added.
            </div>
          )}

          <div className="gdfield gdlaunch__field">
            <span className="gdfield__label">What is this creative for?</span>
            <textarea
              className="gdselect crea-textarea"
              rows={3}
              placeholder="e.g. A hiring-drive carousel for law firms highlighting our virtual legal staff."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>

          {isCarousel && (
            <div className="gdfield gdlaunch__field">
              <span className="gdfield__label">What goes on each slide?</span>
              <div className="crea-choice" role="radiogroup" aria-label="Carousel content mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={textMode === "text"}
                  className={"crea-choice__opt" + (textMode === "text" ? " is-active" : "")}
                  onClick={() => setTextMode("text")}
                >
                  <Icon name="type" size={15} />
                  <span className="crea-choice__t">Text on images</span>
                  <span className="crea-choice__d">
                    Add a headline &amp; sub-text to each slide — you’ll set the exact wording next.
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={textMode === "images_only"}
                  className={"crea-choice__opt" + (textMode === "images_only" ? " is-active" : "")}
                  onClick={() => setTextMode("images_only")}
                >
                  <Icon name="image" size={15} />
                  <span className="crea-choice__t">Images with brand logo only</span>
                  <span className="crea-choice__d">
                    On-brand images with just the logo — no headline or body copy.
                  </span>
                </button>
              </div>
            </div>
          )}

          {typeMeta && (
            <div className="gdfield gdlaunch__field">
              <span className="gdfield__label">
                {typeMeta.unit[0].toUpperCase() + typeMeta.unit.slice(1)} count
              </span>
              <input
                className="gdselect"
                type="number"
                min={typeMeta.min_count}
                max={typeMeta.max_count}
                placeholder={`Auto (${typeMeta.default_count})`}
                value={count ?? ""}
                onChange={(e) => setCount(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          )}

          <label className="crea-toggle">
            <input
              type="checkbox"
              checked={autonomous}
              onChange={(e) => setAutonomous(e.target.checked)}
            />
            <span>
              <strong>Autonomous mode</strong> — let the agent handle all 4 steps end-to-end.
            </span>
          </label>

          <Button
            onClick={begin}
            disabled={busy}
            size="lg"
            variant="brand"
            fullWidth
            iconLeft={<Icon name="sparkles" size={16} />}
          >
            {busy ? "Working…" : autonomous ? "Start autonomous run" : "Plan this creative"}
          </Button>
        </div>

        {showWarning && meta && (
          <AutonomousWarning
            text={meta.warning}
            onCancel={() => setShowWarning(false)}
            onConfirm={confirmAutonomous}
          />
        )}
      </div>
    );
  }

  /* ------------------------------- WORKSPACE ---------------------------- */
  return (
    <div className="gdwrap crea-wrap">
      <div className="crea-head">
        <button className="gdminibtn" onClick={onBack}>
          <Icon name="arrow-left" size={14} /> Exit
        </button>
        <h2 className="crea-title">
          {typeMeta?.label ?? creativeType}
          <span className="crea-badge">{run.output_format.toUpperCase()}</span>
          {run.autonomous && <span className="crea-badge crea-badge--auto">Autonomous</span>}
        </h2>
        {run.autonomous && run.state !== "DONE" && (
          <Button onClick={takeControl} disabled={busy} size="sm" variant="ghost">
            <Icon name="shield-alert" size={14} /> Take manual control
          </Button>
        )}
      </div>

      {/* Stepper */}
      <ol className="crea-steps">
        {(meta?.steps ?? []).map((s, i) => (
          <li
            key={s.key}
            className={
              "crea-step" +
              (i === activeStep ? " is-active" : "") +
              (i < activeStep || run.state === "DONE" ? " is-done" : "")
            }
          >
            <span className="crea-step__n">
              {i < activeStep || run.state === "DONE" ? <Icon name="check" size={12} /> : i + 1}
            </span>
            <span className="crea-step__label">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="crea-grid">
        <div className="crea-main">
          {/* Grounding / references */}
          {run.references.length > 0 && (
            <div className="crea-card">
              <h3 className="crea-card__h">
                <Icon name="shield-check" size={14} /> Grounded in {run.references.length} brand
                reference{run.references.length > 1 ? "s" : ""}
              </h3>
              <div className="crea-refs">
                {run.references.map((r) => (
                  <span key={r.id} className="crea-ref">
                    {r.file_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Plan review */}
          {run.plan && (
            <div className="crea-card">
              <h3 className="crea-card__h">
                <Icon name="layout-grid" size={14} /> Plan
                <span className="crea-src">
                  {run.plan.source === "agent+llm" ? "AI-planned" : "drafted"}
                </span>
              </h3>
              <p className="crea-rationale">{run.plan.rationale}</p>
              {editingCopy && run.plan.frames && run.state !== "DONE" && !generating ? (
                <CarouselTextEditor
                  frames={run.plan.frames}
                  edits={frameEdits}
                  disabled={busy}
                  onChange={(index, field, value) =>
                    setFrameEdits((prev) => ({
                      ...prev,
                      [index]: { ...(prev[index] ?? { headline: "", body: "" }), [field]: value },
                    }))
                  }
                />
              ) : isCarousel && run.text_mode === "images_only" && run.plan.frames ? (
                <ImagesOnlyPlanView frames={run.plan.frames} />
              ) : (
                <PlanView plan={run.plan} />
              )}

              {run.state !== "DONE" && !run.autonomous && !generating && (
                <div className="crea-actions">
                  <Button onClick={regenerate} disabled={busy} size="sm" variant="ghost">
                    <Icon name="refresh-cw" size={14} /> Regenerate
                  </Button>
                  <Button
                    onClick={approveAndGenerate}
                    disabled={busy || !engineReady}
                    size="sm"
                    variant="brand"
                  >
                    <Icon name="check" size={14} /> Approve &amp; generate
                  </Button>
                </div>
              )}
              {!engineReady && run.state !== "DONE" && (
                <p className="crea-hint">
                  Generation is disabled until the {run.output_format.toUpperCase()} engine is
                  installed on the server.
                </p>
              )}
            </div>
          )}

          {/* Output — progress while generating, live thumbnails as frames land */}
          {(generating || run.artifacts.length > 0) && (
            <div className="crea-card">
              <h3 className="crea-card__h">
                {generating ? (
                  <>
                    <Icon name="loader-circle" size={14} /> Generating
                    {run.progress ? ` — ${run.progress.done}/${run.progress.total}` : "…"}
                  </>
                ) : (
                  <>
                    <Icon name="check" size={14} /> Output ({run.artifacts.length})
                  </>
                )}
              </h3>

              {generating && run.progress && run.progress.total > 0 && (
                <div className="crea-progress" aria-label="generation progress">
                  <div
                    className="crea-progress__bar"
                    style={{ width: `${(run.progress.done / run.progress.total) * 100}%` }}
                  />
                </div>
              )}

              {/* Image previews (carousel slides / blog images) appear as they finish */}
              {run.artifacts.some((a) => a.mime.startsWith("image/")) && (
                <div className="crea-thumbs">
                  {[...run.artifacts]
                    .filter((a) => a.mime.startsWith("image/"))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((a) => (
                      <button
                        key={a.name}
                        className="crea-thumb"
                        onClick={() => download(a)}
                        title={`Download ${a.name}`}
                      >
                        <ArtifactThumb art={a} />
                        <span className="crea-thumb__cap">{a.name}</span>
                      </button>
                    ))}
                  {generating &&
                    run.progress &&
                    Array.from({
                      length: Math.max(
                        0,
                        run.progress.total -
                          run.artifacts.filter((a) => a.mime.startsWith("image/")).length,
                      ),
                    }).map((_, i) => <div key={`ph-${i}`} className="crea-thumb crea-thumb--ph" />)}
                </div>
              )}

              {/* Downloads — every artifact incl. the bundled zip */}
              {run.artifacts.length > 0 && (
                <ul className="crea-files">
                  {[...run.artifacts]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((a) => (
                      <li key={a.name} className="crea-file">
                        <span className="crea-file__name">{a.name}</span>
                        <span className="crea-file__meta">{fmtBytes(a.bytes)}</span>
                        <button className="gdminibtn" onClick={() => download(a)}>
                          <Icon name="download" size={14} /> Download
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Decision log — the audit trail */}
        <aside className="crea-side">
          <button className="crea-log__toggle" onClick={() => setShowLog((v) => !v)}>
            <Icon name={showLog ? "chevron-down" : "chevron-right"} size={14} /> Decision log (
            {run.decision_log.length})
          </button>
          {showLog && (
            <ol className="crea-log">
              {run.decision_log.map((d, i) => (
                <li key={i} className={"crea-log__item crea-log__item--" + d.source}>
                  <div className="crea-log__top">
                    <span className="crea-log__step">{d.step}</span>
                    <span className="crea-log__src">{d.source}</span>
                  </div>
                  <div className="crea-log__decision">{d.decision}</div>
                  <div className="crea-log__why">{d.rationale}</div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

/* --------------------------- Artifact thumbnail ------------------------- */
/* Fetches the image with the auth header into an object URL so it can render in an
   <img>, and revokes it on unmount. */
function ArtifactThumb({ art }: { art: CreativeArtifact }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    creativeArtifactBlob(art.url)
      .then((u) => {
        url = u;
        if (alive) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [art.url]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="crea-thumb__img" src={src} alt={art.name} />
  ) : (
    <span className="crea-thumb__loading">
      <Icon name="loader-circle" size={16} />
    </span>
  );
}

/* ----------------------------- Plan renderer ---------------------------- */
function PlanView({ plan }: { plan: CreativePlan }) {
  if (plan.frames) {
    return (
      <div className="crea-plan-grid">
        {plan.frames.map((f) => (
          <div key={f.index} className="crea-frame">
            <div className="crea-frame__role">
              {f.index}. {f.role}
            </div>
            <div className="crea-frame__head">{f.headline}</div>
            <div className="crea-frame__body">{f.body}</div>
            <div className="crea-frame__visual">{f.visual}</div>
          </div>
        ))}
      </div>
    );
  }
  if (plan.slides) {
    return (
      <div className="crea-plan-grid">
        {plan.slides.map((s) => (
          <div key={s.index} className="crea-frame">
            <div className="crea-frame__role">Slide {s.index}</div>
            <div className="crea-frame__head">{s.title}</div>
            <ul className="crea-bullets">
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            {s.notes && <div className="crea-frame__visual">Notes: {s.notes}</div>}
          </div>
        ))}
      </div>
    );
  }
  if (plan.sections) {
    return (
      <div className="crea-plan-list">
        {plan.cover && (
          <div className="crea-frame crea-frame--cover">
            <div className="crea-frame__role">Cover</div>
            <div className="crea-frame__head">{plan.cover.title}</div>
            <div className="crea-frame__body">{plan.cover.subtitle}</div>
          </div>
        )}
        {plan.sections.map((s, i) => (
          <div key={i} className="crea-frame">
            <div className="crea-frame__head">{s.heading}</div>
            <div className="crea-frame__body">{s.body}</div>
            <ul className="crea-bullets">
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
        {plan.contact && <div className="crea-frame__visual">{plan.contact.line}</div>}
      </div>
    );
  }
  if (plan.cover) {
    return (
      <div className="crea-plan-list">
        <div className="crea-frame crea-frame--cover">
          <div className="crea-frame__role">Cover</div>
          <div className="crea-frame__head">{plan.cover.title}</div>
          <div className="crea-frame__body">{plan.cover.subtitle}</div>
          <div className="crea-frame__visual">{plan.cover.visual}</div>
        </div>
        {(plan.inline ?? []).map((inl, i) => (
          <div key={i} className="crea-frame">
            <div className="crea-frame__role">In-article {i + 1}</div>
            <div className="crea-frame__head">{inl.caption}</div>
            <div className="crea-frame__visual">{inl.visual}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/* ------------------- Carousel per-slide copy editor --------------------- */
/* Text mode: the agent drafts a headline + sub-text per slide; the user sets the
   EXACT wording here before generation. Empty fields simply render no text. */
function CarouselTextEditor({
  frames,
  edits,
  disabled,
  onChange,
}: {
  frames: NonNullable<CreativePlan["frames"]>;
  edits: Record<number, { headline: string; body: string }>;
  disabled: boolean;
  onChange: (index: number, field: "headline" | "body", value: string) => void;
}) {
  return (
    <div className="crea-copy">
      <p className="crea-hint">
        Set the exact text for each slide. The agent drafted a starting point — edit it
        freely. Leave a field blank to omit that line.
      </p>
      <div className="crea-copy-grid">
        {frames.map((f) => {
          const e = edits[f.index] ?? { headline: f.headline ?? "", body: f.body ?? "" };
          return (
            <div key={f.index} className="crea-copy-card">
              <div className="crea-frame__role">
                Slide {f.index} · {f.role}
              </div>
              <label className="gdfield">
                <span className="gdfield__label">Headline</span>
                <input
                  className="gdselect"
                  value={e.headline}
                  disabled={disabled}
                  placeholder="Slide headline"
                  onChange={(ev) => onChange(f.index, "headline", ev.target.value)}
                />
              </label>
              <label className="gdfield">
                <span className="gdfield__label">Sub-text</span>
                <textarea
                  className="gdselect crea-textarea"
                  rows={2}
                  value={e.body}
                  disabled={disabled}
                  placeholder="Supporting line (optional)"
                  onChange={(ev) => onChange(f.index, "body", ev.target.value)}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Images-only carousel: no copy is drawn, so preview each slide's subject + the
   single shared element (brand logo). */
function ImagesOnlyPlanView({ frames }: { frames: NonNullable<CreativePlan["frames"]> }) {
  return (
    <div className="crea-copy">
      <p className="crea-hint">
        <Icon name="image" size={13} /> Images-only mode — each slide is an on-brand image with
        just the brand logo. No headline or body copy is added.
      </p>
      <div className="crea-plan-grid">
        {frames.map((f) => (
          <div key={f.index} className="crea-frame">
            <div className="crea-frame__role">Slide {f.index}</div>
            <div className="crea-frame__visual">{f.visual}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Autonomous warning -------------------------- */
function AutonomousWarning({
  text,
  onCancel,
  onConfirm,
}: {
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="crea-modal" role="dialog" aria-modal="true">
      <div className="crea-modal__box">
        <h3 className="crea-modal__h">
          <Icon name="shield-alert" size={18} /> Autonomous Mode
        </h3>
        <p className="crea-modal__text">{text}</p>
        <div className="crea-modal__actions">
          <Button onClick={onCancel} variant="ghost" size="sm">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="brand" size="sm">
            I understand — let the agent proceed
          </Button>
        </div>
      </div>
    </div>
  );
}
