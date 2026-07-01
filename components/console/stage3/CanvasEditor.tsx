"use client";

import { useRef, useState } from "react";
import type { GdElement } from "../../../lib/api";

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Canva-style drag/resize/rotate surface for Stage-3 free elements (emoji /
 * icon / sticker / uploaded image). Builds on the DragCanvas fractional-coord
 * pointer-math convention (see DragCanvas.tsx), but renders full element
 * visuals (mirroring the server compositor) instead of point chips, and
 * exposes a resize handle since elements carry their own w/h.
 *
 * Box model MUST match the backend anchor="mc" math exactly:
 *   left = (x - w/2) * 100%, top = (y - h/2) * 100%, width = w*100%, height = h*100%
 * so the canvas stays WYSIWYG with the downloaded PNG. Do not change this.
 */
export function CanvasEditor({
  previewSrc,
  elements,
  onElementsChange,
  selectedId,
  onSelect,
  children,
}: {
  previewSrc?: string;
  elements: GdElement[];
  onElementsChange: (els: GdElement[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  children?: React.ReactNode; // text chips overlay from the parent
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; ox: number; oy: number } | null>(null);

  const pt = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return { x: 0.5, y: 0.5 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const patch = (id: string, p: Partial<GdElement>) =>
    onElementsChange(elements.map((el) => (el.id === id ? { ...el, ...p } : el)));

  const down = (e: React.PointerEvent, el: GdElement, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(el.id);
    const p = pt(e);
    setDrag({ id: el.id, mode, ox: p.x - el.x, oy: p.y - el.y });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pt(e);
    const el = elements.find((x) => x.id === drag.id);
    if (!el) return;
    if (drag.mode === "move") {
      patch(drag.id, { x: clamp(p.x - drag.ox), y: clamp(p.y - drag.oy) });
    } else {
      // Resize handle sits at bottom-right of the box; distance from center
      // to pointer (doubled) gives the new box width. Keep it square (w===h)
      // since emoji/icon/sticker/image assets are all rendered contain-fit.
      const w = clamp(Math.abs(p.x - el.x) * 2);
      patch(drag.id, { w: Math.max(0.03, w), h: Math.max(0.03, w) });
    }
  };
  const up = () => setDrag(null);

  const visual = (el: GdElement) => {
    if (el.kind === "emoji") {
      // MUST match backend _char_to_codepoints exactly: lowercase hex
      // codepoints, FE0F variation selector stripped, joined with "-".
      const file = [...el.ref]
        .map((c) => c.codePointAt(0)!.toString(16))
        .filter((h) => h !== "fe0f")
        .join("-");
      return (
        <img
          src={`/emoji/apple/${file}.png`}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%" }}
        />
      );
    }
    if (el.kind === "icon") {
      return (
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: el.fill,
            WebkitMaskImage: `url(/gd-icons/${el.ref}.svg)`,
            maskImage: `url(/gd-icons/${el.ref}.svg)`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      );
    }
    const src = el.kind === "sticker" ? `/gd-stickers/${el.ref}.svg` : el.ref;
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  };

  return (
    <div
      className="gdcanvas"
      ref={ref}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerDown={() => onSelect(null)}
    >
      {previewSrc && <img className="gdcanvas__base" src={previewSrc} alt="Stage 3 preview" />}
      {children}
      {elements.map((el) => (
        <div
          key={el.id}
          className={`gdcanvas__el${selectedId === el.id ? " is-sel" : ""}`}
          style={{
            left: `${(el.x - el.w / 2) * 100}%`,
            top: `${(el.y - el.h / 2) * 100}%`,
            width: `${el.w * 100}%`,
            height: `${el.h * 100}%`,
            transform: `rotate(${el.rotation}deg)`,
            opacity: el.opacity,
          }}
          onPointerDown={(e) => down(e, el, "move")}
        >
          {visual(el)}
          {selectedId === el.id && (
            <span className="gdcanvas__handle" onPointerDown={(e) => down(e, el, "resize")} />
          )}
        </div>
      ))}
    </div>
  );
}
