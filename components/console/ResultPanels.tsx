"use client";

import { useEffect, useState } from "react";
import {
  API_URL,
  importToCanva,
  PERSONA_FIELDS,
  type AgentResult,
  type AssetsResult,
  type BrandAnalysisResult,
  type BrandPersona,
  type GalleryItem,
  type IntakeResult,
  type LogoRef,
} from "@/lib/api";
import { Icon, Badge, Button } from "@/lib/kit-ui";

/** Render inline **bold** markdown; newlines are preserved by `pre-wrap`. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ResultView({
  result,
  interactive = false,
  busy = false,
  onRequirements,
}: {
  result: AgentResult;
  interactive?: boolean;
  busy?: boolean;
  onRequirements?: (aspectRatio: string, brief: string) => void;
}) {
  if (result.type === "intake") {
    return (
      <IntakeView
        result={result}
        interactive={interactive}
        busy={busy}
        onRequirements={onRequirements}
      />
    );
  }
  if (result.type === "message") {
    return (
      <div className="twbubble" style={{ marginLeft: 42, whiteSpace: "pre-wrap" }}>
        <RichText text={result.text} />
      </div>
    );
  }
  if (result.type === "brand_analysis") {
    return <BrandHub result={result} />;
  }
  return <AssetsView result={result} />;
}

function extractHexes(text?: string): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(/#[0-9a-fA-F]{6}/g) ?? [])).slice(0, 8);
}

function PersonaCard({
  persona,
  logo,
  website,
  brand,
}: {
  persona: BrandPersona;
  logo?: LogoRef | null;
  website?: string | null;
  brand?: string | null;
}) {
  const fields = PERSONA_FIELDS.filter((f) => persona[f.key]);
  if (fields.length === 0 && !logo) return null;
  const swatches = extractHexes(persona.color_palette);
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "#fff",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.view_url} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
          ) : (
            <Icon name="sparkles" size={18} />
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{brand || "Brand persona"}</div>
          {website ? (
            <a href={website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--gray-300)" }}>
              {website.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <div style={{ fontSize: 11, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Brand persona</div>
          )}
        </div>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {swatches.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {swatches.map((c) => (
              <span key={c} title={c} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: "1px solid rgba(255,255,255,0.2)" }} />
            ))}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
          {fields.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--gray-200, #e5e7eb)", lineHeight: 1.5 }}>{persona[f.key]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FALLBACK_RATIOS = [
  { ratio: "1:1", label: "Square (feed)" },
  { ratio: "4:5", label: "Portrait (Instagram)" },
  { ratio: "9:16", label: "Story / Reel" },
  { ratio: "16:9", label: "Landscape / YouTube" },
  { ratio: "1.91:1", label: "Link / LinkedIn" },
  { ratio: "8.5:11", label: "Flyer / print" },
];

/** Step 4 mini form: aspect ratio chips + brief, one click to generate. */
function RequirementsForm({
  options,
  suggestions,
  busy,
  onSubmit,
}: {
  options: { ratio: string; label: string }[];
  suggestions: { aspect_ratio?: string | null; brief?: string | null };
  busy: boolean;
  onSubmit: (aspectRatio: string, brief: string) => void;
}) {
  const [ratio, setRatio] = useState(suggestions.aspect_ratio || "");
  const [customRatio, setCustomRatio] = useState("");
  const [brief, setBrief] = useState(suggestions.brief || "");
  const effectiveRatio = customRatio.trim() || ratio;
  const canSubmit = !busy && Boolean(effectiveRatio) && Boolean(brief.trim());

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-tertiary)",
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-xs)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span style={labelStyle}>1 · Aspect ratio / size</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => {
          const active = effectiveRatio === o.ratio;
          return (
            <button
              key={o.ratio}
              type="button"
              title={o.label}
              onClick={() => {
                setRatio(o.ratio);
                setCustomRatio("");
              }}
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                border: `1px solid ${active ? "var(--ink)" : "var(--border-strong)"}`,
                background: active ? "var(--ink)" : "var(--surface)",
                color: active ? "#fff" : "var(--text-secondary)",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {o.ratio} <span style={{ opacity: 0.65, fontWeight: 500 }}>· {o.label}</span>
            </button>
          );
        })}
        <input
          value={customRatio}
          onChange={(e) => setCustomRatio(e.target.value)}
          placeholder="Custom (e.g. 3:2)"
          style={{
            width: 120,
            padding: "5px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>

      <span style={labelStyle}>2 · What should it say / show?</span>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={3}
        placeholder="Describe the message, offer, or event — the agent picks the best format (ad, banner, offer post, event promo…)."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-strong)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          lineHeight: 1.5,
          resize: "none",
          outline: "none",
        }}
      />

      <Button
        variant="brand"
        size="sm"
        disabled={!canSubmit}
        onClick={() => canSubmit && onSubmit(effectiveRatio, brief.trim())}
        iconLeft={<Icon name="sparkles" size={14} />}
      >
        Generate design
      </Button>
    </div>
  );
}

function IntakeView({
  result,
  interactive,
  busy,
  onRequirements,
}: {
  result: IntakeResult;
  interactive: boolean;
  busy: boolean;
  onRequirements?: (aspectRatio: string, brief: string) => void;
}) {
  return (
    <div style={{ marginLeft: 42, display: "flex", flexDirection: "column", gap: 10, maxWidth: 600 }}>
      {result.persona && (
        <PersonaCard persona={result.persona} logo={result.logo} website={result.brand_website} brand={result.brand} />
      )}
      <div className="twbubble" style={{ whiteSpace: "pre-wrap" }}>
        <RichText text={result.text} />
      </div>
      {interactive && onRequirements ? (
        <RequirementsForm
          options={result.aspect_ratios?.length ? result.aspect_ratios : FALLBACK_RATIOS}
          suggestions={result.suggestions ?? {}}
          busy={busy}
          onSubmit={onRequirements}
        />
      ) : null}
      {typeof result.style_refs_loaded === "number" && result.style_refs_loaded > 0 && (
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 4 }}>
          {result.logos_found ?? 0} logo(s) and {result.style_refs_loaded} style reference(s) ready for generation.
        </p>
      )}
    </div>
  );
}

