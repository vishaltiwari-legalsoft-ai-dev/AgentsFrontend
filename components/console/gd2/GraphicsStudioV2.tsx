"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { DragMarker, TextNodeSpec } from "@/components/console/stage3/KonvaCanvas";
import {
  gdApprove,
  gdArtifactBlob,
  gdBack,
  gdBrandLogos,
  gdCreateRun,
  gdElements,
  gdGenerate,
  gdGetConfig,
  gdListBrands,
  gdStage4,
  gdSubjectUpload,
  gdSuggest,
  gdSuggestPlacement,
  gdTextPreview,
  gdUpdateConfig,
  type GdBrandLogoVariant,
  type GdBrandOption,
  type GdChatMessage,
  type GdChatTurn,
  type GdConfig,
  type GdElement,
  type GdElementStyle,
  type GdGradientSuggestion,
  type GdRun,
  type GdSubheading,
} from "@/lib/api";

/* --------------------------------------------------------------------------
   Graphics Studio V2 — the designer-friendly skin over the SAME 4-stage
   engine. Approved prototype: test-ui-graphics-designer/ + the team wireframe.
   Everything here talks to the existing /api/gd/* contracts; the classic
   console stays available behind the StudioSwitch toggle.
   -------------------------------------------------------------------------- */

// react-konva touches the browser canvas at import time — client-only.
const KonvaCanvas = dynamic(() => import("@/components/console/stage3/KonvaCanvas"), { ssr: false });

const STEPS = [
  { n: 1, name: "Background", hue: "#D9930F" },
  { n: 2, name: "Main image", hue: "#E85C4A" },
  { n: 3, name: "Your words", hue: "#6D4DF2" },
  { n: 4, name: "Logo", hue: "#0E9A89" },
] as const;

const DEFAULT_LAYOUT_W = 0.42;

