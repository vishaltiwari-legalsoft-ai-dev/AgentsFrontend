import { describe, expect, it } from "vitest";
import type { GeoCompetitor } from "@/lib/api";
import {
  assigneeToSave, brandDomain, brandFormProblem, brandSlug, createdWords, editorGate,
  questionsCell, removeConfirmWords, removedWords, restoredWords, SHARED_LIST_NOTE,
  withoutCompetitor,
} from "./edits";

const comp = (key: string): GeoCompetitor => ({ key, name: key, aliases: [key] });

describe("withoutCompetitor", () => {
  it("removes exactly the named entry", () => {
    const rest = withoutCompetitor([comp("ruby"), comp("clio")], "ruby");
    expect(rest?.map((c) => c.key)).toEqual(["clio"]);
  });

  it("refuses a key that matches nothing — a no-op save must not look like a removal", () => {
    expect(withoutCompetitor([comp("ruby")], "smith-ai")).toBeNull();
  });

  it("refuses on an empty list, where the config clearly has not loaded", () => {
    expect(withoutCompetitor([], "ruby")).toBeNull();
  });

  it("does not mutate the list it was given", () => {
    const tracked = [comp("ruby"), comp("clio")];
    withoutCompetitor(tracked, "ruby");
    expect(tracked).toHaveLength(2);
  });
});

describe("questionsCell", () => {
  it("dashes an absent count instead of claiming zero", () => {
    expect(questionsCell(undefined)).toBe("—");
    expect(questionsCell(null)).toBe("—");
  });

  it("renders zero as a real count — the field arrived, the count is nought", () => {
    expect(questionsCell(0)).toBe("0");
  });

  it("formats a real count", () => {
    expect(questionsCell(12)).toBe("12");
    expect(questionsCell(1234)).toBe("1,234");
  });
});

describe("assigneeToSave", () => {
  it("saves a new name, trimmed", () => {
    expect(assigneeToSave(undefined, "  Priya ")).toBe("Priya");
  });

  it("treats an unchanged name as a no-op, not a save", () => {
    expect(assigneeToSave("Priya", "Priya")).toBeNull();
    expect(assigneeToSave("Priya", "  Priya  ")).toBeNull();
  });

  it("clears an assignment with an empty box", () => {
    expect(assigneeToSave("Priya", "")).toBe("");
    expect(assigneeToSave("Priya", "   ")).toBe("");
  });

  it("does nothing when the box was empty and stays empty", () => {
    expect(assigneeToSave(undefined, "")).toBeNull();
    expect(assigneeToSave("", "   ")).toBeNull();
  });
});

/* ------------------------------ the brand list ------------------------------ */

describe("brandSlug", () => {
  it("builds the id the backend will build", () => {
    expect(brandSlug("Legal Soft")).toBe("legal-soft");
    expect(brandSlug("  Acme & Co.  ")).toBe("acme-co");
  });

  it("has no id for a name with nothing to build one from", () => {
    expect(brandSlug("!!!")).toBeNull();
    expect(brandSlug("   ")).toBeNull();
    expect(brandSlug("")).toBeNull();
  });
});

describe("brandDomain", () => {
  it("reduces a pasted URL and a bare domain to the same host", () => {
    expect(brandDomain("https://www.Acme.com/pricing?x=1#top")).toBe("acme.com");
    expect(brandDomain("acme.com")).toBe("acme.com");
    expect(brandDomain("  HTTP://ACME.COM  ")).toBe("acme.com");
  });

  it("drops the port, the userinfo and a trailing dot", () => {
    expect(brandDomain("https://user:pw@acme.com:8443/x")).toBe("acme.com");
    expect(brandDomain("acme.com.")).toBe("acme.com");
  });

  it("keeps a subdomain that is not www", () => {
    expect(brandDomain("https://app.acme.co.uk/login")).toBe("app.acme.co.uk");
  });

  it("refuses what is not a host rather than inventing one", () => {
    expect(brandDomain("localhost")).toBeNull();
    expect(brandDomain("not a domain")).toBeNull();
    expect(brandDomain("")).toBeNull();
  });
});

