"use client";

import { useRef, useState } from "react";

// One draggable element handle, positioned at fractional (x,y) over the preview.
// When `w`/`h` are set, the marker renders as a draggable bounding BOX (x,y is
// its center) — used for shapes so the whole shape can be grabbed. Otherwise it
// renders as a small point chip (used for text elements).
export interface DragMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/**
 * Hand-rolled (no Konva/Fabric) free-drag surface for Stage-3 elements.
 *
 * Wraps the server-rendered live preview and overlays a draggable handle per
 * element. Dragging a handle reports a new fractional anchor position; the
 * parent persists it and the preview re-renders authoritatively — so the canvas
 * never has to measure text bounds itself.
 */
export function DragCanvas({
  markers,
  onMove,
  onSelect,
  children,
}: {
  markers: DragMarker[];
  onMove: (id: string, x: number, y: number) => void;
  onSelect?: (id: string) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // ox/oy = grab offset (pointer − element center) so the element doesn't jump
  // to the cursor on grab.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const pt = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { x: 0.5, y: 0.5 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const down = (e: React.PointerEvent, m: DragMarker) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(m.id);
    onSelect?.(m.id);
    const p = pt(e);
    setDrag({ id: m.id, x: m.x, y: m.y, ox: p.x - m.x, oy: p.y - m.y });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pt(e);
    setDrag({ ...drag, x: clamp(p.x - drag.ox), y: clamp(p.y - drag.oy) });
  };
  const up = () => {
    if (drag) {
      onMove(drag.id, drag.x, drag.y);
      setDrag(null);
    }
  };

  return (
    <div className="gddrag" ref={ref} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
      {children}
      {markers.map((m) => {
        const pos = drag && drag.id === m.id ? drag : m;
        const selCls = sel === m.id ? " is-sel" : "";
        const dragCls = drag?.id === m.id ? " is-drag" : "";
        // Shapes (w/h set) → draggable bounding box grabbable anywhere.
        if (m.w && m.h) {
          return (
            <div
              key={m.id}
              className={`gddrag__box${selCls}${dragCls}`}
              style={{
                left: `${(pos.x - m.w / 2) * 100}%`,
                top: `${(pos.y - m.h / 2) * 100}%`,
                width: `${m.w * 100}%`,
                height: `${m.h * 100}%`,
              }}
              onPointerDown={(e) => down(e, m)}
              title={`Drag “${m.label}”`}
            >
              <span className="gddrag__boxlabel">{m.label}</span>
            </div>
          );
        }
        // Text elements → point chip.
        return (
          <button
            key={m.id}
            type="button"
            className={`gddrag__chip${selCls}${dragCls}`}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            onPointerDown={(e) => down(e, m)}
            title={`Drag to place “${m.label}”`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
