"use client";

/** GEO — the fifth workspace, and the one whose artifact is not a file.
 *
 *  What GEO hands back is prose five answer engines wrote about you, so this
 *  reads as a document rather than a dashboard: the engines' own sentences are
 *  the front page and the highlighter mark is the interface.
 *
 *  Three things hold across all nine sections, and each is a decision the
 *  prototype made that the live data makes load-bearing rather than decorative:
 *
 *  1. **An engine on a stand-in is never drawn like an engine on its own API.**
 *     Two of the five come through OpenRouter. Their rates are real
 *     measurements *of that model*, not of the product whose name is on the
 *     chip, and every surface here says which it was.
 *  2. **Not measured is not zero.** A question no engine was asked, a rival
 *     with no domain on record, a window with no sweep in it — all render as a
 *     dash carrying its reason. A zero would read as "never named", which is a
 *     finding nobody made.
 *  3. **The sections live in the rail.** No second tab bar: the workspace
 *     declares its sections through `useWorkNav` and the console's own rail
 *     draws them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  geoBrands, geoComparison, geoConfig, geoPollStatus, geoReport,
  type GeoBrandRow, type GeoComparison, type GeoEngineSpec, type GeoGlobalConfig,
  type GeoPollStatus, type GeoReport,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { statusOf } from "@/components/console/geo/provenance";
import { useHeadline, useHub, useWorkNav, type WorkSection } from "../context";
import { initials } from "../model";
import { Oops, Wait } from "../ui";
import { workspaceBySlug } from "../workspaces";
import { GeoBrands } from "./geo/Brands";
import { GeoOverview } from "./geo/Overview";
import { GeoTrend } from "./geo/Trend";
import { GeoQuestions } from "./geo/Questions";
import { GeoAnswers } from "./geo/Answers";
import { GeoSources } from "./geo/Sources";
import { GeoCompetitors } from "./geo/Competitors";
import { GeoPlan } from "./geo/Plan";
import { GeoOptimizer } from "./geo/Optimizer";
import { GeoFaq } from "./geo/Faq";
import { namesFrom, type NameSet } from "./geo/highlight";
import { ENGINE_IDS, isLive } from "./geo/parts";

/** The window every figure on these panels is read over. One number, shared, so
 *  a headline can never disagree with the table under it. */
export const GEO_DAYS = 30;

const SECTIONS = workspaceBySlug("geo")!.sections;

export interface GeoData {
  brandId: string;
  brandName: string;
  report: GeoReport;
  status: Record<string, ReturnType<typeof statusOf>>;
  comparison: GeoComparison | null;
  /** How each engine is asked — kind, readings per question, which question
   *  types it is spent on. Empty until `/geo/config` carries it, so every
   *  reader must render without it. */
  specs: Record<string, GeoEngineSpec>;
  /** The spellings the highlighter marks, derived ONCE from the comparison's
   *  own `match_names` (self and rivals) so every tab highlights exactly what
   *  the backend scored. Falls back to the bare brand name while the
   *  comparison is still loading. */
  names: NameSet;
  days: number;
  reload: () => void;
}

