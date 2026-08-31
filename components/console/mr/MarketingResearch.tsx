"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mrAddSource, mrConfig, mrConnectors, mrDatasets, mrDeleteDataset, mrDeleteSource,
  mrIngest, mrIngestPdf, mrIngestSheet, mrListRuns, mrOverview, mrSnapshots,
  mrSources, mrWorkbook, mrWorkbookScan,
  type MrConfig, type MrConnector, type MrDataset, type MrOverview, type MrPlatform,
  type MrRunSummary, type MrSheetSource, type MrSheetSources, type MrSnapshotMeta,
  type MrTabProfile,
} from "@/lib/api";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  describeFailure, failuresOf, LIVE_REFRESH_MS, loadJob, loadPending, loadReady,
  useLoadSession, type Load, type LoadJob,
} from "@/lib/load";
import { Button, Icon, Tabs } from "@/lib/kit-ui";
import { AskView } from "./AskView";
import { DataView } from "./DataView";
import { LeadsView } from "./LeadsView";
import { OverviewView } from "./OverviewView";
import { ReportsView } from "./ReportsView";
import { VendorsView } from "./VendorsView";

export type MrView = "overview" | "leads" | "ask" | "reports" | "vendors" | "data";

/* The load-state module that used to live here is now `lib/load.ts`.
 *
 *  It was pure, dependency-free and exported — and imported by exactly nothing
 *  outside this folder, because reaching it meant importing a 545-line `.tsx`
 *  and dragging React and six child components in with it. Twenty modules
 *  hand-rolled a worse version instead. The code did not need rewriting; it
 *  needed to be reachable.
 */

/* ------------------------------ Failure views ----------------------------- */

/** The view has nothing true to show. Same shape as the dossier error state in
 *  `VendorsView` so a failure looks the same wherever it happens. */
