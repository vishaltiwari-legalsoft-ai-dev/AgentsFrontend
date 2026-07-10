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

/* The four recurring report views; everything else lives under "Other reports". */
const PERIOD_VIEWS: { kind: MrReportKind; label: string }[] = [
  { kind: "daily_summary", label: "Daily" },
  { kind: "weekly_summary", label: "Weekly" },
  { kind: "monthly_summary", label: "Monthly" },
  { kind: "quarterly_summary", label: "Quarterly" },
];
const PERIOD_KINDS = PERIOD_VIEWS.map((p) => p.kind);
const OTHER_KINDS = MR_REPORT_KINDS.filter((k) => !PERIOD_KINDS.includes(k));

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

  const activePeriod = report && PERIOD_KINDS.includes(report.kind) ? report.kind : null;

  return (
    <div className="mr-rpts">
      <aside className="mr-rpts__rail">
        <h3 className="mr-section__title">Report views</h3>
        <div className="mr-viewnav" role="tablist" aria-label="Report period">
          {PERIOD_VIEWS.map((p) => (
            <button
              key={p.kind} className="mr-viewnav__btn" role="tab" disabled={busy}
              aria-selected={activePeriod === p.kind}
              onClick={() => void generate(p.kind)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mr-viewnav__hint">
          {activePeriod
            ? REPORT_META[activePeriod].desc
            : "Pick a period — the report is built fresh from the latest data, through yesterday."}
        </p>

        <h3 className="mr-section__title" style={{ marginTop: 14 }}>Other reports</h3>
        <div className="mr-gen">
          {OTHER_KINDS.map((k) => {
            const m = REPORT_META[k];
            return (
              <button className="mr-gencard" key={k} disabled={busy} onClick={() => void generate(k)}>
                <span className="mr-gencard__eyebrow">{m.eyebrow}</span>
                <span className="mr-gencard__name">{m.label}</span>
                <span className="mr-gencard__desc">{m.desc}</span>
              </button>
            );
          })}
        </div>

        {runs.length > 0 && (
          <>
            <h3 className="mr-section__title" style={{ marginTop: 18 }}>History</h3>
            <div className="mr-hist">
              {runs.map((r) => (
                <button key={r.id} className="mr-hist__row" aria-current={report?.id === r.id} onClick={() => void open(r.id)}>
                  <span className="mr-hist__kind">{REPORT_META[r.kind]?.label ?? r.kind}</span>
                  <span className="mr-hist__ts">{fmtTime(r.generated_at)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="mr-rpts__view">
        {busy ? (
          <div className="mr-empty"><Icon name="loader-circle" size={16} className="cworkbar__spin" /> Writing the report…</div>
        ) : report ? (
          <MrReportDoc report={report} />
        ) : (
          <div className="mr-empty">Pick a report view (Daily / Weekly / Monthly / Quarterly), generate one of the other reports, or open one from the history.</div>
        )}
      </div>
    </div>
  );
}
