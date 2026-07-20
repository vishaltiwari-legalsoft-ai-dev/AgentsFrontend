import { describe, expect, it } from "vitest";

import {
  brandToDraft, competitorsToText, draftToBrand, emptyBrandDraft,
  normalizeSlug, parseCompetitorsText, parseQuestionsText, questionsToText,
  scoreTone, termLabel,
} from "./logic";

describe("scoreTone", () => {
  it("maps the 80+ success bar to good", () => {
    expect(scoreTone(0)).toBe("bad");
    expect(scoreTone(49.9)).toBe("bad");
    expect(scoreTone(50)).toBe("mid");
    expect(scoreTone(79.9)).toBe("mid");
    expect(scoreTone(80)).toBe("good");
    expect(scoreTone(100)).toBe("good");
  });
});

describe("termLabel", () => {
  it("formats the used-of-range checklist line", () => {
    expect(termLabel({ term: "intake", used: 0, min_count: 2, max_count: 4 }))
      .toBe("intake — used 0 of 2–4");
    expect(termLabel({ term: "salary", used: 1, min_count: 1, max_count: 1 }))
      .toBe("salary — used 1 of 1");
  });
});

describe("parseCompetitorsText", () => {
  it("splits on commas, trims, and drops blanks", () => {
    expect(parseCompetitorsText("acme.com, foo.com ,, bar.com")).toEqual([
      "acme.com", "foo.com", "bar.com",
    ]);
    expect(parseCompetitorsText("")).toEqual([]);
    expect(parseCompetitorsText("   ")).toEqual([]);
  });
});

describe("parseQuestionsText", () => {
  it("splits on newlines, trims, and drops blanks", () => {
    expect(parseQuestionsText("What is X?\n\nHow does Y work?\n  ")).toEqual([
      "What is X?", "How does Y work?",
    ]);
    expect(parseQuestionsText("")).toEqual([]);
  });
});

describe("competitorsToText / questionsToText", () => {
  it("round-trip with their parse counterparts", () => {
    expect(competitorsToText(["a.com", "b.com"])).toBe("a.com, b.com");
    expect(competitorsToText(undefined)).toBe("");
    expect(questionsToText(["Q1?", "Q2?"])).toBe("Q1?\nQ2?");
    expect(questionsToText(undefined)).toBe("");
  });
});

describe("normalizeSlug", () => {
  it("lowercases, trims, and dashes non-alphanumerics", () => {
    expect(normalizeSlug("  Acme Legal! ")).toBe("acme-legal");
    expect(normalizeSlug("Med_Virtual")).toBe("med_virtual");
    expect(normalizeSlug("--x--")).toBe("x");
  });
});

describe("brandToDraft / draftToBrand", () => {
  it("round-trips a brand config through the editable draft shape", () => {
    const brand = {
      name: "Legal Soft", domain: "legalsoft.com", category: "legal",
      competitors: ["acme.com", "foo.com"], questions: ["Q1?", "Q2?"],
    };
    const draft = brandToDraft(brand);
    expect(draft).toEqual({
      name: "Legal Soft", domain: "legalsoft.com", category: "legal",
      competitorsText: "acme.com, foo.com", questionsText: "Q1?\nQ2?",
    });
    expect(draftToBrand(draft)).toEqual(brand);
  });

  it("handles a brand config with no competitors/questions/category", () => {
    const brand = { name: "X", domain: "x.com" };
    const draft = brandToDraft(brand);
    expect(draft.competitorsText).toBe("");
    expect(draft.questionsText).toBe("");
    expect(draftToBrand(draft)).toEqual({
      name: "X", domain: "x.com", category: undefined, competitors: [], questions: [],
    });
  });

  it("emptyBrandDraft is a blank editable row", () => {
    expect(emptyBrandDraft()).toEqual({
      name: "", domain: "", category: "", competitorsText: "", questionsText: "",
    });
  });
});

import { clampPct, extraQuestions, statusLabel, statusTone } from "./logic";

describe("statusTone / statusLabel", () => {
  it("maps the four density statuses", () => {
    expect(statusTone("missing")).toBe("muted");
    expect(statusTone("low")).toBe("warn");
    expect(statusTone("ok")).toBe("good");
    expect(statusTone("overused")).toBe("bad");
    expect(statusLabel({ status: "low", used: 1, min_count: 2, max_count: 4 } as never))
      .toBe("you: 1 · target 2–4×");
    expect(statusLabel({ status: "ok", used: 3, min_count: 3, max_count: 3 } as never))
      .toBe("you: 3 · target 3×");
  });
});

describe("clampPct", () => {
  it("clamps to 0-100", () => {
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(42.4)).toBe(42);
    expect(clampPct(250)).toBe(100);
  });
});

describe("extraQuestions", () => {
  it("returns unanswered questions not already shown in a topic block", () => {
    const report = {
      questions_unanswered: ["q1", "q2", "q3"],
      topic_coverage: [
        { name: "T", terms_present: [], terms_missing: [], questions_unanswered: ["q2"] },
      ],
    };
    expect(extraQuestions(report as never)).toEqual(["q1", "q3"]);
  });

  it("tolerates an old-backend report without topic_coverage", () => {
    expect(extraQuestions({ questions_unanswered: ["q1"] } as never)).toEqual(["q1"]);
  });
});
