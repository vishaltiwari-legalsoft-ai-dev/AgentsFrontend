"use client";

/* --------------------------------------------------------------------------
   Reference Probe (TEST WINDOW)
   A small, self-contained, responsive panel that lets a human SEE which
   reference creatives the agent picks up for a brand + creative type + brief.
   Calls the Brand Reference Library API (/api/ref-library) and renders the
   ranked hits with thumbnail, score, palette and the "why" behind each match.

   Visibility surface only — it does not yet affect generation. Styles live in
   app/gd.css under ".gdref*".
   -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  gdRefTypes,
  gdRefIngest,
  gdRefRetrieve,
  gdRefAssetBlob,
  type RefCreativeType,
  type RefRecord,
} from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { useAuth } from "@/lib/auth";

/** A reference thumbnail that fetches its own (auth-gated) image blob. */
function RefThumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    gdRefAssetBlob(id)
      .then((u) => {
        objectUrl = u;
        if (active) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return (
    <div className={`gdref__thumb${failed ? " gdref__thumb--failed" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" />}
      {failed && <span className="gdref__thumb-x" title="Image unavailable (restart backend?)">—</span>}
    </div>
  );
}

export function ReferenceProbe({
  brandName,
  onToast,
}: {
  brandName?: string;
  onToast: (m: string) => void;
}) {
  const { user } = useAuth();
  const [types, setTypes] = useState<RefCreativeType[]>([]);
  const [type, setType] = useState<string>("social_story");
  const [brief, setBrief] = useState<string>("");
  const [results, setResults] = useState<RefRecord[] | null>(null);
  const [promptBlock, setPromptBlock] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    gdRefTypes()
      .then((r) => setTypes(r.types))
      .catch(() => setTypes([]));
  }, []);

  const check = async () => {
    setBusy(true);
    try {
      const r = await gdRefRetrieve(brief, brandName ?? null, type || null, 5);
      setResults(r.results);
      setPromptBlock(r.prompt_block);
      if (r.count === 0) onToast("No references matched — try a different brief or type.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Retrieval failed");
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const ingest = async () => {
    setBusy(true);
    try {
      const r = await gdRefIngest(false);
      onToast(`Indexed ${r.ingested} reference creatives.`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gdref">
      <button
        type="button"
        className="gdref__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon className="gdref__chev" name={open ? "chevron-down" : "chevron-right"} size={14} />
        Reference probe (test) — see what the agent picks up
      </button>

      {open && (
        <div className="gdref__body">
          <p className="gdref__hint">
            Brand: <b>{brandName || "—"}</b>. Pick a creative type, type a brief, and check which
            on-brand references rank highest.
          </p>

          <div className="gdref__controls">
            <select className="gdselect" value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.aspect_ratio})
                </option>
              ))}
            </select>
            <div className="gdref__inputrow">
              <input
                className="gdselect gdref__brief"
                placeholder="Brief e.g. hiring recruiting team"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && check()}
              />
              <Button className="gdref__check" onClick={check} disabled={busy} size="sm" variant="brand">
                {busy ? "…" : "Check"}
              </Button>
            </div>
          </div>

          {user?.is_admin && (
            <button className="gdminibtn" onClick={ingest} disabled={busy} style={{ alignSelf: "flex-start" }}>
              <Icon name="refresh-cw" size={12} /> Rebuild index
            </button>
          )}

          {results && results.length > 0 && (
            <>
              <div className="gdref__list">
                {results.map((r, i) => (
                  <div key={r.id} className="gdref__card">
                    <RefThumb id={r.id} />
                    <div className="gdref__main">
                      <div className="gdref__top">
                        <span className="gdref__rank">#{i + 1}</span>
                        <span className="gdref__name" title={r.file_name}>
                          {r.file_name}
                        </span>
                        <span className="gdref__score">score {r._score}</span>
                      </div>

                      <div className="gdref__meta">
                        <span className="gdref__chip">{r.creative_type}</span>
                        <span>
                          {r.width}×{r.height} · {r.orientation}
                        </span>
                        <span
                          className={`gdref__chip ${r.format_match ? "gdref__chip--ok" : "gdref__chip--warn"}`}
                        >
                          {r.format_match ? "✓ on-format" : "⚠ off-format"}
                        </span>
                        <span className="gdref__sw">
                          {r.palette.slice(0, 5).map((c) => (
                            <span key={c} title={c} style={{ background: c }} />
                          ))}
                        </span>
                      </div>

                      {r._why && r._why.length > 0 && (
                        <div className="gdref__why">
                          <b>why:</b> {r._why.join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {promptBlock && (
                <details className="gdref__prompt">
                  <summary>Prompt grounding block (what the generator would receive)</summary>
                  <pre className="gdaudit__pre">{promptBlock}</pre>
                </details>
              )}
            </>
          )}

          {results && results.length === 0 && (
            <p className="gdref__empty">
              No references found. If this is the first run, click <b>Rebuild index</b> (admin), then
              check again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
