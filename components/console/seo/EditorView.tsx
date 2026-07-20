"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  seoAnalyze, seoBenchmark, seoBenchmarks, seoConfig, seoScore,
  type SeoBenchmark, type SeoBenchmarkMeta, type SeoScoreReport,
} from "@/lib/api";

import { debounceMs } from "./logic";
import ReportPanels from "./ReportPanels";

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
  const [brands, setBrands] = useState<{ slug: string; name: string }[]>([]);
  const [brandSlug, setBrandSlug] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id: bumped whenever a score request is fired OR a benchmark
  // switch invalidates whatever's in flight. A `.then`/`.catch` only applies its
  // result if it's still the most-recently-fired request when it resolves — this
  // guards against both a stale-benchmark response and plain out-of-order network replies.
  const requestId = useRef(0);

  useEffect(() => {
    seoBenchmarks().then((r) => setMetas(r.benchmarks)).catch((e) => onToast(String(e)));
  }, [onToast]);

  useEffect(() => {
    seoConfig()
      .then((c) => setBrands(
        Object.entries(c.brands ?? {}).map(([slug, b]) => ({ slug, name: b.name || slug })),
      ))
      .catch(() => setBrands([]));
  }, []);

  const rescore = useCallback((text: string, bid: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const reqId = ++requestId.current;
      seoScore({ benchmark_id: bid, draft_text: text })
        .then((r) => { if (requestId.current === reqId) setReport(r); })
        .catch((e) => { if (requestId.current === reqId) onToast(String(e)); });
    }, debounceMs);
  }, [onToast]);

  useEffect(() => {
    // Switching benchmarks must not leave the OLD benchmark's timer/report alive:
    // cancel any pending debounce, invalidate any in-flight response, and clear the
    // report (the draft text itself survives — the user shouldn't lose what they typed).
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    requestId.current += 1;
    setReport(null);
    if (!benchmarkId) { setBenchmark(null); return; }
    seoBenchmark(benchmarkId).then(setBenchmark).catch((e) => onToast(String(e)));
    if (draft.trim()) rescore(draft, benchmarkId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed only
    // on benchmarkId/onToast; draft is read at switch-time, not on every keystroke.
  }, [benchmarkId, onToast]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onDraft = (text: string) => {
    setDraft(text);
    if (benchmarkId) rescore(text, benchmarkId);
  };

  const analyze = async () => {
    if (!newKeyword.trim()) return;
    setAnalyzing(true);
    try {
      const b = await seoAnalyze({ keyword: newKeyword.trim(), location: "", brand: brandSlug });
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
        {brands.length > 0 && (
          <select
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            aria-label="Brand"
          >
            <option value="">No brand (generic)</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </select>
        )}
        <input
          placeholder="Analyze a new keyword…"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void analyze(); }}
        />
        <button onClick={() => void analyze()} disabled={analyzing}>
          {analyzing ? "Analyzing… (fetches live Google results)" : "Analyze"}
        </button>
        {benchmark?.brand && <span className="seo-brand-tag">for {benchmark.brand}</span>}
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
            <ReportPanels report={report} benchmark={benchmark} />
          ) : (
            <p className="seo-empty">Score appears here once you pick a keyword and start writing.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
