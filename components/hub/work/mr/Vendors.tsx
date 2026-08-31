"use client";

/** One vendor, on one captured day.
 *
 *  The dossier is the whole snapshot the agent stored for that vendor — every
 *  field, in the sections the workbook groups them into, not a curated handful.
 *  A desk that shows five of forty fields is a desk somebody has to leave to
 *  answer the sixth question.
 *
 *  The day strip is the load-bearing part: a figure here belongs to a date, and
 *  a date somebody picked on one vendor may not exist on another. The strip
 *  decides which day is on screen rather than the URL, so switching vendors can
 *  never show a date that vendor never captured.
 */

import { useEffect, useState } from "react";
import { mrVendorDetail, type MrVendorDetail } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n } from "../../model";
import type { MrData_ } from "../MrWorkspace";
import { fmtMoney, fmtNum, humanMetric } from "./parts";

const MONEYISH = /(spend|budget|cost|amount|revenue|mrr|cac|fees|pipeline|weighted)/;

function fmtField(key: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number") return String(v);
  if (key.endsWith("_pct")) return `${v}%`;
  return MONEYISH.test(key) ? fmtMoney(v) : fmtNum(v);
}

export function MrVendors({ data }: { data: MrData_ }) {
  const session = useLoadSession();
  const vendors = data.deltas || [];
  const [slug, setSlug] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [detail, setDetail] = useState<Load<MrVendorDetail>>(loadPending);

  const current = vendors.find((v) => v.vendor_slug === slug) || vendors[0] || null;
  const currentSlug = current?.vendor_slug || "";

  useEffect(() => {
    if (!currentSlug) return;
    void session.run(
      "mr-vendor",
      (s) => mrVendorDetail(currentSlug, date || undefined, { signal: s }),
      setDetail,
      "That vendor's dossier could not be read.",
      { keepStale: true },
    );
  }, [session, currentSlug, date]);

  if (!vendors.length) {
    return (
      <>
        <PageHead
          statement={<>No vendor snapshot has been <b>captured yet</b>.</>}
          lede="A dossier is one vendor on one captured day. Until a snapshot exists there is no day to open."
        />
        <Blank title="Nothing captured">
          Snapshots are written when the tracker is pulled. Pull it once from the Data panel and the
          dossiers fill in.
        </Blank>
      </>
    );
  }

  const d = detail.data;
  const dates = d?.dates || [];
  const shown = d?.snapshot.date || date;

  return (
    <>
      <PageHead
        statement={<>The whole snapshot, <b>field for field</b>.</>}
        lede="Every figure the workbook carried for this vendor on the day it was captured — not a curated handful, because a desk that shows five of forty fields is one somebody has to leave to answer the sixth question."
      />

      <div className="facets">
        {vendors.map((v) => (
          <button
            type="button"
            key={v.vendor_slug}
            className={`facet${v.vendor_slug === currentSlug ? " is-on" : ""}`}
            onClick={() => { setSlug(v.vendor_slug); setDate(""); }}
          >
            {v.vendor}
          </button>
        ))}
      </div>

      {dates.length > 1 && (
        <div className="facets" style={{ marginBottom: 20 }}>
          {dates.map((day) => (
            <button
              type="button"
              key={day}
              className={`facet${day === shown ? " is-on" : ""}`}
              onClick={() => setDate(day)}
            >
              {day.slice(5)}
            </button>
          ))}
        </div>
      )}

      {detail.phase === "loading" && !d ? (
        <Wait what={`Opening ${current?.vendor ?? "the dossier"}`} rows={5} />
      ) : detail.phase === "failed" && !d ? (
        <Oops what="That dossier could not be read." error={detail.error || ""} onRetry={data.reload} />
      ) : !d ? null : (
        <>
          <section className="band">
            <RuleHead
              title={`${d.vendor} · ${d.snapshot.date}`}
              note={`Captured ${new Date(d.snapshot.captured_at).toLocaleString()} from tab ${d.gid}. ${
                shown === dates[dates.length - 1]
                  ? "This is the newest capture."
                  : "An older capture — the figures below are that day's, not today's."
              }`}
              aside={<span className="aside">{n(dates.length)} day{dates.length === 1 ? "" : "s"} on file</span>}
            />
            <DossierGrid block={d.snapshot.canonical.team_overall} title="Team overall" />
          </section>

          {Object.entries(d.snapshot.canonical.channels).map(([channel, block]) => (
            <section className="band" key={channel}>
              <RuleHead title={humanMetric(channel)} note="The same fields, for this channel alone." />
              <DossierGrid block={block} title={channel} />
            </section>
          ))}

          <section className="band">
            <RuleHead
              title="What moved"
              note={
                d.delta.days > 1
                  ? `Against the capture ${d.delta.days} days earlier, on ${d.delta.since ?? "?"}.`
                  : "Against yesterday's capture."
              }
              aside={d.delta.corrected ? <span className="tag tag--warn">corrected</span> : undefined}
            />
            <div className="tw">
              <table className="rt">
                <thead>
                  <tr><th>Field</th><th className="num">Moved</th><th className="num">Month to date</th></tr>
                </thead>
                <tbody>
                  {Object.entries(d.delta.blocks.team_overall.additive).map(([key, f]) => (
                    <tr key={key}>
                      <td>{humanMetric(key)}</td>
                      <td className={`num${f.delta === null ? " dim" : ""}`}>
                        {f.delta === null ? "—" : `${f.delta > 0 ? "▲ " : f.delta < 0 ? "▼ " : ""}${fmtField(key, Math.abs(f.delta))}`}
                      </td>
                      <td className={`num${f.mtd === null ? " dim" : ""}`}>{fmtField(key, f.mtd)}</td>
                    </tr>
                  ))}
                  {Object.entries(d.delta.blocks.team_overall.rates).map(([key, f]) => (
                    <tr key={`r-${key}`}>
                      <td>
                        {humanMetric(key)}
                        <span className="opt" style={{ display: "block", fontSize: 11 }}>
                          {f.mode === "recomputed"
                            // A rate is not additive: yesterday's 40% plus today's
                            // 40% is not 80%, so it has to be recomputed rather
                            // than differenced. Saying which happened matters.
                            ? "recomputed from the day's counts"
                            : "month-to-date, as the sheet stored it"}
                        </span>
                      </td>
                      <td className="num dim">—</td>
                      <td className={`num${f.value === null ? " dim" : ""}`}>{fmtField(key, f.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function DossierGrid({ block, title }: { block: Record<string, unknown>; title: string }) {
  const entries = Object.entries(block);
  if (!entries.length) {
    return <p className="calm">Nothing was captured under {title} on this day.</p>;
  }
  const flat = entries.filter(([, v]) => v === null || typeof v !== "object");
  const nested = entries.filter(([, v]) => v !== null && typeof v === "object") as [string, Record<string, unknown>][];

  return (
    <div className="vgrid">
      {flat.length > 0 && (
        <div className="vsec">
          <h4>Headline</h4>
          {flat.map(([k, v]) => (
            <div className="vrow" key={k}><span>{humanMetric(k)}</span><b>{fmtField(k, v)}</b></div>
          ))}
        </div>
      )}
      {nested.map(([k, node]) => (
        <div className="vsec" key={k}>
          <h4>{humanMetric(k)}</h4>
          {Object.entries(node).map(([k2, v2]) => (
            <div className="vrow" key={k2}><span>{humanMetric(k2)}</span><b>{fmtField(k2, v2)}</b></div>
          ))}
        </div>
      ))}
    </div>
  );
}
