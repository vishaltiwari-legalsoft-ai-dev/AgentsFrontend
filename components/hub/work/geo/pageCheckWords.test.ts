import { describe, expect, it } from "vitest";
import {
  confidenceWords, evidenceWhere, kindWords, querySourceWords, riskIsKnown,
  riskSentence, shortUrl, sortCons, verdictParts, verdictSentence,
} from "./pageCheckWords";

describe("verdict words", () => {
  it("puts the pivotal words of a known verdict on the mark", () => {
    expect(verdictParts("likely helps")).toEqual({ before: "", mark: "Likely helps", after: "" });
    expect(verdictSentence("likely cannibalizes")).toBe("Likely cannibalizes a page you already have");
    expect(verdictSentence("needs work")).toBe("Needs work before it will help");
  });

  it("gives 'cannot tell' no celebratory mark", () => {
    expect(verdictParts("cannot tell").mark).toBe("");
    expect(verdictSentence("cannot tell")).toBe("Could not tell either way");
  });

  it("renders an unfamiliar label as itself rather than inventing words", () => {
    expect(verdictSentence("mostly harmless")).toBe("mostly harmless");
    expect(verdictParts("mostly harmless").mark).toBe("");
  });

  it("names only real confidence levels", () => {
    expect(confidenceWords("high")).toBe("high confidence");
    expect(confidenceWords("banana")).toBe("");
  });
});

describe("query source words", () => {
  it("explains a derived query and stays quiet about a given one", () => {
    expect(querySourceWords("page_title")).toBe("taken from the page title");
    expect(querySourceWords("draft_heading")).toBe("taken from the draft's first heading");
    expect(querySourceWords("given")).toBe("");
  });
});

describe("risk words", () => {
  it("words each known risk plainly", () => {
    expect(riskSentence("high")).toMatch(/overlaps a page you already have/);
    expect(riskSentence("low")).toMatch(/No serious overlap/);
  });

  it("never words unknown risk as safe", () => {
    for (const risk of ["unknown", "whatever-new-enum"]) {
      expect(riskSentence(risk)).toMatch(/could not be checked/);
      expect(riskSentence(risk)).not.toMatch(/no .*overlap/i);
      expect(riskIsKnown(risk)).toBe(false);
    }
  });
});

describe("chips", () => {
  it("names the three evidence sources and passes strangers through", () => {
    expect(evidenceWhere("serp")).toBe("search results");
    expect(evidenceWhere("corpus")).toBe("your site");
    expect(evidenceWhere("gsc")).toBe("search console");
    expect(evidenceWhere("crystal_ball")).toBe("crystal_ball");
  });

  it("translates paa and de-snakes the rest", () => {
    expect(kindWords("paa")).toBe("searchers ask");
    expect(kindWords("term_gap")).toBe("term gap");
  });
});

describe("sortCons", () => {
  it("leads with prioritised rows in priority order and keeps the rest stable", () => {
    const cons = [
      { kind: "a", message: "no priority 1" },
      { kind: "b", priority: 2, message: "second" },
      { kind: "c", message: "no priority 2" },
      { kind: "d", priority: 1, message: "first" },
    ];
    expect(sortCons(cons).map((c) => c.message)).toEqual([
      "first", "second", "no priority 1", "no priority 2",
    ]);
  });

  it("does not mutate its input", () => {
    const cons = [{ kind: "b", priority: 2 }, { kind: "a", priority: 1 }];
    sortCons(cons);
    expect(cons[0].priority).toBe(2);
  });
});

describe("shortUrl", () => {
  it("drops scheme, www and the trailing slash", () => {
    expect(shortUrl("https://www.example.com/blog/post/")).toBe("example.com/blog/post");
  });

  it("caps a long path with an ellipsis", () => {
    const s = shortUrl(`https://example.com/${"a".repeat(120)}`, 30);
    expect(s.length).toBe(30);
    expect(s.endsWith("…")).toBe(true);
  });

  it("never returns empty for a non-empty input", () => {
    expect(shortUrl("https://")).not.toBe("");
  });
});
