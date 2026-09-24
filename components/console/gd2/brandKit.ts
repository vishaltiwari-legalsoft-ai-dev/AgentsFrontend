/** The brand-kit sheet's decisions, kept out of the component so they can be
 *  proved without a DOM (there are no component tests in this repo — see
 *  `lib/load.ts`). Runtime imports are relative; `@/` is type-only, because
 *  vitest does not resolve the alias.
 *
 *  Three things live here: the client-side file rules the backend also
 *  enforces (so a 5 MB logo is refused before it is sent, not after), the
 *  save order — JSON first, then every upload against the returned id — and
 *  the words a server `detail` code turns into.
 */

import type {
  GdBrandAssetKind, GdBrandDetail, GdBrandInput, GdBrandReference, GdBrandReferenceKind,
} from "@/lib/api";
import type { Viewer } from "@/components/hub/model";

/* ------------------------------------------------------------ file rules -- */

export type KitFileKind = GdBrandAssetKind | "reference";

/** What the checks need of a `File`, so tests can hand in plain objects. */
export interface FileLike { name: string; type: string; size: number }

export interface FileRule {
  /** Shown in the rejection: "not a PNG, SVG, WebP or JPEG". */
  accepts: string;
  exts: string[];
  mimes: string[];
  maxBytes: number;
  /** Per brand for logos/fonts/guidelines; per request for references. */
  maxFiles: number;
  /** The `accept` attribute for the picker. */
  accept: string;
}

const MB = 1024 * 1024;

export const FILE_RULES: Record<KitFileKind, FileRule> = {
  logo: {
    accepts: "PNG, SVG, WebP or JPEG",
    exts: ["png", "svg", "webp", "jpg", "jpeg"],
    mimes: ["image/png", "image/svg+xml", "image/webp", "image/jpeg"],
    maxBytes: 5 * MB,
    maxFiles: 8,
    accept: "image/png,image/svg+xml,image/webp,image/jpeg,.png,.svg,.webp,.jpg,.jpeg",
  },
  font: {
    accepts: "TTF or OTF",
    exts: ["ttf", "otf"],
    // Browsers report fonts inconsistently (often as an empty type on
    // Windows), so the extension is the check that counts; the MIME list is
    // only what a picker may offer.
    mimes: ["font/ttf", "font/otf", "application/x-font-ttf", "application/x-font-otf", "application/font-sfnt"],
    maxBytes: 2 * MB,
    maxFiles: 16,
    accept: ".ttf,.otf,font/ttf,font/otf",
  },
  guidelines: {
    accepts: "PDF",
    exts: ["pdf"],
    mimes: ["application/pdf"],
    maxBytes: 20 * MB,
    maxFiles: 1,
    accept: "application/pdf,.pdf",
  },
  reference: {
    accepts: "PNG, JPEG or WebP",
    exts: ["png", "jpg", "jpeg", "webp"],
    mimes: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 10 * MB,
    maxFiles: 10,
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
  },
};

/** The most references one request may carry — the backend's own limit. */
export const REFERENCE_BATCH = FILE_RULES.reference.maxFiles;

export const formatMb = (bytes: number): string => {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
};

const extOf = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
};

export interface FileRejection<F extends FileLike> { file: F; reason: string }

export interface FileCheck<F extends FileLike> {
  accepted: F[];
  rejected: FileRejection<F>[];
}

/** Sort a selection into what may be sent and what may not, with a reason per
 *  refusal that names the limit — the same one the backend enforces.
 *  `alreadyHave` is how many of this kind the brand (or, for references, this
 *  batch) already holds, so the count limit is applied to the total. */
