"use client";

import { useEffect, useState } from "react";
import { gdArtifactBlob, type GdAttempt } from "@/lib/api";
import { styleBadge } from "./styleChoice";

/* Text Optimizer 3-up gallery: one card per style attempt from a Stage-3
   generate set. Badges are honest by construction — "AI polished" only when
   the image really came from the model; a fallback shows "Engine render" with
   the reason on hover. Selection feeds the Approve button. */

function CardImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    gdArtifactBlob(url)
      .then((u) => {
        if (alive) {
          obj = u;
          setSrc(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [url]);
  if (!src) return <span className="gd2-stylecard-skeleton" aria-busy="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}

export function StyleGallery({
  attempts,
  selected,
  onSelect,
}: {
  attempts: GdAttempt[];
  selected: number | null;
  onSelect: (attemptNo: number) => void;
}) {
  return (
    <div className="gd2-stylegallery" role="radiogroup" aria-label="Pick a style">
      {attempts.map((a) => (
        <button
          key={a.attempt}
          type="button"
          role="radio"
          aria-checked={selected === a.attempt}
          className={`gd2-stylecard${selected === a.attempt ? " gd2-stylecard--sel" : ""}`}
          onClick={() => onSelect(a.attempt)}
        >
          <CardImage url={a.url} alt={a.style_label ?? a.style ?? "style"} />
          <span className="gd2-stylecard-meta">
            <b>{a.style_label ?? a.style}</b>
            <span
              className={`gd2-stylecard-badge${a.ai ? " gd2-stylecard-badge--ai" : ""}`}
              title={a.ai ? undefined : a.fallback_reason ?? undefined}
            >
              {styleBadge(a)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
