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

export interface AutoPilotApi {
  /** Apply the plan's pick for one stage, then generate and approve it.
   *  The component wires the real per-stage endpoint calls. */
  runStage(stage: AutoStage, plan: GdPlan): Promise<void>;
  /** Auto mode reached a stage the user rejected — hand control back. */
  pause(stage: AutoStage): void;
}

export type AutoOutcome =
  | { status: "done" }
  | { status: "paused"; stage: AutoStage }
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
    try {
      await api.runStage(stage, plan);
    } catch (error) {
      return { status: "error", stage, error };
    }
  }
  return { status: "done" };
}
