"use client";

import type { MrConfig, MrConnector, MrDataset, MrPlatform, MrTabProfile } from "@/lib/api";
import { Badge, Button, Icon } from "@/lib/kit-ui";
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
  { id: "mr-data-settings", label: "Settings" },
];

export function DataView({ datasets, connectors, config, catalog, busy, year, onYear, onPull, onUpload, onScan }: {
  datasets: MrDataset[];
  connectors: MrConnector[];
  config: MrConfig | null;
  catalog: MrTabProfile[];
  busy: boolean;
  year: number | null;
  onYear: (y: number) => void;
  onPull: () => void;
  onUpload: (f: File, p: MrPlatform) => void;
  onScan: () => void;
}) {
  const usefulTabs = catalog.filter((t) => t.useful);
  const years = config ? [config.year - 1, config.year, config.year + 1] : [];

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
        </div>
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
              </div>
            );
          })
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
              <div className={`mr-cat__row${t.useful ? "" : " mr-cat__row--off"}`} key={t.gid}>
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

            <div className="mr-cfg__card">
              <h3 className="mr-section__title">Alert thresholds</h3>
              <div className="mr-cfg__row"><span className="mr-cfg__key">Cost-per-booking flag</span><span className="mr-cfg__val">&gt; ${config.thresholds.cost_per_booking_flag}</span></div>
              <div className="mr-cfg__row"><span className="mr-cfg__key">Cost-per-qualified-lead red</span><span className="mr-cfg__val">≥ ${config.thresholds.cost_per_qualified_lead_red}</span></div>
              <div className="mr-cfg__row"><span className="mr-cfg__key">CAC red</span><span className="mr-cfg__val">≥ ${config.thresholds.cac_red}</span></div>
              <div className="mr-cfg__row"><span className="mr-cfg__key">Spend with no demo</span><span className="mr-cfg__val">≥ ${config.thresholds.spend_no_demo_limit}</span></div>
              <div className="mr-cfg__row"><span className="mr-cfg__key">Conversion-drop flag</span><span className="mr-cfg__val">&gt; {config.thresholds.conversion_drop_pct}%</span></div>
            </div>

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
