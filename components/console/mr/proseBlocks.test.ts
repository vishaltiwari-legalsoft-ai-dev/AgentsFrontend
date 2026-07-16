import { describe, expect, it } from "vitest";
import { proseBlocks } from "./proseBlocks";

describe("proseBlocks", () => {
  it("keeps a lead line, bullets and the Recommend line as separate blocks", () => {
    // The shape insight.py now asks the model for.
    const answer = [
      "VAPI demo spend is the biggest waste — 38 booked, 5 completed.",
      "- Completion cratered to 0% by Q3, essentially dead spend.",
      "- April management fees spiked to $41,435 vs ~$13,000-$15,000 prior months.",
      "- Cost per qualified demo booked climbed from $548 in Q1 to $750 in Q3.",
    ].join("\n");

    const blocks = proseBlocks(answer);

    expect(blocks).toEqual([
      { kind: "p", text: "VAPI demo spend is the biggest waste — 38 booked, 5 completed." },
      {
        kind: "ul",
        items: [
          "Completion cratered to 0% by Q3, essentially dead spend.",
          "April management fees spiked to $41,435 vs ~$13,000-$15,000 prior months.",
          "Cost per qualified demo booked climbed from $548 in Q1 to $750 in Q3.",
        ],
      },
    ]);
  });

  it("does not collapse a multi-line answer into one paragraph", () => {
    const blocks = proseBlocks("Answer line.\n- one\n- two");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe("p");
    expect(blocks[1].kind).toBe("ul");
  });

  it("accepts the bullet markers the model actually emits", () => {
    const blocks = proseBlocks("- dash\n• bullet\n* star");
    expect(blocks).toEqual([{ kind: "ul", items: ["dash", "bullet", "star"] }]);
  });

  it("reads pipe tables and drops the separator row", () => {
    const blocks = proseBlocks("| Vendor | Spend |\n| --- | --- |\n| Hawksem | $10,000 |");
    expect(blocks).toEqual([
      { kind: "table", rows: [["Vendor", "Spend"], ["Hawksem", "$10,000"]] },
    ]);
  });

  it("strips heading and quote noise rather than showing raw markdown", () => {
    expect(proseBlocks("## Executive summary")).toEqual([{ kind: "p", text: "Executive summary" }]);
    expect(proseBlocks("> quoted")).toEqual([{ kind: "p", text: "quoted" }]);
  });

  it("has no blocks for empty text", () => {
    expect(proseBlocks("")).toEqual([]);
    expect(proseBlocks("   \n  ")).toEqual([]);
  });
});
