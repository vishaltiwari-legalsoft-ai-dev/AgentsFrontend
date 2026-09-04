/** The chip must not be able to lie again.
 *
 *  Before this, `available_engines()` returned one boolean per engine and the
 *  UI painted every truthy value the same green — so "Perplexity ✅" stood for
 *  an OpenRouter stand-in, and the Insights headline ranked that stand-in
 *  against a natively-measured Gemini as if the gap said something about the
 *  engines. These tests pin both halves of the fix.
 *
 *  Pure: no component, no network.
 */
import { describe, expect, it } from "vitest";
import type { GeoEngineStatus } from "../../../lib/api";
import {
  blankReason, comparableEngines, engineCards, engineCoverage, isLive, isLiveMode,
  modeSuffix, proxyEngines, shortDate, statusOf,
  type EngineRow,
} from "./provenance";

const row = (engine: string, mode: EngineRow["mode"], rate = 0.2): EngineRow =>
  ({ engine, rate, n: 30, mode, model: `${engine}-model` });

describe("proxyEngines", () => {
  it("names every engine measured through a stand-in", () => {
    const rows = [row("perplexity", "proxy"), row("gemini", "native"), row("chatgpt", "proxy")];

    expect(proxyEngines(rows).map((r) => r.engine)).toEqual(["perplexity", "chatgpt"]);
  });

  it("is empty when everything is measured natively", () => {
    expect(proxyEngines([
      row("gemini", "native"), row("aio", "serpapi"), row("ai_mode", "dataforseo"),
    ])).toEqual([]);
  });
});

describe("comparableEngines", () => {
  it("refuses to rank a proxy against a native engine", () => {
    // the exact shape that produced "strongest on Perplexity, weakest on
    // Gemini" — a claim about surfaces dressed as a claim about engines
    const rows = [row("perplexity", "proxy", 0.4), row("gemini", "native", 0.1)];

    expect(comparableEngines(rows)).toEqual([]);
  });

  it("ranks engines measured on the same surface", () => {
    const rows = [row("gemini", "native", 0.4), row("aio", "serpapi", 0.1), row("chatgpt", "proxy", 0.9)];

    expect(comparableEngines(rows).map((r) => r.engine)).toEqual(["gemini", "aio"]);
  });

  it("ranks a dataforseo-measured engine beside a native one — it IS the consumer surface", () => {
    const rows = [row("gemini", "native", 0.4), row("ai_mode", "dataforseo", 0.1), row("chatgpt", "proxy", 0.9)];

    expect(comparableEngines(rows).map((r) => r.engine)).toEqual(["gemini", "ai_mode"]);
  });

  it("ranks the two SERP vendors against each other — same surface, different fetcher", () => {
    const rows = [row("aio", "serpapi", 0.2), row("ai_mode", "dataforseo", 0.1)];

    expect(comparableEngines(rows).map((r) => r.engine)).toEqual(["aio", "ai_mode"]);
  });

  it("will not rank a lone native engine against itself", () => {
    expect(comparableEngines([row("gemini", "native"), row("chatgpt", "proxy")])).toEqual([]);
  });

  it("never treats an unreported surface as comparable", () => {
    const rows = [row("gemini", "unknown", 0.4), row("chatgpt", "unknown", 0.1)];

    expect(comparableEngines(rows)).toEqual([]);
  });
});

describe("statusOf", () => {
  const STATUS: Record<string, GeoEngineStatus> = {
    perplexity: { connected: true, mode: "proxy", model: "perplexity/sonar", means: "stand-in" },
  };

  it("uses the backend's reported surface when it has one", () => {
    expect(statusOf(STATUS, "perplexity", true).mode).toBe("proxy");
  });

  it("claims 'unknown', never 'native', for a backend that only sent a boolean", () => {
    // the dangerous default: assuming native here re-creates the original lie
    expect(statusOf({}, "gemini", true).mode).toBe("unknown");
  });

  it("reports a disconnected engine as off", () => {
    expect(statusOf({}, "chatgpt", false).mode).toBe("off");
  });
});

