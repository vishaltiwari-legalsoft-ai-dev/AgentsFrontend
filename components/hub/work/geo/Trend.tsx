"use client";

/** Where your answers went, check by check.
 *
 *  Every answer in a check is in exactly one of three states, so the two lines
 *  are drawn as the boundaries between three named regions rather than as two
 *  series to decode. Stacking beats plotting here: the middle band is "they
 *  said your name and did not link you", which is the whole reason to look at
 *  this panel.
 *
 *  Two honesty rules the live data forces on the chart:
 *
 *  - **Shares, not counts.** The question set grows. Plotting counts would show
 *    a rise that is really more questions being asked, so every point is a
 *    share of the answers stored at that check, and the hover readout carries
 *    the counts the shares were computed from.
 *
 *  Underneath, the ledger pairs each check's measurement with the sweep that
 *  produced it — when it ran, how long, what stopped it, and where the Action
 *  Plan stood — so "the score moved" and "the planned work happened" can be
 *  read side by side. The pairing lives in `runlog.ts`, which is pure and
 *  separately tested.
 *  - **A thin check says so.** The backend flags a point measured on far fewer
 *    answers than the rest of the series. It is real, it is drawn, and it is
 *    marked — dropping it would hide a sweep that half-finished.
 */

import { useEffect, useMemo, useState } from "react";
import {
  geoHistory,
  type GeoHistory,
  type GeoHistoryPoint,
  type GeoRunLogEntry,
  type GeoWeeklyPoint,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { dayLabel } from "@/components/console/geo/trend";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n } from "../../model";
import type { GeoData } from "../GeoWorkspace";
import { ENGINE_IDS, ENGINE_SHORT, engineName, rate } from "./parts";
import {
  deltaLabel,
  deltaTone,
  durationLabel,
  errorCount,
  mergeRunLedger,
  outcomeLabel,
  planLabel,
  timeLabel,
  triggerLabel,
  weekLabel,
  weeklyHeadline,
  type LedgerPair,
} from "./runlog";

const PLOT = { w: 940, h: 348, pad: { l: 40, r: 176, t: 26, b: 40 } };

/** How far back the history reads. Longer than the report window on purpose:
 *  the report answers "where are we", this answers "which way is it going". */
const HISTORY_DAYS = 180;

interface Row {
  point: GeoHistoryPoint;
  label: string;
  answers: number;
  /** share of `answers`, 0-100 */
  named: number;
  /** share of `answers` that named AND linked. `null` when this point predates
   *  the split being recorded — see the note under the chart. */
  linked: number | null;
  /** the counts the shares came from, so nothing downstream re-derives a figure
   *  from a rounded percentage */
  nNamed: number;
  nLinked: number | null;
}

