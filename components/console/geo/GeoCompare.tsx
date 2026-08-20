"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  geoComparison, geoRescan, type GeoBrandRow, type GeoComparison, type GeoComparisonRow,
  type GeoCompetitor, type GeoUntrackedDomain,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import {
  citationCell, headline, losingQuestions, matchNames, pct, positionCell, scoreboard,
  slugKey, suggestName, trackableDomains,
} from "./compare";

/** Competitors — everyone else scored on the answers we were scored on.
 *
 *  Asked for in the 18 Aug review: the panel could already say a rival was
 *  named somewhere, but never "on THIS question, these three get cited and we
 *  don't". Same window and same denominators as the report, so the numbers
 *  here and there can sit in one slide without a footnote.
 *
 *  The honesty line that matters most here: a rival with no domain on record
 *  has an unknown citation rate, and this table says "no domain" rather than
 *  drawing a 0% that reads as "never cited".
 */

type Props = {
  brand: GeoBrandRow;
  competitors: GeoCompetitor[];
  isCreator: boolean;
  onTrack: (next: GeoCompetitor[]) => Promise<void>;
  onToast: ToastFn;
  goPrompts: () => void;
};

export function GeoCompare({ brand, competitors, isCreator, onTrack, onToast, goPrompts }: Props) {
  const [doc, setDoc] = useState<GeoComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [extraFor, setExtraFor] = useState<string>("");
  const [extraName, setExtraName] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    geoComparison(brand.id)
      .then(setDoc)
      .catch((e) => onToast(e instanceof Error ? e.message : "Could not load the comparison", "error"))
      .finally(() => setLoading(false));
  }, [brand.id, onToast]);

  useEffect(() => { load(); }, [load]);

  async function track(nextName: string, nextDomain: string) {
    const trimmed = nextName.trim();
    if (!trimmed || saving) return;
    const key = slugKey(trimmed);
    if (competitors.some((c) => c.key === key)) {
      onToast(`${trimmed} is already tracked.`, "error");
      return;
    }
    setSaving(true);
    try {
      await onTrack([
        ...competitors,
        { key, name: trimmed, aliases: [trimmed], domain: nextDomain.trim() },
      ]);
      setName("");
      setDomain("");
      // Mentions are read when an answer is STORED, so without this a rival
      // added today shows 0% until the next sweep — two days of a comparison
      // that quietly lies. The answer text is already on disk, so re-read it.
      const result = await geoRescan(brand.id);
      onToast(
        result.answers_updated
          ? `${trimmed} tracked — found in ${result.answers_updated} stored answers, no new engine calls.`
          : `${trimmed} tracked. Not named in any stored answer, so their numbers start from the next poll.`,
      );
      load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not save the competitor", "error");
    } finally {
      setSaving(false);
    }
  }

  /** Add another spelling for a rival, then re-read — the escape hatch for a
   *  brand the engines write in a way the name and domain do not cover. */
  async function addAlias(key: string) {
    const alias = extraName.trim();
    if (!alias || saving) return;
    const next = competitors.map((c) =>
      c.key === key
        ? { ...c, aliases: [...new Set([...(c.aliases ?? []), alias])] }
        : c,
    );
    setSaving(true);
    try {
      await onTrack(next);
      const result = await geoRescan(brand.id);
      setExtraName("");
      setExtraFor("");
      onToast(
        result.answers_updated
          ? `"${alias}" added — found in ${result.answers_updated} stored answers.`
          : `"${alias}" added, but it appears in none of the stored answers.`,
      );
      load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not add the name", "error");
    } finally {
      setSaving(false);
    }
  }

  async function rescan() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await geoRescan(brand.id);
      onToast(
        `Re-read ${result.answers_scanned} stored answers — ${result.answers_updated} updated. No engine calls.`,
      );
      load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not re-read the stored answers", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !doc) {
    return <div className="mr-panel"><div className="seo-empty">Loading the comparison…</div></div>;
  }
  if (!doc) return null;

  const losing = losingQuestions(doc.questions);
  const rivals = (doc.rows ?? []).filter((r) => !r.is_self);
  const suggestions = trackableDomains(doc.untracked_domains);
  const hasData = doc.n_measured > 0;

  return (
    <div className="mr-panel">
      <div className="mr-panel__head">
        <h2 className="mr-panel__title">Competitors, on the same answers</h2>
        <span className="mr-panel__sub">
          {doc.n_measured} usable answers over the last {doc.days} days.
        </span>
      </div>

      {!hasData ? (
        <div className="seo-empty">
          Nothing measured yet in this window — run a poll first, and this fills with
          whoever the engines named beside you.
        </div>
      ) : (
        <>
          <p className="geo-compare__headline">
            {headline(doc.rows ?? [], brand.name, doc.tracked_competitors)}
          </p>

          {doc.tracked_competitors > 0 && (
            <table className="geo-table geo-compare__table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Named</th>
                  <th>Site cited</th>
                  <th>Share of voice</th>
                  <th>Avg. spot</th>
                  <th>Questions ahead / behind</th>
                </tr>
              </thead>
              <tbody>
                {(doc.rows ?? []).map((row) => <Row key={row.key} row={row} />)}
              </tbody>
            </table>
          )}

          {doc.tracked_competitors > 0 && (
            <div className="mr-section">
              <h3 className="mr-section__title">Names we search the answers for</h3>
              <p className="geo-note">
                Mentions are matched on the exact spelling. Engines write
                &ldquo;Smith.ai&rdquo;, not &ldquo;smith ai&rdquo; — so these are derived from
                each name and domain. If a rival still reads 0%, the spelling the engines
                use is probably missing here; add it and we re-read immediately.
              </p>
              {rivals.map((r) => (
                <div key={r.key} className="geo-aliasrow">
                  <span className="geo-aliasrow__name">{r.name}</span>
                  <span className="geo-aliasrow__chips">
                    {matchNames(r).length
                      ? matchNames(r).map((m) => <span key={m} className="seo-chip">{m}</span>)
                      : <span className="geo-compare__unknown">not reported yet</span>}
                  </span>
                  {isCreator && (extraFor === r.key ? (
                    <span className="geo-addcomp">
                      <input autoFocus value={extraName} placeholder="another spelling…"
                             onChange={(e) => setExtraName(e.target.value)}
                             onKeyDown={(e) => e.key === "Enter" && void addAlias(r.key)} />
                      <button className="seo-btn" disabled={saving || !extraName.trim()}
                              onClick={() => void addAlias(r.key)}>Add</button>
                    </span>
                  ) : (
                    <button className="geo-linkbtn"
                            onClick={() => { setExtraFor(r.key); setExtraName(""); }}>
                      add a name
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {doc.tracked_competitors > 0 && (
            <p className="geo-note">
              &ldquo;Named&rdquo; is how often each name appears in the same set of answers.
              A question is &ldquo;ahead&rdquo; when the engines name you on it more often than
              them, &ldquo;behind&rdquo; when the reverse; &ldquo;open&rdquo; means neither of you
              is ever named on it — usually the cheapest ground to take. Tracking someone new
              re-reads the answers already stored, so their numbers are here immediately, from
              the last {doc.days} days we still hold.
            </p>
          )}

          <div className="mr-section">
            <h3 className="mr-section__title">
              {losing.length ? `${losing.length} questions a competitor is ahead on` : "Question by question"}
            </h3>
            {!doc.tracked_competitors ? (
              <div className="seo-empty">
                Track a competitor below and every question gets a side-by-side column.
              </div>
            ) : !losing.length ? (
              <div className="seo-empty">
                No tracked competitor is ahead of you on any measured question right now.
              </div>
            ) : (
              <table className="geo-table">
                <thead>
                  <tr><th>Buyer question</th><th>You</th><th>Ahead of you</th><th>Runs</th></tr>
                </thead>
                <tbody>
                  {losing.slice(0, 25).map((q) => (
                    <tr key={q.prompt_id}>
                      <td className="geo-compare__q">{q.text}</td>
                      <td className={q.self_rate ? "" : "geo-compare__zero"}>{pct(q.self_rate)}</td>
                      <td>
                        {q.rivals_ahead.map((r) => (
                          <span key={r.key} className="seo-chip">{r.name} · {pct(r.rate)}</span>
                        ))}
                      </td>
                      <td>{q.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {losing.length > 25 && (
              <p className="geo-note">
                Showing the 25 worst of {losing.length}. The full list of questions lives in{" "}
                <button className="geo-linkbtn" onClick={goPrompts}>Prompts</button>.
              </p>
            )}
          </div>

          <div className="mr-section">
            <h3 className="mr-section__title">Also cited on your questions</h3>
            <p className="geo-note">
              Sites the engines link on your buyer questions that belong to nobody you track
              yet, ranked by how often they show up in answers you are absent from. Some are
              review platforms rather than competitors — track the ones that are firms, and
              the table above starts scoring them from the next poll.
            </p>
            {!suggestions.length ? (
              <div className="seo-empty">
                Nothing cited beside you that you aren&apos;t already tracking.
              </div>
            ) : (
              <table className="geo-table">
                <thead>
                  <tr><th>Domain</th><th>Cited</th><th>…where you&apos;re absent</th><th /></tr>
                </thead>
                <tbody>
                  {suggestions.map((d) => (
                    <SuggestionRow key={d.domain} domain={d} isCreator={isCreator} saving={saving}
                                   onTrack={() => void track(suggestName(d.domain), d.domain)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {isCreator && (
            <div className="mr-section">
              <h3 className="mr-section__title">Track a competitor</h3>
              <div className="geo-addcomp">
                <input value={name} placeholder="Competitor name — e.g. Clio"
                       onChange={(e) => setName(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && void track(name, domain)} />
                <input value={domain} placeholder="their domain (optional) — clio.com"
                       onChange={(e) => setDomain(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && void track(name, domain)} />
                <button className="seo-btn" disabled={saving || !name.trim()}
                        onClick={() => void track(name, domain)}>Track</button>
              </div>
              <p className="geo-note">
                The domain is what their citations are counted against. Without one their
                &ldquo;site cited&rdquo; column reads &ldquo;no domain&rdquo; rather than 0% —
                we won&apos;t print a number we didn&apos;t measure.
              </p>
              <div className="geo-compare__rescan">
                <button className="seo-btn" disabled={saving} onClick={() => void rescan()}>
                  <Icon name="history" size={13} /> Re-read stored answers
                </button>
                <span className="geo-sched geo-sched--hint">
                  Runs automatically when you track someone. Re-reads the answers already on
                  disk with the current competitor list — no engine calls, no new spend. A name
                  that only appeared past the stored length of an answer needs a real poll.
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ row }: { row: GeoComparisonRow }) {
  const citation = citationCell(row);
  const position = positionCell(row);
  const board = scoreboard(row);
  return (
    <tr className={row.is_self ? "geo-compare__self" : undefined}>
      <td>
        {row.name}
        {row.is_self && <span className="seo-chip seo-chip--on">you</span>}
      </td>
      <td title={`${row.mention.n_prompts} questions, ${row.mention.n_answers} answers`}>
        {pct(row.mention.rate)}
      </td>
      <td className={citation.unknown ? "geo-compare__unknown" : undefined} title={citation.title}>
        {citation.text}
      </td>
      <td>{pct(row.sov_share)}</td>
      <td className={position.unknown ? "geo-compare__unknown" : undefined} title={position.title}>
        {position.text}
      </td>
      <td>
        {board ? (
          <span className="geo-compare__board"
                title={`Of ${board.total} measured questions: you lead on ${board.won}, they lead on ${board.lost}, ${board.tied} are level and ${board.open} name neither of you.`}>
            <strong>{board.won}</strong> ahead · <strong>{board.lost}</strong> behind ·{" "}
            {board.tied} level · {board.open} open
          </span>
        ) : (
          <span className="geo-compare__unknown">—</span>
        )}
      </td>
    </tr>
  );
}

function SuggestionRow(
  { domain, isCreator, saving, onTrack }:
  { domain: GeoUntrackedDomain; isCreator: boolean; saving: boolean; onTrack: () => void },
) {
  return (
    <tr>
      <td>{domain.domain}</td>
      <td>{domain.count}×</td>
      <td>{domain.answers_you_absent}×</td>
      <td>
        {isCreator && (
          <button className="seo-btn" disabled={saving} onClick={onTrack}>
            <Icon name="plus" size={12} /> Track as {suggestName(domain.domain)}
          </button>
        )}
      </td>
    </tr>
  );
}