describe("modeSuffix", () => {
  it("marks only the surfaces that are not the real product", () => {
    expect(modeSuffix("proxy")).toBe(" (similar model)");
    expect(modeSuffix("unknown")).toBe(" (surface unknown)");
    expect(modeSuffix("native")).toBe("");
    expect(modeSuffix("serpapi")).toBe("");
    // DataForSEO fetches the live SERP — it IS the product, so no suffix
    expect(modeSuffix("dataforseo")).toBe("");
  });
});

describe("engineCards", () => {
  const KNOWN = ["perplexity", "gemini", "chatgpt", "aio", "ai_mode"];
  const STATUS: Record<string, GeoEngineStatus> = {
    perplexity: { connected: true, mode: "proxy", model: "perplexity/sonar", means: "" },
    gemini: { connected: true, mode: "native", model: "gemini-flash-latest", means: "" },
    chatgpt: { connected: true, mode: "proxy", model: "openai/gpt-5-mini", means: "" },
    aio: { connected: true, mode: "serpapi", model: "google-ai-overview", means: "" },
    ai_mode: { connected: true, mode: "dataforseo", model: "google-ai-mode", means: "" },
  };
  const block = (over = {}) =>
    ({ mention: { rate: 0.3 }, n_answers: 40, n_measured: 40, n_no_aio: 0, ...over });

  it("keeps an engine visible when its data aged out of the window", () => {
    // the real case: 40 AIO answers exist, all from 11 Aug, and the report only
    // looks back 7 days. The engine used to vanish, which reads as "broken".
    const cards = engineCards(
      { gemini: block() }, { aio: "2026-08-11T04:00:00Z" }, STATUS, KNOWN);

    const aio = cards.find((c) => c.engine === "aio")!;
    expect(aio.state).toBe("stale");
    expect(aio.lastSeen).toBe("2026-08-11T04:00:00Z");
    expect(aio.rate).toBeNull();          // no rate is claimed for an empty window
  });

  it("separates an engine never measured from one merely out of window", () => {
    const cards = engineCards({}, {}, STATUS, KNOWN);

    expect(cards.every((c) => c.state === "never")).toBe(true);
    expect(cards.every((c) => c.lastSeen === null)).toBe(true);
  });

  it("reports an unconfigured engine as off, not as never measured", () => {
    const cards = engineCards({}, {}, { ...STATUS, chatgpt: {
      connected: false, mode: "off", model: "", means: "" } }, KNOWN);

    expect(cards.find((c) => c.engine === "chatgpt")!.state).toBe("off");
  });

  it("counts what could carry a mention, not every row stored", () => {
    const cards = engineCards(
      { aio: block({ mention: { rate: null }, n_answers: 40, n_measured: 2, n_no_aio: 38 }) },
      {}, STATUS, KNOWN);

    const aio = cards.find((c) => c.engine === "aio")!;
    // 38 queries had no AI Overview at all — "absent from 40" would be a lie
    expect(aio.measured).toBe(2);
    expect(aio.emptySlots).toBe(38);
    expect(aio.rate).toBeNull();
  });

  it("puts the cards that carry a number above the ones that do not", () => {
    const cards = engineCards(
      { gemini: block({ mention: { rate: 0.1 } }), perplexity: block({ mention: { rate: 0.5 } }) },
      { aio: "2026-08-11T04:00:00Z" }, STATUS, KNOWN);

    expect(cards.map((c) => c.engine)).toEqual(["perplexity", "gemini", "aio", "ai_mode", "chatgpt"]);
  });

  it("falls back to n_answers when a backend predates n_measured", () => {
    const cards = engineCards(
      { gemini: { mention: { rate: 0.3 }, n_answers: 12 } }, {}, STATUS, KNOWN);

    expect(cards.find((c) => c.engine === "gemini")!.measured).toBe(12);
  });
});

describe("blankReason", () => {
  it("calls a dead engine dead", () => {
    expect(blankReason({ errors: 41, emptySlots: 0 })).toBe("errors");
  });

  it("calls an empty AIO slot empty", () => {
    expect(blankReason({ errors: 0, emptySlots: 38 })).toBe("no_answer_published");
  });

  it("keeps the two apart when both happened", () => {
    expect(blankReason({ errors: 3, emptySlots: 38 })).toBe("mixed");
  });

  it("names the degenerate case instead of inventing one", () => {
    expect(blankReason({ errors: 0, emptySlots: 0 })).toBe("nothing_stored");
  });
});

