"use client";

import { useCallback, useEffect, useState } from "react";
import {
  mrIngest,
  mrIngestSheet,
  mrDatasets,
  mrBuildReport,
  mrListRuns,
  mrGetRun,
  mrConnectors,
  mrConfig,
  mrWorkbook,
  mrWorkbookScan,
  mrAsk,
  MR_REPORT_KINDS,
  type MrConfig,
  type MrConnector,
  type MrDataset,
  type MrPlatform,
  type MrReport,
  type MrReportKind,
  type MrRunSummary,
  type MrTabProfile,
  type MrAskAnswer,
} from "@/lib/api";
import { Badge, Button, Icon, Tabs } from "@/lib/kit-ui";
import { MrReportView } from "@/components/console/MrReport";

const REPORT_LABELS: Record<MrReportKind, string> = {
  daily_summary: "Daily Summary",
  weekly_summary: "Weekly Summary",
  threshold_alert: "Threshold Alert",
  competitor_digest: "Competitor Digest",
  opportunity_report: "Opportunity Report",
  utm_attribution: "UTM Attribution",
  icp_signal: "ICP Signal",
};

const CSV_PLATFORMS: { key: MrPlatform; label: string }[] = [
  { key: "google_ads", label: "Google Ads" },
  { key: "meta", label: "META Ads" },
  { key: "hubspot", label: "HubSpot" },
];

function sourceLabel(platform: string): { src: string; tab: string } {
  if (platform?.startsWith("sheets:")) return { src: "Google Sheets", tab: platform.slice(7) };
  const map: Record<string, string> = { google_ads: "Google Ads", meta: "META Ads", hubspot: "HubSpot" };
  return { src: `${map[platform] ?? platform} · CSV upload`, tab: "" };
}

const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

/* ------------------------------- root ----------------------------------- */

