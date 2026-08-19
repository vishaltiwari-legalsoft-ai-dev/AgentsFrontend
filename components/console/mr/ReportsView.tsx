"use client";

import { useEffect, useRef, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  MR_REPORT_KINDS, mrBuildReport, mrGetRun, mrReportPdfUrl, mrReportPeriods,
  type MrReport, type MrReportKind, type MrReportPeriods, type MrRunSummary,
} from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { REPORT_META } from "./reportMeta";
import { MrReportDoc } from "./MrReportDoc";
import { fmtTime } from "./shared";

/* Short button labels — the full label + description live in the hover title
   and on the generated document itself. */
const KIND_LABELS: Partial<Record<MrReportKind, string>> = {
  daily_summary: "Daily",
  weekly_summary: "Weekly",
  monthly_summary: "Monthly",
  quarterly_summary: "Quarterly",
  threshold_alert: "Threshold Alert",
  competitor_digest: "Competitor Digest",
  opportunity_report: "Media Opportunities",
  utm_attribution: "UTM Attribution",
  icp_signal: "ICP Signal",
  daily_movement: "Daily Movement",
};

/* Monthly/Quarterly open a picker of data-backed periods instead of building
   straight away (users need past months — "the July report" — not just MTD). */
const PICKER_KINDS: Partial<Record<MrReportKind, "months" | "quarters">> = {
  monthly_summary: "months",
  quarterly_summary: "quarters",
};

export function ReportsView({ runs, onRunsChanged, onToast }: {
  runs: MrRunSummary[];
  onRunsChanged: () => Promise<void>;
  onToast: ToastFn;
}) {
  const [report, setReport] = useState<MrReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [picker, setPicker] = useState<MrReportKind | null>(null);
  const [periods, setPeriods] = useState<MrReportPeriods | null>(null);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!picker) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicker(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [picker]);

  // Server-rendered PDF (reportlab): clean page breaks, designed layout.
  // (DOM-capture was tried and reverted — cards/text sliced at page breaks.)
  async function downloadPdf() {
    if (!report) return;
    setDownloading(true);
    try {
      const url = await mrReportPdfUrl(report.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mr-${report.kind}-${report.generated_at.slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "PDF download failed", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function togglePicker(kind: MrReportKind) {
    if (picker === kind) {
      setPicker(null);
      return;
    }
    setPicker(kind);
    if (!periods && !periodsLoading) {
      setPeriodsLoading(true);
      try {
        setPeriods(await mrReportPeriods());
      } catch (e) {
        // Not cached: the next open retries, and the menu falls back to the
        // default entry meanwhile.
        onToast(e instanceof Error ? e.message : "Couldn't load available months", "error");
      } finally {
        setPeriodsLoading(false);
      }
    }
  }

  async function generate(kind: MrReportKind, period?: string) {
    setPicker(null);
    setBusy(true);
    try {
      setReport(await mrBuildReport(kind, period));
      await onRunsChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Report failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    try {
      setReport(await mrGetRun(id));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to open report", "error");
    }
  }

  return (
    <div className="mr-rpts">
      <aside className="mr-rpts__rail">
        <h3 className="mr-section__title">Generate a report</h3>
        <div className="mr-genbtns">
          {MR_REPORT_KINDS.map((k) => {
            const pickKey = PICKER_KINDS[k];
            if (!pickKey) {
              return (
                <button
                  key={k} className="mr-genbtn" disabled={busy}
                  aria-pressed={report?.kind === k}
                  title={REPORT_META[k]?.desc}
                  onClick={() => void generate(k)}
                >
                  {KIND_LABELS[k] ?? REPORT_META[k]?.label ?? k}
                </button>
              );
            }
            const list = periods?.[pickKey] ?? [];
            return (
              <div key={k} className="mr-genwrap" ref={picker === k ? pickerRef : undefined}>
                <button
                  className="mr-genbtn" disabled={busy}
                  aria-pressed={report?.kind === k} aria-expanded={picker === k}
                  title={REPORT_META[k]?.desc}
                  onClick={() => void togglePicker(k)}
                >
                  {KIND_LABELS[k] ?? REPORT_META[k]?.label ?? k}
                  <Icon name="chevron-down" size={11} />
                </button>
                {picker === k && (
                  <div className="mr-genmenu" role="menu">
                    {periodsLoading ? (
                      <span className="mr-genmenu__item" aria-disabled="true">Loading…</span>
                    ) : list.length > 0 ? (
                      list.map((p) => (
                        <button
                          key={p.period} className="mr-genmenu__item" role="menuitem"
                          onClick={() => void generate(k, p.period)}
                        >
                          {p.label}{p.current ? " (so far)" : ""}
                        </button>
                      ))
                    ) : (
                      <button
                        className="mr-genmenu__item" role="menuitem"
                        onClick={() => void generate(k)}
                      >
                        This {k === "monthly_summary" ? "month" : "quarter"} (so far)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <h3 className="mr-section__title" style={{ marginTop: 18 }}>History</h3>
        {runs.length > 0 ? (
          <div className="mr-hist">
            {runs.map((r) => (
              <button key={r.id} className="mr-hist__row" aria-current={report?.id === r.id} onClick={() => void open(r.id)}>
                <span className="mr-hist__main">
                  <span className="mr-hist__kind">{REPORT_META[r.kind]?.label ?? r.kind}</span>
                  {r.period && <span className="mr-hist__period">{r.period}</span>}
                </span>
                <span className="mr-hist__ts">{fmtTime(r.generated_at)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mr-viewnav__hint">No reports yet — generate one above.</p>
        )}
      </aside>

      <div className="mr-rpts__view">
        {busy ? (
          <div className="mr-empty"><Icon name="loader-circle" size={16} className="cworkbar__spin" /> Writing the report…</div>
        ) : report ? (
          <>
            <div className="mr-rpts__toolbar" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <Button size="sm" variant="secondary" disabled={downloading}
                onClick={() => void downloadPdf()}
                iconLeft={<Icon name="download" size={13} />}>
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </Button>
            </div>
            <MrReportDoc report={report} />
          </>
        ) : (
          <div className="mr-empty">Generate a report on the left, or open one from the history.</div>
        )}
      </div>
    </div>
  );
}
