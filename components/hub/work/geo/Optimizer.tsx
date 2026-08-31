"use client";

/** Will publishing this page help — or fight a page you already have?
 *
 *  Paste a link to a new blog post or page (or the draft itself) and this
 *  checks it against the pages that already win its topic, then against your
 *  own site: a plain verdict with reasons, the overlap (cannibalization) read
 *  with its evidence, pros and cons, and the raw numbers demoted to a
 *  collapsed section underneath.
 *
 *  Two honesty rules carry the panel. A check spends a live search snapshot,
 *  and the form says so before the button is pressed. And an overlap risk of
 *  "unknown" renders as *not checked* — wording it as safe would be the exact
 *  lie the verdict exists to prevent.
 */

import { useEffect, useState } from "react";
import {
  geoPageCheck, geoPageCheckGet, geoPageCheckRescore, geoPageChecks,
  type GeoPageCheckBlock, type GeoPageCheckDoc, type OptimizerIndexRow, type OptimizerReport,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { PageHead, RuleHead, Oops, Wait } from "../../ui";
import { n } from "../../model";
import type { ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import { Figure, Figures, Gauge } from "./parts";
import {
  confidenceWords, evidenceWhere, kindWords, querySourceWords, riskIsKnown,
  riskSentence, shortUrl, sortCons, verdictParts,
} from "./pageCheckWords";

const pctOf = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x)}`;

const dateWords = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "long" });

export function GeoOptimizer({ data, onToast }: { data: GeoData; onToast: ToastFn }) {
  const session = useLoadSession();
  const [index, setIndex] = useState<Load<OptimizerIndexRow[]>>(loadPending);
  const [doc, setDoc] = useState<GeoPageCheckDoc | null>(null);
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [running, setRunning] = useState<"check" | "rescore" | null>(null);
  /** Client-side validation, rendered inline at the form. */
  const [formErr, setFormErr] = useState<string | null>(null);
  /** A backend refusal (422 bad input / 503 search key missing / 404 unknown
   *  check) — the message is user-readable and shown verbatim. */
  const [runErr, setRunErr] = useState<{ what: string; msg: string } | null>(null);
  /** Numbers arrived from a rescore, so they are fresher than the verdict. */
  const [rescored, setRescored] = useState(false);
  const [numsOpen, setNumsOpen] = useState(false);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    void session.run(
      "geo-opt-index",
      (s) => geoPageChecks(data.brandId, { signal: s }).then((r) => r.analyses),
      setIndex,
      "The earlier checks could not be read.",
      { keepStale: true },
    );
  }, [session, data.brandId, beat]);

  const arrive = (d: GeoPageCheckDoc, fresh: boolean) => {
    setDoc(d);
    setRescored(false);
    // A doc without a page_check block predates verdicts: the numbers are all
    // it has, so they open rather than hiding behind an empty hero.
    setNumsOpen(!d.page_check);
    if (fresh) setBeat((b) => b + 1);
  };

  const open = async (id: string) => {
    setFormErr(null);
    setRunErr(null);
    try {
      arrive(await geoPageCheckGet(data.brandId, id), false);
    } catch (e: unknown) {
      setRunErr({
        what: "That check could not be opened.",
        msg: e instanceof Error ? e.message : "Unknown error.",
      });
    }
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    const d = draft.trim();
    if (u && d) {
      setFormErr("One at a time — clear either the link or the draft. A check reads exactly one page.");
      return;
    }
    if (!u && !d) {
      setFormErr("Paste a link to your page — or open the draft section and paste the text.");
      return;
    }
    setFormErr(null);
    setRunErr(null);
    setRunning("check");
    try {
      const res = await geoPageCheck(data.brandId, {
        url: u || undefined,
        draft: d || undefined,
        keyword: keyword.trim() || undefined,
      });
      arrive(res, true);
      const q = res.page_check?.target_query;
      onToast(
        q
          ? `Checked against ${n(res.meta.n_docs)} pages ranking for “${q}”.`
          : `Read ${n(res.meta.n_docs)} ranking pages.`,
        "ok",
      );
    } catch (e2: unknown) {
      setRunErr({
        what: "The page could not be checked.",
        msg: e2 instanceof Error ? e2.message : "The check did not run. Nothing was stored.",
      });
    } finally {
      setRunning(null);
    }
  };

  const rescore = async () => {
    if (!doc) return;
    const text = draft.trim();
    if (!text) {
      setDraftOpen(true);
      setFormErr("Paste your edited draft in the draft box to score it.");
      return;
    }
    setFormErr(null);
    setRunErr(null);
    setRunning("rescore");
    try {
      // The snapshot is pinned by id and free to score against: two drafts
      // scored against different search results are not comparable.
      const fresh = await geoPageCheckRescore(data.brandId, doc.meta.analysis_id, { draft: text });
      setDoc({ ...doc, last_report: fresh });
      setRescored(true);
      setNumsOpen(true);
      onToast("Scored against the same snapshot — like for like. Overlap was not re-checked.", "ok");
    } catch (e: unknown) {
      setRunErr({
        what: "The draft could not be scored.",
        msg: e instanceof Error ? e.message : "Unknown error.",
      });
    } finally {
      setRunning(null);
    }
  };

  const pc = doc?.page_check;
  // Rescoring only makes sense when a draft is what was checked. Docs from
  // before page checks existed were all keyword+draft runs, so they qualify.
  const isDraftCheck = doc != null && (pc ? pc.source_url === "" : true);

  return (
    <>
      <PageHead
        statement={<>Will this page <b>help</b> — or fight one you already have?</>}
        lede="Paste a link to a new blog post or page. This reads today's winning results for its topic, weighs your page against them, and checks whether it would overlap a page your site already ranks with. Each check spends one live search snapshot."
      />

      <div className="optg">
        <form onSubmit={check}>
          <label className="field">
            <span>Page URL</span>
            <input
              className="inp"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (formErr) setFormErr(null); }}
              placeholder="https://yoursite.com/blog/new-post"
            />
            <span className="hint">Paste the link to your new blog post or page.</span>
          </label>

          <details
            className="shut"
            open={draftOpen}
            onToggle={(e) => setDraftOpen(e.currentTarget.open)}
            style={{ margin: "0 0 var(--s4)" }}
          >
            <summary>…or paste a draft instead</summary>
            <label className="field" style={{ marginTop: "var(--s3)" }}>
              <span>Your draft</span>
              <textarea
                className="inp"
                rows={8}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (formErr) setFormErr(null); }}
                placeholder="Paste markdown or plain text."
              />
              <span className="hint">A check reads one thing — a link or a draft, not both.</span>
            </label>
          </details>

          <label className="field">
            <span>Target search phrase <span className="opt">(optional)</span></span>
            <input
              className="inp"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="bilingual legal intake"
            />
            <span className="hint">Leave empty and we&rsquo;ll take it from the page title.</span>
          </label>

          {formErr && <p className="err" role="alert" style={{ margin: "0 0 var(--s4)" }}>{formErr}</p>}

          <button type="submit" className="btn btn--solid" disabled={running !== null}>
            {running === "check" ? "Taking a live search snapshot…" : "Check this page"}
          </button>
          {isDraftCheck && (
            <>
              <button
                type="button"
                className="btn btn--quiet"
                style={{ marginTop: 8, width: "100%" }}
                onClick={rescore}
                disabled={running !== null}
              >
                {running === "rescore" ? "Scoring…" : "Score my edited draft"}
              </button>
              <p className="help" style={{ marginTop: 6 }}>
                Free — it re-uses the snapshot from the original check, so before/after scores are
                comparable. Overlap is not re-checked.
              </p>
            </>
          )}

          {index.data && index.data.length > 0 && (
            <div style={{ marginTop: "var(--s5)" }}>
              <RuleHead title="Earlier checks" note="Re-opening one costs nothing." />
              <ul className="listy">
                {index.data.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <label>
                      <button type="button" className="linky" onClick={() => void open(r.id)}>
                        {r.source_url ? shortUrl(r.source_url, 40) : r.keyword}
                      </button>
                    </label>
                    <span className={`n${r.verdict === "likely cannibalizes" ? " miss" : ""}`}>
                      {r.verdict || `${n(r.n_docs)} pages`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {index.phase === "failed" && !index.data && (
            <div style={{ marginTop: "var(--s5)" }}>
              <Oops what="The earlier checks could not be listed." error={index.error || ""} onRetry={() => setBeat((b) => b + 1)} />
            </div>
          )}
          {index.phase === "loading" && !index.data && (
            <div style={{ marginTop: "var(--s5)" }}>
              <Wait what="Looking for earlier checks" />
            </div>
          )}
        </form>

        <div>
          {runErr && (
            <div style={{ marginBottom: "var(--s4)" }}>
              <Oops what={runErr.what} error={runErr.msg} />
            </div>
          )}

          {running === "check" ? (
            <>
              <Wait what="Taking a live search snapshot and reading the winning pages" />
              <div className="skeleton" aria-live="polite"><i /><i /><i /><i /></div>
            </>
          ) : !doc ? (
            <div className="empty">
              <h4>No page checked yet</h4>
              <p>
                Paste a link to a new blog post or page on the left. You get a plain verdict — will
                it help, does it need work, or does it fight a page you already have — with the
                reasons, the overlap evidence, and the numbers behind it.
              </p>
            </div>
          ) : pc ? (
            <>
              <VerdictHero doc={doc} pc={pc} />
              <Cannibalization pc={pc} />
              <ProsCons pc={pc} />

              <details
                className="shut"
                open={numsOpen}
                onToggle={(e) => setNumsOpen(e.currentTarget.open)}
              >
                <summary>The numbers</summary>
                <div style={{ marginTop: "var(--s4)" }}>
                  {rescored && (
                    <p className="help" style={{ marginBottom: "var(--s4)" }}>
                      Re-scored against the original snapshot — like for like. The verdict and
                      overlap read above are from the original check and were not re-run.
                    </p>
                  )}
                  <Numbers doc={doc} isDraft={pc.source_url === ""} />
                </div>
              </details>

              <p className="soon-note">{pc.disclaimer}</p>
            </>
          ) : (
            <>
              <RuleHead
                title={`${n(doc.meta.n_docs)} pages engines cite for “${doc.meta.keyword}”`}
                note="This check predates verdicts — run it again to get a helps/hurts read and the overlap check."
              />
              {rescored && (
                <p className="help" style={{ marginBottom: "var(--s4)" }}>
                  Re-scored against the original snapshot — like for like.
                </p>
              )}
              <Numbers doc={doc} isDraft />
              <p className="soon-note">{doc.disclaimer}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- the verdict -- */

function VerdictHero({ doc, pc }: { doc: GeoPageCheckDoc; pc: GeoPageCheckBlock }) {
  const v = pc.verdict;
  const parts = verdictParts(v.label);
  const conf = confidenceWords(v.confidence);
  const source = querySourceWords(pc.target_query_source);
  return (
    <section className="band verdict" data-verdict={v.label}>
      <p className="statement">
        {parts.before}
        {parts.mark && <b>{parts.mark}</b>}
        {parts.after}
        {conf && <span className="opt"> — {conf}</span>}
      </p>
      <p className="help" style={{ marginTop: 8 }}>
        Measured for &ldquo;{pc.target_query}&rdquo;{source ? ` — ${source}` : ""} ·{" "}
        {n(doc.meta.n_docs)} ranking pages read {dateWords(pc.checked_at)}
        {doc.meta.degraded.length > 0 ? ` · read with ${doc.meta.degraded.join(", ")} unavailable` : ""}
      </p>
      {doc.meta.warnings.length > 0 && (
        <p className="help" style={{ marginTop: 4 }}>{doc.meta.warnings.join(" ")}</p>
      )}
      {pc.page_flags.length > 0 && (
        <p style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 0" }}>
          {pc.page_flags.map((f) => <span className="tag" key={f}>{f}</span>)}
        </p>
      )}
      {v.reasons.length > 0 && (
        <ul className="listy" style={{ marginTop: "var(--s4)" }}>
          {v.reasons.map((r, i) => (
            <li key={i}><label>{r}</label></li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- the overlap -- */

function Cannibalization({ pc }: { pc: GeoPageCheckBlock }) {
  const c = pc.cannibalization;
  return (
    <section className="band">
      <RuleHead title="Overlap with your own pages" note={riskSentence(c.risk)} />
      {c.evidence.length > 0 && (
        <table className="tbl">
          <thead>
            <tr><th>Seen in</th><th>Page</th><th>What overlaps</th></tr>
          </thead>
          <tbody>
            {c.evidence.map((ev, i) => (
              <tr key={i}>
                <td><span className="tag">{evidenceWhere(ev.kind)}</span></td>
                <td>
                  {ev.url
                    ? <a href={ev.url} target="_blank" rel="noreferrer">{shortUrl(ev.url, 42)}</a>
                    : "—"}
                </td>
                <td>{ev.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {c.note && (
        <p className={riskIsKnown(c.risk) ? "help" : "calm"} style={{ marginTop: "var(--s3)" }}>
          {c.note}
        </p>
      )}
      {!riskIsKnown(c.risk) && !c.note && (
        <p className="calm">Site analysis has not run — overlap could not be checked.</p>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- pros and cons -- */

function ProsCons({ pc }: { pc: GeoPageCheckBlock }) {
  const cons = sortCons(pc.cons);
  return (
    <div className="procon">
      <section className="band">
        <RuleHead title="Working for it" note="Where it already matches the pages that win." />
        {pc.pros.length > 0 ? (
          <ul className="listy">
            {pc.pros.slice(0, 12).map((p, i) => (
              <li key={i}><label><span className="tag">{kindWords(p.kind)}</span>{p.message}</label></li>
            ))}
          </ul>
        ) : (
          <p className="calm">Nothing stood out in its favor yet.</p>
        )}
      </section>
      <section className="band">
        <RuleHead title="Working against it" note="Ordered by what fixing is worth." />
        {cons.length > 0 ? (
          <ul className="listy">
            {cons.slice(0, 12).map((c, i) => (
              <li key={i}><label><span className="tag">{kindWords(c.kind)}</span>{c.message}</label></li>
            ))}
          </ul>
        ) : (
          <p className="calm">Nothing against it was found.</p>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------- the demoted score machinery -- */

function Numbers({ doc, isDraft }: { doc: GeoPageCheckDoc; isDraft: boolean }) {
  const report: OptimizerReport | undefined = doc.last_report;
  return (
    <>
      {report ? (
        <>
          <Figures>
            <Figure value={pctOf(report.total)} title={isDraft ? "Your draft" : "Your page"}>
              out of 100, against a winning median of {pctOf(report.winners_median)}
            </Figure>
            <Figure value={pctOf(report.term_coverage)} title="Terms covered">
              of the vocabulary these pages share
            </Figure>
            <Figure value={pctOf(report.structure_fit)} title="Shape">
              how closely it matches their structure
            </Figure>
          </Figures>
          <Gauge fill={(report.total || 0) / 100} />

          {report.strengths && report.strengths.length > 0 && (
            <section className="band">
              <RuleHead title="What it already does right" note="Kept through an edit, these survive a rescore." />
              <ul className="listy">
                {report.strengths.slice(0, 12).map((s, i) => (
                  <li key={i}><label><span className="tag">{kindWords(s.kind)}</span>{s.message}</label></li>
                ))}
              </ul>
            </section>
          )}

          {report.gaps.length > 0 && (
            <section className="band">
              <RuleHead title="What it is missing" note="Ordered by what closing it is worth." />
              <ul className="listy">
                {report.gaps.slice(0, 12).map((g, i) => (
                  <li key={i}>
                    <label><span className="tag">{kindWords(g.kind)}</span>{g.message}</label>
                    <span className="n miss">missing</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="calm">
          Nothing has been scored against these winners yet. Paste a draft on the left and score it —
          the comparison uses exactly these pages, so it is like for like.
        </p>
      )}

      <section className="band">
        <RuleHead
          title="The shape the winners share"
          note="A band measured on too few pages is a coincidence, not a benchmark — so each one carries its confidence."
        />
        <table className="tbl">
          <thead>
            <tr><th>Feature</th><th className="num">Typical range</th><th className="num">Pages</th><th>Confidence</th></tr>
          </thead>
          <tbody>
            {Object.entries(doc.structure_bands).map(([key, b]) => (
              <tr key={key}>
                <td><b>{b.feature}</b>{b.note && <span className="opt" style={{ display: "block", fontSize: 11 }}>{b.note}</span>}</td>
                <td className="num">
                  {b.lo != null && b.hi != null
                    ? `${b.lo}–${b.hi}`
                    : b.median != null ? String(b.median) : "—"}
                </td>
                <td className="num">{n(b.n)}</td>
                <td>{b.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {doc.subtopics.length > 0 && (
        <section className="band">
          <RuleHead title="What they all cover" note="Suggested as headings, in the words the winning pages use." />
          <ul className="listy">
            {doc.subtopics.slice(0, 10).map((s, i) => (
              <li key={i}>
                <label>{s.suggested_heading}</label>
                <span className="n">{n(s.doc_idxs.length)} pages</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
