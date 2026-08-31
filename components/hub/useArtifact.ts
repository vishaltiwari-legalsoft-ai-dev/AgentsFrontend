"use client";

/** Turning an artifact reference into something an `<img>` can actually show.
 *
 *  The record stores a *path* for the picture a run made — `/api/gd/runs/<id>/
 *  artifact/stage-4/…`. Three things are wrong with putting that straight into
 *  a `src`, and the browser found all three at once:
 *
 *  1. It is relative, so it resolves against the **frontend** origin rather
 *     than the API's, and 404s before it ever reaches the backend.
 *  2. The endpoint is authenticated. An `<img>` cannot send a bearer token, so
 *     even against the right origin it answers 401.
 *  3. An old run's bytes may genuinely be gone. Rendering a broken-image glyph
 *     in a 44px tile tells the reader their work was lost; it was not — the
 *     row is the record, and the picture is an attachment to it.
 *
 *  So the bytes are fetched the way every other artifact in this console is
 *  fetched — through the authenticated helper — and anything that fails falls
 *  back to the specialist's stamp, silently and on purpose. A missing
 *  attachment is not an error the reader has to act on.
 */

import { useEffect, useState } from "react";
import { gdArtifactBlob } from "@/lib/api";

export type ArtifactState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; url: string }
  /** The bytes are not there. Deliberately not surfaced as a failure. */
  | { phase: "gone" };

/** A reference the console has to fetch, rather than a URL it can hand to the
 *  browser. Absolute URLs (a signed GCS link, say) are already renderable. */
const needsFetching = (ref: string): boolean => ref.startsWith("/api/");

export function useArtifact(ref: string | null | undefined): ArtifactState {
  const [state, setState] = useState<ArtifactState>({ phase: "idle" });

  useEffect(() => {
    if (!ref) {
      setState({ phase: "idle" });
      return;
    }
    if (!needsFetching(ref)) {
      setState({ phase: "ready", url: ref });
      return;
    }

    let dead = false;
    let objectUrl: string | null = null;
    setState({ phase: "loading" });

    gdArtifactBlob(ref)
      .then((url) => {
        if (dead) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setState({ phase: "ready", url });
      })
      .catch(() => {
        if (!dead) setState({ phase: "gone" });
      });

    return () => {
      dead = true;
      // An object URL that is never revoked holds its blob for the life of the
      // tab. A ledger scrolled through a few hundred rows would hold every one.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref]);

  return state;
}
