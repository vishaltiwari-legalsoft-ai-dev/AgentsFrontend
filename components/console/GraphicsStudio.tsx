"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  gdApprove,
  gdArtifactBlob,
  gdBack,
  gdCreateRun,
  gdGenerate,
  gdGetConfig,
  gdGetPrompts,
  gdPromptPreview,
  gdStage4,
  gdSuggest,
  gdUpdateConfig,
  type GdConfig,
  type GdExplore,
  type GdHookSuggestion,
  type GdPromptBuild,
  type GdRun,
} from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { useAuth } from "@/lib/auth";

/* --------------------------------------------------------------------------
   Graphic Designer Studio — drives the 4-stage human-in-the-loop pipeline.
   Left rail: stepper + brand kit + integrity. Center: canvas + review.
   Right rail: per-stage controls, agent suggestions, prompt audit.
   -------------------------------------------------------------------------- */

const STAGE_META = [
  { n: 1, name: "Gradient", meta: "Brand base" },
  { n: 2, name: "Photo", meta: "Concept" },
  { n: 3, name: "Text", meta: "Headline & CTA" },
  { n: 4, name: "Logo", meta: "Final composite" },
];

const CONTENT_TOKENS = ["headline", "highlight", "subtext1", "subtext2", "cta"] as const;
type TokenKey = (typeof CONTENT_TOKENS)[number];

function stageNum(state: string): number {
  if (state === "DONE") return 4;
  const m = /STAGE(\d)/.exec(state);
  return m ? Number(m[1]) : 1;
}
function isReview(state: string): boolean {
  return state.endsWith("REVIEW") || state === "DONE";
}

