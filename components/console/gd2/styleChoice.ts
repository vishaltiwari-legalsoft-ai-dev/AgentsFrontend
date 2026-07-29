import type { GdAttempt } from "@/lib/api";

/* Pure decision logic for the Text Optimizer style gallery — kept out of the
   .tsx component so the JSX-less vitest setup can unit-test it. */

/** Honest badge text for a styled attempt: "AI polished" only when the image
 *  really came from the model; QA unavailability is disclosed, never hidden. */
export function styleBadge(a: Pick<GdAttempt, "ai" | "qa">): string {
  if (!a.ai) return "Engine render";
  return a.qa === "skipped" ? "✨ AI polished · QA skipped" : "✨ AI polished";
}

/** Default selection for a fresh set: prefer QA-passed styles (brand_strict
 *  first among them) — never default to a QA-skipped/failed style while a
 *  passed sibling exists. Falls back to brand_strict, then the first attempt. */
export function pickDefaultStyle(attempts: GdAttempt[]): number | null {
  if (!attempts.length) return null;
  const passed = attempts.filter((a) => a.qa === "passed");
  const pool = passed.length ? passed : attempts;
  return (pool.find((a) => a.style === "brand_strict") ?? pool[0]).attempt;
}
