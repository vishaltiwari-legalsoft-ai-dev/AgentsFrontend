"use client";

import { useEffect, useState } from "react";
import { gdIngestedBrands, type GdIngestedBrand } from "@/lib/api";

/* Setup-screen readiness strip: which brands have ingested kit data, and how
   much. Read-only and best-effort — a load failure hides the strip entirely
   so the setup flow is never blocked. */
export function BrandStrip() {
  const [brands, setBrands] = useState<GdIngestedBrand[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    gdIngestedBrands()
      .then((r) => setBrands(r.brands))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (brands === null) {
    return (
      <div className="gd2-brandstrip" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="gd2-bchip gd2-bchip--skeleton" />
        ))}
      </div>
    );
  }
  if (!brands.length) {
    return (
      <div className="gd2-brandstrip">
        <span className="gd2-bstrip-lbl">Ingested brands</span>
        <span className="gd2-bstrip-empty">No brand data ingested yet.</span>
      </div>
    );
  }
  return (
    <div className="gd2-brandstrip">
      <span className="gd2-bstrip-lbl">Ingested brands</span>
      {brands.map((b) => {
        const counts = [
          `${b.counts.logos} logo${b.counts.logos === 1 ? "" : "s"}`,
          `${b.counts.fonts} font${b.counts.fonts === 1 ? "" : "s"}`,
          b.counts.reference_assets !== undefined ? `${b.counts.reference_assets} refs` : "— refs",
        ].join(" · ");
        return (
          <span key={b.id} className="gd2-bchip" title={`${b.name} — ${counts}`}>
            {b.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo_url} alt="" />
            ) : (
              <span className="gd2-bchip-mark">{(b.name || "?").slice(0, 1)}</span>
            )}
            <span className="gd2-bchip-body">
              <b>{b.name}</b>
              <span>{counts}</span>
            </span>
            <span className="gd2-bchip-dots">
              {b.primary_colors.slice(0, 5).map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