describe("brandFormProblem", () => {
  const listed = [{ id: "legal-soft", name: "Legal Soft" }];

  it("accepts a name and a site", () => {
    expect(brandFormProblem("Acme", "https://acme.com/pricing", listed)).toBeNull();
  });

  it("asks for a name before it looks at anything else", () => {
    expect(brandFormProblem("  ", "acme.com")).toContain("Give the brand a name");
  });

  it("refuses a name with no letters or digits — that brand would have no id", () => {
    expect(brandFormProblem("!!!", "acme.com")).toContain("no letters or numbers");
  });

  it("refuses a name past the backend's eighty characters before the round trip", () => {
    expect(brandFormProblem("a".repeat(81), "acme.com")).toContain("eighty characters");
  });

  it("refuses an address that is not a site, in the backend's own words", () => {
    expect(brandFormProblem("Acme", "localhost")).toBe("Enter the site domain, e.g. brand.com.");
    expect(brandFormProblem("Acme", "a")).toContain("Enter the site address");
  });

  it("catches a duplicate it can see, and names the brand holding the id", () => {
    const problem = brandFormProblem("legal soft", "legalsoft.com", listed);
    expect(problem).toContain("Legal Soft is already on this list");
  });

  it("cannot see a switched-off brand, so it lets the server answer 409", () => {
    // A removed brand keeps its id and is not in the enabled list this is given.
    expect(brandFormProblem("Legal Soft", "legalsoft.com", [])).toBeNull();
  });
});

describe("the words a shared list needs", () => {
  it("says the list is shared, and with whom", () => {
    expect(SHARED_LIST_NOTE).toContain("SEO Analyst");
    expect(SHARED_LIST_NOTE).toContain("Blog Writer");
    expect(SHARED_LIST_NOTE).toContain("Issues");
  });

  it("never calls a removal a delete, and always names the way back", () => {
    const confirm = removeConfirmWords("Acme");
    expect(confirm).toContain("Remove Acme");
    expect(confirm).toContain("Nothing is deleted");
    expect(confirm).toContain("switched back on");
    expect(confirm.toLowerCase()).not.toContain("delete ");

    const done = removedWords("Acme");
    expect(done).toContain("kept");
    expect(done).toContain("Switched off");
  });

  it("states both absences a new brand has, so neither reads as a fault", () => {
    const words = createdWords("Acme");
    expect(words).toContain("no questions");
    expect(words).toContain("scheduled check off");
  });

  it("restores without promising a schedule it did not set", () => {
    expect(restoredWords("Acme")).toContain("whatever it was");
  });
});

describe("editorGate", () => {
  it("draws the controls for a GEO editor", () => {
    expect(editorGate({ is_geo_editor: true })).toEqual({ mayEdit: true, reason: "" });
  });

  it("gives a known non-editor the read-only screen and says why", () => {
    const gate = editorGate({ is_geo_editor: false, is_creator: false });

    expect(gate.mayEdit).toBe(false);
    expect(gate.reason).toContain("for GEO editors");
  });

  it("never widens the gate: a creator flag cannot beat an explicit false", () => {
    // The backend already counts a creator as a GEO editor, so an explicit
    // false from it means false. Re-deriving the rule here is how two copies
    // drift, with the drifting one granting what it should not.
    expect(editorGate({ is_geo_editor: false, is_creator: true }).mayEdit).toBe(false);
  });

  it("falls back to the creator flag for a session that predates the check", () => {
    expect(editorGate({ is_creator: true }).mayEdit).toBe(true);
  });

  it("says it cannot tell, and how to fix it, rather than claiming you are not one", () => {
    const gate = editorGate({});

    expect(gate.mayEdit).toBe(false);
    expect(gate.reason).toContain("cannot tell");
    expect(gate.reason).toContain("Sign out and back in");
  });
});
