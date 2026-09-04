/** The small decisions behind this workspace's edit affordances — Competitors,
 *  Plan, and the brand list itself.
 *
 *  Pure: no component, no network. Each function guards a write:
 *
 *  - `withoutCompetitor` refuses to produce a list that did not shrink. The
 *    comparison row and the saved config are read at different moments, so a
 *    key that matches nothing means they drifted — the caller must refuse the
 *    PUT rather than quietly re-save the same list and claim a removal.
 *  - `assigneeToSave` turns a blur into either a save or a no-op. Every blur
 *    firing a PUT would write the same name over and over; only a real change
 *    (including clearing to "") is worth a request.
 *  - `questionsCell` draws an absent count as "—", never as 0 — the field is
 *    optional per the deploy-skew law, and "0 questions" is a claim the old
 *    API never made.
 *  - `brandSlug` / `brandDomain` / `brandFormProblem` refuse a create the
 *    backend would refuse anyway, in the backend's own words. They mirror
 *    `insights.slugify_brand_id` and `insights.normalize_domain` deliberately
 *    and are NOT the authority: the server decides, and its 409 and 422 are
 *    surfaced verbatim. What they buy is a person not waiting on a round trip
 *    to be told they typed a name with no letters in it.
 *  - The brand words say the one thing every one of these affordances is about:
 *    this list is shared with the SEO Analyst, Blog Writer and Issues, and
 *    removing a brand is not deleting it.
 */
import type { GeoCompetitor } from "@/lib/api";

/** The tracked list minus one entry, or null when the key matches nothing —
 *  in which case nothing must be saved. */
export function withoutCompetitor(tracked: GeoCompetitor[], key: string): GeoCompetitor[] | null {
  const rest = tracked.filter((c) => c.key !== key);
  return rest.length === tracked.length ? null : rest;
}

/** "on how many questions" — a count, or an honest dash when the API predates
 *  the field. Zero is a real count and renders as "0". */
export function questionsCell(nQuestions: number | null | undefined): string {
  return nQuestions == null ? "—" : nQuestions.toLocaleString("en-US");
}

/** What an assign box should save on blur: the trimmed text ("" clears the
 *  assignment), or null when nothing actually changed. */
export function assigneeToSave(current: string | null | undefined, draft: string): string | null {
  const next = draft.trim();
  return next === (current ?? "").trim() ? null : next;
}

/* ------------------------------ the brand list ------------------------------ */

/** One sentence, on every screen that adds or removes a brand.
 *
 *  The brand list is not GEO's. The SEO Analyst, Blog Writer and Issues all
 *  read the same registry and all filter on the same `enabled` flag, so a brand
 *  added here appears in theirs and a brand removed here leaves theirs. Said
 *  plainly and once, without alarm — surprise is the failure mode, not the
 *  sharing. */
export const SHARED_LIST_NOTE =
  "This brand list is shared. A brand added or removed here is added or removed for "
  + "the SEO Analyst, Blog Writer and Issues at the same time.";

/** The brand id a name will get, or null when the name has nothing to build one
 *  from. Mirrors `insights.slugify_brand_id`: everything that is not a letter
 *  or a digit becomes a hyphen, and a brand of pure punctuation has no id. */
export function brandSlug(name: string): string | null {
  const slug = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || null;
}

/** The bare host from anything somebody types — a domain or a pasted URL — or
 *  null when what is left is not a host.
 *
 *  Mirrors `insights.normalize_domain` step for step, because that string is
 *  the brand's identity in Search Console, in citation matching and in the GEO
 *  alias set: `https://www.Acme.com/pricing?x=1` and `acme.com` must land on
 *  the same answer here and there. */
