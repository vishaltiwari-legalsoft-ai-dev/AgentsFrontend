"use client";

import type { GdShape } from "../../../lib/api";

const LABELS: Record<string, string> = {
  rect: "Rectangle",
  "rounded-rect": "Rounded",
  circle: "Circle",
  triangle: "Triangle",
  arrow: "Arrow",
  divider: "Divider",
  callout: "Callout",
  icon: "Icon",
};

// Fallbacks so the panel works even if /gd/config predates these fields (e.g.
// the backend hasn't been restarted yet). Kept in sync with the backend
// shapes.SHAPE_KINDS / icons.ICON_KEYS.
const FALLBACK_SHAPE_KINDS = ["rect", "rounded-rect", "circle", "triangle", "arrow", "divider", "callout"];
const FALLBACK_ICON_KEYS = ["check", "star", "bolt", "plus", "dot", "arrow", "circle-check", "minus"];

function makeShape(kind: string, iconKeys: string[]): GdShape {
  const isIcon = kind === "icon";
  const stroked = kind === "rect" || kind === "rounded-rect" || kind === "callout";
  return {
    id: `shape-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    x: 0.5,
    y: 0.5,
    w: kind === "divider" ? 0.5 : 0.22,
    h: kind === "divider" ? 0.012 : 0.18,
    anchor: "mc",
    fill: isIcon ? "#1746A2" : "#FFFFFF",
    stroke: stroked ? "#1746A2" : null,
    stroke_w: stroked ? 2 : kind === "divider" || kind === "arrow" ? 4 : 0,
    radius: kind === "rounded-rect" || kind === "callout" ? 14 : 0,
    icon: isIcon ? iconKeys[0] ?? "star" : null,
    text: kind === "callout" ? "Callout" : "",
    z: 5,
  };
}

/** Insert toolbar + per-shape controls for Stage-3 shapes / infographic elements.
 *  Position is set by dragging the shape's handle on the canvas; this panel owns
 *  kind, colour, icon, callout text and size. */
export function ShapePanel({
  shapes,
  shapeKinds,
  iconKeys,
  onChange,
}: {
  shapes: GdShape[];
  shapeKinds?: string[];
  iconKeys?: string[];
  onChange: (s: GdShape[]) => void;
}) {
  const kinds = shapeKinds?.length ? shapeKinds : FALLBACK_SHAPE_KINDS;
  const icons = iconKeys?.length ? iconKeys : FALLBACK_ICON_KEYS;
  const add = (kind: string) => onChange([...shapes, makeShape(kind, icons)]);
  const update = (id: string, patch: Partial<GdShape>) =>
    onChange(shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(shapes.filter((s) => s.id !== id));

  return (
    <div className="gdshapes">
      <div className="gdshapes__bar">
        {[...kinds, "icon"].map((k) => (
          <button key={k} type="button" className="gdminibtn" onClick={() => add(k)}>
            + {LABELS[k] ?? k}
          </button>
        ))}
      </div>
      {shapes.map((s) => (
        <div key={s.id} className="gdshape">
          <div className="gdshape__row">
            <span className="gdshape__name">{LABELS[s.kind] ?? s.kind}</span>
            {s.kind === "icon" && (
              <select
                className="gdselect gdselect--sm"
                value={s.icon ?? ""}
                onChange={(e) => update(s.id, { icon: e.target.value })}
              >
                {icons.map((ic) => (
                  <option key={ic} value={ic}>{ic}</option>
                ))}
              </select>
            )}
            <label className="gdshape__sw" title="Fill colour">
              <input
                type="color"
                value={s.fill.startsWith("#") ? s.fill : "#FFFFFF"}
                onChange={(e) => update(s.id, { fill: e.target.value.toUpperCase() })}
              />
            </label>
            {s.kind !== "icon" && s.kind !== "divider" && (
              <label className="gdshape__sw" title="Outline colour">
                <input
                  type="color"
                  value={s.stroke ?? "#1746A2"}
                  onChange={(e) => update(s.id, { stroke: e.target.value.toUpperCase() })}
                />
              </label>
            )}
            <button type="button" className="gdminibtn" title="Remove" onClick={() => remove(s.id)}>
              ✕
            </button>
          </div>
          {s.kind === "callout" && (
            <input
              className="gdselect gdselect--sm"
              value={s.text}
              placeholder="Callout text"
              onChange={(e) => update(s.id, { text: e.target.value })}
            />
          )}
          <div className="gdshape__size">
            <span>W</span>
            <input
              type="range"
              className="gdrange"
              min={2}
              max={100}
              value={Math.round(s.w * 100)}
              onChange={(e) => update(s.id, { w: Number(e.target.value) / 100 })}
            />
            <span>H</span>
            <input
              type="range"
              className="gdrange"
              min={1}
              max={100}
              value={Math.round(s.h * 100)}
              onChange={(e) => update(s.id, { h: Number(e.target.value) / 100 })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
