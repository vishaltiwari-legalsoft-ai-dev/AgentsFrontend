"use client";
import type { GdElement } from "../../../lib/api";

/** Stage-3 layer list: shows the run's free elements (emoji/icon/sticker/image),
 *  lets the user select one, reorder z-order (bump up/down), delete it, and —
 *  for the selected element — edit opacity, rotation, and (icons only) fill.
 *  The CanvasEditor (Task 10) is render-only for opacity/rotation; this panel
 *  is the only place those props get edited. */
export function LayersPanel({
  elements,
  onChange,
  selectedId,
  onSelect,
}: {
  elements: GdElement[];
  onChange: (els: GdElement[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const patch = (id: string, p: Partial<GdElement>) =>
    onChange(elements.map((el) => (el.id === id ? { ...el, ...p } : el)));
  const remove = (id: string) => onChange(elements.filter((el) => el.id !== id));
  const bump = (id: string, dz: number) =>
    patch(id, { z: (elements.find((e) => e.id === id)?.z ?? 5) + dz });
  const sel = elements.find((e) => e.id === selectedId) || null;

  return (
    <div className="gdlayers">
      <div className="gdlayers__list">
        {elements.length === 0 && (
          <p className="gdstep__meta">No elements yet — add from the picker.</p>
        )}
        {[...elements]
          .sort((a, b) => b.z - a.z)
          .map((el) => (
            <div
              key={el.id}
              className={`gdlayers__row${selectedId === el.id ? " is-sel" : ""}`}
              onClick={() => onSelect(el.id)}
            >
              <span>{el.kind === "emoji" ? el.ref : `${el.kind}: ${el.ref}`}</span>
              <span className="gdlayers__ops">
                <button
                  type="button"
                  className="gdminibtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    bump(el.id, 1);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="gdminibtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    bump(el.id, -1);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="gdminibtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(el.id);
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
      </div>
      {sel && (
        <div className="gdlayers__inspect">
          <label>
            Opacity
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(sel.opacity * 100)}
              onChange={(e) => patch(sel.id, { opacity: Number(e.target.value) / 100 })}
            />
          </label>
          <label>
            Rotate
            <input
              type="range"
              min={-180}
              max={180}
              value={sel.rotation}
              onChange={(e) => patch(sel.id, { rotation: Number(e.target.value) })}
            />
          </label>
          {sel.kind === "icon" && (
            <label>
              Colour
              <input
                type="color"
                value={sel.fill}
                onChange={(e) => patch(sel.id, { fill: e.target.value.toUpperCase() })}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
