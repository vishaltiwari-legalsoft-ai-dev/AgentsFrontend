"use client";

import { useEffect, useMemo, useState } from "react";
import { mrPortfolio, mrVendorDetail, type MrPortfolio, type MrSnapshotMeta, type MrVendorDetail } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
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

function VendorSummary({ team, month, benchmarks }: {
  team: Record<string, unknown>;
  month: string;
  benchmarks: MrPortfolio["benchmarks"] | null;
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
function CopyPortfolio({ p, onToast }: { p: MrPortfolio | null; onToast: (m: string) => void }) {
  async function copy() {
    if (!p) {
      onToast("Portfolio totals aren't available yet — run a snapshot first");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText(p));
      onToast("Copied portfolio summary");
    } catch {
      onToast("Copy failed — clipboard unavailable");
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => void copy()}
      iconLeft={<Icon name="copy" size={13} />}>
      Copy summary
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
  onToast: (m: string) => void;
}) {
  const vendors = useMemo(() => {
    const by: Record<string, { vendor: string; days: number }> = {};
    for (const s of snapshots) {
      const e = by[s.vendor_slug] ?? { vendor: s.vendor, days: 0 };
      e.days += 1;
      by[s.vendor_slug] = e;
    }
    return Object.entries(by).map(([slug, e]) => ({ slug, ...e }));
  }, [snapshots]);

  const [slug, setSlug] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<MrVendorDetail | null>(null);
  const [portfolioData, setPortfolioData] = useState<MrPortfolio | null>(null);

  useEffect(() => {
    mrPortfolio().then(setPortfolioData).catch(() => setPortfolioData(null));
  }, []);

  const active = slug ?? vendors[0]?.slug ?? null;

  useEffect(() => {
    if (!active) return;
    setDetail(null);
    mrVendorDetail(active, date ?? undefined)
      .then(setDetail)
      .catch((e) => onToast(e instanceof Error ? e.message : "Failed to load vendor"));
  }, [active, date, onToast]);

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
        {!detail ? (
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
              <CopyPortfolio p={portfolioData} onToast={onToast} />
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
            />

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
