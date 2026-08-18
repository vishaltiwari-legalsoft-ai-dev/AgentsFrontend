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
  comparableEngines, modeSuffix, proxyEngines, statusOf, type EngineRow,
} from "./provenance";

const row = (engine: string, mode: EngineRow["mode"], rate = 0.2): EngineRow =>
  ({ engine, rate, n: 30, mode, model: `${engine}-model` });

describe("proxyEngines", () => {
  it("names every engine measured through a stand-in", () => {
    const rows = [row("perplexity", "proxy"), row("gemini", "native"), row("chatgpt", "proxy")];

    expect(proxyEngines(rows).map((r) => r.engine)).toEqual(["perplexity", "chatgpt"]);
  });

  it("is empty when everything is measured natively", () => {
    expect(proxyEngines([row("gemini", "native"), row("aio", "serpapi")])).toEqual([]);
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
    expect(modeSuffix("proxy")).toBe(" (proxy)");
    expect(modeSuffix("unknown")).toBe(" (surface unknown)");
    expect(modeSuffix("native")).toBe("");
    expect(modeSuffix("serpapi")).toBe("");
  });
});
