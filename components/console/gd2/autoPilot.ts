/* Auto-mode orchestration: walks the 4 stages over the EXISTING per-stage
   endpoints. Pure sequencing — every API effect is injected — so the whole
   pause/resume/stop state machine is unit-testable without React. */

import type { GdPlan } from "@/lib/api";

export interface AutoAccept {
  gradient: boolean;
  element: boolean;
  text: boolean;
  logo: boolean;
}

export type AutoStage = 1 | 2 | 3 | 4;

export const STAGE_KEY: Record<AutoStage, keyof AutoAccept> = {
  1: "gradient",
  2: "element",
  3: "text",
  4: "logo",
};

export type StageOutcome = "continue" | "gate";

export interface AutoPilotApi {
  /** Apply the plan's pick for one stage, then generate (and approve when the
   *  stage has no gate). Return "gate" to pause AFTER the stage's work — used
   *  by the mandatory Stage-3 style pick. The component wires the endpoints. */
  runStage(stage: AutoStage, plan: GdPlan): Promise<StageOutcome | void>;
  /** Auto mode hands control back at this stage (rejected row or gate). */
  pause(stage: AutoStage): void;
}

export type AutoOutcome =
  | { status: "done" }
  | { status: "paused"; stage: AutoStage }
  | { status: "gated"; stage: AutoStage }
  | { status: "stopped"; stage: AutoStage }
  | { status: "error"; stage: AutoStage; error: unknown };

/** Run stages `from`..4: auto-runs accepted stages, pauses at the first
 *  rejected one, stops when `isStopped` flips, and surfaces (never skips)
 *  stage errors. */
export async function runAutoPilot(
  plan: GdPlan,
  accept: AutoAccept,
  from: AutoStage,
  api: AutoPilotApi,
  isStopped: () => boolean,
): Promise<AutoOutcome> {
  for (let n = from as number; n <= 4; n += 1) {
    const stage = n as AutoStage;
    if (isStopped()) return { status: "stopped", stage };
    if (!accept[STAGE_KEY[stage]]) {
      api.pause(stage);
      return { status: "paused", stage };
    }
    if (stage === 4) {
      // Mandatory logo gate: auto NEVER composites the logo itself — the user
      // picks the variant + position in the Step-4 panel, which finishes the run.
      api.pause(4);
      return { status: "gated", stage: 4 };
    }
    try {
      const outcome = await api.runStage(stage, plan);
      if (outcome === "gate") {
        api.pause(stage);
        return { status: "gated", stage };
      }
    } catch (error) {
      return { status: "error", stage, error };
    }
  }
  return { status: "done" };
}
