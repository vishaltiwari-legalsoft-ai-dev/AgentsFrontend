"use client";

import { useEffect, useState } from "react";
import { gdArtifactBlob, type GdAttempt } from "@/lib/api";
import { useLoadSession } from "@/lib/load";
import { styleBadge } from "./styleChoice";

/* Text Optimizer 3-up gallery: one card per style attempt from a Stage-3
   generate set. Badges are honest by construction — "AI polished" only when
   the image really came from the model; a fallback shows "Engine render" with
   the reason on hover. Selection feeds the Approve button. */

function CardImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const session = useLoadSession();
  useEffect(() => {
    let obj: string | null = null;
    const attempt = session.begin("thumb");
    gdArtifactBlob(url)
      .then((u) => {
        // The object URL is a real resource: hand it over, or revoke it. There
        // is no third option, which is why this guard cannot just be dropped.
        if (attempt.current()) {
          obj = u;
          setSrc(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [url, session]);
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
