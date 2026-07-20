"use client";

import { useEffect, useState } from "react";

import {
  seoConfig, seoConfigSave, seoGeoCapture, seoGeoOverview, seoGeoRun,
  type SeoConfig, type SeoGeoBrand, type SeoGeoRun,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

import {
  brandToDraft, draftToBrand, emptyBrandDraft, normalizeSlug,
  type SeoBrandDraft,
} from "./logic";

const ENGINE_LABELS: Record<string, string> = {
  gpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", ai_overview: "AI Overview",
};

/** True for a "Request failed" from require_admin's 403 — see app/security.py. */
function isAdminOnlyError(e: unknown): boolean {
  return e instanceof Error && e.message === "Admin only";
}

export default function GeoView({ onToast }: { onToast: (msg: string) => void }) {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [brands, setBrands] = useState<SeoGeoBrand[]>([]);
  const [run, setRun] = useState<SeoGeoRun | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Config drawer (admin-only): loaded lazily on open, never clobbers the
  // other config keys — save sends the FULL loaded object with only `brands`
  // replaced by the edited drafts.
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<SeoConfig | null>(null);
  const [brandDrafts, setBrandDrafts] = useState<Record<string, SeoBrandDraft>>({});
  const [newSlug, setNewSlug] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const load = () =>
    seoGeoOverview().then((r) => setBrands(r.brands)).catch((e) => onToast(String(e)));
  useEffect(() => { void load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const capture = async () => {
    setCapturing(true);
    try {
      await seoGeoCapture();
      onToast("GEO capture complete");
      await load();
    } catch (e) {
      onToast(`GEO capture failed: ${e}`);
    } finally {
      setCapturing(false);
    }
  };

  const openConfig = async () => {
    try {
      const cfg = await seoConfig();
      setConfig(cfg);
      setBrandDrafts(
        Object.fromEntries(
          Object.entries(cfg.brands ?? {}).map(([slug, b]) => [slug, brandToDraft(b)]),
        ),
      );
      setNewSlug("");
      setConfigOpen(true);
    } catch (e) {
      onToast(isAdminOnlyError(e) ? "Admin access required" : `Could not load configuration: ${e}`);
    }
  };

  const updateDraft = (slug: string, patch: Partial<SeoBrandDraft>) =>
    setBrandDrafts((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));

  const removeBrand = (slug: string) =>
    setBrandDrafts((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });

  const addBrand = () => {
    const slug = normalizeSlug(newSlug);
    if (!slug || brandDrafts[slug]) return;
    setBrandDrafts((prev) => ({ ...prev, [slug]: emptyBrandDraft() }));
    setNewSlug("");
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const brands = Object.fromEntries(
        Object.entries(brandDrafts).map(([slug, d]) => [slug, draftToBrand(d)]),
      );
      const next = await seoConfigSave({ ...config, brands });
      setConfig(next);
      setBrandDrafts(
        Object.fromEntries(
          Object.entries(next.brands ?? {}).map(([slug, b]) => [slug, brandToDraft(b)]),
        ),
      );
      onToast("GEO configuration saved");
      setConfigOpen(false);
    } catch (e) {
      onToast(isAdminOnlyError(e) ? "Admin access required" : `Save failed: ${e}`);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="seo-geo">
      <div className="seo-geo-actions">
        {isAdmin && (
          <button onClick={() => void openConfig()}>Configure</button>
        )}
        <button onClick={() => void capture()} disabled={capturing}>
          {capturing ? "Querying AI engines…" : "Run GEO check now"}
        </button>
      </div>

      {brands.length === 0 && (
        <p className="seo-empty">
          No GEO runs yet. Configure brands (name, domain, competitors) in /api/seo/config,
          then run a check.
        </p>
      )}

      <div className="seo-geo-grid">
        {brands.map((b) => {
          const latest = b.latest;
          const prev = b.history[1];
          const trend =
            latest && prev ? (latest.score > prev.score ? "▲" : latest.score < prev.score ? "▼" : "–") : "";
          return (
            <article key={b.brand} className="seo-geo-card">
              <header>
                <h2>{b.brand}</h2>
                <span className="seo-geo-score">
                  {latest ? latest.score.toFixed(1) : "—"}<small>/10</small> {trend}
                </span>
              </header>
              {latest && (
                <>
                  <div className="seo-geo-engines">
                    {Object.entries(latest.engine_scores).map(([engine, s]) => (
                      <span key={engine} className="seo-geo-engine">
                        {ENGINE_LABELS[engine] ?? engine}: {s.toFixed(1)}
                      </span>
                    ))}
                    {latest.no_data_engines.map((engine) => (
                      <span key={engine} className="seo-geo-engine is-nodata">
                        {ENGINE_LABELS[engine] ?? engine}: no data this week
                      </span>
                    ))}
                  </div>
                  {typeof latest.components?.sov === "number" && (
                    <div className="seo-geo-sov">
                      <div className="seo-geo-sov-label">
                        <span>Share of voice vs competitors</span>
                        <span>{Math.round(latest.components.sov * 100)}%</span>
                      </div>
                      <div className="seo-geo-sov-bar">
                        <i style={{ width: `${Math.min(100, Math.max(0, latest.components.sov * 100))}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="seo-geo-history">
                    {b.history.slice(0, 8).reverse().map((h) => (
                      <button
                        key={h.id}
                        className="seo-geo-week"
                        title={`${h.week}: ${h.score}`}
                        style={{ height: `${Math.max(8, h.score * 4)}px` }}
                        onClick={() => void seoGeoRun(h.id).then(setRun)}
                      />
                    ))}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {run && (
        <aside className="seo-drawer" aria-label="GEO run detail">
          <header>
            <h2>{run.brand} — {run.week}</h2>
            <button onClick={() => setRun(null)} aria-label="Close">✕</button>
          </header>
          {run.answers.map((a, i) => (
            <section key={i} className={`seo-geo-answer${a.error ? " is-error" : ""}`}>
              <h3>{ENGINE_LABELS[a.engine] ?? a.engine} · {a.question}</h3>
              {a.error ? (
                <p className="seo-fallback-note">Engine call failed: {a.error}</p>
              ) : (
                <>
                  <p className="seo-geo-flags">
                    {a.mentioned ? "✓ mentioned" : "✗ not mentioned"} ·{" "}
                    {a.cited ? "✓ cited" : "✗ not cited"}
                  </p>
                  <blockquote>{a.answer_text}</blockquote>
                  {a.citations.length > 0 && (
                    <ul className="seo-excluded">{a.citations.map((c) => <li key={c}>{c}</li>)}</ul>
                  )}
                </>
              )}
            </section>
          ))}
        </aside>
      )}

      {configOpen && config && (
        <aside className="seo-drawer" aria-label="GEO configuration">
          <header>
            <h2>Configure GEO brands</h2>
            <button onClick={() => setConfigOpen(false)} aria-label="Close">✕</button>
          </header>
          <p className="seo-sub">
            Weights and engine settings are untouched — only brand definitions are saved here.
          </p>

          {Object.entries(brandDrafts).map(([slug, draft]) => (
            <section key={slug} className="seo-config-brand">
              <div className="seo-config-brand-head">
                <strong>{slug}</strong>
                <button onClick={() => removeBrand(slug)} aria-label={`Remove ${slug}`}>✕</button>
              </div>
              <label>
                Name
                <input value={draft.name} onChange={(e) => updateDraft(slug, { name: e.target.value })} />
              </label>
              <label>
                Domain
                <input value={draft.domain} onChange={(e) => updateDraft(slug, { domain: e.target.value })} />
              </label>
              <label>
                Category
                <input value={draft.category} onChange={(e) => updateDraft(slug, { category: e.target.value })} />
              </label>
              <label>
                Competitors (comma-separated)
                <input
                  value={draft.competitorsText}
                  onChange={(e) => updateDraft(slug, { competitorsText: e.target.value })}
                />
              </label>
              <label>
                Questions (one per line)
                <textarea
                  value={draft.questionsText}
                  onChange={(e) => updateDraft(slug, { questionsText: e.target.value })}
                />
              </label>
            </section>
          ))}

          <section className="seo-config-brand seo-config-add">
            <label>
              New brand slug
              <input
                value={newSlug}
                placeholder="e.g. acme"
                onChange={(e) => setNewSlug(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBrand(); }}
              />
            </label>
            <button onClick={addBrand} disabled={!normalizeSlug(newSlug)}>Add brand</button>
          </section>

          <div className="seo-config-actions">
            <button onClick={() => void saveConfig()} disabled={savingConfig}>
              {savingConfig ? "Saving…" : "Save configuration"}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
