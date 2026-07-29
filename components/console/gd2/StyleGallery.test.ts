import { describe, expect, it } from "vitest";
import type { GdAttempt } from "@/lib/api";
import { pickDefaultStyle, styleBadge } from "./styleChoice";

const attempt = (n: number, style: string, ai: boolean, qa = "passed"): GdAttempt => ({
  attempt: n,
  variant: "T",
  artifact: `stage-3/T-${n}.png`,
  url: `/api/gd/runs/r1/artifact/stage-3/T-${n}.png`,
  created_at: "2026-07-14T00:00:00Z",
  style,
  style_label: style,
  ai,
  qa,
  set_id: "abc123",
});

describe("styleBadge", () => {
  it("badges a real model output as AI polished", () => {
    expect(styleBadge(attempt(1, "brand_strict", true))).toBe("✨ AI polished");
  });

  it("discloses when QA was unavailable", () => {
    expect(styleBadge(attempt(1, "brand_strict", true, "skipped"))).toBe(
      "✨ AI polished · QA skipped",
    );
  });

  it("never badges a fallback as AI", () => {
    expect(styleBadge(attempt(1, "brand_strict", false, "failed"))).toBe("Engine render");
  });
});

describe("pickDefaultStyle", () => {
  it("defaults to brand_strict regardless of order", () => {
    const set = [
      attempt(4, "highlighted", true),
      attempt(5, "brand_strict", true),
      attempt(6, "sharp_minimal", true),
    ];
    expect(pickDefaultStyle(set)).toBe(5);
  });

  it("falls back to the first attempt when brand_strict is absent", () => {
    expect(pickDefaultStyle([attempt(7, "highlighted", true)])).toBe(7);
  });

  it("returns null for an empty set", () => {
    expect(pickDefaultStyle([])).toBeNull();
  });

  it("prefers a QA-passed style over a QA-skipped brand_strict", () => {
    const set = [
      attempt(1, "brand_strict", true, "skipped"),
      attempt(2, "highlighted", true, "passed"),
      attempt(3, "sharp_minimal", false, "failed"),
    ];
    expect(pickDefaultStyle(set)).toBe(2);
  });

  it("still prefers brand_strict among QA-passed siblings", () => {
    const set = [
      attempt(1, "highlighted", true, "passed"),
      attempt(2, "brand_strict", true, "passed"),
    ];
    expect(pickDefaultStyle(set)).toBe(2);
  });

  it("falls back to brand_strict when nothing passed QA", () => {
    const set = [
      attempt(1, "brand_strict", true, "skipped"),
      attempt(2, "highlighted", true, "skipped"),
    ];
    expect(pickDefaultStyle(set)).toBe(1);
  });
});