function LoadError({ title, error, hint, onRetry }: {
  title: string;
  error: string;
  hint?: string;
  onRetry: () => void;
}) {
  return (
    <div className="mr-panel">
      <div className="mr-empty">
        <strong>{title}</strong>
        <div>{error}</div>
        {hint && <div style={{ marginTop: 6 }}>{hint}</div>}
        <div style={{ marginTop: 10 }}>
          <Button size="sm" variant="secondary" onClick={onRetry}
            iconLeft={<Icon name="refresh-cw" size={13} />}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The view still works but part of it is missing. Says so above the view so
 *  the gaps inside it are not read as zeroes. */
function LoadNotice({ failures, onRetry }: {
  failures: { label: string; error: string }[];
  onRetry: () => void;
}) {
  if (failures.length === 0) return null;
  return (
    <div className="mr-panel" style={{ marginBottom: 16 }}>
      <div className="mr-empty">
        <strong>
          {failures.length === 1
            ? `${failures[0].label} didn't load.`
            : `${failures.length} sections didn't load.`}
        </strong>
        {failures.map((f) => <div key={f.label}>{f.label} — {f.error}</div>)}
        <div style={{ marginTop: 6 }}>
          What&rsquo;s missing below is missing because of this, not because it is empty.
        </div>
        <div style={{ marginTop: 10 }}>
          <Button size="sm" variant="secondary" onClick={onRetry}
            iconLeft={<Icon name="refresh-cw" size={13} />}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MarketingResearch({ onToast, onBack }: { onToast: ToastFn; onBack: () => void }) {
  const [view, setView] = useState<MrView>("overview");
  const [seed, setSeed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const [overview, setOverview] = useState<Load<MrOverview>>(loadPending);
  const [datasets, setDatasets] = useState<Load<MrDataset[]>>(loadPending);
  const [runs, setRuns] = useState<Load<MrRunSummary[]>>(loadPending);
  const [connectors, setConnectors] = useState<Load<MrConnector[]>>(loadPending);
  const [config, setConfig] = useState<Load<MrConfig>>(loadPending);
  const [catalog, setCatalog] = useState<Load<MrTabProfile[]>>(loadPending);
  const [snapshots, setSnapshots] = useState<Load<MrSnapshotMeta[]>>(loadPending);
  const [sheetSources, setSheetSources] = useState<Load<MrSheetSources>>(loadPending);

  /** Held in a ref so every loader below keeps a stable identity — a toast prop
   *  that changed between renders would re-run the mount effect and refetch the
   *  whole screen. Same reason `VendorsView` holds its toast this way. */
  const toast = useRef(onToast);
  useEffect(() => { toast.current = onToast; }, [onToast]);
  const announce = useCallback<ToastFn>((msg, tone) => toast.current(msg, tone), []);

  const session = useLoadSession();

  /** `useState` setters are stable, so these are built once. */
  const jobs = useMemo(() => ({
    overview: loadJob("Dashboard", mrOverview, setOverview, "Couldn't load the dashboard"),
    datasets: loadJob("Files", mrDatasets, setDatasets, "Couldn't load the file list"),
    runs: loadJob("Report history", mrListRuns, setRuns, "Couldn't load the report history"),
    snapshots: loadJob("Vendor snapshots", mrSnapshots, setSnapshots, "Couldn't load the vendor snapshots"),
    // Passing the signal through rather than the bare function: `mrConnectors`
    // now takes request options, and a job that ignores them cannot be aborted
    // when the view is left.
    connectors: loadJob("Connectors", (signal) => mrConnectors({ signal }), setConnectors, "Couldn't load the connectors"),
    config: loadJob("Settings", async () => {
      const c = await mrConfig();
      setYear((y) => y ?? c.year);
      return c;
    }, setConfig, "Couldn't load the configuration"),
    catalog: loadJob("Workbook tabs", async () => (await mrWorkbook()).tabs,
      setCatalog, "Couldn't read the workbook"),
    sources: loadJob("Connected sheets", mrSources, setSheetSources, "Couldn't load the connected sheets"),
  }), []);

  /** Each group is one slot, so its own repeat supersedes it — the 3-minute
   *  poll firing while the last one is still in flight no longer has two
   *  answers racing into the same four states. */
  const group = useCallback((slot: string, batch: readonly LoadJob[],
                             opts: { background?: boolean } = {}) =>
    session.runGroup(slot, batch, { ...opts, toast: announce, subject: "Marketing Research" }),
    [session, announce]);

  /** The numbers the dashboard is made of. */
  const loadCore = useCallback((opts: { background?: boolean } = {}) =>
    group("core", [jobs.overview, jobs.datasets, jobs.runs, jobs.snapshots], opts), [group, jobs]);

  /** What the Data tab is made of — connectors, settings, workbook, sources. */
  const loadSetup = useCallback((opts: { background?: boolean } = {}) =>
    group("setup", [jobs.connectors, jobs.config, jobs.catalog, jobs.sources], opts), [group, jobs]);

  /** Re-read what a connect/disconnect just changed. */
  const loadSheets = useCallback(() =>
    group("sheets", [jobs.sources, jobs.catalog]), [group, jobs]);

  const refresh = useCallback(() => loadCore(), [loadCore]);
  const retryAll = useCallback(() => { void loadCore(); void loadSetup(); }, [loadCore, loadSetup]);

  useEffect(() => {
    void loadCore();
    void loadSetup();
  }, [loadCore, loadSetup]);

  // Near-real-time dashboard: the cloud pull refreshes the data every 3
  // minutes, so an open console silently re-reads on the same cadence.
  // Background failures stay quiet — no error toasts for a missed poll — but
  // they are still recorded, so a poll can never turn a failed load back into
  // an innocent-looking empty screen.
  useEffect(() => {
    const id = window.setInterval(() => { void loadCore({ background: true }); }, LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadCore]);

  async function pullSheet() {
    setBusy(true);
    try {
      const res = await mrIngestSheet(year ? { year } : {});
      const total = res.tabs.reduce((n, t) => n + (t.metrics ?? 0), 0);
      const errs = res.tabs.filter((t) => t.error).length;
      // A degraded pull kept PREVIOUS data for at least one component, so the
      // board is now showing figures that did not come from this read. Saying
      // "Pulled 0 monthly rows" in the success voice is how that went unnoticed
      // for a month — the reason the backend sends comes first now.
      const degraded = res.degraded ?? [];
      if (degraded.length) onToast(degraded[0], "warn");
      else if (errs) onToast(`Pulled ${total} rows · ${errs} error(s)`, "warn");
      else onToast(`Pulled ${total} monthly rows from the live tracker`);
      await refresh();
    } catch (e) {
      onToast(describeFailure(e, "Sheet pull failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCsv(file: File, platform: MrPlatform) {
    setBusy(true);
    try {
      const res = await mrIngest(file, platform);
      if (res.gaps.length) onToast(`Ingested with gaps: ${res.gaps[0].message}`, "warn");
      else onToast(`Ingested ${res.metrics} rows / ${res.leads} leads`);
      await refresh();
    } catch (e) {
      onToast(describeFailure(e, "Upload failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdf(file: File) {
    setBusy(true);
    try {
      const res = await mrIngestPdf(file);
      if (res.gaps.length) onToast(`PDF stored — ${res.gaps[0].message}`, "warn");
      else onToast(`Parsed ${res.metrics} metric rows from the PDF`);
      await refresh();
    } catch (e) {
      onToast(describeFailure(e, "PDF upload failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeDataset(d: MrDataset) {
    if (!window.confirm("Remove this file? Its numbers leave the dashboard and future reports.")) return;
    setBusy(true);
    try {
      await mrDeleteDataset(d.id);
      onToast("File removed");
      await refresh();
    } catch (e) {
      onToast(describeFailure(e, "Remove failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function addSheet(url: string) {
    setBusy(true);
    try {
      const res = await mrAddSource(url);
      const n = res.tabs.length || res.tab_count;
      onToast(`"${res.source.label}" connected — the agent understood ${n} tab${n === 1 ? "" : "s"}. Ask away.`);
      // The sheet is connected either way; if the re-read fails the list below
      // is stale, and `loadSheets` says so rather than showing it as gospel.
      await loadSheets();
    } catch (e) {
      onToast(describeFailure(e, "Could not connect that sheet"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeSheet(s: MrSheetSource) {
    if (!window.confirm(`Disconnect "${s.label}"? The agent stops reading it immediately.`)) return;
    setBusy(true);
    try {
      await mrDeleteSource(s.id);
      onToast("Sheet disconnected");
      await loadSheets();
    } catch (e) {
      onToast(describeFailure(e, "Disconnect failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function deepScan() {
    setBusy(true);
    onToast("Profiling every tab with the LLM…");
    try {
      const w = await mrWorkbookScan();
      setCatalog(loadReady(w.tabs));
      onToast(`Understood ${w.count} tabs`);
    } catch (e) {
      // The catalog already on screen came from a good `mrWorkbook()` read and
      // is still true, so the load is not marked failed — only the scan failed,
      // and the toast is what says so.
      onToast(describeFailure(e, "Scan failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  function askFromAnywhere(q: string) {
    setSeed(q);
    setView("ask");
  }

  const snapshotList = snapshots.data ?? [];
  const runList = runs.data ?? [];
  const datasetList = datasets.data ?? [];

  const vendorCount = new Set(snapshotList.map((s) => s.vendor_slug)).size;
  // A count is a claim. A failed load has no count, so the tab carries no badge
  // rather than a confident zero.
  const navItems = [
    { value: "overview", label: "Overview" },
    { value: "leads", label: "Leads", count: overview.data?.lead_quality?.totals.booked || undefined },
    { value: "ask", label: "Ask" },
    { value: "reports", label: "Reports", count: runList.length || undefined },
    { value: "vendors", label: "Vendors", count: vendorCount || undefined },
    { value: "data", label: "Data", count: datasetList.length || undefined },
  ];

  const dataFailures = failuresOf([
    { label: "Files", load: datasets },
    { label: "Vendor snapshots", load: snapshots },
    { label: "Connectors", load: connectors },
    { label: "Settings", load: config },
    { label: "Workbook tabs", load: catalog },
    { label: "Connected sheets", load: sheetSources },
  ]);

  return (
    <div className="mr-app">
      <header className="mr-top">
        <button className="mr-top__back" onClick={onBack} aria-label="Back to agents">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="mr-top__id">
          <span className="mr-top__name">Marketing Research</span>
          <span className="mr-top__sub">Campaign, competitor, funnel & opportunity intelligence</span>
        </div>
        <Tabs items={navItems} value={view} onChange={(v) => setView(v as MrView)} />
      </header>

      <div className="mr-body">
        {/* Overview reads `overview === null` as "still loading" and waits for
            ever, so a failed load is answered here instead of handed down. */}
        {view === "overview" && (
          overview.phase === "failed" && !overview.data ? (
            <LoadError
              title="Couldn't load the dashboard."
              error={overview.error ?? ""}
              onRetry={() => void loadCore()}
            />
          ) : (
            <OverviewView
              overview={overview.data}
              busy={busy}
              onPull={pullSheet}
              onGotoData={() => setView("data")}
              onToast={onToast}
            />
          )
        )}
        {view === "leads" && <LeadsView onGotoData={() => setView("data")} onToast={onToast} />}
        {view === "ask" && <AskView seed={seed} onSeedConsumed={() => setSeed(null)} onToast={onToast} />}
        {/* The history is missing, but generating a report still works — so the
            tab is annotated, not replaced. */}
        {view === "reports" && (
          <>
            <LoadNotice
              failures={failuresOf([{ label: "Report history", load: runs }])}
              onRetry={() => void loadCore()}
            />
            <ReportsView runs={runList} onRunsChanged={refresh} onToast={onToast} />
          </>
        )}
        {/* VendorsView renders "No vendor snapshots yet — hit Snapshot now" for
            an empty list. That sentence is only true once the load has actually
            come back empty; otherwise it invites a second action that fails the
            same way. */}
        {view === "vendors" && (
          snapshotList.length > 0 ? (
            <>
              <LoadNotice
                failures={failuresOf([{ label: "Vendor snapshots", load: snapshots }])}
                onRetry={() => void loadCore()}
              />
              <VendorsView snapshots={snapshotList} onToast={onToast} />
            </>
          ) : snapshots.phase === "failed" ? (
            <LoadError
              title="Couldn't load the vendor snapshots."
              error={snapshots.error ?? ""}
              hint="The snapshots may well exist — this is a failed read, not an empty dashboard, so taking a new snapshot won't fix it."
              onRetry={() => void loadCore()}
            />
          ) : snapshots.phase === "loading" ? (
            <div className="mr-panel"><div className="mr-empty">Loading vendor snapshots…</div></div>
          ) : (
            <VendorsView snapshots={snapshotList} onToast={onToast} />
          )
        )}
        {view === "data" && (
          <>
            <LoadNotice failures={dataFailures} onRetry={retryAll} />
            <DataView
              datasets={datasetList}
              snapshots={snapshotList}
              connectors={connectors.data ?? []}
              config={config.data}
              catalog={catalog.data ?? []}
              sheetSources={sheetSources.data}
              busy={busy}
              year={year}
              onYear={setYear}
              onPull={pullSheet}
              onUpload={uploadCsv}
              onUploadPdf={uploadPdf}
              onRemove={removeDataset}
              onScan={deepScan}
              onAddSheet={addSheet}
              onRemoveSheet={removeSheet}
              onToast={onToast}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default MarketingResearch;