export function GeoTrend({ data }: { data: GeoData }) {
  const session = useLoadSession();
  const [hist, setHist] = useState<Load<GeoHistory>>(loadPending);
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    void session.run(
      "geo-history",
      (s) => geoHistory(data.brandId, HISTORY_DAYS, { signal: s }),
      setHist,
      "The history could not be read.",
      { keepStale: true },
    );
  }, [session, data.brandId]);

  const rows = useMemo<Row[]>(() => {
    const pts = hist.data?.points || [];
    return pts
      // A point with no measured answers has no share to plot. It is not a zero
      // — nothing was measured — so it is left out of the chart and said in
      // words underneath instead.
      .filter((p) => p.n_measured > 0 && p.mention_rate !== null)
      .map((p) => {
        // The split is only real when the point carries the counts. Deriving it
        // from the two rates is what produced "named, no link: -9" on a real
        // brand: the citation rate has a different, smaller denominator.
        const nNamed = p.n_named ?? Math.round((p.mention_rate ?? 0) * p.n_measured);
        const nLinked = p.n_named_cited ?? null;
        return {
          point: p,
          label: dayLabel(p.date),
          answers: p.n_measured,
          named: Math.round((p.mention_rate ?? 0) * 100),
          linked: nLinked === null ? null : Math.round((nLinked / p.n_measured) * 100),
          nNamed,
          nLinked,
        };
      });
  }, [hist.data]);

  // Every stored point — including days nothing could be measured on — paired
  // with the sweep that produced it. Runs that measured nothing still appear:
  // a check that died half-way is exactly what this ledger exists to show.
  const pairs = useMemo(
    () => mergeRunLedger(hist.data?.points ?? [], hist.data?.runs ?? []),
    [hist.data],
  );

  if (hist.phase === "loading" && !hist.data) return <Wait what="Reading the history" rows={6} />;
  if (hist.phase === "failed" && !hist.data) {
    return <Oops what="The history could not be read." error={hist.error || ""} onRetry={data.reload} />;
  }

  const skipped = (hist.data?.points.length || 0) - rows.length;

  if (rows.length < 2) {
    return (
      <>
        <PageHead
          statement={rows.length === 0 ? <>Nothing has been measured yet.</> : <>One check so far.</>}
          lede="A trend needs two checks to be a trend. The chart appears once there is a second one to compare against."
        />
        <Blank title={rows.length === 0 ? "No checks stored" : "Only one check stored"}>
          Checks run on a schedule, and you can start one from the Overview. Each one puts every
          enabled question to all four engines and stores what came back.
        </Blank>
        {pairs.length > 0 && (
          <section className="band">
            <RuleHead
              title="Every check"
              note="What each check did — even the ones that came back with nothing measurable."
            />
            <CheckLedger pairs={pairs} />
          </section>
        )}
      </>
    );
  }

  const weekly = hist.data?.weekly ?? [];
  const weeklySent = hist.data?.weekly !== undefined;

  const { w, h, pad } = PLOT;
  const len = rows.length;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (len - 1);
  const y = (v: number) => pad.t + (1 - v / 100) * (h - pad.t - pad.b);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const back = (vals: number[]) => vals.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).reverse().join(" L");

  const named = rows.map((r) => r.named);
  // Every point has to carry the split, or the chart draws two bands instead of
  // three. A stack where some points know the middle band and others guess it
  // is not a measurement.
  const hasSplit = rows.every((r) => r.linked !== null);
  const linked = rows.map((r) => r.linked ?? 0);
  const now = rows[len - 1];
  const first = rows[0];
  const right = w - pad.r + 16;
  const labelY = (a: number, b: number) => y((a + b) / 2) + 4;

  const nowBare = now.nLinked === null ? null : now.nNamed - now.nLinked;
  const nowAbsent = now.answers - now.nNamed;

  const cursor = at === null ? len - 1 : Math.max(0, Math.min(len - 1, at));
  const read = rows[cursor];

  const region = (cls: string, label: string, count: number, top: number, bottom: number) => (
    <text className={`rlabel ${cls}`} x={right} y={labelY(top, bottom)}>
      <tspan className="rlabel__n">{n(count)}</tspan>
      <tspan className="rlabel__t" x={right} dy="15">{label}</tspan>
    </text>
  );

  return (
    <>
      <PageHead
        statement={
          now.named > first.named
            ? <>Your naming rate is <b>up from {first.named}% to {now.named}%</b> since {first.label}.</>
            : now.named < first.named
              ? <>Your naming rate is <b>down from {first.named}% to {now.named}%</b> since {first.label}.</>
              : <>Your naming rate is <b>flat at {now.named}%</b> since {first.label}.</>
        }
        lede={
          <>
            {n(len)} checks since {first.label}, each a pass of your buyer questions through the
            engines. The chart splits every stored answer into the three states it can be in, as a
            share — the question set grows, so counts would show a rise that was really more
            questions.
          </>
        }
      />

      <div className="figures figures--key">
        {now.nLinked !== null && (
          <div className="figure">
            <i className="key" aria-hidden="true" />
            <b>{n(now.nLinked)}</b>
            <h3>Named and linked</h3>
            <p>
              The engine said your name and pointed at your site
              {first.nLinked !== null ? `. ${n(first.nLinked)} of ${n(first.answers)} on ${first.label}` : ""}.
            </p>
          </div>
        )}
        {nowBare !== null ? (
          <div className="figure">
            <i className="key key--bare" aria-hidden="true" />
            <b>{n(nowBare)}</b>
            <h3>Named, no link</h3>
            <p>Your name was said but no link followed, so the reader has nowhere to go.</p>
          </div>
        ) : (
          // Without the split these checks are only two states, and the row has
          // to read as two rather than leaving a third of it blank.
          <div className="figure">
            <i className="key key--bare" aria-hidden="true" />
            <b>{n(now.nNamed)}</b>
            <h3>Named</h3>
            <p>
              The engine said your name. These checks did not record whether it also linked you, so
              that half is not split out.
            </p>
          </div>
        )}
        <div className="figure">
          <i className="key key--absent" aria-hidden="true" />
          <b>{n(nowAbsent)}</b>
          <h3>Never named</h3>
          <p>
            The engine answered the buyer without you in it. {n(first.answers - first.nNamed)} of{" "}
            {n(first.answers)} on {first.label}.
          </p>
        </div>
      </div>

      <section className="band">
        <RuleHead
          title={`Where your ${n(now.answers)} answers went`}
          note="Share of the answers stored at each check. Move along the chart for the exact split."
        />
        <div className="pwrap">
          <div className="plot">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              role="img"
              aria-label={
                hasSplit && now.nLinked !== null && nowBare !== null
                  ? `Of ${now.answers} answers stored on ${now.label}, ${now.nLinked} named you and linked your site, ${nowBare} named you without a link, and ${nowAbsent} never named you. On ${first.label}, of ${first.answers} answers, ${first.nNamed} named you and ${first.answers - first.nNamed} did not.`
                  : `Of ${now.answers} answers stored on ${now.label}, ${now.nNamed} named you and ${nowAbsent} did not. On ${first.label}, of ${first.answers} answers, ${first.nNamed} named you.`
              }
              onMouseMove={(e) => {
                const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const px = ((e.clientX - box.left) / box.width) * w;
                const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (len - 1));
                setAt(Math.max(0, Math.min(len - 1, i)));
              }}
              onMouseLeave={() => setAt(null)}
            >
              <path className="fill fill--absent" d={`M${x(0)} ${y(100)} L${x(len - 1)} ${y(100)} L${back(named)} Z`} />
              {hasSplit ? (
                <>
                  <path className="fill fill--bare" d={`${path(named)} L${back(linked)} Z`} />
                  <path className="fill fill--linked" d={`${path(linked)} L${x(len - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} />
                </>
              ) : (
                <path className="fill fill--bare" d={`${path(named)} L${x(len - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} />
              )}

              {[25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} />
                  <text className="axis" x={pad.l - 9} y={y(v) + 4} textAnchor="end">{v}%</text>
                </g>
              ))}
              <line className="base" x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} />

              <path className="line line--named" d={path(named)} />
              {hasSplit && <path className="line line--linked" d={path(linked)} />}
              {named.map((v, i) => (
                <circle
                  key={`n${i}`}
                  className="dot dot--named"
                  cx={x(i)}
                  cy={y(v)}
                  r={rows[i].point.partial ? 3.6 : 2.6}
                />
              ))}
              {hasSplit && linked.map((v, i) => <circle key={`l${i}`} className="dot dot--linked" cx={x(i)} cy={y(v)} r="2.6" />)}

              {region("is-absent", "never named", nowAbsent, named[len - 1], 100)}
              {hasSplit && nowBare !== null
                ? region("is-bare", "named, no link", nowBare, linked[len - 1], named[len - 1])
                : region("is-bare", "named", now.nNamed, 0, named[len - 1])}
              {hasSplit && now.nLinked !== null
                && region("is-linked", "named and linked", now.nLinked, 0, linked[len - 1])}

              {rows.map((r, i) => (
                (len <= 10 || i % Math.ceil(len / 8) === 0 || i === len - 1) && (
                  <text key={r.point.date} className="axis" x={x(i)} y={h - 14} textAnchor="middle">{r.label}</text>
                )
              ))}

              <line className="cross" x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={y(0)} />
              <circle className="knob" cx={x(cursor)} cy={y(named[cursor])} r="4.5" />
              <circle className="knob" cx={x(cursor)} cy={y(linked[cursor])} r="4.5" />
            </svg>
            <div className="readout">
              <b>{read.label}</b>
              <span>
                {n(read.answers)} answers · {read.named}% named
                {read.linked !== null ? ` · ${read.linked}% linked` : ""}
              </span>
              <span>
                {read.nLinked !== null
                  ? `${n(read.nLinked)} linked · ${n(read.nNamed - read.nLinked)} named only · ${n(read.answers - read.nNamed)} absent`
                  : `${n(read.nNamed)} named · ${n(read.answers - read.nNamed)} absent`}
              </span>
              {read.point.partial && <span className="readout__warn">Measured on far fewer answers than the rest — real, but thin.</span>}
            </div>
          </div>
        </div>
        {!hasSplit && (
          <p className="help" style={{ marginTop: 14 }}>
            The chart shows two bands rather than three. Splitting &ldquo;named&rdquo; into linked
            and unlinked needs a count these checks did not record, and it cannot be taken from the
            citation rate &mdash; that rate is measured over answers carrying citations at all, a
            smaller population, so subtracting one from the other gives a number that can go
            negative. Checks from here on carry the split.
          </p>
        )}
        {skipped > 0 && (
          <p className="help" style={{ marginTop: 14 }}>
            {n(skipped)} stored point{skipped === 1 ? " is" : "s are"} not on the chart: nothing in
            {skipped === 1 ? " it" : " them"} could carry a mention, so there is no share to plot.
            Leaving {skipped === 1 ? "it" : "them"} out is not the same as plotting a zero.
          </p>
        )}
      </section>

      <section className="band">
        <RuleHead
          title="Week by week"
          note={
            weekly.length >= 2
              ? weeklyHeadline(hist.data?.trend?.since_last, weekly[weekly.length - 1].score ?? null)
              : "Each bar is one week's average score across its checks, out of 100."
          }
        />
        {weekly.length >= 2 ? (
          <>
            <div className="pwrap">
              <div className="plot">
                <WeekBars weeks={weekly} />
              </div>
            </div>
            <p className="help" style={{ marginTop: 10 }}>
              The average score of that week&rsquo;s checks, out of 100, with the change on the week
              before over each bar. A week with no check is left out, never drawn as zero; a dash is
              a week whose checks measured nothing.
              {weekly.some((wk) => wk.all_partial)
                ? " Faded bars are weeks where every check ran thin, so their average is provisional."
                : ""}
            </p>
          </>
        ) : (
          <p className="help">
            {weekly.length === 1
              ? `One week of checks so far (week of ${weekLabel(weekly[0].start) || weekly[0].week}: ${
                  weekly[0].score === null ? "nothing measurable" : `average ${Math.round(weekly[0].score)}`
                }). The bars appear when a second week gives this one something to compare against.`
              : weeklySent
                ? "No weekly averages yet. They appear once checks have stored scores."
                : "The server did not send weekly averages; they arrive with its next update."}
          </p>
        )}
      </section>

      <section className="band">
        <RuleHead title="Per engine" note="Share of that engine's answers naming you, at each check." />
        <div className="strip4">
          {ENGINE_IDS.map((id) => {
            const series = rows.map((r) => r.point.engines[id]).filter((v): v is number => v !== null && v !== undefined);
            const st = data.status[id];
            const live = st?.connected && (st.mode === "native" || st.mode === "serpapi");
            const last = series.length ? series[series.length - 1] : null;
            const start = series.length ? series[0] : null;
            return (
              <div key={id}>
                <h3>{engineName(id)}</h3>
                <span className={`mode ${live ? "live" : "proxy"}`}>
                  {st?.connected ? (live ? "live API" : st.mode === "proxy" ? "similar model" : st.mode) : "no key configured"}
                </span>
                <b className="big">{rate(last)}</b>
                <p>
                  {series.length < 2
                    ? "not enough checks to compare"
                    : `from ${rate(start)} at the first check on the chart`}
                </p>
                {series.length >= 2 && <Spark values={series.map((v) => Math.round(v * 100))} label={engineName(id)} />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="band">
        <RuleHead
          title="Every check"
          note="When each check ran, what it reached, what stopped it, and where the plan stood — so the score and the planned work can be read together."
        />
        <CheckLedger pairs={pairs} />
      </section>
    </>
  );
}

/** One bar per ISO week: height is that week's average score. A week the
 *  backend did not send had no sweep at all and gets no slot \u2014 an absence of
 *  measurement, not a zero. A week whose sweeps measured nothing is a dash. */
function WeekBars({ weeks }: { weeks: GeoWeeklyPoint[] }) {
  const w = 940, h = 190;
  const pad = { l: 40, r: 176, t: 30, b: 26 };
  const y = (v: number) => pad.t + (1 - v / 100) * (h - pad.t - pad.b);
  const y0 = y(0);
  const count = weeks.length;
  const slot = (w - pad.l - pad.r) / count;
  const bw = Math.min(34, Math.max(6, slot * 0.62));
  const cx = (i: number) => pad.l + (i + 0.5) * slot;
  const every = Math.ceil(count / 13);
  const last = weeks[count - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Average score by week, ${n(count)} weeks ending with the week of ${
        weekLabel(last.start) || last.week
      }; ${last.score === null ? "the latest week has no measurable average" : `the latest week averages ${Math.round(last.score)}`}.`}
    >
      {[50, 100].map((v) => (
        <g key={v}>
          <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} />
          <text className="axis" x={pad.l - 9} y={y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      <line className="base" x1={pad.l} x2={w - pad.r} y1={y0} y2={y0} />
      {weeks.map((wk, i) => {
        const label = weekLabel(wk.start) || wk.week;
        const checks = `${n(wk.n_sweeps)} check${wk.n_sweeps === 1 ? "" : "s"}`;
        // A measured zero still gets a hairline: a score of 0 is a reading,
        // and an invisible bar would be indistinguishable from no sweep.
        const bh = wk.score === null ? 0 : Math.max(y0 - y(wk.score), 1.5);
        return (
          <g key={wk.week}>
            <title>
              {wk.score === null
                ? `Week of ${label} \u2014 ${checks}, nothing measurable`
                : `Week of ${label} \u2014 average ${Math.round(wk.score)} from ${checks}` +
                  (wk.delta_score !== null ? `, ${deltaLabel(wk.delta_score)} on the week before` : "") +
                  (wk.all_partial ? "; every check ran thin" : "")}
            </title>
            {wk.score === null ? (
              <text className="axis" x={cx(i)} y={y0 - 8} textAnchor="middle">&mdash;</text>
            ) : (
              <>
                <rect
                  className={`fill ${wk.all_partial ? "fill--bare" : "fill--linked"}`}
                  x={cx(i) - bw / 2}
                  y={y0 - bh}
                  width={bw}
                  height={bh}
                />
                <text
                  className={`axis wk-delta ${deltaTone(wk.delta_score)}`}
                  x={cx(i)}
                  y={y0 - bh - 7}
                  textAnchor="middle"
                >
                  {deltaLabel(wk.delta_score)}
                </text>
              </>
            )}
            {(count <= 13 || i % every === 0 || i === count - 1) && (
              <text className="axis" x={cx(i)} y={h - 8} textAnchor="middle">{label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The run ledger. A cell whose value was never recorded is "\u2014", never 0 \u2014
 *  a check from before the run log existed shows its score and dashes, and a
 *  sweep that died before measuring shows its record and a dashed score. */
function CheckLedger({ pairs }: { pairs: LedgerPair<GeoHistoryPoint, GeoRunLogEntry>[] }) {
  const when = (row: LedgerPair<GeoHistoryPoint, GeoRunLogEntry>): string => {
    if (row.run) {
      const t = timeLabel(row.run.finished_at);
      return t !== "\u2014" ? t : dayLabel(row.run.day) || "\u2014";
    }
    if (row.point) {
      const t = timeLabel(row.point.at);
      return t !== "\u2014" ? t : dayLabel(row.point.date) || "\u2014";
    }
    return "\u2014";
  };

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Check</th>
          <th>Ran for</th>
          <th>Started by</th>
          <th>Engines reached</th>
          <th className="num">Calls</th>
          <th className="num">Errors</th>
          <th>Outcome</th>
          <th className="num">Score</th>
          <th>Plan at the time</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((row) => {
          const { point, run } = row;
          const errs = run ? errorCount(run.errors) : null;
          const score = point ? point.score : run ? run.score : null;
          return (
            <tr key={row.key}>
              <td>
                {when(row)}
                {point?.partial && <span className="tag" style={{ marginLeft: 8 }}>thin</span>}
                {point?.source === "backfill" && <span className="tag" style={{ marginLeft: 8 }}>backfilled</span>}
              </td>
              <td>{run ? durationLabel(run.duration_s) : "\u2014"}</td>
              <td>{run ? triggerLabel(run.trigger) : "\u2014"}</td>
              <td>
                {!run || !run.engines
                  ? "\u2014"
                  : run.engines.length === 0
                    ? "none"
                    : run.engines.map((id) => ENGINE_SHORT[id] ?? id).join(", ")}
              </td>
              <td className="num">{run && Number.isFinite(run.calls) ? n(run.calls) : "\u2014"}</td>
              <td className={`num${errs ? " is-bad" : ""}`}>{errs === null ? "\u2014" : n(errs)}</td>
              <td>
                {run ? outcomeLabel(run) : "\u2014"}
                {run && !run.completed && Number.isFinite(run.done) && Number.isFinite(run.total) && run.total > 0 && (
                  <span className="sub">at step {n(run.done)} of {n(run.total)}</span>
                )}
              </td>
              <td className="num">{score === null || score === undefined ? "\u2014" : n(Math.round(score))}</td>
              <td>{run ? planLabel(run.plan_progress) : "\u2014"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Spark({ values, label }: { values: number[]; label: string }) {
  const w = 160, h = 34;
  const min = Math.min(...values) - 6;
  const max = Math.max(...values) + 4;
  const span = max - min || 1;
  const x = (i: number) => (i * w) / (values.length - 1);
  const y = (v: number) => h - ((v - min) / span) * h;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label} went from ${values[0]} to ${values[values.length - 1]} percent`}
    >
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#g-mark)" />
      <path d={d} fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