describe("engineCards — failure is not an observation", () => {
  const KNOWN = ["perplexity", "gemini", "chatgpt", "aio", "ai_mode"];
  const STATUS: Record<string, GeoEngineStatus> = {
    aio: { connected: true, mode: "serpapi", model: "google-ai-overview", means: "" },
  };

  it("reports an engine whose every call failed as failed, not as 'no AI Overview'", () => {
    // production, 29 Aug: the SerpAPI monthly cap was spent, so all 41 AIO
    // calls errored. The card read "nothing to appear in: 0 of 0 queries
    // returned no AI Overview" — Google publishing nothing and our own key
    // being dead are opposite facts, and the panel printed the flattering one.
    const cards = engineCards(
      { aio: { mention: { rate: null }, n_answers: 41, n_measured: 0, n_errors: 41, n_no_aio: 0 } },
      {}, STATUS, KNOWN);

    const aio = cards.find((c) => c.engine === "aio")!;
    expect(aio.state).toBe("measured");
    expect(aio.rate).toBeNull();
    expect(aio.errors).toBe(41);
    expect(aio.attempted).toBe(41);
    expect(blankReason(aio)).toBe("errors");
    expect(blankReason(aio)).not.toBe("no_answer_published");
  });

  it("keeps the empty-slot denominator on rows stored, not on empty slots", () => {
    // "38 of 38" was printed from emptySlots twice; with 2 errors in the same
    // window the honest denominator is every row stored.
    const cards = engineCards(
      { aio: { mention: { rate: null }, n_answers: 40, n_measured: 0, n_errors: 2, n_no_aio: 38 } },
      {}, STATUS, KNOWN);

    const aio = cards.find((c) => c.engine === "aio")!;
    expect(aio.attempted).toBe(40);
    expect(aio.emptySlots).toBe(38);
    expect(blankReason(aio)).toBe("mixed");
  });

  it("still surfaces errors on an engine that DID produce a rate", () => {
    // chatgpt showed "named in 30 answers" while 15 calls had failed silently
    const cards = engineCards(
      { chatgpt: { mention: { rate: 1 }, n_answers: 45, n_measured: 30, n_errors: 15 } },
      {}, STATUS, KNOWN);

    const chatgpt = cards.find((c) => c.engine === "chatgpt")!;
    expect(chatgpt.measured).toBe(30);
    expect(chatgpt.errors).toBe(15);
    expect(chatgpt.attempted).toBe(45);
  });

  it("defaults errors to 0 for a backend that predates n_errors", () => {
    const cards = engineCards(
      { gemini: { mention: { rate: 0.3 }, n_answers: 12 } }, {}, STATUS, KNOWN);

    expect(cards.find((c) => c.engine === "gemini")!.errors).toBe(0);
  });
});


describe("isLive / isLiveMode", () => {
  // The bug this pins: SerpAPI was retired for DataForSEO, and four panels each
  // kept their own `native || serpapi` copy of this test. Google's AI Overview
  // and AI Mode — the two engines that had just started working — rendered as
  // "not live" on the Overview, the Trend, the Competitors table and
  // Integrations, all at once.
  it("counts the live consumer SERP however it was fetched", () => {
    expect(isLiveMode("dataforseo")).toBe(true);
    expect(isLiveMode("serpapi")).toBe(true);
    expect(isLiveMode("native")).toBe(true);
  });

  it("never counts a stand-in, an unreported surface or a missing one", () => {
    expect(isLiveMode("proxy")).toBe(false);
    expect(isLiveMode("unknown")).toBe(false);
    expect(isLiveMode("off")).toBe(false);
    expect(isLiveMode(undefined)).toBe(false);
  });

  it("needs a key as well as a real surface", () => {
    expect(isLive({ connected: true, mode: "dataforseo" })).toBe(true);
    expect(isLive({ connected: false, mode: "dataforseo" })).toBe(false);
    expect(isLive({ connected: true, mode: "proxy" })).toBe(false);
    expect(isLive(undefined)).toBe(false);
  });

  it("agrees with the ranking rule — both read the same list", () => {
    const rows = [row("aio", "dataforseo"), row("ai_mode", "dataforseo")];

    expect(comparableEngines(rows).map((r) => r.engine)).toEqual(["aio", "ai_mode"]);
    expect(rows.every((r) => isLiveMode(r.mode))).toBe(true);
  });
});