export function checkFiles<F extends FileLike>(
  kind: KitFileKind,
  files: F[],
  alreadyHave = 0,
): FileCheck<F> {
  const rule = FILE_RULES[kind];
  const accepted: F[] = [];
  const rejected: FileRejection<F>[] = [];
  let room = Math.max(0, rule.maxFiles - alreadyHave);
  for (const file of files) {
    const typeOk = rule.exts.includes(extOf(file.name)) || (file.type !== "" && rule.mimes.includes(file.type));
    if (!typeOk) {
      rejected.push({ file, reason: `Not a ${rule.accepts} file` });
    } else if (file.size > rule.maxBytes) {
      rejected.push({ file, reason: `File too large (max ${formatMb(rule.maxBytes)})` });
    } else if (room <= 0) {
      rejected.push({
        file,
        reason: kind === "reference"
          ? `Only ${rule.maxFiles} files per upload`
          : rule.maxFiles === 1
            ? "Only one file — replace the one on file"
            : `Only ${rule.maxFiles} ${kind} files per brand`,
      });
    } else {
      accepted.push(file);
      room -= 1;
    }
  }
  return { accepted, rejected };
}

/* --------------------------------------------------------------- colours -- */

/** `#RRGGBB`, upper-case, from anything a person types — `abc`, `#ABCDEF`,
 *  ` #aabbcc `. Null when it is not a colour. */
export function normalizeHex(raw: string): string | null {
  const s = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split("").map((c) => c + c).join("").toUpperCase()}`;
  return null;
}

/* ----------------------------------------------------------------- draft -- */

export type ColorRole = "primary" | "secondary" | "accent";
export const COLOR_ROLES: ColorRole[] = ["primary", "secondary", "accent"];

/** What the sheet edits. Colours are kept as typed so a half-typed hex is not
 *  thrown away on every keystroke; they are normalised on save. */
export interface BrandDraft {
  name: string;
  website: string;
  tone_of_voice: string;
  fonts: string[];
  colors: Record<ColorRole, string[]>;
}

export const emptyDraft = (): BrandDraft => ({
  name: "",
  website: "",
  tone_of_voice: "",
  fonts: [],
  colors: { primary: [""], secondary: [], accent: [] },
});

export const draftFrom = (b: GdBrandDetail): BrandDraft => ({
  name: b.name,
  website: b.website ?? "",
  tone_of_voice: b.tone_of_voice ?? "",
  fonts: [...(b.fonts ?? [])],
  colors: {
    primary: [...(b.colors?.primary ?? [])],
    secondary: [...(b.colors?.secondary ?? [])],
    accent: [...(b.colors?.accent ?? [])],
  },
});

/** What stops a save before anything is sent. Empty means "go". */
export function validateDraft(d: BrandDraft): string[] {
  const problems: string[] = [];
  if (!d.name.trim()) problems.push("Give the brand a name.");
  const primary = d.colors.primary.filter((c) => c.trim() !== "");
  if (primary.length === 0) problems.push("Add at least one primary colour.");
  for (const role of COLOR_ROLES) {
    for (const c of d.colors[role]) {
      if (c.trim() !== "" && normalizeHex(c) === null) {
        problems.push(`"${c.trim()}" is not a hex colour — use six digits like #1746A2.`);
      }
    }
  }
  return problems;
}

const hexes = (list: string[]): string[] =>
  list.map(normalizeHex).filter((c): c is string => c !== null);

/** The JSON body for create and PATCH alike. Blank strings stay blank rather
 *  than being dropped, so clearing the tone of voice — or the website — on a
 *  PATCH actually clears it (the backend stores `website` as sent). */
export function toInput(d: BrandDraft): GdBrandInput {
  return {
    name: d.name.trim(),
    primary_colors: hexes(d.colors.primary),
    secondary_colors: hexes(d.colors.secondary),
    accent_colors: hexes(d.colors.accent),
    fonts: d.fonts.map((f) => f.trim()).filter(Boolean),
    tone_of_voice: d.tone_of_voice.trim(),
    website: d.website.trim(),
  };
}

/* ------------------------------------------------------- reference types -- */

/** The `creative_type` values the library indexes as style categories —
 *  `REFERENCE_CATEGORIES` in the backend's `reference_library.py`, verbatim.
 *  Anything else the pipeline ignores, so the sheet offers exactly these plus
 *  "not sure" (sent as empty). The type is a hint only: Stage 2 grounds on
 *  every uploaded reference whatever its type. */
export const REFERENCE_CREATIVE_TYPES: { value: string; label: string }[] = [
  { value: "brand_gradient", label: "Brand gradient" },
  { value: "newsletter", label: "Newsletter graphic" },
];

