/** The brand-kit sheet's decisions, proved without a DOM — `brandKit.ts` is
 *  the sheet's logic layer and this is its only safety net beside `tsc`.
 *
 *  Each block is a promise the sheet makes: files the backend would refuse are
 *  refused here first and named; a save sends the JSON before any byte of a
 *  file, and every upload goes to the id the JSON reply carried; a server
 *  refusal reaches the person in the backend's own words; the reference count
 *  is drawn against the cap; archive is offered to admins and to no one else.
 */

import { describe, expect, it } from "vitest";
import type { GdBrandDetail, GdBrandInput, GdBrandReference } from "@/lib/api";
import {
  DEFAULT_REFERENCE_CAP,
  REFERENCE_BATCH,
  REFERENCE_CREATIVE_TYPES,
  REFERENCE_TYPE_OTHER,
  canArchiveBrand,
  checkFiles,
  describeBrandFailure,
  draftFrom,
  emptyDraft,
  emptyPending,
  normalizeHex,
  referenceCountLabel,
  referenceTypeLabel,
  referencesRemaining,
  saveBrandKit,
  toInput,
  validateDraft,
  type BrandDraft,
  type BrandKitApi,
  type FileLike,
} from "./brandKit";

/* ------------------------------------------------------------- fixtures -- */

const MB = 1024 * 1024;

const file = (name: string, size: number, type = ""): FileLike => ({ name, size, type });

const brand = (over: Partial<GdBrandDetail> = {}): GdBrandDetail => ({
  brand_id: "b_new",
  name: "Berry Virtual",
  slug: "berry-virtual",
  source: "user",
  editable: true,
  logo_url: null,
  primary_colors: ["#1746A2"],
  has_kit: true,
  reference_count: 0,
  archived_at: null,
  created_by: "u1",
  tone_of_voice: "",
  website: "",
  fonts: [],
  colors: { primary: ["#1746A2"], secondary: [], accent: [] },
  assets: { logos: [], fonts: [], guidelines: [] },
  references: [],
  reference_cap: 200,
  ...over,
});

const ref = (id: string): GdBrandReference => ({
  ref_id: id, url: `/r/${id}`, kind: "reference", creative_type: null, note: "", created_at: "2026-09-25T00:00:00Z",
});

/** An `ApiError` as `lib/api` throws it, without importing the module (vitest
 *  does not resolve `@/`; the sheet reads `.status` structurally for the same
 *  reason). */
const apiError = (detail: string, status: number): Error =>
  Object.assign(new Error(detail), { status });

const draft = (over: Partial<BrandDraft> = {}): BrandDraft => ({
  ...emptyDraft(),
  name: "Berry Virtual",
  colors: { primary: ["#1746a2"], secondary: [], accent: [] },
  ...over,
});

/** A fake backend that records the order of every call. */
function fakeApi(over: Partial<BrandKitApi<FileLike>> = {}) {
  const calls: string[] = [];
  const api: BrandKitApi<FileLike> = {
    create: async (body: GdBrandInput) => {
      calls.push(`create:${body.name}`);
      return brand({ name: body.name, primary_colors: body.primary_colors });
    },
    patch: async (id, body) => {
      calls.push(`patch:${id}:${body.name ?? ""}`);
      return brand({ brand_id: id, name: body.name ?? "Berry Virtual" });
    },
    uploadAssets: async (id, kind, files) => {
      calls.push(`assets:${id}:${kind}:${files.map((f) => f.name).join(",")}`);
      return brand({ brand_id: id, logo_url: kind === "logo" ? "/logo.png" : null });
    },
    uploadReferences: async (id, files, meta) => {
      calls.push(`refs:${id}:${files.length}:${meta.kind ?? ""}:${meta.note ?? ""}`);
      return { references: files.map((f, i) => ref(`${f.name}-${i}`)), reference_count: files.length };
    },
    ...over,
  };
  return { api, calls };
}

/* ----------------------------------------------------- client-side rules -- */