function AssetsView({ result }: { result: AssetsResult }) {
  const typeLabel = (result.creative_type || result.category || "design").replace(/_/g, " ");
  return (
    <div style={{ marginLeft: 42, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
      {result.persona && (
        <PersonaCard persona={result.persona} logo={result.logo} website={result.brand_website} brand={result.brand} />
      )}
      <div className="twbubble">
        <Badge variant="brand" style={{ marginRight: 8, textTransform: "capitalize" }}>
          {typeLabel}
        </Badge>
        {result.aspect_ratio && (
          <Badge style={{ marginRight: 8 }}>{result.aspect_ratio}</Badge>
        )}
        I decided a <strong style={{ textTransform: "capitalize" }}>{typeLabel}</strong> fits best{" "}
        {result.brand ? (
          <>
            for <strong>{result.brand}</strong>
          </>
        ) : (
          "from your brief"
        )}
        , and rendered two variations. Variation A has the real brand logo composited in; Variation B leaves a placeholder for Canva.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <AssetCard title="Variation A — With Logo" badge="A" url={result.assets.with_logo.url} />
        <AssetCard
          title="Variation B — Logo Placeholder"
          badge="B"
          url={result.assets.with_placeholder.url}
          canvaConfigured={result.canva.configured}
          logo={result.logo}
        />
      </div>
    </div>
  );
}

function AssetCard({
  title,
  badge,
  url,
  canvaConfigured,
  logo,
}: {
  title: string;
  badge: string;
  url: string;
  canvaConfigured?: boolean;
  logo?: { file_name: string; view_url: string } | null;
}) {
  const [canvaLabel, setCanvaLabel] = useState(logo ? "Import + logo to Canva" : "Import to Canva");
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function onImport() {
    setCanvaBusy(true);
    setCanvaLabel("Importing...");
    const design = await importToCanva(url, title);
    if (!design.ok) {
      if (design.needsAuth) {
        window.location.href = `${API_URL}/api/canva/authorize`;
        return;
      }
      setCanvaLabel("Import failed");
      setCanvaBusy(false);
      return;
    }
    if (logo) {
      const logoOutcome = await importToCanva(logo.view_url, `Logo — ${logo.file_name}`);
      if (!logoOutcome.ok && logoOutcome.needsAuth) {
        window.location.href = `${API_URL}/api/canva/authorize`;
        return;
      }
    }
    setCanvaLabel(logo ? "Design + logo imported" : "Imported");
    setCanvaBusy(false);
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        padding: 10,
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        aria-label={`Open ${title} preview`}
        style={{
          width: "100%",
          height: 140,
          border: 0,
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          background: "var(--gray-100)",
          position: "relative",
          padding: 0,
          cursor: "zoom-in",
          display: "block",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "var(--brand)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {badge}
        </span>
      </button>
      <div style={{ padding: "8px 4px 4px" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <a href={url} download style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>
            Download
          </a>
          {canvaConfigured && (
            <button
              type="button"
              onClick={() => void onImport()}
              disabled={canvaBusy}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", background: "none", border: 0, cursor: "pointer" }}
            >
              {canvaLabel}
            </button>
          )}
        </div>
      </div>
      {previewOpen ? (
        <ImagePreviewModal title={title} url={url} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </div>
  );
}

function ImagePreviewModal({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(96vw, 1100px)",
          maxHeight: "92vh",
          background: "var(--surface)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>{title}</div>
          <a href={url} download style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>
            Download
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ background: "var(--gray-100)", padding: 12, display: "flex", justifyContent: "center", overflow: "auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={title} style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    </div>
  );
}

function BrandHub({ result }: { result: BrandAnalysisResult }) {
  const meta = result.brand.brand_metadata ?? {};
  const colors = meta.primary_colors ?? [];
  const fonts = meta.fonts ?? [];

  return (
    <div style={{ marginLeft: 42, maxWidth: 640 }}>
      <div className="twbubble" style={{ marginBottom: 12 }}>
        I analyzed <strong>{result.brand.brand_name}</strong> ({result.creative_count} stored creatives). {result.summary}
      </div>
      <div
        style={{
          background: "var(--ink)",
          color: "#fff",
          borderRadius: "var(--radius-xl)",
          padding: 20,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          {result.brand.brand_name}
        </div>
        {colors.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", marginBottom: 8 }}>
              Primary colors
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {colors.map((hex) => (
                <span key={hex} title={hex} style={{ width: 36, height: 36, borderRadius: "50%", background: hex, border: "2px solid rgba(255,255,255,0.2)" }} />
              ))}
            </div>
          </div>
        )}
        {fonts.length > 0 && (
          <div style={{ marginBottom: 16, fontSize: 13, color: "var(--gray-300)" }}>
            Font: <strong style={{ color: "#fff" }}>{fonts[0]}</strong>
          </div>
        )}
        {result.gallery.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {result.gallery.slice(0, 8).map((item) => (
              <GalleryThumb key={item.view_url} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryThumb({ item }: { item: GalleryItem }) {
  return (
    <a href={item.view_url} target="_blank" rel="noreferrer" style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: "var(--gray-800)" }}>
      {item.is_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.view_url} alt={item.file_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 10, color: "var(--gray-400)" }}>
          {item.file_name.split(".").pop()?.toUpperCase()}
        </div>
      )}
    </a>
  );
}
