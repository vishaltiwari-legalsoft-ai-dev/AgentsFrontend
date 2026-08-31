"use client";

/** The lead sheet's whole Meeting Outcome and Deal Stage picture, in one table.
 *
 *  Joined to the tracker by campaign name. A campaign that does not join keeps
 *  its counts and loses its cost figures, and the row says so — an empty cost
 *  column would read as "cost zero", which is the opposite of "no denominator".
 *
 *  A rate under a count is that count as a share of the demos that **resolved** —
 *  completed, no-show, canceled or bad lead. Upcoming demos are not in the
 *  denominator, because a demo that has not happened yet has not failed.
 */

import { useEffect, useState } from "react";
import { mrLeadAnalysis, type MrLeadAnalysis, type MrLeadVendor } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n } from "../../model";
import type { MrData_ } from "../MrWorkspace";
import { ChipRow, fmtMoney, fmtNum, pct } from "./parts";

const STAGE_LABEL: Record<string, string> = {
  contract_sent: "Contract sent",
  hot_leads: "Hot leads",
  demo_no_show: "Demo no show",
  lost_dnc: "Lost DNC",
  none: "No stage yet",
  other: "Other",
};

/** The five checks the lead sheet can run on its own. */
const OUTCOME_METRICS = new Set([
  "zero_completed", "no_show_rate", "canceled_rate", "bad_lead_rate", "booking_broken",
]);

