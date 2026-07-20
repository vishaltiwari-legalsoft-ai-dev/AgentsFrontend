import { describe, expect, it } from "vitest";

import { scoreTone, termLabel } from "./logic";

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
