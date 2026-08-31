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
  blankReason, comparableEngines, engineCards, modeSuffix, proxyEngines, statusOf,
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
