"use client";

import { useCallback, useEffect, useState } from "react";
import {
  mrConfig, mrConnectors, mrDatasets, mrDeleteDataset, mrIngest, mrIngestPdf,
  mrIngestSheet, mrListRuns, mrOverview, mrSnapshots, mrWorkbook, mrWorkbookScan,
  type MrConfig, type MrConnector, type MrDataset, type MrOverview,
  type MrPlatform, type MrRunSummary, type MrSnapshotMeta, type MrTabProfile,
} from "@/lib/api";
import { Icon, Tabs } from "@/lib/kit-ui";
import { AskView } from "./AskView";
import { DataView } from "./DataView";
import { OverviewView } from "./OverviewView";
import { ReportsView } from "./ReportsView";
import { VendorsView } from "./VendorsView";

export type MrView = "overview" | "ask" | "reports" | "vendors" | "data";

export function MarketingResearch({ onToast, onBack }: { onToast: (m: string) => void; onBack: () => void }) {
  const [view, setView] = useState<MrView>("overview");
  const [seed, setSeed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const [overview, setOverview] = useState<MrOverview | null>(null);
  const [datasets, setDatasets] = useState<MrDataset[]>([]);
  const [runs, setRuns] = useState<MrRunSummary[]>([]);
  const [connectors, setConnectors] = useState<MrConnector[]>([]);
  const [config, setConfig] = useState<MrConfig | null>(null);
  const [catalog, setCatalog] = useState<MrTabProfile[]>([]);
  const [snapshots, setSnapshots] = useState<MrSnapshotMeta[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [ov, ds, rs] = await Promise.all([mrOverview(), mrDatasets(), mrListRuns()]);
      setOverview(ov);
      setDatasets(ds);
      setRuns(rs);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to load");
    }
    mrSnapshots().then(setSnapshots).catch(() => {});
  }, [onToast]);

  useEffect(() => {
    void refresh();
    mrConnectors().then(setConnectors).catch(() => {});
    mrConfig().then((c) => {
      setConfig(c);
      setYear((y) => y ?? c.year);
    }).catch(() => {});
    mrWorkbook().then((w) => setCatalog(w.tabs)).catch(() => {});
  }, [refresh]);

  async function pullSheet() {
    setBusy(true);
    try {
      const res = await mrIngestSheet(year ? { year } : {});
      const total = res.tabs.reduce((n, t) => n + (t.metrics ?? 0), 0);
      const errs = res.tabs.filter((t) => t.error).length;
      onToast(errs ? `Pulled ${total} rows · ${errs} error(s)` : `Pulled ${total} monthly rows from the live tracker`);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Sheet pull failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCsv(file: File, platform: MrPlatform) {
    setBusy(true);
    try {
      const res = await mrIngest(file, platform);
      onToast(res.gaps.length ? `Ingested with gaps: ${res.gaps[0].message}` : `Ingested ${res.metrics} rows / ${res.leads} leads`);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdf(file: File) {
    setBusy(true);
    try {
      const res = await mrIngestPdf(file);
      onToast(res.gaps.length ? `PDF stored — ${res.gaps[0].message}` : `Parsed ${res.metrics} metric rows from the PDF`);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "PDF upload failed");
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
      onToast(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function deepScan() {
    setBusy(true);
    onToast("Profiling every tab with the LLM…");
    try {
      const w = await mrWorkbookScan();
      setCatalog(w.tabs);
      onToast(`Understood ${w.count} tabs`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  function askFromAnywhere(q: string) {
    setSeed(q);
    setView("ask");
  }

  const vendorCount = new Set(snapshots.map((s) => s.vendor_slug)).size;
  const navItems = [
    { value: "overview", label: "Overview" },
    { value: "ask", label: "Ask" },
    { value: "reports", label: "Reports", count: runs.length || undefined },
    { value: "vendors", label: "Vendors", count: vendorCount || undefined },
    { value: "data", label: "Data", count: datasets.length || undefined },
  ];

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
        {view === "overview" && (
          <OverviewView
            overview={overview}
            busy={busy}
            onPull={pullSheet}
            onGotoData={() => setView("data")}
            onToast={onToast}
          />
        )}
        {view === "ask" && <AskView seed={seed} onSeedConsumed={() => setSeed(null)} onToast={onToast} />}
        {view === "reports" && <ReportsView runs={runs} onRunsChanged={refresh} onToast={onToast} />}
        {view === "vendors" && <VendorsView snapshots={snapshots} onToast={onToast} />}
        {view === "data" && (
          <DataView
            datasets={datasets}
            snapshots={snapshots}
            connectors={connectors}
            config={config}
            catalog={catalog}
            busy={busy}
            year={year}
            onYear={setYear}
            onPull={pullSheet}
            onUpload={uploadCsv}
            onUploadPdf={uploadPdf}
            onRemove={removeDataset}
            onScan={deepScan}
            onToast={onToast}
          />
        )}
      </div>
    </div>
  );
}

export default MarketingResearch;
