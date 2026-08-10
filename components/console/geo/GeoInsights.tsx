"use client";

import type { GeoBrandRow, GeoPromptRollup, GeoReport } from "@/lib/api";
import { Icon } from "@/lib/kit-ui";

/** Insights — the plain-language story of the brand's GEO condition.
 *  Built around the most concrete artifact we have: the actual buyer
 *  questions, split into "you appear here" vs "you're missing here (and who
 *  shows up instead)". Every number carries its n; nothing is guessed. */

type Props = {
  brand: GeoBrandRow;
  report: GeoReport | null;
  promptCount: number;
  connected: string[];
  isCreator: boolean;
  onGenerate: () => void;
  onPoll: () => void;
  goTab: (tab: "prompts" | "answers" | "sources" | "optimizer") => void;
};

const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity", gemini: "Gemini", chatgpt: "ChatGPT",
};

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

function visibilityLabel(rate: number): string {
  if (rate >= 0.4) return "Strong";
  if (rate >= 0.15) return "Growing";
  return "Early days";
}

type Step = { icon: string; title: string; detail: string; cta?: { label: string; run: () => void } };

export function GeoInsights({ brand, report, promptCount, connected, isCreator, onGenerate, onPoll, goTab }: Props) {
  const blended = report?.blended;
  const n = blended?.mention.n_answers ?? 0;
  const hasData = n > 0;
  const mentionRate = blended?.mention.rate ?? 0;
  const citationRate = blended?.citation.rate ?? 0;
  const selfShare = blended?.sov.share?.self ?? 0;
  const rollup: GeoPromptRollup[] = report?.prompt_rollup ?? [];

  const rivalName = (key: string) => report?.competitor_names?.[key] || key;

  const appearing = rollup.filter((r) => r.self_rate > 0).sort((a, b) => b.self_rate - a.self_rate);
  const missing = rollup
    .filter((r) => r.self_rate === 0)
    .sort((a, b) => (b.rivals[0]?.count ?? 0) - (a.rivals[0]?.count ?? 0));
  const missingWithRivals = missing.filter((r) => r.rivals.length > 0);

  const engineRows = report
    ? Object.entries(report.engines)
        .filter(([e]) => ENGINE_LABELS[e])
        .map(([e, block]) => ({ engine: e, rate: block.mention.rate ?? 0, n: block.n_answers }))
        .sort((a, b) => b.rate - a.rate)
    : [];
  const bestEngine = engineRows[0];
  const worstEngine = engineRows[engineRows.length - 1];

  const rivals = report
    ? Object.entries(report.blended.sov.share)
        .map(([k, share]) => ({ key: k, name: k === "self" ? brand.name : rivalName(k), share: share ?? 0, self: k === "self" }))
        .sort((a, b) => b.share - a.share)
    : [];
  const topRival = rivals.find((r) => !r.self);

  // ---- ordered improvement path, derived from the data ----
  const steps: Step[] = [];
  if (!connected.length) {
    steps.push({ icon: "lock", title: "Connect an engine", detail: "Nothing can be measured without at least one engine key (Settings → Secrets)." });
  }
  if (promptCount === 0) {
    steps.push({
      icon: "sparkles", title: "Generate the buyer questions",
      detail: "The 40 real questions potential clients ask AI assistants — everything below is measured against them.",
      cta: isCreator ? { label: "Generate", run: onGenerate } : undefined,
    });
  } else if (!hasData) {
    steps.push({
      icon: "refresh-cw", title: "Run the first poll",
      detail: "Each poll asks every engine every question 3 times — single runs are noise, three give an honest rate.",
      cta: { label: "Poll now", run: onPoll },
    });
  }
  if (hasData && report) {
    if (missingWithRivals.length) {
      const worst = missingWithRivals[0];
      steps.push({
        icon: "alert-triangle",
        title: `Win back the ${missingWithRivals.length} questions where rivals appear and you don't`,
        detail: `Worst one: “${worst.text}” — ${worst.rivals.map((r) => rivalName(r.key)).join(", ")} get named there, ${brand.name} never does. The full list is below.`,
      });
    }
    for (const gap of report.source_gap.slice(0, 2)) {
      steps.push({
        icon: "target", title: `Get ${brand.name} onto ${gap.domain}`,
        detail: `When AI engines answered buyer questions WITHOUT naming you, this site was one of their favourite sources (cited ${gap.count}×). A listing or article there puts you inside the answers that currently skip you.`,
        cta: { label: "All source gaps", run: () => goTab("sources") },
      });
    }
    if (mentionRate > 0 && citationRate < mentionRate / 2) {
      steps.push({
        icon: "link", title: "Turn name-drops into links",
        detail: `Engines say “${brand.name}” far more often than they link ${brand.domain}. They link pages that answer a question directly in 40-80 words under a question heading. Score your key pages in the Content Optimizer and add those blocks.`,
        cta: { label: "Open Content Optimizer", run: () => goTab("optimizer") },
      });
    }
    if (topRival && topRival.share > selfShare) {
      steps.push({
        icon: "users", title: `Close the gap with ${topRival.name}`,
        detail: `Of all brand mentions in these answers, ${topRival.name} takes ${pct(topRival.share)} and you take ${pct(selfShare)}. Open their answers to see which sites vouch for them — those are your outreach targets.`,
        cta: { label: "Read the raw answers", run: () => goTab("answers") },
      });
    }
    if (mentionRate < 0.15) {
      steps.push({
        icon: "megaphone", title: "Grow third-party mentions",
        detail: "AI engines learn who to recommend from reviews, “best X” lists, Reddit and YouTube — much more than from your own website. Directory profiles and editorial round-ups are what move this number.",
      });
    }
  }

  return (
    <div className="mr-panel">
      {!hasData && (
        <div className="geo-hero">
          <div className="geo-hero__big">Not measured yet</div>
          <p className="geo-hero__story">
            Once the first poll runs, this page shows — in plain words — how visible {brand.name} is in
            AI answers, on which questions you win or lose, and exactly what to do about it.
          </p>
        </div>
      )}

      {hasData && report && (
        <>
          <div className="geo-hero">
            <div className="geo-hero__big">{pct(mentionRate)}</div>
            <p className="geo-hero__story">
              <strong>{visibilityLabel(mentionRate)}.</strong>{" "}
              We asked {ENGINE_LABELS[bestEngine?.engine ?? ""] ? "ChatGPT, Gemini and Perplexity" : "the AI engines"} your {promptCount} buyer
              questions, {n} answers in total. {brand.name} was named in {pct(mentionRate)} of them
              {bestEngine && worstEngine && bestEngine.engine !== worstEngine.engine
                ? ` — strongest on ${ENGINE_LABELS[bestEngine.engine]} (${pct(bestEngine.rate)}), weakest on ${ENGINE_LABELS[worstEngine.engine]} (${pct(worstEngine.rate)})`
                : ""}.
              {topRival ? ` Your closest rival in these answers is ${topRival.name}.` : ""}
            </p>
          </div>

          <div className="geo-inscards">
            <div className="geo-inscard">
              <span className="geo-inscard__num">{pct(mentionRate)}</span>
              <span className="geo-inscard__label">named</span>
              <span className="geo-inscard__hint">answers that say “{brand.name}” anywhere in the text</span>
            </div>
            <div className="geo-inscard">
              <span className="geo-inscard__num">{pct(citationRate)}</span>
              <span className="geo-inscard__label">linked</span>
              <span className="geo-inscard__hint">answers that cite {brand.domain} as a source — the stronger signal</span>
            </div>
            <div className="geo-inscard">
              <span className="geo-inscard__num">{pct(selfShare)}</span>
              <span className="geo-inscard__label">share of voice</span>
              <span className="geo-inscard__hint">of all brand name-drops in these answers, this slice is yours</span>
            </div>
          </div>

          <div className="mr-section">
            <h3 className="mr-section__title">The brand race in AI answers</h3>
            {rivals.filter((r) => r.share > 0).map((r) => (
              <div key={r.key} className="geo-bar">
                <span className="geo-bar__label">{r.name}</span>
                <span className="geo-bar__track">
                  <span className={`geo-bar__fill${r.self ? " geo-bar__fill--self" : ""}`}
                        style={{ width: `${Math.max(2, Math.round(r.share * 100))}%` }} />
                </span>
                <span className="geo-bar__num">{pct(r.share)}</span>
              </div>
            ))}
            <p className="geo-note">Who gets talked about when AI answers your buyers&apos; questions. Track more competitors in the Overview tab to widen this picture.</p>
          </div>

          {missing.length > 0 && (
            <div className="mr-section">
              <h3 className="mr-section__title">
                Questions where you&apos;re invisible ({missing.length} of {rollup.length})
              </h3>
              <p className="geo-note">These are real buyer questions. {brand.name} was never named in any answer to them{missingWithRivals.length ? " — and on the marked ones, competitors were" : ""}.</p>
              {missing.slice(0, 8).map((r) => (
                <div key={r.prompt_id} className="geo-q geo-q--miss">
                  <Icon name="eye-off" size={14} />
                  <span className="geo-q__text">{r.text}</span>
                  {r.rivals.length > 0 && (
                    <span className="geo-q__who">{r.rivals.map((x) => rivalName(x.key)).join(", ")} named instead</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {appearing.length > 0 && (
            <div className="mr-section">
              <h3 className="mr-section__title">Questions you already win ({appearing.length})</h3>
              {appearing.slice(0, 6).map((r) => (
                <div key={r.prompt_id} className="geo-q geo-q--win">
                  <Icon name="check" size={14} />
                  <span className="geo-q__text">{r.text}</span>
                  <span className="geo-q__who">
                    named in {Math.round(r.self_rate * 100)}% of {r.n} answers
                    {r.engines_hit.length ? ` (${r.engines_hit.map((e) => ENGINE_LABELS[e] ?? e).join(", ")})` : ""}
                  </span>
                </div>
              ))}
              <p className="geo-note">Protect these: keep the pages behind them fresh — engines strongly prefer recently-updated sources.</p>
            </div>
          )}

          <div className="mr-section">
            <h3 className="mr-section__title">Engine by engine</h3>
            <div className="geo-inscards">
              {engineRows.map((e) => (
                <div key={e.engine} className="geo-inscard">
                  <span className="geo-inscard__num">{pct(e.rate)}</span>
                  <span className="geo-inscard__label">{ENGINE_LABELS[e.engine]}</span>
                  <span className="geo-inscard__hint">named in {e.n} answers sampled</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mr-section">
        <h3 className="mr-section__title">Your action plan, in order</h3>
        {steps.length === 0 && (
          <p className="geo-note">Nothing urgent — keep the weekly poll running and watch the trend.</p>
        )}
        <ol className="geo-steps">
          {steps.slice(0, 5).map((s) => (
            <li key={s.title} className="geo-step">
              <span className="geo-step__icon"><Icon name={s.icon} size={16} /></span>
              <span className="geo-step__body">
                <strong>{s.title}</strong>
                <span>{s.detail}</span>
                {s.cta && (
                  <button className="seo-btn geo-step__cta" onClick={s.cta.run}>{s.cta.label}</button>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="geo-note">
        Honest expectations: content and technical fixes show up in AI answers within 4–12 weeks;
        being &ldquo;known&rdquo; by the models themselves takes quarters of consistent third-party mentions.
        Weekly polls build the trend — day-to-day wiggle is normal AI randomness, not signal.
      </p>
    </div>
  );
}