export function brandDomain(url: string): string | null {
  const raw = (url || "").trim();
  let host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");        // scheme
  host = host.split("/")[0].split("?")[0].split("#")[0];          // path, query, fragment
  const at = host.lastIndexOf("@");                               // userinfo
  if (at >= 0) host = host.slice(at + 1);
  host = host.split(":")[0];                                      // port
  host = host.trim().toLowerCase().replace(/^www\./, "").replace(/\.+$/, "");
  if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

/** Why this brand cannot be created yet, or null when it can.
 *
 *  `existing` is the list already on screen. It catches the duplicate a person
 *  can see, so the common mistake is answered without a round trip — but it can
 *  never catch them all: a brand somebody REMOVED still holds its id and is not
 *  in this list, so the server's 409 stays the authority and is shown verbatim
 *  with `duplicateHint` beside it. */
export function brandFormProblem(
  name: string,
  url: string,
  existing: readonly { id: string; name: string }[] = [],
): string | null {
  const cleanName = (name || "").trim();
  if (!cleanName) return "Give the brand a name — the one your team calls it by.";
  if (cleanName.length > 80) return "Keep the brand name under eighty characters.";
  const slug = brandSlug(cleanName);
  if (!slug) return "That name has no letters or numbers in it, and the brand's id is built from those.";

  const cleanUrl = (url || "").trim();
  if (cleanUrl.length < 3) return "Enter the site address — brand.com, or a link to any page on it.";
  if (cleanUrl.length > 300) return "That address is too long — the site's domain is all we need.";
  if (!brandDomain(cleanUrl)) return "Enter the site domain, e.g. brand.com.";

  const clash = existing.find((b) => b.id === slug);
  if (clash) return `${clash.name} is already on this list — open it instead of adding it again.`;
  return null;
}

/** The line under a refused create that came back 409. The brand holding the id
 *  may be one somebody switched off, which is invisible in the main list, so
 *  the way forward is named rather than left to be guessed. */
export const duplicateHint =
  "That brand is already in the shared registry. If you cannot see it above, it is "
  + "switched off — switch it back on under Switched off rather than adding it again.";

/** The toast after a create. Says what the brand does NOT yet have, because
 *  both absences are deliberate and both are the reader's next move. */
export function createdWords(name: string): string {
  return `${name} added with no questions and its scheduled check off. `
    + "Write its buyer questions next — until it has some, a check has nothing to ask.";
}

/** What the remove confirmation asks. Never the word "delete": nothing is
 *  deleted, and the reach of what IS happening is wider than this panel. */
export function removeConfirmWords(name: string): string {
  return `Remove ${name} from the panel? It leaves GEO, the SEO Analyst, Blog Writer and `
    + "Issues. Nothing is deleted — its answers, its questions and its Search Console "
    + "connection are all kept, and it can be switched back on from this screen.";
}

export function removedWords(name: string): string {
  return `${name} removed from the panel, in every agent that shares the list. `
    + "Its measurements are kept — switch it back on under Switched off.";
}

export function restoredWords(name: string): string {
  return `${name} is back, with everything it had. Its scheduled check is whatever it was `
    + "before it was removed — check the switch.";
}

/** Whether this viewer may shape the shared brand list — and whether we can
 *  actually tell.
 *
 *  `is_geo_editor` is derived at sign-in and stored with the session, so it is
 *  not refreshed until the next sign-in. A session opened before the backend
 *  carried the flag therefore has a stored user without it, and waiting will
 *  not produce one. That is a THIRD state rather than a `false`, and collapsing
 *  it either way is wrong in a different direction: drawing the controls would
 *  offer buttons that answer 403, and saying "you are not a GEO editor" would
 *  be a claim about a flag this console never received.
 *
 *  So the absent case falls back to `is_creator`, which the backend's own
 *  definition already includes in `is_geo_editor` — strictly narrower, never
 *  wider — and anybody else is given the read-only screen WITH the reason and
 *  the way out of it. None of this is enforcement: `require_geo_editor` decides
 *  again on every request.
 */
export function editorGate(
  user: { is_geo_editor?: boolean; is_creator?: boolean },
): { mayEdit: boolean; reason: string } {
  if (user.is_geo_editor === true) return { mayEdit: true, reason: "" };
  if (user.is_geo_editor === false) {
    return {
      mayEdit: false,
      reason: "Adding, switching and removing brands is for GEO editors, so the controls are "
        + "not drawn here rather than offered and then refused. The brands below are the "
        + "ones being watched.",
    };
  }
  if (user.is_creator === true) return { mayEdit: true, reason: "" };
  return {
    mayEdit: false,
    reason: "This console cannot tell whether you may change the brand list — your sign-in "
      + "predates the check. Sign out and back in; if you are a GEO editor the controls "
      + "appear. Until then this screen is read-only.",
  };
}
