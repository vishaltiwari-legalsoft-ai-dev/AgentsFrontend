"use client";

import { useEffect, useState } from "react";
import { getImageLibrary, imageLibraryBlob, type ImageLibraryItem } from "@/lib/api";
import { Icon, Button } from "@/lib/kit-ui";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Admin-only gallery of every COMPLETED Graphics Designer run. Each card is the
 * run's final (Stage-4 approved) creative, archived to GCS at approval time,
 * with who made it, for which brand, and when.
 */
export function ImageLibraryView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<ImageLibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getImageLibrary()
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the image library");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="cview" style={{ maxWidth: "100%" }}>
      <div className="csechead">
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="images" /> Image library
          </h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            The final creative of every completed Graphics Designer run, across all users.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 14, borderRadius: "var(--radius-lg)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!items && !error && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading gallery…</div>
      )}

      {items && items.length === 0 && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
          No completed runs yet — finished creatives will appear here automatically.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="clibgrid">
          {items.map((item) => (
            <GalleryCard key={item.run_id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryCard({ item }: { item: ImageLibraryItem }) {
  // Signed GCS URLs render directly; API proxy paths need the Bearer header,
  // so those are fetched as a blob and shown via a local object URL.
  const isProxy = item.view_url.startsWith("/api/");
  const [src, setSrc] = useState<string | null>(isProxy ? null : item.view_url);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!isProxy) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    imageLibraryBlob(item.view_url)
      .then((url) => {
        objectUrl = url;
        if (!cancelled) setSrc(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isProxy, item.view_url]);

  const download = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `${item.run_id}-final.png`;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  return (
    <div
      className="clibtile"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div style={{ aspectRatio: "1", overflow: "hidden", background: "var(--gray-100)", position: "relative" }}>
        {src && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.headline || item.summary || "Final creative"}
            loading="lazy"
            onError={() => setBroken(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)" }}>
            {broken ? "IMAGE UNAVAILABLE" : "LOADING…"}
          </div>
        )}
        {item.aspect_ratio && (
          <span style={{ position: "absolute", top: 6, right: 6, padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "rgba(0,0,0,0.55)", color: "#fff" }}>
            {item.aspect_ratio}
          </span>
        )}
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.headline || item.summary}>
          {item.headline || item.summary || item.run_id}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.user_email}>
          {item.brand ? `${item.brand} · ` : ""}{item.user_email || "unknown"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{formatDate(item.completed_at)}</span>
          <button
            type="button"
            onClick={download}
            disabled={!src}
            title="Download"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: src ? "pointer" : "default", color: src ? "var(--blue-600, #2563eb)" : "var(--text-tertiary)", fontSize: 10.5, fontWeight: 600, padding: 0 }}
          >
            <Icon name="download" size={12} /> PNG
          </button>
        </div>
      </div>
    </div>
  );
}