describe("checkFiles — the limits the backend enforces, applied before sending", () => {
  it("accepts a logo of an allowed type under 5 MB and refuses one over it", () => {
    const ok = file("mark.png", 4 * MB, "image/png");
    const big = file("mark-hires.png", 5 * MB + 1, "image/png");
    const r = checkFiles("logo", [ok, big]);
    expect(r.accepted).toEqual([ok]);
    expect(r.rejected).toEqual([{ file: big, reason: "File too large (max 5 MB)" }]);
  });

  it("refuses a logo of the wrong type and says which types would do", () => {
    const r = checkFiles("logo", [file("mark.gif", 10, "image/gif")]);
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].reason).toBe("Not a PNG, SVG, WebP or JPEG file");
  });

  it("judges fonts by extension, because browsers report their MIME type inconsistently", () => {
    const r = checkFiles("font", [file("Archivo.ttf", MB), file("Archivo.otf", MB, "font/otf"), file("Archivo.woff2", MB)]);
    expect(r.accepted.map((f) => f.name)).toEqual(["Archivo.ttf", "Archivo.otf"]);
    expect(r.rejected[0].reason).toBe("Not a TTF or OTF file");
  });

  it("caps fonts at 16 per brand, counting the ones already on file", () => {
    const r = checkFiles("font", [file("a.ttf", 10), file("b.ttf", 10)], 15);
    expect(r.accepted.map((f) => f.name)).toEqual(["a.ttf"]);
    expect(r.rejected[0].reason).toBe("Only 16 font files per brand");
  });

  it("refuses a font over 2 MB", () => {
    const r = checkFiles("font", [file("Heavy.ttf", 2 * MB + 1)]);
    expect(r.rejected[0].reason).toBe("File too large (max 2 MB)");
  });

  it("takes one PDF up to 20 MB as guidelines and nothing else", () => {
    const r = checkFiles("guidelines", [file("guide.pdf", 20 * MB, "application/pdf"), file("guide.docx", 10)]);
    expect(r.accepted.map((f) => f.name)).toEqual(["guide.pdf"]);
    expect(r.rejected[0].reason).toBe("Not a PDF file");
    expect(checkFiles("guidelines", [file("g.pdf", 20 * MB + 1)]).rejected[0].reason).toBe("File too large (max 20 MB)");
  });

  it("takes at most 10 references per upload, each under 10 MB", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => file(`ref-${i}.jpg`, MB, "image/jpeg"));
    const r = checkFiles("reference", eleven);
    expect(r.accepted).toHaveLength(REFERENCE_BATCH);
    expect(r.rejected).toEqual([{ file: eleven[10], reason: "Only 10 files per upload" }]);
    expect(checkFiles("reference", [file("big.webp", 10 * MB + 1)]).rejected[0].reason).toBe("File too large (max 10 MB)");
  });
});

describe("normalizeHex", () => {
  it("accepts six or three hex digits with or without the hash, upper-cased", () => {
    expect(normalizeHex("#1746a2")).toBe("#1746A2");
    expect(normalizeHex("1746A2")).toBe("#1746A2");
    expect(normalizeHex(" abc ")).toBe("#AABBCC");
  });

  it("returns null for anything that is not a colour", () => {
    for (const bad of ["", "#12", "#GGGGGG", "blue", "#1746A2FF"]) expect(normalizeHex(bad)).toBeNull();
  });
});

describe("validateDraft — what stops a save before anything is sent", () => {
  it("needs a name and one primary colour", () => {
    expect(validateDraft(emptyDraft())).toEqual(["Give the brand a name.", "Add at least one primary colour."]);
  });

  it("names a hex it cannot read", () => {
    expect(validateDraft(draft({ colors: { primary: ["#1746A2"], secondary: ["teal"], accent: [] } })))
      .toEqual(['"teal" is not a hex colour — use six digits like #1746A2.']);
  });

  it("passes a complete draft", () => {
    expect(validateDraft(draft())).toEqual([]);
  });
});

