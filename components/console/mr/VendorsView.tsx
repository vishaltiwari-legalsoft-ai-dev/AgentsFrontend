"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mrPortfolio, mrVendorDetail, mrVendorPdfUrl, type MrPortfolio, type MrSnapshotMeta, type MrVendorDetail } from "@/lib/api";
import { describeFailure, useLoadSession } from "@/lib/load";
import type { ToastFn } from "@/components/console/ConsoleApp";
import { Button, Icon } from "@/lib/kit-ui";
import { LeadQuality } from "./LeadQuality";
import { fmtMoney, fmtNum, fmtTime } from "./shared";

const pct = (n: number | null) => (n === null || n === undefined ? "—" : `${n.toFixed(1)}%`);

function copyText(p: MrPortfolio): string {
  return [
    "Portfolio Summary — Paid Vendors (Official Total)",
    `As of ${p.date} · ${p.vendors} vendors · ${p.month} MTD`,
    `Total budget: ${fmtMoney(p.total_budget)}`,
    `Total spend: ${fmtMoney(p.total_spend)} (${pct(p.budget_utilized_pct)} of budget)`,
    `Qualified leads: ${p.qualified_leads} · Cost/qual. lead: ${fmtMoney(p.cost_per_qualified_lead)}`,
    `Qual. demos booked: ${p.qual_demos_booked} · Cost/qual. demo booked: ${fmtMoney(p.cost_per_qual_demo_booked)}`,
    `Demos completed: ${p.demos_completed} · Show rate: ${pct(p.show_rate_pct)}`,
    `Total services sold (act.): ${p.services_sold}`,
    `Benchmarks: Cost/Qual. Demo Booked < $${p.benchmarks.cpqdb_max} · QL Ratio ≥ ${p.benchmarks.ql_ratio_min}% · ` +
      `Show Rate ≥ ${p.benchmarks.show_rate_min}% · CAC ~$${p.benchmarks.cac_target.toLocaleString()} · ` +
      `Day ${p.pacing.day} of ${p.pacing.days_in_month} ≈ ${p.pacing.expected_pct}% expected budget utilization`,
  ].join("\n");
}

/* Per-vendor official stats computed from the snapshot's canonical block —
   same field set as the portfolio bar, never a hardcoded subset of values. */
function vendorStats(team: Record<string, unknown>) {
  const num = (o: unknown): number | null => (typeof o === "number" ? o : null);
  const node = (o: unknown, k: string): Record<string, unknown> =>
    ((o as Record<string, unknown> | undefined)?.[k] ?? {}) as Record<string, unknown>;
  const pair = (o: Record<string, unknown>): number | null => {
    const p = num(o.performance);
    return p !== null ? p : num(o.investment);
  };
  const budget = pair(node(team, "budget")) ?? 0;
  const spend = pair(node(team, "spend")) ?? 0;
  const ql = num(node(team, "leads").qualified) ?? 0;
  const leads = num(node(team, "leads").total) ?? 0;
  const demos = node(team, "demos");
  const qdb = (num(demos.qualified_booked_all) ?? 0) || (num(demos.total_booked_all) ?? 0);
  const completed = num(demos.completed_all) ?? 0;
  const sold = num(node(team, "actualized_revenue").services_sold) ?? 0;
  const div = (n: number, d: number) => (d ? Math.round((n / d) * 100) / 100 : null);
  return {
    budget, spend, leads, ql, qdb, completed, sold,
    utilized: div(spend * 100, budget),
    cpql: div(spend, ql),
    cpqdb: div(spend, qdb),
    show: div(completed * 100, qdb),
  };
}

