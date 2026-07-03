import { describe, expect, it } from "vitest";
import { clamp01, emojiFile, pxToFrac } from "./canvasMath";

describe("clamp01", () => {
  it("clamps into [0,1]", () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe("pxToFrac", () => {
  it("converts and clamps", () => {
    expect(pxToFrac(150, 300)).toBe(0.5);
    expect(pxToFrac(-10, 300)).toBe(0);
    expect(pxToFrac(10, 0)).toBe(0);
  });
});

describe("emojiFile", () => {
  it("maps a simple emoji to lowercase codepoints", () => {
    expect(emojiFile("😀")).toBe("1f600.png");
  });
  it("strips fe0f variation selectors and joins with dashes", () => {
    expect(emojiFile("❤️")).toBe("2764.png"); // 2764 fe0f → fe0f dropped
  });
});
