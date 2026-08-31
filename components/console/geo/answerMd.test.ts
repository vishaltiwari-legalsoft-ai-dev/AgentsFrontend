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

/* ------------------------------------------------------------------ tables --
   Engines answer comparison questions with a markdown table more often than
   with anything else. Before these, the header row and the `|---|` separator
   fell through to the paragraph branch and were rendered as two sentences —
   the answer's most structured content shown as its least readable. */

describe("blocks: tables", () => {
  const TABLE = [
    "| Need | Best option |",
    "|---|---|",
    "| Lowest cost | A specialist agency |",
    "| Fastest start | An in-house hire |",
  ].join("\n");

  it("reads a pipe table with a separator row", () => {
    const [b] = blocks(TABLE);
    expect(b.kind).toBe("table");
    if (b.kind !== "table") return;
    expect(b.head).toEqual(["Need", "Best option"]);
    expect(b.rows).toEqual([
      ["Lowest cost", "A specialist agency"],
      ["Fastest start", "An in-house hire"],
    ]);
  });

  it("accepts the alignment forms engines actually emit", () => {
    const [b] = blocks("| A | B |\n|:---|---:|\n| 1 | 2 |");
    expect(b.kind).toBe("table");
  });

  it("leaves a pipe line alone when no separator follows it", () => {
    // A sentence containing a pipe is a sentence, not a one-row table.
    const out = blocks("Use grep | head to see the first few.");
    expect(out).toEqual([{ kind: "p", text: "Use grep | head to see the first few." }]);
  });

  it("pads a ragged row so the columns underneath cannot shift", () => {
    const [b] = blocks("| A | B | C |\n|---|---|---|\n| 1 | 2 |");
    if (b.kind !== "table") throw new Error("expected a table");
    expect(b.rows).toEqual([["1", "2", ""]]);
  });

  it("trims a row that carries more cells than the header", () => {
    const [b] = blocks("| A | B |\n|---|---|\n| 1 | 2 | 3 |");
    if (b.kind !== "table") throw new Error("expected a table");
    expect(b.rows).toEqual([["1", "2"]]);
  });

  it("ends the table at the first line that is not one, and keeps the rest", () => {
    const out = blocks(`${TABLE}\n\nThat is the shortlist.`);
    expect(out.map((b) => b.kind)).toEqual(["table", "p"]);
    expect(out[1]).toEqual({ kind: "p", text: "That is the shortlist." });
  });

  it("still parses the prose before a table", () => {
    const out = blocks(`Here is the comparison:\n${TABLE}`);
    expect(out.map((b) => b.kind)).toEqual(["p", "table"]);
  });

  it("keeps a header that is only a separator out of the table branch", () => {
    // `|---|` with nothing above it is not a table; treating it as one would
    // render an empty header and swallow the line.
    const out = blocks("|---|---|");
    expect(out[0].kind).toBe("p");
  });
});
