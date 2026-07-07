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
        <h3 className="mr-section__title">Generate</h3>
        <div className="mr-gen">
          {MR_REPORT_KINDS.map((k) => {
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
          <div className="mr-empty">Pick a report to generate, or open one from the history.</div>
        )}
      </div>
    </div>
  );
}
