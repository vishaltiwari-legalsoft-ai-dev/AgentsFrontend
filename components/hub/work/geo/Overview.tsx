"use client";

/** Three blocks: what happened, which questions, what to do.
 *
 *  The first ledger row opens on arrival so real engine prose is on screen
 *  without a separate quotes block — the whole claim of this workspace is that
 *  you can read what the engines actually wrote, and a front page that shows
 *  only percentages does not make that claim.
 */

import { useEffect, useState } from "react";
import { geoAnswers, geoPollStep, type GeoAnswer } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { scheduleLine } from "@/components/console/geo/schedule";
import type { GeoPollStatus } from "@/lib/api";
import { Ic } from "../../Sprite";
import { PageHead, RuleHead, Wait, Oops } from "../../ui";
import { n, word } from "../../model";
import type { ToastFn } from "../../context";
import type { GeoData } from "../GeoWorkspace";
import {
  AnswerCard, ENGINE_IDS, EnginePills, QuestionLedger, engineName, rate,
  type LedgerRow,
} from "./parts";

export function GeoOverview({
  data, poll, onGo, onToast,
}: {
  data: GeoData;
  poll: GeoPollStatus | null;
  onGo: (section: string) => void;
  onToast: ToastFn;
}) {
  const { report, status, comparison, brandName, days } = data;
  const blended = report.blended;
  const rollup = report.prompt_rollup || [];

  const measured = blended.n_measured ?? blended.n_answers;
  const namedRate = blended.mention.rate;
  const named = namedRate === null ? null : Math.round(namedRate * measured);
  const gaps = rollup.filter((r) => r.self_rate === 0).length;

  const rows: LedgerRow[] = rollup.map((r) => ({
    id: r.prompt_id,
    text: r.text,
    enginesHit: r.engines_hit,
    enginesAsked: [],
    n: r.n,
    selfRate: r.self_rate,
  }));

  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);
  const [sweeping, setSweeping] = useState(false);

  const line = scheduleLine(poll, new Date());

  const topGap = report.source_gap[0];

  const runNow = async () => {
    if (sweeping) return;
    setSweeping(true);
    onToast("Asking the engines. This runs in the background and lands on Runs.", "ok");
    try {
      await geoPollStep(data.brandId, {});
      onToast("A check has started. Its rows fill in as each engine answers.", "ok");
      data.reload();
    } catch (e: unknown) {
      // A check that did not start must never look like one that did.
      onToast(e instanceof Error ? e.message : "The check could not be started.", "error");
    } finally {
      setSweeping(false);
    }
  };

  return (
    <>
      <PageHead
        statement={
          named === null
            ? <>Nothing has been measured in the last {days} days.</>
            : <>
                Engines named you in <b>{n(named)} of {n(measured)}</b> answers.
                {gaps > 0 ? <> On <u>{word(gaps)} question{gaps === 1 ? "" : "s"}</u> they never said your name.</> : <> Every question got your name at least once.</>}
              </>
        }
        lede={
          <>
            Your {n(rollup.length)} buyer question{rollup.length === 1 ? "" : "s"} go to four AI
            engines and we store what each one wrote back. This is everything stored in the last{" "}
            {days} days for {brandName}. {line.text}
          </>
        }
      />

      <section className="band">
        <RuleHead
          title="The four engines"
          note="An engine on its own API is the product your buyers use. One on a similar model is an OpenRouter model answering in its place, so its wording is representative rather than verbatim."
          aside={
            <button type="button" className="btn btn--quiet btn--sm" onClick={runNow} disabled={sweeping}>
              <Ic name="sweep" />
              {sweeping ? "Starting…" : "Run a check now"}
            </button>
          }
        />
        <EnginePills status={status} />

        <div className="strip4" style={{ marginTop: "var(--s4)" }}>
          {ENGINE_IDS.map((id) => {
            const block = report.engines[id];
            const st = status[id];
            const live = st?.connected && (st.mode === "native" || st.mode === "serpapi");
            const stored = block ? block.n_measured ?? block.n_answers : 0;
            const gone = !st?.connected && stored > 0;
            return (
              <div key={id}>
                <h3>{engineName(id)}</h3>
                <span className={`mode ${live ? "live" : "proxy"}`}>
                  {st?.connected ? (live ? "live API" : st.mode === "proxy" ? "similar model" : st.mode) : "no key configured"}
                </span>
                <b className="big">{stored > 0 ? rate(block!.mention.rate) : "—"}</b>
                <p>
                  {stored > 0
                    ? gone
                      // Not a live figure. Saying "of N answers" beside "no key
                      // configured" reads as a measurement still being taken.
                      ? `of ${n(stored)} answers stored before the key was removed`
                      : `of ${n(stored)} answers named you`
                    : st?.connected
                      ? "connected, nothing stored in this window"
                      : "not measured — no key configured"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="band">
        <RuleHead
          title="Which questions did they name you on?"
          note="Open any row to read all four answers, exactly as the engine wrote them."
        />
        {rows.length === 0 ? (
          <div className="empty">
            <h4>No questions have been asked yet</h4>
            <p>Write your buyer questions, then run a check — the answers land here.</p>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => onGo("questions")}>
              Write the questions
            </button>
          </div>
        ) : (
          <>
            <QuestionLedger
              rows={rows}
              openId={openId}
              onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
            >
              {(row) => <PromptAnswers data={data} promptId={row.id} />}
            </QuestionLedger>
            <p className="help" style={{ marginTop: 14 }}>
              A filled square means that engine said your name on that question. A blank one means it
              was never asked — which is not the same as never naming you, and is why the two are
              drawn differently.
            </p>
          </>
        )}
      </section>

      {topGap && (
        <>
          <RuleHead title="What to do next" note="One move, chosen from the questions you are losing." />
          <div className="move">
            <div>
              <h2>Get listed on {topGap.domain}</h2>
              <p>
                Engines cited it {word(topGap.count)} time{topGap.count === 1 ? "" : "s"} in this
                window, on {word(topGap.example_prompt_ids.length)} question
                {topGap.example_prompt_ids.length === 1 ? "" : "s"} where your name never appeared. A
                listing there sits inside the answers that currently leave you out.
              </p>
            </div>
            <button type="button" className="btn" onClick={() => onGo("plan")}>Open the plan</button>
          </div>
        </>
      )}

      {comparison && comparison.tracked_competitors === 0 && (
        <p className="soon-note">
          No competitor is tracked yet, so nothing here says who the engines named instead of you.
          Adding one re-reads answers already stored — it costs nothing and takes a few seconds.
        </p>
      )}
    </>
  );
}

/** The four answers behind one question, fetched only when the row is opened.
 *
 *  Loading every answer for every question up front would be hundreds of long
 *  strings for a page whose first job is a grid of squares. */
function PromptAnswers({ data, promptId }: { data: GeoData; promptId: string }) {
  const session = useLoadSession();
  const [answers, setAnswers] = useState<Load<GeoAnswer[]>>(loadPending);

  useEffect(() => {
    void session.run(
      `geo-answers-${promptId}`,
      (s) => geoAnswers(data.brandId, { prompt_id: promptId, days: data.days }, { signal: s })
        .then((r) => r.answers),
      setAnswers,
      "Those answers could not be read.",
    );
  }, [session, data.brandId, data.days, promptId]);

  const names = data.names;

  if (answers.phase === "loading" && !answers.data) return <Wait what="Reading what they wrote" />;
  if (answers.phase === "failed" && !answers.data) {
    return <Oops what="Those answers could not be read." error={answers.error || ""} />;
  }
  if (!answers.data?.length) {
    return (
      <p className="calm" style={{ margin: "8px 0 0" }}>
        Nothing is stored for this question in the last {data.days} days.
      </p>
    );
  }

  return (
    <>
      {answers.data.map((a, i) => (
        <AnswerCard key={`${a.engine}-${a.run}-${i}`} answer={a} status={data.status} names={names} />
      ))}
    </>
  );
}
