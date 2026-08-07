"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  geoAnswers, geoBrandConfig, geoBrands, geoConfig, geoGeneratePrompts, geoPollStep,
  geoPrompts, geoReport, geoSaveBrandConfig, geoSavePrompts,
  type GeoAnswer, type GeoBrandConfig, type GeoBrandRow, type GeoGlobalConfig,
  type GeoPollProgress, type GeoPrompt, type GeoReport,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/lib/kit-ui";
import { useReportWork } from "@/lib/work";

/** GEO agent (a10) — how often AI answer engines name and cite each brand.
 *  Honesty rules baked in: every rate shows its n and variance; a missing
 *  engine key reads as "not connected", never as a zero. */

type GeoTab = "overview" | "prompts" | "answers" | "sources";

const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
};

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;

const band = (stdev: number | null | undefined) =>
  stdev === null || stdev === undefined || stdev === 0 ? "" : ` ±${Math.round(stdev * 100)}`;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "comp";
}

export function GeoAgent({ onToast, onBack }: { onToast: (m: string) => void; onBack: () => void }) {
  const { user } = useAuth();
  const [globalCfg, setGlobalCfg] = useState<GeoGlobalConfig | null>(null);
  const [brands, setBrands] = useState<GeoBrandRow[]>([]);
  const [brand, setBrand] = useState<GeoBrandRow | null>(null);
  const [prompts, setPrompts] = useState<GeoPrompt[]>([]);
  const [report, setReport] = useState<GeoReport | null>(null);
  const [brandCfg, setBrandCfg] = useState<GeoBrandConfig | null>(null);
  const [answers, setAnswers] = useState<GeoAnswer[]>([]);
  const [answerEngine, setAnswerEngine] = useState<string>("");
  const [openAnswer, setOpenAnswer] = useState<number | null>(null);
  const [tab, setTab] = useState<GeoTab>("overview");
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState<GeoPollProgress | null>(null);
  const [newCompetitor, setNewCompetitor] = useState("");
  const stopPoll = useRef(false);

  useReportWork(busy || polling);

  const refresh = useCallback(async () => {
    try {
      const [cfg, list] = await Promise.all([geoConfig(), geoBrands()]);
      setGlobalCfg(cfg);
      setBrands(list.brands);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to load");
    }
  }, [onToast]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { stopPoll.current = true; }, []);

  async function openBrand(row: GeoBrandRow) {
    setBrand(row);
    setTab("overview");
    setReport(null);
    setProgress(null);
    setAnswers([]);
    try {
      const [p, r, c] = await Promise.all([
        geoPrompts(row.id), geoReport(row.id), geoBrandConfig(row.id),
      ]);
      setPrompts(p.prompts ?? []);
      setReport(r);
      setBrandCfg(c);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to load brand");
    }
  }

  async function reloadReport(brandId: string) {
    try {
      setReport(await geoReport(brandId));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load the report");
    }
  }

  async function generate() {
    if (!brand) return;
    setBusy(true);
    onToast("Drafting the prompt universe — the buyer questions we'll poll engines with…");
    try {
      const doc = await geoGeneratePrompts(brand.id);
      setPrompts(doc.prompts);
      setTab("prompts");
      onToast(`Drafted ${doc.prompts.length} prompts — review and edit them, then poll.`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Prompt generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePrompts() {
    if (!brand) return;
    setBusy(true);
    try {
      await geoSavePrompts(brand.id, prompts);
      onToast("Prompts saved");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function runPoll() {
    if (!brand || polling) return;
    setPolling(true);
    stopPoll.current = false;
    onToast("Polling engines — each prompt runs multiple times so the numbers carry a variance band…");
    try {
      for (;;) {
        const p = await geoPollStep(brand.id, {});
        setProgress(p);
        if (stopPoll.current) break;
        if (p.capped) {
          onToast(`Daily engine-call cap reached (${p.calls_used_today}/${p.daily_cap}) — resumes tomorrow.`);
          break;
        }
        if (p.done >= p.total) {
          onToast("Poll complete — report updated.");
          break;
        }
      }
      await reloadReport(brand.id);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Polling failed");
    } finally {
      setPolling(false);
    }
  }

  async function loadAnswers(engine: string) {
    if (!brand) return;
    setAnswerEngine(engine);
    setOpenAnswer(null);
    try {
      const res = await geoAnswers(brand.id, engine ? { engine } : {});
      setAnswers(res.answers);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load answers");
    }
  }

  async function addCompetitor() {
    if (!brand || !brandCfg || !newCompetitor.trim()) return;
    const name = newCompetitor.trim();
    const next = [
      ...(brandCfg.competitors ?? []),
      { key: slug(name), name, aliases: [name] },
    ];
    try {
      const cfg = await geoSaveBrandConfig(brand.id, { competitors: next });
      setBrandCfg(cfg);
      setNewCompetitor("");
      onToast(`${name} tracked — future polls measure them too.`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not save competitor");
    }
  }

  const engines = globalCfg?.engines ?? {};
  const connected = Object.entries(engines).filter(([, ok]) => ok).map(([e]) => e);
  const blended = report?.blended;
  const hasData = (blended?.mention.n_answers ?? 0) > 0;

  // Hero story + at most three actions — the calm-UI contract.
  const actions: { icon: string; text: string; onClick?: () => void }[] = [];
  if (!connected.length) {
    actions.push({ icon: "lock", text: "Connect an engine key (Perplexity or Gemini) in Settings → Secrets — nothing can be measured without one." });
  }
  if (prompts.length === 0) {
    actions.push({ icon: "sparkles", text: "Generate the prompt universe — the buyer questions we measure against.", onClick: user?.is_creator ? () => void generate() : undefined });
  } else if (!hasData) {
    actions.push({ icon: "refresh-cw", text: "Run the first poll to get a baseline.", onClick: () => void runPoll() });
  }
  if (hasData && report) {
    const gap = report.source_gap[0];
    if (gap) {
      actions.push({ icon: "target", text: `Earn presence on ${gap.domain} — engines cited it ${gap.count}× on your prompts where you were absent.` });
    }
    if (blended && blended.citation.rate === 0 && (blended.mention.rate ?? 0) > 0) {
      actions.push({ icon: "link", text: "You get named but never linked — publish citable, answer-first pages so engines have something to cite." });
    }
  }
  const heroActions = actions.slice(0, 3);

  const topCompetitor = report
    ? Object.entries(report.competitors)
        .map(([key, stats]) => ({ key, rate: stats.rate ?? 0 }))
        .sort((a, b) => b.rate - a.rate)[0]
    : undefined;

  return (
    <div className="mr-app geo-app">
      <header className="mr-top">
        <button className="mr-top__back" onClick={() => (brand ? setBrand(null) : onBack())} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="mr-top__id">
          <span className="mr-top__name">GEO — AI Visibility{brand ? ` · ${brand.name}` : ""}</span>
          <span className="mr-top__sub">How often AI answers name and cite each brand — measured, not guessed</span>
        </div>
        <div className="geo-engines">
          {Object.keys(ENGINE_LABELS).map((e) => (
            <span key={e} className={`seo-chip ${engines[e as keyof typeof engines] ? "seo-chip--on" : "seo-chip--off"}`}>
              {ENGINE_LABELS[e]}
            </span>
          ))}
        </div>
      </header>

      <div className="mr-body">
        {!brand && (
          <div className="mr-panel">
            <div className="mr-panel__head">
              <h2 className="mr-panel__title">Brands</h2>
              <span className="mr-panel__sub">Open a brand to see its AI visibility and the gaps to fix.</span>
            </div>
            <div className="seo-grid">
              {brands.map((b) => (
                <div key={b.id} className="seo-card" role="button" tabIndex={0}
                     onClick={() => void openBrand(b)}
                     onKeyDown={(e) => e.key === "Enter" && void openBrand(b)}>
                  <div className="seo-card__head">
                    <span className="seo-card__name">{b.name}</span>
                    <span className="seo-card__domain">{b.domain}</span>
                  </div>
                  <div className="geo-card__meta">
                    <span>{b.prompts ? `${b.prompts} prompts` : "No prompts yet"}</span>
                    <span>{b.recent_answers ? `${b.recent_answers} answers this week` : "Not polled yet"}</span>
                    {b.competitors > 0 && <span>{b.competitors} competitors tracked</span>}
                  </div>
                </div>
              ))}
              {brands.length === 0 && (
                <div className="seo-empty">No brands yet — add one in the SEO agent first; GEO shares its brand registry.</div>
              )}
            </div>
          </div>
        )}

        {brand && (
          <>
            <section className="geo-hero">
              <div className="geo-hero__story">
                {hasData && blended ? (
                  <>
                    <span className="geo-hero__big">{pct(blended.mention.rate)}<em>{band(blended.mention.stdev)}</em></span>
                    <p>
                      of tracked buyer conversations name {brand.name} ({blended.mention.n_answers} answers,{" "}
                      {blended.mention.n_prompts} prompts).{" "}
                      {topCompetitor && topCompetitor.rate > 0
                        ? `${report?.competitor_names[topCompetitor.key] ?? topCompetitor.key} gets named in ${pct(topCompetitor.rate)}.`
                        : "No tracked competitor is currently ahead."}{" "}
                      Engines link {brand.domain} in {pct(blended.citation.rate)} of answers that carry citations.
                    </p>
                  </>
                ) : (
                  <p className="geo-hero__empty">
                    Koi baseline nahi abhi — generate prompts, run the first poll, and the truth shows up here.
                  </p>
                )}
              </div>
              {heroActions.length > 0 && (
                <div className="geo-actions">
                  {heroActions.map((a, i) => (
                    <button key={i} className={`geo-action${a.onClick ? "" : " geo-action--static"}`}
                            onClick={a.onClick} disabled={!a.onClick}>
                      <Icon name={a.icon} size={14} /> <span>{a.text}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="geo-hero__ops">
                <button className="seo-btn seo-btn--primary" disabled={polling || !prompts.length} onClick={() => void runPoll()}>
                  <Icon name="refresh-cw" size={13} /> {polling ? "Polling…" : "Poll now"}
                </button>
                {polling && progress && (
                  <span className="geo-progress">{progress.done}/{progress.total} calls · today {progress.calls_used_today}/{progress.daily_cap}</span>
                )}
                {!polling && progress?.capped && (
                  <span className="geo-progress geo-progress--warn">Daily cap reached — resumes tomorrow</span>
                )}
              </div>
            </section>

            <nav className="geo-tabs">
              {(["overview", "prompts", "answers", "sources"] as GeoTab[]).map((t) => (
                <button key={t} className={`geo-tab${tab === t ? " geo-tab--on" : ""}`}
                        onClick={() => { setTab(t); if (t === "answers" && !answers.length) void loadAnswers(""); }}>
                  {t === "overview" ? "Overview" : t === "prompts" ? `Prompts (${prompts.length})` : t === "answers" ? "Answers" : "Sources"}
                </button>
              ))}
            </nav>

            {tab === "overview" && (
              <div className="mr-panel">
                {!hasData && <div className="seo-empty">Run a poll first — every number here comes from real engine answers.</div>}
                {hasData && report && (
                  <>
                    <div className="geo-enginecards">
                      {Object.entries(report.engines).map(([engine, block]) => (
                        <div key={engine} className="geo-enginecard">
                          <div className="geo-enginecard__name">{ENGINE_LABELS[engine] ?? engine}</div>
                          <div className="geo-enginecard__num">{pct(block.mention.rate)}<em>{band(block.mention.stdev)}</em></div>
                          <div className="geo-enginecard__sub">
                            named · {block.n_answers} answers{block.n_errors ? ` · ${block.n_errors} errors` : ""}
                          </div>
                          <div className="geo-enginecard__sub">cited {pct(block.citation.rate)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mr-section">
                      <h3 className="mr-section__title">Share of voice (position-weighted)</h3>
                      {Object.entries(report.blended.sov.share)
                        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                        .map(([entity, share]) => (
                          <div key={entity} className="geo-bar">
                            <span className="geo-bar__label">
                              {entity === "self" ? brand.name : report.competitor_names[entity] ?? entity}
                            </span>
                            <span className="geo-bar__track">
                              <span className={`geo-bar__fill${entity === "self" ? " geo-bar__fill--self" : ""}`}
                                    style={{ width: `${Math.max(2, Math.round((share ?? 0) * 100))}%` }} />
                            </span>
                            <span className="geo-bar__num">{pct(share)}</span>
                          </div>
                        ))}
                      <p className="geo-note">
                        {report.blended.sov.unclaimed_answers} answers mentioned no tracked brand. Numbers are
                        sampled from {report.blended.mention.n_answers} answers over {report.days} days — AI output
                        varies run to run; the ± band is that variance, not an error.
                      </p>
                    </div>
                    <div className="mr-section">
                      <h3 className="mr-section__title">Tracked competitors</h3>
                      <div className="geo-competitors">
                        {(brandCfg?.competitors ?? []).map((c) => (
                          <span key={c.key} className="seo-chip">{c.name} · {pct(report.competitors[c.key]?.rate ?? null)}</span>
                        ))}
                        {user?.is_creator && (
                          <span className="geo-addcomp">
                            <input value={newCompetitor} placeholder="Add competitor…"
                                   onChange={(e) => setNewCompetitor(e.target.value)}
                                   onKeyDown={(e) => e.key === "Enter" && void addCompetitor()} />
                            <button className="seo-btn" onClick={() => void addCompetitor()}>Track</button>
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "prompts" && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Prompt universe</h2>
                  {user?.is_creator && (
                    <div className="geo-promptops">
                      <button className="seo-btn" disabled={busy} onClick={() => void generate()}>
                        <Icon name="sparkles" size={13} /> {prompts.length ? "Regenerate" : "Generate"}
                      </button>
                      <button className="seo-btn seo-btn--primary" disabled={busy || !prompts.length} onClick={() => void savePrompts()}>
                        Save
                      </button>
                    </div>
                  )}
                </div>
                {prompts.length === 0 && (
                  <div className="seo-empty">No prompts yet — these are the buyer questions we poll engines with.</div>
                )}
                {prompts.map((p, i) => (
                  <div key={p.id} className={`geo-prompt${p.enabled ? "" : " geo-prompt--off"}`}>
                    <input type="checkbox" checked={p.enabled} disabled={!user?.is_creator}
                           onChange={(e) => setPrompts(prompts.map((q, j) => (j === i ? { ...q, enabled: e.target.checked } : q)))} />
                    <input className="geo-prompt__text" value={p.text} disabled={!user?.is_creator}
                           onChange={(e) => setPrompts(prompts.map((q, j) => (j === i ? { ...q, text: e.target.value } : q)))} />
                    <span className={`seo-chip geo-prompt__intent geo-prompt__intent--${p.intent}`}>{p.intent}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "answers" && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Raw answers</h2>
                  <select className="geo-select" value={answerEngine} onChange={(e) => void loadAnswers(e.target.value)}>
                    <option value="">All engines</option>
                    {Object.keys(ENGINE_LABELS).map((e) => <option key={e} value={e}>{ENGINE_LABELS[e]}</option>)}
                  </select>
                </div>
                {answers.length === 0 && <div className="seo-empty">No stored answers for this window.</div>}
                {answers.map((a, i) => (
                  <div key={`${a.prompt_id}-${a.engine}-${a.run}-${i}`} className="geo-answer">
                    <button className="geo-answer__head" onClick={() => setOpenAnswer(openAnswer === i ? null : i)}>
                      <span className="geo-answer__prompt">{a.prompt_text}</span>
                      <span className="geo-answer__chips">
                        <span className="seo-chip">{ENGINE_LABELS[a.engine] ?? a.engine} · run {a.run}</span>
                        {a.error ? (
                          <span className="seo-chip seo-chip--off">error</span>
                        ) : (
                          <>
                            <span className={`seo-chip ${a.brand_mentioned ? "seo-chip--on" : "seo-chip--off"}`}>
                              {a.brand_mentioned ? `named #${a.brand_position}` : "not named"}
                            </span>
                            <span className={`seo-chip ${a.brand_cited ? "seo-chip--on" : "seo-chip--off"}`}>
                              {a.brand_cited ? "cited" : "not cited"}
                            </span>
                            {a.sentiment && <span className="seo-chip">{a.sentiment}</span>}
                          </>
                        )}
                      </span>
                    </button>
                    {openAnswer === i && (
                      <div className="geo-answer__body">
                        {a.error ? <p className="geo-answer__error">{a.error}</p> : <p>{a.text}</p>}
                        {a.citations.length > 0 && (
                          <div className="geo-answer__cites">
                            {a.citations.map((c, j) => (
                              <a key={j} href={c.url} target="_blank" rel="noreferrer" className="seo-chip">{c.domain}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "sources" && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Source gap — where to earn presence</h2>
                  <span className="mr-panel__sub">Domains the engines cite on your prompts in answers where you're absent.</span>
                </div>
                {!report?.source_gap.length && <div className="seo-empty">No gap data yet — run a poll first.</div>}
                {!!report?.source_gap.length && (
                  <table className="geo-table">
                    <thead>
                      <tr><th>Domain</th><th>Cited (you absent)</th><th>Example prompts</th></tr>
                    </thead>
                    <tbody>
                      {report.source_gap.map((g) => (
                        <tr key={g.domain}>
                          <td>{g.domain}</td>
                          <td>{g.count}×</td>
                          <td className="geo-table__examples">
                            {g.example_prompt_ids
                              .map((pid) => prompts.find((p) => p.id === pid)?.text ?? pid)
                              .join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!!report && (
                  <div className="mr-section">
                    <h3 className="mr-section__title">Most-cited domains overall</h3>
                    <div className="geo-competitors">
                      {report.blended.source_mix.map((s) => (
                        <span key={s.domain} className="seo-chip">{s.domain} · {s.count}</span>
                      ))}
                    </div>
                    <p className="geo-note">
                      Source mixes shift between engines and over time — we measure them each poll instead of assuming.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