export function MarketingResearch({ onToast, onBack }: { onToast: (m: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState("ask");
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const [datasets, setDatasets] = useState<MrDataset[]>([]);
  const [runs, setRuns] = useState<MrRunSummary[]>([]);
  const [report, setReport] = useState<MrReport | null>(null);
  const [connectors, setConnectors] = useState<MrConnector[]>([]);
  const [config, setConfig] = useState<MrConfig | null>(null);
  const [catalog, setCatalog] = useState<MrTabProfile[]>([]);

  // Ask state
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<MrAskAnswer | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [ds, rs] = await Promise.all([mrDatasets(), mrListRuns()]);
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

  async function ask(q: string) {
    const query = q.trim();
    if (!query || asking) return;
    setQuestion(query);
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await mrAsk(query));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ask failed");
    } finally {
      setAsking(false);
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

  async function generate(kind: MrReportKind) {
    setBusy(true);
    try {
      setReport(await mrBuildReport(kind));
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  async function openRun(id: string) {
    try {
      setReport(await mrGetRun(id));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to open report");
    }
  }

  const tabs = [
    { value: "ask", label: "Ask" },
    { value: "connections", label: "Connections", count: datasets.length || undefined },
    { value: "reports", label: "Reports", count: runs.length || undefined },
    { value: "configuration", label: "Configuration" },
    { value: "connectors", label: "Connectors" },
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
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </header>

      <div className="mr-body">
        {tab === "ask" && (
          <AskPanel
            question={question}
            setQuestion={setQuestion}
            asking={asking}
            answer={answer}
            onAsk={ask}
          />
        )}
        {tab === "connections" && (
          <ConnectionsPanel
            datasets={datasets}
            catalog={catalog}
            busy={busy}
            onPull={pullSheet}
            onUpload={uploadCsv}
            onScan={deepScan}
          />
        )}
        {tab === "reports" && (
          <ReportsPanel
            runs={runs}
            report={report}
            busy={busy}
            onGenerate={generate}
            onOpen={openRun}
          />
        )}
        {tab === "configuration" && (
          <ConfigPanel config={config} year={year} onYear={setYear} />
        )}
        {tab === "connectors" && <ConnectorsPanel connectors={connectors} />}
      </div>
    </div>
  );
}

/* -------------------------------- Ask ----------------------------------- */

const SUGGESTED = [
  "How did we perform this month?",
  "Which platform gave the most qualified leads?",
  "Where are we wasting spend?",
  "How do leads compare month over month?",
];

/** Split an answer into prose + a trailing "Recommend:" line. */
function splitAnswer(text: string): { body: string; rec: string } {
  const clean = (text || "").replace(/\*\*/g, "").trim();
  const m = clean.match(/recommend:\s*(.*)$/is);
  return m ? { body: clean.slice(0, m.index).trim(), rec: m[1].trim() } : { body: clean, rec: "" };
}

function AskPanel({
  question,
  setQuestion,
  asking,
  answer,
  onAsk,
}: {
  question: string;
  setQuestion: (s: string) => void;
  asking: boolean;
  answer: MrAskAnswer | null;
  onAsk: (q: string) => void;
}) {
  const ans = answer ? splitAnswer(answer.answer) : null;
  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Ask the agent</h2>
        <span className="mr-panel__sub">Ask anything about the marketing data. The agent finds the right tab(s) and answers with the real numbers.</span>
      </div>

      <div className="mr-ask__box">
        <textarea
          className="mr-ask__input"
          rows={2}
          placeholder="e.g. Which channel had the best cost per demo in June?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onAsk(question);
            }
          }}
        />
        <Button variant="brand" disabled={asking || !question.trim()} onClick={() => onAsk(question)}
          iconLeft={<Icon name={asking ? "loader-circle" : "sparkles"} size={15} className={asking ? "cworkbar__spin" : undefined} />}>
          {asking ? "Thinking…" : "Ask"}
        </Button>
      </div>

      <div className="mr-sugg">
        {SUGGESTED.map((q) => (
          <button key={q} className="mr-chip" onClick={() => onAsk(q)} disabled={asking}>{q}</button>
        ))}
      </div>

      {asking && <div className="mr-empty">Finding the right data and reading it…</div>}

      {ans && (
        <div className="mr-ans">
          {answer && <div className="mr-ans__q">{answer.question}</div>}
          <p className="mr-ans__text">{ans.body}</p>
          {ans.rec && <div className="mr-rec"><b>Recommend</b><span>{ans.rec}</span></div>}
          {answer && answer.used_tabs.length > 0 && (
            <div className="mr-ans__src">
              <span className="mr-ans__src-label">Sources</span>
              {answer.used_tabs.map((t) => (
                <span className="mr-srcchip" key={t}><Icon name="layout-grid" size={12} /> {t}</span>
              ))}
              {answer.timeframe && <span className="mr-srcchip">⏱ {answer.timeframe}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Connections ------------------------------ */

function ConnectionsPanel({
  datasets,
  catalog,
  busy,
  onPull,
  onUpload,
  onScan,
}: {
  datasets: MrDataset[];
  catalog: MrTabProfile[];
  busy: boolean;
  onPull: () => void;
  onUpload: (f: File, p: MrPlatform) => void;
  onScan: () => void;
}) {
  const usefulTabs = catalog.filter((t) => t.useful);
  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Connections</h2>
        <span className="mr-panel__sub">Where the agent&apos;s data is coming from, and what it understands in the workbook.</span>
      </div>

      <div className="mr-actions">
        <Button variant="brand" disabled={busy} onClick={onPull} iconLeft={<Icon name="refresh-cw" size={15} />}>
          Pull live Google Sheet
        </Button>
        {CSV_PLATFORMS.map((p) => (
          <label key={p.key} className="ens-btn ens-btn--secondary ens-btn--sm" style={{ cursor: "pointer" }}>
            <Icon name="upload" size={14} /> {p.label} CSV
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f, p.key);
                e.target.value = "";
              }}
            />
          </label>
        ))}
      </div>

      {datasets.length === 0 ? (
        <div className="mr-empty">No data pulled into reports yet. Pull the live Google Sheet or upload a platform CSV.</div>
      ) : (
        datasets.map((d) => {
          const { src, tab } = sourceLabel(d.platform);
          return (
            <div className="mr-src" key={d.id}>
              <span className="mr-src__icon"><Icon name="database" size={18} /></span>
              <div className="mr-src__id">
                <span className="mr-src__name">{src}{tab ? ` · ${tab}` : ""}</span>
                <span className="mr-src__meta">
                  Pulled {fmtTime(d.generated_at)}
                  {d.gaps.length > 0 && <span style={{ color: "var(--amber-600)" }}> · {d.gaps.length} data gap(s)</span>}
                </span>
              </div>
              <div className="mr-src__stat">
                <span className="mr-src__count">{d.metrics}<span> metrics</span></span>
                {d.leads > 0 && <span className="mr-src__count">{d.leads}<span> leads</span></span>}
              </div>
            </div>
          );
        })
      )}

      <div className="mr-panel__head" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 className="mr-section__title">What the agent understands ({usefulTabs.length} data tabs)</h3>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onScan} iconLeft={<Icon name="sparkles" size={13} />}>
            Deep-scan tabs
          </Button>
        </div>
      </div>
      {catalog.length === 0 ? (
        <div className="mr-empty">Reading the workbook…</div>
      ) : (
        <div className="mr-cat">
          {catalog.map((t) => (
            <div className={`mr-cat__row${t.useful ? "" : " mr-cat__row--off"}`} key={t.gid}>
              <span className="mr-cat__name">{t.title}</span>
              <span className="mr-cat__tags">
                <span className="mr-tag">{t.kind.replace(/_/g, " ")}</span>
                {t.granularity !== "none" && <span className="mr-tag mr-tag--gran">{t.granularity}</span>}
                {t.date_range && <span className="mr-tag">{t.date_range}</span>}
              </span>
              <span className="mr-cat__sum">{t.summary}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Reports -------------------------------- */

function ReportsPanel({
  runs,
  report,
  busy,
  onGenerate,
  onOpen,
}: {
  runs: MrRunSummary[];
  report: MrReport | null;
  busy: boolean;
  onGenerate: (k: MrReportKind) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Reports</h2>
        <span className="mr-panel__sub">Generate a report, or revisit one the agent produced earlier.</span>
      </div>

      <div className="mr-actions">
        {MR_REPORT_KINDS.map((k) => (
          <Button key={k} variant="secondary" disabled={busy} onClick={() => onGenerate(k)}>
            {REPORT_LABELS[k]}
          </Button>
        ))}
      </div>

      {report && (
        <div className="mr-section" style={{ padding: 20 }}>
          <MrReportView report={report} />
        </div>
      )}

      {runs.length > 0 && (
        <div className="mr-panel__head" style={{ marginTop: 4 }}>
          <h3 className="mr-section__title">History</h3>
        </div>
      )}
      <div className="mr-hist">
        {runs.map((r) => (
          <button
            key={r.id}
            className="mr-hist__row"
            aria-current={report?.id === r.id}
            onClick={() => onOpen(r.id)}
          >
            <span className="mr-hist__kind">{REPORT_LABELS[r.kind] ?? r.kind}</span>
            <span className="mr-hist__ts">{fmtTime(r.generated_at)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Configuration ----------------------------- */

function ConfigPanel({
  config,
  year,
  onYear,
}: {
  config: MrConfig | null;
  year: number | null;
  onYear: (y: number) => void;
}) {
  if (!config) return <div className="mr-panel"><div className="mr-empty">Loading configuration…</div></div>;
  const years = [config.year - 1, config.year, config.year + 1];
  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Configuration</h2>
        <span className="mr-panel__sub">Data source, report schedule, and the 2026 thresholds the agent flags against.</span>
      </div>

      <div className="mr-cfg">
        <div className="mr-cfg__card">
          <h3 className="mr-section__title">Data source</h3>
          <div className="mr-cfg__row">
            <span className="mr-cfg__key">Spreadsheet</span>
            <a className="mr-cfg__val" href={config.spreadsheet_url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
              Open in Google Sheets ↗
            </a>
          </div>
          <div className="mr-cfg__row">
            <span className="mr-cfg__key">Plan year</span>
            <select
              className="mr-cfg__val"
              value={year ?? config.year}
              onChange={(e) => onYear(Number(e.target.value))}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-card)" }}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="mr-cfg__card">
          <h3 className="mr-section__title">Report schedule</h3>
          {config.schedule.map((s) => (
            <div className="mr-cfg__row" key={s.report}>
              <span className="mr-cfg__key">{s.report}</span>
              <span className="mr-cfg__val">{s.cadence}</span>
            </div>
          ))}
        </div>

        <div className="mr-cfg__card">
          <h3 className="mr-section__title">Alert thresholds</h3>
          <div className="mr-cfg__row"><span className="mr-cfg__key">Cost-per-booking flag</span><span className="mr-cfg__val">&gt; ${config.thresholds.cost_per_booking_flag}</span></div>
          <div className="mr-cfg__row"><span className="mr-cfg__key">Cost-per-qualified-lead red</span><span className="mr-cfg__val">≥ ${config.thresholds.cost_per_qualified_lead_red}</span></div>
          <div className="mr-cfg__row"><span className="mr-cfg__key">CAC red</span><span className="mr-cfg__val">≥ ${config.thresholds.cac_red}</span></div>
          <div className="mr-cfg__row"><span className="mr-cfg__key">Spend with no demo</span><span className="mr-cfg__val">≥ ${config.thresholds.spend_no_demo_limit}</span></div>
          <div className="mr-cfg__row"><span className="mr-cfg__key">Conversion-drop flag</span><span className="mr-cfg__val">&gt; {config.thresholds.conversion_drop_pct}%</span></div>
        </div>

        <div className="mr-cfg__card">
          <h3 className="mr-section__title">Tracked competitors ({config.competitors.length})</h3>
          {config.competitors.map((c) => (
            <div className="mr-cfg__row" key={c.name}>
              <span className="mr-cfg__key">{c.name}</span>
              <a className="mr-cfg__val" href={c.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>site ↗</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Connectors ------------------------------- */

function ConnectorsPanel({ connectors }: { connectors: MrConnector[] }) {
  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Connectors</h2>
        <span className="mr-panel__sub">Platforms the agent can pull from. Connected sources feed reports automatically.</span>
      </div>

      <div className="cgrid cgrid--3">
        {connectors.map((c) => (
          <div className="cintg" key={c.key}>
            <div className="cintg__top">
              <span className="logotile">
                {c.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`/logo/${c.logo}.svg`} alt={`${c.label} logo`} width={26} height={26} style={{ objectFit: "contain" }} />
                ) : (
                  <Icon name={c.category === "Manual" ? "upload" : "plug"} size={18} />
                )}
              </span>
              {c.status === "connected" ? (
                <Badge variant="success" dot>Connected</Badge>
              ) : c.status === "available" ? (
                <Badge variant="outline">Manual</Badge>
              ) : (
                <Badge variant="outline">Needs setup</Badge>
              )}
            </div>
            <div className="cintg__id">
              <div className="cintg__name">{c.label}</div>
              <div className="cintg__cat">{c.category}</div>
            </div>
            <p className="cintg__desc">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarketingResearch;
