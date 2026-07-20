"use client";

import type { SeoBenchmark, SeoScoreReport } from "@/lib/api";

import { clampPct, extraQuestions, scoreTone, statusLabel, statusTone } from "./logic";

export default function ReportPanels({
  report,
  benchmark,
}: {
  report: SeoScoreReport;
  benchmark: SeoBenchmark;
}) {
  const s = report.structure;
  const gapTopics = report.topic_coverage.filter(
    (t) => t.terms_missing.length > 0 || t.questions_unanswered.length > 0,
  );
  const wholeTopicsMissing = report.topic_coverage.filter((t) => t.terms_present.length === 0);
  const needAdding = report.term_report.filter(
    (r) => r.status === "missing" || r.status === "low",
  );
  const other = extraQuestions(report);

  return (
    <>
      {/* 1 — Content score */}
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
            <div className="seo-bar"><i style={{ width: `${clampPct(v * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      {!benchmark.topics_ai && (
        <p className="seo-fallback-note" role="note">
          Topic grouping unavailable ({benchmark.topics_fallback_reason ?? "AI pass failed"}) —
          showing statistical terms.
        </p>
      )}

      {/* 2 — Structure targets (always visible) */}
      {s && (
        <section className="seo-panel-block">
          <h3>Structure targets</h3>
          <div className="seo-struct-row">
            <span>Words</span>
            <div className="seo-bar seo-struct-bar">
              <i style={{ width: `${clampPct((s.word_count / Math.max(s.word_count_range[1], 1)) * 100)}%` }} />
            </div>
            <em>{s.word_count} / {s.word_count_range[0]}–{s.word_count_range[1]}</em>
          </div>
          <div className="seo-struct-row">
            <span>Headings</span>
            <div className="seo-bar seo-struct-bar">
              <i style={{ width: `${clampPct((s.heading_count / Math.max(s.heading_count_range[1], 1)) * 100)}%` }} />
            </div>
            <em>{s.heading_count} / {s.heading_count_range[0]}–{s.heading_count_range[1]}</em>
          </div>
          {s.faq_needed && (
            <p className={s.faq_present ? "seo-done" : "seo-struct-warn"}>
              {s.faq_present
                ? "FAQ section present ✓"
                : "Add an FAQ section — Google shows People-Also-Ask for this keyword"}
            </p>
          )}
        </section>
      )}

      {/* 3 — Keyword density */}
      <section className="seo-panel-block">
        <h3>Keyword density</h3>
        <div className="seo-density">
          {report.term_report.map((r) => (
            <div key={r.term} className={`seo-density-row tone-${statusTone(r.status)}`}>
              <span className="seo-density-term">{r.term}</span>
              <span className="seo-density-count">{statusLabel(r)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — Missing words & topics */}
      <section className="seo-panel-block">
        <h3>Missing words &amp; topics</h3>
        {needAdding.length === 0 && wholeTopicsMissing.length === 0 ? (
          <p className="seo-done">All term targets met ✓</p>
        ) : (
          <div className="seo-chips">
            {needAdding.map((r) => (
              <span key={r.term} className={`seo-chip tone-${statusTone(r.status)}`}>{r.term}</span>
            ))}
            {wholeTopicsMissing.map((t) => (
              <span key={t.name} className="seo-chip seo-chip-topic">{t.name}</span>
            ))}
          </div>
        )}
      </section>

      {/* 5 — Cover more */}
      <section className="seo-panel-block">
        <h3>Cover more</h3>
        {gapTopics.length === 0 && other.length === 0 ? (
          <p className="seo-done">All subtopics and questions covered ✓</p>
        ) : (
          <>
            {gapTopics.map((t) => (
              <div key={t.name} className="seo-cover-topic">
                <h4>{t.name}</h4>
                {t.terms_missing.length > 0 && <p>Add: {t.terms_missing.join(", ")}</p>}
                {t.questions_unanswered.length > 0 && (
                  <ul>{t.questions_unanswered.map((q) => <li key={q}>{q}</li>)}</ul>
                )}
              </div>
            ))}
            {other.length > 0 && (
              <div className="seo-cover-topic">
                <h4>Also answer</h4>
                <ul>{other.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
