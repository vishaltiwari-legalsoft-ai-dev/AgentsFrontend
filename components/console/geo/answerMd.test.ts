import { describe, expect, it } from "vitest";
import { blocks, inlineTokens } from "./answerMd";

describe("answer markdown parsing", () => {
  it("terminates on bold text (shared-regex freeze regression)", () => {
    // this exact shape froze the page: recursing for bold content reset the
    // module-level regex's lastIndex, so the outer scan never advanced
    const tokens = inlineTokens("An **attorney answering service** screens calls.[1][2]");
    expect(tokens.map((t) => t.t)).toEqual(["text", "bold", "text", "cite"]);
  });

  it("terminates on heavily-marked engine output", () => {
    const text = Array.from({ length: 50 }, (_, i) => `- **Point ${i}** with [${i + 1}] marker`).join("\n");
    const parsed = blocks(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind === "ul" && parsed[0].items).toHaveLength(50);
    for (const item of parsed[0].kind === "ul" ? parsed[0].items : []) {
      expect(inlineTokens(item).some((t) => t.t === "bold")).toBe(true);
    }
  });

  it("groups bullets, numbers, headings and paragraphs", () => {
    const parsed = blocks(
      "Intro line.\n\n## What they do\n- answer calls\n- screen leads\n1. first\n2. second\nOutro.",
    );
    expect(parsed.map((b) => b.kind)).toEqual(["p", "h", "ul", "ol", "p"]);
  });

  it("parses links and keeps surrounding text", () => {
    const tokens = inlineTokens("see [Clio](https://clio.com/x) for details");
    expect(tokens).toEqual([
      { t: "text", text: "see " },
      { t: "link", text: "Clio", url: "https://clio.com/x" },
      { t: "text", text: " for details" },
    ]);
  });

  it("nested bold inside bullets stays bounded", () => {
    const tokens = inlineTokens("**a [1] b** tail");
    expect(tokens[0].t).toBe("bold");
    expect(tokens.at(-1)).toEqual({ t: "text", text: " tail" });
  });
});