describe("toInput / draftFrom", () => {
  it("normalises colours, trims text and drops blank colour rows", () => {
    const body = toInput(draft({
      name: "  Berry Virtual ",
      website: " https://berry.example ",
      tone_of_voice: " Plain. ",
      fonts: [" Archivo ", ""],
      colors: { primary: ["1746a2", ""], secondary: ["#ABC"], accent: [] },
    }));
    expect(body).toEqual({
      name: "Berry Virtual",
      primary_colors: ["#1746A2"],
      secondary_colors: ["#AABBCC"],
      accent_colors: [],
      fonts: ["Archivo"],
      tone_of_voice: "Plain.",
      website: "https://berry.example",
    });
  });

  it("sends `website` as an empty string when cleared, so a PATCH really clears it", () => {
    expect(toInput(draft()).website).toBe("");
    expect(toInput(draft({ website: "  " })).website).toBe("");
  });

  it("rebuilds a draft from what the backend holds, website included", () => {
    const d = draftFrom(brand({ tone_of_voice: "Warm.", website: "https://berry.example", fonts: ["Archivo"], colors: { primary: ["#1746A2"], secondary: ["#AABBCC"], accent: ["#FF6849"] } }));
    expect(d.name).toBe("Berry Virtual");
    expect(d.tone_of_voice).toBe("Warm.");
    expect(d.website).toBe("https://berry.example");
    expect(d.fonts).toEqual(["Archivo"]);
    expect(d.colors).toEqual({ primary: ["#1746A2"], secondary: ["#AABBCC"], accent: ["#FF6849"] });
  });
});

/* -------------------------------------------------------------- the save -- */

describe("saveBrandKit — JSON first, then every file against the returned id", () => {
  it("creates the brand, then uploads logo, fonts, guidelines and references to its new id, in that order", async () => {
    const { api, calls } = fakeApi();
    const pending = emptyPending<FileLike>();
    pending.logo = [file("mark.png", 10)];
    pending.font = [file("Archivo.ttf", 10), file("Archivo-Bold.ttf", 10)];
    pending.guidelines = [file("guide.pdf", 10)];
    pending.reference = [file("r1.jpg", 10), file("r2.jpg", 10)];
    pending.reference_kind = "creative";
    pending.reference_note = "the layout";

    const out = await saveBrandKit(api, null, draft(), pending);

    expect(calls).toEqual([
      "create:Berry Virtual",
      "assets:b_new:logo:mark.png",
      "assets:b_new:font:Archivo.ttf,Archivo-Bold.ttf",
      "assets:b_new:guidelines:guide.pdf",
      "refs:b_new:2:creative:the layout",
    ]);
    expect(out.problems).toEqual([]);
    expect(out.brand?.brand_id).toBe("b_new");
    expect(out.brand?.references).toHaveLength(2);
    expect(out.brand?.reference_count).toBe(2);
  });

  it("patches an existing brand rather than creating a second one", async () => {
    const { api, calls } = fakeApi();
    const out = await saveBrandKit(api, "b_old", draft({ name: "Berry Virtual Ltd" }), emptyPending<FileLike>());
    expect(calls).toEqual(["patch:b_old:Berry Virtual Ltd"]);
    expect(out.brand?.brand_id).toBe("b_old");
  });

  it("sends nothing but the JSON when there is nothing to upload", async () => {
    const { api, calls } = fakeApi();
    await saveBrandKit(api, null, draft(), emptyPending<FileLike>());
    expect(calls).toEqual(["create:Berry Virtual"]);
  });

  it("splits more than ten references into requests of ten", async () => {
    const { api, calls } = fakeApi();
    const pending = emptyPending<FileLike>();
    pending.reference = Array.from({ length: 23 }, (_, i) => file(`r${i}.png`, 10));
    const out = await saveBrandKit(api, "b_old", draft(), pending);
    expect(calls.filter((c) => c.startsWith("refs:"))).toEqual([
      "refs:b_old:10:creative:", "refs:b_old:10:creative:", "refs:b_old:3:creative:",
    ]);
    expect(out.brand?.references).toHaveLength(23);
  });

  it("on a 409 brand_exists, creates nothing, uploads nothing, and says so in words", async () => {
    const { api, calls } = fakeApi({
      create: async () => { throw apiError("brand_exists", 409); },
    });
    const pending = emptyPending<FileLike>();
    pending.logo = [file("mark.png", 10)];
    const out = await saveBrandKit(api, null, draft(), pending);
    expect(calls).toEqual([]);
    expect(out.brand).toBeNull();
    expect(out.problems).toEqual(["A brand with this name already exists."]);
  });

  it("keeps a brand that was created even when one of its uploads is refused, and names the one that failed", async () => {
    const { api, calls } = fakeApi({
      uploadAssets: async (id, kind) => {
        calls.push(`assets:${id}:${kind}`);
        if (kind === "font") throw apiError("unsupported_file_type", 415);
        return brand({ brand_id: id });
      },
    });
    const pending = emptyPending<FileLike>();
    pending.logo = [file("mark.png", 10)];
    pending.font = [file("odd.ttf", 10)];
    pending.reference = [file("r.png", 10)];
    const out = await saveBrandKit(api, null, draft(), pending);
    expect(out.brand?.brand_id).toBe("b_new");
    expect(out.problems).toEqual(["The fonts did not upload: Font must be TTF or OTF under 2 MB."]);
    // The refusal of one upload did not stop the ones after it.
    expect(calls).toEqual(["create:Berry Virtual", "assets:b_new:logo", "assets:b_new:font", "refs:b_new:1:creative:"]);
  });

  it("stops sending references once the cap is reached", async () => {
    const { api, calls } = fakeApi({
      uploadReferences: async (id, files) => {
        calls.push(`refs:${id}:${files.length}`);
        throw apiError("reference_cap_reached", 409);
      },
    });
    const pending = emptyPending<FileLike>();
    pending.reference = Array.from({ length: 25 }, (_, i) => file(`r${i}.png`, 10));
    const out = await saveBrandKit(api, "b_old", draft(), pending);
    expect(calls).toEqual(["patch:b_old:Berry Virtual", "refs:b_old:10"]);
    expect(out.problems).toEqual(["References 1–10 did not upload: This brand already holds as many references as it can."]);
  });
});

