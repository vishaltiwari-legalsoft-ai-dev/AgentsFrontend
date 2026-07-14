import { describe, expect, it } from "vitest";
import { runAutoPilot, type AutoAccept, type AutoPilotApi, type AutoStage } from "./autoPilot";
import type { GdPlan } from "@/lib/api";

const PLAN = {
  version: 1, brief: "b", concept: "c",
  gradient: { cid: "A", reason: "" },
  element: { cid: "B", reason: "" },
  text: { headline: "H", highlight: "H", subline: "s", cta: "Go", reason: "" },
  logo: { logo_id: "combined-solid", reason: "" },
} satisfies GdPlan;

const ALL: AutoAccept = { gradient: true, element: true, text: true, logo: true };

function api(ran: AutoStage[], paused: AutoStage[], failAt?: AutoStage): AutoPilotApi {
  return {
    runStage: async (stage) => {
      if (stage === failAt) throw new Error("boom");
      ran.push(stage);
    },
    pause: (stage) => paused.push(stage),
  };
}

describe("runAutoPilot", () => {
  it("runs stages 1-3 then lands on the mandatory logo gate", async () => {
    const ran: AutoStage[] = [];
    const paused: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, ALL, 1, api(ran, paused), () => false);
    expect(out).toEqual({ status: "gated", stage: 4 });
    expect(ran).toEqual([1, 2, 3]); // stage 4 is never auto-run
    expect(paused).toEqual([4]);
  });

  it("pauses at the first rejected stage without running it", async () => {
    const ran: AutoStage[] = [];
    const paused: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, { ...ALL, element: false }, 1, api(ran, paused), () => false);
    expect(out).toEqual({ status: "paused", stage: 2 });
    expect(ran).toEqual([1]);
    expect(paused).toEqual([2]);
  });

  it("resumes from a later stage and still gates at the logo", async () => {
    const ran: AutoStage[] = [];
    const paused: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, { ...ALL, element: false }, 3, api(ran, paused), () => false);
    expect(out).toEqual({ status: "gated", stage: 4 });
    expect(ran).toEqual([3]);
    expect(paused).toEqual([4]);
  });

  it("stage 4 always gates before running", async () => {
    const ran: AutoStage[] = [];
    const paused: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, ALL, 4, api(ran, paused), () => false);
    expect(out).toEqual({ status: "gated", stage: 4 });
    expect(ran).toEqual([]); // never auto-composites
    expect(paused).toEqual([4]);
  });

  it("a runStage returning 'gate' pauses after the stage work", async () => {
    const paused: AutoStage[] = [];
    const out = await runAutoPilot(
      PLAN, ALL, 3,
      { runStage: async (s) => (s === 3 ? "gate" : undefined), pause: (s) => paused.push(s) },
      () => false,
    );
    expect(out).toEqual({ status: "gated", stage: 3 });
    expect(paused).toEqual([3]);
  });

  it("'continue' outcome keeps walking to the stage-4 gate", async () => {
    const ran: AutoStage[] = [];
    const out = await runAutoPilot(
      PLAN, ALL, 3,
      { runStage: async (s) => { ran.push(s); return "continue"; }, pause: () => {} },
      () => false,
    );
    expect(ran).toEqual([3]);
    expect(out).toEqual({ status: "gated", stage: 4 });
  });

  it("stops when asked and reports where", async () => {
    const ran: AutoStage[] = [];
    let calls = 0;
    const out = await runAutoPilot(PLAN, ALL, 1, api(ran, []), () => ++calls > 2);
    expect(out.status).toBe("stopped");
    expect(ran.length).toBeLessThan(4);
  });

  it("surfaces a stage error and never skips past it", async () => {
    const ran: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, ALL, 1, api(ran, [], 3), () => false);
    expect(out.status).toBe("error");
    if (out.status === "error") expect(out.stage).toBe(3);
    expect(ran).toEqual([1, 2]);
  });
});
