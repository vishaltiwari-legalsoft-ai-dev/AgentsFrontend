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
  MR_REPORT_KINDS, apiCode, apiStatus, isBoardKind, isCampaignKind, isVendorKind,
  mrBoardReportHtml, mrBoardReportPdfUrl, mrBuildBoardReport, mrBuildReport, mrBuildVendorReport,
  mrGetBoardRun, mrGetRun, mrGetVendorRun, mrListRuns, mrReportPeriods, mrReportPdfUrl,
  mrReportTemplates, mrVendorReportHtml, mrVendorReportPdfUrl, mrVendorReportPeriods,
  type MrBoardCoverageColumn, type MrBoardReport, type MrReport, type MrReportKind,
  type MrReportPeriods, type MrRunSummary, type MrTemplateLine, type MrTemplateListing,
  type MrVendorPeriods, type MrVendorRun,
} from "@/lib/api";
import { describeFailure, loadPending, useLoadSession, type Load } from "@/lib/load";
import {
  REPORT_META, absentMetrics, boardPeriodOptions, boardPeriodValues, filledOf, missingFigures,
  periodsFor, takesPeriod, vendorBuiltLine, vendorMonthPick, visibleRuns,
} from "@/components/console/mr/reportMeta";
import { proseBlocks } from "@/components/console/mr/proseBlocks";
import { Ic } from "../../Sprite";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n } from "../../model";
import { useHub, type ToastFn } from "../../context";
import type { MrData_ } from "../MrWorkspace";
import { SourceList } from "./parts";
import { PullWorkbook, useWorkbookPull, type WorkbookPull } from "./Data";
import { ReportFrame, openReportTab } from "./reportFrame";
import { TemplatePanel, saveFile } from "./Templates";
import { clause, templateBandLine } from "./templateModel";

/** The report on screen. One slot, three readers: a campaign narrative, the
 *  board ledger and the vendor document are different shapes, and holding them
 *  in one union means opening one always closes the other two. */
type Shown =
  | { kind: "campaign"; doc: MrReport }
  | { kind: "board"; report: MrBoardReport }
  | { kind: "vendor"; run: MrVendorRun };

