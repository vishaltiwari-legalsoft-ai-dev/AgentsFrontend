import { describe, expect, it } from "vitest";
import type { GeoCompetitor } from "@/lib/api";
import { assigneeToSave, questionsCell, withoutCompetitor } from "./edits";

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
