"use client";

import { useCallback, useEffect, useState } from "react";
import {
  gdApprove,
  gdArtifactBlob,
  gdBack,
  gdBrandLogos,
  gdCreateRun,
  gdGenerate,
  gdGetConfig,
  gdListBrands,
  gdStage4,
  gdSuggest,
  gdSuggestPlacement,
  gdUpdateConfig,
  type GdBrandLogoVariant,
  type GdBrandOption,
  type GdChatMessage,
  type GdChatTurn,
  type GdConfig,
  type GdGradientSuggestion,
  type GdRun,
} from "@/lib/api";

/* --------------------------------------------------------------------------
   Graphics Studio V2 — the designer-friendly skin over the SAME 4-stage
   engine. Approved prototype: test-ui-graphics-designer/ + the team wireframe.
   Everything here talks to the existing /api/gd/* contracts; the classic
   console stays available behind the StudioSwitch toggle.
   -------------------------------------------------------------------------- */

const STEPS = [
  { n: 1, name: "Background", hue: "#D9930F" },
  { n: 2, name: "Main image", hue: "#E85C4A" },
  { n: 3, name: "Your words", hue: "#6D4DF2" },
  { n: 4, name: "Logo", hue: "#0E9A89" },
] as const;

function stageNum(state: string): number {
  if (state === "DONE") return 5;
  const m = /STAGE(\d)/.exec(state);
  return m ? Number(m[1]) : 1;
}

/* Artifacts need the Bearer header — fetch as blob, render as object URL. */
function AuthImg({ path, alt }: { path: string | null; alt: string }) {
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
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}

function previewPath(run: GdRun, cur: number): string | null {
  if (cur >= 5) return run.stages["4"]?.approved?.url ?? null;
  const s = run.stages[String(cur)];
  if (s && s.attempts.length) return s.attempts[s.attempts.length - 1].url;
  for (let n = cur - 1; n >= 1; n -= 1) {
    const prev = run.stages[String(n)]?.approved;
    if (prev) return prev.url;
  }
  return null;
}

const STAGE_HINTS: Record<number, string> = {
  1: "Pick a background on the right, then hit Generate preview.",
  2: "Choose a concept and where it sits, then Generate preview.",
  3: "Edit your words, pick an arrangement, then Generate preview.",
  4: "Pick your logo and its corner, then Generate composite.",
};

