import { describe, expect, it } from "vitest";
import {
  cycleZone, DEFAULT_PLAN_LAYOUT, TEXT_ZONES, wireBoxStyle,
} from "./wireframe";

describe("wireframe zones", () => {
  it("every text zone is a valid engine placement key", () => {
    // The run maps zones straight onto the renderer's zone-stack placements
    // (TEXT_PLACEMENTS / CTA_PLACEMENTS keys) — the vocabularies must match.
    expect([...TEXT_ZONES].sort()).toEqual(["bottom", "center", "left", "right", "top"]);
    expect(DEFAULT_PLAN_LAYOUT.headline_zone).toBe("left");
    expect(DEFAULT_PLAN_LAYOUT.cta_zone).toBe("bottom");
  });

  it("preview boxes follow their zones", () => {
    const left = wireBoxStyle("headline", DEFAULT_PLAN_LAYOUT);
    const right = wireBoxStyle("headline", { ...DEFAULT_PLAN_LAYOUT, headline_zone: "right" });
    expect(left.left).not.toEqual(right.left);
    const logo = wireBoxStyle("logo", { ...DEFAULT_PLAN_LAYOUT, logo_corner: "bottom-left" });
    expect(logo.top).toBe("88%");
    expect(logo.left).toBe("4%");
  });
});

describe("cycleZone", () => {
  it("advances through the vocabulary and wraps", () => {
    expect(cycleZone("left", TEXT_ZONES)).toBe("right");
    expect(cycleZone(TEXT_ZONES[TEXT_ZONES.length - 1], TEXT_ZONES)).toBe(TEXT_ZONES[0]);
    expect(cycleZone("bogus", TEXT_ZONES)).toBe(TEXT_ZONES[0]);
  });
});
