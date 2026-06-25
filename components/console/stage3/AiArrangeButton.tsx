"use client";

import { useState } from "react";
import { gdSuggestPlacement, type GdLayoutEntry } from "../../../lib/api";

/**
 * One-click "AI Suggest Placement" — a refinement, never the default flow.
 * Fetches a proposed arrangement, applies it, and offers a one-step Undo that
 * restores the previous coordinates (and clears any pins the arrange added).
 */
export function AiArrangeButton({
  runId,
  currentLayout,
  onApply,
  onError,
  disabled,
}: {
  runId: string;
  currentLayout: Record<string, GdLayoutEntry>;
  onApply: (layout: Record<string, GdLayoutEntry | null>) => Promise<void> | void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Record<string, GdLayoutEntry | null> | null>(null);

  const arrange = async () => {
    setBusy(true);
    try {
      const r = await gdSuggestPlacement(runId);
      const u: Record<string, GdLayoutEntry | null> = {};
      Object.keys(r.layout).forEach((id) => {
        u[id] = currentLayout[id] ?? null; // restore prior coord, or unpin if it was auto
      });
      setUndo(u);
      await onApply(r.layout);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Couldn't arrange the layout");
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (!undo) return;
    await onApply(undo);
    setUndo(null);
  };

  return (
    <div className="gdrow" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
      <button
        type="button"
        className="gdminibtn gdminibtn--primary"
        onClick={arrange}
        disabled={busy || disabled}
        title="Auto-arrange all elements into a polished layout"
      >
        <Sparkle /> {busy ? "Arranging…" : "AI Suggest Placement"}
      </button>
      {undo && (
        <button type="button" className="gdminibtn" onClick={revert} disabled={busy}>
          Undo arrange
        </button>
      )}
    </div>
  );
}

function Sparkle() {
  return <span aria-hidden style={{ marginRight: 2 }}>✨</span>;
}
