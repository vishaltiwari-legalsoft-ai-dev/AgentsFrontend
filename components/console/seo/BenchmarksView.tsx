"use client";

import { useEffect, useState } from "react";

import {
  seoBenchmark, seoBenchmarks, seoRefresh,
  type SeoBenchmark, type SeoBenchmarkMeta,
} from "@/lib/api";

export default function BenchmarksView({
  onToast,
  onOpenInEditor,
}: {
  onToast: (msg: string) => void;
  onOpenInEditor: (id: string) => void;
}) {
  const [metas, setMetas] = useState<SeoBenchmarkMeta[]>([]);
  const [detail, setDetail] = useState<SeoBenchmark | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    seoBenchmarks().then((r) => setMetas(r.benchmarks)).catch((e) => onToast(String(e)));
  useEffect(() => { void load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (id: string) => {
    setBusy(id);
    try {
      const b = await seoRefresh(id);
      onToast(`Re-analyzed against today's SERP: ${b.keyword}`);
      await load();
      setDetail(b);
    } catch (e) {
      onToast(`Refresh failed: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="seo-benchmarks">
      <table className="seo-table">
        <thead>
          <tr><th>Keyword</th><th>Brand</th><th>SERP fetched</th><th>AI topics</th><th /></tr>
        </thead>
        <tbody>
          {metas.map((m) => (
            <tr key={m.id}>
              <td><button className="seo-link" onClick={() => void seoBenchmark(m.id).then(setDetail)}>{m.keyword}</button></td>
              <td>{m.brand || "—"}</td>
              <td>{m.serp_fetched_at.slice(0, 10)}</td>
              <td>{m.topics_ai ? "AI" : "statistical (fallback)"}</td>
              <td className="seo-row-actions">
                <button onClick={() => onOpenInEditor(m.id)}>Open in editor</button>
                <button disabled={busy === m.id} onClick={() => void refresh(m.id)}>
                  {busy === m.id ? "Re-analyzing…" : "Refresh"}
                </button>
              </td>
            </tr>
          ))}
          {metas.length === 0 && (
            <tr><td colSpan={5} className="seo-empty">No benchmarks yet — analyze a keyword from the Editor tab.</td></tr>
          )}
        </tbody>
      </table>

      {detail && (
        <aside className="seo-drawer" aria-label="Benchmark detail">
          <header>
            <h2>{detail.keyword}</h2>
            <button onClick={() => setDetail(null)} aria-label="Close">✕</button>
          </header>
          <p className="seo-sub">
            {detail.word_count_range[0]}–{detail.word_count_range[1]} words ·{" "}
            {detail.heading_count_range[0]}–{detail.heading_count_range[1]} headings ·{" "}
            {detail.source_pages.length} source pages
          </p>
          {!detail.topics_ai && (
            <p className="seo-fallback-note">
              Statistical terms only — {detail.topics_fallback_reason ?? "AI grouping failed"}.
            </p>
          )}
          {detail.topics.map((t) => (
            <section key={t.name}>
              <h3>{t.name}</h3>
              <p>{t.terms.join(", ")}</p>
              {t.questions.length > 0 && <ul>{t.questions.map((q) => <li key={q}>{q}</li>)}</ul>}
            </section>
          ))}
          <h3>Term targets</h3>
          <ul className="seo-terms">
            {detail.term_targets.map((t) => (
              <li key={t.term}>{t.term} <em>{t.min_count}–{t.max_count}×</em></li>
            ))}
          </ul>
          <h3>Excluded from benchmark</h3>
          <ul className="seo-excluded">
            {detail.excluded.map((e) => <li key={e.url}>{e.url} — {e.reason}</li>)}
          </ul>
        </aside>
      )}
    </div>
  );
}