/* ---- auth-aware <img> (artifacts need the Bearer header) ----------------- */
function AuthImage({ path, alt, className }: { path?: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    let alive = true;
    let url: string | null = null;
    gdArtifactBlob(path)
      .then((u) => {
        if (alive) {
          url = u;
          setSrc(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  if (!src) return <div className={className} aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

/* ---- live HTML/CSS mock of the Stage-3 text overlay (locked brand spec) -- */
function MockPreview({
  tokens,
  bgPath,
  textPlacement = "left",
  ctaPlacement = "bottom",
  aspect,
}: {
  tokens: Record<string, string>;
  bgPath?: string;
  textPlacement?: string;
  ctaPlacement?: string;
  aspect?: string;
}) {
  const headline = tokens.headline || "";
  const hl = tokens.highlight || "";
  const idx = hl ? headline.indexOf(hl) : -1;
  const before = idx >= 0 ? headline.slice(0, idx) : headline;
  const after = idx >= 0 ? headline.slice(idx + hl.length) : "";
  // Mirror the AR so the preview matches the locked canvas (default 4:5).
  const arCss = aspect ? aspect.replace(":", " / ") : "4 / 5";
  return (
    <div className="gdmock" style={{ containerType: "inline-size", aspectRatio: arCss }}>
      {bgPath ? <AuthImage path={bgPath} alt="Stage 2 base" /> : null}
      <div className={`gdmock__overlay gdmock__overlay--${textPlacement}`}>
        <div className="gdmock__headline">
          {before}
          {idx >= 0 && <span className="gdmock__hl">{hl}</span>}
          {after}
        </div>
        <div className="gdmock__sub">
          <span className="gdmock__subline"><span className="gdmock__dot" />{tokens.subtext1}</span>
          <span className="gdmock__subline"><span className="gdmock__dot" />{tokens.subtext2}</span>
        </div>
        <span className={`gdmock__cta gdmock__cta--${ctaPlacement}`}>{tokens.cta} →</span>
      </div>
    </div>
  );
}

/* ---- prompt audit: highlight substituted values ------------------------- */
function AuditPrompt({ build }: { build: GdPromptBuild | null }) {
  if (!build) return <p className="gdstep__meta">Generate or select a stage to preview its prompt.</p>;
  const marks = build.diffs.map((d) => d.replace).filter(Boolean);
  const parts: { text: string; mark: boolean }[] = [{ text: build.text, mark: false }];
  for (const m of marks) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.mark || !p.text.includes(m)) continue;
      const segs = p.text.split(m);
      const replaced: { text: string; mark: boolean }[] = [];
      segs.forEach((s, j) => {
        if (j > 0) replaced.push({ text: m, mark: true });
        if (s) replaced.push({ text: s, mark: false });
      });
      parts.splice(i, 1, ...replaced);
      i += replaced.length - 1;
    }
  }
  return (
    <>
      <pre className="gdaudit__pre">
        {parts.map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
      </pre>
      {build.diffs.length > 0 && (
        <div className="gddiff">
          {build.diffs.map((d, i) => (
            <div className="gddiffrow" key={i}>
              <b>{d.token}</b>: “{d.find}” → “{d.replace}” ({d.count}×)
            </div>
          ))}
        </div>
      )}
      {build.negative_prompt && (
        <div className="gdwarn" style={{ marginTop: 8 }}>
          <Icon name="shield-alert" size={15} />
          <span>Paired negative prompt attached (skipped if the provider lacks support).</span>
        </div>
      )}
    </>
  );
}

export function GraphicsStudio({ onToast, onBack }: { onToast: (m: string) => void; onBack?: () => void }) {
  const { ready } = useAuth();
  const [config, setConfig] = useState<GdConfig | null>(null);
  const [run, setRun] = useState<GdRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [integrityOk, setIntegrityOk] = useState<boolean | null>(null);

  // local drafts
  const [sel1, setSel1] = useState("A");
  const [sel2, setSel2] = useState("A");
  const [previewAttempt, setPreviewAttempt] = useState<number | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [build, setBuild] = useState<GdPromptBuild | null>(null);
  const [showAudit, setShowAudit] = useState(true);

  // suggestions
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [conceptSugg, setConceptSugg] = useState<{ recommended: string; rationale: string } | null>(null);
  const [exploreSugg, setExploreSugg] = useState<GdExplore | null>(null);
  const [hooks, setHooks] = useState<GdHookSuggestion | null>(null);

  // stage 4
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = run ? (run.state === "DONE" ? 4 : stageNum(run.state)) : 1;
  const reviewing = run ? isReview(run.state) : false;

  const loadMeta = useCallback(() => {
    gdGetConfig().then(setConfig).catch((e) => onToast((e as Error).message));
    gdGetPrompts()
      .then((p) => setIntegrityOk(p.prompts.every((x) => x.ok)))
      .catch(() => setIntegrityOk(null));
  }, [onToast]);

  // Wait for the auth token to be restored before the first fetch, otherwise
  // these mount-time calls 401 (e.g. after a dev Fast Refresh resets the token).
  useEffect(() => {
    if (ready) loadMeta();
  }, [ready, loadMeta]);

  // sync local token drafts whenever the run changes
  useEffect(() => {
    if (run) setTokens({ ...run.config.tokens });
  }, [run?.id, run?.config.tokens]);

  const refreshBuild = useCallback(
    async (r: GdRun) => {
      const stage = r.state === "DONE" ? 4 : stageNum(r.state);
      const variant = stage === 1 ? sel1 : stage === 2 ? sel2 : "T";
      try {
        setBuild(await gdPromptPreview(r.id, stage, variant));
      } catch {
        setBuild(null);
      }
    },
    [sel1, sel2],
  );

  useEffect(() => {
    if (run) void refreshBuild(run);
  }, [run, refreshBuild]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await gdCreateRun();
      setRun(r);
      setPreviewAttempt(null);
      if (!config) loadMeta(); // ensure config loaded now the token is proven valid
      onToast("New run started");
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const wrap = async (fn: () => Promise<GdRun>) => {
    setBusy(true);
    try {
      const r = await fn();
      setRun(r);
      setPreviewAttempt(null);
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doGenerate = async () => {
    if (!run) return;
    setBusy(true);
    try {
      // Aspect ratio is chosen + persisted at Stage 1 and locked thereafter.
      const variant = active === 1 ? sel1 : active === 2 ? sel2 : undefined;
      const { run: r } = await gdGenerate(run.id, active, variant);
      setRun(r);
      const atts = r.stages[String(active)].attempts;
      setPreviewAttempt(atts.length ? atts[atts.length - 1].attempt : null);
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doStage4 = async () => {
    if (!run || !logoFile) return;
    setBusy(true);
    try {
      const { run: r } = await gdStage4(run.id, logoFile, run.config.use_ai_compositor);
      setRun(r);
      const atts = r.stages["4"].attempts;
      setPreviewAttempt(atts.length ? atts[atts.length - 1].attempt : null);
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = () => run && wrap(() => gdApprove(run.id, active, previewAttempt ?? undefined).then((r) => (onToast(`Stage ${active} approved`), r)));
  const goBack = (n: number) =>
    run && wrap(() => gdBack(run.id, n).then((r) => (onToast(`Returned to stage ${n}`), r)));

  const patchConfig = async (body: Parameters<typeof gdUpdateConfig>[1]) => {
    if (!run) return;
    try {
      setRun(await gdUpdateConfig(run.id, body));
    } catch (e) {
      onToast((e as Error).message);
    }
  };

  // current stage data
  const curStage = run?.stages[String(active)];
  const attempts = curStage?.attempts ?? [];
  const previewObj =
    attempts.find((a) => a.attempt === previewAttempt) ?? curStage?.approved ?? attempts[attempts.length - 1];
  const previewWarnings: string[] =
    previewObj && "warnings" in previewObj && Array.isArray(previewObj.warnings) ? previewObj.warnings : [];

  /* ---------------------------- IDLE / START ----------------------------- */
  if (!run) {
    return (
      <div className="gdwrap gdwrap--idle">
        <div className="gdcard" style={{ maxWidth: 460, textAlign: "center", padding: 32 }}>
          <div
            style={{
              width: 60, height: 60, borderRadius: 16, margin: "0 auto 16px",
              background: "linear-gradient(135deg, #00B4D8, #03045E)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#fff",
            }}
          >
            <Icon name="palette" size={28} />
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-primary)", margin: "0 0 6px" }}>
            Graphic Designer Studio
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
            A guided 4-stage pipeline — gradient → photo → text → logo — with brand-locked prompts and
            an approval gate at every step.
          </p>
          <Button onClick={start} disabled={busy} size="lg" iconLeft={<Icon name="sparkles" size={16} />}>
            {busy ? "Starting…" : "Start a new ad creative"}
          </Button>
          {integrityOk !== null && (
            <div className="gdintegrity" style={{ justifyContent: "center", marginTop: 16 }}>
              <Icon name={integrityOk ? "shield-check" : "shield-alert"} size={14} />
              <span>{integrityOk ? "Canonical prompts verified" : "Prompt integrity check failed"}</span>
            </div>
          )}
          {onBack && (
            <button className="gdminibtn" style={{ marginTop: 14 }} onClick={onBack}>
              ← Back to agents
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ STUDIO --------------------------------- */
  return (
    <div className="gdwrap">
      {/* LEFT RAIL */}
      <aside className="gdrail">
        <div>
          <div className="gdrow" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text-primary)" }}>
              Pipeline
            </strong>
            {onBack && (
              <button className="gdminibtn" onClick={onBack}>
                Exit
              </button>
            )}
          </div>
          <div className="gdstepper">
            {STAGE_META.map((s) => {
              const st = run.stages[String(s.n)];
              const done = !!st.approved;
              const isActive = s.n === active;
              const reachable = s.n <= active;
              return (
                <button
                  key={s.n}
                  className={`gdstep${isActive ? " gdstep--active" : ""}${done && !isActive ? " gdstep--done" : ""}`}
                  disabled={!reachable || busy}
                  onClick={() => {
                    if (s.n < active && done) {
                      if (confirm(`Go back to stage ${s.n}? This clears approvals for later stages.`)) goBack(s.n);
                    }
                  }}
                >
                  <span className="gdstep__num">{done && !isActive ? <Icon name="check" size={14} /> : s.n}</span>
                  <span className="gdstep__body">
                    <span className="gdstep__name">{s.name}</span>
                    <span className="gdstep__meta">{s.meta}</span>
                  </span>
                  <span className="gdstep__lock">
                    <Icon name={done ? "lock" : isActive ? "circle-dot" : "circle"} size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Brand kit (read-only) */}
        {config && (
          <div>
            <p className="gdsec__title">Brand Kit · locked</p>
            <div className="gdkit__block">{config.brand_kit_block}</div>
            <div className="gdswatches">
              {config.locked_colors.gradient.map((c) => (
                <span key={c} className="gdswatch" title={c} style={{ background: c }} />
              ))}
              <span className="gdswatch" title="Accent" style={{ background: config.locked_colors.accent }} />
              <span
                className="gdswatch"
                title="CTA gradient"
                style={{ background: `linear-gradient(135deg, ${config.locked_colors.cta.from}, ${config.locked_colors.cta.to})` }}
              />
            </div>
          </div>
        )}

        <div className="gdintegrity" style={{ marginTop: "auto" }}>
          <Icon name={integrityOk ? "shield-check" : "shield-alert"} size={14} />
          <span>{integrityOk === null ? "Checking prompts…" : integrityOk ? "Prompts verified" : "Integrity failed"}</span>
        </div>
      </aside>

      {/* CENTER */}
      <main className="gdmain">
        <div className="gdcanvas">
          {previewObj ? (
            <AuthImage path={previewObj.url} alt={`Stage ${active} preview`} />
          ) : (
            <div className="gdcanvas__empty">
              {active === 4
                ? "Upload a logo and composite to see the final creative."
                : `Configure stage ${active} on the right, then generate a preview.`}
            </div>
          )}
          {busy && (
            <div className="gdcanvas__spin">
              <Icon name="loader-circle" size={30} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
            </div>
          )}
        </div>

        {/* review controls */}
        {attempts.length > 0 && (
          <div className="gdreview">
            <Button onClick={approve} disabled={busy} iconLeft={<Icon name="check" size={15} />}>
              Approve stage {active}
            </Button>
            <Button variant="secondary" onClick={active === 4 ? doStage4 : doGenerate} disabled={busy || (active === 4 && !logoFile)} iconLeft={<Icon name="refresh-cw" size={15} />}>
              Regenerate
            </Button>
            {active > 1 && (
              <Button variant="ghost" onClick={() => goBack(active - 1)} disabled={busy}>
                ← Back
              </Button>
            )}
            <span className="gdreview__spacer" />
            {run.state === "DONE" && previewObj && (
              <a className="ens-btn ens-btn--md" href={previewObj.url} download={`legalsoft-creative-${run.id}.png`}>
                <Icon name="download" size={15} /> Export PNG
              </a>
            )}
          </div>
        )}

        {/* attempt history */}
        {attempts.length > 0 && (
          <div>
            <p className="gdsec__title">Attempts · approve any</p>
            <div className="gdstrip">
              {attempts.map((a) => (
                <button
                  key={a.attempt}
                  className={`gdthumb${(previewObj?.attempt === a.attempt) ? " gdthumb--sel" : ""}`}
                  onClick={() => setPreviewAttempt(a.attempt)}
                >
                  <AuthImage path={a.url} alt={`Attempt ${a.attempt}`} />
                  <span className="gdthumb__tag">{a.variant}·{a.attempt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {previewWarnings.length > 0 && (
          <div className="gdwarn">
            <Icon name="triangle-alert" size={15} />
            <span>{previewWarnings.join(" ")}</span>
          </div>
        )}
      </main>

      {/* RIGHT RAIL */}
      <aside className="gdaside">
        <StageControls
          run={run}
          config={config}
          active={active}
          reviewing={reviewing}
          busy={busy}
          sel1={sel1}
          setSel1={setSel1}
          sel2={sel2}
          setSel2={setSel2}
          tokens={tokens}
          setTokens={setTokens}
          answers={answers}
          setAnswers={setAnswers}
          conceptSugg={conceptSugg}
          setConceptSugg={setConceptSugg}
          exploreSugg={exploreSugg}
          setExploreSugg={setExploreSugg}
          hooks={hooks}
          setHooks={setHooks}
          logoFile={logoFile}
          setLogoFile={setLogoFile}
          fileRef={fileRef}
          patchConfig={patchConfig}
          doGenerate={doGenerate}
          doStage4={doStage4}
          onToast={onToast}
        />

        {/* prompt audit */}
        <div className="gdcard">
          <button
            className="gdrow"
            style={{ width: "100%", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={() => setShowAudit((v) => !v)}
          >
            <span className="gdsec__title" style={{ margin: 0 }}>Prompt audit</span>
            <Icon name={showAudit ? "chevron-up" : "chevron-down"} size={16} />
          </button>
          {showAudit && <div style={{ marginTop: 10 }}><AuditPrompt build={build} /></div>}
        </div>
      </aside>
    </div>
  );
}

/* ======================= per-stage right-rail controls ===================== */
function StageControls(props: {
  run: GdRun;
  config: GdConfig | null;
  active: number;
  reviewing: boolean;
  busy: boolean;
  sel1: string;
  setSel1: (v: string) => void;
  sel2: string;
  setSel2: (v: string) => void;
  tokens: Record<string, string>;
  setTokens: (v: Record<string, string>) => void;
  answers: Record<string, string>;
  setAnswers: (v: Record<string, string>) => void;
  conceptSugg: { recommended: string; rationale: string } | null;
  setConceptSugg: (v: { recommended: string; rationale: string } | null) => void;
  exploreSugg: GdExplore | null;
  setExploreSugg: (v: GdExplore | null) => void;
  hooks: GdHookSuggestion | null;
  setHooks: (v: GdHookSuggestion | null) => void;
  logoFile: File | null;
  setLogoFile: (f: File | null) => void;
  fileRef: React.MutableRefObject<HTMLInputElement | null>;
  patchConfig: (b: Parameters<typeof gdUpdateConfig>[1]) => Promise<void>;
  doGenerate: () => void;
  doStage4: () => void;
  onToast: (m: string) => void;
}) {
  const {
    run, config, active, busy, sel1, setSel1, sel2, setSel2, tokens, setTokens,
    answers, setAnswers, conceptSugg, setConceptSugg, exploreSugg, setExploreSugg, hooks, setHooks,
    logoFile, setLogoFile, fileRef, patchConfig, doGenerate, doStage4, onToast,
  } = props;

  if (!config) return null;

  /* ---- STAGE 1 ---- */
  if (active === 1) {
    return (
      <div className="gdcard">
        <p className="gdsec__title">Stage 1 · Gradient base</p>
        <div className="gdvariants">
          {config.stage1_variants.map((v) => (
            <button key={v.id} className={`gdvariant${sel1 === v.id ? " gdvariant--sel" : ""}`} onClick={() => setSel1(v.id)}>
              <span className="gdvariant__chip" style={{ background: v.css_gradient }} />
              <span className="gdvariant__body">
                <span className="gdvariant__title">{v.title}</span>
                <span className="gdvariant__desc">{v.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {/* aspect ratio — chosen here, locked for stages 2–4 */}
        <div className="gdfield" style={{ marginTop: 12 }}>
          <span className="gdfield__label">Aspect ratio</span>
          <select
            className="gdselect"
            value={run.config.aspect_ratio}
            onChange={(e) => patchConfig({ aspect_ratio: e.target.value })}
          >
            {config.aspect_ratios.map((a) => (
              <option key={a.ar} value={a.ar}>
                {a.label} · {a.dimensions} ({a.ar})
              </option>
            ))}
          </select>
          <span className="gdfield__hint">
            Sets the canvas for stages 2–4 and locks once you approve this stage. The gradient base itself always renders 16:9.
          </span>
        </div>

        <Button fullWidth onClick={doGenerate} disabled={busy} style={{ marginTop: 12 }} iconLeft={<Icon name="sparkles" size={15} />}>
          Generate gradient
        </Button>
        <p className="gdstep__meta" style={{ marginTop: 8 }}>{config.stage1_source_note}</p>
      </div>
    );
  }

  /* ---- STAGE 2 ---- */
  if (active === 2) {
    const recommend = async () => {
      try {
        const r = (await gdSuggest(run.id, { kind: "concept", answers })) as {
          recommended: string;
          rationale: string;
        };
        setConceptSugg(r);
        setSel2(r.recommended);
      } catch (e) {
        onToast((e as Error).message);
      }
    };
    const explore = async () => {
      try {
        setExploreSugg((await gdSuggest(run.id, { kind: "explore", answers })) as unknown as GdExplore);
      } catch (e) {
        onToast((e as Error).message);
      }
    };

    const CATEGORY_LABELS: Record<string, string> = {
      people: "People",
      object: "Objects & concepts",
      flatlay: "Flatlays",
      architecture: "Architecture",
      scene: "Scenes",
    };
    const cats = config.stage2_categories?.length
      ? config.stage2_categories
      : Array.from(new Set(config.stage2_variants.map((v) => v.category ?? "other")));
    const groups = cats
      .map((cat) => ({ cat, items: config.stage2_variants.filter((v) => (v.category ?? "other") === cat) }))
      .filter((g) => g.items.length);
    const exploreIds = new Set(
      exploreSugg ? [...exploreSugg.picks.map((p) => p.id), ...(exploreSugg.wildcard ? [exploreSugg.wildcard.id] : [])] : [],
    );

    const variantCard = (v: GdConfig["stage2_variants"][number]) => (
      <button
        key={v.id}
        className={`gdvariant${sel2 === v.id ? " gdvariant--sel" : ""}${exploreIds.has(v.id) ? " gdvariant--explore" : ""}`}
        onClick={() => setSel2(v.id)}
      >
        <span className="gdvariant__chip">{v.id}</span>
        <span className="gdvariant__body">
          <span className="gdvariant__title">{v.title}</span>
          <span className="gdvariant__desc">{v.desc}</span>
        </span>
        {conceptSugg?.recommended === v.id && (
          <span className="gdvariant__rec"><Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} /></span>
        )}
      </button>
    );

    return (
      <div className="gdcard">
        <p className="gdsec__title">Stage 2 · Photo element</p>

        {/* agent: onboarding → concept recommendation + element explorer */}
        <div className="gdsugg" style={{ marginBottom: 12 }}>
          <span className="gdsugg__hdr"><Icon name="bot" size={13} /> Creative strategist</span>
          {config.onboarding_questions.map((q) => (
            <div key={q.id} className="gdfield" style={{ marginBottom: 4 }}>
              <span className="gdfield__label">{q.question}</span>
              <div className="gdrow" style={{ flexWrap: "wrap" }}>
                {q.options.map((o) => (
                  <button
                    key={o.id}
                    className={`gdminibtn${answers[q.id] === o.id ? " gdminibtn--primary" : ""}`}
                    onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="gdrow" style={{ flexWrap: "wrap", gap: 6 }}>
            <Button size="sm" variant="secondary" onClick={recommend} disabled={busy}>
              Recommend a concept
            </Button>
            <Button size="sm" variant="secondary" onClick={explore} disabled={busy} iconLeft={<Icon name="sparkles" size={13} />}>
              Explore new elements
            </Button>
          </div>
          {conceptSugg && (
            <p className="gdsugg__text">
              <b>Recommends {conceptSugg.recommended}.</b> {conceptSugg.rationale}
            </p>
          )}

          {exploreSugg && (
            <div className="gdexplore">
              <span className="gdexplore__hdr">
                <Icon name="sparkles" size={12} /> {exploreSugg.ai ? "AI element picks" : "Elements to play with"}
              </span>
              {exploreSugg.picks.map((p) => (
                <button
                  key={p.id}
                  className={`gdexplore__pick${sel2 === p.id ? " gdexplore__pick--sel" : ""}`}
                  onClick={() => setSel2(p.id)}
                >
                  <span className="gdexplore__pick-t">{p.id} · {p.title}</span>
                  <span className="gdexplore__pick-r">{p.reason}</span>
                </button>
              ))}
              {exploreSugg.wildcard && (
                <button
                  className={`gdexplore__pick gdexplore__pick--wild${sel2 === exploreSugg.wildcard.id ? " gdexplore__pick--sel" : ""}`}
                  onClick={() => exploreSugg.wildcard && setSel2(exploreSugg.wildcard.id)}
                >
                  <span className="gdexplore__pick-t">{exploreSugg.wildcard.id} · {exploreSugg.wildcard.title} · wildcard</span>
                  <span className="gdexplore__pick-r">{exploreSugg.wildcard.reason}</span>
                </button>
              )}
              {exploreSugg.idea && <p className="gdsugg__text" style={{ marginTop: 6 }}>{exploreSugg.idea}</p>}
            </div>
          )}
        </div>

        {groups.map((g) => (
          <div key={g.cat} className="gdgroup">
            <span className="gdgroup__label">{CATEGORY_LABELS[g.cat] ?? g.cat}</span>
            <div className="gdvariants">{g.items.map(variantCard)}</div>
          </div>
        ))}

        {/* aspect ratio — locked at Stage 1 */}
        {(() => {
          const ar = config.aspect_ratios.find((a) => a.ar === run.config.aspect_ratio);
          return (
            <div className="gdfield" style={{ marginTop: 12 }}>
              <span className="gdfield__label">
                Aspect ratio
                <span className="gdfield__lock"><Icon name="lock" size={11} /> locked</span>
              </span>
              <div className="gdlocked">
                {ar ? `${ar.label} · ${ar.dimensions} (${ar.ar})` : run.config.aspect_ratio}
              </div>
              <span className="gdfield__hint">Set in Stage 1. Go back to Stage 1 to change it.</span>
            </div>
          );
        })()}

        <Button fullWidth onClick={doGenerate} disabled={busy} style={{ marginTop: 12 }} iconLeft={<Icon name="sparkles" size={15} />}>
          Generate photo composite
        </Button>
      </div>
    );
  }

  /* ---- STAGE 3 ---- */
  if (active === 3) {
    const approved = run.config.tokens_approved;
    const concept = run.stages["2"].approved?.variant ?? sel2;

    const setTok = (k: TokenKey, v: string) => setTokens({ ...tokens, [k]: v });
    const approveTok = async (k: TokenKey, source = "user", original?: string) => {
      await patchConfig({
        tokens: { [k]: tokens[k] },
        token_approvals: { [k]: { approved: true, source, original_suggestion: original } },
      });
      onToast(`${k} approved`);
    };
    const fetchHooks = async () => {
      try {
        setHooks((await gdSuggest(run.id, { kind: "hooks", concept })) as unknown as GdHookSuggestion);
      } catch (e) {
        onToast((e as Error).message);
      }
    };
    const applyHeadline = async (headline: string, highlight: string) => {
      const next = { ...tokens, headline, highlight };
      setTokens(next);
      await patchConfig({
        tokens: { headline, highlight },
        token_approvals: {
          headline: { approved: true, source: "agent", original_suggestion: headline },
          highlight: { approved: true, source: "agent", original_suggestion: highlight },
        },
      });
    };

    const tokenField = (k: TokenKey, label: string, area = false) => {
      const limit = k === "subtext1" || k === "subtext2" ? 70 : undefined;
      return (
        <div className="gdtoken" key={k}>
          <div className="gdtoken__head">
            <span className="gdtoken__label">{label}</span>
            <button
              className={`gdapprove${approved[k] ? " gdapprove--on" : ""}`}
              onClick={() => approveTok(k)}
              disabled={busy}
            >
              <Icon name={approved[k] ? "check" : "circle"} size={12} />
              {approved[k] ? "Approved" : "Approve"}
            </button>
          </div>
          {area ? (
            <textarea rows={2} value={tokens[k] ?? ""} maxLength={limit} onChange={(e) => setTok(k, e.target.value)} />
          ) : (
            <input value={tokens[k] ?? ""} onChange={(e) => setTok(k, e.target.value)} />
          )}
          {limit && <span className="gdtoken__count">{(tokens[k] ?? "").length}/{limit}</span>}
          {k === "highlight" && tokens.headline && !tokens.headline.includes(tokens.highlight ?? "") && (
            <span className="gdtoken__err">Highlight must be a substring of the headline.</span>
          )}
        </div>
      );
    };

    return (
      <div className="gdcard">
        <p className="gdsec__title">Stage 3 · Text overlay</p>

        {/* live mock */}
        <MockPreview
          tokens={tokens}
          bgPath={run.stages["2"].approved?.url}
          textPlacement={run.config.text_placement ?? "left"}
          ctaPlacement={run.config.cta_placement ?? "bottom"}
          aspect={run.config.aspect_ratio}
        />

        {/* agent hooks */}
        <div className="gdsugg" style={{ margin: "12px 0" }}>
          <span className="gdsugg__hdr"><Icon name="bot" size={13} /> Hook ideas · concept {concept}</span>
          <Button size="sm" variant="secondary" onClick={fetchHooks} disabled={busy}>
            Suggest hooks
          </Button>
          {hooks?.headlines.map((h, i) => (
            <div className="gdsugg__row" key={i}>
              <span className="gdsugg__text">{h.headline}</span>
              <button className="gdminibtn gdminibtn--primary" onClick={() => applyHeadline(h.headline, h.highlight)}>
                Use
              </button>
            </div>
          ))}
          {hooks?.ctas && (
            <div className="gdrow" style={{ flexWrap: "wrap" }}>
              {hooks.ctas.map((c, i) => (
                <button key={i} className="gdminibtn" onClick={() => { setTok("cta", c.cta); }}>
                  {c.cta}
                </button>
              ))}
            </div>
          )}
        </div>

        {tokenField("headline", "Headline")}
        {tokenField("highlight", "Highlight phrase")}
        {tokenField("subtext1", "Sub-text line 1", true)}
        {tokenField("subtext2", "Sub-text line 2", true)}
        {tokenField("cta", "CTA")}

        {/* font — locked to a single brand family, variations selectable */}
        <div className="gdfield">
          <span className="gdfield__label">
            Font
            <span className="gdfield__lock">
              <Icon name="lock" size={11} /> {config.font_family} family
            </span>
          </span>
          <select className="gdselect" value={run.config.font} onChange={(e) => patchConfig({ font: e.target.value })}>
            <optgroup label={`${config.font_family} — brand font (locked)`}>
              {config.fonts.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </optgroup>
          </select>
          <span className="gdfield__hint">
            Every creative uses {config.font_family}. Pick any variation — the family stays locked.
          </span>
        </div>

        {/* text & CTA placement — the overlay only adds text; the image is preserved */}
        <div className="gdfield">
          <span className="gdfield__label">Text placement</span>
          <div className="gdseg">
            {config.text_placements.map((p) => (
              <button
                key={p.key}
                className={`gdseg__btn${(run.config.text_placement ?? "left") === p.key ? " gdseg__btn--on" : ""}`}
                onClick={() => patchConfig({ text_placement: p.key })}
                title={p.phrase}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="gdfield">
          <span className="gdfield__label">CTA placement</span>
          <div className="gdseg">
            {config.cta_placements.map((p) => (
              <button
                key={p.key}
                className={`gdseg__btn${(run.config.cta_placement ?? "bottom") === p.key ? " gdseg__btn--on" : ""}`}
                onClick={() => patchConfig({ cta_placement: p.key })}
                title={p.phrase}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="gdfield__hint">
            The overlay only adds text — the underlying image and aspect ratio stay unchanged.
          </span>
        </div>

        <Button
          fullWidth
          onClick={doGenerate}
          disabled={busy || !run.tokens_ready}
          iconLeft={<Icon name="sparkles" size={15} />}
        >
          {run.tokens_ready ? "Generate text overlay" : "Approve all tokens to generate"}
        </Button>
      </div>
    );
  }

  /* ---- STAGE 4 ---- */
  return (
    <div className="gdcard">
      <p className="gdsec__title">Stage 4 · Logo composite</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
      />
      <div className="gddrop" onClick={() => fileRef.current?.click()}>
        {logoFile ? (
          <span><Icon name="image" size={15} /> {logoFile.name}</span>
        ) : (
          <span><Icon name="upload" size={15} /> Upload a logo (PNG, JPG, SVG)</span>
        )}
      </div>

      <label className="gdrow" style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
        <input
          type="checkbox"
          checked={run.config.use_ai_compositor}
          onChange={(e) => patchConfig({ use_ai_compositor: e.target.checked })}
        />
        AI compositor (not pixel-exact)
      </label>
      <p className="gdstep__meta" style={{ marginTop: 4 }}>
        Default is the deterministic compositor — top-left, 4% margin, base pixels untouched.
      </p>

      <Button fullWidth onClick={doStage4} disabled={busy || !logoFile} style={{ marginTop: 12 }} iconLeft={<Icon name="sparkles" size={15} />}>
        Composite logo
      </Button>
    </div>
  );
}
