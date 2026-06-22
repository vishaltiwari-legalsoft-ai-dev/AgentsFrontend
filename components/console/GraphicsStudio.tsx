"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  type GdElementStyle,
  type GdSubheading,
  type GdLogoLayout,
  type GdExplore,
  type GdGradientSuggestion,
  type GdElementSuggestion,
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

// Headline/highlight/CTA are the fixed content tokens. Sub-heading text now
// lives in the dynamic `subheadings` list (each line approved separately).
const CONTENT_TOKENS = ["headline", "highlight", "cta"] as const;
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

/* ---- per-element style → CSS (mock preview) ----------------------------- */
// Most-specific weight names first so "SemiBold"/"ExtraBold" win over "Bold".
const _WEIGHTS: [string, number][] = [
  ["ExtraLight", 200], ["ExtraBold", 800], ["SemiBold", 600],
  ["Medium", 500], ["Regular", 400], ["Thin", 100], ["Light", 300],
  ["Black", 900], ["Bold", 700],
];
function fontCss(name?: string): CSSProperties {
  if (!name) return {};
  let weight = 700;
  for (const [k, w] of _WEIGHTS) if (name.includes(k)) { weight = w; break; }
  return { fontWeight: weight, fontStyle: /Oblique/.test(name) ? "italic" : "normal" };
}
function colorCss(key?: string): CSSProperties {
  if (key === "white") return { color: "#fff" };
  if (key === "gradient")
    return {
      background: "linear-gradient(90deg,#86affe,#2653ab)",
      WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
    };
  return { color: "#0f0f0f" };
}

/* ---- Stage-4 logo box (mirrors compositor.logo_placement for the preview) - */
const LOGO_LAYOUT_DEFAULT: GdLogoLayout = {
  position: "top-left", size_pct: null, margin_pct: 4, offset_x: 0, offset_y: 0,
};
function autoLogoRatio(lw: number, lh: number): number {
  const ar = lh ? lw / lh : 1;
  return ar > 3 ? 0.25 : ar < 0.5 ? 0.15 : 0.2;
}
function computeLogoBox(baseW: number, baseH: number, lw: number, lh: number, layout: GdLogoLayout) {
  const ratio = layout.size_pct ? layout.size_pct / 100 : autoLogoRatio(lw, lh);
  const w = Math.max(1, Math.round(baseW * ratio));
  const h = Math.max(1, Math.round(w * (lh / (lw || 1))));
  const margin = Math.round(baseW * ((layout.margin_pct ?? 4) / 100));
  const [v, hpos] = (layout.position || "top-left").split("-");
  let x = hpos === "right" ? baseW - w - margin : hpos === "center" ? Math.round((baseW - w) / 2) : margin;
  let y = v === "bottom" ? baseH - h - margin : v === "middle" ? Math.round((baseH - h) / 2) : margin;
  x += layout.offset_x || 0;
  y += layout.offset_y || 0;
  x = Math.min(Math.max(x, 0), Math.max(0, baseW - w));
  y = Math.min(Math.max(y, 0), Math.max(0, baseH - h));
  return { x, y, w, h };
}

/* ---- drag-bar placement: horizontal (L↔R) + vertical (T↔B) ---------------
   Replaces the raw X/Y number inputs. Each bar maps 1:1 to the existing
   `offset_x` / `offset_y` pixel fields the backend already accepts, so this is
   purely a UI affordance: sliding the top bar right shifts the element right,
   sliding the bottom bar toward "Bottom" moves it down. */