describe("shortDate", () => {
  it("reads as a person would say it", () => {
    expect(shortDate("2026-08-28T22:10:00Z", "UTC")).toBe("28 Aug");
  });

  it("invents nothing from a missing or unusable date", () => {
    expect(shortDate(null)).toBeNull();
    expect(shortDate(undefined)).toBeNull();
    expect(shortDate("not a date")).toBeNull();
  });
});

describe("engineCoverage", () => {
  // How the two kinds of engine are asked, exactly as `/geo/config` publishes
  // it. Read, never mirrored: this console used to hardcode the engine ids and
  // the sample size, which is the same defect as the "four AI engines" line.
  const CHAT = { kind: "chat", runs_per_prompt: 3, intents: null };
  const SERP = { kind: "serp", runs_per_prompt: 1, intents: ["category", "problem"] };

  describe("the per-check expectation is scaled by the checks that ran", () => {
    it("prices a window at n_expected x n_sweeps, never at n_expected", () => {
      // The correction this pins. `n_expected` is per CHECK and `n_answers` is
      // per WINDOW, so a 7-day window holding 5 checks reports 350 answers
      // against an expectation of 70. Printed unscaled that reads "350 of 70
      // asked" — worse than the unexplained numbers it was built to explain.
      const c = engineCoverage({ got: 350, expected: 70, sweeps: 5, spec: CHAT });

      expect(c.state).toBe("complete");
      expect(c.count).toBe("350 of 350 asked across 5 checks");
      expect(c.count).not.toContain("of 70");
    });

    it("leaves the check count out when the window holds exactly one", () => {
      const c = engineCoverage({ got: 34, expected: 34, sweeps: 1, spec: SERP });

      expect(c.count).toBe("34 of 34 asked");
      expect(c.count).not.toContain("across");
    });

    it("measures a shortfall against the scaled number", () => {
      const c = engineCoverage({ got: 210, expected: 70, sweeps: 5, spec: CHAT });

      expect(c.state).toBe("short");
      expect(c.count).toBe("210 of 350 asked across 5 checks");
      expect(c.why).toContain("140 never ran");
    });
  });

  describe("what it will not say without the numbers to say it", () => {
    it("says nothing at all when n_sweeps has not shipped yet", () => {
      // Vercel is live four to six minutes before Cloud Run. Half the pair is
      // not enough: dividing a per-window count by a per-check expectation is
      // the bug, so this renders nothing rather than a wrong fraction.
      const c = engineCoverage({ got: 350, expected: 70, spec: CHAT });

      expect(c.state).toBe("unknown");
      expect(c.count).toBe("");
      expect(c.why).toBe("");
    });

    it("says nothing at all when n_expected has not shipped yet", () => {
      expect(engineCoverage({ got: 350, sweeps: 5, spec: CHAT })).toMatchObject({
        state: "unknown", count: "",
      });
    });

    it("never divides by zero checks — it says no check ran", () => {
      const c = engineCoverage({ got: 0, expected: 70, sweeps: 0, spec: CHAT, days: 7 });

      expect(c.state).toBe("no_checks");
      expect(c.count).toBe("nothing stored");
      expect(c.why).toContain("no check ran in the last 7 days");
      expect(c.count).not.toContain("of");
    });

    it("reports answers with no logged check honestly, rather than as a fraction", () => {
      const c = engineCoverage({ got: 40, expected: 70, sweeps: 0, spec: CHAT, days: 7 });

      expect(c.state).toBe("no_checks");
      expect(c.count).toBe("40 answers stored");
    });

    it("still does the arithmetic when the engine spec has not shipped yet", () => {
      // No cadence is claimed, but the fraction is still true.
      const c = engineCoverage({ got: 350, expected: 70, sweeps: 5 });

      expect(c.count).toBe("350 of 350 asked across 5 checks");
      expect(c.why).toBe("");
    });
  });

  describe("the cadence comes off the spec, not off a list kept here", () => {
    it("reads the sample size the backend actually publishes", () => {
      const five = engineCoverage({
        got: 10, expected: 10, sweeps: 1,
        spec: { kind: "chat", runs_per_prompt: 5, intents: null },
      });

      expect(five.why).toBe("five readings of every question");
    });

    it("says a billed engine skips the questions that already name you", () => {
      const c = engineCoverage({ got: 34, expected: 34, sweeps: 1, spec: SERP });

      expect(c.why).toBe("one reading of every question, and only the ones that do not already name you");
    });

    it("drops that clause the moment the engine is asked brand questions too", () => {
      const c = engineCoverage({
        got: 34, expected: 34, sweeps: 1,
        spec: { kind: "serp", runs_per_prompt: 1, intents: ["category", "problem", "brand"] },
      });

      expect(c.why).toBe("one reading of every question");
    });
  });

  describe("a paused engine", () => {
    it("shows the real hole, not a full set measured against itself", () => {
      // Five checks owed AI Overview 170 answers; the credit bought two of
      // them. "68 of 68" would dress that up as complete.
      const c = engineCoverage({
        got: 68, expected: 34, sweeps: 5, spec: SERP,
        creditSpent: true, creditUsed: 2000, creditLimit: 2000,
        pausedSince: "2026-08-28T09:00:00Z", timeZone: "UTC",
      });

      expect(c.state).toBe("paused");
      expect(c.count).toBe("68 of 170 asked across 5 checks");
      expect(c.why).toContain("this month's search credit is spent (2,000 of 2,000 used)");
      expect(c.why).toContain("none since 28 Aug");
    });

    it("falls back to the last answer when no pause date came through", () => {
      const c = engineCoverage({
        got: 68, expected: 34, sweeps: 5, spec: SERP,
        creditSpent: true, lastSeen: "2026-08-28T09:00:00Z", timeZone: "UTC",
      });

      expect(c.why).toContain("last answer 28 Aug");
      expect(c.why).not.toContain("used)");
    });

    it("says it is paused even with no denominator on the wire", () => {
      const c = engineCoverage({ got: 68, spec: SERP, creditSpent: true });

      expect(c.state).toBe("paused");
      expect(c.count).toBe("68 answers stored");
      expect(c.why).toBe("paused — this month's search credit is spent");
    });

    it("never pauses an engine the search credit does not pay for", () => {
      const chat = engineCoverage({
        got: 350, expected: 70, sweeps: 5, spec: CHAT, creditSpent: true,
      });

      expect(chat.state).toBe("complete");
    });
  });

  describe("facts about the rows that did run", () => {
    it("keeps a failed call and an unpublished overview apart", () => {
      const errored = engineCoverage({
        got: 34, expected: 34, sweeps: 1, spec: SERP, errors: 15,
      });
      const empty = engineCoverage({
        got: 34, expected: 34, sweeps: 1, spec: SERP, emptySlots: 4,
      });

      expect(errored.why).toContain("15 of them failed");
      expect(errored.why).not.toContain("Google published nothing");
      expect(empty.why).toContain("Google published nothing on 4");
      expect(empty.why).not.toContain("failed");
    });

    it("does not let a failed call look like a question that was never asked", () => {
      // A failed call still stores a row, so it is INSIDE n_answers and cannot
      // be the reason a count fell short. Saying so would send somebody looking
      // for a shortfall that is not there.
      const c = engineCoverage({
        got: 34, expected: 34, sweeps: 1, spec: SERP, errors: 15,
      });

      expect(c.state).toBe("complete");
      expect(c.why).not.toContain("never ran");
    });
  });

  it("does not read 'not asked' as a miss when no question needs the engine", () => {
    const c = engineCoverage({ got: 0, expected: 0, sweeps: 3, spec: SERP });

    expect(c.state).toBe("none");
    expect(c.count).toBe("not asked");
    expect(c.why).toContain("every one of yours already names you");
  });

  it("never prints more asked than asked for when the question list shrank", () => {
    const c = engineCoverage({ got: 190, expected: 34, sweeps: 5, spec: SERP });

    expect(c.count).toBe("190 answers stored");
    expect(c.count).not.toContain("of 170");
    expect(c.why).toContain("questions since removed");
  });
});
