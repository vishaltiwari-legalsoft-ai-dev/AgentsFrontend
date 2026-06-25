"use client";

import { useRef, useState } from "react";

// One draggable element handle, positioned at fractional (x,y) over the preview.
export interface DragMarker {
  id: string;
  label: string;
  x: number;
  y: number;
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
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const pt = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { x: 0.5, y: 0.5 };
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  const down = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(id);
    onSelect?.(id);
    setDrag({ id, ...pt(e) });
  };
  const move = (e: React.PointerEvent) => {
    if (drag) setDrag({ id: drag.id, ...pt(e) });
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
        const p = drag && drag.id === m.id ? drag : m;
        return (
          <button
            key={m.id}
            type="button"
            className={`gddrag__chip${sel === m.id ? " gddrag__chip--sel" : ""}${
              drag?.id === m.id ? " gddrag__chip--drag" : ""
            }`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            onPointerDown={(e) => down(e, m.id)}
            title={`Drag to place “${m.label}”`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
