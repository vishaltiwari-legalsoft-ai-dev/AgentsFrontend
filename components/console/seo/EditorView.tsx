"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  seoAnalyze, seoBenchmark, seoBenchmarks, seoScore,
  type SeoBenchmark, type SeoBenchmarkMeta, type SeoScoreReport,
} from "@/lib/api";

import { debounceMs, scoreTone, termLabel } from "./logic";

export default function EditorView({
  onToast,
  benchmarkId,
  onBenchmark,
}: {
  onToast: (msg: string) => void;
  benchmarkId: string | null;
  onBenchmark: (id: string | null) => void;
}) {
  const [metas, setMetas] = useState<SeoBenchmarkMeta[]>([]);
  const [benchmark, setBenchmark] = useState<SeoBenchmark | null>(null);
  const [draft, setDraft] = useState("");
  const [report, setReport] = useState<SeoScoreReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    seoBenchmarks().then((r) => setMetas(r.benchmarks)).catch((e) => onToast(String(e)));
  }, [onToast]);

  useEffect(() => {
    if (!benchmarkId) { setBenchmark(null); setReport(null); return; }
    seoBenchmark(benchmarkId).then(setBenchmark).catch((e) => onToast(String(e)));
  }, [benchmarkId, onToast]);

  const rescore = useCallback((text: string, bid: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      seoScore({ benchmark_id: bid, draft_text: text })
        .then(setReport)
        .catch((e) => onToast(String(e)));
    }, debounceMs);
  }, [onToast]);

  const onDraft = (text: string) => {
    setDraft(text);
    if (benchmarkId) rescore(text, benchmarkId);
  };

  const analyze = async () => {
    if (!newKeyword.trim()) return;
    setAnalyzing(true);
    try {
      const b = await seoAnalyze({ keyword: newKeyword.trim(), location: "", brand: "" });
      setMetas((m) => [{ ...b }, ...m]);
      onBenchmark(b.id);
      onToast(`Benchmark ready: ${b.keyword}`);
    } catch (e) {
      onToast(`Analysis failed: ${e}`);   // honest failure surfaces the reason
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="seo-editor">
      <div className="seo-editor-top">
        <select
          value={benchmarkId ?? ""}
          onChange={(e) => onBenchmark(e.target.value || null)}
          aria-label="Target keyword"
        >
          <option value="">Pick a target keyword…</option>
          {metas.map((m) => (
            <option key={m.id} value={m.id}>{m.keyword}</option>
          ))}
        </select>
        <input
          placeholder="Analyze a new keyword…"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void analyze(); }}
        />
        <button onClick={() => void analyze()} disabled={analyzing}>
          {analyzing ? "Analyzing… (fetches live Google results)" : "Analyze"}
        </button>
      </div>

      <div className="seo-editor-body">
        <textarea
          className="seo-draft"
          placeholder={benchmark ? "Write or paste your draft — the score updates as you type." : "Pick or analyze a keyword first."}
          value={draft}
          disabled={!benchmark}
          onChange={(e) => onDraft(e.target.value)}
        />
        <aside className="seo-rail">
          {report && benchmark ? (
            <>
              <div className={`seo-dial tone-${scoreTone(report.score)}`}>
                <span className="seo-dial-num">{Math.round(report.score)}</span>
                <span className="seo-dial-cap">/ 100</span>
              </div>
              <div className="seo-subscores">
                {([
                  ["Terms", report.term_coverage],
                  ["Topics", report.topical_completeness],
                  ["Structure", report.structure_fit],
                  ["Depth", report.semantic_depth],
                ] as const).map(([label, v]) => (
                  <div key={label} className="seo-subscore">
                    <span>{label}</span>
                    <div className="seo-bar"><i style={{ width: `${Math.round(v * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              {!benchmark.topics_ai && (
                <p className="seo-fallback-note" role="note">
                  Topic grouping unavailable ({benchmark.topics_fallback_reason ?? "AI pass failed"}) —
                  showing statistical terms.
                </p>
              )}
              <section className="seo-checklist">
                <h3>Missing terms</h3>
                {report.missing_terms.length === 0 ? <p className="seo-done">All term targets met ✓</p> : (
                  <ul>{report.missing_terms.map((t) => <li key={t.term}>{termLabel(t)}</li>)}</ul>
                )}
                <h3>Questions to answer</h3>
                {report.questions_unanswered.length === 0 ? <p className="seo-done">All answered ✓</p> : (
                  <ul>{report.questions_unanswered.map((q) => <li key={q}>{q}</li>)}</ul>
                )}
                <h3>Structure</h3>
                {report.structure_notes.length === 0 ? <p className="seo-done">On target ✓</p> : (
                  <ul>{report.structure_notes.map((n) => <li key={n}>{n}</li>)}</ul>
                )}
              </section>
            </>
          ) : (
            <p className="seo-empty">Score appears here once you pick a keyword and start writing.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
