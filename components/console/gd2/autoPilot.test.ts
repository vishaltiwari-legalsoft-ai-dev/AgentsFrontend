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
  it("runs all four accepted stages in order and finishes", async () => {
    const ran: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, ALL, 1, api(ran, []), () => false);
    expect(out).toEqual({ status: "done" });
    expect(ran).toEqual([1, 2, 3, 4]);
  });

  it("pauses at the first rejected stage without running it", async () => {
    const ran: AutoStage[] = [];
    const paused: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, { ...ALL, element: false }, 1, api(ran, paused), () => false);
    expect(out).toEqual({ status: "paused", stage: 2 });
    expect(ran).toEqual([1]);
    expect(paused).toEqual([2]);
  });

  it("resumes from a later stage after the manual step", async () => {
    const ran: AutoStage[] = [];
    const out = await runAutoPilot(PLAN, { ...ALL, element: false }, 3, api(ran, []), () => false);
    expect(out).toEqual({ status: "done" });
    expect(ran).toEqual([3, 4]);
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
