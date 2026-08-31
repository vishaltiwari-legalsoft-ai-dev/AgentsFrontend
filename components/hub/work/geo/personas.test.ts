import { describe, expect, it } from "vitest";
import type { GeoPersona, GeoPersonaRollup, GeoPrompt } from "@/lib/api";
import {
  bucketLabel, coverageWords, labelProblem, MAX_PERSONAS, outcomeWords,
  personaLabel, promptCount,
} from "./personas";

const P = (key: string, label: string): GeoPersona => ({ key, label, description: "" });

const prompt = (persona?: string): GeoPrompt => ({
  id: "x", text: "which intake service handles Spanish-speaking clients?",
  intent: "category", stage: "awareness", enabled: true, persona,
});

const row = (over: Partial<GeoPersonaRollup>): GeoPersonaRollup => ({
  persona: "solo", n_prompts: 12, n_answers: 40, mention_rate: 0.44, cited_rate: 0.1, ...over,
});

describe("personaLabel", () => {
  it("finds the label for a key", () => {
    expect(personaLabel([P("solo", "Solo attorney")], "solo")).toBe("Solo attorney");
  });

  it("returns null for untagged — empty string or absent", () => {
    expect(personaLabel([P("solo", "Solo attorney")], "")).toBeNull();
    expect(personaLabel([P("solo", "Solo attorney")], undefined)).toBeNull();
  });

  it("shows a key the list no longer carries rather than hiding the tag", () => {
    // A prompt tagged before its persona was removed client-side of a refresh
    // must not silently read as untagged — that is a different claim.
    expect(personaLabel([], "ghost")).toBe("ghost");
  });
});

describe("bucketLabel", () => {
  it("names the unassigned bucket instead of printing an empty string", () => {
    expect(bucketLabel([P("solo", "Solo attorney")], "")).toBe("No persona yet");
  });

  it("uses the label for a known bucket", () => {
    expect(bucketLabel([P("solo", "Solo attorney")], "solo")).toBe("Solo attorney");
  });
});

describe("promptCount", () => {
  it("counts questions carrying the key, treating absent persona as untagged", () => {
    const prompts = [prompt("solo"), prompt("solo"), prompt(""), prompt(undefined)];
    expect(promptCount(prompts, "solo")).toBe(2);
    expect(promptCount(prompts, "")).toBe(2);
  });
});

describe("outcomeWords", () => {
  it("reports both halves of a partial acceptance", () => {
    expect(outcomeWords(12, 2)).toBe("12 added · 2 skipped");
  });

  it("says only what happened when nothing was skipped", () => {
    expect(outcomeWords(3, 0)).toBe("3 added");
  });

  it("is honest when every line was refused", () => {
    expect(outcomeWords(0, 3)).toBe("Nothing added · 3 skipped");
  });
});

describe("coverageWords", () => {
  it("reads as the panel's sentence", () => {
    expect(coverageWords(row({}))).toBe("named in 44% of 12 questions");
  });

  it("uses the singular for one question", () => {
    expect(coverageWords(row({ n_prompts: 1, mention_rate: 1 }))).toBe("named in 100% of 1 question");
  });

  it("never turns a missing measurement into a zero", () => {
    expect(coverageWords(row({ mention_rate: null }))).toBe("not measured yet");
  });

  it("keeps a measured zero a zero", () => {
    expect(coverageWords(row({ mention_rate: 0 }))).toBe("named in 0% of 12 questions");
  });
});

describe("labelProblem", () => {
  const existing = [P("solo", "Solo attorney")];

  it("accepts a reasonable label", () => {
    expect(labelProblem("Office manager", existing)).toBeNull();
  });

  it("refuses one character", () => {
    expect(labelProblem(" a ", existing)).toMatch(/two characters/);
  });

  it("refuses more than sixty characters", () => {
    expect(labelProblem("x".repeat(61), existing)).toMatch(/sixty/);
  });

  it("refuses a duplicate regardless of case", () => {
    expect(labelProblem("solo ATTORNEY", existing)).toMatch(/already exists/);
  });

  it("refuses a ninth persona", () => {
    const eight = Array.from({ length: MAX_PERSONAS }, (_, i) => P(`k${i}`, `Persona ${i}`));
    expect(labelProblem("One more", eight)).toMatch(/ceiling/);
  });
});