/* ----------------------------------------------------------------- words -- */

describe("describeBrandFailure — the backend's detail, in words", () => {
  it("translates the brand-level codes", () => {
    expect(describeBrandFailure(apiError("brand_exists", 409), "x")).toBe("A brand with this name already exists.");
    expect(describeBrandFailure(apiError("brand_not_editable", 409), "x")).toBe("This brand is built in — its kit cannot be changed here.");
    expect(describeBrandFailure(apiError("brand_not_found", 404), "x")).toBe("This brand no longer exists — it may have been archived.");
    expect(describeBrandFailure(apiError("reference_cap_reached", 409), "x")).toBe("This brand already holds as many references as it can.");
  });

  it("names the limit of the upload that was refused when the caller says which one", () => {
    expect(describeBrandFailure(apiError("file_too_large", 413), "x", "logo")).toBe("Logo must be PNG, SVG, WebP or JPEG under 5 MB.");
    expect(describeBrandFailure(apiError("unsupported_file_type", 415), "x", "logo")).toBe("Logo must be PNG, SVG, WebP or JPEG under 5 MB.");
    expect(describeBrandFailure(apiError("file_too_large", 413), "x", "font")).toBe("Font must be TTF or OTF under 2 MB.");
    expect(describeBrandFailure(apiError("unsupported_file_type", 415), "x", "guidelines")).toBe("Guidelines PDF must be PDF under 20 MB.");
    expect(describeBrandFailure(apiError("file_too_large", 413), "x", "reference")).toBe("Reference image must be PNG, JPEG or WebP under 10 MB.");
    expect(describeBrandFailure(apiError("too_many_files", 422), "x", "reference")).toBe("Only 10 references per upload.");
    expect(describeBrandFailure(apiError("too_many_files", 422), "x", "font")).toBe("Only 16 font files per upload.");
  });

  it("still speaks plainly when the kind is unknown", () => {
    expect(describeBrandFailure(apiError("file_too_large", 413), "x")).toBe("The file is larger than the upload limit.");
    expect(describeBrandFailure(apiError("unsupported_file_type", 415), "x")).toBe("That file type is not accepted.");
    expect(describeBrandFailure(apiError("too_many_files", 422), "x")).toBe("Too many files in one upload.");
    expect(describeBrandFailure(apiError("empty_file", 422), "x")).toBe("The file is empty.");
    expect(describeBrandFailure(apiError("no_files", 422), "x")).toBe("No file was sent.");
  });

  it("names the pixel and count limits the backend added", () => {
    expect(describeBrandFailure(apiError("image_too_large", 422), "x", "logo"))
      .toBe("Image is larger than 4096 px on a side (or an SVG with an embedded image) — please resize it.");
    expect(describeBrandFailure(apiError("logo_limit_reached", 409), "x", "logo")).toBe("This brand already has 8 logos — remove one first.");
    expect(describeBrandFailure(apiError("font_limit_reached", 409), "x", "font")).toBe("This brand already has 16 font files — remove one first.");
  });

  it("says what a 413 / 415 / 422 with no detail means — an edge in front of the backend, not the backend — and keeps a sentence the backend wrote", () => {
    expect(describeBrandFailure(apiError("Request failed (413)", 413), "x")).toBe("File too large.");
    expect(describeBrandFailure(apiError("Request failed (415)", 415), "x")).toBe("That file type is not accepted.");
    expect(describeBrandFailure(apiError("Request failed", 422), "x")).toMatch(/not accepted/);
    // gd_brands.py's one prose 422 reaches the person as written.
    expect(describeBrandFailure(apiError("a brand name needs at least one letter or digit", 422), "x")).toBe("a brand name needs at least one letter or digit");
  });

  it("falls back to the caller's sentence when there is nothing better", () => {
    expect(describeBrandFailure(new Error(""), "The brand could not be saved.")).toBe("The brand could not be saved.");
    expect(describeBrandFailure("boom", "fallback")).toBe("fallback");
    expect(describeBrandFailure(new Error("Your session expired — please sign in again."), "x")).toBe("Your session expired — please sign in again.");
  });
});

