"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  bwBrands, bwBuildDraft, bwCommentBlock, bwCreateRun, bwExport, bwPlanVisuals,
  bwResearchStep, bwRun, bwRuns, bwScanInventory, bwInventory, bwStudyVoice, bwVoice,
  type BwBlock, type BwBrand, type BwExportFormat, type BwInventory as BwInventoryDoc,
  type BwRun as BwRunDoc, type BwRunSummary, type BwVoice as BwVoiceDoc,
} from "@/lib/api";
import { Icon } from "@/lib/kit-ui";
import { describeFailure, useLoadSession } from "@/lib/load";
import { useReportWork } from "@/lib/work";

/** Blog Writer (a9) — brand catalogue → blog inventory → deep-research writing desk. */

const ANGLE_LABEL: Record<string, string> = {
  studies: "Studies & data",
  experts: "Expert guides",
  news: "News",
  anecdotes: "Anecdotes & forums",
  competitors: "Competing articles",
  gap: "Gap follow-up",
  targeted: "Targeted",
};

const STATUS_LABEL: Record<string, string> = {
  research: "Researching",
  saturated: "Saturated — nothing new found",
  capped: "Deep enough — go deeper if you want",
};

/** The open run survives dev-server reloads: remounting restores it from here. */
const OPEN_RUN_KEY = "bw-open-run";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function renderInline(line: string, key: string) {
  const parts: ReactNode[] = [];
  const re = new RegExp(MD_LINK.source, "g");
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <a key={`${key}-${i++}`} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>,
    );
    last = m.index + m[0].length;
  }
  parts.push(line.slice(last));
  return parts;
}

/** Draft text renderer: markdown links become anchors, "### " lines become sub-headings. */
function BlockText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) =>
        line.startsWith("### ") ? (
          <span key={i} className="bw-block__sub">{line.slice(4)}{"\n"}</span>
        ) : (
          <span key={i}>{renderInline(line, String(i))}{"\n"}</span>
        ),
      )}
    </>
  );
}

/** Stable citation numbers: n = 1-based ledger order of the cited items (matches exports). */
function citeNumbers(run: BwRunDoc): Record<string, number> {
  const cited = new Set(run.draft?.blocks.flatMap((b) => b.cites) ?? []);
  const numbers: Record<string, number> = {};
  let n = 0;
  for (const item of run.ledger) if (cited.has(item.id)) numbers[item.id] = ++n;
  return numbers;
}

