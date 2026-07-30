"use client";

import { useCallback, useEffect, useState } from "react";
import {
  blogApproveKeywords, blogApproveOutline, blogBuildOutline, blogCreateRun,
  blogDraft, blogExport, blogRun, blogRuns, blogSaveDraft, blogScanSite,
  blogSites, blogSiteTopics, blogVetCitations,
  type BlogCitation, type BlogGapRow, type BlogOutlineItem, type BlogRun,
  type BlogRunSummary, type BlogSheet, type BlogSiteSummary, type BlogTopicSuggestion,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";

/** SEO Blog Writer (a9) — a 3-gate studio: Keyword Target Sheet → Outline &
 * citations → compliant draft. Every stage is user-editable before the next
 * gate; nothing advances without an explicit Approve click. */

type BlogStage = "research" | "outline" | "draft";

const STAGES: { key: BlogStage; label: string }[] = [
  { key: "research", label: "Keyword sheet" },
  { key: "outline", label: "Outline & citations" },
  { key: "draft", label: "Draft" },
];

const TAGS: BlogGapRow["tag"][] = ["main", "secondary", "long_tail", "aio"];
const TAG_LABEL: Record<BlogGapRow["tag"], string> = {
  main: "main", secondary: "secondary", long_tail: "long-tail", aio: "AIO",
};

const fmt = (n: number) => n.toLocaleString("en-US");

/* --------------------------------------------------------- small pieces --- */

function DegradedFlags({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <>
      {notes.map((n) => (
        <div key={n} className="blog-flag"><Icon name="triangle-alert" size={13} /> {n}</div>
      ))}
    </>
  );
}

function GapTable({ sheet, onChange }: { sheet: BlogSheet; onChange: (next: BlogSheet) => void }) {
  return (
    <table className="blog-table">
      <thead><tr><th>Gap keyword</th><th>Tag</th><th>Volume</th><th>Source</th><th /></tr></thead>
      <tbody>
        {sheet.gap.map((g, i) => (
          <tr key={g.keyword}>
            <td>{g.keyword}</td>
            <td>
              <button
                className="blog-pill blog-pill--btn"
                aria-label={`Cycle tag for ${g.keyword}`}
                onClick={() => {
                  const gap = [...sheet.gap];
                  gap[i] = { ...g, tag: TAGS[(TAGS.indexOf(g.tag) + 1) % TAGS.length] };
                  onChange({ ...sheet, gap });
                }}
              >
                {TAG_LABEL[g.tag]}
              </button>
            </td>
            <td>{g.volume ?? "—"}</td>
            <td><span className={`blog-pill${g.source === "ahrefs_pasted" ? " active" : ""}`}>{g.source === "ahrefs_pasted" ? "Ahrefs" : "SERP est."}</span></td>
            <td>
              <button className="blog-x" aria-label={`Remove ${g.keyword}`}
                      onClick={() => onChange({ ...sheet, gap: sheet.gap.filter((_, j) => j !== i) })}>
                <Icon name="x" size={13} />
              </button>
            </td>
          </tr>
        ))}
        {!sheet.gap.length && <tr><td colSpan={5} className="blog-empty">No gap keywords.</td></tr>}
      </tbody>
    </table>
  );
}

function OutlineEditor({ items, onChange }: { items: BlogOutlineItem[]; onChange: (items: BlogOutlineItem[]) => void }) {
  return (
    <div className="blog-outline">
      {items.map((o, i) => (
        <div key={i} className="blog-row">
          <select className="blog-input blog-input--level" value={o.level}
                  onChange={(e) => { const next = [...items]; next[i] = { ...o, level: Number(e.target.value) }; onChange(next); }}>
            <option value={2}>H2</option><option value={3}>H3</option><option value={4}>H4</option>
          </select>
          <input className="blog-input blog-input--heading" placeholder="Heading" value={o.heading}
                 onChange={(e) => { const next = [...items]; next[i] = { ...o, heading: e.target.value }; onChange(next); }} />
          <input className="blog-input blog-input--note" placeholder="Note — what this section must cover" value={o.note}
                 onChange={(e) => { const next = [...items]; next[i] = { ...o, note: e.target.value }; onChange(next); }} />
          <button className="blog-x" aria-label={`Remove section ${o.heading || i + 1}`}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
      <button className="blog-btn"
              onClick={() => onChange([...items, { heading: "New section", level: 2, note: "", keywords: [] }])}>
        <Icon name="plus" size={13} /> Add section
      </button>
    </div>
  );
}

function DrBadge({ c }: { c: BlogCitation }) {
  return c.dr_status === "ok"
    ? <span className="blog-pill blog-pill--ok">DR {c.dr}</span>
    : <span className="blog-flag">DR unverified</span>;
}

function ComplianceRail({ draft }: { draft: NonNullable<BlogRun["draft"]> }) {
  return (
    <div className="blog-compliance">
      {draft.compliance.checks.map((c) => (
        <div key={c.id} className={`blog-check${c.pass ? "" : " blog-check--fail"}`}>
          <span className="blog-check__mark">{c.pass ? "✓" : "✗"}</span>
          <div>
            <div className="blog-check__label">{c.label}</div>
            <div className="blog-check__detail">{c.detail}</div>
          </div>
        </div>
      ))}
      <div className={`blog-banner${draft.compliance.all_pass ? " blog-banner--pass" : " blog-banner--fail"}`}>
        {draft.compliance.all_pass ? "All checks pass" : "Checks failing — revise or edit the draft"}
      </div>
      {draft.edited && <span className="blog-pill">edited</span>}
    </div>
  );
}

/* ----------------------------------------------------------------- main --- */

type BlogTopics = { suggested: BlogTopicSuggestion[]; avoided: unknown[]; degraded: string[] };

export function BlogAgent({ onToast, onBack }: { onToast: (m: string) => void; onBack: () => void }) {
  const [runs, setRuns] = useState<BlogRunSummary[]>([]);
  const [run, setRun] = useState<BlogRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Website-first home screen
  const [sites, setSites] = useState<BlogSiteSummary[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [websiteInput, setWebsiteInput] = useState("");
  const [topics, setTopics] = useState<BlogTopics | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // "apna keyword" quick kickoff + collapsed Ahrefs optional
  const [ownKeyword, setOwnKeyword] = useState("");
  const [metricsPaste, setMetricsPaste] = useState("");
  const [ckRows, setCkRows] = useState<{ url: string; csv: string }[]>([{ url: "", csv: "" }]);

  // Stage-2 DR paste
  const [drPaste, setDrPaste] = useState("");

  // Stage-3 draft editor
  const [md, setMd] = useState("");

  const loadRuns = useCallback(() => {
    blogRuns().then((r) => setRuns(r.runs)).catch((e) => onToast(String(e)));
  }, [onToast]);

  const loadSites = useCallback(() => {
    blogSites().then((r) => {
      setSites(r.sites);
      setActiveDomain((prev) => prev ?? r.sites[0]?.domain ?? null);
    }).catch((e) => onToast(String(e)));
  }, [onToast]);

  const loadTopics = useCallback((domain: string) => {
    setTopicsLoading(true);
    return blogSiteTopics(domain)
      .then((t) => setTopics(t))
      .catch((e) => onToast(String(e)))
      .finally(() => setTopicsLoading(false));
  }, [onToast]);

  useEffect(() => { loadRuns(); loadSites(); }, [loadRuns, loadSites]);
  useEffect(() => { if (run?.draft) setMd(run.draft.markdown); }, [run?.id, run?.draft]);
  useEffect(() => {
    if (!activeDomain) { setTopics(null); return; }
    loadTopics(activeDomain);
  }, [activeDomain, loadTopics]);

  const guard = useCallback(async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      onToast(String(err));
    } finally {
      setBusy(null);
    }
  }, [busy, onToast]);

  function goToRunsList() {
    setRun(null);
    loadRuns();
  }

  function addCkRow() { setCkRows((rows) => [...rows, { url: "", csv: "" }]); }
  function removeCkRow(i: number) { setCkRows((rows) => rows.filter((_, j) => j !== i)); }
  function updateCkRow(i: number, patch: Partial<{ url: string; csv: string }>) {
    setCkRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function rememberSite(profile: BlogSiteSummary) {
    setSites((prev) => [profile, ...prev.filter((s) => s.domain !== profile.domain)]);
  }

  async function scanWebsite() {
    const website = websiteInput.trim();
    if (!website) return;
    const profile = await blogScanSite(website);
    rememberSite(profile);
    setWebsiteInput("");
    // Selecting a domain the active-site effect doesn't already watch triggers its
    // topics load; re-scanning the currently-active domain needs an explicit refresh.
    if (profile.domain === activeDomain) await loadTopics(profile.domain);
    else setActiveDomain(profile.domain);
  }

  async function rescanSite(domain: string) {
    const profile = await blogScanSite(domain);
    rememberSite(profile);
    await loadTopics(profile.domain);
  }

  async function writeTopic(kwKeyword: string) {
    const created = await blogCreateRun({ keyword: kwKeyword, website: activeDomain ?? undefined });
    setRun(created);
  }

  async function kickoffOwnKeyword() {
    const competitor_keywords_paste: Record<string, string> = {};
    for (const r of ckRows) {
      if (r.url.trim() && r.csv.trim()) competitor_keywords_paste[r.url.trim()] = r.csv;
    }
    const created = await blogCreateRun({
      keyword: ownKeyword.trim(),
      metrics_paste: metricsPaste,
      competitor_keywords_paste,
      website: activeDomain ?? undefined,
    });
    setRun(created);
    setOwnKeyword(""); setMetricsPaste(""); setCkRows([{ url: "", csv: "" }]);
  }

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  /* --------------------------------------------------- runs list / kickoff */

  if (!run) {
    return (
      <div className="mr-app blog-app">
        <header className="mr-top">
          <button className="mr-top__back" onClick={onBack} aria-label="Back">
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="mr-top__id">
            <span className="mr-top__name">SEO Blog Writer</span>
            <span className="mr-top__sub">Keyword sheet → outline &amp; citations → compliant draft</span>
          </div>
        </header>
        <div className="mr-body">
          <div className="mr-panel">
            {!sites.length && (
              <div className="blog-card">
                <h3>New blog run</h3>
                <p className="blog-note">Kaunsi website ke liye likhna hai? / Which website do you write for?</p>
                <input className="blog-input blog-input--full" placeholder="yourdomain.com"
                       value={websiteInput} onChange={(e) => setWebsiteInput(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter" && websiteInput.trim() && busy === null) guard("scan-site", scanWebsite); }} />
                <div className="blog-actions">
                  <button className="blog-btn blog-btn--primary" disabled={!websiteInput.trim() || busy !== null}
                          onClick={() => guard("scan-site", scanWebsite)}>
                    {busy === "scan-site" ? "Reading the site…" : "Analyze website"}
                  </button>
                </div>
              </div>
            )}

            {!!sites.length && (
              <>
                <div className="blog-card">
                  <h3>Which website?</h3>
                  <div className="blog-chips">
                    {sites.map((s) => (
                      <div key={s.domain} className={`blog-chip${s.domain === activeDomain ? " active" : ""}`}>
                        <button className="blog-chip__btn" disabled={busy !== null}
                                onClick={() => setActiveDomain(s.domain)}>
                          <span className="blog-chip__domain">{s.domain}</span>
                          <span className="blog-chip__meta">
                            {s.counts.posts} post{s.counts.posts === 1 ? "" : "s"} · {s.counts.pages} page{s.counts.pages === 1 ? "" : "s"} · scanned {s.scanned}
                          </span>
                        </button>
                        {s.domain === activeDomain && (
                          <button className="blog-btn" disabled={busy !== null}
                                  onClick={() => guard("rescan", () => rescanSite(s.domain))}>
                            {busy === "rescan" ? "Reading the site…" : "Re-scan"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="blog-row">
                    <input className="blog-input" placeholder="+ add website" value={websiteInput}
                           onChange={(e) => setWebsiteInput(e.target.value)}
                           onKeyDown={(e) => { if (e.key === "Enter" && websiteInput.trim() && busy === null) guard("scan-site", scanWebsite); }} />
                    <button className="blog-btn" disabled={!websiteInput.trim() || busy !== null}
                            onClick={() => guard("scan-site", scanWebsite)}>
                      {busy === "scan-site" ? "Reading the site…" : "Add"}
                    </button>
                  </div>
                </div>

                {activeDomain && (
                  <div className="blog-card">
                    <h3>Suggested topics</h3>
                    {topicsLoading && <p className="blog-note">Finding fresh angles from the site…</p>}
                    {topics && <DegradedFlags notes={topics.degraded} />}
                    <div className="blog-topics">
                      {topics?.suggested.map((t) => (
                        <div key={t.keyword} className="blog-topic">
                          <div className="blog-topic__kw">{t.keyword}</div>
                          <p className="blog-note">{t.angle}</p>
                          {t.collisions.map((c) => (
                            <div key={c.url} className="blog-flag">
                              <Icon name="triangle-alert" size={13} />
                              overlaps {c.title} — {c.url} ({Math.round(c.overlap * 100)}%)
                            </div>
                          ))}
                          <div className="blog-actions">
                            <button className="blog-btn blog-btn--primary" disabled={busy !== null}
                                    onClick={() => guard(`write-topic:${t.keyword}`, () => writeTopic(t.keyword))}>
                              {busy === `write-topic:${t.keyword}` ? "Opening…" : "Write this →"}
                            </button>
                          </div>
                        </div>
                      ))}
                      {topics && !topicsLoading && !topics.suggested.length &&
                        <p className="blog-empty">No fresh topic ideas right now — apna keyword likh dijiye neeche.</p>}
                    </div>
                  </div>
                )}

                <div className="blog-card">
                  <h3>Apna keyword</h3>
                  <input className="blog-input blog-input--full" placeholder="Main target keyword (US)"
                         value={ownKeyword} onChange={(e) => setOwnKeyword(e.target.value)} />
                  <div className="blog-actions">
                    <button className="blog-btn blog-btn--primary" disabled={!ownKeyword.trim() || busy !== null}
                            onClick={() => guard("kickoff", kickoffOwnKeyword)}>
                      {busy === "kickoff" ? "Researching SERP…" : "Write this →"}
                    </button>
                  </div>
                  <details className="blog-optional">
                    <summary>Ahrefs data (optional)</summary>
                    <textarea className="blog-textarea" placeholder="Ahrefs keyword metrics — optional paste (Volume / KD / Traffic potential)"
                              value={metricsPaste} onChange={(e) => setMetricsPaste(e.target.value)} />
                    <div className="blog-field-label">Competitor organic-keywords CSV (optional) — one row per competitor URL</div>
                    {ckRows.map((r, i) => (
                      <div key={i} className="blog-row">
                        <input className="blog-input" placeholder="Competitor URL" value={r.url}
                               onChange={(e) => updateCkRow(i, { url: e.target.value })} />
                        <textarea className="blog-textarea" placeholder="That competitor's Ahrefs organic-keywords CSV export"
                                  value={r.csv} onChange={(e) => updateCkRow(i, { csv: e.target.value })} />
                        {ckRows.length > 1 && (
                          <button className="blog-x" aria-label={`Remove competitor row ${i + 1}`} onClick={() => removeCkRow(i)}>
                            <Icon name="x" size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="blog-btn" onClick={addCkRow}>
                      <Icon name="plus" size={13} /> Add competitor
                    </button>
                  </details>
                </div>
              </>
            )}

            <div className="blog-card">
              <h3>Previous runs</h3>
              <div className="blog-runs">
                {runs.map((r) => (
                  <button key={r.id} className="blog-run" disabled={busy !== null}
                          onClick={() => guard("open-run", async () => setRun(await blogRun(r.id)))}>
                    <span className="blog-run__kw">{r.keyword}</span>
                    <span className="blog-run__created">{r.created}</span>
                    <span className="blog-pill active">{r.stage}</span>
                  </button>
                ))}
                {!runs.length && <p className="blog-empty">No runs yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- run open */

  const sheet = run.sheet;
  const od = run.outline_doc;
  const cits = run.citations;

  const setSheet = (next: BlogSheet) => setRun({ ...run, sheet: next });
  const setOutlineItems = (items: BlogOutlineItem[]) =>
    od && setRun({ ...run, outline_doc: { ...od, outline: items } });
  const setMeta = (patch: Partial<{ title: string; description: string; slug: string }>) =>
    od && setRun({ ...run, outline_doc: { ...od, meta: { ...od.meta, ...patch } } });

  return (
    <div className="mr-app blog-app">
      <header className="mr-top">
        <button className="mr-top__back" onClick={goToRunsList} aria-label="Back to runs">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="mr-top__id">
          <span className="mr-top__name">{run.keyword}</span>
          <span className="mr-top__sub">SEO Blog Writer</span>
        </div>
        <div className="blog-stagebar">
          {STAGES.map((s) => (
            <span key={s.key} className={`blog-pill${run.stage === s.key ? " active" : ""}`}>{s.label}</span>
          ))}
        </div>
      </header>

      <div className="mr-body">
        <div className="mr-panel">

          {run.stage === "research" && sheet && (
            <div className="blog-card">
              <h3>Keyword Target Sheet</h3>
              {sheet.data_source === "serp_estimated" &&
                <div className="blog-flag"><Icon name="triangle-alert" size={13} /> SERP-estimated — no Ahrefs data pasted</div>}
              {sheet.mixed_intent &&
                <div className="blog-flag"><Icon name="triangle-alert" size={13} /> Top 3 pages have mixed intent — pick your direction before approving</div>}
              <DegradedFlags notes={sheet.degraded} />
              {run.site && run.site.cannibalization.map((c) => (
                <div key={c.url} className="blog-flag">
                  <Icon name="triangle-alert" size={13} />
                  overlaps {c.title} — {c.url} ({Math.round(c.overlap * 100)}%)
                </div>
              ))}
              {run.site && !!run.site.internal_links.length && (
                <p className="blog-note">Internal links the draft will use: {run.site.internal_links.join(", ")}</p>
              )}

              <div className="blog-metrics">
                {sheet.metrics.volume != null && <span className="blog-pill">Volume {fmt(sheet.metrics.volume)}</span>}
                {sheet.metrics.kd != null && <span className="blog-pill">KD {sheet.metrics.kd}</span>}
                {sheet.metrics.traffic_potential != null && <span className="blog-pill">Traffic potential {fmt(sheet.metrics.traffic_potential)}</span>}
                <span className="blog-pill">{sheet.serp.aio_present ? "AI Overview present" : "No AI Overview"}</span>
                <span className="blog-pill">{sheet.serp.paa.length} PAA question{sheet.serp.paa.length === 1 ? "" : "s"}</span>
              </div>

              <h4>Top-3 competitors</h4>
              <table className="blog-table">
                <thead><tr><th>URL</th><th>Intent</th><th>Page type</th><th>Audience</th></tr></thead>
                <tbody>
                  {sheet.competitors.map((c) => (
                    <tr key={c.url}><td>{c.url}</td><td>{c.intent}</td><td>{c.page_type}</td><td>{c.audience}</td></tr>
                  ))}
                </tbody>
              </table>

              <h4>Keyword gap</h4>
              <GapTable sheet={sheet} onChange={setSheet} />
              <p className="blog-note">
                Use the main keyword {sheet.usage.target_min}–{sheet.usage.target_max}× — #1 uses it {sheet.usage.main_count_top1}×.
              </p>

              <h4>LSI / supporting terms</h4>
              <div className="blog-lsi">
                {sheet.lsi.map((l, i) => (
                  <span key={l.term} className="blog-pill" title={l.fit_note}>
                    {l.term}
                    <button className="blog-x" aria-label={`Remove ${l.term}`}
                            onClick={() => setSheet({ ...sheet, lsi: sheet.lsi.filter((_, j) => j !== i) })}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
                {!sheet.lsi.length && <span className="blog-empty">None suggested.</span>}
              </div>

              <div className="blog-actions">
                <button className="blog-btn blog-btn--primary" disabled={busy !== null}
                        onClick={() => guard("gate1", async () => setRun(await blogApproveKeywords(run.id, sheet)))}>
                  Approve keywords →
                </button>
              </div>
            </div>
          )}

          {run.stage === "outline" && (
            <div className="blog-card">
              <h3>Outline &amp; citations</h3>
              {!od && (
                <button className="blog-btn blog-btn--primary" disabled={busy !== null}
                        onClick={() => guard("outline", async () => setRun(await blogBuildOutline(run.id)))}>
                  {busy === "outline" ? "Analyzing top 3 + sourcing citations…" : "Build outline & citations"}
                </button>
              )}
              {od && (
                <>
                  <DegradedFlags notes={od.degraded} />
                  <p className="blog-note">
                    ~{fmt(od.targets.word_count)} words · {od.targets.links} external links — top-3 average +15%
                  </p>

                  <h4>Meta</h4>
                  <div className="blog-meta">
                    <input className="blog-input blog-input--full" placeholder="Title tag" value={od.meta.title}
                           onChange={(e) => setMeta({ title: e.target.value })} />
                    <input className="blog-input blog-input--full" placeholder="Meta description" value={od.meta.description}
                           onChange={(e) => setMeta({ description: e.target.value })} />
                    <input className="blog-input blog-input--full" placeholder="Slug" value={od.meta.slug}
                           onChange={(e) => setMeta({ slug: e.target.value })} />
                  </div>

                  <h4>Competitor outlines</h4>
                  <div className="blog-grid">
                    {od.competitor_outlines.map((p) => (
                      <div key={p.url} className="blog-card blog-card--nested">
                        <strong>{p.title || p.url}</strong>
                        <div className="blog-note">{p.url}</div>
                        <div className="blog-note">{p.word_count ?? "?"} words · {p.external_links ?? "?"} ext. links</div>
                        {!!p.h2?.length && (
                          <ul className="blog-h2list">{p.h2.map((h, i) => <li key={i}>{h}</li>)}</ul>
                        )}
                        {p.features && (
                          <div className="blog-lsi">
                            {p.features.eeat && <span className="blog-pill active">E-E-A-T</span>}
                            {p.features.key_takeaways && <span className="blog-pill active">Key takeaways</span>}
                            {p.features.tables && <span className="blog-pill active">Tables</span>}
                            {p.features.tools && <span className="blog-pill active">Tools</span>}
                            {p.features.lacks.map((l) => <span key={l} className="blog-flag">lacks: {l}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <h4>Evaluator</h4>
                  <p className="blog-note">
                    {od.evaluator.beats_all === true
                      ? "✓ outline beats all 3 competitor outlines"
                      : (od.evaluator.note || "Evaluator pending")}
                    {" "}({od.evaluator.rounds} round{od.evaluator.rounds === 1 ? "" : "s"})
                  </p>

                  <h4>Outline</h4>
                  <OutlineEditor items={od.outline} onChange={setOutlineItems} />

                  {cits && (
                    <div className="blog-card blog-card--nested">
                      <h4>Verified citations</h4>
                      {cits.short_by > 0 &&
                        <div className="blog-flag"><Icon name="triangle-alert" size={13} /> {cits.short_by} citation(s) short of target — verified only, nothing invented</div>}
                      <DegradedFlags notes={cits.degraded} />
                      {cits.items.map((c) => (
                        <div key={c.id} className="blog-citation">
                          <a href={c.url} target="_blank" rel="noreferrer">{c.source_name}</a>
                          <span className="blog-note">→ {c.section}</span>
                          <DrBadge c={c} />
                        </div>
                      ))}
                      {!cits.items.length && <p className="blog-empty">No citations yet.</p>}
                      <textarea className="blog-textarea" placeholder="Paste Ahrefs DR per domain (e.g. clio.com 91) to enforce 70+"
                                value={drPaste} onChange={(e) => setDrPaste(e.target.value)} />
                      <button className="blog-btn" disabled={busy !== null}
                              onClick={() => guard("dr", async () => { setRun(await blogVetCitations(run.id, drPaste)); setDrPaste(""); })}>
                        Vet DR
                      </button>
                    </div>
                  )}

                  <div className="blog-actions">
                    <button className="blog-btn blog-btn--primary" disabled={busy !== null}
                            onClick={() => guard("gate2", async () => setRun(await blogApproveOutline(run.id, od.outline)))}>
                      Approve outline →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {run.stage === "draft" && (
            <div className="blog-card">
              <h3>Draft</h3>
              {!run.draft && (
                <button className="blog-btn blog-btn--primary" disabled={busy !== null}
                        onClick={() => guard("draft", async () => setRun(await blogDraft(run.id)))}>
                  {busy === "draft" ? "Writing…" : "Generate draft"}
                </button>
              )}
              {run.draft && (
                <div className="blog-draft-layout">
                  <textarea
                    className="blog-draft"
                    value={md}
                    onChange={(e) => setMd(e.target.value)}
                    onBlur={() => {
                      if (run.draft && md !== run.draft.markdown) {
                        guard("save-draft", async () => setRun(await blogSaveDraft(run.id, md)));
                      }
                    }}
                  />
                  <div className="blog-rail">
                    <ComplianceRail draft={run.draft} />
                    <div className="blog-meta blog-meta--readonly">
                      <div><strong>{run.draft.meta.title}</strong></div>
                      <div className="blog-note">{run.draft.meta.description}</div>
                      <div className="blog-note">/{run.draft.meta.slug}</div>
                    </div>
                    <div className="blog-actions">
                      <button className="blog-btn"
                              onClick={() => navigator.clipboard.writeText(md).then(() => onToast("Markdown copied")).catch((e) => onToast(String(e)))}>
                        <Icon name="copy" size={13} /> Copy markdown
                      </button>
                      <button className="blog-btn" disabled={busy !== null}
                              onClick={() => guard("export-md", async () =>
                                download(await blogExport(run.id, "md"), `${run.draft?.meta.slug || run.id}.md`))}>
                        <Icon name="download" size={13} /> Download .md
                      </button>
                      <button className="blog-btn" disabled={busy !== null}
                              onClick={() => guard("export-docx", async () =>
                                download(await blogExport(run.id, "docx"), `${run.draft?.meta.slug || run.id}.docx`))}>
                        <Icon name="download" size={13} /> Download .docx
                      </button>
                      <button className="blog-btn" onClick={goToRunsList}>
                        <Icon name="arrow-left" size={13} /> Back to runs
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default BlogAgent;
