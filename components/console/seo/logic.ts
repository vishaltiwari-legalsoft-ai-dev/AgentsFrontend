import type { SeoMissingTerm } from "@/lib/api";

export const debounceMs = 600;

/** 80+ is the published success bar (spec: "Content score of 80+ on all published articles"). */
export function scoreTone(score: number): "bad" | "mid" | "good" {
  if (score >= 80) return "good";
  if (score >= 50) return "mid";
  return "bad";
}

export function termLabel(t: SeoMissingTerm): string {
  const range = t.min_count === t.max_count ? `${t.min_count}` : `${t.min_count}–${t.max_count}`;
  return `${t.term} — used ${t.used} of ${range}`;
}
