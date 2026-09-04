"use client";

/** A report is the thing this agent hands over, so it is set to be sent.
 *
 *  The ten kinds it can write are listed with what each one contains **on the
 *  page**. In the app being replaced that sentence sits in a `title` attribute
 *  on the button, so on a touch screen there is no way to read it at all.
 *
 *  Building one spends a model call, so the button says so before it is pressed
 *  rather than after.
 */

import { useCallback, useEffect, useState } from "react";
import {
  MR_REPORT_KINDS, apiStatus, isBoardKind, mrBoardReportHtmlUrl, mrBoardReportPdfUrl,
  mrBuildBoardReport, mrBuildReport, mrGetBoardRun, mrGetRun, mrListRuns, mrReportPeriods,
  mrReportPdfUrl,
  type MrBoardCoverageColumn, type MrBoardReport, type MrReport, type MrReportKind,
  type MrReportPeriods, type MrRunSummary,
} from "@/lib/api";
import { describeFailure, loadPending, useLoadSession, type Load } from "@/lib/load";
import {
  REPORT_META, absentMetrics, boardPeriodOptions, boardPeriodValues, filledOf, periodsFor,
  takesPeriod,
} from "@/components/console/mr/reportMeta";
import { proseBlocks } from "@/components/console/mr/proseBlocks";
import { Ic } from "../../Sprite";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n } from "../../model";
import type { ToastFn } from "../../context";
import type { MrData_ } from "../MrWorkspace";
import { SourceList } from "./parts";

