import { describe, expect, it } from "vitest";
import type { GeoPersona, GeoPersonaRollup, GeoPrompt } from "@/lib/api";
import {
  ASKED_CHOICES, askedChoiceProblem, bucketLabel, coverageWords, deleteAftermathWords,
  deleteConfirmWords, deletedWords, intentWords, labelProblem, MAX_PERSONAS, outcomeWords,
  personaLabel, promptCount, selectionWords, stillListed,
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

describe("stillListed", () => {
  const listed = [{ ...prompt(), id: "a" }, { ...prompt(), id: "b" }, { ...prompt(), id: "c" }];

  it("keeps list order, not tick order", () => {
    expect(stillListed(listed, new Set(["c", "a"]))).toEqual(["a", "c"]);
  });

  it("drops ids the set no longer carries — a regenerate must not inflate the count", () => {
    expect(stillListed(listed, new Set(["a", "gone"]))).toEqual(["a"]);
  });

  it("is empty for an empty selection", () => {
    expect(stillListed(listed, new Set())).toEqual([]);
  });
});

describe("selectionWords", () => {
  it("says nothing is picked rather than printing a zero", () => {
    expect(selectionWords(0, 12)).toBe("Nothing selected");
  });

  it("counts a partial selection against the list", () => {
    expect(selectionWords(3, 12)).toBe("3 of 12 selected");
  });

  it("names a whole-list selection as such", () => {
    expect(selectionWords(12, 12)).toBe("All 12 selected");
  });
});

describe("deleteConfirmWords", () => {
  it("names the count being deleted", () => {
    expect(deleteConfirmWords(3, 12)).toBe("Delete 3 of 12 questions?");
  });

  it("says out loud that the set is being emptied", () => {
    expect(deleteConfirmWords(12, 12)).toMatch(/^Delete all 12 questions\? That leaves the set empty/);
  });

  it("reads as English when one question is all there is", () => {
    expect(deleteConfirmWords(1, 1)).toMatch(/^Delete the only question left\?/);
  });
});

describe("deleteAftermathWords", () => {
  it("warns that reports keep showing deleted questions, in the window's own days", () => {
    expect(deleteAftermathWords(30)).toBe(
      "Answers already collected are not deleted, so reports keep showing these questions "
      + "until they age out of the last 30 days.",
    );
  });
});

describe("deletedWords", () => {
  it("uses the singular for one", () => {
    expect(deletedWords(1)).toBe(
      "Question deleted. Answers it already collected stay in reports until they age out.",
    );
  });

  it("counts the rest", () => {
    expect(deletedWords(7)).toBe(
      "7 questions deleted. Answers they already collected stay in reports until they age out.",
    );
  });
});

describe("askedChoiceProblem", () => {
  it("accepts the two kinds a person can choose", () => {
    expect(askedChoiceProblem("category")).toBeNull();
    expect(askedChoiceProblem("brand")).toBeNull();
  });

  it("refuses an unmade choice — there is no default to fall back on", () => {
    expect(askedChoiceProblem("")).toMatch(/Choose which kind/);
  });

  it("refuses “problem”, which the generator writes but nobody is offered", () => {
    // Stored "problem" questions keep displaying and keep saving; what must
    // never happen is a form producing one, because no form offers it.
    expect(askedChoiceProblem("problem")).toMatch(/Choose which kind/);
  });
});

describe("ASKED_CHOICES", () => {
  it("offers exactly the two values the create endpoints accept", () => {
    expect(ASKED_CHOICES.map((c) => c.value)).toEqual(["category", "brand"]);
  });

  it("never labels them in the API's vocabulary", () => {
    for (const c of ASKED_CHOICES) {
      expect(c.label.toLowerCase()).not.toMatch(/category|brand|intent/);
    }
  });
});

describe("intentWords", () => {
  it("prints the two offerable kinds", () => {
    expect(intentWords("category")).toBe("does not name you");
    expect(intentWords("brand")).toBe("already names you");
  });

  it("keeps printing “problem”, which is still generated and still stored", () => {
    expect(intentWords("problem")).toBe("describes the problem, not the product");
  });

  it("prints an unknown kind rather than dropping it", () => {
    expect(intentWords("comparison")).toBe("comparison");
  });
});
