import { describe, expect, it } from "vitest";
import type { GeoAnswer, GeoPromptRollup } from "@/lib/api";
import {
  bandsFrom, cellOf, factsOf, personaKeyOf, personaWords, sampleQuestions, truncate,
} from "./answerBands";

const ans = (over: Partial<GeoAnswer> = {}): GeoAnswer => ({
  engine: "perplexity",
  model: "m",
  text: "an answer about intake",
  citations: [],
  latency_ms: 100,
  error: null,
  prompt_id: "p1",
  prompt_text: "which service handles intake?",
  intent: "category",
  run: 1,
  at: "2026-08-30T00:00:00Z",
  ...over,
});

const roll = (over: Partial<GeoPromptRollup> = {}): GeoPromptRollup => ({
  prompt_id: "p1",
  text: "which service handles intake?",
  intent: "category",
  n: 4,
  self_rate: 0.5,
  cited_rate: 0.25,
  rivals: [],
  engines_hit: [],
  ...over,
});

describe("bandsFrom", () => {
  it("folds answers into one band per question, in arrival order", () => {
    const bands = bandsFrom(
      [
        ans({ prompt_id: "p1" }),
        ans({ prompt_id: "p2", prompt_text: "who answers after hours?" }),
        ans({ prompt_id: "p1", engine: "gemini" }),
      ],
      { status: "all", term: "" },
      [],
    );
    expect(bands.map((b) => b.id)).toEqual(["p1", "p2"]);
    expect(bands[0].rows).toHaveLength(2);
    expect(bands[1].text).toBe("who answers after hours?");
  });

  it("keeps only rows the named/gap filter matches, so the header describes what is inside", () => {
    const rows = [
      ans({ brand_mentioned: true }),
      ans({ engine: "gemini", brand_mentioned: false }),
    ];
    const named = bandsFrom(rows, { status: "named", term: "" }, []);
    expect(named[0].rows).toHaveLength(1);
    const gap = bandsFrom(rows, { status: "gap", term: "" }, []);
    expect(gap[0].rows.map((r) => r.engine)).toEqual(["gemini"]);
  });

  it("searches both the answer text and the question text", () => {
    const rows = [ans({ text: "nothing relevant" })];
    expect(bandsFrom(rows, { status: "all", term: "intake" }, [])).toHaveLength(1);
    expect(bandsFrom(rows, { status: "all", term: "zebra" }, [])).toHaveLength(0);
  });

  it("tags a band with the rollup's persona", () => {
    const bands = bandsFrom([ans()], { status: "all", term: "" }, [roll({ persona: "solo-attorney" })]);
    expect(bands[0].persona).toBe("solo-attorney");
  });

  it("falls back to the persona stamped on the answers when the rollup has none", () => {
    const bands = bandsFrom([ans({ persona: "office-manager" })], { status: "all", term: "" }, [roll()]);
    expect(bands[0].persona).toBe("office-manager");
  });

  it("leaves an untagged band at null, never an empty-string chip", () => {
    const bands = bandsFrom([ans({ persona: "" })], { status: "all", term: "" }, [roll({ persona: "" })]);
    expect(bands[0].persona).toBeNull();
  });
});

describe("cellOf", () => {
  it("says named when any usable answer from that engine said the name", () => {
    const rows = [ans({ brand_mentioned: false }), ans({ brand_mentioned: true, run: 2 })];
    expect(cellOf(rows, "perplexity")).toBe("named");
  });

  it("says answered when the engine replied but never named", () => {
    expect(cellOf([ans({ brand_mentioned: false })], "perplexity")).toBe("answered");
  });

  it("does not count an errored row or a no-AIO row as an answer", () => {
    const rows = [
      ans({ engine: "chatgpt", error: "timeout" }),
      ans({ engine: "aio", no_aio: true }),
    ];
    expect(cellOf(rows, "chatgpt")).toBe("none");
    expect(cellOf(rows, "aio")).toBe("none");
  });

  it("says none for an engine with nothing stored", () => {
    expect(cellOf([ans()], "gemini")).toBe("none");
  });
});

describe("factsOf", () => {
  it("keeps error and no-AIO rows out of the denominator", () => {
    const rows = [
      ans({ brand_mentioned: true }),
      ans({ engine: "gemini", brand_mentioned: false }),
      ans({ engine: "chatgpt", error: "down" }),
      ans({ engine: "aio", no_aio: true }),
    ];
    expect(factsOf(rows)).toEqual({ named: 1, measured: 2 });
  });
});

describe("personaKeyOf", () => {
  it("prefers the rollup's tag", () => {
    expect(personaKeyOf("gc", [ans({ persona: "other" })])).toBe("gc");
  });
  it("never returns an empty string", () => {
    expect(personaKeyOf("", [ans({ persona: "" })])).toBeNull();
    expect(personaKeyOf(undefined, [ans()])).toBeNull();
  });
});

describe("personaWords", () => {
  it("reads a slug as words", () => {
    expect(personaWords("solo-attorney")).toBe("solo attorney");
    expect(personaWords("office_manager")).toBe("office manager");
  });
});

describe("sampleQuestions", () => {
  const rollup = [
    roll({ prompt_id: "a", text: "which intake service handles Spanish-speaking clients?" }),
    roll({ prompt_id: "b", text: "who answers calls after hours?" }),
    roll({ prompt_id: "c", text: "best virtual receptionist for law firms" }),
  ];

  it("resolves ids to question text, capped at two", () => {
    expect(sampleQuestions(["a", "b", "c"], rollup)).toEqual([
      "which intake service handles Spanish-speaking clients?",
      "who answers calls after hours?",
    ]);
  });

  it("skips an id the rollup does not know rather than inventing text", () => {
    expect(sampleQuestions(["ghost", "b"], rollup)).toEqual(["who answers calls after hours?"]);
  });

  it("returns nothing when the rollup is absent — a backend from before rollups", () => {
    expect(sampleQuestions(["a"], undefined)).toEqual([]);
    expect(sampleQuestions(["a"], [])).toEqual([]);
  });

  it("cuts a long question at a word boundary", () => {
    const long = roll({ prompt_id: "x", text: "a very long question that keeps going about services and staffing and pricing plans" });
    const [out] = sampleQuestions(["x"], [long], 1, 40);
    expect(out.length).toBeLessThanOrEqual(41); // budget + ellipsis
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 40)).toBe("short");
  });
  it("never ends mid-word when a boundary is near", () => {
    expect(truncate("alpha beta gamma delta", 17)).toBe("alpha beta gamma…");
  });
});
