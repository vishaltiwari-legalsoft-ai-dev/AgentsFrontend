"use client";

import { useState } from "react";
import { gdSuggestPlacement, type GdPlacementSuggestion } from "../../../lib/api";

/**
 * One-click "AI Suggest Placement" — a refinement, never the default flow.
 * Vision-first: the backend looks at the approved Stage-2 image and returns the
 * zone / text colour / density judgment turned into exact coordinates (with a
 * deterministic fallback). The parent applies the proposal and hands back a
 * revert closure so Undo restores layout AND colours, not just positions.
 */
export function AiArrangeButton({
  runId,
  onApply,
  onError,
  disabled,
}: {
  runId: string;
  /** Apply the proposal; return a revert closure for one-step Undo. */
  onApply: (res: GdPlacementSuggestion) => Promise<(() => Promise<void>) | void>;
  onError?: (msg: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);

  const arrange = async () => {
    setBusy(true);
    try {
      const r = await gdSuggestPlacement(runId);
      const revert = await onApply(r);
      setUndo(() => revert ?? null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Couldn't arrange the layout");
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (!undo) return;
    await undo();
    setUndo(null);
  };

  return (
    <div className="gdrow" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
      <button
        type="button"
        className="gdminibtn gdminibtn--primary"
        onClick={arrange}
        disabled={busy || disabled}
        title="Look at the image and auto-arrange all elements into a polished layout"
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
