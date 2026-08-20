/** The competitor table must not invent a number about a competitor.
 *
 *  Every cell here has an "we did not measure this" state that is easy to
 *  render as a zero by accident, and a zero in a rival's citation column is a
 *  claim ("never cited") the poll never made. Pinned here rather than in JSX.
 */
import { describe, expect, it } from "vitest";
import type { GeoComparisonRow, GeoQuestionRow, GeoUntrackedDomain } from "../../../lib/api";
import {
  citationCell, headline, losingQuestions, matchNames, positionCell, scoreboard,
  slugKey, suggestName, trackableDomains,
} from "./compare";

const row = (over: Partial<GeoComparisonRow> = {}): GeoComparisonRow => ({
  key: "clio",
  name: "Clio",
  is_self: false,
  domain: "clio.com",
  mention: { rate: 0.4, stdev: 0.1, n_prompts: 10, n_answers: 30 },
  citation: { rate: 0.25, n_answers_with_citations: 20, cited_answers: 5 },
  sov_share: 0.3,
  sov_credit: 4,
  avg_position: 2.4,
  match_names: ["Clio", "clio.com"],
  per_engine: { perplexity: 0.4 },
  vs_self: { n_prompts: 10, ahead: 3, behind: 4, tied: 2, both_absent: 1, behind_prompt_ids: [] },
  ...over,
});

const self = (over: Partial<GeoComparisonRow> = {}): GeoComparisonRow =>
  row({ key: "self", name: "Legal Soft", is_self: true, domain: "legalsoft.com",
        vs_self: null, ...over });

describe("citationCell", () => {
  it("says 'no domain' rather than 0% when there is nothing to count against", () => {
    const cell = citationCell(row({ domain: "", citation: null }));

    expect(cell.text).toBe("no domain");
    expect(cell.unknown).toBe(true);
    expect(cell.title).toContain("Clio");
  });

  it("says nothing was measured when no answer carried citations", () => {
    const cell = citationCell(
      row({ citation: { rate: null, n_answers_with_citations: 0, cited_answers: 0 } }),
    );

    expect(cell.text).toBe("—");
    expect(cell.unknown).toBe(true);
  });

  it("shows the rate with its n behind it", () => {
    const cell = citationCell(row());

    expect(cell.text).toBe("25%");
    expect(cell.unknown).toBe(false);
    expect(cell.title).toContain("5 of 20");
  });

  it("distinguishes a real zero from an unknown", () => {
    const cell = citationCell(
      row({ citation: { rate: 0, n_answers_with_citations: 12, cited_answers: 0 } }),
    );

    expect(cell.text).toBe("0%");
    expect(cell.unknown).toBe(false);
  });
});

describe("deploy skew", () => {
  /** Vercel ships the frontend in about a minute; Cloud Run takes several. For
   *  that window this build talks to the PREVIOUS API. `row.match_names.length`
   *  on a payload without the field threw, React unmounted, and the whole
   *  console showed "Application error: a client-side exception has occurred" —
   *  in production, for every user, until the backend caught up. */
  it("survives a payload from an API that does not send the field yet", () => {
    const old = { ...row() } as unknown as Record<string, unknown>;
    delete old.match_names;

    expect(matchNames(old as unknown as GeoComparisonRow)).toEqual([]);
  });

  it("returns the names when they are there", () => {
    expect(matchNames(row())).toEqual(["Clio", "clio.com"]);
  });

  it("does not blow up on rows or questions the old API omitted", () => {
    expect(losingQuestions(undefined)).toEqual([]);
    expect(trackableDomains(undefined)).toEqual([]);
    expect(headline([], "Legal Soft", 1)).toContain("Nothing measured");
  });

  it("treats a missing position as unknown, not as zero", () => {
    const old = { ...row() } as unknown as Record<string, unknown>;
    delete old.avg_position;

    const cell = positionCell(old as unknown as GeoComparisonRow);
    expect(cell.unknown).toBe(true);
    expect(cell.text).toBe("—");
  });
});

describe("positionCell", () => {
  it("is unknown when the rival is never named", () => {
    expect(positionCell(row({ avg_position: null })).unknown).toBe(true);
  });

  it("reads as a rank, lower being better", () => {
    expect(positionCell(row({ avg_position: 2.4 })).text).toBe("#2.4");
  });
});

describe("scoreboard", () => {
  it("has no scoreboard for our own row", () => {
    expect(scoreboard(self())).toBeNull();
  });

  it("splits the questions four ways and they add up", () => {
    const board = scoreboard(row())!;

    expect(board).toEqual({ won: 3, lost: 4, tied: 2, open: 1, total: 10 });
    expect(board.won + board.lost + board.tied + board.open).toBe(board.total);
  });
});

describe("headline", () => {
  it("asks for competitors instead of pretending to compare", () => {
    expect(headline([self()], "Legal Soft", 0)).toContain("No competitors tracked");
  });

  it("names the rival that is ahead, on the same answers", () => {
    const text = headline([self({ mention: { rate: 0.2, stdev: 0, n_prompts: 10, n_answers: 30 } }), row()],
                          "Legal Soft", 1);

    expect(text).toBe("Clio is named in 40% of the same answers, against 20% for Legal Soft.");
  });

  it("still names the questions being lost when we lead overall", () => {
    const text = headline([self({ mention: { rate: 0.8, stdev: 0, n_prompts: 10, n_answers: 30 } }), row()],
                          "Legal Soft", 1);

    expect(text).toContain("ahead of every tracked competitor");
    expect(text).toContain("Clio still leads on 4 questions");
  });

  it("does not claim a lead when nothing was measured", () => {
    const text = headline(
      [self({ mention: { rate: null, stdev: null, n_prompts: 0, n_answers: 0 } }), row()],
      "Legal Soft", 1,
    );

    expect(text).toContain("Nothing measured");
  });
});

describe("losingQuestions", () => {
  const q = (id: string, ahead: GeoQuestionRow["rivals_ahead"]): GeoQuestionRow => ({
    prompt_id: id, text: id, intent: "category", n: 3, rates: {}, self_rate: 0,
    rivals_ahead: ahead, leader: "", engines: [],
  });

  it("keeps only the questions a rival is ahead on", () => {
    const rows = losingQuestions([
      q("p1", [{ key: "clio", name: "Clio", rate: 1 }]),
      q("p2", []),
    ]);

    expect(rows.map((r) => r.prompt_id)).toEqual(["p1"]);
  });
});

describe("trackableDomains", () => {
  const dom = (domain: string, absent: number): GeoUntrackedDomain =>
    ({ domain, count: 5, answers_you_absent: absent, example_prompt_ids: [] });

  it("drops domains that only ever appear beside us", () => {
    expect(trackableDomains([dom("g2.com", 3), dom("ourfan.com", 0)]).map((d) => d.domain))
      .toEqual(["g2.com"]);
  });
});

describe("suggestName / slugKey", () => {
  it("proposes a human name from a domain", () => {
    expect(suggestName("clio.com")).toBe("Clio");
    expect(suggestName("smokeball-legal.io")).toBe("Smokeball Legal");
  });

  it("makes a stable key that survives punctuation", () => {
    expect(slugKey("Smokeball Legal!")).toBe("smokeball-legal");
    expect(slugKey("!!!")).toBe("comp");
  });
});
