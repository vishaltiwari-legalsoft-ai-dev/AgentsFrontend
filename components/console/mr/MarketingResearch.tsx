"use client";

import { useCallback, useEffect, useState } from "react";
import {
  mrConfig, mrConnectors, mrDatasets, mrIngest, mrIngestSheet, mrListRuns,
  mrOverview, mrWorkbook, mrWorkbookScan,
  type MrConfig, type MrConnector, type MrDataset, type MrOverview,
  type MrPlatform, type MrRunSummary, type MrTabProfile,
} from "@/lib/api";
import { Icon, Tabs } from "@/lib/kit-ui";
import { AskView } from "./AskView";
import { OverviewView } from "./OverviewView";

export type MrView = "overview" | "ask" | "reports" | "data";

function Pending({ name }: { name: string }) {
  return <div className="mr-panel"><div className="mr-empty">{name} view lands in the next commit.</div></div>;
}

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

  const refresh = useCallback(async () => {
    try {
      const [ov, ds, rs] = await Promise.all([mrOverview(), mrDatasets(), mrListRuns()]);
      setOverview(ov);
      setDatasets(ds);
      setRuns(rs);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to load");
    }
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

  const navItems = [
    { value: "overview", label: "Overview" },
    { value: "ask", label: "Ask" },
    { value: "reports", label: "Reports", count: runs.length || undefined },
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
            onAsk={askFromAnywhere}
            onGotoData={() => setView("data")}
          />
        )}
        {view === "ask" && <AskView seed={seed} onSeedConsumed={() => setSeed(null)} onToast={onToast} />}
        {view === "reports" && <Pending name="Reports" />}
        {view === "data" && <Pending name="Data" />}
      </div>
    </div>
  );
}

export default MarketingResearch;
