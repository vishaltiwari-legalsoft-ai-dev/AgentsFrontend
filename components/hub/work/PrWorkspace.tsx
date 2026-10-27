"use client";

/** The PR Writer workspace: its brands in the work bar (a picker, past five,
 *  each with what waits on you or its draft count), Drafts, Write and Brand
 *  card as its sections, and the route as the only memory of where you were.
 *
 *  Mirrors `BlogWorkspace`: the desk renders inside `.legacy` for the bridge's
 *  tokens, and `#/w/pr/<brandId>/<view>` decides what it shows. An older
 *  version of a draft rides the hash query (`?v=1.0`), which `routeFromHash`
 *  leaves for the workspace to read, the same split it makes for the inbox's
 *  OAuth return.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { prBrands, prRuns, type PrBrand, type PrRun, type PrRunSummary } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub, useWorkNav, type WorkSection } from "../context";
import { initials } from "../model";
import { Blank, Oops, Wait } from "../ui";
import { workspaceBySlug } from "../workspaces";
import { PrWriter } from "@/components/console/prwriter/PrWriter";
import {
  brandNote, normaliseBrand, normaliseSummary, readRoute, readVersionParam, rowTitle, runsFor, sectionOf,
  withVersionParam,
} from "./pr";

const SECTIONS = workspaceBySlug("pr")!.sections;

export function PrWorkspace({ subject, section }: { subject: string; section: string }) {
  const { user, openWork, toast, revision, route } = useHub();
  const session = useLoadSession();
  const [brands, setBrands] = useState<Load<{ brands: PrBrand[] }>>(loadPending);
  const [runs, setRuns] = useState<Load<{ runs: PrRunSummary[] }>>(loadPending);
  // The run on screen, once read: places a run the list does not carry yet
  // (one just created) and names it before the list catches up.
  const [opened, setOpened] = useState<PrRun | null>(null);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const opts = { keepStale: true };
    void session.run(
      "pr-brands",
      (signal) => prBrands({ signal }).then((r) => ({ brands: (r?.brands || []).map(normaliseBrand) })),
      setBrands, "The brands could not be read.", opts,
    );
    // Every brand at once: the work bar's per-brand "2 waiting on you" needs them.
    void session.run(
      "pr-runs",
      (signal) => prRuns(undefined, { signal }).then((r) => ({ runs: (r?.runs || []).map(normaliseSummary) })),
      setRuns, "The drafts could not be read.", opts,
    );
  }, [session, revision, beat]);

  const list = brands.data?.brands || [];
  const rows = runs.data?.runs || [];
  const { brandId, view } = readRoute(subject, section, list, rows, opened);
  const brand = list.find((b) => b.id === brandId) || null;
  const drafts = useMemo(() => runsFor(rows, brandId), [rows, brandId]);
  const sec = sectionOf(view);
  const known = view.kind === "run" ? rows.find((r) => r.id === view.runId) : undefined;
  const title = known ? rowTitle(known) : opened && view.kind === "run" && opened.id === view.runId
    ? (opened.draft?.headlines.find((h) => h.recommended)?.text || opened.news) : "";

  // The hash query is not part of the route, so it is read here. `route` is a
  // dependency: every hash change gives a new route object and a re-render.
  const viewing = useMemo(
    () => (typeof window === "undefined" ? null : readVersionParam(window.location.hash)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route],
  );

  useHeadline(brand ? `${brand.name} · ${title || brand.domain}` : "reading the brands");

  useWorkNav({
    agentId: "a13",
    subjects: list.map((b) => ({
      id: b.id, ab: initials(b.name), name: b.name,
      note: runs.data ? brandNote(rows, b.id) : undefined,
    })),
    subject: brandId,
    sections: SECTIONS.map((s): WorkSection => ({
      ...s, count: s.id === "drafts" ? (runs.data ? drafts.length : null) : null,
    })),
    section: sec,
    onSubject: (id) => openWork("pr", id, sec),
    onSection: (s) => openWork("pr", brandId, s),
  });

  /** Open another version of the draft on screen, or the current one (null).
   *  Assigning the hash fires `hashchange`, which the shell turns into a route,
   *  so Back walks the versions the reader opened. */
  const onViewVersion = useCallback((version: string | null) => {
    const next = withVersionParam(window.location.hash, version);
    if (next !== window.location.hash) window.location.hash = next;
  }, []);

  const failed = (brands.phase === "failed" && !brands.data) || (runs.phase === "failed" && !runs.data);
  if (failed) {
    return (
      <Oops
        what="PR Writer could not be read."
        error={brands.error || runs.error || ""}
        onRetry={() => setBeat((b) => b + 1)}
      />
    );
  }
  if (!brands.data || !runs.data) return <Wait what="Reading the brands and drafts" rows={3} />;
  if (!brand) {
    return (
      <Blank title="No brands are set up yet.">
        Add one in the SEO Analyst first. PR Writer uses the same brand list.
      </Blank>
    );
  }

  return (
    <div className="legacy">
      <PrWriter
        onToast={toast}
        brands={list}
        drafts={drafts}
        brandId={brandId}
        view={view}
        meId={user.id}
        viewing={view.kind === "run" ? viewing : null}
        onViewVersion={onViewVersion}
        onNavigate={(b, v) => openWork("pr", b, v)}
        onRunsChanged={() => setBeat((b) => b + 1)}
        onRunOpened={setOpened}
      />
    </div>
  );
}
