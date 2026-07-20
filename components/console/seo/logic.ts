import type { SeoBrandConfig, SeoMissingTerm, SeoScoreReport, SeoTermReportRow } from "@/lib/api";

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

/* ------------------------- GEO config drawer (I4) ------------------------- */
/* Pure text<->array helpers for the per-brand config editor: competitors are
   entered comma-separated, questions one-per-line. */

export function parseCompetitorsText(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseQuestionsText(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function competitorsToText(list?: string[]): string {
  return (list ?? []).join(", ");
}

export function questionsToText(list?: string[]): string {
  return (list ?? []).join("\n");
}

/** A brand slug typed into the "add brand" row: lowercase, dash-separated,
 * safe as a Firestore/JSON map key. */
export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

/** The editable form-state shape for one brand row in the config drawer —
 * arrays flattened to text so a plain <input>/<textarea> can hold them. */
export interface SeoBrandDraft {
  name: string;
  domain: string;
  category: string;
  competitorsText: string;
  questionsText: string;
}

export function brandToDraft(b: SeoBrandConfig): SeoBrandDraft {
  return {
    name: b.name ?? "",
    domain: b.domain ?? "",
    category: b.category ?? "",
    competitorsText: competitorsToText(b.competitors),
    questionsText: questionsToText(b.questions),
  };
}

export function draftToBrand(d: SeoBrandDraft): SeoBrandConfig {
  return {
    name: d.name.trim(),
    domain: d.domain.trim(),
    category: d.category.trim() || undefined,
    competitors: parseCompetitorsText(d.competitorsText),
    questions: parseQuestionsText(d.questionsText),
  };
}

export function emptyBrandDraft(): SeoBrandDraft {
  return { name: "", domain: "", category: "", competitorsText: "", questionsText: "" };
}

export function statusTone(
  s: SeoTermReportRow["status"],
): "muted" | "warn" | "good" | "bad" {
  if (s === "ok") return "good";
  if (s === "overused") return "bad";
  if (s === "low") return "warn";
  return "muted";
}

export function statusLabel(row: SeoTermReportRow): string {
  const range =
    row.min_count === row.max_count ? `${row.min_count}` : `${row.min_count}–${row.max_count}`;
  return `you: ${row.used} · target ${range}×`;
}

export function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Global unanswered questions not already listed under a topic block. */
export function extraQuestions(report: SeoScoreReport): string[] {
  const shown = new Set((report.topic_coverage ?? []).flatMap((t) => t.questions_unanswered));
  return report.questions_unanswered.filter((q) => !shown.has(q));
}
