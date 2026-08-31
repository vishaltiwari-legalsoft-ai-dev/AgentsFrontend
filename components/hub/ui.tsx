"use client";

/** The console's own small objects, and the three states a fetched panel has.
 *
 *  The first half is the prototype's builders — `phead`, the monogram stamp, the
 *  44px tile, the state cell — as components. The second half has no counterpart
 *  there, because a fixed dataset is never loading, never empty for a reason
 *  worth explaining, and never unreachable.
 */

import type { ReactNode } from "react";
import { Ic } from "./Sprite";
import { useArtifact } from "./useArtifact";
import type { HubAgent } from "./model";

/* ---------------------------------------------------------- the prototype -- */

/** The statement-and-lede pair every panel opens with. `statement` may carry
 *  emphasis, so it is a node rather than a string. */
export function PageHead({ statement, lede }: { statement: ReactNode; lede: ReactNode }) {
  return (
    <div className="phead">
      <p className="statement">{statement}</p>
      <p className="lede">{lede}</p>
    </div>
  );
}

/** The monogram stamp: a hard-edged square, two condensed capitals. The console's
 *  own object, and the only thing that stands for an agent when there is no
 *  picture to show. */
export function Mono({ agent, size, tone }: { agent: Pick<HubAgent, "mono">; size?: "sm" | "lg"; tone?: string }) {
  const cls = ["mono", size ? `mono--${size}` : "", tone || ""].filter(Boolean).join(" ");
  return <span className={cls} aria-hidden="true">{agent.mono}</span>;
}

export type RunTileState = "done" | "running" | "queued" | "failed";

/** What a row leads with: the picture it produced, or its stamp.
 *
 *  The prototype could print the one figure a run produced here, because its
 *  dataset carried one per run. The trail records no such figure, so a run that
 *  made no image leads with the specialist's stamp — the thing that made it —
 *  rather than a number this console would have had to invent.
 *
 *  The picture is an *authenticated artifact reference*, not a URL a browser
 *  can fetch on its own — see `useArtifact` for why putting it straight into a
 *  `src` produced three different failures at once. Until the bytes arrive, and
 *  for ever if they are gone, the stamp stands in: a 44px tile is not the place
 *  to report a missing attachment, and a broken-image glyph there would tell
 *  the reader their work was lost when the row in front of them is the record
 *  that it was not.
 */
export function Tile({
  state, image, alt, mono, className,
}: {
  state: RunTileState;
  image?: string | null;
  alt?: string;
  mono?: string;
  className?: string;
}) {
  const art = useArtifact(state === "done" ? image : null);
  const cls = (extra: string) => ["tile", extra, className].filter(Boolean).join(" ");
  if (state === "queued") return <span className={cls("is-queued")} aria-hidden="true" />;
  if (state === "failed") return <span className={cls("is-failed")} aria-hidden="true"><b>!</b></span>;
  if (state === "running") return <span className={cls("is-running")} aria-hidden="true"><b>···</b></span>;
  if (art.phase === "ready") {
    return (
      <span className={cls("")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art.url} alt={alt || ""} loading="lazy" />
      </span>
    );
  }
  return <span className={cls("")} aria-hidden="true"><b>{mono || "—"}</b></span>;
}

const STATE_LABEL: Record<RunTileState, string> = {
  done: "Done", running: "Running", failed: "Failed", queued: "Queued",
};

export function StateCell({ state }: { state: RunTileState }) {
  return <span className={`rrow__state ${state}`}><i />{STATE_LABEL[state]}</span>;
}

export { STATE_LABEL };

/** A section's rule, its heading pair, and whatever sits at its right edge. */
export function RuleHead({ title, note, aside }: { title: string; note?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="rule-head">
      <div>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {aside}
    </div>
  );
}

export function Facet({
  on, label, count, onClick,
}: { on: boolean; label: string; count?: number | null; onClick: () => void }) {
  return (
    <button type="button" className={`facet${on ? " is-on" : ""}`} onClick={onClick}>
      {label}
      {count != null && <u>{count.toLocaleString("en-US")}</u>}
    </button>
  );
}

/* --------------------------------------------------- the three live states -- */

/** In flight. Not the same as empty, and it must never be drawn as empty: a
 *  panel that says "no brands yet" while its request is still open tells the
 *  reader their data is gone. */
export function Wait({ what = "Loading", rows = 0 }: { what?: string; rows?: number }) {
  if (rows > 0) {
    return (
      <div className="wait__rows" role="status" aria-live="polite" aria-label={`${what}…`}>
        {Array.from({ length: rows }, (_, i) => <div className="wait__row" key={i} />)}
      </div>
    );
  }
  return (
    <p className="wait" role="status" aria-live="polite">
      <i className="wait__spin" aria-hidden="true" />
      {what}…
    </p>
  );
}

/** Nothing here yet — and that is the true answer, not a failure. Always says
 *  what would put something here. */
export function Blank({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="blank">
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** We never found out. Distinct from empty on purpose. */
export function Oops({ what, error, onRetry }: { what: string; error: string; onRetry?: () => void }) {
  return (
    <div className="oops" role="alert">
      <Ic name="x" />
      <div>
        <b>{what}</b>
        <p>{error}</p>
        {onRetry && (
          <div className="oops__act">
            <button type="button" className="btn btn--quiet btn--sm" onClick={onRetry}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A figure this console has no source for. Rendered as a dash carrying its
 *  reason, never as a number and never as a zero. */
export function Unknown({ why }: { why: string }) {
  return <span className="unknown" title={why}>—</span>;
}