export function BlogWriter({ onToast, onBack }: { onToast: ToastFn; onBack: () => void }) {
  const [brands, setBrands] = useState<BwBrand[] | null>(null);
  const [brand, setBrand] = useState<BwBrand | null>(null);
  const [inventory, setInventory] = useState<BwInventoryDoc | null>(null);
  const [voiceDoc, setVoiceDoc] = useState<BwVoiceDoc | null>(null);
  const [runs, setRuns] = useState<BwRunSummary[]>([]);
  const [run, setRun] = useState<BwRunDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const autoRef = useRef(false);
  useReportWork(!!busy);

  const session = useLoadSession();

  /** Was a fourth private copy of the same two lines. The shared classifier
   *  keeps `RequestTimeoutError`'s own sentence, which none of the copies did. */
  const fail = useCallback(
    (e: unknown, fallback: string) => onToast(describeFailure(e, fallback), "error"),
    [onToast],
  );

  const refresh = useCallback(async () => {
    const attempt = session.begin("desk");
    try {
      const [b, r] = await Promise.all([bwBrands(), bwRuns()]);
      if (!attempt.current()) return;
      setBrands(b.brands);
      setRuns(r.runs);
    } catch (e) {
      const message = attempt.failure(e, "Could not load the Blog Writer");
      if (message) onToast(message, "error");
    }
  }, [session, onToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => () => {
    autoRef.current = false; // leaving the view stops any research loop
  }, []);

  // A dev-server reload (or any remount) must not lose the desk: reopen the
  // remembered run and, if it was mid-research, pick the loop back up.
  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(OPEN_RUN_KEY) : null;
    if (!savedId) return;
    const attempt = session.begin("restore");
    (async () => {
      try {
        const full = await bwRun(savedId);
        if (!attempt.current()) return;
        setRun(full);
        try {
          const b = await bwBrands();
          if (!attempt.current()) return;
          const owner = b.brands.find((x) => x.id === full.brand_id) ?? null;
          setBrand(owner);
          if (owner) {
            try {
              setInventory(await bwInventory(owner.id));
            } catch {
              /* not scanned yet */
            }
          }
        } catch {
          /* brand context is cosmetic here; the run view stands alone */
        }
        if (attempt.current() && full.status === "research") {
          setBusy("research");
          void researchLoop(full);
        }
      } catch {
        localStorage.removeItem(OPEN_RUN_KEY); // run gone — forget it
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openBrand(b: BwBrand) {
    setBrand(b);
    setRun(null);
    setInventory(null);
    setVoiceDoc(null);
    try {
      setInventory(await bwInventory(b.id));
    } catch {
      /* 404 = not scanned yet; the panel offers the scan button */
    }
    try {
      setVoiceDoc(await bwVoice(b.id));
    } catch {
      /* 404 = voice not studied yet */
    }
  }

  async function studyVoice() {
    if (!brand || busy) return;
    setBusy("voice-study");
    try {
      setVoiceDoc(await bwStudyVoice(brand.id));
    } catch (e) {
      fail(e, "Voice study failed");
    } finally {
      setBusy(null);
    }
  }

  async function scan() {
    if (!brand) return;
    setBusy("scan");
    try {
      setInventory(await bwScanInventory(brand.id));
    } catch (e) {
      fail(e, "Scan failed");
    } finally {
      setBusy(null);
    }
  }

  /** Run research rounds back-to-back until the engine says saturated/capped or the user stops. */
  async function researchLoop(startRun: BwRunDoc) {
    autoRef.current = true;
    let current = startRun;
    try {
      while (autoRef.current && current.status === "research") {
        current = await bwResearchStep(current.id);
        setRun(current);
      }
    } catch (e) {
      fail(e, "Research failed");
    } finally {
      autoRef.current = false;
      setBusy(null);
    }
  }

  async function startRun() {
    if (!brand || !topic.trim() || busy) return;
    setBusy("research");
    try {
      const created = await bwCreateRun({ brand_id: brand.id, topic: topic.trim(), notes: notes.trim() || undefined });
      setRun(created);
      localStorage.setItem(OPEN_RUN_KEY, created.id);
      setTopic("");
      setNotes("");
      void bwRuns().then((r) => setRuns(r.runs)).catch(() => undefined);
      await researchLoop(created);
    } catch (e) {
      fail(e, "Could not start the run");
      setBusy(null);
    }
  }

  async function goDeeper() {
    if (!run || busy) return;
    setBusy("research");
    try {
      const stepped = await bwResearchStep(run.id);
      setRun(stepped);
      if (stepped.status === "research") await researchLoop(stepped);
      else setBusy(null);
    } catch (e) {
      fail(e, "Research failed");
      setBusy(null);
    }
  }

  function stopResearch() {
    autoRef.current = false;
  }

  async function writeDraft() {
    if (!run || busy) return;
    stopResearch();
    setBusy("draft");
    try {
      setRun(await bwBuildDraft(run.id));
    } catch (e) {
      fail(e, "Drafting failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendComment(block: BwBlock) {
    const comment = (comments[block.id] ?? "").trim();
    if (!run || !comment || busy) return;
    setBusy(`comment-${block.id}`);
    try {
      setRun(await bwCommentBlock(run.id, block.id, comment));
      setComments((c) => ({ ...c, [block.id]: "" }));
    } catch (e) {
      fail(e, "Revision failed");
    } finally {
      setBusy(null);
    }
  }

  async function planVisuals() {
    if (!run || busy) return;
    setBusy("visuals");
    try {
      setRun(await bwPlanVisuals(run.id));
    } catch (e) {
      fail(e, "Visual planning failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportRun(format: BwExportFormat) {
    if (!run) return;
    try {
      const slug = run.draft?.meta.slug || run.id;
      const names: Record<BwExportFormat, string> = {
        md: `${slug}.md`, html: `${slug}.html`, txt: `${slug}.txt`,
        "visuals-md": `${slug}-visual-prompts.md`, "visuals-txt": `${slug}-visual-prompts.txt`,
      };
      download(await bwExport(run.id, format), names[format]);
    } catch (e) {
      fail(e, "Export failed");
    }
  }

  async function openRun(summary: BwRunSummary) {
    try {
      const full = await bwRun(summary.id);
      const owner = brands?.find((b) => b.id === full.brand_id) ?? null;
      if (owner) {
        setBrand(owner);
        try {
          setInventory(await bwInventory(owner.id));
        } catch {
          setInventory(null);
        }
      }
      setRun(full);
      localStorage.setItem(OPEN_RUN_KEY, full.id);
    } catch (e) {
      fail(e, "Could not open the run");
    }
  }

  function back() {
    if (run) {
      stopResearch();
      setRun(null);
      localStorage.removeItem(OPEN_RUN_KEY);
    } else if (brand) {
      setBrand(null);
      setInventory(null);
      void refresh();
    } else {
      onBack();
    }
  }

  const numbers = run ? citeNumbers(run) : {};
  const researching = busy === "research";

  return (
    <div className="mr-app bw-app">
      <header className="mr-top">
        <button className="mr-top__back" onClick={back} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="mr-top__id">
          <span className="mr-top__name">
            Blog Writer{brand ? ` · ${brand.name}` : ""}{run ? ` · ${run.topic}` : ""}
          </span>
          <span className="mr-top__sub">Deep-research drafts with real citations — per brand</span>
        </div>
        {run && (
          <span className={`bw-status bw-status--${run.status}`}>
            {researching && <Icon name="loader-circle" size={13} className="bw-spin" />}
            {STATUS_LABEL[run.status] ?? run.status}
          </span>
        )}
      </header>

      <div className="mr-body">
        {/* ------------------------------------------------ brand catalogue */}
        {!brand && (
          <>
            <div className="mr-panel">
              <div className="mr-panel__head">
                <h2 className="mr-panel__title">Brands</h2>
                <span className="mr-panel__sub">Open a brand for its published blogs and the writing desk.</span>
              </div>
              {!brands && <div className="bw-empty">Loading brands…</div>}
              {brands && brands.length === 0 && (
                <div className="bw-empty">No brands yet — add one in the SEO Analyst first; both agents share the registry.</div>
              )}
              <div className="bw-grid">
                {(brands ?? []).map((b) => (
                  <div key={b.id} className="bw-card" role="button" tabIndex={0}
                       onClick={() => void openBrand(b)}
                       onKeyDown={(e) => e.key === "Enter" && void openBrand(b)}>
                    <div className="bw-card__head">
                      <span className="bw-card__name">{b.name}</span>
                      <span className="bw-card__domain">{b.domain}</span>
                    </div>
                    {b.inventory ? (
                      <div className="bw-card__meta">
                        <Icon name="file-text" size={13} />
                        {b.inventory.counts.blog_urls} published posts · scanned {fmtDate(b.inventory.scanned)}
                      </div>
                    ) : (
                      <div className="bw-card__meta bw-card__meta--dim">
                        <Icon name="search" size={13} /> Site not scanned yet
                      </div>
                    )}
                    {b.voice && (
                      <div className="bw-card__meta">
                        <Icon name="book-open" size={13} /> voice studied from {b.voice.count} posts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {runs.length > 0 && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Recent drafts</h2>
                  <span className="mr-panel__sub">Pick up where a run left off.</span>
                </div>
                <div className="bw-runs">
                  {runs.slice(0, 12).map((r) => (
                    <button key={r.id} className="bw-runrow" onClick={() => void openRun(r)}>
                      <span className="bw-runrow__topic">{r.topic}</span>
                      <span className="bw-runrow__meta">{r.brand_name} · {fmtDate(r.created)} · {r.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------ brand panel + desk */}
        {brand && !run && (
          <div className="bw-desk">
            <div className="mr-panel bw-desk__inventory">
              <div className="mr-panel__head">
                <h2 className="mr-panel__title">Published on {brand.domain}</h2>
                <button className="bw-btn" disabled={busy === "scan"} onClick={() => void scan()}>
                  <Icon name="refresh-cw" size={14} className={busy === "scan" ? "bw-spin" : undefined} />
                  {inventory ? "Rescan" : "Scan the site"}
                </button>
              </div>
              {!inventory && <div className="bw-empty">Not scanned yet — scan the site to list every published blog. The desk avoids topics the brand already covers.</div>}
              {inventory && (
                <>
                  <div className="bw-inv__counts">
                    {inventory.counts.blog_urls} posts found · {inventory.counts.sitemap_urls} URLs sitemapped · scanned {fmtDate(inventory.scanned)}
                  </div>
                  {inventory.notes.map((n) => (
                    <div key={n} className="bw-note">{n}</div>
                  ))}
                  <ul className="bw-inv__list">
                    {inventory.posts.map((p) => (
                      <li key={p.url}>
                        <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="bw-voice">
                <div className="bw-voice__head">
                  <span className="bw-desk__past-label">Brand voice</span>
                  <button className="bw-btn" disabled={busy === "voice-study" || !inventory} onClick={() => void studyVoice()}>
                    {busy === "voice-study" ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="book-open" size={14} />}
                    {voiceDoc ? "Restudy" : "Study the blog's voice"}
                  </button>
                </div>
                {!voiceDoc && (
                  <div className="bw-hint">
                    {inventory
                      ? `Reads up to 12 published posts and stores how ${brand.name} writes. Every draft and revision then matches that voice.`
                      : "Scan the site first, then study the voice."}
                  </div>
                )}
                {voiceDoc && (
                  <div className="bw-voice__body">
                    <div className="bw-voice__meta">{voiceDoc.count} posts studied · {fmtDate(voiceDoc.studied)}</div>
                    {typeof voiceDoc.profile.summary === "string" && (
                      <p className="bw-voice__summary">{voiceDoc.profile.summary}</p>
                    )}
                    {typeof voiceDoc.profile.tone === "string" && (
                      <div className="bw-voice__row">Tone: {voiceDoc.profile.tone}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mr-panel bw-desk__writing">
              <div className="mr-panel__head">
                <h2 className="mr-panel__title">Writing desk</h2>
                <span className="mr-panel__sub">Paste the topic — the agent does the rest.</span>
              </div>
              <textarea
                className="bw-topic"
                placeholder={`What should ${brand.name} publish next?`}
                value={topic}
                rows={3}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void startRun();
                }}
              />
              <button className="bw-collapse" onClick={() => setNotesOpen(!notesOpen)}>
                <Icon name={notesOpen ? "chevron-down" : "chevron-right"} size={14} />
                Optional notes for the writer
              </button>
              {notesOpen && (
                <textarea
                  className="bw-topic bw-topic--notes"
                  placeholder="Angle, audience, must-mention points… (optional)"
                  value={notes}
                  rows={2}
                  onChange={(e) => setNotes(e.target.value)}
                />
              )}
              <button className="bw-btn bw-btn--primary" disabled={!topic.trim() || !!busy} onClick={() => void startRun()}>
                <Icon name="telescope" size={15} /> Start deep research
              </button>
              <div className="bw-hint">
                Multi-round research across studies, expert guides, news, forums & competing articles — every claim lands in an evidence ledger you can trace.
              </div>

              {runs.some((r) => r.brand_id === brand.id) && (
                <div className="bw-desk__past">
                  <span className="bw-desk__past-label">Past drafts for {brand.name}</span>
                  {runs.filter((r) => r.brand_id === brand.id).slice(0, 6).map((r) => (
                    <button key={r.id} className="bw-runrow" onClick={() => void openRun(r)}>
                      <span className="bw-runrow__topic">{r.topic}</span>
                      <span className="bw-runrow__meta">{fmtDate(r.created)} · {r.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ run: research + draft */}
        {run && (
          <>
            <div className="mr-panel">
              <div className="mr-panel__head">
                <h2 className="mr-panel__title">Deep research</h2>
                <span className="mr-panel__sub">
                  {run.ledger.length} evidence item{run.ledger.length === 1 ? "" : "s"} banked · {run.rounds.length} round{run.rounds.length === 1 ? "" : "s"}
                </span>
                <div className="bw-actions">
                  {researching ? (
                    <button className="bw-btn" onClick={stopResearch}>
                      <Icon name="pause" size={14} /> Stop after this round
                    </button>
                  ) : (
                    <button className="bw-btn" disabled={!!busy} onClick={() => void goDeeper()}>
                      <Icon name="telescope" size={14} /> {run.rounds.length ? "Go deeper" : "Research"}
                    </button>
                  )}
                  <button className="bw-btn bw-btn--primary" disabled={!!busy || run.ledger.length === 0} onClick={() => void writeDraft()}>
                    <Icon name="pen-line" size={14} /> {run.draft ? "Redraft" : "Write the draft"}
                  </button>
                </div>
              </div>

              {run.rounds.length === 0 && !researching && (
                <div className="bw-empty">No research yet — hit Research to fan out across the five source angles.</div>
              )}
              <div className="bw-rounds">
                {run.rounds.map((round) => (
                  <div key={round.n} className="bw-round">
                    <div className="bw-round__head">
                      <span className="bw-round__n">Round {round.n}</span>
                      <span className="bw-round__added">+{round.added} evidence</span>
                    </div>
                    <div className="bw-round__queries">
                      {round.queries.map((q) => (
                        <span key={q.q} className="bw-chip" title={q.q}>
                          {ANGLE_LABEL[q.angle] ?? q.angle} · {q.hits}
                        </span>
                      ))}
                    </div>
                    {round.gaps.length > 0 && (
                      <div className="bw-round__gaps">Still missing: {round.gaps.join(" · ")}</div>
                    )}
                  </div>
                ))}
                {researching && (
                  <div className="bw-round bw-round--live">
                    <Icon name="loader-circle" size={14} className="bw-spin" /> Reading sources…
                  </div>
                )}
              </div>

              {run.ledger.length > 0 && (
                <details className="bw-ledger">
                  <summary>Evidence ledger ({run.ledger.length})</summary>
                  <ul>
                    {run.ledger.map((ev) => (
                      <li key={ev.id}>
                        <span className="bw-chip bw-chip--src">{ev.source_class}</span>
                        <span className="bw-ledger__claim">{ev.claim}</span>{" "}
                        <a href={ev.url} target="_blank" rel="noreferrer" className="bw-ledger__src">
                          {ev.source_name || ev.url}
                        </a>
                        <span className="bw-ledger__cred"> — {ev.credibility}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {run.draft && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">{run.draft.meta.title}</h2>
                  {run.draft.guidelines_applied && (
                    <span className="bw-chip bw-chip--ok" title="Every block was line-edited against the company writing guidelines before you saw it.">
                      House style applied
                    </span>
                  )}
                  <span className="mr-panel__sub">Comment on any block — the agent rewrites it, or researches first when you ask for facts.</span>
                </div>
                {run.draft.notes.map((n) => (
                  <div key={n} className="bw-note">{n}</div>
                ))}
                <div className="bw-blocks">
                  {run.draft.blocks.map((block) => (
                    <div key={block.id} className="bw-block">
                      {block.heading && <h3 className="bw-block__heading">{block.heading}</h3>}
                      <p className="bw-block__text">
                        <BlockText text={block.text} />
                        {block.cites.map((c) =>
                          numbers[c] ? (
                            <sup key={c} className="bw-cite" title={run.ledger.find((e) => e.id === c)?.claim}>
                              [{numbers[c]}]
                            </sup>
                          ) : null,
                        )}
                      </p>
                      {block.history.length > 0 && (
                        <button className="bw-collapse" onClick={() => setOpenHistory((h) => ({ ...h, [block.id]: !h[block.id] }))}>
                          <Icon name={openHistory[block.id] ? "chevron-down" : "chevron-right"} size={13} />
                          {block.history.length} earlier version{block.history.length === 1 ? "" : "s"}
                        </button>
                      )}
                      {openHistory[block.id] &&
                        block.history.map((old, i) => (
                          <p key={i} className="bw-block__old">{old}</p>
                        ))}
                      <div className="bw-block__commentrow">
                        <input
                          className="bw-comment"
                          placeholder="Change the direction, ask for numbers, tighten a line…"
                          value={comments[block.id] ?? ""}
                          onChange={(e) => setComments((c) => ({ ...c, [block.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && void sendComment(block)}
                        />
                        <button
                          className="bw-btn"
                          disabled={!!busy || !(comments[block.id] ?? "").trim()}
                          onClick={() => void sendComment(block)}
                        >
                          {busy === `comment-${block.id}` ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="corner-down-left" size={14} />}
                          Revise
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bw-downloads">
                  <button className="bw-btn" onClick={() => void exportRun("md")}>
                    <Icon name="download" size={14} /> Markdown
                  </button>
                  <button className="bw-btn" onClick={() => void exportRun("html")}>
                    <Icon name="download" size={14} /> HTML
                  </button>
                  <button className="bw-btn" onClick={() => void exportRun("txt")}>
                    <Icon name="download" size={14} /> Plain text
                  </button>
                  {run.visuals ? (
                    <button className="bw-btn" onClick={() => void exportRun("visuals-md")}>
                      <Icon name="download" size={14} /> Visual prompts
                    </button>
                  ) : (
                    <button className="bw-btn" disabled={!!busy} onClick={() => void planVisuals()}>
                      {busy === "visuals" ? <Icon name="loader-circle" size={14} className="bw-spin" /> : <Icon name="image" size={14} />}
                      Plan the visuals
                    </button>
                  )}
                </div>
              </div>
            )}

            {run.visuals && (
              <div className="mr-panel">
                <div className="mr-panel__head">
                  <h2 className="mr-panel__title">Visual plan</h2>
                  <span className="mr-panel__sub">The agent's call: {run.visuals.items.length} visual{run.visuals.items.length === 1 ? "" : "s"} for this post. Download the prompt doc above.</span>
                </div>
                <div className="bw-visuals">
                  {run.visuals.items.map((v) => (
                    <div key={v.n} className="bw-visual">
                      <div className="bw-visual__head">
                        <span className="bw-chip">{v.type}</span>
                        <span className="bw-visual__where">{v.section}</span>
                      </div>
                      <div className="bw-visual__theme">{v.theme}</div>
                      <div className="bw-visual__prompt">{v.prompt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