export const REFERENCE_TYPE_OTHER = { value: "", label: "Other / not sure" };

/** The words for a stored `creative_type`; an unknown key is shown as sent. */
export const referenceTypeLabel = (value: string | null): string | null => {
  if (!value) return null;
  return REFERENCE_CREATIVE_TYPES.find((t) => t.value === value)?.label ?? value;
};

/* ------------------------------------------------------------------ words -- */

/** The cap a brand that does not exist yet is shown against; once it does,
 *  the backend's `reference_cap` is the figure. */
export const DEFAULT_REFERENCE_CAP = 200;

export const referenceCountLabel = (count: number, cap: number): string => `${count} / ${cap}`;

export const referencesRemaining = (count: number, cap: number): number => Math.max(0, cap - count);

/** Archive is the one action reserved for admins — the same gate `canOpen`
 *  applies to the Admin panel. Absent reads as "not an admin", so a session
 *  stored before the flag is hidden the button rather than offered a 403. */
export const canArchiveBrand = (viewer: Viewer | null | undefined): boolean => !!viewer?.is_admin;

const KIND_NOUN: Record<KitFileKind, string> = {
  logo: "Logo", font: "Font", guidelines: "Guidelines PDF", reference: "Reference image",
};

/** "Logo must be PNG, SVG, WebP or JPEG under 5 MB" — the rule the backend
 *  applied, named by kind so the person knows which limit they met. */
const fileRuleWords = (kind: KitFileKind): string =>
  `${KIND_NOUN[kind]} must be ${FILE_RULES[kind].accepts} under ${formatMb(FILE_RULES[kind].maxBytes)}.`;

/** The backend's `detail` codes (gd_brands.py), in words that name the limit.
 *  Some depend on which upload was refused, so each is a function of the kind
 *  when the caller knows it. Anything else is shown as sent — a sentence the
 *  backend wrote is better than one this file guessed. */
const DETAIL_WORDS: Record<string, (kind?: KitFileKind) => string> = {
  brand_exists: () => "A brand with this name already exists.",
  brand_not_editable: () => "This brand is built in — its kit cannot be changed here.",
  brand_not_found: () => "This brand no longer exists — it may have been archived.",
  reference_cap_reached: () => "This brand already holds as many references as it can.",
  file_too_large: (kind) => (kind ? fileRuleWords(kind) : "The file is larger than the upload limit."),
  unsupported_file_type: (kind) => (kind ? fileRuleWords(kind) : "That file type is not accepted."),
  image_too_large: () => "Image is larger than 4096 px on a side (or an SVG with an embedded image) — please resize it.",
  empty_file: () => "The file is empty.",
  no_files: () => "No file was sent.",
  too_many_files: (kind) => (kind
    ? `Only ${FILE_RULES[kind].maxFiles} ${kind === "reference" ? "references" : `${kind} files`} per upload.`
    : "Too many files in one upload."),
  font_limit_reached: () => `This brand already has ${FILE_RULES.font.maxFiles} font files — remove one first.`,
  logo_limit_reached: () => `This brand already has ${FILE_RULES.logo.maxFiles} logos — remove one first.`,
};

/** `ApiError.status`, read structurally so this module needs no runtime import
 *  from `lib/api` (vitest does not resolve `@/`). */
