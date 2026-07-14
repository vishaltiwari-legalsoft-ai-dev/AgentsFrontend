import type { GdPlanLayout } from "@/lib/api";

/* Binding wireframe (spec 2026-07-14): pure zone math shared by the plan-card
   preview and the auto-pilot stage runners. No React, no DOM — vitest-safe. */

export const SUBJECT_CELLS = [
  "top-left", "top-center", "top-right", "middle-left", "middle-center",
  "middle-right", "bottom-left", "bottom-center", "bottom-right",
] as const;
export const TEXT_ZONES = ["left", "right", "top", "bottom", "center"] as const;
export const LOGO_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export const DEFAULT_PLAN_LAYOUT: GdPlanLayout = {
  subject_cell: "middle-right", headline_zone: "left",
  sub_zone: "left", cta_zone: "bottom", logo_corner: "top-right",
};

export function cycleZone(current: string, vocab: readonly string[]): string {
  const i = vocab.indexOf(current);
  return vocab[(i + 1) % vocab.length] ?? vocab[0];
}

const ZONE_X: Record<string, number> = { left: 0.27, right: 0.73, top: 0.5, bottom: 0.5, center: 0.5 };
const HEAD_Y: Record<string, number> = { top: 0.16, bottom: 0.62, left: 0.3, right: 0.3, center: 0.3 };
const SUB_Y: Record<string, number> = { top: 0.3, bottom: 0.66, left: 0.48, right: 0.48, center: 0.48 };
const W = 0.42;

/** Pinned fractional coords for the run's `layout` config from wireframe zones.
 *  Sub lines stagger +0.08 each, capped at y=0.8 so they never leave canvas. */
export function wireframeToLayout(
  layout: GdPlanLayout, subCount: number,
): Record<string, { x: number; y: number; w: number; anchor: string }> {
  const out: Record<string, { x: number; y: number; w: number; anchor: string }> = {
    headline: {
      x: ZONE_X[layout.headline_zone] ?? 0.27,
      y: HEAD_Y[layout.headline_zone] ?? 0.3,
      w: W, anchor: "mc",
    },
    cta: {
      x: ZONE_X[layout.cta_zone] ?? 0.5,
      y: layout.cta_zone === "top" ? 0.14 : 0.86,
      w: W, anchor: "mc",
    },
  };
  for (let i = 0; i < Math.max(1, subCount); i += 1) {
    out[`subheading-${i}`] = {
      x: ZONE_X[layout.sub_zone] ?? 0.27,
      y: Math.min(0.8, Math.round(((SUB_Y[layout.sub_zone] ?? 0.48) + i * 0.08) * 100) / 100),
      w: W, anchor: "mc",
    };
  }
  return out;
}

/** Percent CSS box for one wireframe element on the plan-card mini canvas. */
export function wireBoxStyle(
  kind: "subject" | "headline" | "sub" | "cta" | "logo", layout: GdPlanLayout,
): { left: string; top: string; width: string; height: string } {
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  if (kind === "subject") {
    const [row, col] = layout.subject_cell.split("-");
    const x = { left: 0.05, center: 0.325, right: 0.6 }[col] ?? 0.6;
    const y = { top: 0.05, middle: 0.3, bottom: 0.55 }[row] ?? 0.3;
    return { left: pc(x), top: pc(y), width: pc(0.35), height: pc(0.4) };
  }
  if (kind === "logo") {
    const [v, h] = layout.logo_corner.split("-");
    return {
      left: pc(h === "left" ? 0.04 : 0.78),
      top: pc(v === "top" ? 0.04 : 0.88),
      width: pc(0.18), height: pc(0.08),
    };
  }
  const zone = kind === "headline" ? layout.headline_zone
    : kind === "sub" ? layout.sub_zone : layout.cta_zone;
  const coords = kind === "headline"
    ? { x: ZONE_X[zone] ?? 0.27, y: HEAD_Y[zone] ?? 0.3 }
    : kind === "sub"
      ? { x: ZONE_X[zone] ?? 0.27, y: SUB_Y[zone] ?? 0.48 }
      : { x: ZONE_X[zone] ?? 0.5, y: zone === "top" ? 0.14 : 0.86 };
  const w = kind === "cta" ? 0.3 : 0.38;
  const h = kind === "headline" ? 0.12 : 0.08;
  return { left: pc(coords.x - w / 2), top: pc(coords.y - h / 2), width: pc(w), height: pc(h) };
}
