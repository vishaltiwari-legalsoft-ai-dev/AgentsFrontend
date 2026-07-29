import { describe, expect, it } from "vitest";

import { attachErrorMessage, canAttach, MAX_PROMPT_IMAGES } from "./promptAttach";

const png = { type: "image/png", size: 1024 };

describe("canAttach", () => {
  it("accepts a small png under the cap", () => {
    expect(canAttach(0, png)).toEqual({ ok: true });
  });
  it("rejects when the cap is reached", () => {
    expect(canAttach(MAX_PROMPT_IMAGES, png)).toEqual({ ok: false, reason: "limit" });
  });
  it("rejects non-image types", () => {
    expect(canAttach(0, { type: "application/pdf", size: 10 })).toEqual({ ok: false, reason: "type" });
  });
  it("rejects files over 10 MB", () => {
    expect(canAttach(0, { type: "image/png", size: 10 * 1024 * 1024 + 1 })).toEqual({ ok: false, reason: "size" });
  });
});

describe("attachErrorMessage", () => {
  it("names the file for type/size problems", () => {
    expect(attachErrorMessage("a.pdf", "type")).toContain("a.pdf");
    expect(attachErrorMessage("big.png", "size")).toContain("big.png");
  });
  it("states the cap for limit", () => {
    expect(attachErrorMessage("x.png", "limit")).toContain(String(MAX_PROMPT_IMAGES));
  });
});
