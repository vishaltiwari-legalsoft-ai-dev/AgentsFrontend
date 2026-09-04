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
  MR_REPORT_KINDS, mrBuildReport, mrGetRun, mrListRuns, mrReportPeriods, mrReportPdfUrl,
  type MrReport, type MrReportKind, type MrReportPeriods, type MrRunSummary,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { REPORT_META, periodsFor, takesPeriod } from "@/components/console/mr/reportMeta";
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

  const open = useCallback(async (id: string) => {
    setOpening(true);
    try {
      setDoc(await mrGetRun(id));
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
    if (doc || opening || !list.length) return;
    void open(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <>
      <PageHead
        statement={
          doc
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

      {opening && !doc && <Wait what="Opening the report" rows={6} />}

      {doc && <ReportDoc doc={doc} data={data} />}

      {!doc && !opening && list.length === 0 && (
        <Blank title="Nothing written yet">
          Pick one of the ten below. It is written from the last workbook pull and filed on Runs
          like any other piece of work.
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
                      <button type="button" className="btn btn--quiet btn--sm" onClick={() => void open(r.id)}>
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

      <section className="band">
        <RuleHead
          title="The ten it can write"
          note="What each one contains, on the page. In the app being replaced this sits in a title attribute on the button, so on a touch screen there is no way to read it at all."
          aside={<span className="aside">{n(new Set(list.map((r) => r.kind)).size)} have run</span>}
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