export function GraphicsStudioV2({
  onToast,
  onBack,
  onExitV2,
}: {
  onToast: (m: string) => void;
  onBack?: () => void;
  onExitV2: () => void;
}) {
  /* ---------------- state ---------------- */
  const [phase, setPhase] = useState<"setup" | "studio">("setup");
  const [brands, setBrands] = useState<GdBrandOption[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [cfg, setCfg] = useState<GdConfig | null>(null);
  const [aspect, setAspect] = useState<string>("");
  const [brief, setBrief] = useState("");
  const [run, setRun] = useState<GdRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [sel1, setSel1] = useState<string | null>(null);
  const [aiSteer, setAiSteer] = useState("");
  const [sel2, setSel2] = useState<string | null>(null);
  const [tok, setTok] = useState<Record<string, string>>({});
  const [logos, setLogos] = useState<GdBrandLogoVariant[]>([]);
  const [logoId, setLogoId] = useState<string | null>(null);
  const [chat, setChat] = useState<GdChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const fail = useCallback(
    (e: unknown) => onToast(e instanceof Error ? e.message : String(e)),
    [onToast],
  );

  const guard = useCallback(
    async (msg: string, fn: () => Promise<void>) => {
      setBusy(msg);
      try {
        await fn();
      } catch (e) {
        fail(e);
      } finally {
        setBusy(null);
      }
    },
    [fail],
  );

  /* ---------------- data loads ---------------- */
  useEffect(() => {
    gdListBrands()
      .then((r) => {
        setBrands(r.brands);
        setBrandId((b) => b || r.default);
      })
      .catch(fail);
  }, [fail]);

  useEffect(() => {
    if (!brandId) return;
    gdGetConfig(brandId)
      .then((c) => {
        setCfg(c);
        const def = c.aspect_ratios.find((a) => a.default) ?? c.aspect_ratios[0];
        setAspect((a) => a || (def ? def.ar : ""));
      })
      .catch(fail);
  }, [brandId, fail]);

  const cur = run ? stageNum(run.state) : 1;

  // keep local token drafts in sync per run
  const runId = run?.id ?? null;
  useEffect(() => {
    if (run) setTok(run.config.tokens ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // brand-logo library loads when we reach stage 4
  useEffect(() => {
    if (!run || cur !== 4 || logos.length) return;
    gdBrandLogos(run.id)
      .then((r) => {
        setLogos(r.logos);
        setLogoId((v) => v ?? (r.logos[0]?.id ?? null));
      })
      .catch(fail);
  }, [run, cur, logos.length, fail]);

  /* ---------------- actions ---------------- */
  const patch = useCallback(
    (body: Parameters<typeof gdUpdateConfig>[1]) => {
      if (!run) return;
      gdUpdateConfig(run.id, body).then(setRun).catch(fail);
    },
    [run, fail],
  );

  const start = () =>
    guard("Studio is getting your brand kit ready…", async () => {
      const created = await gdCreateRun(brandId || null);
      const patched = await gdUpdateConfig(created.id, {
        ...(aspect ? { aspect_ratio: aspect } : {}),
        ...(brief.trim() ? { creative_brief: { goal: brief.trim() } } : {}),
      });
      setRun(patched);
      setSel1(null);
      setSel2(null);
      setLogos([]);
      setLogoId(null);
      setChat([
        {
          role: "agent",
          text: brief.trim()
            ? `Working from your brief: “${brief.trim()}”. Pick a background to start — I'll chip in at every step.`
            : "Pick a background to start — I'll chip in with suggestions at every step.",
        },
      ]);
      setPhase("studio");
    });

  const generate = () => {
    if (!run) return;
    const variant = cur === 1 ? sel1 : cur === 2 ? sel2 : undefined;
    if (cur <= 2 && !variant) return;
    if (cur === 4) {
      void guard("Compositing your real logo…", async () => {
        const res = await gdStage4(run.id, null, run.config.use_ai_compositor ?? false, logoId);
        setRun(res.run);
      });
      return;
    }
    void guard(
      cur === 1 ? "Painting your brand background…" : cur === 2 ? "Creating your main image…" : "Placing your words, pixel-perfect…",
      async () => {
        if (cur === 3) {
          await gdUpdateConfig(run.id, { tokens: { ...run.config.tokens, ...tok } });
        }
        const res = await gdGenerate(run.id, cur, variant ?? undefined);
        setRun(res.run);
      },
    );
  };

  const approve = () => {
    if (!run) return;
    void guard("Locking this layer in…", async () => {
      const r = await gdApprove(run.id, cur);
      setRun(r);
    });
  };

  const gotoStage = (n: number) => {
    if (!run || n >= cur) return;
    if (!window.confirm(`Go back to “${STEPS[n - 1].name}”? Later layers will be regenerated after your change.`)) return;
    void guard("Rewinding to that layer…", async () => {
      const r = await gdBack(run.id, n);
      setRun(r);
    });
  };

  const dreamGradient = () =>
    guard("Dreaming up a fresh on-brand gradient…", async () => {
      if (!run) return;
      const res = (await gdSuggest(run.id, {
        kind: "gradient",
        ...(aiSteer.trim() ? { steer: aiSteer.trim() } : {}),
        ...(run.config.custom_gradient?.cid ? { exclude: [run.config.custom_gradient.cid] } : {}),
      })) as unknown as GdGradientSuggestion;
      const r = await gdUpdateConfig(run.id, { custom_gradient: res.gradient });
      setRun(r);
      setSel1("AI");
    });

  const aiPlacement = () =>
    guard("Finding a cleaner arrangement…", async () => {
      if (!run) return;
      const res = await gdSuggestPlacement(run.id);
      const r = await gdUpdateConfig(run.id, { layout: res.layout, ...(res.shapes ? { shapes: res.shapes } : {}) });
      setRun(r);
      onToast("Arranged — Generate preview to see it.");
    });

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !run) return;
    const hist: GdChatMessage[] = [...chat, { role: "user", text }];
    setChat(hist);
    setChatInput("");
    gdSuggest(run.id, { kind: "chat", history: hist })
      .then((res) => {
        const turn = res as unknown as GdChatTurn;
        if (turn.reply) setChat((c) => [...c, { role: "agent", text: turn.reply }]);
      })
      .catch(fail);
  };

  const download = () => {
    const p = run?.stages["4"]?.approved?.url;
    if (!p) return;
    gdArtifactBlob(p)
      .then((obj) => {
        const a = document.createElement("a");
        a.href = obj;
        a.download = "creative.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(obj), 5000);
      })
      .catch(fail);
  };

  const resetAll = () => {
    setPhase("setup");
    setRun(null);
    setSel1(null);
    setSel2(null);
    setLogos([]);
    setLogoId(null);
    setChat([]);
    setAiSteer("");
  };

  /* ---------------- setup screen ---------------- */
  if (phase === "setup" || !run || !cfg) {
    return (
      <div className="gd2">
        <div className="gd2-setup">
          <div className="gd2-setup-inner">
            <p className="gd2-eyebrow">{cfg?.brand_name ?? "Creative"} Studio · New design</p>
            <h1 className="gd2-h1">
              Let’s make something
              <br />
              <em>unmistakably yours.</em>
            </h1>
            <p className="gd2-sub">
              Tell the studio what you’re making. It walks you through four quick steps — you approve
              each one, and your brand stays locked in the whole way.
            </p>
            <div className="gd2-setupcard">
              <div className="gd2-fld">
                <label htmlFor="gd2brand">Brand</label>
                <select id="gd2brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="gd2-fldrow">
                <div className="gd2-fld">
                  <label htmlFor="gd2type">Type of creative</label>
                  <select id="gd2type" defaultValue="social">
                    <option value="social">Social post</option>
                    <option disabled>Carousel — coming to this studio</option>
                    <option disabled>Brochure (PDF) — via Creative Agent</option>
                    <option disabled>PPTX deck — via Creative Agent</option>
                  </select>
                </div>
                <div className="gd2-fld">
                  <label htmlFor="gd2aspect">Aspect ratio</label>
                  <select id="gd2aspect" value={aspect} onChange={(e) => setAspect(e.target.value)}>
                    {cfg?.aspect_ratios.map((a) => (
                      <option key={a.ar} value={a.ar}>
                        {a.label} · {a.dimensions}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="gd2-fld">
                <label htmlFor="gd2brief">
                  What’s this about? <span className="gd2-opt">optional</span>
                </label>
                <textarea
                  id="gd2brief"
                  rows={2}
                  value={brief}
                  placeholder="e.g. Diwali offer — 20% off contract review for new clients"
                  onChange={(e) => setBrief(e.target.value)}
                />
              </div>
              <button className="gd2-btn" onClick={start} disabled={busy !== null || !cfg}>
                {busy ?? "Start creating →"}
              </button>
            </div>
            <p className="gd2-sub" style={{ marginTop: 18, fontSize: 12.5 }}>
              <button className="gd2-ghost" onClick={onExitV2}>Back to classic Studio</button>
              {onBack ? <button className="gd2-ghost" onClick={onBack}>Exit to console</button> : null}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- studio ---------------- */
  const arInfo = cfg.aspect_ratios.find((a) => a.ar === run.config.aspect_ratio);
  const canvasPath = previewPath(run, cur);
  const curStage = run.stages[String(Math.min(cur, 4))];
  const hasAttempt = !!curStage && curStage.attempts.length > 0;
  const done = cur >= 5;
  const hue = done ? "#0E9A89" : STEPS[cur - 1].hue;

  const stepPanel = () => {
    if (done) {
      const recap: [string, string][] = [
        ["#D9930F", `Background · ${run.stages["1"]?.approved?.variant ?? "—"}`],
        ["#E85C4A", `Main image · ${run.stages["2"]?.approved?.variant ?? "—"}`],
        ["#6D4DF2", `Words · ${run.config.text_placement ?? "auto"}`],
        ["#0E9A89", `Logo · ${run.config.logo_layout?.position ?? "auto"}`],
      ];
      return (
        <>
          <span className="gd2-step-eyebrow">All four layers approved</span>
          <h2 className="gd2-donetitle">Ready to ship.</h2>
          <p className="gd2-help">On-brand from background to logo. Download it, or click an earlier step above to keep tweaking.</p>
          <ul className="gd2-recap">
            {recap.map(([h, label]) => (
              <li key={label}>
                <span className="gd2-check" style={{ ["--hue" as never]: h } as React.CSSProperties}>✓</span>
                {label}
              </li>
            ))}
          </ul>
          <div className="gd2-actionrow" style={{ gridTemplateColumns: "1fr" }}>
            <button className="gd2-btn" onClick={download}>Download PNG ↓</button>
            <button className="gd2-btn gd2-btn--soft" onClick={resetAll}>Make another</button>
          </div>
          <p className="gd2-note">The classic Studio stays available any time from the button up top.</p>
        </>
      );
    }

    if (cur === 1) {
      const custom = run.config.custom_gradient;
      return (
        <>
          <span className="gd2-step-eyebrow">Step 1 of 4</span>
          <h2 className="gd2-paneltitle">Pick a background</h2>
          <p className="gd2-help">Start from a brand preset — or ask the studio to dream up a gradient nobody’s used yet. Either way it can’t leave your palette.</p>
          <div>
            <p className="gd2-lbl">From your brand kit</p>
            <div className="gd2-grid2">
              {cfg.stage1_variants.map((v) => (
                <button
                  key={v.id}
                  className={`gd2-tile ${sel1 === v.id ? "gd2-tile--on" : ""}`}
                  onClick={() => setSel1(v.id)}
                >
                  <span className="gd2-tileart" style={{ background: v.css_gradient || "#142A5C" }} />
                  <span className="gd2-tiletxt"><b>{v.title}</b></span>
                  <span className="gd2-tiledesc">{v.desc}</span>
                </button>
              ))}
              {custom ? (
                <button
                  className={`gd2-tile ${sel1 === "AI" ? "gd2-tile--on" : ""}`}
                  onClick={() => setSel1("AI")}
                >
                  <span className="gd2-tileart" style={{ background: custom.css_gradient }}>
                    <span className="gd2-aichip">✦ AI</span>
                  </span>
                  <span className="gd2-tiletxt"><b>{custom.title}</b></span>
                  <span className="gd2-tiledesc">{custom.desc}</span>
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <p className="gd2-lbl">✦ Dream up something new</p>
            <input
              type="text"
              value={aiSteer}
              placeholder="Optional steer — e.g. warmer, more minimal"
              onChange={(e) => setAiSteer(e.target.value)}
            />
            <button className="gd2-btn gd2-btn--ai" style={{ width: "100%", marginTop: 8 }} onClick={dreamGradient} disabled={busy !== null}>
              ✦ {custom ? "Dream up another" : "Generate AI gradient"}
            </button>
          </div>
        </>
      );
    }

    if (cur === 2) {
      return (
        <>
          <span className="gd2-step-eyebrow">Step 2 of 4</span>
          <h2 className="gd2-paneltitle">Choose your main image</h2>
          <p className="gd2-help">Pick the concept that fits your message, and where it should sit. Words and logo go on top next.</p>
          <div>
            <p className="gd2-lbl">Concepts</p>
            <div className="gd2-grid2">
              {cfg.stage2_variants.map((v) => (
                <button
                  key={v.id}
                  className={`gd2-tile ${sel2 === v.id ? "gd2-tile--on" : ""}`}
                  onClick={() => setSel2(v.id)}
                >
                  <span className="gd2-tiletxt"><b>{v.title}</b></span>
                  <span className="gd2-tiledesc">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {cfg.stage2_placements.length ? (
            <div>
              <p className="gd2-lbl">Position</p>
              <div className="gd2-posgrid" style={{ ["--hue" as never]: "#E85C4A" } as React.CSSProperties}>
                {cfg.stage2_placements
                  .filter((p) => p.row >= 0)
                  .map((p) => (
                    <button
                      key={p.key}
                      title={p.label}
                      className={run.config.element_placement === p.key ? "on" : ""}
                      onClick={() => patch({ element_placement: p.key })}
                    />
                  ))}
              </div>
            </div>
          ) : null}
        </>
      );
    }

    if (cur === 3) {
      const fields: [string, string][] = [
        ["headline", "Headline"],
        ["highlight", "Highlight word"],
        ["cta", "Button text"],
      ];
      const hlStyle = run.config.element_styles?.headline;
      return (
        <>
          <span className="gd2-step-eyebrow">Step 3 of 4</span>
          <h2 className="gd2-paneltitle">Say it in your words</h2>
          <p className="gd2-help">Your brand fonts are already applied — headlines come out crisp, never AI-garbled.</p>
          {fields.map(([key, label]) => (
            <div className="gd2-tokfld" key={key}>
              <span>{label}</span>
              <input
                type="text"
                value={tok[key] ?? ""}
                onChange={(e) => setTok((t) => ({ ...t, [key]: e.target.value }))}
                onBlur={() => patch({ tokens: { ...run.config.tokens, ...tok } })}
              />
            </div>
          ))}
          <div>
            <p className="gd2-lbl">Arrangement</p>
            <div className="gd2-seg">
              {cfg.text_placements.map((p) => (
                <button
                  key={p.key}
                  className={run.config.text_placement === p.key ? "on" : ""}
                  onClick={() => patch({ text_placement: p.key })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="gd2-lbl">Headline color</p>
            <div className="gd2-swatches">
              {cfg.text_colors.map((c) => (
                <button
                  key={c.key}
                  title={c.label}
                  className={`gd2-swatch ${hlStyle?.color === c.key ? "on" : ""}`}
                  style={{ background: c.swatch }}
                  onClick={() =>
                    patch({
                      element_styles: {
                        ...(run.config.element_styles ?? {}),
                        headline: { ...(run.config.element_styles?.headline ?? {}), color: c.key },
                      },
                    })
                  }
                />
              ))}
            </div>
          </div>
          <button className="gd2-btn gd2-btn--ai" onClick={aiPlacement} disabled={busy !== null}>
            ✦ AI placement
          </button>
        </>
      );
    }

    // stage 4
    return (
      <>
        <span className="gd2-step-eyebrow">Step 4 of 4</span>
        <h2 className="gd2-paneltitle">Place your logo</h2>
        <p className="gd2-help">These are your real logo files from the brand library — pixel-perfect, never redrawn by AI.</p>
        {logos.length ? (
          <div>
            <p className="gd2-lbl">From your brand library</p>
            <div className="gd2-grid2">
              {logos.map((l) => (
                <button
                  key={l.id}
                  className={`gd2-tile ${logoId === l.id ? "gd2-tile--on" : ""}`}
                  onClick={() => setLogoId(l.id)}
                >
                  <span className="gd2-logotile-art">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.thumb} alt={l.name} />
                  </span>
                  <span className="gd2-tilelabel">{l.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="gd2-help">Loading your logo library…</p>
        )}
        <div>
          <p className="gd2-lbl">Position</p>
          <div className="gd2-posgrid" style={{ ["--hue" as never]: "#0E9A89" } as React.CSSProperties}>
            {cfg.logo_positions.map((p) => (
              <button
                key={p.key}
                title={p.label}
                className={(run.config.logo_layout?.position ?? "top-left") === p.key ? "on" : ""}
                onClick={() => patch({ logo_layout: { position: p.key } })}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="gd2-lbl">Size</p>
          <div className="gd2-seg">
            {([
              ["Auto", null],
              ["Small", cfg.logo_size_pct_min],
              ["Large", cfg.logo_size_pct_max],
            ] as [string, number | null][]).map(([label, pct]) => (
              <button
                key={label}
                className={(run.config.logo_layout?.size_pct ?? null) === pct ? "on" : ""}
                onClick={() => patch({ logo_layout: { size_pct: pct as number | undefined } })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="gd2">
      {/* top bar */}
      <header className="gd2-top">
        {onBack ? (
          <button className="gd2-ghost" onClick={onBack}>← Console</button>
        ) : null}
        <span className="gd2-brand">
          <span className="gd2-brandmark">{(cfg.brand_name || "B").slice(0, 1)}</span>
          {cfg.brand_name}
        </span>
        <div className="gd2-chips">
          {STEPS.map((s) => {
            const isDone = !!run.stages[String(s.n)]?.approved;
            const isNow = cur === s.n;
            const locked = s.n > cur;
            return (
              <button
                key={s.n}
                disabled={locked}
                onClick={() => gotoStage(s.n)}
                className={`gd2-chip ${isNow ? "gd2-chip--now" : locked ? "gd2-chip--todo" : "gd2-chip--done"}`}
                style={{ ["--hue" as never]: s.hue } as React.CSSProperties}
              >
                {isDone && !isNow ? <span className="gd2-check">✓</span> : <span className="gd2-dot" style={{ background: isNow ? s.hue : "#97a3b0" }} />}
                <span>{s.n}. {s.name}</span>
              </button>
            );
          })}
        </div>
        <div className="gd2-topright">
          <button className="gd2-ghost" onClick={onExitV2}>Classic UI</button>
          <button
            className="gd2-ghost"
            onClick={() => {
              if (window.confirm("Start this design over from step 1?")) resetAll();
            }}
          >
            Start over
          </button>
          {done ? (
            <button className="gd2-btn" onClick={download}>Download ↓</button>
          ) : null}
        </div>
      </header>

      <div className="gd2-body">
        {/* left rail — assistant chat + brand kit */}
        <aside className="gd2-rail">
          <div className="gd2-chatcard">
            <p className="gd2-chattitle"><span>✦</span> Studio assistant</p>
            <div className="gd2-chatlog">
              {chat.map((m, i) => (
                <div key={i} className={`gd2-msg gd2-msg--${m.role === "agent" ? "agent" : "user"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="gd2-chatin">
              <input
                type="text"
                value={chatInput}
                placeholder="Ask anything…"
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
              />
              <button onClick={sendChat} aria-label="Send">➤</button>
            </div>
          </div>
          <div className="gd2-upload" title="Uploading your own main image lands with the next backend phase.">
            ⬆ Upload photo — coming soon
          </div>
          <div className="gd2-kitcard">
            <b>Brand kit — {cfg.brand_name}</b>
            <p>Colors, fonts and the logo are locked to brand — nothing goes off-brand here.</p>
          </div>
        </aside>

        {/* center stage */}
        <section className="gd2-stage">
          <div
            className="gd2-canvasbox"
            style={{
              aspectRatio: arInfo ? `${arInfo.w} / ${arInfo.h}` : "1 / 1",
              ...(arInfo && arInfo.h >= arInfo.w ? { height: "100%", maxWidth: "100%" } : { width: "min(100%, 860px)" }),
            }}
          >
            <AuthImg path={canvasPath} alt="Design preview" />
            {!canvasPath ? <div className="gd2-canvashint">{STAGE_HINTS[cur] ?? ""}</div> : null}
            {busy ? (
              <div className="gd2-veil">
                <div className="gd2-veilcard">
                  <span className="gd2-spin" />
                  {busy}
                </div>
              </div>
            ) : null}
          </div>
          <p className="gd2-meta">
            {arInfo ? `${arInfo.dimensions} · ${arInfo.label}` : run.config.aspect_ratio}
          </p>
        </section>

        {/* right panel */}
        <aside className="gd2-panel" style={{ ["--hue" as never]: hue } as React.CSSProperties}>
          {stepPanel()}
          {!done ? (
            <>
              <div className="gd2-actionrow">
                <button className="gd2-btn gd2-btn--soft" onClick={generate} disabled={busy !== null || (cur <= 2 && !(cur === 1 ? sel1 : sel2))}>
                  {hasAttempt ? "↻ Regenerate" : cur === 4 ? "Generate composite" : "Generate preview"}
                </button>
                <button className="gd2-btn" onClick={approve} disabled={busy !== null || !hasAttempt}>
                  Approve ✓
                </button>
              </div>
              {cur > 1 ? (
                <button className="gd2-backlink" onClick={() => gotoStage(cur - 1)}>
                  ← Back to {STEPS[cur - 2].name.toLowerCase()}
                </button>
              ) : null}
              <p className="gd2-note">
                {cur <= 2
                  ? "Approve locks this layer and moves to the next one. You can come back any time."
                  : cur === 3
                    ? "Generate renders your words with real brand fonts — nothing is drawn by the image AI."
                    : "Auto style picks the logo treatment with the best contrast against your background."}
              </p>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
