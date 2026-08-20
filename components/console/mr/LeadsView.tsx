"use client";

import { useEffect, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import { mrLeadAnalysis, mrLeadsPdfUrl, type MrLeadAnalysis, type MrLeadVendor } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { describeFailure, LIVE_REFRESH_MS, loadPending, useLoadSession, type Load } from "@/lib/load";
import { fmtMoney, fmtMonth, fmtNum, fmtTime } from "./shared";

const cellTxt = (n: number, rate: number | null) =>
  rate === null || rate === undefined ? fmtNum(n) : `${fmtNum(n)} · ${rate.toFixed(0)}%`;

const STAGES: [string, string][] = [
  ["contract_sent", "Contract sent"], ["hot_leads", "Hot leads"],
  ["demo_no_show", "Demo no show"], ["lost_dnc", "Lost DNC"],
  ["none", "No stage yet"], ["other", "Other"],
];

function Chips({ label, counts }: { label: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="mr-leads__chips">
      <span className="mr-leads__chiplabel">{label}</span>
      {entries.map(([k, n]) => <span className="mr-tag" key={k}>{k} · {n}</span>)}
    </div>
  );
}

/* One vendor = one table row; clicking it opens the detail row underneath
   (story, flags, deal stages, brand/source mix, tracker join). */
function VendorRows({ v, open, onToggle }: { v: MrLeadVendor; open: boolean; onToggle: () => void }) {
  const flagged = new Set(v.flags.map((f) => f.metric));
  const bad = (metric: string) => (flagged.has(metric) ? "mr-leads__bad" : undefined);
  return (
    <>
      <tr className="mr-leads__row" aria-expanded={open} onClick={onToggle}>
        <td className="mr-leads__vendor">
          {v.matched_vendor ?? v.campaign}
          {v.flags.length > 0 && <span className="mr-pill mr-pill--bad">{v.flags.length}</span>}
        </td>
        <td>{fmtNum(v.booked)}</td>
        <td className={bad("zero_completed")}>{cellTxt(v.completed, v.completed_rate_pct)}</td>
        <td className={bad("no_show_rate")}>{cellTxt(v.no_show, v.no_show_rate_pct)}</td>
        <td className={bad("canceled_rate")}>{cellTxt(v.canceled, v.canceled_rate_pct)}</td>
        <td className={bad("bad_lead_rate")}>{cellTxt(v.bad_lead, v.bad_lead_rate_pct)}</td>
        <td>{fmtNum(v.pending)}</td>
        <td>{fmtNum(v.deal_stages.contract_sent ?? 0)}</td>
        <td>{fmtNum(v.services_sold)}</td>
      </tr>
      {open && (
        <tr className="mr-leads__detail">
          <td colSpan={9}>
            <p className="mr-leads__story">{v.story}</p>
            {v.flags.length > 0 && (
              <ul className="mr-lead__flags">
                {v.flags.map((f) => <li key={f.metric}>{f.message}</li>)}
              </ul>
            )}
            <div className="mr-leads__chiprows">
              <Chips label="Deal stage"
                counts={Object.fromEntries(STAGES.filter(([k]) => v.deal_stages[k]).map(([k, l]) => [l, v.deal_stages[k]]))} />
              <Chips label="Brand" counts={v.brands} />
              <Chips label="Source" counts={v.sources} />
            </div>
            {v.tracker ? (
              <p className="mr-lead__note">
                Tracker join: {fmtNum(v.tracker.leads)} leads · QL ratio{" "}
                {v.tracker.ql_ratio_pct === null ? "—" : `${v.tracker.ql_ratio_pct.toFixed(0)}%`} · booking rate{" "}
                {v.tracker.booking_rate_pct === null ? "—" : `${v.tracker.booking_rate_pct.toFixed(0)}%`}
                {v.mrr > 0 && <> · {fmtMoney(v.mrr)} MRR sold</>}
              </p>
            ) : (
              <p className="mr-lead__note">
                Not matched to a tracker vendor tab this month — the QL-ratio / booking-rate check couldn&rsquo;t run.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* Downloads the panel as a server-rendered, same-format PDF (like the report
   and vendor-dossier downloads). */
function DownloadLeads({ month, onToast }: { month: string; onToast: ToastFn }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const url = await mrLeadsPdfUrl(month);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mr-leads-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      onToast(describeFailure(e, "PDF download failed"), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void download()}
      iconLeft={<Icon name="download" size={13} />}>
      {busy ? "Preparing…" : "Download PDF"}
    </Button>
  );
}

/* The Leads panel: the lead sheet's whole per-vendor Meeting Outcome / Deal
   Stage picture in one place. Story first, red only where a rule tripped. */
export function LeadsView({ onGotoData, onToast }: { onGotoData: () => void; onToast: ToastFn }) {
  const session = useLoadSession();
  const [analysis, setAnalysis] = useState<Load<MrLeadAnalysis>>(loadPending);
  const [month, setMonth] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  /** `loaded` was a boolean that went true on success *and* on failure, so a
   *  dead read fell straight through to "No lead-analysis data yet" with a
   *  button into the Data tab — a whole wrong errand. The phase tells the two
   *  apart, and `keepStale` keeps the poll from undoing a good read. */
  useEffect(() => {
    const load = (background: boolean) => {
      void session.run("leads", () => mrLeadAnalysis(), setAnalysis,
        "Couldn't load the lead analysis", { keepStale: background });
    };
    load(false);
    const id = window.setInterval(() => load(true), LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [session]);

  const data = analysis.data;

  if (analysis.phase === "loading" && !data) {
    return <div className="mr-panel"><div className="mr-empty">Loading lead analysis…</div></div>;
  }

  if (analysis.phase === "failed" && !data) {
    return (
      <div className="mr-panel">
        <div className="mr-empty">
          <strong>Couldn&rsquo;t load the lead analysis.</strong>
          <div>{analysis.error}</div>
          <div style={{ marginTop: 6 }}>
            This is a failed read, not an empty sheet — the lead rows are still there, so
            connecting more data will not fix it.
          </div>
        </div>
      </div>
    );
  }

  const months = data?.months ? Object.keys(data.months).sort().reverse() : [];
  if (!data?.has_data || months.length === 0) {
    return (
      <div className="mr-panel">
        <div className="mr-empty">
          <p style={{ margin: "0 0 12px" }}>
            {data?.hint ?? "No lead-analysis data yet."}
          </p>
          <Button variant="secondary" onClick={onGotoData}>Open the Data tab</Button>
        </div>
      </div>
    );
  }

  const active = month && data.months?.[month] ? month : (data.latest_month ?? months[0]);
  const block = data.months![active];
  const t = block.totals;
  const flaggedVendors = block.vendors.filter((v) => v.flags.length > 0);

  const story =
    `${fmtNum(t.booked)} demos booked across ${block.vendors.length} vendor${block.vendors.length === 1 ? "" : "s"} — ` +
    `${fmtNum(t.completed)} completed, ${fmtNum(t.no_show)} no-shows, ${fmtNum(t.canceled)} canceled, ` +
    `${fmtNum(t.bad_lead)} bad leads, ${fmtNum(t.pending)} upcoming.` +
    (t.services_sold ? ` ${fmtNum(t.services_sold)} service${t.services_sold === 1 ? "" : "s"} sold (${fmtMoney(t.mrr)} MRR).` : "");

  return (
    <div className="mr-panel mr-leads">
      <div className="mr-panel__head">
        <div className="mr-leads__head">
          <h2 className="mr-panel__title">Leads · {fmtMonth(active)}</h2>
          {months.length > 1 && (
            <span className="mr-leads__months">
              {months.map((m) => (
                <button key={m} className="mr-chip" aria-current={m === active} onClick={() => setMonth(m)}>
                  {fmtMonth(m)}
                </button>
              ))}
            </span>
          )}
          <span className="mr-leads__actions">
            <DownloadLeads month={active} onToast={onToast} />
          </span>
        </div>
        <span className="mr-panel__sub">
          From &ldquo;{data.tab}&rdquo;{data.source_label ? ` in ${data.source_label}` : ""}
          {data.generated_at ? ` · updated ${fmtTime(data.generated_at)}` : ""} · refreshes with every sheet pull
        </span>
      </div>

      <p className="mr-leads__story">{story}</p>

      {block.flag_count > 0 ? (
        <div className="mr-leads__flagcard">
          <b>{block.flag_count} red flag{block.flag_count === 1 ? "" : "s"} across {flaggedVendors.length} vendor{flaggedVendors.length === 1 ? "" : "s"}</b>
          {flaggedVendors.map((v) => (
            <div className="mr-leads__flagvendor" key={v.slug}>
              <span>{v.matched_vendor ?? v.campaign}</span>
              <ul className="mr-lead__flags">
                {v.flags.map((f) => <li key={f.metric}>{f.message}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mr-leads__ok">No red flags this month — outcomes are inside every line.</p>
      )}

      <div className="mr-leads__chiprows">
        <Chips label="Brand" counts={t.brands} />
        <Chips label="Source" counts={t.sources} />
      </div>

      <div className="mr-leads__tablewrap">
        <table className="mr-leads__table">
          <thead>
            <tr>
              <th>Vendor</th><th>Booked</th><th>Completed</th><th>No-shows</th><th>Canceled</th>
              <th>Bad leads</th><th>Upcoming</th><th>Contract sent</th><th>Sold</th>
            </tr>
          </thead>
          <tbody>
            {block.vendors.map((v) => (
              <VendorRows key={v.slug} v={v} open={open === v.slug}
                onToggle={() => setOpen((s) => (s === v.slug ? null : v.slug))} />
            ))}
          </tbody>
        </table>
      </div>

      {(data.unmatched_campaigns?.length ?? 0) > 0 && (
        <p className="mr-lead__note">
          Not matched to any tracker vendor tab: {data.unmatched_campaigns!.join(", ")} — their QL-ratio / booking-rate
          check couldn&rsquo;t run.
        </p>
      )}
      {(data.gaps?.length ?? 0) > 0 && (
        <p className="mr-lead__note">Data note: {data.gaps!.join(" · ")}</p>
      )}
    </div>
  );
}