const statusOf = (e: unknown): number | null => {
  if (!(e instanceof Error)) return null;
  const status: unknown = (e as unknown as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
};

/** `kind` is the upload that was refused, when the caller knows it — it turns
 *  `file_too_large` into the logo's limit rather than "a" limit. */
export function describeBrandFailure(e: unknown, fallback: string, kind?: KitFileKind): string {
  const msg = e instanceof Error ? e.message.trim() : "";
  if (Object.prototype.hasOwnProperty.call(DETAIL_WORDS, msg)) return DETAIL_WORDS[msg](kind);
  // A reply with no `detail` is not the backend's — an edge in front of it
  // (Cloud Run's request-size limit answers 413 with an HTML body).
  const generic = msg === "" || /^Request failed/.test(msg);
  switch (statusOf(e)) {
    case 413: return generic ? "File too large." : msg;
    case 415: return generic ? "That file type is not accepted." : msg;
    case 422: return generic ? "Something in the form was not accepted — check the name and colours." : msg;
    default: return generic ? fallback : msg;
  }
}

/* ------------------------------------------------------------------- save -- */

/** The calls the save needs, as an interface so a test can hand in fakes. */
export interface BrandKitApi<F extends FileLike = File> {
  create: (body: GdBrandInput) => Promise<GdBrandDetail>;
  patch: (brandId: string, body: Partial<GdBrandInput>) => Promise<GdBrandDetail>;
  uploadAssets: (brandId: string, kind: GdBrandAssetKind, files: F[]) => Promise<GdBrandDetail>;
  uploadReferences: (
    brandId: string,
    files: F[],
    meta: { kind?: GdBrandReferenceKind; creative_type?: string; note?: string },
  ) => Promise<{ references: GdBrandReference[]; reference_count: number }>;
}

export interface PendingUploads<F extends FileLike = File> {
  logo: F[];
  font: F[];
  guidelines: F[];
  reference: F[];
  reference_kind: GdBrandReferenceKind;
  reference_creative_type: string;
  reference_note: string;
}

/** Past creatives are the common upload, so `creative` is the default kind. */
export const emptyPending = <F extends FileLike = File>(): PendingUploads<F> => ({
  logo: [], font: [], guidelines: [], reference: [],
  reference_kind: "creative", reference_creative_type: "", reference_note: "",
});

export const hasPending = (p: PendingUploads<FileLike>): boolean =>
  p.logo.length + p.font.length + p.guidelines.length + p.reference.length > 0;

export interface SaveOutcome {
  /** The brand as the backend last returned it. Null only when the JSON step
   *  itself failed — nothing was created and there is nothing to keep. */
  brand: GdBrandDetail | null;
  /** Uploads that did not land, in words, in the order they were tried. The
   *  brand exists regardless; the sheet stays open on it with these shown. */
  problems: string[];
}

/** JSON first, then the files against the returned id. Each upload is its own
 *  request and its own failure: a font that is refused does not stop the logo,
 *  and a brand that was created is never reported as if it was not. */
export async function saveBrandKit<F extends FileLike>(
  api: BrandKitApi<F>,
  brandId: string | null,
  draft: BrandDraft,
  pending: PendingUploads<F>,
): Promise<SaveOutcome> {
  const body = toInput(draft);
  let brand: GdBrandDetail;
  try {
    brand = brandId ? await api.patch(brandId, body) : await api.create(body);
  } catch (e) {
    return { brand: null, problems: [describeBrandFailure(e, "The brand could not be saved.")] };
  }
  const id = brand.brand_id;
  const problems: string[] = [];

  const assetKinds: { kind: GdBrandAssetKind; files: F[]; what: string }[] = [
    { kind: "logo", files: pending.logo, what: "logo" },
    { kind: "font", files: pending.font, what: "fonts" },
    { kind: "guidelines", files: pending.guidelines, what: "guidelines" },
  ];
  for (const { kind, files, what } of assetKinds) {
    if (files.length === 0) continue;
    try {
      brand = await api.uploadAssets(id, kind, files);
    } catch (e) {
      problems.push(`The ${what} did not upload: ${describeBrandFailure(e, "the request failed.", kind)}`);
    }
  }

  for (let i = 0; i < pending.reference.length; i += REFERENCE_BATCH) {
    const batch = pending.reference.slice(i, i + REFERENCE_BATCH);
    try {
      const r = await api.uploadReferences(id, batch, {
        kind: pending.reference_kind,
        creative_type: pending.reference_creative_type || undefined,
        note: pending.reference_note || undefined,
      });
      brand = {
        ...brand,
        references: [...brand.references, ...r.references],
        reference_count: r.reference_count,
      };
    } catch (e) {
      const which = pending.reference.length > REFERENCE_BATCH
        ? `References ${i + 1}–${i + batch.length}`
        : "The references";
      problems.push(`${which} did not upload: ${describeBrandFailure(e, "the request failed.", "reference")}`);
      // A cap reached on one batch is reached for the rest too.
      if (e instanceof Error && e.message === "reference_cap_reached") break;
    }
  }

  return { brand, problems };
}
