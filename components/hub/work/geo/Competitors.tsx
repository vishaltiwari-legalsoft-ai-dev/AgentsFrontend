"use client";

/** Scored on the same answers, not separate searches.
 *
 *  One question, one engine, one answer, scored for everyone at once. That is
 *  what makes the comparison mean anything, and it is why adding a competitor
 *  costs nothing: the answers are already on disk and only have to be re-read.
 *
 *  Two rules the data forces:
 *
 *  - **A rival with no domain on record has an unknown citation rate, not a
 *    zero.** `citationCell` is where that decision lives, and it is tested.
 *  - **Mentions match exact spelling.** Engines write `Smith.ai`, never
 *    `smith ai`, so the row shows the exact strings it was scored on. A 0%
 *    beside the names we searched for is debuggable; a bare 0% sends somebody
 *    hunting a bug that is really a spelling.
 */

import { useEffect, useState } from "react";
import {
  geoBrandConfig, geoRescan, geoSaveBrandConfig,
  type GeoComparison, type GeoComparisonRow, type GeoCompetitor,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import {
  citationCell, losingQuestions, matchNames, positionCell, pct, scoreboard,
  slugKey, suggestName, trackableDomains,
} from "@/components/console/geo/compare";
import { questionsCell, withoutCompetitor } from "./edits";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n, word } from "../../model";
import { useHub, type ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import { ENGINE_IDS, engineName, rate } from "./parts";

export function GeoCompetitors({
  data, cmp, onToast,
}: {
  data: GeoData;
  cmp: Load<GeoComparison>;
  onToast: ToastFn;
}) {
  const { user } = useHub();
  const session = useLoadSession();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The tracked list lives on the brand config, not on the comparison, because
  // adding one is a write to the config and the write has to send the whole list.
  const [cfg, setCfg] = useState<Load<GeoCompetitor[]>>(loadPending);
  // Untracking is destructive enough for a two-step: first click arms the row,
  // the second click on the same row actually writes.
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const mayTrack = user.is_creator === true;

  useEffect(() => {
    if (!mayTrack) return;
    void session.run(
      "geo-brandcfg",
      () => geoBrandConfig(data.brandId).then((r) => r.competitors),
      setCfg,
      "The tracked list could not be read.",
      { keepStale: true },
    );
  }, [session, data.brandId, mayTrack]);

  if (cmp.phase === "loading" && !cmp.data) return <Wait what="Scoring the stored answers" rows={6} />;
  if (cmp.phase === "failed" && !cmp.data) {
    return <Oops what="The competitor scoring could not be read." error={cmp.error || ""} onRetry={data.reload} />;
  }
  const c = cmp.data;
  if (!c) return null;

  const self = c.rows.find((r) => r.is_self) || null;
  const rivals = c.rows.filter((r) => !r.is_self);
  const losing = losingQuestions(c.questions);
  const untracked = trackableDomains(c.untracked_domains);

  /** Save the name onto the brand config, then re-read what is already stored.
   *
   *  The second half is not optional. Mentions are counted when an answer is
   *  STORED, so without a rescan a rival added today reads 0% until the next
   *  sweep — days of a comparison that quietly lies. The answer text is already
   *  on disk, so re-reading it calls no engine and costs nothing.
   */
  const track = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) {
      setErr("Give the competitor a name — at least two characters.");
      return;
    }
    const key = slugKey(clean);
    const tracked = cfg.data || [];
    if (tracked.some((x) => x.key === key)) {
      setErr(`${clean} is already tracked.`);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const saved = await geoSaveBrandConfig(data.brandId, {
        competitors: [...tracked, { key, name: clean, aliases: [clean], domain: domain.trim() || undefined }],
      });
      setCfg({ phase: "ready", data: saved.competitors, error: null });
      setName("");
      setDomain("");
      const result = await geoRescan(data.brandId, data.days);
      onToast(
        result.answers_updated
          ? `${clean} tracked — found in ${n(result.answers_updated)} stored answers, with no new engine calls.`
          : `${clean} tracked. Not named in any stored answer, so their figures start from the next check.`,
        "ok",
      );
      data.reload();
    } catch (e2: unknown) {
      // A competitor that did not save must not be left looking tracked.
      setErr(e2 instanceof Error ? e2.message : "That competitor was not added.");
    } finally {
      setBusy(false);
    }
  };

  /** Stop measuring one competitor: the same whole-list PUT as adding, minus
   *  one entry. Stored answers are untouched, so tracking them again later
   *  still costs nothing. */
  const untrack = async (row: GeoComparisonRow) => {
    const remaining = withoutCompetitor(cfg.data || [], row.key);
    if (remaining === null) {
      // The comparison row and the saved config disagree — refuse to guess.
      onToast(`${row.name} is not on the saved list. Reload and try again.`, "error");
      setConfirmKey(null);
      return;
    }
    setRemoving(row.key);
    try {
      const saved = await geoSaveBrandConfig(data.brandId, { competitors: remaining });
      setCfg({ phase: "ready", data: saved.competitors, error: null });
      onToast(`${row.name} untracked. Their stored answers are kept, so tracking them again costs nothing.`, "ok");
      data.reload();
    } catch (e2: unknown) {
      // A competitor that did not delete must not be left looking removed.
      onToast(e2 instanceof Error ? e2.message : `${row.name} was not untracked.`, "error");
    } finally {
      setRemoving(null);
      setConfirmKey(null);
    }
  };

  return (
    <>
      <PageHead
        statement={
          rivals.length === 0
            ? <>Nobody is <b>tracked yet</b>.</>
            : <>Scored on the <b>same answers</b>, not separate searches.</>
        }
        lede={`Tracked competitors are measured on every check automatically — add the ones that are your exact competition. One question, one engine, one answer, scored for everyone at once, over ${n(c.n_measured)} answers a mention could have appeared in.`}
      />

      {rivals.length === 0 ? (
        <Blank title="No competitor is being scored">
          Until one is, nothing here can say who the engines named instead of you. Adding one
          re-reads answers already on disk — it costs nothing and takes a few seconds.
        </Blank>
      ) : (
        <>
          {losing.length > 0 && (
            <section className="band">
              <RuleHead
                title="Question by question"
                note="Who each set of answers named, compared by rate rather than by having appeared once — presence saturates over a window and would score everything a tie."
              />
              <div className="h2h__head" aria-hidden="true">
                <span>Buyer question</span>
                <span>{data.brandName}</span>
                <span>Best rival</span>
              </div>
              <div className="h2h">
                {losing.map((q) => {
                  const ahead = q.rivals_ahead[0];
                  return (
                    <div className="h2h__row" key={q.prompt_id}>
                      <p>{q.text}</p>
                      <span className={`h2h__bar${q.self_rate > 0 ? " you" : ""}`}>
                        {q.self_rate > 0 ? pct(q.self_rate) : "not named"}
                      </span>
                      <span className={`h2h__bar${ahead ? " them" : ""}`}>
                        {ahead ? `${ahead.name} ${pct(ahead.rate)}` : "nobody"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="help" style={{ marginTop: 14 }}>
                Showing the {word(losing.length)} question{losing.length === 1 ? "" : "s"} a rival is
                ahead on. The rest are yours or open ground.
              </p>
            </section>
          )}

          <section className="band">
            <RuleHead title="Across the whole window" note="Every tracked name, on the same stored answers." />
            <table className="tbl">
              <thead>
                <tr>
                  <th>Who</th>
                  <th className="num">Named in</th>
                  <th className="num">Cited</th>
                  <th className="num">Share of voice</th>
                  <th className="num">Average position</th>
                  <th className="num">Against you</th>
                  {mayTrack && <th />}
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => {
                  const cite = citationCell(r);
                  const pos = positionCell(r);
                  const board = scoreboard(r);
                  return (
                    <tr key={r.key} className={r.is_self ? "is-you" : ""}>
                      <td>
                        {r.name}{r.is_self && <small> you</small>}
                        <MatchNames row={r} />
                      </td>
                      <td className="num">{pct(r.mention.rate)}</td>
                      <td className={`num${cite.unknown ? " dim" : ""}`} title={cite.title}>{cite.text}</td>
                      <td className="num">{pct(r.sov_share)}</td>
                      <td className={`num${pos.unknown ? " dim" : ""}`} title={pos.title}>{pos.text}</td>
                      <td className="num">
                        {board ? `${board.won} ahead · ${board.lost} behind` : "—"}
                      </td>
                      {mayTrack && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          {!r.is_self && (confirmKey === r.key ? (
                            <>
                              <button
                                type="button"
                                className="btn btn--quiet btn--sm"
                                onClick={() => void untrack(r)}
                                disabled={removing === r.key}
                              >
                                {removing === r.key ? "Removing…" : "Sure, untrack"}
                              </button>{" "}
                              <button
                                type="button"
                                className="btn btn--quiet btn--sm"
                                onClick={() => setConfirmKey(null)}
                                disabled={removing === r.key}
                              >
                                Keep
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--quiet btn--sm"
                              onClick={() => setConfirmKey(r.key)}
                              disabled={cfg.phase !== "ready"}
                              title={cfg.phase !== "ready"
                                ? "Waiting for the saved list to load."
                                : `Stop measuring ${r.name}. Stored answers are kept.`}
                            >
                              Untrack
                            </button>
                          ))}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="band">
            <RuleHead title="Per engine" note="The same names, split by the surface that answered." />
            <table className="tbl">
              <thead>
                <tr>
                  <th>Who</th>
                  {ENGINE_IDS.map((id) => {
                    const st = data.status[id];
                    const live = st?.connected && (st.mode === "native" || st.mode === "serpapi");
                    return (
                      <th className="num" key={id} title={st?.means}>
                        {engineName(id)}{live ? "" : " *"}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.key} className={r.is_self ? "is-you" : ""}>
                    <td>{r.name}{r.is_self && <small> you</small>}</td>
                    {ENGINE_IDS.map((id) => (
                      <td className="num" key={id}>{rate(r.per_engine[id])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="help" style={{ marginTop: 14 }}>
              An engine marked <b>*</b> answered through a similar model rather than its own API, so
              its column measures that model rather than the product your buyers use. The two kinds
              are never added together into one ranking.
            </p>
          </section>
        </>
      )}

      {untracked.length > 0 && (
        <section className="band">
          <RuleHead
            title="Companies AI cites on your questions — not tracked yet"
            note="Domains the engines cited on questions your name never appeared on. Tracking one scores it against answers already stored."
          />
          <table className="tbl">
            <thead>
              <tr>
                <th>Domain</th>
                <th className="num">Cited</th>
                <th className="num" title="How many of your tracked questions this company was cited on.">Questions</th>
                <th className="num">While you were absent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {untracked.map((d) => (
                <tr key={d.domain}>
                  <td><b>{d.domain}</b></td>
                  <td className="num">{n(d.count)}</td>
                  <td className="num">{questionsCell(d.n_questions)}</td>
                  <td className="num">{n(d.answers_you_absent)}</td>
                  <td>
                    {mayTrack ? (
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => { setName(suggestName(d.domain)); setDomain(d.domain); }}
                      >
                        Track
                      </button>
                    ) : <span className="opt">creator only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!mayTrack ? (
        <p className="soon-note">
          Tracking a competitor writes to the brand config, which is creator-only — so the form is
          not shown here rather than offered and then refused on save.
        </p>
      ) : (
      <section className="band" style={{ maxWidth: 520 }}>
        <RuleHead title="Track another" note="Scored against answers already on disk." />
        <form onSubmit={track} noValidate>
          <label className="field">
            <span>Name</span>
            <input
              className="inp"
              value={name}
              autoComplete="off"
              placeholder="Ruby"
              onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
            />
          </label>
          {err && <p className="err" style={{ margin: "-10px 0 var(--s4)" }}>{err}</p>}
          <label className="field">
            <span>Domain <span className="opt">(optional, but a citation rate needs one)</span></span>
            <input
              className="inp"
              value={domain}
              inputMode="url"
              placeholder="ruby.com"
              onChange={(e) => setDomain(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn--solid" disabled={busy}>
            {busy ? "Re-reading stored answers…" : "Track and re-read stored answers"}
          </button>
          <p className="help" style={{ marginTop: 12 }}>
            Re-reading uses answers already stored. It calls no engine, so it costs nothing.
          </p>
        </form>
      </section>
      )}
    </>
  );
}

/** The exact spellings the rate was matched on. Without these a 0% is a dead
 *  end; with them it is either a real absence or an obvious spelling to fix. */
function MatchNames({ row }: { row: GeoComparisonRow }) {
  const names = matchNames(row);
  if (!names.length) return null;
  return (
    <span className="opt" style={{ display: "block", fontSize: 11 }}>
      matched on {names.join(", ")}
    </span>
  );
}
