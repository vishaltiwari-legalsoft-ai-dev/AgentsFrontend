"use client";

import { useEffect, useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import {
  mrGetTargets, mrSaveTargets,
  type MrConfig, type MrConnector, type MrDataset, type MrPlatform,
  type MrSheetSource, type MrSheetSources, type MrSnapshotMeta,
  type MrTabProfile, type MrTargets,
} from "@/lib/api";
import { Badge, Button, Icon } from "@/lib/kit-ui";
import { describeFailure, useLoadSession } from "@/lib/load";
import { fmtTime, sourceLabel } from "./shared";

const CSV_PLATFORMS: { key: MrPlatform; label: string }[] = [
  { key: "google_ads", label: "Google Ads" },
  { key: "meta", label: "META Ads" },
  { key: "hubspot", label: "HubSpot" },
];

const SECTIONS = [
  { id: "mr-data-sources", label: "Sources" },
  { id: "mr-data-connectors", label: "Connectors" },
  { id: "mr-data-catalog", label: "What the agent understands" },
  { id: "mr-data-settings", label: "Settings & targets" },
];

/* Every editable figure: alert thresholds + the CPQL/CAC targets. Money unless
   marked pct (shown as %, stored as a fraction) or unit ("pct100" = stored as a
   whole percent, "count" = plain number). */
const THRESHOLD_FIELDS: { key: string; label: string; pct?: boolean; unit?: "pct100" | "count" }[] = [
  { key: "cost_per_qualified_lead_target_low", label: "CPQL target — low" },
  { key: "cost_per_qualified_lead_target_high", label: "CPQL target — high" },
  { key: "cost_per_qualified_lead_red", label: "CPQL red flag" },
  { key: "cac_target", label: "CAC target" },
  { key: "cac_red", label: "CAC red flag" },
  { key: "cost_per_booking_flag", label: "Cost-per-booking flag" },
  { key: "spend_no_demo_limit", label: "Spend with no demo" },
  { key: "mgmt_fee_limit", label: "Management fee limit" },
  { key: "conversion_drop_pct", label: "Conversion-drop flag", pct: true },
  { key: "bad_lead_rate_red", label: "Bad-lead rate flag", unit: "pct100" },
  { key: "no_show_rate_red", label: "No-show rate flag", unit: "pct100" },
  { key: "canceled_rate_red", label: "Cancellation rate flag", unit: "pct100" },
  { key: "zero_completed_min_demos", label: "0-completed flag — min resolved demos", unit: "count" },
  { key: "ql_ratio_great", label: "Great-leads QL ratio line", unit: "pct100" },
  { key: "booking_rate_broken", label: "Broken-booking rate line", unit: "pct100" },
];

const GOAL_FIELDS: { key: string; label: string; pct?: boolean }[] = [
  { key: "cpd_booked_low", label: "CPD booked low" },
  { key: "cpd_booked_high", label: "CPD booked high" },
  { key: "cpd_completed_low", label: "CPD completed low" },
  { key: "cpd_completed_high", label: "CPD completed high" },
  { key: "completed_demo_pct", label: "Completed demo %", pct: true },
];

function TargetsCard({ onToast }: { onToast: ToastFn }) {
  const session = useLoadSession();
  const [targets, setTargets] = useState<MrTargets | null>(null);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [thr, setThr] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<Record<string, Record<string, string>>>({});

  const seed = (t: MrTargets) => {
    setThr(Object.fromEntries(THRESHOLD_FIELDS.map((f) => {
      const v = t.thresholds[f.key] ?? 0;
      return [f.key, String(f.pct ? Math.round(v * 1000) / 10 : v)];
    })));
    setGoals(Object.fromEntries(Object.entries(t.channel_goals).map(([ch, g]) => [
      ch,
      Object.fromEntries(GOAL_FIELDS.map((f) => {
        const v = g[f.key as keyof typeof g] ?? 0;
        return [f.key, String(f.pct ? Math.round(v * 1000) / 10 : v)];
      })),
    ])));
  };

  /** The failure branch set `targets` to the same `null` it already held, so
   *  a failed read left the card reading "Loading targets…" for ever. */
  useEffect(() => {
    const attempt = session.begin("targets");
    mrGetTargets().then(
      (t) => {
        if (!attempt.current()) return;
        setTargets(t);
        setTargetsError(null);
        seed(t);
      },
      (e: unknown) => {
        const message = attempt.failure(e, "Couldn't load the targets");
        if (!message) return;
        setTargetsError(message);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function save(reset = false) {
    setSaving(true);
    try {
      let next: MrTargets;
      if (reset) {
        next = await mrSaveTargets({ reset: true });
      } else {
        const thresholds: Record<string, number> = {};
        for (const f of THRESHOLD_FIELDS) {
          const n = Number(thr[f.key]);
          if (!Number.isFinite(n) || n < 0) throw new Error(`"${f.label}" must be a non-negative number`);
          thresholds[f.key] = f.pct ? n / 100 : n;
        }
        const channel_goals: Record<string, Record<string, number>> = {};
        for (const [ch, g] of Object.entries(goals)) {
          channel_goals[ch] = {};
          for (const f of GOAL_FIELDS) {
            const n = Number(g[f.key]);
            if (!Number.isFinite(n) || n < 0) throw new Error(`${ch} "${f.label}" must be a non-negative number`);
            channel_goals[ch][f.key] = f.pct ? n / 100 : n;
          }
        }
        next = await mrSaveTargets({ thresholds, channel_goals });
      }
      setTargets(next);
      seed(next);
      setEdit(false);
      onToast(reset ? "Targets reset to the 2026 defaults" : "Targets saved — flags and reports use them immediately");
    } catch (e) {
      onToast(describeFailure(e, "Saving targets failed"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (!targets) {
    return (
      <div className="mr-cfg__card">
        <h3 className="mr-section__title">Targets &amp; thresholds</h3>
        <div className="mr-empty">
          {targetsError ? `Couldn't load the targets — ${targetsError}` : "Loading targets…"}
        </div>
      </div>
    );
  }

  const fmtVal = (f: { pct?: boolean; unit?: string }, v: number) =>
    f.pct ? `${Math.round(v * 1000) / 10}%`
    : f.unit === "pct100" ? `${v}%`
    : f.unit === "count" ? String(v)
    : `$${v.toLocaleString()}`;

  return (
    <div className="mr-cfg__card mr-tgt">
      <div className="mr-tgt__head">
        <h3 className="mr-section__title">
          Targets &amp; thresholds{targets.edited && <span className="mr-tag" style={{ marginLeft: 6 }}>edited</span>}
        </h3>
        {!edit ? (
          <Button size="sm" variant="secondary" onClick={() => setEdit(true)} iconLeft={<Icon name="pen-line" size={13} />}>
            Edit targets
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Button size="sm" variant="brand" disabled={saving} onClick={() => void save()}>Save</Button>
            <Button size="sm" variant="secondary" disabled={saving} onClick={() => { seed(targets); setEdit(false); }}>Cancel</Button>
            <Button size="sm" variant="secondary" disabled={saving} onClick={() => void save(true)}>Reset defaults</Button>
          </div>
        )}
      </div>

      {THRESHOLD_FIELDS.map((f) => (
        <div className="mr-cfg__row" key={f.key}>
          <span className="mr-cfg__key">{f.label}</span>
          {edit ? (
            <span className="mr-tgt__input">
              {!f.pct && !f.unit && <small>$</small>}
              <input
                type="number" min={0} step="any" value={thr[f.key] ?? ""}
                onChange={(e) => setThr((s) => ({ ...s, [f.key]: e.target.value }))}
              />
              {(f.pct || f.unit === "pct100") && <small>%</small>}
            </span>
          ) : (
            <span className="mr-cfg__val">{fmtVal(f, targets.thresholds[f.key] ?? 0)}</span>
          )}
        </div>
      ))}

      <h4 className="mr-section__title" style={{ marginTop: 10 }}>Per-channel goals</h4>
      {Object.entries(targets.channel_goals).map(([ch, g]) => (
        <div className="mr-tgt__chan" key={ch}>
          <span className="mr-tgt__chname">{ch}</span>
          <div className="mr-tgt__grid">
            {GOAL_FIELDS.map((f) => (
              <label className="mr-tgt__cell" key={f.key}>
                <span>{f.label}</span>
                {edit ? (
                  <span className="mr-tgt__input">
                    {!f.pct && <small>$</small>}
                    <input
                      type="number" min={0} step="any" value={goals[ch]?.[f.key] ?? ""}
                      onChange={(e) => setGoals((s) => ({ ...s, [ch]: { ...s[ch], [f.key]: e.target.value } }))}
                    />
                    {f.pct && <small>%</small>}
                  </span>
                ) : (
                  <b>{fmtVal(f, g[f.key as keyof typeof g] ?? 0)}</b>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataView({ datasets, snapshots, connectors, config, catalog, sheetSources, busy, year, onYear, onPull, onUpload, onUploadPdf, onRemove, onScan, onAddSheet, onRemoveSheet, onToast }: {
  datasets: MrDataset[];
  snapshots: MrSnapshotMeta[];
  connectors: MrConnector[];
  config: MrConfig | null;
  catalog: MrTabProfile[];
  sheetSources: MrSheetSources | null;
  busy: boolean;
  year: number | null;
  onYear: (y: number) => void;
  onPull: () => void;
  onUpload: (f: File, p: MrPlatform) => void;
  onUploadPdf: (f: File) => void;
  onRemove: (d: MrDataset) => void;
  onScan: () => void;
  onAddSheet: (url: string) => void;
  onRemoveSheet: (s: MrSheetSource) => void;
  onToast: ToastFn;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const usefulTabs = catalog.filter((t) => t.useful);
  const years = config ? [config.year - 1, config.year, config.year + 1] : [];

  const submitSheet = () => {
    const url = sheetUrl.trim();
    if (!url) return;
    onAddSheet(url);
    setSheetUrl("");
  };

  return (
    <div className="mr-panel">
      <nav className="mr-datanav">
        {SECTIONS.map((s) => (
          <button key={s.id} className="mr-chip" onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {s.label}
          </button>
        ))}
      </nav>

      <section id="mr-data-sources" className="mr-datasec">
        <h3 className="mr-section__title">Sources — what&apos;s been pulled</h3>
        <div className="mr-actions">
          <Button variant="brand" disabled={busy} onClick={onPull} iconLeft={<Icon name="refresh-cw" size={15} />}>
            Pull live Google Sheet
          </Button>
          {CSV_PLATFORMS.map((p) => (
            <label key={p.key} className="ens-btn ens-btn--secondary ens-btn--sm" style={{ cursor: "pointer" }}>
              <Icon name="upload" size={14} /> {p.label} CSV
              <input
                type="file" accept=".csv,text/csv" style={{ display: "none" }} disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f, p.key);
                  e.target.value = "";
                }}
              />
            </label>
          ))}
          <label className="ens-btn ens-btn--secondary ens-btn--sm" style={{ cursor: "pointer" }}>
            <Icon name="file-text" size={14} /> PDF report
            <input
              type="file" accept=".pdf,application/pdf" style={{ display: "none" }} disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadPdf(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {sheetSources?.enabled && (
          <>
            <h3 className="mr-section__title" style={{ marginTop: 12 }}>Connected sheets — what the agent reads</h3>
            {sheetSources.sources.map((s) => (
              <div className="mr-src" key={s.id}>
                <span className="mr-src__icon"><Icon name="database" size={18} /></span>
                <div className="mr-src__id">
                  <span className="mr-src__name">{s.label}</span>
                  <span className="mr-src__meta">
                    {s.primary
                      ? "Primary tracker — feeds the dashboard, reports and vendor snapshots"
                      : "Read for Ask & insights — never counted into dashboard numbers"}
                  </span>
                </div>
                {s.primary ? (
                  <Badge variant="success" dot>Primary</Badge>
                ) : (
                  <button
                    className="mr-src__del" disabled={busy} title="Disconnect this sheet"
                    aria-label={`Disconnect ${s.label}`}
                    onClick={() => onRemoveSheet(s)}
                  >
                    <Icon name="trash-2" size={15} />
                  </button>
                )}
              </div>
            ))}
            <div className="mr-actions" style={{ marginTop: 8 }}>
              <input
                type="url" placeholder="Paste a Google Sheets link to connect it…"
                value={sheetUrl} disabled={busy}
                onChange={(e) => setSheetUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitSheet(); }}
                style={{
                  flex: 1, minWidth: 260, padding: "8px 10px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--surface-card)", color: "inherit",
                }}
              />
              <Button variant="secondary" disabled={busy || !sheetUrl.trim()} onClick={submitSheet}>
                Connect sheet
              </Button>
            </div>
            <p className="mr-src__meta" style={{ margin: "6px 0 0" }}>
              Share the sheet with <b>{sheetSources.service_account}</b> as Viewer first — the agent reads it,
              understands every tab, and you can ask questions about it right away.
            </p>
          </>
        )}
        {datasets.length === 0 ? (
          <div className="mr-empty">No data pulled yet. Pull the live Google Sheet or upload a platform CSV.</div>
        ) : (
          datasets.map((d) => {
            const { src, tab } = sourceLabel(d.platform);
            return (
              <div className="mr-src" key={d.id}>
                <span className="mr-src__icon"><Icon name="database" size={18} /></span>
                <div className="mr-src__id">
                  <span className="mr-src__name">{src}{tab ? ` · ${tab}` : ""}</span>
                  <span className="mr-src__meta">
                    Pulled {fmtTime(d.generated_at)}
                    {d.gaps.length > 0 && <span style={{ color: "var(--amber-600)" }}> · {d.gaps.length} data gap(s)</span>}
                  </span>
                </div>
                <div className="mr-src__stat">
                  <span className="mr-src__count">{d.metrics}<span> metrics</span></span>
                  {d.leads > 0 && <span className="mr-src__count">{d.leads}<span> leads</span></span>}
                </div>
                <button
                  className="mr-src__del" disabled={busy} title="Remove this file"
                  aria-label={`Remove ${src}${tab ? ` ${tab}` : ""}`}
                  onClick={() => onRemove(d)}
                >
                  <Icon name="trash-2" size={15} />
                </button>
              </div>
            );
          })
        )}
        {snapshots.length > 0 && (
          <>
            <h3 className="mr-section__title" style={{ marginTop: 10 }}>Snapshot history</h3>
            {Object.entries(
              snapshots.reduce<Record<string, { vendor: string; days: number; last: string }>>((acc, s) => {
                const e = acc[s.vendor_slug] ?? { vendor: s.vendor, days: 0, last: "" };
                e.days += 1;
                if (s.captured_at > e.last) e.last = s.captured_at;
                acc[s.vendor_slug] = e;
                return acc;
              }, {})
            ).map(([slug, e]) => (
              <div className="mr-src" key={slug}>
                <span className="mr-src__icon"><Icon name="camera" size={18} /></span>
                <div className="mr-src__id">
                  <span className="mr-src__name">{e.vendor}</span>
                  <span className="mr-src__meta">Last snapshot {fmtTime(e.last)}</span>
                </div>
                <div className="mr-src__stat"><span className="mr-src__count">{e.days}<span> days</span></span></div>
              </div>
            ))}
          </>
        )}
      </section>

      <section id="mr-data-connectors" className="mr-datasec">
        <h3 className="mr-section__title">Connectors — platforms the agent can pull from</h3>
        <div className="cgrid cgrid--3">
          {connectors.map((c) => (
            <div className="cintg" key={c.key}>
              <div className="cintg__top">
                <span className="logotile">
                  {c.logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`/logo/${c.logo}.svg`} alt={`${c.label} logo`} width={26} height={26} style={{ objectFit: "contain" }} />
                  ) : (
                    <Icon name={c.category === "Manual" ? "upload" : "plug"} size={18} />
                  )}
                </span>
                {c.status === "connected" ? (
                  <Badge variant="success" dot>Connected</Badge>
                ) : c.status === "available" ? (
                  <Badge variant="outline">Manual</Badge>
                ) : (
                  <Badge variant="outline">Needs setup</Badge>
                )}
              </div>
              <div className="cintg__id">
                <div className="cintg__name">{c.label}</div>
                <div className="cintg__cat">{c.category}</div>
              </div>
              <p className="cintg__desc">{c.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="mr-data-catalog" className="mr-datasec">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 className="mr-section__title">What the agent understands ({usefulTabs.length} data tabs)</h3>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onScan} iconLeft={<Icon name="sparkles" size={13} />}>
            Deep-scan tabs
          </Button>
        </div>
        {catalog.length === 0 ? (
          <div className="mr-empty">Reading the workbook…</div>
        ) : (
          <div className="mr-cat">
            {catalog.map((t) => (
              <div className={`mr-cat__row${t.useful ? "" : " mr-cat__row--off"}`} key={t.title}>
                <span className="mr-cat__name">{t.title}</span>
                <span className="mr-cat__tags">
                  <span className="mr-tag">{t.kind.replace(/_/g, " ")}</span>
                  {t.granularity !== "none" && <span className="mr-tag mr-tag--gran">{t.granularity}</span>}
                  {t.date_range && <span className="mr-tag">{t.date_range}</span>}
                </span>
                <span className="mr-cat__sum">{t.summary}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="mr-data-settings" className="mr-datasec">
        <h3 className="mr-section__title">Settings</h3>
        {!config ? (
          <div className="mr-empty">Loading configuration…</div>
        ) : (
          <div className="mr-cfg">
            <div className="mr-cfg__card">
              <h3 className="mr-section__title">Data source</h3>
              <div className="mr-cfg__row">
                <span className="mr-cfg__key">Spreadsheet</span>
                <a className="mr-cfg__val" href={config.spreadsheet_url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
                  Open in Google Sheets ↗
                </a>
              </div>
              <div className="mr-cfg__row">
                <span className="mr-cfg__key">Plan year</span>
                <select
                  className="mr-cfg__val"
                  value={year ?? config.year}
                  onChange={(e) => onYear(Number(e.target.value))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-card)" }}
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="mr-cfg__card">
              <h3 className="mr-section__title">Report schedule</h3>
              {config.schedule.map((s) => (
                <div className="mr-cfg__row" key={s.report}>
                  <span className="mr-cfg__key">{s.report}</span>
                  <span className="mr-cfg__val">{s.cadence}</span>
                </div>
              ))}
            </div>

            <TargetsCard onToast={onToast} />

            <div className="mr-cfg__card">
              <h3 className="mr-section__title">Tracked competitors ({config.competitors.length})</h3>
              {config.competitors.map((c) => (
                <div className="mr-cfg__row" key={c.name}>
                  <span className="mr-cfg__key">{c.name}</span>
                  <a className="mr-cfg__val" href={c.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>site ↗</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