/* ------------------------------------------------------ count and archive -- */

describe("the reference count against the cap", () => {
  it("is drawn as n / cap, with the backend's cap when the brand exists", () => {
    expect(referenceCountLabel(12, 200)).toBe("12 / 200");
    expect(referenceCountLabel(0, DEFAULT_REFERENCE_CAP)).toBe("0 / 200");
    expect(referenceCountLabel(brand({ reference_cap: 50 }).references.length, brand({ reference_cap: 50 }).reference_cap)).toBe("0 / 50");
  });

  it("never reports negative room", () => {
    expect(referencesRemaining(200, 200)).toBe(0);
    expect(referencesRemaining(205, 200)).toBe(0);
    expect(referencesRemaining(3, 200)).toBe(197);
  });
});

describe("canArchiveBrand — the one control reserved for admins", () => {
  it("is offered to an admin and to a creator who is one", () => {
    expect(canArchiveBrand({ is_admin: true })).toBe(true);
    expect(canArchiveBrand({ is_admin: true, is_creator: true })).toBe(true);
  });

  it("is hidden from a member, from a session stored before the flag, and from no one at all", () => {
    expect(canArchiveBrand({})).toBe(false);
    expect(canArchiveBrand({ is_admin: false })).toBe(false);
    expect(canArchiveBrand({ is_geo_only: true })).toBe(false);
    expect(canArchiveBrand(null)).toBe(false);
    expect(canArchiveBrand(undefined)).toBe(false);
  });
});

/* ---------------------------------------- verification pass, 2026-09-25 -- */

describe("checkFiles — what a real picker hands over", () => {
  it("judges the extension case-insensitively and takes .jpeg as well as .jpg", () => {
    const r = checkFiles("logo", [file("MARK.PNG", 10), file("photo.JPEG", 10), file("photo.jpeg", 10, "image/jpeg")]);
    expect(r.accepted.map((f) => f.name)).toEqual(["MARK.PNG", "photo.JPEG", "photo.jpeg"]);
  });

  it("refuses a file whose MIME lies but whose extension is right only when the size is wrong — the backend sniffs the bytes", () => {
    // The client cannot read bytes; it lets an `.exe` renamed `logo.png` through
    // and relies on the backend's 415. That contract is pinned server-side
    // (test_gd_elements_api: an executable renamed to an image is refused).
    const r = checkFiles("logo", [file("logo.png", 10, "application/x-msdownload")]);
    expect(r.accepted).toHaveLength(1);
  });

  it("applies the guidelines limit as one PDF per brand, replacing rather than adding", () => {
    const r = checkFiles("guidelines", [file("a.pdf", 10), file("b.pdf", 10)], 0);
    expect(r.accepted.map((f) => f.name)).toEqual(["a.pdf"]);
    expect(r.rejected[0].reason).toBe("Only one file — replace the one on file");
  });
});