function markerPoint(id: string, place?: string) {
  const p = place || (id === "cta" ? "bottom" : "left");
  if (p === "right") return { x: 0.73, y: 0.5 };
  if (p === "center") return { x: 0.5, y: 0.5 };
  if (p === "top") return { x: 0.5, y: 0.1 };
  if (p === "bottom") return { x: 0.5, y: 0.9 };
  return { x: 0.27, y: 0.5 }; // left
}

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

  // Step-3 toolbar: which line is being styled ("headline" | "highlight" |
  // "cta" | "sub-<idx>"), a curated emoji strip, and the live text preview.
  const [activeLine, setActiveLine] = useState("headline");
  const [selEl, setSelEl] = useState<string | null>(null);
  const [emojiQuick, setEmojiQuick] = useState<string[]>([]);
  const [maxElements, setMaxElements] = useState(8);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewTimer = useRef<number | null>(null);
  // Step-3 editing surface: false = direct-manipulation mode (drag the real
  // text over the Stage-2 image), true = the engine's exact render.
  const [exactPreview, setExactPreview] = useState(false);
  const [bg2Url, setBg2Url] = useState<string | null>(null);
  const [editPop, setEditPop] = useState<{ id: string; x: number; y: number; value: string } | null>(null);

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

  // Curated emoji strip for the Step-3 toolbar (catalogue is codepoint-ordered,
  // so cherry-pick the useful ones by name).
  useEffect(() => {
    if (cur !== 3 || emojiQuick.length) return;
    gdElements()
      .then((r) => {
        setMaxElements(r.max_elements);
        const wanted = ["sparkles", "star", "fire", "rocket", "check mark button", "briefcase", "balance scale", "chart increasing", "party popper", "light bulb"];
        const picks: string[] = [];
        for (const w of wanted) {
          const hit = r.emoji.find((e) => e.name.toLowerCase() === w) ?? r.emoji.find((e) => e.name.toLowerCase().includes(w));
          if (hit && !picks.includes(hit.char)) picks.push(hit.char);
        }
        setEmojiQuick(picks.length ? picks.slice(0, 8) : r.emoji.slice(0, 8).map((e) => e.char));
      })
      .catch(() => setEmojiQuick([]));
  }, [cur, emojiQuick.length]);

  // Stage-2 approved image = the editing-mode canvas background.
  const stage2Ref = run?.stages["2"]?.approved?.url ?? null;
  useEffect(() => {
    if (!stage2Ref || cur !== 3) {
      setBg2Url((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      return;
    }
    let alive = true;
    gdArtifactBlob(stage2Ref)
      .then((u) => {
        if (!alive) {
          URL.revokeObjectURL(u);
          return;
        }
        setBg2Url((old) => {
          if (old) URL.revokeObjectURL(old);
          return u;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [stage2Ref, cur]);

  // Exact-render preview: the REAL deterministic text engine (debounced).
  // Only fetched while the user is in exact mode — editing mode is fully
  // client-side and instant.
  const subheadings = run?.config.subheadings ?? [];
  useEffect(() => {
    if (!run || cur !== 3 || !exactPreview) {
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      return;
    }
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      gdTextPreview(run.id, {
        tokens: { ...run.config.tokens, ...tok },
        subheading_texts: subheadings.map((s) => s.text),
      })
        .then((url) =>
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return url;
          }),
        )
        .catch(() => undefined); // preview is best-effort; Generate still works
    }, 550);
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, cur, tok]);

  /* ---------------- actions ---------------- */
  const patch = useCallback(
    (body: Parameters<typeof gdUpdateConfig>[1]) => {
      if (!run) return;
      gdUpdateConfig(run.id, body).then(setRun).catch(fail);
    },
    [run, fail],
  );

  /* ---------------- step-3 toolbar helpers ---------------- */
  const lineRef = useCallback((): { kind: "el"; key: string } | { kind: "sub"; idx: number } => {
    if (activeLine.startsWith("sub-")) return { kind: "sub", idx: Number(activeLine.slice(4)) };
    return { kind: "el", key: activeLine };
  }, [activeLine]);

  const lineStyle = (): GdSubheading | GdElementStyle => {
    const L = lineRef();
    if (!run) return {} as GdElementStyle;
    if (L.kind === "sub") return run.config.subheadings?.[L.idx] ?? ({ text: "" } as GdSubheading);
    return run.config.element_styles?.[L.key] ?? ({} as GdElementStyle);
  };

  const setLineField = (field: "font" | "color" | "size_pct" | "placement", value: string | number | null) => {
    if (!run) return;
    const L = lineRef();
    if (L.kind === "el") {
      if (value === null) return; // element styles are merge-only
      patch({ element_styles: { [L.key]: { [field]: value } as unknown as GdElementStyle } });
    } else {
      const list = (run.config.subheadings ?? []).map((s, i) => {
        if (i !== L.idx) return s;
        const next = { ...s } as Record<string, unknown>;
        if (value === null) delete next[field];
        else next[field] = value;
        return next as unknown as GdSubheading;
      });
      patch({ subheadings: list });
    }
  };

  const addTextBox = () => {
    if (!run) return;
    const list = [...(run.config.subheadings ?? [])];
    if (list.length >= 5) {
      onToast("Text-box limit reached (5 lines).");
      return;
    }
    list.push({ text: "New text" });
    // Drop the new box mid-canvas so it lands under the cursor's world,
    // instantly draggable — not buried in a form.
    patch({
      subheadings: list,
      layout: { [`subheading-${list.length - 1}`]: { x: 0.5, y: 0.5, w: DEFAULT_LAYOUT_W, anchor: "mc" } },
    });
    setActiveLine(`sub-${list.length - 1}`);
  };

  const commitEditPop = () => {
    setEditPop((pop) => {
      if (!pop || !run) return null;
      const value = pop.value;
      if (pop.id.startsWith("subheading-")) {
        setSubText(Number(pop.id.split("-")[1]), value);
      } else {
        setTok((t) => ({ ...t, [pop.id]: value }));
        patch({ tokens: { ...run.config.tokens, ...tok, [pop.id]: value } });
      }
      return null;
    });
  };

  const removeTextBox = (idx: number) => {
    if (!run) return;
    const list = (run.config.subheadings ?? []).filter((_, i) => i !== idx);
    if (!list.length) {
      onToast("At least one sub-heading line must remain.");
      return;
    }
    patch({ subheadings: list });
    setActiveLine("headline");
  };

  const setSubText = (idx: number, text: string) => {
    if (!run) return;
    const list = (run.config.subheadings ?? []).map((s, i) => (i === idx ? { ...s, text } : s));
    patch({ subheadings: list });
  };

  const addEmoji = (char: string) => {
    if (!run) return;
    const els = run.config.elements ?? [];
    if (els.length >= maxElements) {
      onToast(`Element limit reached (${maxElements}).`);
      return;
    }
    const el: GdElement = {
      id: `el-${Math.random().toString(36).slice(2, 10)}`,
      kind: "emoji", x: 0.5, y: 0.3, w: 0.15, h: 0.15,
      anchor: "mc", z: 5, rotation: 0, opacity: 1, ref: char, fill: "#1746A2",
    };
    patch({ elements: [...els, el] });
  };

  const removeElement = (id: string) => {
    if (!run) return;
    patch({ elements: (run.config.elements ?? []).filter((e) => e.id !== id) });
  };

  const variantFor = (bold: boolean, italic: boolean) =>
    cfg?.font_variants.find(
      (v) => (v.weight >= 600) === bold && ((v.style || "normal") === "italic") === italic,
    )?.name ?? null;

  const start = () =>
    guard("Studio is getting your brand kit ready…", async () => {
      const created = await gdCreateRun(brandId || null, {
        ...(aspect ? { aspect_ratio: aspect } : {}),
        creative_type: "social",
        ...(brief.trim() ? { creative_brief: { goal: brief.trim() } } : {}),
      });
      setRun(created);
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

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !run) return;
    void guard("Uploading your image…", async () => {
      const { ref } = await gdSubjectUpload(run.id, file);
      const r = await gdUpdateConfig(run.id, { subject_asset_ref: ref });
      setRun(r);
      setSel2("UPLOAD");
      setChat((c) => [
        ...c,
        {
          role: "agent",
          text: `Got it — “${file.name}” is ready in Step 2 as “Your upload”. Generate a preview there to see it composited onto your background.`,
        },
      ]);
    });
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
              {run.config.subject_asset_ref ? (
                <button
                  className={`gd2-tile ${sel2 === "UPLOAD" ? "gd2-tile--on" : ""}`}
                  onClick={() => setSel2("UPLOAD")}
                >
                  <span className="gd2-tiletxt"><b>Your upload</b></span>
                  <span className="gd2-tiledesc">Composited exactly as uploaded — no AI drawing, instant and free.</span>
                </button>
              ) : null}
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
      return (
        <>
          <span className="gd2-step-eyebrow">Step 3 of 4</span>
          <h2 className="gd2-paneltitle">Say it in your words</h2>
          <p className="gd2-help">
            Type your lines here; style the selected line with the toolbar above the canvas —
            brand fonts only, so it always looks like you. The canvas preview updates live.
          </p>
          {fields.map(([key, label]) => (
            <div className="gd2-tokfld" key={key}>
              <span>{label}</span>
              <input
                type="text"
                value={tok[key] ?? ""}
                onFocus={() => setActiveLine(key)}
                onChange={(e) => setTok((t) => ({ ...t, [key]: e.target.value }))}
                onBlur={() => patch({ tokens: { ...run.config.tokens, ...tok } })}
              />
            </div>
          ))}
          {subheadings.map((s, i) => (
            <div className="gd2-tokfld" key={`sub-${i}-${subheadings.length}`}>
              <span>
                Text {i + 1}
                {subheadings.length > 1 ? (
                  <button className="gd2-subdel" title="Remove this text box" onClick={() => removeTextBox(i)}>×</button>
                ) : null}
              </span>
              <input
                type="text"
                defaultValue={s.text}
                maxLength={120}
                onFocus={() => setActiveLine(`sub-${i}`)}
                onBlur={(e) => {
                  if (e.target.value !== s.text) setSubText(i, e.target.value);
                }}
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
          <label className="gd2-upload gd2-upload--live" title="Use your own photo as the Step-2 main image">
            ⬆ Upload photo for Step 2
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              hidden
              onChange={onUpload}
              disabled={busy !== null}
            />
          </label>
          <div className="gd2-kitcard">
            <b>Brand kit — {cfg.brand_name}</b>
            <p>Colors, fonts and the logo are locked to brand — nothing goes off-brand here.</p>
          </div>
        </aside>

        {/* center stage */}
        <section className="gd2-stage">
          {cur === 3 ? (() => {
            const st = lineStyle();
            const L = lineRef();
            const meta = L.kind === "el" ? cfg.stage3_elements.find((e) => e.key === L.key) : null;
            const canColor = L.kind === "sub" || !!meta?.colorable;
            const canSize = L.kind === "sub" || !!meta?.sizable;
            const canPlace = L.kind === "sub" || !!meta?.placeable;
            const fontName = st.font ?? run.config.font;
            const fv = cfg.font_variants.find((v) => v.name === fontName);
            const isBold = (fv?.weight ?? 400) >= 600;
            const isItal = (fv?.style || "normal") === "italic";
            const boldTarget = variantFor(!isBold, isItal);
            const italTarget = variantFor(isBold, !isItal);
            const sizeState =
              st.size_pct === cfg.text_size_pct_min ? "S" : st.size_pct === cfg.text_size_pct_max ? "L" : "M";
            const hex = typeof st.color === "string" && st.color.startsWith("#") ? st.color : "#FFFFFF";
            return (
              <div className="gd2-tt">
                <div className="gd2-tt-row">
                  <div className="gd2-tt-tabs">
                    {cfg.stage3_elements.map((e) => (
                      <button key={e.key} className={activeLine === e.key ? "on" : ""} onClick={() => setActiveLine(e.key)}>
                        {e.label}
                      </button>
                    ))}
                    {subheadings.map((_, i) => (
                      <button key={`sub-${i}`} className={activeLine === `sub-${i}` ? "on" : ""} onClick={() => setActiveLine(`sub-${i}`)}>
                        Text {i + 1}
                      </button>
                    ))}
                  </div>
                  <button className="gd2-tt-btn" onClick={addTextBox} disabled={subheadings.length >= 5}>
                    + Text box
                  </button>
                  <span className="gd2-tt-sep" />
                  <select
                    className="gd2-tt-select"
                    title="Brand fonts only"
                    value={fontName}
                    onChange={(e) => setLineField("font", e.target.value)}
                  >
                    {cfg.fonts.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {canSize ? (
                    <>
                      <div className="gd2-seg gd2-seg--tt">
                        {(["S", "M", "L"] as const).map((sz) => (
                          <button
                            key={sz}
                            className={sizeState === sz ? "on" : ""}
                            onClick={() =>
                              setLineField(
                                "size_pct",
                                sz === "S" ? cfg.text_size_pct_min
                                  : sz === "L" ? cfg.text_size_pct_max
                                  : L.kind === "sub" ? null
                                  : cfg.default_text_size_pct[L.kind === "el" ? L.key : ""] ?? cfg.text_size_pct_min,
                              )
                            }
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                      <input
                        className="gd2-tt-num"
                        type="number"
                        title="Font size (% of canvas height)"
                        min={cfg.text_size_pct_min}
                        max={cfg.text_size_pct_max}
                        step={0.5}
                        value={st.size_pct ?? cfg.default_text_size_pct[L.kind === "el" ? L.key : "subheading"] ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isFinite(v)) return;
                          setLineField("size_pct", Math.min(cfg.text_size_pct_max, Math.max(cfg.text_size_pct_min, v)));
                        }}
                      />
                    </>
                  ) : null}
                  <button
                    className={`gd2-tog ${isBold ? "on" : ""}`}
                    title={boldTarget ? "Bold" : "No bold cut in this brand family"}
                    disabled={!boldTarget}
                    onClick={() => boldTarget && setLineField("font", boldTarget)}
                  >
                    <b>B</b>
                  </button>
                  <button
                    className={`gd2-tog ${isItal ? "on" : ""}`}
                    title={italTarget ? "Italic" : "No italic cut in this brand family"}
                    disabled={!italTarget}
                    onClick={() => italTarget && setLineField("font", italTarget)}
                  >
                    <i>I</i>
                  </button>
                </div>
                <div className="gd2-tt-row">
                  {canPlace ? (
                    <div className="gd2-seg gd2-seg--tt">
                      {cfg.text_placements.map((p) => (
                        <button
                          key={p.key}
                          title={`Place on the ${p.label.toLowerCase()}`}
                          className={st.placement === p.key ? "on" : ""}
                          onClick={() => setLineField("placement", p.key)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {canColor ? (
                    <div className="gd2-swatches">
                      {cfg.text_colors.map((c) => (
                        <button
                          key={c.key}
                          title={c.label}
                          className={`gd2-swatch ${st.color === c.key ? "on" : ""}`}
                          style={{ background: c.swatch }}
                          onClick={() => setLineField("color", c.key)}
                        />
                      ))}
                      <label className="gd2-swatch gd2-swatch--custom" title="Custom color">
                        <input type="color" value={hex} onChange={(e) => setLineField("color", e.target.value.toUpperCase())} />
                      </label>
                    </div>
                  ) : null}
                  <span className="gd2-tt-sep" />
                  <div className="gd2-tt-emojis">
                    {emojiQuick.map((c) => (
                      <button key={c} className="gd2-emoji" title="Add as a design element" onClick={() => addEmoji(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                  {(run.config.elements ?? []).map((e2) => (
                    <span key={e2.id} className="gd2-elchip">
                      {e2.kind === "emoji" ? e2.ref : e2.kind}
                      <button onClick={() => removeElement(e2.id)} title="Remove">×</button>
                    </span>
                  ))}
                  <button
                    className={`gd2-tt-btn ${exactPreview ? "gd2-tt-btn--on" : ""}`}
                    title="Toggle the engine's pixel-perfect render"
                    onClick={() => setExactPreview((v) => !v)}
                  >
                    {exactPreview ? "✎ Edit mode" : "👁 Exact render"}
                  </button>
                  <button className="gd2-tt-btn gd2-tt-ai" onClick={aiPlacement} disabled={busy !== null}>
                    ✦ AI placement
                  </button>
                </div>
              </div>
            );
          })() : null}
          <div
            className="gd2-canvasbox"
            style={{
              aspectRatio: arInfo ? `${arInfo.w} / ${arInfo.h}` : "1 / 1",
              ...(arInfo && arInfo.h >= arInfo.w ? { height: "100%", maxWidth: "100%" } : { width: "min(100%, 860px)" }),
            }}
          >
            {cur === 3 ? (() => {
              // Direct manipulation: the REAL text lines are Konva nodes over
              // the approved Stage-2 image — instant 60fps drag, dblclick to
              // edit in place. "Exact render" flips to the engine's output.
              const lay = run.config.layout ?? {};
              const es = run.config.element_styles ?? {};
              const tokens = { ...run.config.tokens, ...tok };
              const fam = `${cfg.font_family}, Inter, sans-serif`;
              // Canvas fills must be flat colors. Brand tokens whose swatch is a
              // CSS gradient (e.g. the "gradient" key) get a solid stand-in here;
              // the Exact render shows the true gradient from the engine.
              const colorOf = (c?: string, fallback = "#F4F7FF") => {
                if (!c) return fallback;
                if (c.startsWith("#") || c.startsWith("rgb")) return c;
                const sw = cfg.text_colors.find((tc) => tc.key === c)?.swatch ?? "";
                if (sw.startsWith("#") || sw.startsWith("rgb")) return sw;
                if (c === "gradient" || sw.includes("gradient")) return "#E8B45A";
                return fallback;
              };
              const isLight = (hex: string) => {
                const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
                if (!m) return false;
                const n = parseInt(m[1], 16);
                return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
              };
              const styleOf = (fontName?: string) => {
                const fv = cfg.font_variants.find((v) => v.name === (fontName ?? run.config.font));
                const b = (fv?.weight ?? 400) >= 600;
                const i = (fv?.style || "normal") === "italic";
                return b && i ? "bold italic" : b ? "bold" : i ? "italic" : "normal";
              };
              const sizeOf = (key: string, pct?: number, fallback = 5) =>
                (pct ?? cfg.default_text_size_pct[key] ?? fallback) / 100;

              const texts: TextNodeSpec[] = [];
              const pos = (id: string, place?: string) => lay[id] ?? markerPoint(id, place);
              if ((tokens.headline ?? "").trim())
                texts.push({
                  id: "headline", text: tokens.headline, ...pos("headline", es.headline?.placement),
                  maxW: lay.headline?.w ?? DEFAULT_LAYOUT_W,
                  fontSize: sizeOf("headline", es.headline?.size_pct, 6.5),
                  fontFamily: fam, fontStyle: styleOf(es.headline?.font) === "normal" ? "bold" : styleOf(es.headline?.font),
                  fill: colorOf(es.headline?.color),
                });
              subheadings.forEach((s, i) => {
                if (!(s.text ?? "").trim()) return;
                const id = `subheading-${i}`;
                texts.push({
                  id, text: s.text, ...pos(id, s.placement),
                  maxW: lay[id]?.w ?? DEFAULT_LAYOUT_W,
                  fontSize: sizeOf("subheading", s.size_pct, 3.4),
                  fontFamily: fam, fontStyle: styleOf(s.font),
                  fill: colorOf(s.color),
                });
              });
              if ((tokens.cta ?? "").trim()) {
                const pillBg = colorOf(es.cta?.color, "#D9A441");
                texts.push({
                  id: "cta", text: tokens.cta, ...pos("cta", es.cta?.placement),
                  maxW: lay.cta?.w ?? DEFAULT_LAYOUT_W,
                  fontSize: sizeOf("cta", es.cta?.size_pct, 3),
                  fontFamily: fam, fontStyle: "bold",
                  fill: isLight(pillBg) ? "#1D2A50" : "#FFFFFF",
                  pill: true, pillFill: pillBg,
                });
              }
              (["venue", "website"] as const).forEach((fid) => {
                if ((tokens[fid] ?? "").trim())
                  texts.push({
                    id: fid, text: tokens[fid], ...(lay[fid] ?? (fid === "venue" ? { x: 0.06, y: 0.965 } : { x: 0.94, y: 0.965 })),
                    maxW: lay[fid]?.w ?? 0.4,
                    fontSize: sizeOf(fid, undefined, 2.2),
                    fontFamily: fam, fontStyle: styleOf(undefined),
                    fill: colorOf(undefined),
                  });
              });

              const shapeMarkers: DragMarker[] = (run.config.shapes ?? []).map((sp) => ({
                id: sp.id, label: sp.kind === "icon" ? (sp.icon ?? "icon") : sp.kind,
                x: sp.x, y: sp.y, w: sp.w, h: sp.h,
              }));

              const moveAnything = (id: string, x: number, y: number) => {
                if (id.startsWith("shape-")) {
                  patch({ shapes: (run.config.shapes ?? []).map((s) => (s.id === id ? { ...s, x, y, anchor: "mc" } : s)) });
                } else {
                  const prev = lay[id];
                  patch({ layout: { [id]: { x, y, w: prev?.w ?? DEFAULT_LAYOUT_W, anchor: "mc" } } });
                }
              };

              // Canva-style resize: side handles reflow the box, corners scale
              // the font. One combined patch so nothing races.
              const resizeText = (id: string, wFrac: number, fontFrac: number) => {
                const prev = lay[id] ?? markerPoint(id);
                const sizePct = Math.round(
                  Math.min(cfg.text_size_pct_max, Math.max(cfg.text_size_pct_min, fontFrac * 100)) * 10,
                ) / 10;
                const body: Parameters<typeof gdUpdateConfig>[1] = {
                  layout: { [id]: { x: prev.x, y: prev.y, w: wFrac, anchor: "mc" } },
                };
                if (id.startsWith("subheading-")) {
                  const idx = Number(id.split("-")[1]);
                  body.subheadings = subheadings.map((s, i) => (i === idx ? { ...s, size_pct: sizePct } : s));
                } else if (id === "headline" || id === "cta") {
                  body.element_styles = { [id]: { size_pct: sizePct } };
                }
                patch(body);
              };

              const selectAnything = (id: string | null) => {
                setSelEl(id);
                if (!id) return;
                if (id === "headline" || id === "cta" || id === "venue" || id === "website") setActiveLine(id);
                else if (id.startsWith("subheading-")) setActiveLine(`sub-${id.split("-")[1]}`);
              };

              return (
                <KonvaCanvas
                  previewSrc={exactPreview ? (previewUrl ?? bg2Url ?? undefined) : (bg2Url ?? undefined)}
                  aspect={arInfo ? arInfo.h / arInfo.w : 1}
                  markers={exactPreview ? [] : shapeMarkers}
                  onMove={moveAnything}
                  elements={exactPreview ? [] : (run.config.elements ?? [])}
                  onElementsChange={(els) => patch({ elements: els })}
                  selectedId={selEl}
                  onSelect={selectAnything}
                  texts={exactPreview ? [] : texts}
                  onTextMove={moveAnything}
                  onTextResize={resizeText}
                  onTextDblClick={(id, cx, cy) => {
                    const value = id.startsWith("subheading-")
                      ? (subheadings[Number(id.split("-")[1])]?.text ?? "")
                      : (tokens[id] ?? "");
                    setActiveLine(id.startsWith("subheading-") ? `sub-${id.split("-")[1]}` : id);
                    setEditPop({ id, x: cx, y: cy, value });
                  }}
                />
              );
            })() : (
              <AuthImg path={canvasPath} alt="Design preview" />
            )}
            {!canvasPath && cur !== 3 ? (
              <div className="gd2-canvashint">{STAGE_HINTS[cur] ?? ""}</div>
            ) : null}
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

        {/* on-canvas double-click text editor */}
        {editPop ? (
          <div
            className="gd2-editpop"
            style={{
              left: Math.max(12, Math.min(editPop.x - 130, (typeof window !== "undefined" ? window.innerWidth : 1200) - 290)),
              top: Math.max(12, editPop.y - 54),
            }}
          >
            <input
              autoFocus
              value={editPop.value}
              maxLength={140}
              onChange={(e) => setEditPop((p) => (p ? { ...p, value: e.target.value } : p))}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEditPop();
                if (e.key === "Escape") setEditPop(null);
              }}
              onBlur={commitEditPop}
            />
          </div>
        ) : null}

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
