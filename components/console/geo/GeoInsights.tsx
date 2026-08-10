"use client";

import type { GeoBrandRow, GeoReport } from "@/lib/api";
import { Icon } from "@/lib/kit-ui";

/** Insights — the plain-language story of the brand's GEO condition and the
 *  ordered path to improve it. Every number comes from real sampled answers
 *  (n shown); improvement steps are derived from the data, never generic. */

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

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

function visibilityLabel(rate: number): { word: string; tone: string } {
  if (rate >= 0.4) return { word: "Strong", tone: "ok" };
  if (rate >= 0.15) return { word: "Growing", tone: "mid" };
  return { word: "Early days", tone: "low" };
}

type Step = { icon: string; title: string; detail: string; cta?: { label: string; run: () => void } };

export function GeoInsights({ brand, report, promptCount, connected, isCreator, onGenerate, onPoll, goTab }: Props) {
  const blended = report?.blended;
  const n = blended?.mention.n_answers ?? 0;
  const hasData = n > 0;
  const mentionRate = blended?.mention.rate ?? 0;
  const citationRate = blended?.citation.rate ?? 0;
  const selfShare = blended?.sov.share?.self ?? 0;

  const rivals = report
    ? Object.entries(report.blended.sov.share)
        .filter(([k]) => k !== "self")
        .map(([k, share]) => ({ key: k, name: report.competitor_names[k] ?? k, share: share ?? 0 }))
        .sort((a, b) => b.share - a.share)
    : [];
  const topRival = rivals[0];

  // ---- the ordered improvement path, derived from the data ----
  const steps: Step[] = [];
  if (!connected.length) {
    steps.push({
      icon: "lock", title: "Connect an engine",
      detail: "Nothing can be measured without at least one engine key (Settings → Secrets). With the OpenRouter key set, all three engines already work.",
    });
  }
  if (promptCount === 0) {
    steps.push({
      icon: "sparkles", title: "Generate the prompt universe",
      detail: "These are the real buyer questions we measure against — screening services, intake help, virtual assistants.",
      cta: isCreator ? { label: "Generate", run: onGenerate } : undefined,
    });
  } else if (!hasData) {
    steps.push({
      icon: "refresh-cw", title: "Run the first poll",
      detail: "Each poll asks every engine every prompt 3 times — single runs are noise, three give an honest rate.",
      cta: { label: "Poll now", run: onPoll },
    });
  }
  if (hasData && report) {
    for (const gap of report.source_gap.slice(0, 2)) {
      steps.push({
        icon: "target", title: `Get featured on ${gap.domain}`,
        detail: `Engines cited it ${gap.count}× answering buyer questions where ${brand.name} was absent. A listing or mention there puts you inside the answers that skip you today.`,
        cta: { label: "See all source gaps", run: () => goTab("sources") },
      });
    }
    if (mentionRate > 0 && citationRate < mentionRate / 2) {
      steps.push({
        icon: "link", title: "Turn mentions into links",
        detail: "Engines name you more than they link you. Publish answer-shaped pages (question heading → direct 40-80 word answer) so there is something quotable to cite. Score your key pages in the Content Optimizer.",
        cta: { label: "Open Content Optimizer", run: () => goTab("optimizer") },
      });
    }
    if (topRival && topRival.share > selfShare) {
      steps.push({
        icon: "users", title: `Close the gap with ${topRival.name}`,
        detail: `They hold ${pct(topRival.share)} share of voice vs your ${pct(selfShare)}. Check which sources engines cite for them — those are your outreach targets.`,
        cta: { label: "Study their sources", run: () => goTab("answers") },
      });
    }
    if (mentionRate < 0.15) {
      steps.push({
        icon: "megaphone", title: "Grow third-party mentions",
        detail: "AI engines learn brands from reviews, listicles, Reddit and YouTube — far more than from your own site. Directory profiles and editorial round-ups move this number.",
      });
    }
  }

  return (
    <div className="mr-panel">
      {/* ---- current condition ---- */}
      {!hasData && (
        <div className="geo-hero">
          <div className="geo-hero__big">Not measured yet</div>
          <p className="geo-hero__story">
            Once the first poll runs, this page tells you — in plain words — how visible {brand.name} is
            inside AI answers, and exactly what to do next.
          </p>
        </div>
      )}
      {hasData && report && (
        <>
          <div className="geo-hero">
            <div className="geo-hero__big">{pct(mentionRate)}</div>
            <p className="geo-hero__story">
              <strong>{visibilityLabel(mentionRate).word}.</strong>{" "}
              Out of {n} real AI answers to buyer questions this week, {brand.name} was named in {pct(mentionRate)}{" "}
              and linked in {pct(citationRate)}.
              {topRival ? ` ${topRival.name} currently ${topRival.share > selfShare ? "leads" : "trails"} share of voice (${pct(topRival.share)} vs your ${pct(selfShare)}).` : ""}
            </p>
          </div>
          <div className="geo-inscards">
            <div className="geo-inscard">
              <span className="geo-inscard__num">{pct(mentionRate)}</span>
              <span className="geo-inscard__label">named in answers</span>
            </div>
            <div className="geo-inscard">
              <span className="geo-inscard__num">{pct(citationRate)}</span>
              <span className="geo-inscard__label">linked as a source</span>
            </div>
            <div className="geo-inscard">
              <span className="geo-inscard__num">{pct(selfShare)}</span>
              <span className="geo-inscard__label">share of voice</span>
            </div>
          </div>
        </>
      )}

      {/* ---- how it improves ---- */}
      <div className="mr-section">
        <h3 className="mr-section__title">How this improves</h3>
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
