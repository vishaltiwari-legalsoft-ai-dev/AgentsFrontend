import { describe, expect, it } from "vitest";
import {
  cycleZone, DEFAULT_PLAN_LAYOUT, TEXT_ZONES, wireframeToLayout,
} from "./wireframe";

describe("wireframeToLayout", () => {
  it("maps zones to pinned fractional coords", () => {
    const lay = wireframeToLayout(DEFAULT_PLAN_LAYOUT, 1); // headline/sub left, cta bottom
    expect(lay.headline).toEqual({ x: 0.27, y: 0.3, w: 0.42, anchor: "mc" });
    expect(lay["subheading-0"]).toEqual({ x: 0.27, y: 0.48, w: 0.42, anchor: "mc" });
    expect(lay.cta).toEqual({ x: 0.5, y: 0.86, w: 0.42, anchor: "mc" });
  });

  it("staggers extra sub lines downward with a cap", () => {
    const lay = wireframeToLayout({ ...DEFAULT_PLAN_LAYOUT, sub_zone: "bottom" }, 3);
    expect(lay["subheading-0"].y).toBe(0.66);
    expect(lay["subheading-1"].y).toBe(0.74);
    expect(lay["subheading-2"].y).toBe(0.8); // capped
  });

  it("top zones pull text up", () => {
    const lay = wireframeToLayout(
      { ...DEFAULT_PLAN_LAYOUT, headline_zone: "top", cta_zone: "top" }, 1);
    expect(lay.headline.y).toBe(0.16);
    expect(lay.cta.y).toBe(0.14);
  });
});

describe("cycleZone", () => {
  it("advances through the vocabulary and wraps", () => {
    expect(cycleZone("left", TEXT_ZONES)).toBe("right");
    expect(cycleZone(TEXT_ZONES[TEXT_ZONES.length - 1], TEXT_ZONES)).toBe(TEXT_ZONES[0]);
    expect(cycleZone("bogus", TEXT_ZONES)).toBe(TEXT_ZONES[0]);
  });
});