export function MrReports({ data, onToast }: { data: MrData_; onToast: ToastFn }) {
  const session = useLoadSession();
  const [runs, setRuns] = useState<Load<MrRunSummary[]>>(loadPending);
  // The endpoint answers two named lists, `{months, quarters}` — not a map
  // keyed by report kind. It is held as a `Load` rather than a bare value so
  // "we never found out" cannot render as "there is nothing to pick".
  const [periods, setPeriods] = useState<Load<MrReportPeriods>>(loadPending);
  // The vendor band's months, and whether it is drawn at all: the server says
  // `enabled` with the months, so a switched-off feature is never discovered
  // through a failed click. A backend too old to know the route reads as off.
  const [vendor, setVendor] = useState<Load<MrVendorPeriods>>(loadPending);
  const [vendorRetry, setVendorRetry] = useState(false);
  // The team's report template. `enabled: false` — or a backend too old to
  // have the route — hides "Change template" and the panel it opens.
  const [templates, setTemplates] = useState<Load<MrTemplateListing>>(loadPending);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const { user } = useHub();
  const me = user?.email ?? null;
  const [chosen, setChosen] = useState<Partial<Record<MrReportKind, string>>>({});
  const [shown, setShown] = useState<Shown | null>(null);
  const [opening, setOpening] = useState(false);
  const [building, setBuilding] = useState<MrReportKind | null>(null);
  const [beat, setBeat] = useState(0);
  // The pickers below have nothing to offer until the workbook has been pulled,
  // so the pull is offered where they say so. Its result re-reads the periods
  // as well as the workspace: a new pull is what puts months into them.
  const pull = useWorkbookPull({
    onToast,
    onDone: () => { data.reload(); setBeat((b) => b + 1); },
  });

  useEffect(() => {
    void session.run("mr-runs", () => mrListRuns(), setRuns,
      "The report history could not be read.", { keepStale: true });
    void session.run("mr-periods", () => mrReportPeriods(), setPeriods,
      "The months and quarters on file could not be read.", { keepStale: true });
    void session.run("mr-vendor-periods", () => mrVendorReportPeriods(), setVendor,
      "The months with vendor figures could not be read.", { keepStale: true });
    void session.run("mr-templates", () => mrReportTemplates(), setTemplates,
      "The team's template could not be read.", { keepStale: true });
  }, [session, beat]);

  useEffect(() => { if (vendor.phase !== "loading") setVendorRetry(false); }, [vendor.phase]);

  const vendorOn = vendor.data?.enabled === true;
  // Drawn when the server said on; or when we never found out (a failure is not
  // "off"); or while a retry of that failure is in flight. Never on the first
  // read, so a deployment with the switch off does not flash a band it hides.
  const vendorBand = vendorOn || (vendor.data === null
    && (vendor.phase === "failed" || (vendor.phase === "loading" && vendorRetry)));
  const retryVendor = () => { setVendorRetry(true); setVendor(loadPending); setBeat((b) => b + 1); };
  // Templates belong to the vendor report: they never show without its band.
  // On when the server says so, or when the read failed — "we never found out"
  // is not "off", so the panel opens on its own Oops rather than vanishing.
  const templatesOn = vendorOn && (templates.data?.enabled === true
    || (templates.data === null && templates.phase === "failed"));

  const list = visibleRuns(runs.data || [], vendorOn);
  // Until both reads land, an empty list is "not known yet", not "nothing written".
  const settled = runs.data !== null && vendor.phase !== "loading";
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
      if (isBoardKind(kind)) setShown({ kind: "board", report: await mrGetBoardRun(id) });
      else if (isVendorKind(kind)) setShown({ kind: "vendor", run: await mrGetVendorRun(id) });
      else setShown({ kind: "campaign", doc: await mrGetRun(id) });
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
      setShown({ kind: "campaign", doc: report });
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
  // agent hands over rather than with a list of buttons. Not before the vendor
  // switch is known: until then a newer vendor run is hidden, and the panel
  // would lead with an older report than the newest one on file.
  useEffect(() => {
    if (shown || opening || !list.length || vendor.phase === "loading") return;
    void open(list[0].id, list[0].kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, vendor.phase]);

  return (
    <>
      <PageHead
        statement={
          shown
            ? <>The report, <b>set to be sent</b>.</>
            : settled && list.length === 0
              ? <>No report has been <b>written yet</b>.</>
              : <>Reading the last report.</>
        }
        lede="A report is the thing this agent hands over, so it is laid out to be read rather than to be configured. It is a slice of the same vendors the dossiers hold — reorganising the period into ad channels would produce a second set of figures nobody could reconcile against the tabs."
      />

      {runs.phase === "failed" && !runs.data && (
        <Oops what="The report history could not be read." error={runs.error || ""} onRetry={() => setBeat((b) => b + 1)} />
      )}

      {opening && !shown && <Wait what="Opening the report" rows={6} />}

      {shown?.kind === "campaign" && <ReportDoc doc={shown.doc} data={data} />}

      {shown?.kind === "board" && <BoardDoc report={shown.report} data={data} onToast={onToast} />}

      {shown?.kind === "vendor" && (
        <VendorDoc
          run={shown.run}
          // Unknown is "ask the server": the PDF route answers 503 with its own
          // reason, so an enabled button can only fail honestly.
          pdfAvailable={vendor.data?.pdf_available !== false}
          onToast={onToast}
        />
      )}

      {!shown && !opening && settled && list.length === 0 && (
        <Blank title="Nothing written yet">
          {vendorOn
            ? "Build this month's Vendor Performance report, pick one of the ten below, or build the board report. Each is written from the last workbook pull and filed on Runs like any other piece of work."
            : "Pick one of the ten below, or build the board report. Either is written from the last workbook pull and filed on Runs like any other piece of work."}
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

      {vendorBand && (
        <VendorBuild
          load={vendor}
          pull={pull}
          disabled={opening}
          me={me}
          templatesOn={templatesOn}
          templatesOpen={templatesOpen}
          onTemplates={() => setTemplatesOpen((o) => !o)}
          onBuilt={(run) => { setShown({ kind: "vendor", run }); setBeat((b) => b + 1); }}
          onGone={() => setBeat((b) => b + 1)}
          onToast={onToast}
          onRetry={retryVendor}
        />
      )}

      {templatesOn && templatesOpen && (
        <TemplatePanel
          listing={templates}
          me={me}
          onChanged={() => setBeat((b) => b + 1)}
          onRetry={() => setBeat((b) => b + 1)}
          onClose={() => setTemplatesOpen(false)}
          onToast={onToast}
        />
      )}

      <BoardBuild
        periods={periods}
        pull={pull}
        disabled={building !== null || opening}
        onBuilt={(report) => { setShown({ kind: "board", report }); setBeat((b) => b + 1); }}
        onToast={onToast}
        onRetry={() => setBeat((b) => b + 1)}
      />

      <section className="band">
        <RuleHead
          title="The ten it can write"
          note="What each one contains."
          aside={
            <span className="aside">
              {/* The ten, not every kind on file: the board and vendor reports
                  are filed on the same rail and would otherwise be counted. */}
              {n(new Set(list.map((r) => r.kind).filter(isCampaignKind)).size)} have run
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
            : "No period holds tracker data yet, so there is none to pick — this writes the latest. Pull the workbook from the Data panel and this fills in."}
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

/* ---------------------------- vendor performance -------------------------- */

/** One month select and a button: the whole control.
 *
 *  Only months the server says hold a vendor sweep are offered, newest first
 *  and preselected. Every answer that builds nothing is chosen by its `code`:
 *  `empty_month` is calm and offers the pull; `template_failed` (409) is the
 *  team template not rendering this report, with the two ways on — build with
 *  the built-in, or change the template — and never a silent swap. Under the
 *  button, the line saying which template the team's reports use. */
function VendorBuild({
  load, pull, disabled, me, templatesOn, templatesOpen, onTemplates, onBuilt, onGone, onToast, onRetry,
}: {
  load: Load<MrVendorPeriods>;
  pull: WorkbookPull;
  disabled: boolean;
  me: string | null;
  /** Team templates are on here: "Change template" is offered. */
  templatesOn: boolean;
  templatesOpen: boolean;
  onTemplates: () => void;
  onBuilt: (run: MrVendorRun) => void;
  /** The build answered 404: the switch went off since the months were read.
   *  Re-reading the periods is what hides the band. */
  onGone: () => void;
  onToast: ToastFn;
  onRetry: () => void;
}) {
  const [chosen, setChosen] = useState("");
  const [building, setBuilding] = useState(false);
  // The answers that leave nothing built, kept apart: an empty month is the
  // server saying "no figures for that month", calm and actionable; a team
  // template that fails is its own state with its own ways on; anything else
  // is a failure and reads as one.
  const [empty, setEmpty] = useState<string | null>(null);
  const [teamFailed, setTeamFailed] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const months = load.data?.months ?? [];
  const pick = vendorMonthPick(months, chosen);
  const labelOf = (ym: string) => months.find((m) => m.year_month === ym)?.label || ym;

  const build = async (opts: { builtin?: boolean } = {}) => {
    setBuilding(true);
    setEmpty(null);
    setTeamFailed(null);
    setFailed(null);
    try {
      const run = await mrBuildVendorReport(pick || undefined, opts);
      const month = run.structured?.month_label || labelOf(pick);
      onBuilt(run);
      onToast(
        run.reused
          ? `Vendor Performance for ${month} was already built from this pull, so it is opened rather than built again.`
          : `Vendor Performance for ${month} is built and filed under Already written.`,
        "ok",
      );
    } catch (e: unknown) {
      const status = apiStatus(e);
      const code = apiCode(e);
      if (code === "template_failed") {
        setTeamFailed(`${clause(e instanceof Error ? e.message : "")
          || "The team template could not render this report"}. Nothing was built.`);
      } else if (code === "empty_month" || (code === null && status === 422)) {
        // A backend from before the codes answered every refusal 422 with no
        // code, and its only one was the empty month.
        setEmpty(describeFailure(e,
          `The last pull has no vendor figures for ${labelOf(pick)}. Pull the workbook, then build again.`));
      } else if (status === 404) {
        onToast("Vendor Performance is not switched on for this server any more. Nothing was built.", "error");
        onGone();
      } else {
        const message = describeFailure(e, "The report was not built. Nothing was filed.");
        setFailed(message);
        onToast(message, "error");
      }
    } finally {
      setBuilding(false);
    }
  };

  return (
    <section className="band">
      <RuleHead
        title="Vendor Performance"
        note="Every vendor tab for one month, set out to send. No model writes any part of it."
        aside={<span className="aside">One month</span>}
      />

      {months.length === 0 ? (
        load.phase === "loading" ? (
          <Wait what="Reading which months have vendor figures" />
        ) : load.phase === "failed" && !load.data ? (
          <Oops
            what="The months with vendor figures could not be read. This is not the same as there being none — we never found out."
            error={load.error || ""}
            onRetry={onRetry}
          />
        ) : (
          <Blank title="No month has vendor figures yet" action={<PullWorkbook pull={pull} />}>
            It's built from the vendor tabs. Pull the workbook and months appear here.
          </Blank>
        )
      ) : (
        <>
          <div className="brd">
            <label className="field" htmlFor="mr-vendor-month">
              <span>Month</span>
              <select
                id="mr-vendor-month"
                className="sel"
                value={pick}
                disabled={building}
                onChange={(e) => { setChosen(e.target.value); setEmpty(null); setFailed(null); }}
              >
                {months.map((m) => <option key={m.year_month} value={m.year_month}>{m.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--solid btn--sm"
              disabled={building || disabled || !pick}
              onClick={() => void build()}
            >
              {building ? "Building…" : "Build the report"}
            </button>
          </div>

          <p className="calm">{templateBandLine(load.data?.template ?? null, me)}</p>
          {templatesOn && (
            <p>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                aria-expanded={templatesOpen}
                aria-controls="mr-team-template"
                onClick={onTemplates}
              >
                Change template
              </button>
            </p>
          )}

          {empty && (
            <>
              <p className="calm" role="status">{empty}</p>
              <PullWorkbook pull={pull} />
            </>
          )}
          {teamFailed && (
            <Oops
              what="The team template couldn't build this report."
              error={teamFailed}
              actions={
                <>
                  <button type="button" className="btn btn--solid btn--sm" disabled={building}
                    onClick={() => void build({ builtin: true })}>
                    {building ? "Building…" : "Build with the built-in template"}
                  </button>
                  {templatesOn && (
                    <button type="button" className="btn btn--quiet btn--sm"
                      onClick={() => { if (!templatesOpen) onTemplates(); }}>
                      Change template
                    </button>
                  )}
                </>
              }
            />
          )}
          {failed && <p className="err" role="alert">{failed}</p>}
        </>
      )}
    </section>
  );
}

/** A vendor run, opened: one header line, two actions, what the page prints
 *  as a dash and why — then the report itself, in the sandboxed viewer.
 *
 *  The document is the server's HTML for the stored run, never re-derived
 *  here, so what is read on screen is what the PDF and the new tab hold. */
function VendorDoc({ run, pdfAvailable, onToast }: {
  run: MrVendorRun;
  pdfAvailable: boolean;
  onToast: ToastFn;
}) {
  const session = useLoadSession();
  const [html, setHtml] = useState<Load<string>>(loadPending);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    // A different run must never show the last one's document while it loads.
    setHtml(loadPending);
    void session.run("mr-vendor-html", () => mrVendorReportHtml(run.id).catch(gone), setHtml,
      "The report's document could not be read.");
  }, [session, run.id, beat]);

  const s = run.structured || {};
  const month = s.month_label || "";
  const title = month ? `Vendor Performance — ${month}` : "Vendor Performance";
  const gaps = missingFigures(s.missing);
  const file = `mr-vendor-report-${(run.sweep_date || s.year_month || run.id)}`
    .replace(/[^A-Za-z0-9._-]+/g, "-");

  return (
    <article className="rep rep--wide">
      <header className="rep__h">
        <p className="rep__k">{REPORT_META.vendor_report.eyebrow}</p>
        <h1>{title}</h1>
        <p className="rep__p">
          {vendorBuiltLine(run)}
          {run.reused ? " Already on file for this pull, so it was opened rather than built again." : ""}
        </p>
        <div className="ops" style={{ marginTop: 12 }}>
          <OpenInTab
            title={title}
            // The document already on screen when it is; fetched on click when not.
            read={() => (html.data !== null ? Promise.resolve(html.data) : mrVendorReportHtml(run.id))}
            onToast={onToast}
          />
          <VendorPdfButton id={run.id} name={file} available={pdfAvailable} onToast={onToast} />
        </div>
        {!pdfAvailable && (
          // No browser-printing advice here: a browser prints an iframe only as far
          // as its visible box, so that route hands over a cut-off report. The PDF
          // renderer is the fix, and deploying it is the owner's call.
          <p className="rep__n" id="mr-vendor-pdf-off">
            {"PDF downloads aren't set up on this server yet. The full report is here, or open it in a new tab to read it full-screen."}
          </p>
        )}
      </header>

      {gaps && gaps.count > 0 && (
        <section className="rep__s">
          <div className="cov">
            {/* No cause in this line: the reasons differ by row (a vendor tab
                without the figure, no target set, no roll-up to reconcile
                against), so each one is given under "Which figures, and why". */}
            <p className="cov__w">
              <b>{n(gaps.count)} {gaps.count === 1 ? "figure shows" : "figures show"}</b>
              {" as — . A dash means missing, not zero."}
            </p>
            <details className="shut">
              <summary>Which figures, and why</summary>
              <ul className="cov__miss">
                {gaps.rows.map((row, i) => <li key={i}>{row}</li>)}
              </ul>
            </details>
          </div>
        </section>
      )}

      <section className="rep__s">
        {html.phase === "failed" && html.data === null ? (
          <Oops what="The report could not be shown." error={html.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : html.data === null ? (
          <Wait what="Opening the report" rows={8} />
        ) : (
          <ReportFrame key={run.id} html={html.data} title={title} />
        )}
      </section>
    </article>
  );
}

/** A 404 from a vendor document route: the switch is off, or the deployment
 *  predates it. Said in words rather than as FastAPI's bare "Not Found". */
function gone(e: unknown): never {
  if (apiStatus(e) === 404) {
    throw new Error("This server is not serving Vendor Performance reports right now — the feature is switched off here, or this deployment predates it.");
  }
  throw e;
}

/** The PDF, saved as a file. Disabled with a sentence under it when the server
 *  says PDF export is not set up; when it is, a 503 still comes back in the
 *  server's own words. */
function VendorPdfButton({ id, name, available, onToast }: {
  id: string;
  name: string;
  available: boolean;
  onToast: ToastFn;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      disabled={busy || !available}
      aria-describedby={available ? undefined : "mr-vendor-pdf-off"}
      onClick={async () => {
        setBusy(true);
        try {
          saveFile(await mrVendorReportPdfUrl(id).catch(gone), `${name}.pdf`);
        } catch (e: unknown) {
          onToast(describeFailure(e, "The PDF could not be prepared."), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Ic name="download" />
      {busy ? "Preparing the PDF…" : "Download the PDF"}
    </button>
  );
}

/** "Open in a new tab", for every report this panel holds as HTML.
 *
 *  The tab is opened before the `await` — after one, the browser no longer
 *  counts the click and blocks it as a popup — and is then filled with the
 *  report inside the same sandboxed iframe as the inline viewer. It is never a
 *  `blob:` URL: one of those runs the report in this origin, beside the login
 *  token. */
function OpenInTab({ title, read, onToast }: {
  title: string;
  read: () => Promise<string>;
  onToast: ToastFn;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      disabled={busy}
      onClick={async () => {
        const tab = openReportTab(title);
        if (!tab) {
          onToast("Your browser blocked the new tab. Allow pop-ups for this site, then try again.", "error");
          return;
        }
        setBusy(true);
        try {
          tab.show(await read());
        } catch (e: unknown) {
          tab.close();
          onToast(
            apiStatus(e) === 404
              ? "This server has no document for this report — its document route is not live here yet."
              : describeFailure(e, "The report could not be opened."),
            "error",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Ic name="external" />
      {busy ? "Opening…" : "Open in a new tab"}
    </button>
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
function BoardBuild({ periods, pull, disabled, onBuilt, onToast, onRetry }: {
  periods: Load<MrReportPeriods>;
  /** The workspace's pull — offered here when there is no period to build for. */
  pull: WorkbookPull;
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
          <Blank
            title="No period holds tracker figures yet"
            action={<PullWorkbook pull={pull} />}
          >
            A board report is the roll-up tab totalled over a window, so it needs a window with
            figures in it. Pull the team's workbook data and this fills in.
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
          <OpenInTab
            title={`${meta?.label || "Board Report"}${(s.columns || []).length ? ` — ${(s.columns || []).join(" vs ")}` : ""}`}
            read={() => mrBoardReportHtml(report.id)}
            onToast={onToast}
          />
          <BoardPdfButton id={report.id} name={fileName} onToast={onToast} />
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

/** The board report's PDF, saved as a file. The endpoint is authenticated, so
 *  the bytes are fetched with the caller's token and handed over as an object
 *  URL — a plain link would arrive without one and 401. Its HTML opens through
 *  `OpenInTab`, in the sandboxed viewer, like every other report document. */
function BoardPdfButton({ id, name, onToast }: {
  id: string;
  /** What the saved file is called. A run id is no name for something that
   *  gets attached to an email, so the periods name it. */
  name: string;
  onToast: ToastFn;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          saveFile(await mrBoardReportPdfUrl(id), `${name}.pdf`);
        } catch (e: unknown) {
          onToast(
            apiStatus(e) === 404
              ? "This deployment has no PDF of the board report — the document routes are not live here yet. The figures above are what it holds."
              : describeFailure(e, "The PDF could not be fetched."),
            "error",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Ic name="download" />
      {busy ? "Fetching…" : "Download the PDF"}
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
