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
  // Position/size of the element being dragged, held in LOCAL state so a drag
  // updates only this small component every frame — never the heavy parent tree
  // (that re-render-per-move was the source of the jitter). The parent
  // (`onElementsChange`) is called ONCE, on release, with the final position.
  const [live, setLive] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  const pt = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return { x: 0.5, y: 0.5 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const down = (e: React.PointerEvent, el: GdElement, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(el.id);
    const p = pt(e);
    setDrag({ id: el.id, mode, ox: p.x - el.x, oy: p.y - el.y });
    setLive({ id: el.id, x: el.x, y: el.y, w: el.w, h: el.h });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pt(e);
    setLive((l) => {
      if (!l) return l;
      if (drag.mode === "move") {
        return { ...l, x: clamp(p.x - drag.ox), y: clamp(p.y - drag.oy) };
      }
      // Resize handle sits at bottom-right of the box; distance from center
      // to pointer (doubled) gives the new box width. Keep it square (w===h)
      // since emoji/icon/sticker/image assets are all rendered contain-fit.
      const w = clamp(Math.abs(p.x - l.x) * 2);
      return { ...l, w: Math.max(0.03, w), h: Math.max(0.03, w) };
    });
  };
  const up = () => {
    if (drag && live) {
      const { id, x, y, w, h } = live;
      onElementsChange(elements.map((el) => (el.id === id ? { ...el, x, y, w, h } : el)));
    }
    setDrag(null);
    setLive(null);
  };

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
      {elements.map((el) => {
        // While dragging, render the dragged element from the local `live`
        // position so it tracks the cursor smoothly without a parent re-render.
        const p = live && live.id === el.id ? live : el;
        const isDragging = drag?.id === el.id;
        return (
          <div
            key={el.id}
            className={`gdcanvas__el${selectedId === el.id ? " is-sel" : ""}${isDragging ? " is-drag" : ""}`}
            style={{
              left: `${(p.x - p.w / 2) * 100}%`,
              top: `${(p.y - p.h / 2) * 100}%`,
              width: `${p.w * 100}%`,
              height: `${p.h * 100}%`,
              transform: `rotate(${el.rotation}deg)`,
              opacity: el.opacity,
              zIndex: isDragging ? 999 : el.z,
              willChange: isDragging ? "left, top, width, height" : undefined,
            }}
            onPointerDown={(e) => down(e, el, "move")}
          >
            {visual(el)}
            {selectedId === el.id && (
              <span className="gdcanvas__handle" onPointerDown={(e) => down(e, el, "resize")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
