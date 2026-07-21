"use client";

import { useState } from "react";
import {
  MR_REPORT_KINDS, mrBuildReport, mrGetRun,
  type MrReport, type MrReportKind, type MrRunSummary,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
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

export function ReportsView({ runs, onRunsChanged, onToast }: {
  runs: MrRunSummary[];
  onRunsChanged: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const [report, setReport] = useState<MrReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(kind: MrReportKind) {
    setBusy(true);
    try {
      setReport(await mrBuildReport(kind));
      await onRunsChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    try {
      setReport(await mrGetRun(id));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to open report");
    }
  }

  return (
    <div className="mr-rpts">
      <aside className="mr-rpts__rail">
        <h3 className="mr-section__title">Generate a report</h3>
        <div className="mr-genbtns">
          {MR_REPORT_KINDS.map((k) => (
            <button
              key={k} className="mr-genbtn" disabled={busy}
              aria-pressed={report?.kind === k}
              title={REPORT_META[k]?.desc}
              onClick={() => void generate(k)}
            >
              {KIND_LABELS[k] ?? REPORT_META[k]?.label ?? k}
            </button>
          ))}
        </div>

        <h3 className="mr-section__title" style={{ marginTop: 18 }}>History</h3>
        {runs.length > 0 ? (
          <div className="mr-hist">
            {runs.map((r) => (
              <button key={r.id} className="mr-hist__row" aria-current={report?.id === r.id} onClick={() => void open(r.id)}>
                <span className="mr-hist__kind">{REPORT_META[r.kind]?.label ?? r.kind}</span>
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
          <MrReportDoc report={report} />
        ) : (
          <div className="mr-empty">Generate a report on the left, or open one from the history.</div>
        )}
      </div>
    </div>
  );
}