function PlacementSliders({
  offsetX,
  offsetY,
  range,
  onChange,
  showReset = true,
}: {
  offsetX: number;
  offsetY: number;
  range: number;
  onChange: (patch: { offset_x?: number; offset_y?: number }) => void;
  showReset?: boolean;
}) {
  const moved = offsetX !== 0 || offsetY !== 0;
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <div className="gdplace">
      <div className="gdplace__bar">
        <span className="gdplace__cap">Left</span>
        <input
          type="range"
          className="gdrange"
          min={-range}
          max={range}
          step={1}
          value={offsetX}
          aria-label="Horizontal placement"
          onChange={(e) => onChange({ offset_x: Math.round(Number(e.target.value)) })}
        />
        <span className="gdplace__cap">Right</span>
      </div>
      <div className="gdplace__bar">
        <span className="gdplace__cap">Top</span>
        <input
          type="range"
          className="gdrange"
          min={-range}
          max={range}
          step={1}
          value={offsetY}
          aria-label="Vertical placement"
          onChange={(e) => onChange({ offset_y: Math.round(Number(e.target.value)) })}
        />
        <span className="gdplace__cap">Bottom</span>
      </div>
      <div className="gdplace__foot">
        <span className="gdplace__val">H {fmt(offsetX)} · V {fmt(offsetY)} px</span>
        {showReset && moved && (
          <button type="button" className="gdplace__reset" onClick={() => onChange({ offset_x: 0, offset_y: 0 })}>
            Reset position
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- live HTML/CSS mock of the Stage-3 text overlay (per-element style) -- */
function MockPreview({
  tokens,
  bgPath,
  styles,
  subheadings,
  baseFont,
  aspect,
  baseW = 1080,
}: {
  tokens: Record<string, string>;
  bgPath?: string;
  styles?: Record<string, GdElementStyle>;
  subheadings?: GdSubheading[];
  baseFont?: string;
  aspect?: string;
  baseW?: number;
}) {
  const headline = tokens.headline || "";
  const hl = tokens.highlight || "";
  const idx = hl ? headline.indexOf(hl) : -1;
  const before = idx >= 0 ? headline.slice(0, idx) : headline;
  const after = idx >= 0 ? headline.slice(idx + hl.length) : "";
  // Mirror the AR so the preview matches the locked canvas (default 4:5).
  const arCss = aspect ? aspect.replace(":", " / ") : "4 / 5";
  const st = (k: string): GdElementStyle => styles?.[k] ?? {};
  // Size is a % of canvas width; the mock is a width-based container, so `cqw`
  // maps 1:1. The pixel nudge is scaled to the same container width.
  const sizeCss = (sp?: number): CSSProperties => (sp ? { fontSize: `${sp}cqw` } : {});
  const offCss = (ox = 0, oy = 0): CSSProperties =>
    ox || oy ? { transform: `translate(${(ox / baseW) * 100}cqw, ${(oy / baseW) * 100}cqw)` } : {};
  const elStyle = (k: string, fallbackColor?: string): CSSProperties => ({
    ...fontCss(st(k).font ?? baseFont),
    ...colorCss(st(k).color ?? fallbackColor),
    ...sizeCss(st(k).size_pct),
    ...offCss(st(k).offset_x, st(k).offset_y),
  });
  const place = st("headline").placement ?? "left";
  const cta = st("cta");
  const ctaPlace = cta.placement ?? "bottom";
  const subs = subheadings ?? [];
  return (
    <div className="gdmock" style={{ containerType: "inline-size", aspectRatio: arCss }}>
      {bgPath ? <AuthImage path={bgPath} alt="Stage 2 base" /> : null}
      <div className={`gdmock__overlay gdmock__overlay--${place}`}>
        <div className="gdmock__headline" style={elStyle("headline", "dark")}>
          {before}
          {idx >= 0 && (
            <span style={{ ...fontCss(st("highlight").font ?? baseFont), ...colorCss(st("highlight").color ?? "gradient") }}>
              {hl}
            </span>
          )}
          {after}
        </div>
        <div className="gdmock__sub">
          {subs.map((sh, i) => (
            <span
              className="gdmock__subline"
              key={i}
              style={{
                ...fontCss(sh.font ?? baseFont),
                ...colorCss(sh.color ?? "dark"),
                ...sizeCss(sh.size_pct),
                ...offCss(sh.offset_x, sh.offset_y),
              }}
            >
              <span className="gdmock__dot" />{sh.text}
            </span>
          ))}
        </div>
        <span
          className={`gdmock__cta gdmock__cta--${ctaPlace}`}
          style={{ ...fontCss(cta.font ?? baseFont), ...sizeCss(cta.size_pct), ...offCss(cta.offset_x, cta.offset_y) }}
        >
          {tokens.cta} →
        </span>
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
  // Local draft of the Stage-3 sub-heading text (smooth typing); structural
  // edits + approval persist the full list through patchConfig.
  const [subTexts, setSubTexts] = useState<string[]>([]);
  const [build, setBuild] = useState<GdPromptBuild | null>(null);
  const [showAudit, setShowAudit] = useState(true);

  // suggestions
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [conceptSugg, setConceptSugg] = useState<{ recommended: string; rationale: string } | null>(null);
  const [exploreSugg, setExploreSugg] = useState<GdExplore | null>(null);
  const [hooks, setHooks] = useState<GdHookSuggestion | null>(null);
  // Stage-1 AI gradient: latest proposal + the optional steer + already-seen cids.
  const [gradSugg, setGradSugg] = useState<GdGradientSuggestion | null>(null);
  const [gradSteer, setGradSteer] = useState("");
  const [gradExclude, setGradExclude] = useState<string[]>([]);
  // Stage-2 AI element: latest proposal + the optional steer + already-seen cids.
  const [elemSugg, setElemSugg] = useState<GdElementSuggestion | null>(null);
  const [elemSteer, setElemSteer] = useState("");
  const [elemExclude, setElemExclude] = useState<string[]>([]);

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

  // sync sub-heading text drafts when the run or the list length changes
  const subCount = run?.config.subheadings?.length ?? 0;
  useEffect(() => {
    if (run) setSubTexts((run.config.subheadings ?? []).map((s) => s.text));
  }, [run?.id, subCount]);

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
          subTexts={subTexts}
          setSubTexts={setSubTexts}
          answers={answers}
          setAnswers={setAnswers}
          conceptSugg={conceptSugg}
          setConceptSugg={setConceptSugg}
          exploreSugg={exploreSugg}
          setExploreSugg={setExploreSugg}
          gradSugg={gradSugg}
          setGradSugg={setGradSugg}
          gradSteer={gradSteer}
          setGradSteer={setGradSteer}
          gradExclude={gradExclude}
          setGradExclude={setGradExclude}
          elemSugg={elemSugg}
          setElemSugg={setElemSugg}
          elemSteer={elemSteer}
          setElemSteer={setElemSteer}
          elemExclude={elemExclude}
          setElemExclude={setElemExclude}
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
  subTexts: string[];
  setSubTexts: (v: string[]) => void;
  answers: Record<string, string>;
  setAnswers: (v: Record<string, string>) => void;
  conceptSugg: { recommended: string; rationale: string } | null;
  setConceptSugg: (v: { recommended: string; rationale: string } | null) => void;
  exploreSugg: GdExplore | null;
  setExploreSugg: (v: GdExplore | null) => void;
  gradSugg: GdGradientSuggestion | null;
  setGradSugg: (v: GdGradientSuggestion | null) => void;
  gradSteer: string;
  setGradSteer: (v: string) => void;
  gradExclude: string[];
  setGradExclude: (v: string[]) => void;
  elemSugg: GdElementSuggestion | null;
  setElemSugg: (v: GdElementSuggestion | null) => void;
  elemSteer: string;
  setElemSteer: (v: string) => void;
  elemExclude: string[];
  setElemExclude: (v: string[]) => void;
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
    run, config, active, busy, sel1, setSel1, sel2, setSel2, tokens, setTokens, subTexts, setSubTexts,
    answers, setAnswers, conceptSugg, setConceptSugg, exploreSugg, setExploreSugg, hooks, setHooks,
    gradSugg, setGradSugg, gradSteer, setGradSteer, gradExclude, setGradExclude,
    elemSugg, setElemSugg, elemSteer, setElemSteer, elemExclude, setElemExclude,
    logoFile, setLogoFile, fileRef, patchConfig, doGenerate, doStage4, onToast,
  } = props;

  // Read the uploaded logo's natural size + a preview URL (Stage-4 placement).
  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!logoFile) { setLogoDims(null); setLogoUrl(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoUrl(url);
    const img = new window.Image();
    img.onload = () => setLogoDims({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  if (!config) return null;

  /* ---- STAGE 1 ---- */
  if (active === 1) {
    // The AI gradient to show on the temporary card: the freshest proposal, else
    // whatever is already stored on the run (so it survives a reload/back).
    const aiGrad = gradSugg?.gradient ?? run.config.custom_gradient ?? null;

    const suggestGradient = async () => {
      try {
        const r = (await gdSuggest(run.id, {
          kind: "gradient",
          answers,
          steer: gradSteer,
          exclude: gradExclude,
        })) as unknown as GdGradientSuggestion;
        setGradSugg(r);
        if (r.gradient.cid) setGradExclude([...gradExclude, r.gradient.cid]);
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Couldn't suggest a gradient");
      }
    };

    const selectAiGradient = async () => {
      if (!aiGrad) return;
      // Persist first so the prompt-audit preview (fetched on sel1 change) sees it.
      await patchConfig({ custom_gradient: aiGrad });
      setSel1("AI");
    };

    return (
      <div className="gdcard">
        <p className="gdsec__title">Stage 1 · Gradient base</p>

        {/* AI gradient — agent invents a fresh, on-brand gradient for THIS creative */}
        <div className="gdsugg" style={{ marginBottom: 10 }}>
          <span className="gdexplore__hdr">
            <Icon name="sparkles" size={12} /> AI gradient
          </span>
          <p className="gdsugg__text">
            Let the agent study the brand gradients and invent a fresh one — used only for
            this creative, never saved to the library.
          </p>
          <input
            className="gdselect"
            value={gradSteer}
            onChange={(e) => setGradSteer(e.target.value)}
            placeholder="Optional steer — e.g. warmer, more minimal"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={suggestGradient}
            disabled={busy}
            iconLeft={<Icon name="sparkles" size={13} />}
          >
            {aiGrad ? "Regenerate AI gradient" : "Generate AI gradient"}
          </Button>
        </div>

        <div className="gdvariants">
          {aiGrad && (
            <button
              key="AI"
              className={`gdvariant gdvariant--explore${sel1 === "AI" ? " gdvariant--sel" : ""}`}
              onClick={selectAiGradient}
            >
              <span className="gdvariant__chip" style={{ background: aiGrad.css_gradient }} />
              <span className="gdvariant__body">
                <span className="gdvariant__title">
                  {aiGrad.title} <span className="gdfield__lock">AI · temporary</span>
                </span>
                <span className="gdvariant__desc">{aiGrad.desc}</span>
              </span>
            </button>
          )}
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

    // AI element — the agent invents a brand-new foreground subject for THIS
    // creative (temporary, never added to the catalogue), mirroring Stage 1.
    const aiElem = elemSugg?.element ?? run.config.custom_element ?? null;
    const suggestElement = async () => {
      try {
        const r = (await gdSuggest(run.id, {
          kind: "element",
          answers,
          steer: elemSteer,
          exclude: elemExclude,
        })) as unknown as GdElementSuggestion;
        setElemSugg(r);
        if (r.element.cid) setElemExclude([...elemExclude, r.element.cid]);
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Couldn't suggest an element");
      }
    };
    const selectAiElement = async () => {
      if (!aiElem) return;
      // Persist first so the prompt-audit preview (fetched on sel2 change) sees it.
      await patchConfig({ custom_element: aiElem });
      setSel2("AI");
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

        {/* AI element — agent invents a fresh, foreground-only element for THIS creative */}
        <div className="gdsugg" style={{ marginBottom: 12 }}>
          <span className="gdexplore__hdr">
            <Icon name="sparkles" size={12} /> AI element
          </span>
          <p className="gdsugg__text">
            Let the agent invent a brand-new element from scratch — used only for this
            creative, never added to the library. The locked Stage-1 gradient stays the
            background.
          </p>
          <input
            className="gdselect"
            value={elemSteer}
            onChange={(e) => setElemSteer(e.target.value)}
            placeholder="Optional steer — e.g. a confident female lawyer, a gavel close-up"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={suggestElement}
            disabled={busy}
            iconLeft={<Icon name="sparkles" size={13} />}
          >
            {aiElem ? "Regenerate AI element" : "Generate AI element"}
          </Button>
        </div>

        {aiElem && (
          <div className="gdgroup">
            <span className="gdgroup__label">AI element (temporary)</span>
            <div className="gdvariants">
              <button
                key="AI"
                className={`gdvariant gdvariant--explore${sel2 === "AI" ? " gdvariant--sel" : ""}`}
                onClick={selectAiElement}
              >
                <span className="gdvariant__chip">AI</span>
                <span className="gdvariant__body">
                  <span className="gdvariant__title">
                    {aiElem.title} <span className="gdfield__lock">{aiElem.category}</span>
                  </span>
                  <span className="gdvariant__desc">{aiElem.desc}</span>
                </span>
              </button>
            </div>
          </div>
        )}

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

    const tokenField = (k: TokenKey, label: string) => {
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
          <input value={tokens[k] ?? ""} onChange={(e) => setTok(k, e.target.value)} />
          {k === "highlight" && tokens.headline && !tokens.headline.includes(tokens.highlight ?? "") && (
            <span className="gdtoken__err">Highlight must be a substring of the headline.</span>
          )}
        </div>
      );
    };

    const DEFAULT_COLOR: Record<string, string> = {
      headline: "dark", highlight: "gradient",
    };
    const styleOf = (key: string): GdElementStyle => run.config.element_styles?.[key] ?? {};
    const setStyle = (key: string, patch: GdElementStyle) =>
      patchConfig({ element_styles: { [key]: patch } });

    // Deterministic-renderer bounds (size as % of canvas width + pixel nudge range).
    const SIZE_MIN = config.text_size_pct_min;
    const SIZE_MAX = config.text_size_pct_max;
    const OFF = config.text_offset_px_range;
    const sizeDefault = (kind: string) => config.default_text_size_pct?.[kind] ?? 3;
    // Canvas width (px) — for the px label and the live-preview offset scaling.
    const s3canvas =
      config.aspect_ratios.find((a) => a.ar === run.config.aspect_ratio) ??
      config.aspect_ratios.find((a) => a.default);
    const baseW = s3canvas?.w ?? 1080;

    type Placement = { key: string; label: string; phrase: string };
    const placementBar = (cur: string, places: Placement[], onPick: (k: string) => void) => (
      <div className="gdseg gdseg--sm">
        {places.map((p) => (
          <button
            key={p.key}
            className={`gdseg__btn${cur === p.key ? " gdseg__btn--on" : ""}`}
            onClick={() => onPick(p.key)}
            title={p.phrase}
          >
            {p.label}
          </button>
        ))}
      </div>
    );

    // Shared size slider + X/Y pixel nudge — used by the heading/CTA bars and each sub-heading.
    const sizeNudge = (
      sizePct: number, ox: number, oy: number,
      onSize: (v: number) => void,
      onOff: (patch: { offset_x?: number; offset_y?: number }) => void,
    ) => (
      <>
        <div className="gdfield" style={{ gap: 4, margin: 0 }}>
          <span className="gdfield__label" style={{ fontSize: 10 }}>
            Size
            <span className="gdfield__lock" style={{ background: "none", color: "var(--text-tertiary)" }}>
              {sizePct}% · {Math.round((sizePct / 100) * baseW)}px
            </span>
          </span>
          <input
            type="range"
            className="gdrange"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={0.1}
            value={sizePct}
            onChange={(e) => onSize(Number(e.target.value))}
          />
        </div>
        <div className="gdfield" style={{ gap: 4, margin: 0 }}>
          <span className="gdfield__label" style={{ fontSize: 10 }}>Position</span>
          <PlacementSliders offsetX={ox} offsetY={oy} range={OFF} onChange={onOff} />
        </div>
      </>
    );

    const elementStyleBar = (el: GdConfig["stage3_elements"][number]) => {
      const s = styleOf(el.key);
      const curFont = s.font ?? run.config.font;
      const curColor = s.color ?? DEFAULT_COLOR[el.key] ?? "dark";
      const places = el.placement_kind === "cta" ? config.cta_placements : config.text_placements;
      const curPlace = s.placement ?? (el.placement_kind === "cta" ? "bottom" : "left");
      const kind = el.key === "cta" ? "cta" : "headline";
      const curSize = s.size_pct ?? sizeDefault(kind);
      return (
        <div className="gdelem" key={el.key}>
          <div className="gdelem__head">
            <span className="gdelem__name">{el.label}</span>
            {el.colorable ? (
              <div className="gdswatches">
                {config.text_colors.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`gdcolor${curColor === c.key ? " gdcolor--on" : ""}`}
                    style={{ background: c.swatch }}
                    title={`${c.label} — ${c.phrase}`}
                    aria-label={c.label}
                    onClick={() => setStyle(el.key, { color: c.key })}
                  />
                ))}
              </div>
            ) : (
              <span className="gdelem__locked"><Icon name="lock" size={10} /> orange CTA</span>
            )}
          </div>
          <select
            className="gdselect gdselect--sm"
            value={curFont}
            onChange={(e) => setStyle(el.key, { font: e.target.value })}
          >
            {config.fonts.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
          {el.placeable ? (
            placementBar(curPlace, places, (k) => setStyle(el.key, { placement: k }))
          ) : (
            <span className="gdelem__hint">Inline in the heading — position follows the heading.</span>
          )}
          {el.sizable && sizeNudge(
            curSize, s.offset_x ?? 0, s.offset_y ?? 0,
            (v) => setStyle(el.key, { size_pct: v }),
            (patch) => setStyle(el.key, patch),
          )}
        </div>
      );
    };

    /* ---- dynamic sub-headings (1–N lines, each independently styled) ---- */
    const subs: GdSubheading[] = run.config.subheadings ?? [];
    const writeSubs = (next: GdSubheading[]) => patchConfig({ subheadings: next });
    // Merge the local text drafts back onto the server list before any structural write.
    const subsWithDrafts = (): GdSubheading[] => subs.map((s, i) => ({ ...s, text: subTexts[i] ?? s.text }));
    const patchSub = (i: number, patch: Partial<GdSubheading>) =>
      writeSubs(subsWithDrafts().map((s, j) => (j === i ? { ...s, ...patch } : s)));
    const addSub = () => {
      if (subs.length >= config.subheading_max) return;
      writeSubs([
        ...subsWithDrafts(),
        {
          text: "", font: run.config.font, color: "dark",
          size_pct: sizeDefault("subheading"), placement: "left",
          offset_x: 0, offset_y: 0, approved: false,
        },
      ]);
    };
    const removeSub = (i: number) => {
      if (subs.length <= config.subheading_min) return;
      writeSubs(subsWithDrafts().filter((_, j) => j !== i));
    };

    const subheadingEditor = () => (
      <div className="gdfield">
        <span className="gdfield__label">
          Sub-headings
          <span className="gdfield__lock" style={{ background: "none", color: "var(--text-tertiary)" }}>
            {subs.length}/{config.subheading_max}
          </span>
        </span>
        <span className="gdfield__hint" style={{ marginTop: 0 }}>
          Add {config.subheading_min}–{config.subheading_max} lines. Each has its own font, colour, size,
          placement and pixel position, and must be approved before Stage 3 can generate.
        </span>
        <div className="gdelems">
          {subs.map((sh, i) => {
            const curFont = sh.font ?? run.config.font;
            const curColor = sh.color ?? "dark";
            const curPlace = sh.placement ?? "left";
            const curSize = sh.size_pct ?? sizeDefault("subheading");
            return (
              <div className="gdelem" key={i}>
                <div className="gdelem__head">
                  <span className="gdelem__name">Sub-heading {i + 1}</span>
                  <div className="gdrow" style={{ gap: 6, margin: 0 }}>
                    <button
                      className={`gdapprove${sh.approved ? " gdapprove--on" : ""}`}
                      onClick={() => patchSub(i, { approved: true })}
                      disabled={busy}
                    >
                      <Icon name={sh.approved ? "check" : "circle"} size={12} />
                      {sh.approved ? "Approved" : "Approve"}
                    </button>
                    {subs.length > config.subheading_min && (
                      <button
                        className="gdminibtn"
                        onClick={() => removeSub(i)}
                        title="Remove this line"
                        disabled={busy}
                      >
                        <Icon name="trash-2" size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  value={subTexts[i] ?? ""}
                  maxLength={120}
                  placeholder={`Sub-heading line ${i + 1}`}
                  onChange={(e) => setSubTexts(subTexts.map((t, j) => (j === i ? e.target.value : t)))}
                />
                <div className="gdswatches">
                  {config.text_colors.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`gdcolor${curColor === c.key ? " gdcolor--on" : ""}`}
                      style={{ background: c.swatch }}
                      title={`${c.label} — ${c.phrase}`}
                      aria-label={c.label}
                      onClick={() => patchSub(i, { color: c.key })}
                    />
                  ))}
                </div>
                <select
                  className="gdselect gdselect--sm"
                  value={curFont}
                  onChange={(e) => patchSub(i, { font: e.target.value })}
                >
                  {config.fonts.map((f) => (<option key={f} value={f}>{f}</option>))}
                </select>
                {placementBar(curPlace, config.text_placements, (k) => patchSub(i, { placement: k }))}
                {sizeNudge(
                  curSize, sh.offset_x ?? 0, sh.offset_y ?? 0,
                  (v) => patchSub(i, { size_pct: v }),
                  (patch) => patchSub(i, patch),
                )}
              </div>
            );
          })}
        </div>
        <button
          className="gdminibtn"
          style={{ alignSelf: "flex-start", marginTop: 6 }}
          onClick={addSub}
          disabled={busy || subs.length >= config.subheading_max}
        >
          <Icon name="plus" size={12} /> Add sub-heading
        </button>
      </div>
    );

    return (
      <div className="gdcard">
        <p className="gdsec__title">Stage 3 · Text overlay</p>

        {/* live mock */}
        <MockPreview
          tokens={tokens}
          bgPath={run.stages["2"].approved?.url}
          styles={run.config.element_styles}
          subheadings={subsWithDrafts()}
          baseFont={run.config.font}
          aspect={run.config.aspect_ratio}
          baseW={baseW}
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
        {tokenField("cta", "CTA")}

        {/* dynamic sub-heading lines (replaces the old fixed subtext1/subtext2) */}
        {subheadingEditor()}

        {/* per-element styling — every element gets its own font, colour, size & placement */}
        <div className="gdfield">
          <span className="gdfield__label">
            Per-element styling
            <span className="gdfield__lock">
              <Icon name="lock" size={11} /> {config.font_family} family
            </span>
          </span>
          <span className="gdfield__hint" style={{ marginTop: 0 }}>
            Each element is controlled independently — font, colour, size (% of width) and an exact pixel
            position. Font stays inside the {config.font_family} family; text colour is the locked brand
            gradient, dark, or white. The overlay only adds text — the image and aspect ratio stay unchanged.
          </span>
          <div className="gdelems">
            {config.stage3_elements.map((el) => elementStyleBar(el))}
          </div>
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
  {
    const layout: GdLogoLayout = { ...LOGO_LAYOUT_DEFAULT, ...(run.config.logo_layout ?? {}) };
    const setLayout = (patch: Partial<GdLogoLayout>) => patchConfig({ logo_layout: patch });
    const canvas =
      config.aspect_ratios.find((a) => a.ar === run.config.aspect_ratio) ??
      config.aspect_ratios.find((a) => a.default);
    const baseW = canvas?.w ?? 1080;
    const baseH = canvas?.h ?? 1350;
    const lw = logoDims?.w ?? 1;
    const lh = logoDims?.h ?? 1;
    const sizePct = layout.size_pct ?? Math.round(autoLogoRatio(lw, lh) * 100);
    const box = computeLogoBox(baseW, baseH, lw, lh, { ...layout, size_pct: sizePct });
    const pct = (n: number, d: number) => `${(n / d) * 100}%`;
    const bgPath = run.stages["3"].approved?.url;

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

        {/* live placement preview */}
        {logoUrl && (
          <div className="gdmock" style={{ aspectRatio: `${baseW} / ${baseH}`, marginTop: 12 }}>
            {bgPath ? <AuthImage path={bgPath} alt="Stage 3 base" /> : null}
            <div
              className="gdlogobox"
              style={{ left: pct(box.x, baseW), top: pct(box.y, baseH), width: pct(box.w, baseW), height: pct(box.h, baseH) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="logo" />
            </div>
          </div>
        )}

        {logoFile && (
          <>
            {/* placement guide — 3×3 grid */}
            <div className="gdfield" style={{ marginTop: 12 }}>
              <span className="gdfield__label">Logo placement</span>
              <div className="gdgrid3">
                {config.logo_positions.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`gdgrid3__cell${layout.position === p.key ? " gdgrid3__cell--on" : ""}`}
                    title={p.label}
                    aria-label={p.label}
                    onClick={() => setLayout({ position: p.key })}
                  >
                    <span className="gdgrid3__dot" />
                  </button>
                ))}
              </div>
            </div>

            {/* resizer bar — logo width as % of canvas */}
            <div className="gdfield">
              <span className="gdfield__label">
                Logo size
                <span className="gdfield__lock" style={{ background: "none", color: "var(--text-tertiary)" }}>
                  {sizePct}% · {box.w}px
                </span>
              </span>
              <input
                type="range"
                className="gdrange"
                min={config.logo_size_pct_min}
                max={config.logo_size_pct_max}
                step={1}
                value={sizePct}
                onChange={(e) => setLayout({ size_pct: Number(e.target.value) })}
              />
            </div>

            {/* drag-bar placement + size/margin refinement */}
            <div className="gdfield">
              <span className="gdfield__label">Drag to position</span>
              <PlacementSliders
                offsetX={layout.offset_x ?? 0}
                offsetY={layout.offset_y ?? 0}
                range={config.logo_offset_px_range}
                onChange={(patch) => setLayout(patch)}
                showReset={false}
              />
              <div className="gdpxgrid" style={{ marginTop: 8 }}>
                <label className="gdpx">
                  <span>Width</span>
                  <input
                    type="number"
                    value={box.w}
                    min={1}
                    max={baseW}
                    onChange={(e) => setLayout({ size_pct: Math.max(1, Math.min(100, (Number(e.target.value) / baseW) * 100)) })}
                  />
                </label>
                <label className="gdpx">
                  <span>Margin %</span>
                  <input
                    type="number"
                    value={layout.margin_pct}
                    min={0}
                    max={25}
                    step={0.5}
                    onChange={(e) => setLayout({ margin_pct: Number(e.target.value) })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="gdminibtn"
                style={{ alignSelf: "flex-start", marginTop: 4 }}
                onClick={() => setLayout({ ...LOGO_LAYOUT_DEFAULT })}
              >
                Reset placement
              </button>
            </div>
          </>
        )}

        <label className="gdrow" style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={run.config.use_ai_compositor}
            onChange={(e) => patchConfig({ use_ai_compositor: e.target.checked })}
          />
          AI compositor (not pixel-exact)
        </label>
        <p className="gdstep__meta" style={{ marginTop: 4 }}>
          {run.config.use_ai_compositor
            ? "The AI compositor follows your placement as a guide, but is not pixel-exact."
            : "Deterministic compositor — your exact placement & size, base pixels untouched."}
        </p>

        <Button fullWidth onClick={doStage4} disabled={busy || !logoFile} style={{ marginTop: 12 }} iconLeft={<Icon name="sparkles" size={15} />}>
          Composite logo
        </Button>
      </div>
    );
  }
}