function VendorSummary({ team, month, benchmarks, benchmarksError }: {
  team: Record<string, unknown>;
  month: string;
  benchmarks: MrPortfolio["benchmarks"] | null;
  /** Set when the benchmarks are missing because their load failed — without
   *  it, a cost above the red line simply renders in neutral and the alarm
   *  disappears silently. */
  benchmarksError: string | null;
}) {
  const s = vendorStats(team);
  const tone = {
    cpql: benchmarks && s.cpql !== null && s.cpql >= benchmarks.cpql_red ? "bad" : undefined,
    cpqdb: benchmarks && s.cpqdb !== null ? (s.cpqdb < benchmarks.cpqdb_max ? "good" : "bad") : undefined,
    show: benchmarks && s.show !== null ? (s.show < benchmarks.show_rate_min ? "bad" : "good") : undefined,
  };
  const CELLS: { label: string; value: string; tone?: string }[] = [
    { label: "Budget", value: fmtMoney(s.budget) },
    { label: "Spend", value: fmtMoney(s.spend) },
    { label: "Budget utilized", value: pct(s.utilized) },
    { label: "Qualified leads", value: fmtNum(s.ql) },
    { label: "Qual. demos booked", value: fmtNum(s.qdb) },
    { label: "Cost / qual. lead", value: fmtMoney(s.cpql), tone: tone.cpql },
    { label: "Cost / qual. demo booked", value: fmtMoney(s.cpqdb), tone: tone.cpqdb },
    { label: "Demos completed", value: fmtNum(s.completed) },
    { label: "Show rate", value: pct(s.show), tone: tone.show },
    { label: "Services sold (act.)", value: fmtNum(s.sold) },
  ];
  return (
    <div className="mr-port mr-port--vendor">
      <h4 className="mr-section__title">Official summary · {month} MTD</h4>
      {!benchmarks && benchmarksError && (
        <span className="mr-mast__line">
          Benchmark flags are off — the portfolio totals didn&apos;t load ({benchmarksError}), so nothing
          below is marked red or green.
        </span>
      )}
      <div className="mr-port__grid">
        {CELLS.map((c) => (
          <div className="mr-port__cell" key={c.label}>
            <b className={c.tone ? `mr-port__val--${c.tone}` : undefined}>{c.value}</b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Compact replacement for the removed portfolio board: one button that copies
   the official cross-vendor totals as chat-ready text. */
function CopyPortfolio({ p, error, onToast }: {
  p: MrPortfolio | null;
  /** Why the totals are missing, when they are missing because a load failed. */
  error: string | null;
  onToast: ToastFn;
}) {
  async function copy() {
    if (error) {
      // "Run a snapshot first" would be a lie here — the totals exist, we just
      // could not read them, and the snapshot the user would run is not the fix.
      onToast(`Portfolio totals didn't load — ${error}`, "error");
      return;
    }
    if (!p) {
      onToast("Portfolio totals aren't available yet — run a snapshot first", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText(p));
      onToast("Copied portfolio summary");
    } catch {
      onToast("Copy failed — clipboard unavailable", "error");
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => void copy()}
      iconLeft={<Icon name="copy" size={13} />}>
      Copy summary
    </Button>
  );
}

/* Downloads the dossier as a server-rendered, same-format PDF. */
function DownloadDossier({ slug, date, vendor, onToast }: {
  slug: string; date: string; vendor: string; onToast: ToastFn;
}) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const url = await mrVendorPdfUrl(slug, date);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mr-vendor-${slug}-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      onToast(describeFailure(e, `PDF download failed for ${vendor}`), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void download()}
      iconLeft={<Icon name="download" size={13} />}>
      {busy ? "Preparing…" : "Download PDF"}
    </Button>
  );
}

const BRANDS = ["LS", "RA", "LI", "VS", "BK", "RCM"];
const CHANNELS = ["Google", "Meta", "Email", "Website"];

const SECTIONS: { key: string; title: string }[] = [
  { key: "leads", title: "Leads" },
  { key: "cost_metrics", title: "Cost metrics" },
  { key: "sdr", title: "SDR" },
  { key: "vapi", title: "VAPI" },
  { key: "demos", title: "Demos" },
  { key: "demo_outcomes", title: "Demo outcomes" },
  { key: "cost_per_demo", title: "Cost per demo" },
  { key: "projected_revenue", title: "Projected revenue" },
  { key: "actualized_revenue", title: "Actualized revenue" },
  { key: "not_actualized_revenue", title: "Not actualized revenue" },
  { key: "inbound_sales_pipeline", title: "Inbound sales pipeline" },
  { key: "kpis", title: "KPIs" },
];

const MONEY_RE = /(spend|budget|cost|amount|revenue|mrr|cac|deal|fees|financial|goal)/;

function chips(name: string): string[] {
  const words = name.split(/\s+/);
  return [
    ...BRANDS.filter((b) => words.includes(b)),
    ...CHANNELS.filter((c) => words.some((w) => w.toLowerCase() === c.toLowerCase())),
  ];
}

function human(key: string): string {
  return key.replace(/_pct$/, " %").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function fmtVal(key: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number") return String(v);
  if (key.endsWith("_pct")) return `${fmtNum(v)}%`;
  return MONEY_RE.test(key) ? fmtMoney(v) : fmtNum(v);
}

function Rows({ node }: { node: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(node).map(([k, v]) => {
        if (v !== null && typeof v === "object") {
          const pair = v as { performance?: number | null; investment?: number | null };
          return (
            <div className="mr-vend__row" key={k}>
              <span>{human(k)}</span>
              <b>{fmtVal(k, pair.performance)} <small>/ {fmtVal(k, pair.investment)} inv</small></b>
            </div>
          );
        }
        return (
          <div className="mr-vend__row" key={k}>
            <span>{human(k)}</span>
            <b>{fmtVal(k, v)}</b>
          </div>
        );
      })}
    </>
  );
}

function Dossier({ block }: { block: Record<string, unknown> }) {
  const top: Record<string, unknown> = {};
  for (const k of ["management_fees_investment", "budget", "spend"]) {
    if (k in block) top[k] = block[k];
  }
  return (
    <div className="mr-vend__grid">
      <div className="mr-vend__sec">
        <h4 className="mr-section__title">Budget &amp; spend</h4>
        <Rows node={top} />
      </div>
      {SECTIONS.map(({ key, title }) => {
        const node = block[key] as Record<string, unknown> | undefined;
        if (!node || typeof node !== "object") return null;
        return (
          <div className="mr-vend__sec" key={key}>
            <h4 className="mr-section__title">{title}</h4>
            <Rows node={node} />
          </div>
        );
      })}
    </div>
  );
}

const MOVE: { path: string; label: string; money: boolean }[] = [
  { path: "spend.performance", label: "Spend", money: true },
  { path: "leads.total", label: "Leads", money: false },
  { path: "leads.qualified", label: "Qualified", money: false },
  { path: "demos.total_booked_all", label: "Booked", money: false },
  { path: "demos.completed_all", label: "Completed", money: false },
];

export function VendorsView({ snapshots, onToast }: {
  snapshots: MrSnapshotMeta[];
  onToast: ToastFn;
}) {
  const vendors = useMemo(() => {
    const by: Record<string, { vendor: string; days: number }> = {};
    for (const s of snapshots) {
      // The consolidated roll-up tab is captured for totals but is not a vendor.
      if (s.vendor_slug.includes("overall")) continue;
      const e = by[s.vendor_slug] ?? { vendor: s.vendor, days: 0 };
      e.days += 1;
      by[s.vendor_slug] = e;
    }
    return Object.entries(by).map(([slug, e]) => ({ slug, ...e }));
  }, [snapshots]);

  const [slug, setSlug] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<MrVendorDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<MrPortfolio | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  /** Bumped by "Try again" to re-run the dossier load for the same vendor. */
  const [retry, setRetry] = useState(0);
  /** The load effect below cancels on re-run, so it must depend on data only —
   *  a toast prop that changed identity between renders would abort each
   *  request as it starts and the dossier would never arrive. */
  const toast = useRef(onToast);
  useEffect(() => { toast.current = onToast; }, [onToast]);

  const session = useLoadSession();

  useEffect(() => {
    const attempt = session.begin("portfolio");
    mrPortfolio({ signal: attempt.signal })
      .then((p) => {
        if (!attempt.current()) return;
        setPortfolioData(p);
        setPortfolioError(null);
      })
      .catch((e: unknown) => {
        // Was swallowed into `null`, which the UI then read as "no snapshot
        // yet". Keep the reason so the benchmarks row and the copy button can
        // say what actually happened.
        const message = attempt.failure(e, "Portfolio totals failed to load");
        if (!message) return;
        setPortfolioData(null);
        setPortfolioError(message);
      });
  }, [session]);

  const active = slug ?? vendors[0]?.slug ?? null;

  useEffect(() => {
    if (!active) return;
    // Money is displayed under a vendor's name here. Without this guard a
    // slower request for vendor A lands after the user has moved to vendor B
    // and renders A's spend and lead figures under B's heading — silent
    // misattribution, no error, nothing to report. Aborting on switch stops
    // the stale response arriving at all.
    // `begin` supersedes the vendor before it: the abort stops us paying for a
    // reply we no longer want, and the ticket stops one that already arrived
    // from landing under the new vendor's name.
    const attempt = session.begin("vendor-detail");
    setDetail(null);
    setDetailError(null);
    mrVendorDetail(active, date ?? undefined, { signal: attempt.signal })
      .then((d) => { if (attempt.current()) setDetail(d); })
      .catch((e: unknown) => {
        const msg = attempt.failure(e, "Failed to load vendor");
        if (!msg) return; // superseded by a newer vendor, or the panel is gone
        setDetailError(msg);
        toast.current(msg, "error");
      });
  }, [active, date, retry, session]);

  if (vendors.length === 0) {
    return (
      <div className="mr-panel">
        <div className="mr-empty">
          No vendor snapshots yet. Go to Overview and hit &ldquo;Snapshot now&rdquo; — every vendor tab gets captured and shows up here.
        </div>
      </div>
    );
  }

  const d = detail?.delta;
  const t = d?.blocks.team_overall.additive;

  return (
    <>
      <div className="mr-vend">
      <aside className="mr-vend__rail">
        <h3 className="mr-section__title">Vendors ({vendors.length})</h3>
        {vendors.map((v) => (
          <button key={v.slug} className="mr-vend__vrow" aria-current={v.slug === active}
            onClick={() => { setSlug(v.slug); setDate(null); }}>
            <span className="mr-vend__vname">{v.vendor}</span>
            <span className="mr-vend__vchips">
              {chips(v.vendor).map((c) => <span className="mr-tag" key={c}>{c}</span>)}
            </span>
            <span className="mr-vend__vdays">{v.days}d</span>
          </button>
        ))}
      </aside>

      <div className="mr-vend__main">
        {detailError ? (
          <div className="mr-empty">
            <strong>Couldn&apos;t load this vendor&apos;s dossier.</strong>
            <div>{detailError}</div>
            <div style={{ marginTop: 10 }}>
              <Button size="sm" variant="secondary" onClick={() => setRetry((n) => n + 1)}
                iconLeft={<Icon name="refresh-cw" size={13} />}>
                Try again
              </Button>
            </div>
          </div>
        ) : !detail ? (
          <div className="mr-empty">Loading dossier…</div>
        ) : (
          <>
            <header className="mr-vend__head">
              <div>
                <span className="mr-mast__eyebrow">Vendor dossier · gid {detail.gid}</span>
                <h2 className="mr-vend__title">{detail.vendor}</h2>
                <span className="mr-mast__line">
                  {detail.dates.length} day{detail.dates.length === 1 ? "" : "s"} captured · showing {detail.snapshot.date} (MTD) · captured {fmtTime(detail.snapshot.captured_at)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <DownloadDossier slug={detail.vendor_slug} date={detail.snapshot.date}
                  vendor={detail.vendor} onToast={onToast} />
                <CopyPortfolio p={portfolioData} error={portfolioError} onToast={onToast} />
              </div>
            </header>

            <div className="mr-vend__dates">
              {detail.dates.map((dd) => (
                <button key={dd} className="mr-chip" aria-current={dd === detail.snapshot.date}
                  onClick={() => setDate(dd)}>{dd.slice(5)}</button>
              ))}
            </div>

            <VendorSummary
              team={detail.snapshot.canonical.team_overall}
              month={detail.snapshot.month}
              benchmarks={portfolioData?.benchmarks ?? null}
              benchmarksError={portfolioError}
            />

            <LeadQuality slug={detail.vendor_slug} />

            {d && t && (
              <div className="mr-vend__move">
                <span className="mr-section__title">
                  Day movement
                  {d.month_start && " · month start"}
                  {!d.month_start && d.days > 1 && ` · since ${d.since} (${d.days}d)`}
                  {d.corrected && " · corrected"}
                </span>
                <div className="mr-vend__movevals">
                  {MOVE.map((m) => {
                    const f = t[m.path];
                    const n = f?.delta ?? null;
                    const txt = n === null ? "—" : n === 0 ? (m.money ? "$0" : "0")
                      : `${n < 0 ? "▼" : "▲"} ${m.money ? fmtMoney(Math.abs(n)) : fmtNum(Math.abs(n))}`;
                    return (
                      <span className="mr-vend__movecell" key={m.path}>
                        <small>{m.label}</small>
                        <b className={f?.corrected ? "mr-vend__corr" : undefined}>{txt}</b>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <Dossier block={detail.snapshot.canonical.team_overall} />

            {Object.entries(detail.snapshot.canonical.channels).map(([name, block]) => (
              <section key={name} className="mr-vend__chan">
                <h3 className="mr-vend__chantitle">
                  <Icon name="corner-down-right" size={14} /> {name.toUpperCase()} channel
                </h3>
                <Dossier block={block} />
              </section>
            ))}
          </>
        )}
      </div>
      </div>
    </>
  );
}
