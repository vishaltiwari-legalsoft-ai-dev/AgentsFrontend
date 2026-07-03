import type { GdElement } from "@/lib/api";
import { emojiFile } from "./canvasMath";

/**
 * Element kind -> image URL. Moved verbatim from CanvasEditor.tsx's
 * `visual()` branch-selection logic (components/console/stage3/CanvasEditor.tsx
 * lines ~81-127), just without the JSX wrapper:
 *   - emoji: `/emoji/apple/<codepoints>.png` (codepoint math now lives in
 *     canvasMath.emojiFile, which is byte-identical to the inline mapper
 *     CanvasEditor used).
 *   - icon: `/gd-icons/<ref>.svg` (CanvasEditor CSS-masks this one for tint;
 *     see tintImage.ts for the canvas-based replacement).
 *   - sticker: `/gd-stickers/<ref>.svg`.
 *   - image: `el.ref` untouched — CanvasEditor passes uploaded-image refs
 *     straight through as the <img src>, since gdElementUpload's response
 *     ref is already a ready-to-use URL. No runId or API base needed.
 *
 * `runId` is accepted for signature parity with the migration plan but is
 * unused: CanvasEditor never threads a runId into this mapping.
 */
export function elementSrc(el: GdElement, runId?: string): string {
  void runId;
  switch (el.kind) {
    case "emoji":
      return `/emoji/apple/${emojiFile(el.ref)}`;
    case "icon":
      return `/gd-icons/${el.ref}.svg`;
    case "sticker":
      return `/gd-stickers/${el.ref}.svg`;
    case "image":
      return el.ref;
  }
}
