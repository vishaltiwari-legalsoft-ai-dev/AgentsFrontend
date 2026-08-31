"use client";

/** Which pages the engines read — and whether you are on them.
 *
 *  Written for a reader who has never heard the word "citation": one sentence
 *  of story at the top, then two lists — the pages carrying answers without
 *  you, and the pages already citing you — and one button, to the plan that
 *  turns the first list into work. An engine that cites a page tends to repeat
 *  what that page says, so getting listed on one of these is usually cheaper
 *  and faster than trying to outrank it. That is the whole argument, and the
 *  table is ordered to make it: cited most, while you were absent, first.
 */

import { PageHead, RuleHead, Blank } from "../../ui";
import { n, word } from "../../model";
import type { GeoData } from "../GeoWorkspace";
import { sampleQuestions } from "./answerBands";

export function GeoSources({ data, onGo }: { data: GeoData; onGo: (section: string) => void }) {
  const { report } = data;
  const gap = report.source_gap;
  const mix = report.blended.source_mix;
  const rollup = report.prompt_rollup;

  // A domain in the mix that is not in the gap list is one cited on questions
  // you were named on — where you already are.
  const gapDomains = new Set(gap.map((g) => g.domain));
  const withYou = mix.filter((m) => !gapDomains.has(m.domain)).slice(0, 4);

  const totalGapCites = gap.reduce((s, g) => s + g.count, 0);

  // No answers at all is a different fact from "no page cited without you",
  // and saying the second when the first is true would be a false all-clear.
  const nothingMeasured = report.blended.n_answers === 0;

  return (
    <>
      <PageHead
        statement={
          nothingMeasured
            ? <>Nothing measured yet, so <b>nothing to read</b> here.</>
            : gap.length === 0
              ? <>Every page the engines read <b>also named you</b>.</>
              : <>These are the pages the engines <b>read and repeat</b>.</>
        }
        lede={
          <>
            When an AI engine answers your buyers&rsquo; questions, it reads a handful of pages and
            repeats what they say. This panel shows which pages those are &mdash; and where
            you&rsquo;re missing.
          </>
        }
      />

      {nothingMeasured ? (
        <section className="band">
          <Blank title="No answers measured yet — run a check first">
            Run a check from the Overview. Once the engines have answered, the pages each one relied
            on land here, split into the ones citing you and the ones leaving you out.
          </Blank>
        </section>
      ) : (
        <>
          <section className="band">
            <RuleHead
              title="Pages AI reads instead of you"
              note="Sites the engines cited on questions where your name never appeared."
              aside={
                gap.length > 0
                  ? <span className="aside">{n(totalGapCites)} citations without you</span>
                  : undefined
              }
            />
            {gap.length === 0 ? (
              <Blank title="You’re cited wherever it matters this week">
                In the last {data.days} days, every page the engines relied on appeared in an answer
                that also named you. There is no page carrying the answer without you in it.
              </Blank>
            ) : (
              <>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>How often it&rsquo;s used</th>
                      <th>Sample questions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gap.map((s) => {
                      const samples = sampleQuestions(s.example_prompt_ids, rollup);
                      return (
                        <tr key={s.domain}>
                          <td><b>{s.domain}</b></td>
                          <td>cited {n(s.count)}&times; on your questions</td>
                          <td>
                            {samples.length === 0
                              ? "—"
                              : samples.map((q) => <div className="opt" key={q}>&ldquo;{q}&rdquo;</div>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="help" style={{ marginTop: 14 }}>
                  These sites were cited on questions where your name never appeared. Getting listed
                  on them is usually cheaper than trying to outrank them &mdash; the engine already
                  trusts the page; it just doesn&rsquo;t find you on it.
                </p>
              </>
            )}
          </section>

          {withYou.length > 0 && (
            <section className="band">
              <RuleHead
                title="Pages cited alongside you"
                note="These sites were cited in answers that also named you — your name is already in the room."
              />
              <div className="strip4">
                {withYou.map((d) => (
                  <div key={d.domain}>
                    <h3>{d.domain}</h3>
                    <b className="big">{n(d.count)}</b>
                    <p>cites alongside your name</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {gap.length > 0 && (
            <section className="band">
              <div className="move">
                <div>
                  <h2>{word(gap.length)} page{gap.length === 1 ? "" : "s"} worth getting onto</h2>
                  <p>
                    The plan turns these into actions &mdash; a concrete move per domain, built from
                    exactly this list rather than invented.
                  </p>
                </div>
                <button type="button" className="btn" onClick={() => onGo("plan")}>Open the plan</button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
