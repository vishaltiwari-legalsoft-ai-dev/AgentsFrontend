"use client";

/** Marketing Research — the desk that says which figures are over a line.
 *
 *  In the app being replaced this was four tabs with the thresholds at the
 *  bottom of the fourth one, behind an anchor nav, nowhere near a flag. Here
 *  every flag names the line it crossed and links to it, and moving a line moves
 *  the Desk, the vendor dossiers and the lead table together.
 *
 *  Three rules run through all seven sections:
 *
 *  1. **A line is a number somebody set.** Nothing is hard-coded; every
 *     threshold comes from this account's targets, and Lines is where they
 *     change.
 *  2. **There is no advertising API behind this agent.** Every figure is the
 *     tracker workbook plus whatever was uploaded by hand, so nothing is newer
 *     than the last sheet pull — and the panels say when that was rather than
 *     letting a figure imply it is live.
 *  3. **A campaign that does not join says so.** A lead-sheet campaign with no
 *     tracker tab cannot have a cost figure, and an empty column there would
 *     read as zero cost rather than as no denominator.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mrConfig, mrGetTargets, mrOverview, mrPortfolio, mrSnapshotDeltas,
  type MrConfig, type MrOverview, type MrPortfolio, type MrTargets, type MrVendorDelta,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { readPace, type PaceRead } from "@/components/console/mr/pace";
import { fmtMonth } from "@/components/console/mr/format";
import { useHeadline, useHub, useWorkNav, type WorkSection } from "../context";
import { Blank, Oops, Wait } from "../ui";
import { workspaceBySlug } from "../workspaces";
import { MrDesk } from "./mr/Desk";
import { MrVendors } from "./mr/Vendors";
import { MrLeads } from "./mr/Leads";
import { MrLines } from "./mr/Lines";
import { MrAsk } from "./mr/Ask";
import { MrReports } from "./mr/Reports";
import { MrData } from "./mr/Data";

const SECTIONS = workspaceBySlug("mr")!.sections;

export interface MrData_ {
  overview: MrOverview;
  portfolio: MrPortfolio | null;
  deltas: MrVendorDelta[] | null;
  targets: MrTargets | null;
  config: MrConfig | null;
  pace: PaceRead | null;
  /** Total flags across every level — the figure the rail and the headline share. */
  flagCount: number;
  reload: () => void;
  goSection: (id: string) => void;
}

export function MrWorkspace({ subject, section }: { subject: string; section: string }) {
  const { openWork, toast, revision } = useHub();
  const session = useLoadSession();

  const [overview, setOverview] = useState<Load<MrOverview>>(loadPending);
  const [portfolio, setPortfolio] = useState<Load<MrPortfolio>>(loadPending);
  const [deltas, setDeltas] = useState<Load<MrVendorDelta[]>>(loadPending);
  const [targets, setTargets] = useState<Load<MrTargets>>(loadPending);
  const [config, setConfig] = useState<Load<MrConfig>>(loadPending);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    void session.run("mr-overview", () => mrOverview(), setOverview,
      "The desk could not be read.", { keepStale: true });
    void session.run("mr-portfolio", (s) => mrPortfolio({ signal: s }), setPortfolio,
      "The month's official summary could not be read.", { keepStale: true });
    void session.run("mr-deltas", () => mrSnapshotDeltas(), setDeltas,
      "The day's movement could not be read.", { keepStale: true });
    void session.run("mr-targets", () => mrGetTargets(), setTargets,
      "The lines could not be read.", { keepStale: true });
    void session.run("mr-config", () => mrConfig(), setConfig,
      "The workbook settings could not be read.", { keepStale: true });
  }, [session, revision, beat]);

  const reload = useCallback(() => setBeat((b) => b + 1), []);

  const current = SECTIONS.some((s) => s.id === section) ? section : SECTIONS[0].id;
  const goSection = useCallback((id: string) => openWork("mr", subject || "workspace", id), [openWork, subject]);

  const ov = overview.data;
  const flagCount = useMemo(
    () => (ov?.flag_summary || []).reduce((s, f) => s + f.count, 0),
    [ov],
  );
  const pace = useMemo(() => readPace(portfolio.data), [portfolio.data]);

  const vendorCount = portfolio.data?.vendors ?? (deltas.data?.length ?? null);
  const leadCount = ov?.lead_quality
    ? ov.lead_quality.totals.booked
    : null;
  const lineCount = targets.data ? Object.keys(targets.data.thresholds).length : null;

  const counts: Record<string, number | null> = {
    desk: flagCount || null,
    vendors: vendorCount,
    leads: leadCount,
    lines: lineCount,
    data: ov ? ov.sources.length : null,
  };
  const sections: WorkSection[] = SECTIONS.map((s) => ({ ...s, count: counts[s.id] ?? null }));

  // One workspace, one subject: this agent reads one workbook for one brand.
  // The rail still needs a subject so the route round-trips.
  useWorkNav({
    agentId: "a6",
    subjects: [],
    subject: subject || "workspace",
    sections,
    section: current,
    onSubject: () => undefined,
    onSection: goSection,
  });

  const month = ov?.month ? fmtMonth(ov.month) : null;
  useHeadline(
    ov
      ? `${month || "no month yet"}${vendorCount ? ` · ${vendorCount} vendors` : ""}`
        + (flagCount ? ` · ${flagCount} over a line` : " · nothing over a line")
      : "reading the workbook",
    SECTIONS.find((s) => s.id === current)?.label,
  );

  if (overview.phase === "loading" && !overview.data) {
    return <Wait what="Reading the tracker workbook" rows={6} />;
  }
  if (overview.phase === "failed" && !overview.data) {
    return <Oops what="The desk could not be read." error={overview.error || ""} onRetry={reload} />;
  }
  if (!ov) return null;

  if (!ov.has_data) {
    return (
      <Blank title="Nothing has been pulled from the workbook yet">
        This agent reads one Google Sheets workbook — there is no advertising API behind it. Connect
        the tracker on the Data panel and pull it once; every figure on every panel here comes from
        that pull.
      </Blank>
    );
  }

  const data: MrData_ = {
    overview: ov,
    portfolio: portfolio.data,
    deltas: deltas.data,
    targets: targets.data,
    config: config.data,
    pace,
    flagCount,
    reload,
    goSection,
  };

  return (
    <>
      {current === "desk" && <MrDesk data={data} deltas={deltas} portfolio={portfolio} />}
      {current === "vendors" && <MrVendors data={data} />}
      {current === "leads" && <MrLeads data={data} />}
      {current === "lines" && <MrLines data={data} targets={targets} setTargets={setTargets} onToast={toast} />}
      {current === "ask" && <MrAsk data={data} onToast={toast} />}
      {current === "reports" && <MrReports data={data} onToast={toast} />}
      {current === "data" && <MrData data={data} onToast={toast} />}
    </>
  );
}