export function MrLeads({ data }: { data: MrData_ }) {
  const session = useLoadSession();
  const [doc, setDoc] = useState<Load<MrLeadAnalysis>>(loadPending);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string>("");

  useEffect(() => {
    void session.run("mr-leads", () => mrLeadAnalysis(), setDoc,
      "The lead sheet could not be read.", { keepStale: true });
  }, [session]);

  if (doc.phase === "loading" && !doc.data) return <Wait what="Reading the lead sheet" rows={6} />;
  if (doc.phase === "failed" && !doc.data) {
    return <Oops what="The lead sheet could not be read." error={doc.error || ""} onRetry={data.reload} />;
  }

  const a = doc.data;
  if (!a || !a.has_data) {
    return (
      <>
        <PageHead
          statement={<>The lead sheet is <b>not connected</b>.</>}
          lede="Booked demos, their outcomes and their deal stages live in a separate tab from the spend tracker. Without it this agent can measure cost but not what the money bought."
        />
        <Blank title="No lead tab found" action={
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => data.goSection("data")}>
            Open the Data panel
          </button>
        }>
          {a?.hint || "Add the lead sheet on the Data panel — the agent finds the tab itself once the workbook is connected."}
        </Blank>
      </>
    );
  }

  const months = a.months || {};
  const available = Object.keys(months).sort().reverse();
  // The rest of this workspace is on `overview.month`; opening this panel on a
  // different one made the rail's count and the page's headline disagree by a
  // whole month with nothing on screen saying so.
  const preferred = data.overview.month && months[data.overview.month]
    ? data.overview.month
    : a.latest_month && months[a.latest_month]
      ? a.latest_month
      : available[0] || "";
  const monthKey = picked && months[picked] ? picked : preferred;
  const month = months[monthKey];
  if (!month) {
    return (
      <>
        <PageHead statement={<>Nothing booked in <b>any month on file</b>.</>} lede="" />
        <Blank title="No months with demos">The lead tab is connected but carries no booked demos yet.</Blank>
      </>
    );
  }

  const rows = month.vendors;
  const t = month.totals;
  const outcomeFlags = rows.flatMap((r) => r.flags.filter((f) => OUTCOME_METRICS.has(f.metric)).map((f) => ({ ...f, campaign: r.campaign })));
  const flaggedCount = new Set(outcomeFlags.map((f) => f.campaign)).size;
  const unjoined = rows.filter((r) => !r.tracker);

  const cell = (v: number, rate: number | null, flagged: boolean) => (
    <td className={flagged ? "num is-over" : "num"}>
      {fmtNum(v)}
      {rate !== null && <em> {Math.round(rate)}%</em>}
    </td>
  );
  const has = (r: MrLeadVendor, metric: string) => r.flags.some((f) => f.metric === metric);

  return (
    <>
      <PageHead
        statement={
          <>
            {fmtNum(t.booked)} demo{t.booked === 1 ? "" : "s"} booked,{" "}
            <b>{fmtNum(t.completed)} of {t.booked === 1 ? "it" : "them"} completed</b>.
          </>
        }
        lede="The lead sheet's whole Meeting Outcome and Deal Stage picture in one table, joined to the tracker by campaign name. A campaign that does not join says so rather than sitting there with empty columns."
      />

      {available.length > 1 && (
        <div className="facets" style={{ marginBottom: 20 }}>
          {available.map((m) => (
            <button
              type="button"
              key={m}
              className={`facet${m === monthKey ? " is-on" : ""}`}
              onClick={() => setPicked(m)}
            >
              {m}
              <u>{months[m].totals.booked}</u>
            </button>
          ))}
        </div>
      )}

      <p className="mrsrc">
        {monthKey} · from “{a.tab || "the lead tab"}” in {a.source_label || "the workbook"}
        {a.generated_at ? ` · read ${new Date(a.generated_at).toLocaleString()}` : ""} · refreshes
        with every sheet pull
      </p>

      {a.gaps && a.gaps.length > 0 && (
        <p className="soon-note">
          The sheet is missing {a.gaps.join(", ")}. Anything that needed those columns is absent
          below rather than estimated.
        </p>
      )}

      <section className="band">
        <RuleHead
          title={outcomeFlags.length ? "Outcomes over a line" : "No outcome over a line"}
          note={
            outcomeFlags.length
              ? "These are the five checks the lead sheet can run on its own. Each one names the line it crossed."
              : "Every campaign's no-show, cancellation and bad-lead rates are inside the lines set on the Lines panel."
          }
          aside={
            outcomeFlags.length
              ? <span className="aside">{n(outcomeFlags.length)} across {n(flaggedCount)} campaigns</span>
              : undefined
          }
        />
        {outcomeFlags.length === 0 ? (
          <p className="okline">Nothing over a line here. Every figure is inside the numbers the desk set.</p>
        ) : (
          <ul className="flags flags--tight">
            {outcomeFlags.map((f, i) => (
              <li className={`flag is-${f.level}`} key={`${f.campaign}-${f.metric}-${i}`}>
                <span className="flag__lv">{f.level === "red" ? "Over" : "Watch"}</span>
                <div className="flag__b"><p className="flag__t">{f.message}</p></div>
                <span className="flag__m">
                  {f.campaign}
                  <em>
                    <button type="button" className="lnk" onClick={() => data.goSection("lines")}>
                      the line it crossed
                    </button>
                  </em>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="band">
        <RuleHead
          title="Every campaign"
          note="A rate under a count is that count as a share of the demos that resolved — completed, no-show, canceled or bad lead. Upcoming ones are not in the denominator."
          aside={<span className="aside">{n(rows.length)} rows · open one for the detail</span>}
        />
        <div className="tw">
          <table className="rt rt--lead">
            <thead>
              <tr>
                <th>Campaign</th>
                <th className="num">Booked</th><th className="num">Completed</th>
                <th className="num">No-shows</th><th className="num">Canceled</th>
                <th className="num">Bad leads</th><th className="num">Upcoming</th>
                <th className="num">Contract sent</th><th className="num">Sold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <>
                  <tr
                    className={`lrow${open === r.slug ? " is-open" : ""}`}
                    key={r.slug}
                    tabIndex={0}
                    role="button"
                    aria-expanded={open === r.slug}
                    onClick={() => setOpen((c) => (c === r.slug ? null : r.slug))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen((c) => (c === r.slug ? null : r.slug));
                      }
                    }}
                  >
                    <td>
                      <b>{r.campaign}</b>
                      {r.flags.length > 0 && <span className="pill pill--bad">{r.flags.length}</span>}
                      {!r.tracker && <span className="tag"> no tracker tab</span>}
                    </td>
                    <td className="num">{fmtNum(r.booked)}</td>
                    {cell(r.completed, r.completed_rate_pct, has(r, "zero_completed"))}
                    {cell(r.no_show, r.no_show_rate_pct, has(r, "no_show_rate"))}
                    {cell(r.canceled, r.canceled_rate_pct, has(r, "canceled_rate"))}
                    {cell(r.bad_lead, r.bad_lead_rate_pct, has(r, "bad_lead_rate"))}
                    <td className="num">{fmtNum(r.pending)}</td>
                    <td className="num">{fmtNum(r.deal_stages.contract_sent || 0)}</td>
                    <td className="num">{fmtNum(r.services_sold)}</td>
                  </tr>
                  {open === r.slug && (
                    <tr className="ldet" key={`${r.slug}-d`}>
                      <td colSpan={9}>
                        {r.flags.length ? (
                          <ul className="flags flags--tight">
                            {r.flags.map((f, i) => (
                              <li className={`flag is-${f.level}`} key={i}>
                                <span className="flag__lv">{f.level === "red" ? "Over" : "Watch"}</span>
                                <div className="flag__b"><p className="flag__t">{f.message}</p></div>
                                <span className="flag__m" />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="okline">Nothing on this campaign is over a line.</p>
                        )}
                        {r.story && <p className="ljoin">{r.story}</p>}
                        <div className="cmixes">
                          <ChipRow
                            label="Deal stage"
                            counts={Object.fromEntries(
                              Object.entries(r.deal_stages).map(([k, c]) => [STAGE_LABEL[k] || k, c]),
                            )}
                          />
                          <ChipRow label="Brand" counts={r.brands} />
                          <ChipRow label="Source" counts={r.sources} />
                        </div>
                        <p className="ljoin">
                          {r.tracker
                            ? `Tracker join · ${fmtNum(r.tracker.leads)} leads, ${pct(r.tracker.ql_ratio_pct)} of them qualified, ${pct(r.tracker.booking_rate_pct)} of those booked${r.mrr ? ` · ${fmtMoney(r.mrr)} MRR sold` : ""}`
                            : "Not matched to a tracker vendor tab this month, so the QL-ratio and booking-rate checks could not run on it. That is different from passing them."}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><b>All campaigns</b></td>
                <td className="num">{fmtNum(t.booked)}</td>
                <td className="num">{fmtNum(t.completed)}</td>
                <td className="num">{fmtNum(t.no_show)}</td>
                <td className="num">{fmtNum(t.canceled)}</td>
                <td className="num">{fmtNum(t.bad_lead)}</td>
                <td className="num">{fmtNum(t.pending)}</td>
                <td className="num dim">—</td>
                <td className="num">{fmtNum(t.services_sold)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="band">
        <RuleHead
          title="The mix underneath"
          note={`Every booked demo carries a brand and a source. Across all ${n(rows.length)} campaigns they add to the same ${fmtNum(t.booked)}.`}
        />
        <div className="cmixes">
          <ChipRow label="Brand" counts={t.brands} />
          <ChipRow label="Source" counts={t.sources} />
        </div>
        {unjoined.length > 0 && (
          <p className="note">
            {unjoined.length === 1
              ? `${unjoined[0].campaign} is not matched to any tracker vendor tab — its ${unjoined[0].booked} demos are in the counts above and out of every cost figure, because there is no spend to divide by.`
              : `${unjoined.length} campaigns are not matched to a tracker vendor tab. Their demos are in the counts above and out of every cost figure, because there is no spend to divide by.`}
          </p>
        )}
        {a.unmatched_campaigns && a.unmatched_campaigns.length > 0 && (
          <p className="help">
            Unmatched in the sheet: {a.unmatched_campaigns.join(", ")}.
          </p>
        )}
      </section>
    </>
  );
}
