"use client";

/** The lines: the numbers that decide what this agent calls a problem.
 *
 *  In the desk this replaces they sit at the bottom of the fourth tab, behind an
 *  anchor nav, nowhere near a flag. Here they are a panel of their own, every
 *  flag on every other panel links to them, and moving one moves the Desk, the
 *  vendor dossiers and the lead table together — because they all read the same
 *  saved thresholds.
 *
 *  A line is saved on blur rather than on every keystroke, and a save that fails
 *  puts the old number back. A threshold left looking changed when it is not is
 *  the worst possible failure for a screen whose whole job is deciding what
 *  counts as wrong.
 */

import { useEffect, useState } from "react";
import { mrSaveTargets, type MrTargets } from "@/lib/api";
import type { Load } from "@/lib/load";
import { PageHead, RuleHead, Oops, Wait } from "../../ui";
import { n, word } from "../../model";
import type { ToastFn } from "../../context";
import type { MrData_ } from "../MrWorkspace";
import { humanMetric } from "./parts";
import { METRICS_WITHOUT_A_LINE, caughtBy, lineLabel, lineWhat, unattributed } from "./lineMap";

export function MrLines({
  data, targets, setTargets, onToast,
}: {
  data: MrData_;
  targets: Load<MrTargets>;
  setTargets: (t: Load<MrTargets>) => void;
  onToast: ToastFn;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const t = targets.data;

  useEffect(() => {
    if (!t) return;
    setDraft(Object.fromEntries(Object.entries(t.thresholds).map(([k, v]) => [k, String(v)])));
  }, [t]);

  if (targets.phase === "loading" && !t) return <Wait what="Reading the lines" rows={5} />;
  if (targets.phase === "failed" && !t) {
    return <Oops what="The lines could not be read." error={targets.error || ""} onRetry={data.reload} />;
  }
  if (!t) return null;

  const groups = data.overview.flag_summary;
  // Lines that raise flags first, and the ones currently catching something at
  // the top of those: this panel is read to find out what is firing.
  const keys = Object.keys(t.thresholds).sort((a, b) => {
    const ca = caughtBy(a, groups);
    const cb = caughtBy(b, groups);
    const rank = (c: number | null) => (c === null ? 2 : c > 0 ? 0 : 1);
    return rank(ca) - rank(cb) || (cb ?? 0) - (ca ?? 0) || lineLabel(a).localeCompare(lineLabel(b));
  });
  const live = keys.filter((k) => (caughtBy(k, groups) ?? 0) > 0);
  const orphans = unattributed(groups);

  const save = async (key: string) => {
    const raw = draft[key];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      onToast(`${humanMetric(key)} has to be a number, so that change was not saved.`, "error");
      setDraft((d) => ({ ...d, [key]: String(t.thresholds[key]) }));
      return;
    }
    if (value === t.thresholds[key]) return;
    setSaving(key);
    try {
      const next = await mrSaveTargets({ thresholds: { ...t.thresholds, [key]: value } });
      setTargets({ phase: "ready", data: next, error: null });
      onToast(`${humanMetric(key)} is now ${value}. The Desk, the dossiers and the lead table all move with it.`, "ok");
      // Everything else on this workspace reads the saved thresholds, so the
      // whole surface has to be re-read — not just this panel.
      data.reload();
    } catch (e: unknown) {
      // A line that did not save must not be left looking changed.
      setDraft((d) => ({ ...d, [key]: String(t.thresholds[key]) }));
      onToast(e instanceof Error ? e.message : "That line did not save. The old number is back.", "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <PageHead
        statement={
          <>
            <b>{n(keys.length)} numbers</b>
            {live.length > 0 ? <>, {word(live.length)} of which {live.length === 1 ? "is" : "are"} catching something right now,</> : <>, none of them catching anything right now,</>}
            {" "}decide what this agent calls a problem.
          </>
        }
        lede="In the desk this replaces they sit at the bottom of the fourth tab, behind an anchor nav, nowhere near a flag. Here each one says what it is catching, and moving it moves the Desk, the vendor dossiers and the lead table together."
      />

      <section className="band">
        <RuleHead
          title="The lines"
          note="A line with a count beside it is currently catching something. Change one and read the count."
          aside={
            <span className="aside">
              {data.flagCount ? `${n(data.flagCount)} caught` : "nothing caught"}
              {t.edited ? " · edited from the shipped defaults" : " · still the shipped defaults"}
            </span>
          }
        />
        <div className="tw">
          <table className="rt rt--lines">
            <thead>
              <tr><th>Line</th><th>What it decides</th><th className="num">Now</th><th className="num">Catching</th></tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const caught = caughtBy(key, groups);
                return (
                  <tr key={key}>
                    <td><b>{lineLabel(key)}</b></td>
                    <td>{lineWhat(key)}</td>
                    <td className="num">
                      <input
                        className="inp"
                        inputMode="decimal"
                        value={draft[key] ?? ""}
                        disabled={saving === key}
                        aria-label={humanMetric(key)}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        onBlur={() => void save(key)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        style={{ width: 110, textAlign: "right" }}
                      />
                    </td>
                    <td
                      className={`num${caught ? " is-over" : " dim"}`}
                      title={
                        caught === null
                          ? "This line does not raise a flag on its own — it marks a band the desk aims for."
                          : undefined
                      }
                    >
                      {/* A dash means two different things and the title says
                          which: no flag was raised, or this line never raises one. */}
                      {caught === null ? "does not fire" : caught ? n(caught) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="help" style={{ marginTop: 14 }}>
          Saved when you leave the field. Nothing is recomputed on the server until then, so a
          half-typed number never fires a flag. A line marked <b>does not fire</b> marks a band the
          desk aims for rather than a ceiling it calls out — which is not the same as a line
          catching nothing.
        </p>
      </section>

      {orphans.length > 0 && (
        <section className="band">
          <RuleHead
            title="Findings that are not one of these lines"
            note="Raised by something other than a single number, so changing a line above will not move them."
          />
          <ul className="flags flags--tight">
            {orphans.map((g, i) => (
              <li className="flag is-warn" key={i}>
                <span className="flag__lv">Watch</span>
                <div className="flag__b">
                  <p className="flag__t">
                    {n(g.count)} from {humanMetric(g.metric || "")}
                  </p>
                  <p className="flag__then">
                    {METRICS_WITHOUT_A_LINE[g.metric || ""]
                      || "No line on this panel owns this one — it comes from somewhere else in the desk."}
                  </p>
                </div>
                <span className="flag__m" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(t.channel_goals).length > 0 && (
        <section className="band">
          <RuleHead
            title="Per-channel goals"
            note="The bands each channel is aimed at. These come from the account's 2026 goals rather than from a threshold typed into a screen."
          />
          <div className="tw">
            <table className="rt">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Demo booked, low</th><th className="num">high</th>
                  <th className="num">Demo completed, low</th><th className="num">high</th>
                  <th className="num">Completed %</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(t.channel_goals).map(([channel, g]) => (
                  <tr key={channel}>
                    <td><b>{humanMetric(channel)}</b></td>
                    <td className="num">{g.cpd_booked_low}</td>
                    <td className="num">{g.cpd_booked_high}</td>
                    <td className="num">{g.cpd_completed_low}</td>
                    <td className="num">{g.cpd_completed_high}</td>
                    <td className="num">{g.completed_demo_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