export function GeoWorkspace({ subject, section }: { subject: string; section: string }) {
  const { openWork, toast, revision } = useHub();
  const session = useLoadSession();

  const [brands, setBrands] = useState<Load<GeoBrandRow[]>>(loadPending);
  const [cfg, setCfg] = useState<Load<GeoGlobalConfig>>(loadPending);
  const [report, setReport] = useState<Load<GeoReport>>(loadPending);
  const [cmp, setCmp] = useState<Load<GeoComparison>>(loadPending);
  const [poll, setPoll] = useState<Load<GeoPollStatus>>(loadPending);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    void session.run("geo-brands", (s) => geoBrands({ signal: s }).then((r) => r.brands), setBrands,
      "The GEO brands could not be read.", { keepStale: true });
    void session.run("geo-config", (s) => geoConfig({ signal: s }), setCfg,
      "The engine settings could not be read.", { keepStale: true });
  }, [session, revision, beat]);

  const list = brands.data || [];
  // The route may name a brand that no longer exists, or none at all. Falling
  // back to the first is right; silently rendering an empty panel is not.
  const brand = list.find((b) => b.id === subject) || list[0] || null;
  const brandId = brand?.id || "";

  useEffect(() => {
    if (!brandId) return;
    void session.run("geo-report", (s) => geoReport(brandId, GEO_DAYS, { signal: s }), setReport,
      "The check could not be read.", { keepStale: true });
    void session.run("geo-cmp", (s) => geoComparison(brandId, GEO_DAYS, { signal: s }), setCmp,
      "The competitor scoring could not be read.", { keepStale: true });
    void session.run("geo-poll", (s) => geoPollStatus(brandId, { signal: s }), setPoll,
      "The schedule could not be read.", { keepStale: true });
  }, [session, brandId, revision, beat]);

  const reload = useCallback(() => setBeat((b) => b + 1), []);

  const specs = useMemo(() => cfg.data?.engine_specs || {}, [cfg.data]);

  const status = useMemo(() => {
    const declared = cfg.data?.engine_status || {};
    const enabled = cfg.data?.engines || ({} as Record<string, boolean>);
    return Object.fromEntries(
      ENGINE_IDS.map((id) => [id, statusOf(declared, id, Boolean((enabled as Record<string, boolean>)[id]))]),
    );
  }, [cfg.data]);

  // The one NameSet every tab highlights with — the exact derivation the tabs
  // used to repeat, computed once from what the backend actually matched on.
  const brandName = brand?.name || "";
  const names = useMemo(() => namesFrom(
    { name: brandName, match_names: cmp.data?.rows.find((r) => r.is_self)?.match_names },
    (cmp.data?.rows || []).filter((r) => !r.is_self),
  ), [brandName, cmp.data]);

  const current = SECTIONS.some((s) => s.id === section) ? section : SECTIONS[0].id;

  // Counts on the rail come from the report, so they are absent until it lands
  // rather than showing a zero that means "not read yet".
  const rollup = report.data?.prompt_rollup;
  const counts: Record<string, number | null> = {
    questions: rollup ? rollup.length : null,
    answers: report.data ? report.data.blended.n_answers : null,
    sources: report.data ? report.data.source_gap.length : null,
    competitors: cmp.data ? cmp.data.tracked_competitors : null,
    // The one count that does not wait on the report: the brand list is what
    // this section is about, and it has already landed by the time a rail is
    // drawn at all.
    brands: brands.data ? list.length : null,
  };

  const sections: WorkSection[] = SECTIONS.map((s) => ({ ...s, count: counts[s.id] ?? null }));

  useWorkNav(brandId ? {
    agentId: "a10",
    subjects: list.map((b) => ({ id: b.id, ab: initials(b.name), name: b.name })),
    subject: brandId,
    sections,
    section: current,
    onSubject: (id) => openWork("geo", id, current),
    onSection: (id) => openWork("geo", brandId, id),
  } : null);

  // The line that never leaves says the one thing that decides what every
  // figure underneath means: how many engines are the real product.
  const live = ENGINE_IDS.filter((id) => isLive(status[id])).length;
  const proxied = ENGINE_IDS.filter((id) => status[id]?.mode === "proxy").length;
  const sub = brand
    ? `${brand.name} · last ${GEO_DAYS} days · ${live} engine${live === 1 ? "" : "s"} live`
      + (proxied ? `, ${proxied} on ${proxied === 1 ? "a similar model" : "similar models"}` : "")
    : "no brand set up yet";
  useHeadline(sub, SECTIONS.find((s) => s.id === current)?.label);

  if (brands.phase === "loading" && !brands.data) {
    return <div className="geo"><Wait what="Opening GEO" rows={5} /></div>;
  }
  if (brands.phase === "failed" && !brands.data) {
    return <div className="geo"><Oops what="GEO could not be opened." error={brands.error || ""} onRetry={reload} /></div>;
  }
  // The brand list itself, and the only section that must render with no brand
  // selected — an account with nothing set up yet has to be able to add the
  // first one, and every other section here needs a brand to be about.
  if (current === "brands" || !brand) {
    return (
      <div className="geo">
        <GeoBrands
          brands={list}
          onGo={(id, s) => openWork("geo", id, s)}
          onToast={toast}
        />
      </div>
    );
  }

  // Explanations must outlive the thing they explain: the FAQ answers "why is
  // this empty / why did that fail", so it is drawn before the guards that
  // would otherwise replace it with the failure it is there to explain.
  if (current === "faq") {
    return <div className="geo"><GeoFaq brandName={brand.name} days={GEO_DAYS} /></div>;
  }

  if (report.phase === "loading" && !report.data) {
    return <div className="geo"><Wait what={`Reading the last ${GEO_DAYS} days for ${brand.name}`} rows={6} /></div>;
  }
  if (report.phase === "failed" && !report.data) {
    return <div className="geo"><Oops what="The check could not be read." error={report.error || ""} onRetry={reload} /></div>;
  }
  if (!report.data) return null;

  const data: GeoData = {
    brandId,
    brandName: brand.name,
    report: report.data,
    status,
    comparison: cmp.data,
    specs,
    names,
    days: GEO_DAYS,
    reload,
  };

  return (
    <div className="geo">
      {current === "overview" && <GeoOverview data={data} poll={poll.data} onGo={(s) => openWork("geo", brandId, s)} onToast={toast} />}
      {current === "trend" && <GeoTrend data={data} />}
      {current === "questions" && <GeoQuestions data={data} onToast={toast} />}
      {current === "answers" && <GeoAnswers data={data} />}
      {current === "sources" && <GeoSources data={data} onGo={(s) => openWork("geo", brandId, s)} />}
      {current === "competitors" && <GeoCompetitors data={data} cmp={cmp} onToast={toast} />}
      {current === "plan" && <GeoPlan data={data} onToast={toast} />}
      {current === "optimizer" && <GeoOptimizer data={data} onToast={toast} />}
    </div>
  );
}
