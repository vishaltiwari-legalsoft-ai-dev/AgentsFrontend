"use client";

import { useEffect, useState } from "react";
import { loadLibrary, type GalleryItem, type LibraryBrand } from "@/lib/api";
import { Icon, Button } from "@/lib/kit-ui";

export function LibraryView({ onBack }: { onBack: () => void }) {
  const [brands, setBrands] = useState<LibraryBrand[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((result) => {
        if (!cancelled) setBrands(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load library");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="cview" style={{ maxWidth: "100%" }}>
      <div className="csechead">
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0 }}>Library</h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Every brand kit creative stored in your workspace.
          </div>
        </div>
        <Button variant="secondary" size="sm" iconLeft={<Icon name="messages-square" />} onClick={onBack}>
          Back to teams
        </Button>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 14, borderRadius: "var(--radius-lg)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!brands && !error && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Loading library…</div>
      )}

      {brands && brands.length === 0 && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 13, fontStyle: "italic" }}>
          No brands found. Run ingestion from the backend to load them.
        </div>
      )}

      {brands && brands.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {brands.map((brand) => (
            <section key={brand.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, margin: 0 }}>
                  {brand.brand_name}
                </h4>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {brand.creative_count} {brand.creative_count === 1 ? "asset" : "assets"}
                </span>
              </div>
              {brand.creatives.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>No assets yet.</div>
              ) : (
                <div className="cgrid cgrid--3">
                  {brand.creatives.map((item) => (
                    <AssetThumb key={item.view_url} item={item} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetThumb({ item }: { item: GalleryItem }) {
  return (
    <a
      href={item.view_url}
      target="_blank"
      rel="noreferrer"
      title={item.file_name}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ aspectRatio: "1", overflow: "hidden", background: "var(--gray-100)" }}>
        {item.is_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.view_url} alt={item.file_name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)" }}>
            {item.file_name.split(".").pop()?.toUpperCase() || "FILE"}
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.file_name}
        </div>
      </div>
    </a>
  );
}
