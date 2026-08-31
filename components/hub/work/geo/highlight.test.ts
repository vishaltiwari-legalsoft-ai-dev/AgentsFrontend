import { describe, expect, it } from "vitest";
import { highlight, namesFrom, type Segment } from "./highlight";

const marks = (segs: Segment[]) =>
  segs.filter((s) => s.kind === "mark").map((s) => `${s.who}:${s.text}`);

const plain = (segs: Segment[]) => segs.map((s) => s.text).join("");

describe("highlight", () => {
  it("marks your name and leaves the rest of the sentence alone", () => {
    const segs = highlight("Legal Soft handles intake for firms.", { self: ["Legal Soft"], rivals: [] });
    expect(marks(segs)).toEqual(["self:Legal Soft"]);
    expect(plain(segs)).toBe("Legal Soft handles intake for firms.");
  });

  it("tells a rival apart from you", () => {
    const segs = highlight("Smith.ai and Legal Soft both answer calls.", {
      self: ["Legal Soft"],
      rivals: ["Smith.ai"],
    });
    expect(marks(segs)).toEqual(["rival:Smith.ai", "self:Legal Soft"]);
  });

  it("treats a dot in a name as a literal, not as any character", () => {
    // `Smith.ai` as a loose pattern would also match `SmithXai`. It must not.
    const segs = highlight("SmithXai is not the same company.", { self: [], rivals: ["Smith.ai"] });
    expect(marks(segs)).toEqual([]);
  });

  it("does not light up a name buried inside a longer word", () => {
    const segs = highlight("A Rubyist wrote it.", { self: [], rivals: ["Ruby"] });
    expect(marks(segs)).toEqual([]);
  });

  it("still marks a name that ends on punctuation the sentence supplies", () => {
    const segs = highlight("We recommend Ruby, then others.", { self: [], rivals: ["Ruby"] });
    expect(marks(segs)).toEqual(["rival:Ruby"]);
  });

  it("prefers the longest tracked name so one mention is not split in two", () => {
    const segs = highlight("Legal Soft Academy trains paralegals.", {
      self: ["Legal Soft", "Legal Soft Academy"],
      rivals: [],
    });
    expect(marks(segs)).toEqual(["self:Legal Soft Academy"]);
  });

  it("gives you the mark when a rival is tracked under the same spelling", () => {
    const segs = highlight("Legal Soft answered.", { self: ["Legal Soft"], rivals: ["Legal Soft"] });
    expect(marks(segs)).toEqual(["self:Legal Soft"]);
  });

  it("matches the engine's casing but marks whatever it actually wrote", () => {
    const segs = highlight("legal soft was named.", { self: ["Legal Soft"], rivals: [] });
    expect(marks(segs)).toEqual(["self:legal soft"]);
  });

  it("ignores one-character names, which would paint the whole answer", () => {
    const segs = highlight("A big win for A.", { self: ["A"], rivals: [] });
    expect(marks(segs)).toEqual([]);
  });

  it("returns the text untouched when nothing is tracked", () => {
    const segs = highlight("Nobody is tracked here.", { self: [], rivals: [] });
    expect(segs).toEqual([{ kind: "text", text: "Nobody is tracked here." }]);
  });

  it("never loses or duplicates a character of the original", () => {
    const text = "Smith.ai, Ruby and Legal Soft all answer calls for Legal Soft clients.";
    const segs = highlight(text, { self: ["Legal Soft"], rivals: ["Smith.ai", "Ruby"] });
    expect(plain(segs)).toBe(text);
  });
});

describe("namesFrom", () => {
  it("searches for exactly the spellings the backend scored on", () => {
    const set = namesFrom(
      { name: "Legal Soft", match_names: ["Legal Soft", "legalsoft.com", "LegalSoft"] },
      [{ name: "Smith.ai", match_names: ["Smith.ai", "smith.ai"] }],
    );
    expect(set.self).toEqual(["Legal Soft", "legalsoft.com", "LegalSoft"]);
    expect(set.rivals).toEqual(["Smith.ai", "smith.ai"]);
  });

  it("falls back to the display name when the API sent no alias list", () => {
    // A browser can run this build against the previous API for minutes after a
    // deploy. A blank highlighter would read as "nobody was named".
    const set = namesFrom({ name: "Legal Soft" }, [{ name: "Ruby" }]);
    expect(set.self).toEqual(["Legal Soft"]);
    expect(set.rivals).toEqual(["Ruby"]);
  });

  it("survives having no self row at all", () => {
    expect(namesFrom(null, [])).toEqual({ self: [], rivals: [] });
  });
});
