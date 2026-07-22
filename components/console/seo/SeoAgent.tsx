"use client";

import { useCallback, useEffect, useState } from "react";
import {
  seoAnalyzeSite, seoBrandDetail, seoDeleteBrand, seoOauthDisconnect, seoOauthStart, seoOverview,
  seoRunBrand, seoSaveBrand, seoSetTodoStatus,
  type SeoBrand, type SeoGscStatus, type SeoOverview, type SeoPlanItem, type SeoRun,
  type SeoSiteReview, type SeoTodoStatus, type SeoTopic,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon, Tabs } from "@/lib/kit-ui";
import { AskView, AuditView, BriefsView, CompetitorsView, KeywordsView, UpdatePlanButton } from "./labs";

type SeoTab = "todos" | "ask" | "keywords" | "topics" | "competitors" | "briefs" | "audit";

/** SEO agent (a2) — per-brand insights, traffic-estimated to-dos, blog topic lab. */

const fmt = (n: number) => n.toLocaleString("en-US");

function shortPage(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev;
  if (!prev && !now) return null;
  const dir = diff >= 0 ? "up" : "down";
  return (
    <span className={`seo-delta seo-delta--${dir}`}>
      <Icon name={diff >= 0 ? "trending-up" : "trending-down"} size={13} />
      {fmt(Math.abs(diff))}
    </span>
  );
}

function TrendChip({ trend }: { trend: SeoTopic["trend"] }) {
  const label = { rising: "Rising", falling: "Cooling", flat: "Steady", new: "New" }[trend];
  return <span className={`seo-chip seo-chip--trend-${trend}`}>{label}</span>;
}

