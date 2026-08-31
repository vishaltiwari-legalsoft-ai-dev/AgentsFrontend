"use client";

/** The desk: the month's official summary, what is over a line, and the day's
 *  movement.
 *
 *  The eight figures at the top come from the **vendor snapshots**, not from the
 *  pulled tracker — the tracker has no qualified-demo or services-sold concept
 *  at all, so a summary built from it would be missing two of the eight and
 *  quietly wrong on a third. The panel names which it read.
 *
 *  Every figure is judged against a line from this account's own targets. A
 *  figure with no line under it says so rather than being drawn plain and left
 *  to look approved.
 */

import type { Load } from "@/lib/load";
import type { MrPortfolio, MrVendorDelta } from "@/lib/api";
import { PageHead, RuleHead, Oops, Wait } from "../../ui";
import { n, word } from "../../model";
import type { MrData_ } from "../MrWorkspace";
import { FlagList, LedCell, PaceSpine, SourceList, bandTone, fmtMoney, fmtNum, overs, pct } from "./parts";

export function MrDesk({
  data, deltas, portfolio,
}: {
  data: MrData_;
  deltas: Load<MrVendorDelta[]>;
  portfolio: Load<MrPortfolio>;
}) {
  const { overview, flagCount, goSection } = data;
  const p = data.portfolio;
  const t = data.targets?.thresholds || {};
  const bench = p?.benchmarks;

  const cpqlRed = t.cost_per_qualified_lead_red ?? bench?.cpql_red;
  const cpqdbMax = t.cost_per_booking_flag ?? bench?.cpqdb_max;
  const showMin = t.show_rate_min ?? bench?.show_rate_min;

  const totals = overview.totals;

  return (
    <>
      <PageHead
        statement={
          flagCount
            ? <><b>{n(flagCount)} figure{flagCount === 1 ? " is" : "s are"}</b> over a line.</>
            : <><b>Nothing is over a line</b> this month.</>
        }
        lede="Every one of those lines is a number somebody set, and this desk will take you to it. The month's official summary is the eight figures the desk agreed on, judged against the same lines — never a threshold typed into a screen."
      />

      <section className="band">
        <RuleHead
          title={`Official summary · ${overview.month || "this month"}`}
          note={
            p
              ? `From the vendor snapshots — ${n(p.vendors)} of them, captured ${p.date}. Not from the pulled tracker, which has no qualified-demo or services-sold concept at all.`
              : "Reading the vendor snapshots."
          }
          aside={p ? <span className="aside">as of {p.date}</span> : undefined}
        />

        {portfolio.phase === "loading" && !p ? (
          <Wait what="Reading the vendor snapshots" rows={2} />
        ) : portfolio.phase === "failed" && !p ? (
          <Oops
            what="The official summary could not be read."
            error={portfolio.error || ""}
            onRetry={data.reload}
          />
        ) : !p ? null : (
          <>
            <div className="led">
              <LedCell
                label="Spend"
                value={fmtMoney(p.total_spend)}
                note={`of ${fmtMoney(p.total_budget)} budget`}
              />
              <LedCell
                label="Qualified leads"
                value={fmtNum(p.qualified_leads)}
                note={p.leads ? `${((p.qualified_leads / p.leads) * 100).toFixed(1)}% of ${fmtNum(p.leads)} leads` : "no leads on record"}
              />
              <LedCell
                label="Qualified demos booked"
                value={fmtNum(p.qual_demos_booked)}
                note={`of ${fmtNum(p.demos_completed + p.qual_demos_booked)} in the funnel`}
              />
              <LedCell
                label="Demos completed"
                value={fmtNum(p.demos_completed)}
                tone={bandTone(p.show_rate_pct, showMin, true)}
                note={p.show_rate_pct === null ? "show rate not computable" : `${pct(p.show_rate_pct)} show rate`}
              />
              <LedCell
                label="Cost per qualified lead"
                value={fmtMoney(p.cost_per_qualified_lead)}
                tone={overs(p.cost_per_qualified_lead, cpqlRed)}
                note={cpqlRed === undefined ? "no line set for this one" : `red at ${fmtMoney(cpqlRed)}`}
              />
              <LedCell
                label="Cost per qualified demo"
                value={fmtMoney(p.cost_per_qual_demo_booked)}
                tone={bandTone(p.cost_per_qual_demo_booked, cpqdbMax, false)}
                note={cpqdbMax === undefined ? "no line set for this one" : `target under ${fmtMoney(cpqdbMax)}`}
              />
              <LedCell
                label="Cost per completed demo"
                value={fmtMoney(p.cost_per_demo_completed)}
                note="no line ships for this one"
              />
              <LedCell
                label="Services sold"
                value={fmtNum(p.services_sold)}
                note={p.services_sold ? `${fmtMoney(p.total_spend / p.services_sold)} to win one` : "none this month"}
              />
            </div>
            <PaceSpine pace={data.pace} />
          </>
        )}
      </section>

      <section className="band">
        <RuleHead
          title="Over a line"
          note="Each one names the line it crossed. Open it to change the number."
          aside={flagCount ? <span className="aside">{n(flagCount)} in all</span> : undefined}
        />
        <FlagList groups={overview.flag_summary} tight onOpenLines={() => goSection("lines")} />
      </section>

      <section className="band">
        <RuleHead
          title="Since yesterday"
          note="The day's movement per vendor, read off two frozen snapshots rather than the live sheet — which is why a retroactive edit shows up as corrected instead of silently changing history."
        />
        {deltas.phase === "loading" && !deltas.data ? (
          <Wait what="Comparing the last two snapshots" rows={4} />
        ) : deltas.phase === "failed" && !deltas.data ? (
          <Oops what="The day's movement could not be read." error={deltas.error || ""} onRetry={data.reload} />
        ) : !deltas.data?.length ? (
          <p className="calm">
            Only one snapshot exists so far, so there is nothing to compare it against. The next
            capture makes this table.
          </p>
        ) : (
          <div className="tw">
            <table className="rt">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Spend</th>
                  <th className="num">Leads</th>
                  <th className="num">Qualified</th>
                  <th className="num">Booked</th>
                  <th className="num">Completed</th>
                  <th>Read from</th>
                </tr>
              </thead>
              <tbody>
                {deltas.data.map((d) => {
                  const a = d.blocks.team_overall.additive;
                  const cell = (key: string, money?: boolean) => {
                    const f = a[key];
                    if (!f || f.delta === null) return <td className="num dim" key={key}>—</td>;
                    if (f.delta === 0) return <td className="num" key={key}>{money ? "$0" : "0"}</td>;
                    return (
                      <td className="num" key={key}>
                        {f.delta > 0 ? "▲ " : "▼ "}
                        {money ? fmtMoney(Math.abs(f.delta)) : fmtNum(Math.abs(f.delta))}
                      </td>
                    );
                  };
                  return (
                    <tr key={d.vendor_slug}>
                      <td>
                        <button type="button" className="lnk" onClick={() => goSection("vendors")}>
                          {d.vendor}
                        </button>
                      </td>
                      {cell("spend", true)}
                      {cell("leads")}
                      {cell("qualified_leads")}
                      {cell("demos_booked")}
                      {cell("demos_completed")}
                      <td className="dim">
                        {d.days > 1 ? `${word(d.days)} days, since ${d.since ?? "?"}` : "yesterday"}
                        {d.corrected && <span className="tag tag--warn"> corrected</span>}
                        {d.month_start && <span className="tag"> month start</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="band">
        <RuleHead
          title="Where every figure came from"
          note="One workbook, read whole, plus whatever has been uploaded by hand. This agent has no advertising API and never had one — a platform below is a file somebody exported, not a feed."
          aside={<span className="aside">{n(overview.sources.length)} in use</span>}
        />
        <SourceList sources={overview.sources} />
      </section>

      {totals && (
        <p className="soon-note">
          The channel totals the tracker itself carries ({fmtNum(totals.leads)} leads,{" "}
          {fmtMoney(totals.spend)} spend) are close to but not identical with the snapshot figures
          above, because the two are captured at different moments. The summary is the snapshot,
          and that is the one the reports are written from.
        </p>
      )}
    </>
  );
}
