"use client";

import { useEffect, useState } from "react";

import {
  seoGeoCapture, seoGeoOverview, seoGeoRun,
  type SeoGeoBrand, type SeoGeoRun,
} from "@/lib/api";

const ENGINE_LABELS: Record<string, string> = {
  gpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", ai_overview: "AI Overview",
};

export default function GeoView({ onToast }: { onToast: (msg: string) => void }) {
  const [brands, setBrands] = useState<SeoGeoBrand[]>([]);
  const [run, setRun] = useState<SeoGeoRun | null>(null);
  const [capturing, setCapturing] = useState(false);

  const load = () =>
    seoGeoOverview().then((r) => setBrands(r.brands)).catch((e) => onToast(String(e)));
  useEffect(() => { void load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const capture = async () => {
    setCapturing(true);
    try {
      await seoGeoCapture();
      onToast("GEO capture complete");
      await load();
    } catch (e) {
      onToast(`GEO capture failed: ${e}`);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="seo-geo">
      <div className="seo-geo-actions">
        <button onClick={() => void capture()} disabled={capturing}>
          {capturing ? "Querying AI engines…" : "Run GEO check now"}
        </button>
      </div>

      {brands.length === 0 && (
        <p className="seo-empty">
          No GEO runs yet. Configure brands (name, domain, competitors) in /api/seo/config,
          then run a check.
        </p>
      )}

      <div className="seo-geo-grid">
        {brands.map((b) => {
          const latest = b.latest;
          const prev = b.history[1];
          const trend =
            latest && prev ? (latest.score > prev.score ? "▲" : latest.score < prev.score ? "▼" : "–") : "";
          return (
            <article key={b.brand} className="seo-geo-card">
              <header>
                <h2>{b.brand}</h2>
                <span className="seo-geo-score">
                  {latest ? latest.score.toFixed(1) : "—"}<small>/10</small> {trend}
                </span>
              </header>
              {latest && (
                <>
                  <div className="seo-geo-engines">
                    {Object.entries(latest.engine_scores).map(([engine, s]) => (
                      <span key={engine} className="seo-geo-engine">
                        {ENGINE_LABELS[engine] ?? engine}: {s.toFixed(1)}
                      </span>
                    ))}
                    {latest.no_data_engines.map((engine) => (
                      <span key={engine} className="seo-geo-engine is-nodata">
                        {ENGINE_LABELS[engine] ?? engine}: no data this week
                      </span>
                    ))}
                  </div>
                  <div className="seo-geo-history">
                    {b.history.slice(0, 8).reverse().map((h) => (
                      <button
                        key={h.id}
                        className="seo-geo-week"
                        title={`${h.week}: ${h.score}`}
                        style={{ height: `${Math.max(8, h.score * 4)}px` }}
                        onClick={() => void seoGeoRun(h.id).then(setRun)}
                      />
                    ))}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {run && (
        <aside className="seo-drawer" aria-label="GEO run detail">
          <header>
            <h2>{run.brand} — {run.week}</h2>
            <button onClick={() => setRun(null)} aria-label="Close">✕</button>
          </header>
          {run.answers.map((a, i) => (
            <section key={i} className={`seo-geo-answer${a.error ? " is-error" : ""}`}>
              <h3>{ENGINE_LABELS[a.engine] ?? a.engine} · {a.question}</h3>
              {a.error ? (
                <p className="seo-fallback-note">Engine call failed: {a.error}</p>
              ) : (
                <>
                  <p className="seo-geo-flags">
                    {a.mentioned ? "✓ mentioned" : "✗ not mentioned"} ·{" "}
                    {a.cited ? "✓ cited" : "✗ not cited"}
                  </p>
                  <blockquote>{a.answer_text}</blockquote>
                  {a.citations.length > 0 && (
                    <ul className="seo-excluded">{a.citations.map((c) => <li key={c}>{c}</li>)}</ul>
                  )}
                </>
              )}
            </section>
          ))}
        </aside>
      )}
    </div>
  );
}