export function MrReports({ data, onToast }: { data: MrData_; onToast: ToastFn }) {
  const session = useLoadSession();
  const [runs, setRuns] = useState<Load<MrRunSummary[]>>(loadPending);
  // The endpoint answers two named lists, `{months, quarters}` — not a map
  // keyed by report kind. It is held as a `Load` rather than a bare value so
  // "we never found out" cannot render as "there is nothing to pick".
  const [periods, setPeriods] = useState<Load<MrReportPeriods>>(loadPending);
  const [chosen, setChosen] = useState<Partial<Record<MrReportKind, string>>>({});
  const [doc, setDoc] = useState<MrReport | null>(null);
  // The board report is the other thing this rail files, and it is not a
  // narrative: it has two columns, no markdown, and a coverage block instead.
  // Held apart from `doc` so neither reader is ever handed the other's shape.
  const [board, setBoard] = useState<MrBoardReport | null>(null);
  const [opening, setOpening] = useState(false);
  const [building, setBuilding] = useState<MrReportKind | null>(null);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    void session.run("mr-runs", () => mrListRuns(), setRuns,
      "The report history could not be read.", { keepStale: true });
    void session.run("mr-periods", () => mrReportPeriods(), setPeriods,
      "The months and quarters on file could not be read.", { keepStale: true });
  }, [session, beat]);

  const list = runs.data || [];
  const lastOf = (kind: MrReportKind) => list.find((r) => r.kind === kind) || null;

  /** The period a build goes out with: what the picker is showing — its own
   *  choice, or the newest period, which is what the picker defaults to. */
  const periodOf = useCallback((kind: MrReportKind) => {
    const offered = periodsFor(kind, periods.data);
    const picked = chosen[kind];
    return (picked && offered.some((p) => p.period === picked) ? picked : offered[0]?.period);
  }, [periods.data, chosen]);

  /** Open one filed run. The listing carries the kind, and the kind is what
   *  picks the reader: a board run has no narrative to render and a campaign
   *  run has no ledger, so reading either through the other's shape would print
   *  an empty document rather than say so. */
  const open = useCallback(async (id: string, kind: MrRunSummary["kind"]) => {
    setOpening(true);
    try {
      if (isBoardKind(kind)) {
        setBoard(await mrGetBoardRun(id));
        setDoc(null);
      } else {
        setDoc(await mrGetRun(id));
        setBoard(null);
      }
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "That report could not be opened.", "error");
    } finally {
      setOpening(false);
    }
  }, [onToast]);

  const build = useCallback(async (kind: MrReportKind) => {
    setBuilding(kind);
    onToast(`${REPORT_META[kind].label} is being written from the last pull.`, "ok");
    try {
      const report = await mrBuildReport(kind, periodOf(kind));
      setDoc(report);
      setBoard(null);
      setBeat((b) => b + 1);
      onToast(`${REPORT_META[kind].label} is written. It is also filed on Runs.`, "ok");
    } catch (e: unknown) {
      // A report that did not get written must never look like one that did.
      onToast(e instanceof Error ? e.message : "That report was not written. Nothing was filed.", "error");
    } finally {
      setBuilding(null);
    }
  }, [onToast, periodOf]);

  // Open the newest report on arrival, so the panel leads with the thing the
  // agent hands over rather than with a list of buttons.
  useEffect(() => {
    if (doc || board || opening || !list.length) return;
    void open(list[0].id, list[0].kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <>
      <PageHead
        statement={
          doc || board
            ? <>The report, <b>set to be sent</b>.</>
            : list.length === 0
              ? <>No report has been <b>written yet</b>.</>
              : <>Reading the last report.</>
        }
        lede="A report is the thing this agent hands over, so it is laid out to be read rather than to be configured. It is a slice of the same vendors the dossiers hold — reorganising the period into ad channels would produce a second set of figures nobody could reconcile against the tabs."
      />

      {runs.phase === "failed" && !runs.data && (
        <Oops what="The report history could not be read." error={runs.error || ""} onRetry={() => setBeat((b) => b + 1)} />
      )}

      {opening && !doc && !board && <Wait what="Opening the report" rows={6} />}

      {doc && <ReportDoc doc={doc} data={data} />}

      {board && <BoardDoc report={board} data={data} onToast={onToast} />}

      {!doc && !board && !opening && list.length === 0 && (
        <Blank title="Nothing written yet">
          Pick one of the ten below, or build the board report. Either is written from the last
          workbook pull and filed on Runs like any other piece of work.
        </Blank>
      )}

      {list.length > 0 && (
        <section className="band">
          <RuleHead
            title="Already written"
            note="Opening one costs nothing — it is read back from where it was filed."
            aside={<span className="aside">{n(list.length)} on file</span>}
          />
          <div className="tw">
            <table className="rt">
              <thead><tr><th>Report</th><th>Period</th><th>Written</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    <td><b>{REPORT_META[r.kind]?.label || r.kind}</b></td>
                    <td className="dim">{r.period || "—"}</td>
                    <td className="dim">{new Date(r.generated_at).toLocaleString()}</td>
                    <td>
                      <button type="button" className="btn btn--quiet btn--sm" onClick={() => void open(r.id, r.kind)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <BoardBuild
        periods={periods}
        disabled={building !== null || opening}
        onBuilt={(report) => { setBoard(report); setDoc(null); setBeat((b) => b + 1); }}
        onToast={onToast}
        onRetry={() => setBeat((b) => b + 1)}
      />

      <section className="band">
        <RuleHead
          title="The ten it can write"
          note="What each one contains, on the page. In the app being replaced this sits in a title attribute on the button, so on a touch screen there is no way to read it at all."
          aside={
            <span className="aside">
              {/* The ten, not every kind on file: the board report is filed on
                  the same rail and would otherwise be counted as one of them. */}
              {n(new Set(list.map((r) => r.kind).filter((k) => !isBoardKind(k))).size)} have run
            </span>
          }
        />
        <ul className="kinds">
          {MR_REPORT_KINDS.map((kind) => {
            const meta = REPORT_META[kind];
            const last = lastOf(kind);
            return (
              <li className={`kind${last ? "" : " is-never"}`} key={kind}>
                <div className="kind__b">
                  <p className="kind__n">{meta.label}</p>
                  <p className="kind__w">{meta.desc}</p>
                  {takesPeriod(kind) && (
                    <PeriodPick
                      kind={kind}
                      periods={periods}
                      value={periodOf(kind) || ""}
                      onPick={(period) => setChosen((c) => ({ ...c, [kind]: period }))}
                    />
                  )}
                </div>
                <span className="kind__when">{meta.eyebrow}</span>
                <span className="kind__last">
                  {last ? `Last ${new Date(last.generated_at).toLocaleDateString()}` : "Never run"}
                </span>
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  onClick={() => void build(kind)}
                  disabled={building !== null}
                  title="Writing one spends a model call and files a run."
                >
                  {building === kind ? "Writing…" : "Write one"}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="help" style={{ marginTop: 14 }}>
          Writing a report spends a model call and files a run on the record. Nothing here is
          cached from a previous write — each one reads the workbook as it stands now.
        </p>
      </section>
    </>
  );
}

/** Which month or quarter the monthly/quarterly report is written for.
 *
 *  Only the periods the tracker actually holds are offered, newest first, so a
 *  pick can never ask for a window the workbook has no rows in (the backend
 *  answers 422 for one, and it must never be a silently substituted month).
 *  An empty list says so in words: "no period" and "we could not read the
 *  periods" are different sentences, and neither is a picker rendered blank. */
function PeriodPick({ kind, periods, value, onPick }: {
  kind: MrReportKind;
  periods: Load<MrReportPeriods>;
  value: string;
  onPick: (period: string) => void;
}) {
  const offered = periodsFor(kind, periods.data);
  const id = `mr-period-${kind}`;

  if (offered.length === 0) {
    return (
      <p className="kind__w" style={{ marginTop: 7 }}>
        {periods.phase === "loading"
          ? "Reading which periods hold data…"
          : periods.phase === "failed"
            ? "The periods on file could not be read, so there is none to pick — this writes the latest."
            : "No period holds tracker data yet, so there is none to pick — this writes the latest."}
      </p>
    );
  }

  return (
    <p style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label className="kind__when" htmlFor={id}>Period</label>
      <select
        id={id}
        className="sel"
        style={{ width: "auto", minWidth: 148, minHeight: 30, padding: "4px 9px" }}
        value={value}
        onChange={(e) => onPick(e.target.value)}
      >
        {offered.map((p) => (
          <option key={p.period} value={p.period}>{p.label}{p.current ? " (so far)" : ""}</option>
        ))}
      </select>
    </p>
  );
}

/* ------------------------------- board report ----------------------------- */

/** Two period selects and a button, which is the whole control.
 *
 *  The ledger's columns are only **column A** and **column B** — the marketing
 *  team's template happened to hold two quarters, but nothing in the report
 *  knows that. So month-against-month, quarter-against-quarter and
 *  year-against-year are one control rather than three, and leaving B empty is
 *  not a different feature: it is the one-column report.
 *
 *  A period is required here, unlike the campaign picker next door. The
 *  backend has no "latest" for this — an empty window is a 422 and it says
 *  which window it refused — so with nothing to pick the button does not go
 *  out at all.
 */
function BoardBuild({ periods, disabled, onBuilt, onToast, onRetry }: {
  periods: Load<MrReportPeriods>;
  disabled: boolean;
  onBuilt: (report: MrBoardReport) => void;
  onToast: ToastFn;
  onRetry: () => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [building, setBuilding] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const groups = boardPeriodOptions(periods.data);
  const offered = boardPeriodValues(groups);
  // A pick holds only while the period it names is still on offer. After a
  // re-read that drops one, A falls back to the newest period and B falls back
  // to none — never to a neighbouring window the reader did not ask for.
  const pickA = a && offered.includes(a) ? a : offered[0] || "";
  const pickB = b && offered.includes(b) ? b : "";
  // The backend refuses two identical columns, and it is right to: a column
  // compared with itself prints a delta of zeros, which is a claim nobody made.
  const twice = pickB !== "" && pickB === pickA;

  const build = useCallback(async (period: string, compareTo: string) => {
    setBuilding(true);
    setRefused(null);
    try {
      const report = await mrBuildBoardReport(period, compareTo || undefined);
      onBuilt(report);
      onToast(
        report.reused
          ? "That board report was already on file for this pull — it is opened above, not rebuilt."
          : "The board report is built. It is also filed on Runs.",
        "ok",
      );
    } catch (e: unknown) {
      // Three different answers, kept apart. 404 is the deployment saying it
      // does not build these at all; 422 is the server naming the window it
      // refused, in its own words, which are the only true ones here; anything
      // else is a failure and says so. None of them leaves a report on screen.
      const message = apiStatus(e) === 404
        ? "This backend does not build board reports — the feature is switched off, or the deployment predates it. Nothing was built and no run was filed."
        : describeFailure(e, "The board report was not built. Nothing was filed.");
      setRefused(message);
      onToast(message, "error");
    } finally {
      setBuilding(false);
    }
  }, [onBuilt, onToast]);

  const select = (
    id: string, label: string, value: string, onPick: (v: string) => void, none?: string,
  ) => (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        className="sel"
        value={value}
        disabled={building}
        onChange={(e) => { onPick(e.target.value); setRefused(null); }}
      >
        {none && <option value="">{none}</option>}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((p) => (
              <option key={p.period} value={p.period}>{p.label}{p.current ? " (so far)" : ""}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  return (
    <section className="band">
      <RuleHead
        title="The board report"
        note="The roll-up tab's own ledger — one period, or two side by side with the movement between them. No model writes any part of it, so nothing in it can disagree with the sheet."
        aside={<span className="aside">Two columns, or one</span>}
      />

      {groups.length === 0 ? (
        periods.phase === "loading" ? (
          <Wait what="Reading which periods hold figures" rows={2} />
        ) : periods.phase === "failed" ? (
          <Oops
            what="The periods on file could not be read, so there is nothing to build a board report for. This is not the same as the tracker holding no periods — we never found out."
            error={periods.error || ""}
            onRetry={onRetry}
          />
        ) : (
          <Blank title="No period holds tracker figures yet">
            A board report is the roll-up tab totalled over a window, so it needs a window with
            figures in it. Pull the workbook on Data and this fills in.
          </Blank>
        )
      ) : (
        <>
          <div className="brd">
            {select("mr-board-a", "Period A", pickA, setA)}
            {select("mr-board-b", "Compared with (optional)", pickB, setB, "— nothing, one column only —")}
            <button
              type="button"
              className="btn btn--solid btn--sm"
              disabled={building || disabled || !pickA || twice}
              onClick={() => void build(pickA, pickB)}
              title="Builds from the last workbook pull and files a run."
            >
              {building ? "Building…" : pickB ? "Build both columns" : "Build one column"}
            </button>
          </div>

          <p className="calm">
            Both columns read the same list, because they are only column A and column B — a month
            against a month and a year against a year are the same request. A year means all twelve
            of its months; the ones the sheet has no rows for are named in the report rather than
            summed around. Building costs no model call, and asking twice for the same window of the
            same pull returns the report already on file instead of deriving it again.
          </p>

          {twice && (
            <p className="err" role="alert">
              Column B has to be a different period from column A — a column compared with itself
              would print a row of zero movement nobody claimed.
            </p>
          )}
          {refused && !twice && <p className="err" role="alert">{refused}</p>}
        </>
      )}
    </section>
  );
}

/** The board report as the panel holds it: what it could fill, what it could
 *  not, and the two documents it can be handed over as.
 *
 *  The ledger itself is the document's job. What belongs here is the thing a
 *  reader cannot get from the document — how much of the board this particular
 *  pull was able to answer. */
function BoardDoc({ report, data, onToast }: {
  report: MrBoardReport;
  data: MrData_;
  onToast: ToastFn;
}) {
  const meta = REPORT_META[report.kind];
  const s = report.structured;
  const columns = s.coverage?.columns ?? [];
  const captured = (s.captured_on || "").slice(0, 10);
  // The periods name the file, so a saved PDF is identifiable on a desktop.
  const fileName = ["mr-board-report", ...(s.periods || []).map((p) => p.key)]
    .join("-").replace(/[^A-Za-z0-9._-]+/g, "-") || `mr-board-report-${report.id}`;

  return (
    <article className="rep">
      <header className="rep__h">
        <p className="rep__k">{meta?.eyebrow || report.kind}</p>
        <h1>{meta?.label || report.kind}</h1>
        <p className="rep__p">
          <b>{(s.columns || []).join("   vs   ") || "One period"}</b>
          {`Built ${new Date(report.generated_at).toLocaleString()}`}
          {captured
            ? ` — from the workbook as it was pulled on ${new Date(`${captured}T00:00:00`).toLocaleDateString()}.`
            : " — from the last workbook pull."}
          {report.reused ? " Already on file for that pull, so it was read back rather than derived again." : ""}
        </p>
        <div className="ops" style={{ marginTop: 12 }}>
          <BoardDocButton id={report.id} what="html" name={fileName} onToast={onToast} />
          <BoardDocButton id={report.id} what="pdf" name={fileName} onToast={onToast} />
        </div>
      </header>

      <section className="rep__s">
        <h2><i>01</i>How much of the board this pull could fill</h2>
        {columns.length === 0 ? (
          <p className="calm">
            This report carried no coverage block, so how much of the board it filled is not
            something we can tell you from here — not a claim that it filled all of it. Open the
            document to see which rows carry a figure.
          </p>
        ) : (
          columns.map((c) => <Coverage key={`${c.column}-${c.period}`} column={c} rows={s.rows || []} />)
        )}
        {s.coverage?.channel_reconciliation && (
          <p className="rep__n">
            There is no channel table in this report. {s.coverage.channel_reconciliation}
          </p>
        )}
      </section>

      {(s.gaps || []).length > 0 && (
        <section className="rep__s">
          <h2><i>02</i>Totals the roll-up withheld</h2>
          <p className="calm">
            A field reported in two months of three is not two thirds of a period, it is an unknown
            period — so the total is withheld and the months it was missing for are named.
          </p>
          <ul className="cov__miss">
            {(s.gaps || []).map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </section>
      )}

      <section className="rep__s">
        <h2><i>0{(s.gaps || []).length > 0 ? 3 : 2}</i>Where every number came from</h2>
        <SourceList sources={report.sources || data.overview.sources} />
        {/* `ai: false` on this kind is the design, not a degradation, so the
            reason is printed as the report gives it rather than dressed up. */}
        <p className="rep__n">
          {`This report is not model-written: ${report.fallback_reason
            || "the board report is the roll-up tab's own figures — no model writes any part of it"}. `}
          Every figure is the tracker workbook, so nothing in it is newer than the last sheet pull.
        </p>
      </section>
    </article>
  );
}

/** One column's fill, and the metrics it has no figure for.
 *
 *  The number this prints is the one that separates a thin *capture* from a
 *  thin *period*: against production today the report fills 13 of 38, because
 *  the pull on file predates the roll-up parser learning the other rows — the
 *  quarter is not empty, the capture is. So the count is never printed alone,
 *  and every absent metric can be read by name with the reason the backend
 *  gave for it. Absent is never zero. */
function Coverage({ column, rows }: { column: MrBoardCoverageColumn; rows: MrBoardReport["structured"]["rows"] }) {
  const { filled, of } = filledOf(column);
  const missing = absentMetrics(column, rows);

  return (
    <div className="cov">
      <p className="cov__n">
        <b>{n(filled)} of {n(of)}</b> metrics filled
        <span className="tag"> {column.column}</span>
      </p>
      {missing.length === 0 ? (
        <p className="cov__w">Every metric on the board carries a figure for this period.</p>
      ) : (
        <>
          <p className="cov__w">
            The other {n(missing.length)} are <b>absent, not zero</b> — the pull on file does not
            report them for this period. A fresh workbook pull is what moves this number, not a
            different window.
          </p>
          <details className="shut">
            <summary>Which {n(missing.length)} are missing, and why</summary>
            <ul className="cov__miss">
              {missing.map((m) => (
                <li key={m.key}>
                  <b>{m.label}</b>
                  {m.group ? <span className="tag"> {m.group}</span> : null}
                  <em> — {m.reason}</em>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

/** The board report as a file. Both endpoints are authenticated, so the bytes
 *  are fetched with the caller's token and handed over as an object URL — a
 *  plain link to either would arrive without one and 401. The HTML opens in a
 *  tab; the PDF is saved, because it is the thing that gets attached to an
 *  email. */
function BoardDocButton({ id, what, name, onToast }: {
  id: string;
  what: "html" | "pdf";
  /** What the saved file is called. A run id is no name for something that
   *  gets attached to an email, so the periods name it. */
  name: string;
  onToast: ToastFn;
}) {
  const [busy, setBusy] = useState(false);
  const label = what === "html" ? "View the HTML" : "Download the PDF";

  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (what === "html") {
            window.open(await mrBoardReportHtmlUrl(id), "_blank", "noopener");
          } else {
            const link = document.createElement("a");
            link.href = await mrBoardReportPdfUrl(id);
            link.download = `${name}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
        } catch (e: unknown) {
          onToast(
            apiStatus(e) === 404
              ? `This deployment has no ${what.toUpperCase()} of the board report — the document routes are not live here yet. The figures above are what it holds.`
              : describeFailure(e, `The ${what.toUpperCase()} could not be fetched.`),
            "error",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Ic name={what === "html" ? "pages" : "download"} />
      {busy ? "Fetching…" : label}
    </button>
  );
}

function ReportDoc({ doc, data }: { doc: MrReport; data: MrData_ }) {
  const meta = REPORT_META[doc.kind];
  const blocks = proseBlocks(doc.markdown || "");

  return (
    <article className="rep">
      <header className="rep__h">
        <p className="rep__k">{meta?.eyebrow || doc.kind}</p>
        <h1>{meta?.label || doc.kind}</h1>
        <p className="rep__p">
          <b>Written {new Date(doc.generated_at).toLocaleString()}</b>
          {" — from the workbook as it stood at that moment."}
        </p>
        <div className="ops" style={{ marginTop: 12 }}>
          {/* The PDF is fetched with the caller's token and handed over as an
              object URL — an <a href> to the endpoint would arrive unauthenticated. */}
          <PdfButton id={doc.id} />
        </div>
      </header>

      <section className="rep__s">
        <h2><i>01</i>What it says</h2>
        {blocks.length === 0 ? (
          <p className="calm">This report was filed with no written body — only its figures.</p>
        ) : (
          blocks.map((b, i) => {
            if (b.kind === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
            if (b.kind === "table") {
              return (
                <div className="tw" key={i}>
                  <table className="rt">
                    <tbody>
                      {b.rows.map((row, j) => (
                        <tr key={j}>{row.map((c, k) => <td key={k}>{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return <p key={i}>{b.text}</p>;
          })
        )}
      </section>

      <section className="rep__s">
        <h2><i>02</i>Where every number came from</h2>
        <SourceList sources={doc.sources || data.overview.sources} />
        <p className="rep__n">
          Every figure above is the tracker workbook — there is no advertising API behind this
          agent, so nothing in it is newer than the last sheet pull.
        </p>
      </section>
    </article>
  );
}

/** The report as a file. The endpoint is authenticated, so the bytes are
 *  fetched with the caller's token and handed over as an object URL rather than
 *  linked to directly — a plain href would arrive without one and 401. */
function PdfButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const url = await mrReportPdfUrl(id);
          window.open(url, "_blank", "noopener");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Ic name="download" />
      {busy ? "Fetching…" : "Open the PDF"}
    </button>
  );
}