describe("describeBrandFailure — the codes the backend really sends", () => {
  // gd_brands.py answers with snake_case codes in `detail`: file_too_large (413),
  // unsupported_file_type (415), empty_file / no_files / too_many_files /
  // image_too_large (422), font_limit_reached / logo_limit_reached (409),
  // brand_not_found (404). None may reach the person as a code.
  it("turns every backend code into words rather than showing the code", () => {
    const codes = [
      "brand_exists", "brand_not_editable", "brand_not_found", "reference_cap_reached",
      "file_too_large", "unsupported_file_type", "image_too_large", "empty_file", "no_files",
      "too_many_files", "font_limit_reached", "logo_limit_reached",
    ];
    for (const code of codes) {
      const words = describeBrandFailure(apiError(code, 400), "x");
      expect(words, code).not.toBe(code);
      expect(words, code).not.toMatch(/_/);
    }
  });

  it("shows an unknown code as sent — the backend's word beats a guess", () => {
    expect(describeBrandFailure(apiError("something_new", 409), "x")).toBe("something_new");
  });
});

describe("reference uploads — kind and type", () => {
  it("defaults to past creatives, the common upload", () => {
    expect(emptyPending().reference_kind).toBe("creative");
    expect(emptyPending().reference_creative_type).toBe("");
  });

  it("offers exactly the backend's REFERENCE_CATEGORIES plus 'not sure', which sends nothing", () => {
    expect(REFERENCE_CREATIVE_TYPES.map((t) => t.value)).toEqual(["brand_gradient", "newsletter"]);
    expect(REFERENCE_TYPE_OTHER.value).toBe("");
  });

  it("labels a stored type, shows an unknown one as sent, and nothing for none", () => {
    expect(referenceTypeLabel("brand_gradient")).toBe("Brand gradient");
    expect(referenceTypeLabel("legacy_social")).toBe("legacy_social");
    expect(referenceTypeLabel(null)).toBeNull();
    expect(referenceTypeLabel("")).toBeNull();
  });
});

describe("saveBrandKit — a create that lands but whose uploads all fail is still a create", () => {
  it("returns the created brand with one problem per failed upload, in upload order", async () => {
    const { api, calls } = fakeApi({
      uploadAssets: async (id, kind) => {
        calls.push(`assets:${id}:${kind}`);
        throw apiError("file_too_large", 413);
      },
      uploadReferences: async (id, files) => {
        calls.push(`refs:${id}:${files.length}`);
        throw apiError("unsupported_file_type", 415);
      },
    });
    const pending = emptyPending<FileLike>();
    pending.logo = [file("mark.png", 10)];
    pending.guidelines = [file("g.pdf", 10)];
    pending.reference = [file("r.png", 10)];
    const out = await saveBrandKit(api, null, draft(), pending);
    expect(out.brand?.brand_id).toBe("b_new");
    expect(out.problems).toEqual([
      "The logo did not upload: Logo must be PNG, SVG, WebP or JPEG under 5 MB.",
      "The guidelines did not upload: Guidelines PDF must be PDF under 20 MB.",
      "The references did not upload: Reference image must be PNG, JPEG or WebP under 10 MB.",
    ]);
    expect(calls).toEqual(["create:Berry Virtual", "assets:b_new:logo", "assets:b_new:guidelines", "refs:b_new:1"]);
  });

  it("keeps the brand the PATCH returned when nothing was uploaded, so the sheet shows the server's copy", async () => {
    const { api } = fakeApi({
      patch: async (id) => brand({ brand_id: id, name: "Renamed by the server", fonts: ["Archivo"] }),
    });
    const out = await saveBrandKit(api, "b_old", draft({ name: "Anything" }), emptyPending<FileLike>());
    expect(out.brand?.name).toBe("Renamed by the server");
    expect(out.brand?.fonts).toEqual(["Archivo"]);
  });
});
