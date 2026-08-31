"use client";

/** Library — everything your specialists can draw on, by the brand it belongs to.
 *
 *  Two reads make this page, because the two halves of a brand kit live in
 *  different places: `loadLibrary` has the assets on file, and
 *  `gdIngestedBrands` has what was extracted from them — the palette, the fonts,
 *  and crucially whether a logo was ever found. That last one is not decoration.
 *  The Graphic Designer places a logo at stage four; a brand with none cannot
 *  finish a run, and a Library that does not say so leaves the reader to
 *  discover it from a failed run instead.
 */

import { useEffect, useState } from "react";
import {
  gdIngestedBrands, loadLibrary,
  type GdIngestedBrand, type LibraryBrand,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub } from "../context";
import { n, word } from "../model";
import { Ic } from "../Sprite";
import { Blank, Oops, PageHead, Wait } from "../ui";
import { useRuns } from "../useRuns";

export function LibraryView() {
  const { revision, openWork, toast } = useHub();
  const session = useLoadSession();
  const [lib, setLib] = useState<Load<LibraryBrand[]>>(loadPending);
  const [kits, setKits] = useState<Load<GdIngestedBrand[]>>(loadPending);
  const [beat, setBeat] = useState(0);

  const { state: feed } = useRuns({ limit: 1 }, revision, { live: false });

  useEffect(() => {
    void session.run(
      "library-assets",
      (signal) => loadLibrary(12, { signal }),
      setLib,
      "The library could not be read.",
      { keepStale: true },
    );
    void session.run(
      "library-kits",
      (signal) => gdIngestedBrands({ signal }).then((r) => r.brands),
      setKits,
      "The brand kits could not be read.",
      { keepStale: true },
    );
  }, [session, beat]);

  const brands = lib.data || [];
  const kitById = new Map((kits.data || []).map((k) => [k.id, k]));
  const totalAssets = brands.reduce((s, b) => s + b.creative_count, 0);
  const noLogo = brands.filter((b) => {
    const k = kitById.get(b.id);
    return k ? k.counts.logos === 0 : false;
  });

  useHeadline(
    lib.data
      ? `${n(brands.length)} brand kit${brands.length === 1 ? "" : "s"} · ${n(totalAssets)} assets`
      : "reading the library",
  );

  if (lib.phase === "loading" && !lib.data) {
    return (
      <>
        <PageHead statement="Everything your specialists can draw on." lede="Reading the library." />
        <Wait what="Reading the library" rows={4} />
      </>
    );
  }

  if (lib.phase === "failed" && !lib.data) {
    return <Oops what="The library could not be read." error={lib.error || ""} onRetry={() => setBeat((b) => b + 1)} />;
  }

  if (brands.length === 0) {
    return (
      <>
        <PageHead statement="Nothing is on file yet." lede="A brand kit is what every specialist draws on. Until one is ingested, runs have no logo, no palette and no reference material to work from." />
        <Blank
          title="No brand kits"
          action={
            <button type="button" className="btn btn--mark btn--sm" onClick={() => openWork("art")}>
              Open the Graphic Designer
            </button>
          }
        >
          Brand kits are ingested from Drive or uploaded through the Graphic Designer. Once one is
          in, its logo, palette and fonts are available to every specialist.
        </Blank>
      </>
    );
  }

  return (
    <>
      <PageHead
        statement={
          noLogo.length > 0
            ? <>{word(brands.length)} brand kit{brands.length === 1 ? "" : "s"}. <b>{noLogo.length === 1 ? "One has no logo" : `${word(noLogo.length)} have no logo`}</b>.</>
            : <>{word(brands.length)} brand kit{brands.length === 1 ? "" : "s"}, <b>all with a logo on file</b>.</>
        }
        lede="Everything your specialists can draw on, grouped by the brand it belongs to. Assets are named by what they are, not by where they sit on disk — a specialist reaching for the logo needs to know which file is the logo."
      />

      {kits.phase === "failed" && !kits.data && (
        <Oops
          what="The extracted kits could not be read."
          error={`${kits.error} Palettes and logo checks are missing below; the assets themselves are correct.`}
          onRetry={() => setBeat((b) => b + 1)}
        />
      )}

      {brands.map((b) => {
        const kit = kitById.get(b.id);
        const runs = feed.data?.facets.brands.find((x) => x.name === b.brand_name)?.count ?? null;
        const colors = kit?.primary_colors || [];
        const missingLogo = kit ? kit.counts.logos === 0 : false;
        return (
          <section className="kit" key={b.id}>
            <div className="kit__head">
              <h3>{b.brand_name}</h3>
              {colors.length > 0 && (
                <span className="swatches" role="img" aria-label={`Brand colours: ${colors.join(", ")}`}>
                  {colors.map((c) => <i key={c} style={{ background: c }} />)}
                </span>
              )}
            </div>

            <div className="kit__facts">
              <div><b>{n(b.creative_count)}</b><span>{b.creative_count === 1 ? "Asset" : "Assets"} on file</span></div>
              <div>
                <b>{runs === null ? "—" : n(runs)}</b>
                <span>{runs === 1 ? "Run filed here" : "Runs filed here"}</span>
              </div>
              {kit && <div><b>{n(kit.counts.fonts)}</b><span>{kit.counts.fonts === 1 ? "Font" : "Fonts"}</span></div>}
              {colors.length > 0 && <div><b>{colors.length}</b><span>Brand colours</span></div>}
              {missingLogo && <div className="is-bad"><b>None</b><span>Logo on file</span></div>}
            </div>

            {b.creatives.length === 0 ? (
              <Blank title="Nothing ingested for this brand yet">
                The kit exists but has no assets on file, so a specialist reaching for one finds
                nothing.
              </Blank>
            ) : (
              <ul className="assets">
                {b.creatives.map((it) => (
                  <li className="asset" key={it.view_url || it.file_name}>
                    <div className="asset__art">
                      {it.is_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.view_url} alt={it.file_name} loading="lazy" />
                      ) : (
                        <span className="asset__doc" aria-hidden="true">{it.file_type || "file"}</span>
                      )}
                    </div>
                    <div className="asset__cap">
                      <b>{it.file_name}</b>
                      <span>{it.file_type}</span>
                    </div>
                  </li>
                ))}
                {missingLogo && (
                  <li className="asset asset--add">
                    <button
                      type="button"
                      onClick={() => {
                        toast("A logo is added with the brand kit, in the Graphic Designer.", "warn");
                        openWork("art");
                      }}
                    >
                      <Ic name="plus" />
                      <b>No logo on file</b>
                      <span>
                        The Graphic Designer places one at stage four. Until it is here, no run for
                        this brand can finish.
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}

            {b.creative_count > b.creatives.length && (
              <p className="soon-note">
                Showing {b.creatives.length} of {n(b.creative_count)}.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
