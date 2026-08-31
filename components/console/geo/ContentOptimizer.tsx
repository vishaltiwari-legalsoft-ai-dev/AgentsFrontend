"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  geoPageCheck, geoPageCheckGet, geoPageCheckRescore, geoPageChecks,
  type OptimizerAnalysis, type OptimizerIndexRow, type OptimizerReport,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { describeFailure, loadPending, useLoadSession, type Load } from "@/lib/load";
import { useReportWork } from "@/lib/work";

/** Content Optimizer — score a draft against what actually ranks today.
 *  Calm-UI contract: one question up front (the keyword), score + max three
 *  actions as the hero, everything else behind disclosure. The score is a
 *  pattern-match to current winners, and the UI says so. */

const FEATURE_LABELS: Record<string, string> = {
  word_count: "Words",
  h2_count: "H2 headings",
  h3_count: "H3 headings",
  paragraph_count: "Paragraphs",
  avg_sentence_len: "Avg sentence length",
  image_count: "Images",
  list_count: "Lists",
  table_count: "Tables",
  question_headings: "Question headings",
  numeric_density: "Numbers per 100 words",
};

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1);

export function ContentOptimizer({ brandId, onToast }: { brandId: string; onToast: ToastFn }) {
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<OptimizerAnalysis | null>(null);
  const [history, setHistory] = useState<Load<OptimizerIndexRow[]>>(loadPending);

  const session = useLoadSession();
  useReportWork(busy);

  /** Was `.catch(() => undefined)`: a failed read left `history` at `[]` and
   *  the list below simply did not render, so a user whose past analyses were
   *  unreachable was shown a screen that says they have none — and the only way
   *  out of it is to pay for a fresh SERP sweep. */
  const loadHistory = useCallback(() => {
    void session.run(
      "history",
      async () => (await geoPageChecks(brandId)).analyses,
      setHistory,
      "Couldn't load your past analyses",
    );
  }, [session, brandId]);

  useEffect(loadHistory, [loadHistory]);

  async function analyze() {
    if (!keyword.trim() || busy) return;
    setBusy(true);
    try {
      const res = await geoPageCheck(brandId, { keyword: keyword.trim(), draft });
      setDoc(res);
      loadHistory();
    } catch (e) {
      onToast(describeFailure(e, "Analysis failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function rescore() {
    if (!doc || !draft.trim() || busy) return;
    setBusy(true);
    try {
      const report = await geoPageCheckRescore(brandId, doc.meta.analysis_id, { draft });
      setDoc({ ...doc, last_report: report });
      onToast("Re-scored against the same snapshot — same corpus, honest comparison.");
    } catch (e) {
      onToast(describeFailure(e, "Re-score failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(id: string) {
    const attempt = session.begin("analysis");
    setBusy(true);
    try {
      const res = await geoPageCheckGet(brandId, id);
      if (!attempt.current()) return; // a newer chip owns the panel
      setDoc(res);
      setKeyword(res.meta.keyword);
    } catch (e) {
      const message = attempt.failure(e, "Could not load analysis");
      if (message) onToast(message, "error");
    } finally {
      if (attempt.current()) setBusy(false);
    }
  }

  const report: OptimizerReport | undefined = doc?.last_report;
  const meta = doc?.meta;
  const snapshotDay = meta?.created_at?.slice(0, 10) ?? "";

  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Content Optimizer</h2>
        <span className="mr-panel__sub">
          What should this page look like to compete for a keyword — profiled from today&apos;s winners.
        </span>
      </div>

      <div className="opt-form">
        <input
          className="opt-form__kw"
          value={keyword}
          placeholder='Target keyword — e.g. "how to make cold brew coffee"'
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void analyze()}
          disabled={busy}
        />
        <button className="seo-btn seo-btn--primary" onClick={() => void analyze()} disabled={busy || !keyword.trim()}>
          {busy ? "Working…" : doc ? "Fresh analysis" : "Analyze"}
        </button>
      </div>
      <details className="opt-draftbox" open={!!draft}>
        <summary>Paste your draft (optional) — get a score and a gap list</summary>
        <textarea
          value={draft}
          placeholder="Markdown or plain text. Leave empty to just get the winners' profile."
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        {doc && draft.trim() && (
          <button className="seo-btn" onClick={() => void rescore()} disabled={busy}>
            Re-score against this snapshot
          </button>
        )}
      </details>

      {busy && !doc && (
        <div className="geo-progress">Reading the top results for this keyword — usually under a minute…</div>
      )}

      {!doc && (history.data?.length ?? 0) > 0 && (
        <div className="mr-section">
          <h3 className="mr-section__title">Recent analyses</h3>
          <div className="geo-competitors">
            {(history.data ?? []).slice(0, 8).map((h) => (
              <button key={h.id} className="seo-chip opt-history" onClick={() => void openHistory(h.id)}>
                {h.keyword}{h.score !== null ? ` · ${h.score}/100` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Not "you have no past analyses" — a failed read, said out loud, with
          the retry that costs nothing next to the Analyze button that costs a
          SERP sweep. */}
      {!doc && history.phase === "failed" && !history.data && (
        <div className="mr-section">
          <h3 className="mr-section__title">Recent analyses</h3>
          <p className="geo-note">
            Couldn&apos;t load your past analyses — {history.error}. They still exist; this is a
            failed read, so a fresh analysis is not the fix.{" "}
            <button className="seo-btn" onClick={loadHistory}>Try again</button>
          </p>
        </div>
      )}

      {doc && meta && (
        <>
          {meta.warnings.map((w) => (
            <div key={w} className="geo-progress geo-progress--warn">{w}</div>
          ))}

          <div className="geo-hero">
            <div className="geo-hero__big">
              {report ? `${report.total}/100` : `${meta.n_docs} winners profiled`}
            </div>
            <p className="geo-hero__story">
              {report
                ? `Your draft vs the top ${meta.n_docs} pages for “${meta.keyword}”. Winners score a median of ${report.winners_median ?? "—"} on the same yardstick.`
                : `Profile of the top ${meta.n_docs} pages for “${meta.keyword}” — paste a draft above to get scored.`}
              {" "}Snapshot {snapshotDay} · {meta.locale} · SERP {meta.volatility === "volatile" ? "volatile — advice has a short shelf life" : meta.volatility}
              {meta.aio_present ? " · AI Overview present on this SERP" : ""}
            </p>
            <div className="geo-hero__ops">
              {(report
                ? report.gaps.slice(0, 3).map((g) => g.message)
                : doc.subtopics.slice(0, 3).map((s) => `Cover: ${s.suggested_heading}`)
              ).map((text) => (
                <div key={text} className="opt-action">
                  <Icon name="target" size={16} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {report && (
            <div className="opt-subscores">
              <span className="seo-chip">Terms {Math.round(report.term_coverage * 100)}%</span>
              <span className="seo-chip">
                Meaning {report.semantic_coverage === null ? "n/a (no embedding key)" : `${Math.round(report.semantic_coverage * 100)}%`}
              </span>
              <span className="seo-chip">Structure {Math.round(report.structure_fit * 100)}%</span>
              {report.stuffing_penalty > 0 && (
                <span className="seo-chip seo-chip--off">−{report.stuffing_penalty} stuffing</span>
              )}
            </div>
          )}

          {report && report.subtopic_coverage.length > 0 && (
            <details className="opt-details">
              <summary>Topic coverage ({report.subtopic_coverage.filter((s) => s.covered).length}/{report.subtopic_coverage.length} covered)</summary>
              {report.subtopic_coverage.map((s) => (
                <div key={s.label} className={`opt-sub${s.covered ? " opt-sub--ok" : ""}`}>
                  <Icon name={s.covered ? "check" : "plus"} size={14} />
                  <span>{s.label}</span>
                  {s.covered && s.evidence && <em title={s.evidence}>covered</em>}
                </div>
              ))}
            </details>
          )}

          <details className="opt-details">
            <summary>Terms winners use ({doc.term_profile.filter((t) => !t.brand).length})</summary>
            <table className="geo-table">
              <thead><tr><th>Term</th><th>Typical use</th><th>In your draft</th></tr></thead>
              <tbody>
                {doc.term_profile.filter((t) => !t.brand).slice(0, 15).map((t) => (
                  <tr key={t.term}>
                    <td>{t.display}</td>
                    <td>{t.range[0] === t.range[1] ? `${t.range[0]}×` : `${t.range[0]}–${t.range[1]}×`}{t.confidence === "low" ? " (low confidence)" : ""}</td>
                    <td>{report ? `${report.draft_term_counts[t.term] ?? 0}×` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {doc.term_profile.some((t) => t.brand) && (
              <p className="geo-note">
                Brand names winners mention (your call, never auto-recommended):{" "}
                {doc.term_profile.filter((t) => t.brand).map((t) => t.display).join(", ")}
              </p>
            )}
          </details>

          <details className="opt-details">
            <summary>Structure targets</summary>
            <table className="geo-table">
              <thead><tr><th>Feature</th><th>Winners</th><th>Your draft</th></tr></thead>
              <tbody>
                {Object.values(doc.structure_bands)
                  .filter((b) => FEATURE_LABELS[b.feature])
                  .map((b) => (
                    <tr key={b.feature}>
                      <td>{FEATURE_LABELS[b.feature]}</td>
                      <td>
                        {b.kind === "modes" && b.modes
                          ? `either ~${fmt(b.modes[0])} or ~${fmt(b.modes[1])}`
                          : `${fmt(b.lo)}–${fmt(b.hi)}`}
                        {b.confidence !== "high" ? ` (${b.confidence} confidence, n=${b.n})` : ""}
                      </td>
                      <td>{report ? fmt(report.draft_features[b.feature]) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>

          <details className="opt-details">
            <summary>Sources read ({doc.results.length} results)</summary>
            {doc.results.map((r) => (
              <div key={r.url} className="opt-src">
                <span className="opt-src__rank">#{r.rank}</span>
                <a href={r.url} target="_blank" rel="noreferrer">{r.title || r.url}</a>
                {r.page_type !== "article" && <span className="seo-chip">{r.page_type}</span>}
                {r.excluded && <span className="seo-chip seo-chip--off">{r.excluded}</span>}
                {r.flags.includes("thin") && <span className="seo-chip seo-chip--off">paywalled/thin</span>}
              </div>
            ))}
          </details>

          <p className="geo-note">{doc.disclaimer}</p>
        </>
      )}
    </div>
  );
}
