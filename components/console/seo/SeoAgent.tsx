"use client";

import { useState } from "react";

import EditorView from "./EditorView";
import BenchmarksView from "./BenchmarksView";
import GeoView from "./GeoView";

export type SeoView = "editor" | "benchmarks" | "geo";

const TABS: { key: SeoView; label: string }[] = [
  { key: "editor", label: "Editor" },
  { key: "benchmarks", label: "Benchmarks" },
  { key: "geo", label: "GEO" },
];

export default function SeoAgent({
  onToast,
  onBack,
}: {
  onToast: (msg: string) => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<SeoView>("editor");
  const [benchmarkId, setBenchmarkId] = useState<string | null>(null);

  return (
    <div className="seo-root">
      <header className="seo-head">
        <button className="seo-back" onClick={onBack} aria-label="Back to agents">←</button>
        <div>
          <h1 className="seo-title">SEO Analyst</h1>
          <p className="seo-sub">Content optimization &amp; AI-answer visibility</p>
        </div>
        <nav className="seo-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={view === t.key}
              className={`seo-tab${view === t.key ? " is-active" : ""}`}
              onClick={() => setView(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {view === "editor" && (
        <EditorView onToast={onToast} benchmarkId={benchmarkId} onBenchmark={setBenchmarkId} />
      )}
      {view === "benchmarks" && (
        <BenchmarksView
          onToast={onToast}
          onOpenInEditor={(id) => { setBenchmarkId(id); setView("editor"); }}
        />
      )}
      {view === "geo" && <GeoView onToast={onToast} />}
    </div>
  );
}