function DifficultyChip({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return <span className="seo-chip">—</span>;
  const cls = difficulty === "easy win" ? "easy" : difficulty === "medium" ? "medium" : "hard";
  return <span className={`seo-chip seo-chip--diff-${cls}`}>{difficulty}</span>;
}

function DegradedNotes({ notes, domain }: { notes: string[]; domain: string }) {
  if (!notes.length) return null;
  const friendly = notes.map((n) =>
    n.startsWith("Search Console")
      ? `Search Console access is missing for ${domain} — share the property with the backend service account, then refresh.`
      : n.startsWith("Serper")
        ? "Serper key is not set — blog topics are limited to our own search data (no live Google checks)."
        : n,
  );
  return (
    <div className="seo-degraded">
      <Icon name="alert-triangle" size={14} />
      <div>{friendly.map((n, i) => <div key={i}>{n}</div>)}</div>
    </div>
  );
}

function AddBrandForm({ onSaved, onToast }: { onSaved: () => void; onToast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [seeds, setSeeds] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await seoSaveBrand({
        name,
        domain,
        seeds: seeds.split(",").map((s) => s.trim()).filter(Boolean),
      });
      onToast(`${name} added — run its first analysis`);
      setOpen(false);
      setName(""); setDomain(""); setSeeds("");
      onSaved();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not save brand");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="seo-card seo-card--add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} />
        <span>Add a brand site</span>
      </button>
    );
  }
  return (
    <div className="seo-card seo-card--form">
      <input className="seo-input" placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="seo-input" placeholder="Site domain, e.g. brand.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
      <input className="seo-input" placeholder="Seed keywords, comma separated" value={seeds} onChange={(e) => setSeeds(e.target.value)} />
      <div className="seo-form__row">
        <button className="seo-btn seo-btn--primary" disabled={busy || !name || !domain} onClick={() => void save()}>
          Save brand
        </button>
        <button className="seo-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function SeoAgent({ onToast, onBack }: { onToast: (m: string) => void; onBack: () => void }) {
  const { user } = useAuth();
  const [overview, setOverview] = useState<SeoOverview | null>(null);
  const [brand, setBrand] = useState<SeoBrand | null>(null);
  const [run, setRun] = useState<SeoRun | null>(null);
  const [gsc, setGsc] = useState<SeoGscStatus | null>(null);
  const [plan, setPlan] = useState<SeoPlanItem[]>([]);
  const [siteReview, setSiteReview] = useState<SeoSiteReview | null>(null);
  const [siteBusy, setSiteBusy] = useState(false);
  const [tab, setTab] = useState<SeoTab>("todos");
  const [busy, setBusy] = useState(false);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await seoOverview());
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to load");
    }
  }, [onToast]);

  useEffect(() => { void refreshOverview(); }, [refreshOverview]);

  async function openBrand(id: string) {
    try {
      const detail = await seoBrandDetail(id);
      setBrand(detail.brand);
      setRun(detail.run);
      setGsc(detail.gsc ?? null);
      setPlan(detail.plan ?? []);
      setSiteReview(detail.site_review ?? null);
      setTab("todos");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to load brand");
    }
  }

  async function runBrand(id: string) {
    setBusy(true);
    onToast("Analyzing — pulling Search Console and topic data…");
    try {
      await seoRunBrand(id);
      const detail = await seoBrandDetail(id);
      if (brand?.id === id) {
        setBrand(detail.brand);
        setRun(detail.run);
        setGsc(detail.gsc ?? null);
        setPlan(detail.plan ?? []);
        setSiteReview(detail.site_review ?? null);
      }
      await refreshOverview();
      const summary = detail.run?.summary;
      if (summary?.mode === "rank-tracking") {
        onToast(`Done — ${summary.top10 ?? 0}/${summary.tracked ?? 0} tracked keywords on page 1 (live rankings)`);
      } else if (summary?.est_potential_clicks) {
        onToast(`Done — est. +${fmt(summary.est_potential_clicks)} clicks/month on the table`);
      } else {
        onToast("Done — see the brand card for data status");
      }
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeSite(id: string) {
    setSiteBusy(true);
    onToast("Reading the website — crawling pages and running the expert review (takes a minute or two)…");
    try {
      const review = await seoAnalyzeSite(id);
      setSiteReview(review);
      const detail = await seoBrandDetail(id);
      setRun(detail.run);
      setPlan(detail.plan ?? []);
      onToast(`Site review done — ${review.issues.length} finding(s) added to the fix list`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Site analysis failed");
    } finally {
      setSiteBusy(false);
    }
  }

  async function connectGsc(id: string) {
    try {
      const { url } = await seoOauthStart(id);
      window.open(url, "_blank", "width=540,height=680");
      onToast("Choose the Google account that owns the site's Search Console, press Allow, then hit Refresh data here.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not start the Google connect");
    }
  }

  async function disconnectGsc(id: string) {
    if (!window.confirm("Disconnect Search Console? The brand falls back to live rank tracking.")) return;
    try {
      await seoOauthDisconnect(id);
      setGsc({ connected: false, property: null });
      onToast("Search Console disconnected");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  async function removeBrand(b: SeoBrand) {
    if (!window.confirm(`Remove ${b.name}? Its insights and to-dos disappear from the dashboard.`)) return;
    try {
      await seoDeleteBrand(b.id);
      onToast(`${b.name} removed`);
      setBrand(null); setRun(null);
      await refreshOverview();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function setStatus(todoId: string, status: SeoTodoStatus) {
    if (!brand || !run) return;
    setRun({ ...run, todos: run.todos.map((t) => (t.id === todoId ? { ...t, status } : t)) });
    try {
      await seoSetTodoStatus(brand.id, todoId, status);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not save status");
    }
  }

  const sources = overview?.sources;

  return (
    <div className="mr-app seo-app">
      <header className="mr-top">
        <button className="mr-top__back" onClick={() => (brand ? (setBrand(null), setRun(null)) : onBack())} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="mr-top__id">
          <span className="mr-top__name">SEO Analyst{brand ? ` · ${brand.name}` : ""}</span>
          <span className="mr-top__sub">Search insights, prioritized fixes & blog topics — per brand</span>
        </div>
        {sources && (
          <div className="seo-sources">
            <span className={`seo-chip ${sources.gsc ? "seo-chip--on" : "seo-chip--off"}`}>Search Console</span>
            <span className={`seo-chip ${sources.serp ? "seo-chip--on" : "seo-chip--off"}`}>Google SERP</span>
          </div>
        )}
      </header>

      <div className="mr-body">
        {!brand && (
          <div className="mr-panel">
            <div className="mr-panel__head">
              <h2 className="mr-panel__title">Brands</h2>
              <span className="mr-panel__sub">Every site we watch — open one for its fix list and blog topics.</span>
            </div>
            <div className="seo-grid">
              {(overview?.brands ?? []).map(({ brand: b, last_run, gsc_connected, headline }) => (
                <div key={b.id} className="seo-card" role="button" tabIndex={0}
                     onClick={() => void openBrand(b.id)}
                     onKeyDown={(e) => e.key === "Enter" && void openBrand(b.id)}>
                  <div className="seo-card__head">
                    <span className="seo-card__name">
                      {b.name}
                      {gsc_connected && <span className="seo-chip seo-chip--on seo-card__gsc">GSC ✓</span>}
                    </span>
                    <span className="seo-card__domain">{b.domain}</span>
                  </div>
                  {headline && <div className="seo-card__headline">{headline}</div>}
                  {last_run ? (
                    <>
                      <div className="seo-card__stats">
                        {last_run.summary.mode === "rank-tracking" ? (
                          <>
                            <div className="seo-stat">
                              <span className="seo-stat__label">Page 1</span>
                              <span className="seo-stat__num">
                                {last_run.summary.top10 ?? 0}/{last_run.summary.tracked ?? 0}
                              </span>
                            </div>
                            <div className="seo-stat">
                              <span className="seo-stat__label">Not ranking</span>
                              <span className="seo-stat__num">{last_run.summary.unranked ?? 0}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="seo-stat">
                              <span className="seo-stat__label">Clicks · 28d</span>
                              <span className="seo-stat__num">
                                {fmt(last_run.summary.clicks_28d)}
                                <Delta now={last_run.summary.clicks_28d} prev={last_run.summary.clicks_prev_28d} />
                              </span>
                            </div>
                            <div className="seo-stat">
                              <span className="seo-stat__label">Est. upside</span>
                              <span className="seo-stat__num seo-stat__num--good">
                                +{fmt(last_run.summary.est_potential_clicks)}/mo
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="seo-card__meta">
                        <span>{last_run.todo_count} fixes</span>
                        <span>{last_run.topic_count} topics</span>
                        <span>run {last_run.at}</span>
                        {last_run.degraded.length > 0 && <Icon name="alert-triangle" size={13} />}
                      </div>
                    </>
                  ) : (
                    <div className="seo-card__empty">No analysis yet</div>
                  )}
                  <button className="seo-btn seo-btn--primary" disabled={busy}
                          onClick={(e) => { e.stopPropagation(); void runBrand(b.id); }}>
                    <Icon name="refresh-cw" size={13} /> {last_run ? "Refresh" : "Run first analysis"}
                  </button>
                </div>
              ))}
              {user?.is_creator && <AddBrandForm onSaved={() => void refreshOverview()} onToast={onToast} />}
            </div>
          </div>
        )}

        {brand && (
          <div className="mr-panel">
            <div className="seo-detail__bar">
              <div className="mr-panel__head">
                <h2 className="mr-panel__title">{brand.name}</h2>
                <span className="mr-panel__sub">{brand.domain}{run ? ` · analyzed ${run.at}` : ""}</span>
              </div>
              <div className="seo-detail__actions">
                {gsc?.connected ? (
                  <span className="seo-chip seo-chip--on" title={gsc.property ?? undefined}>
                    Search Console ✓
                    {user?.is_creator && (
                      <button className="seo-chip__x" aria-label="Disconnect Search Console"
                              onClick={() => void disconnectGsc(brand.id)}>×</button>
                    )}
                  </span>
                ) : (
                  <button className="seo-btn" onClick={() => void connectGsc(brand.id)}>
                    <Icon name="link" size={13} /> Connect Search Console
                  </button>
                )}
                <button className="seo-btn" disabled={siteBusy} onClick={() => void analyzeSite(brand.id)}>
                  <Icon name="search" size={13} /> {siteReview ? "Re-analyze website" : "Analyze website"}
                </button>
                <button className="seo-btn seo-btn--primary" disabled={busy} onClick={() => void runBrand(brand.id)}>
                  <Icon name="refresh-cw" size={13} /> Refresh data
                </button>
                {user?.is_creator && (
                  <button className="seo-btn" onClick={() => void removeBrand(brand)}>Remove</button>
                )}
              </div>
            </div>

            {plan.length > 0 && (
              <div className="mr-section seo-poa">
                <h3 className="mr-section__title">Plan of action — do these first</h3>
                {plan.map((p, i) => (
                  <div key={i} className="seo-poa__item">
                    <span className="seo-poa__num">{i + 1}</span>
                    <div className="seo-poa__body">
                      <span className="seo-poa__action">{p.action}</span>
                      <span className="seo-poa__detail">{p.detail}</span>
                    </div>
                    <span className="seo-chip">{p.source}</span>
                  </div>
                ))}
              </div>
            )}

            {siteReview && (
              <div className="mr-section">
                <h3 className="mr-section__title">
                  Site review — {siteReview.page_count} pages read · {siteReview.at}
                </h3>
                {siteReview.positioning && <div className="seo-poa__action">{siteReview.positioning}</div>}
                {siteReview.scorecard && Object.keys(siteReview.scorecard).length > 0 && (
                  <div className="seo-cluster__kws">
                    {Object.entries(siteReview.scorecard).map(([key, cell]) => {
                      const label = {
                        intent: "Intent", content_depth: "Content depth", architecture: "Architecture",
                        trust: "Trust", conversion: "Conversion", ai_search: "AI search",
                      }[key] ?? key;
                      const cls = cell.grade >= 4 ? "seo-chip--on" : cell.grade === 3 ? "seo-chip--sev-medium" : "seo-chip--sev-high";
                      return (
                        <span key={key} className={`seo-chip ${cls}`} title={cell.note}>
                          {label} {cell.grade}/5
                        </span>
                      );
                    })}
                  </div>
                )}
                {siteReview.strengths.length > 0 && (
                  <div className="seo-cluster__kws">
                    {siteReview.strengths.map((s) => (
                      <span key={s} className="seo-chip seo-chip--on">{s}</span>
                    ))}
                  </div>
                )}
                {siteReview.missing_topics.length > 0 && (
                  <>
                    <div className="seo-lab__meta">Topics the site doesn't cover yet — blog fuel:</div>
                    <div className="seo-cluster__kws">
                      {siteReview.missing_topics.map((t) => (
                        <span key={t} className="seo-chip seo-chip--cov-gap">{t}</span>
                      ))}
                    </div>
                  </>
                )}
                <div className="seo-lab__meta">
                  Findings are in the Fix list with everything else — nothing to read twice.
                </div>
              </div>
            )}

            {run && <DegradedNotes notes={run.degraded} domain={brand.domain} />}

            {run && (
              <>
                {run.summary.mode === "rank-tracking" ? (
                  <div className="seo-summary">
                    <div className="seo-stat">
                      <span className="seo-stat__label">Tracked keywords</span>
                      <span className="seo-stat__num">{run.summary.tracked ?? 0}</span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Top 3</span>
                      <span className="seo-stat__num seo-stat__num--good">{run.summary.top3 ?? 0}</span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Page 1</span>
                      <span className="seo-stat__num">{run.summary.top10 ?? 0}</span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Not ranking</span>
                      <span className="seo-stat__num">{run.summary.unranked ?? 0}</span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Since last check</span>
                      <span className="seo-stat__num">
                        {(run.summary.moved_up ?? 0) > 0 && (
                          <span className="seo-delta seo-delta--up">
                            <Icon name="trending-up" size={13} />{run.summary.moved_up}
                          </span>
                        )}
                        {(run.summary.moved_down ?? 0) > 0 && (
                          <span className="seo-delta seo-delta--down">
                            <Icon name="trending-down" size={13} />{run.summary.moved_down}
                          </span>
                        )}
                        {!(run.summary.moved_up || run.summary.moved_down) && "steady"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="seo-summary">
                    <div className="seo-stat">
                      <span className="seo-stat__label">Clicks · 28d</span>
                      <span className="seo-stat__num">
                        {fmt(run.summary.clicks_28d)}
                        <Delta now={run.summary.clicks_28d} prev={run.summary.clicks_prev_28d} />
                      </span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Impressions · 28d</span>
                      <span className="seo-stat__num">{fmt(run.summary.impressions_28d)}</span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Avg. position</span>
                      <span className="seo-stat__num">{run.summary.avg_position || "—"}</span>
                    </div>
                    <div className="seo-stat">
                      <span className="seo-stat__label">Est. upside if fixed</span>
                      <span className="seo-stat__num seo-stat__num--good">+{fmt(run.summary.est_potential_clicks)}/mo</span>
                    </div>
                  </div>
                )}

                {run.insights.length > 0 && (
                  <div className="mr-section">
                    <h3 className="mr-section__title">What changed</h3>
                    <ul className="seo-insights">
                      {run.insights.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}

            <Tabs
              items={[
                { value: "todos", label: "Fix list", count: run?.todos.length || undefined },
                { value: "ask", label: "Ask" },
                { value: "keywords", label: "Keywords" },
                { value: "topics", label: "Blog topics", count: run?.topics.length || undefined },
                { value: "competitors", label: "Competitors" },
                { value: "briefs", label: "Briefs" },
                { value: "audit", label: "Audit" },
              ]}
              value={tab}
              onChange={(v) => setTab(v as SeoTab)}
            />

            {tab === "ask" && <AskView brandId={brand.id} brandName={brand.name} />}
            {tab === "keywords" && <KeywordsView brandId={brand.id} onToast={onToast} />}
            {tab === "competitors" && (
              <CompetitorsView brandId={brand.id} isCreator={!!user?.is_creator} onToast={onToast} />
            )}
            {tab === "briefs" && <BriefsView brandId={brand.id} onToast={onToast} />}
            {tab === "audit" && <AuditView brandId={brand.id} brandName={brand.name} onToast={onToast} />}
            {(tab === "todos" || tab === "topics") && !run && (
              <div className="mr-section seo-empty">
                No analysis yet — hit “Refresh data” to pull the first 28 days of search performance.
              </div>
            )}

            {run && (
              <>
                {tab === "todos" && (
                  <div className="mr-section">
                    <h3 className="mr-section__title">
                      {run.summary.mode === "rank-tracking"
                        ? "Prioritized fixes — from live rankings (drops first)"
                        : "Prioritized fixes — biggest estimated gain first"}
                    </h3>
                    {run.todos.length === 0 && <div className="seo-empty">Nothing above the impact threshold — refresh after the next content push.</div>}
                    {run.todos.map((t) => (
                      <div key={t.id} className={`seo-todo${t.status === "done" ? " seo-todo--done" : ""}`}>
                        {t.est_monthly_clicks != null ? (
                          <div className="seo-todo__gain">+{fmt(t.est_monthly_clicks)}<small>est. clicks/mo</small></div>
                        ) : (
                          <div className="seo-todo__gain seo-todo__gain--pos">
                            {t.position > 0 ? `#${t.position}` : "—"}
                            <small>{t.position > 0 ? "current pos" : t.kind === "site" ? "site fix" : "not ranked"}</small>
                          </div>
                        )}
                        <div className="seo-todo__body">
                          <div className="seo-todo__action">{t.action}</div>
                          <div className="seo-todo__why">{t.why}</div>
                          <div className="seo-todo__meta">
                            {!!t.page && <span>{shortPage(t.page)}</span>}
                            {t.est_monthly_clicks != null && t.position > 0 && <span>pos {t.position}</span>}
                            {t.impressions != null && <span>{fmt(t.impressions)} impressions</span>}
                          </div>
                          {t.kind === "decay" && (
                            <UpdatePlanButton brandId={brand.id} page={t.page} onToast={onToast} />
                          )}
                        </div>
                        <select className={`seo-status seo-status--${t.status}`} value={t.status}
                                onChange={(e) => void setStatus(t.id, e.target.value as SeoTodoStatus)}>
                          <option value="todo">To do</option>
                          <option value="assigned">Assigned</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "topics" && (
                  <div className="mr-section">
                    <h3 className="mr-section__title">Blog topics — ranked by opportunity</h3>
                    {run.topics.length === 0 && <div className="seo-empty">No topics yet — add seed keywords to this brand and refresh.</div>}
                    {run.topics.map((t) => (
                      <div key={t.keyword} className="seo-topic">
                        <div className="seo-topic__main">
                          <span className="seo-topic__kw">{t.keyword}</span>
                          <div className="seo-topic__chips">
                            <span className={`seo-chip seo-chip--tier-${t.priority === "high" ? "high" : t.priority === "medium" ? "medium" : "watch"}`}>
                              {t.priority} priority
                            </span>
                            {t.source === "new idea" && <span className="seo-chip seo-chip--trend-new">new idea</span>}
                            <span className="seo-chip">{t.angle}</span>
                            <TrendChip trend={t.trend} />
                            <DifficultyChip difficulty={t.difficulty} />
                          </div>
                          <div className="seo-topic__why">{t.why}</div>
                          <div className="seo-topic__impact">{t.impact}</div>
                        </div>
                        <div className="seo-topic__nums">
                          <span className="seo-topic__vol">{t.volume_label}</span>
                          {t.est_monthly_clicks != null && (
                            <span className="seo-stat__num--good">≈ +{fmt(t.est_monthly_clicks)} clicks/mo</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SeoAgent;
