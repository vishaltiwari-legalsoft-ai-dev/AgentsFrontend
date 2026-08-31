"use client";

/** The pieces every Marketing Research panel is built from.
 *
 *  This agent's whole job is to say which figures are over a line, so two
 *  objects carry the idea: the LED cell, which prints a figure with the line it
 *  was judged against underneath it, and the flag, which never appears without
 *  naming the line it crossed and offering the way to it.
 *
 *  The rule that runs through all of it: **a line is a number somebody set.**
 *  Nothing here hard-codes a threshold — every one comes from the account's own
 *  targets, and the Lines panel is where they are changed.
 */

import type { ReactNode } from "react";
import type { MrFlagGroup, MrSource } from "@/lib/api";
import { fmtMoney, fmtNum, sourceLabel } from "@/components/console/mr/format";
import type { PaceRead } from "@/components/console/mr/pace";
import { n } from "../../model";

export type Tone = "good" | "bad" | null;

/** A ceiling only ever goes red. Painting everything under it green would put
 *  eight colours on a screen whose whole job is to make two of them findable. */
export const overs = (v: number | null, line: number | undefined): Tone =>
  v === null || line === undefined ? null : v >= line ? "bad" : null;

/** A band the desk aims for reads both ways, because sitting under the bottom
 *  of it is also information. */
export const bandTone = (v: number | null, line: number | undefined, above: boolean): Tone =>
  v === null || line === undefined ? null : (above ? v >= line : v < line) ? "good" : "bad";

export function LedCell({
  label, value, tone, note,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  note?: ReactNode;
}) {
  return (
    <div className="led__c">
      <b className={tone ? `led__c--${tone}` : undefined}>{value}</b>
      <span>{label}</span>
      {note && <em>{note}</em>}
    </div>
  );
}

/** Ahead or behind for the day we are on — the desk's standing question, and
 *  the one the endpoint already answers. `readPace` decides the verdict; this
 *  only draws it. */
export function PaceSpine({ pace }: { pace: PaceRead | null }) {
  if (!pace) {
    return (
      <p className="help" style={{ marginTop: 14 }}>
        No budget is set for this month, so there is nothing to be ahead or behind of.
      </p>
    );
  }
  const verdict = pace.state === "on"
    ? "on pace"
    : `${fmtMoney(Math.abs(pace.deltaMoney))} ${pace.state} pace`;
  return (
    <div className={`pacex pacex--${pace.state}`}>
      <div className="pacex__track">
        <div className="pacex__fill" style={{ width: `${Math.min(100, pace.barPct)}%` }} />
        <div className="pacex__mark" style={{ left: `${Math.min(100, pace.expectedPct)}%` }} aria-hidden="true" />
      </div>
      <p className="pacex__read">
        <b>{verdict}</b>
        <span>
          {pace.spentPct.toFixed(1)}% of budget spent · {pace.expectedPct.toFixed(1)}% expected by
          day {pace.day} of {pace.daysInMonth}
          {pace.state === "on" ? " · inside the band, so it is not a finding" : ""}
        </span>
      </p>
    </div>
  );
}

/** What the backend already grouped for us: one row per metric that is over
 *  something, with the count and the sentence it wrote. */
export function FlagList({
  groups, tight, onOpenLines,
}: {
  groups: MrFlagGroup[];
  tight?: boolean;
  onOpenLines?: (metric: string | null) => void;
}) {
  if (!groups.length) {
    return (
      <p className="okline">
        Nothing over a line here. Every figure is inside the numbers the desk set.
      </p>
    );
  }
  return (
    <ul className={`flags${tight ? " flags--tight" : ""}`}>
      {groups.map((f, i) => (
        <li className={`flag is-${f.level}`} key={`${f.metric ?? "x"}-${i}`}>
          <span className="flag__lv">{f.level === "red" ? "Over" : "Watch"}</span>
          <div className="flag__b">
            <p className="flag__t">{f.text}</p>
          </div>
          <span className="flag__m">
            {f.count > 1 ? `${n(f.count)} of them` : ""}
            {onOpenLines && f.metric && (
              <em>
                <button type="button" className="lnk" onClick={() => onOpenLines(f.metric)}>
                  {humanMetric(f.metric)}
                </button>
              </em>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A count of things by name, as chips. Used for the brand and source mix
 *  under a campaign — every booked demo carries both. */
export function ChipRow({ label, counts }: { label: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="cmix">
      <span className="cmix__l">{label}</span>
      {entries.map(([k, c]) => <span className="tag" key={k}>{k} · {c}</span>)}
    </div>
  );
}

/** Where a figure came from. This agent has no advertising API and never had
 *  one — a platform here is a file somebody exported or a tab in the workbook,
 *  and the panel says so rather than letting "source" imply a live feed. */
export function SourceList({ sources }: { sources: MrSource[] }) {
  if (!sources.length) {
    return <p className="calm">Nothing has been read yet, so there is no source to name.</p>;
  }
  return (
    <ul className="srcf">
      {sources.map((s) => {
        const { src, tab } = sourceLabel(s.platform);
        return (
          <li className="srcf__r" key={s.platform}>
            <span className="g">{(src || "?").slice(0, 2).toUpperCase()}</span>
            <span className="srcf__n">{src}{tab ? ` · ${tab}` : ""}</span>
            <span className="srcf__m">
              {fmtNum(s.metrics)} metric rows{s.leads ? `, ${fmtNum(s.leads)} leads` : ""}
              {s.generated_at ? ` · read ${new Date(s.generated_at).toLocaleDateString()}` : ""}
            </span>
            <span className="st done">Reading</span>
          </li>
        );
      })}
    </ul>
  );
}

/** `cost_per_qualified_lead` is not a label. */
export function humanMetric(key: string): string {
  return key
    .replace(/_pct$/, " %")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** A rate the workbook could not produce. Never a zero — a zero show rate is a
 *  finding, and "we could not compute it" is not. */
export const pct = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? "—" : `${v.toFixed(digits)}%`;

export { fmtMoney, fmtNum };
