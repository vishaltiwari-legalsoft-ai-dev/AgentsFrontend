/**
 * API client for the AgentOS backend (FastAPI on Cloud Run).
 *
 * Auth: a Google ID token is exchanged for an app JWT, stored client-side and
 * sent as a Bearer token on every request. A 401 triggers the registered
 * unauthorized handler (so the app can log the user out cleanly).
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

/* ------------------------------ Auth plumbing ---------------------------- */

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.detail === "string" ? data.detail : "Request failed";
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error("Your session expired — please sign in again.");
  }
  return response;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await request(path);
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

/* --------------------------------- Types --------------------------------- */

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  is_admin: boolean;
  // Top-tier owner role (above Super Admin): may manage secrets/integrations.
  is_creator?: boolean;
}

export interface GalleryItem {
  file_name: string;
  file_type: string;
  view_url: string;
  is_image: boolean;
}

export interface LibraryBrand {
  id: string;
  brand_name: string;
  creative_count: number;
  creatives: GalleryItem[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  provider: string;
  created_at: string;
  last_login: string;
}

export interface MonthlyStat {
  month: string;
  count: number;
  by_brand: Record<string, number>;
}

export interface Analytics {
  total_requests: number;
  monthly: MonthlyStat[];
  by_brand: Record<string, number>;
  by_category: Record<string, number>;
}

/* --------------------------------- Auth ---------------------------------- */

export async function googleLogin(
  credential: string,
): Promise<{ token: string; user: User }> {
  // Send the browser's timezone so the backend can stamp run rows with local
  // time (falls back to UTC server-side if unavailable).
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timezone = "";
  }
  const response = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, timezone }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { token: string; user: User };
}

/* ------------------------------ Library / data --------------------------- */

export async function loadLibrary(perBrand = 24): Promise<LibraryBrand[]> {
  const data = await getJson<{ brands: LibraryBrand[] }>(
    `/api/library?per_brand=${perBrand}`,
  );
  return data.brands;
}

/* --------------------------------- Admin --------------------------------- */

export async function getAdminUsers(): Promise<{ users: AdminUser[]; total: number }> {
  return getJson("/api/admin/users");
}

export async function getAdminAnalytics(): Promise<Analytics> {
  return getJson("/api/admin/analytics");
}

// Admin-only runtime settings (OpenRouter key + model ids). The key is never
// returned in full — only a masked hint and whether it's set.
export interface AdminSettings {
  openrouter: {
    api_key_set: boolean;
    api_key_hint: string;
    api_key_source: "override" | "env" | "unset";
    model: string;
    fast_model: string;
    image_model: string;
    vision_model: string;
  };
  sources: Record<string, "override" | "env">;
  // Secret API keys (OpenRouter + GEO engine keys), masked with provenance.
  keys: Record<string, { set: boolean; hint: string; source: "override" | "env" | "unset" }>;
  // Curated model choices, keyed by runtime-config field, for dropdowns.
  catalog: Record<AgentModelField, ModelOption[]>;
}

export interface AdminSettingsPatch {
  openrouter_api_key?: string;
  openrouter_model?: string;
  openrouter_fast_model?: string;
  openrouter_image_model?: string;
  openrouter_vision_model?: string;
  perplexity_api_key?: string;
  gemini_api_key?: string;
  openai_api_key?: string;
}

export function getAdminSettings(): Promise<AdminSettings> {
  return getJson("/api/admin/settings");
}

export function updateAdminSettings(patch: AdminSettingsPatch): Promise<AdminSettings> {
  return postJson("/api/admin/settings", patch);
}

export function testOpenRouterKey(): Promise<{ ok: boolean; label?: string; is_free_tier?: boolean }> {
  return postJson("/api/admin/settings/test", {});
}

/* ----------------------------- Image library ----------------------------- */
/* Admin-only gallery: the final creative of every COMPLETED Graphics Designer
   run, archived to GCS at Stage-4 approval and listed newest-first. */

export interface ImageLibraryItem {
  run_id: string;
  user_id: string;
  user_email: string;
  brand: string | null;
  brand_id: string | null;
  summary: string;
  headline: string;
  aspect_ratio: string | null;
  completed_at: string;
  /** A fresh signed GCS URL, or an API proxy path (starts with "/api/"). */
  view_url: string;
}

export function getImageLibrary(limit = 200): Promise<{ items: ImageLibraryItem[]; total: number }> {
  return getJson(`/api/admin/image-library?limit=${limit}`);
}

/** Proxy-served gallery images need the Bearer header, so fetch as a blob and
 *  hand back an object URL (callers should revoke it on unmount). */
export async function imageLibraryBlob(path: string): Promise<string> {
  const response = await request(path);
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}

/* --------------------------- Database viewer ----------------------------- */
/* Admin-only, read-only inspection of the Firestore collections, rendered as  */
/* tables — so the team can see the data really living in the database.        */

export interface DbCollection {
  name: string;
  label: string;
  description: string;
  // null = the count couldn't be read (database unreachable), not "empty".
  count: number | null;
  // Deep link to this collection in the Firebase console.
  console_url?: string;
}

export interface DbCollectionsResponse {
  collections: DbCollection[];
  connected: boolean;
  database: string;
  project: string;
  // Deep link to the database root in the Firebase console.
  console_url?: string;
}

export interface DbCollectionData {
  name: string;
  label: string;
  description: string;
  count: number | null;
  returned: number;
  limit: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

export function getDbCollections(): Promise<DbCollectionsResponse> {
  return getJson("/api/admin/db/collections");
}

export function getDbCollection(name: string, limit = 50): Promise<DbCollectionData> {
  return getJson(`/api/admin/db/collections/${encodeURIComponent(name)}?limit=${limit}`);
}

// Delete the superseded telemetry collections (creative_events, sessions,
// requests, conversations). Requires confirm === "DELETE". Operational data is
// never touched.
export function purgeTelemetry(
  confirm: string,
): Promise<{ deleted: Record<string, number>; kept: string }> {
  return postJson("/api/admin/db/purge-telemetry", { confirm });
}

/* ---------------------------- News banner -------------------------------- */
/* A single announcement set by the creator; shown to every signed-in user.   */

export interface NewsBanner {
  text: string;
  updated_at: string;
}

export function getNews(): Promise<NewsBanner> {
  return getJson<NewsBanner>("/api/news");
}

export function updateNews(text: string): Promise<NewsBanner> {
  return postJson<NewsBanner>("/api/news", { text });
}

/* --------------------- Agent configuration (creator) --------------------- */
/* Per-agent model overrides, managed only by the creator account.          */

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  /** Curated entries carry one; live OpenRouter entries may not. */
  description?: string;
  recommended?: boolean;
  /** Quality tier for dropdown grouping: "flagship" | "balanced" | "fast". */
  tier?: string;
}

/** A model field that can be overridden per agent (matches backend slugs). */
export type AgentModelField =
  | "openrouter_model"
  | "openrouter_fast_model"
  | "openrouter_image_model"
  | "openrouter_vision_model"
  | "gd_planner_model";

export interface AgentConfigItem {
  id: string;
  name: string;
  role: string;
  category: string;
  live: boolean;
  /** The model fields this agent actually consumes — the only dropdowns shown. */
  fields: AgentModelField[];
  /** Explicit per-agent choice ("" = inherit the global default). Keys ⊆ fields. */
  overrides: Partial<Record<AgentModelField, string>>;
  /** What the agent actually uses right now (agent → global → env). Keys ⊆ fields. */
  effective: Partial<Record<AgentModelField, string>>;
}

export interface AgentConfigResponse {
  agents: AgentConfigItem[];
  fields: AgentModelField[];
  catalog: Record<AgentModelField, ModelOption[]>;
  /** Display labels for the tier groups, keyed by tier slug. */
  tier_labels?: Record<string, string>;
  global_defaults: Record<AgentModelField, string>;
}

export type AgentConfigPatch = Partial<Record<AgentModelField, string>>;

export function getAgentConfig(): Promise<AgentConfigResponse> {
  return getJson("/api/admin/agents");
}

export function updateAgentConfig(
  agentId: string,
  patch: AgentConfigPatch,
): Promise<AgentConfigResponse> {
  return postJson(`/api/admin/agents/${agentId}`, patch);
}

/* ----------------------- Graphic Designer pipeline ----------------------- */
/* The 4-stage ad-creative pipeline (backend: graphics_designer_agent).      */

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

export interface GdDiff {
  token: string;
  find: string;
  replace: string;
  count: number;
}

export interface GdAttempt {
  attempt: number;
  variant: string;
  artifact: string;
  url: string;
  prompt?: string;
  prompt_hash?: string;
  diffs?: GdDiff[];
  warnings?: string[];
  provider?: string;
  method?: string;
  // Honest per-generation remix metadata: ai=true only for a real LLM rewrite.
  remix?: { ai: boolean; axis: string; fallback_reason?: string };
  // Stage-3 Text Optimizer: one attempt per style, sharing a set_id. ai=true
  // only when the image really came from the model; fallbacks carry the reason.
  style?: string;
  style_label?: string;
  ai?: boolean;
  fallback_reason?: string | null;
  qa?: string;
  set_id?: string;
  fonts?: Record<string, string>;
  // Step 5: the user's retouch request this attempt was generated from.
  tweak_instruction?: string;
  created_at: string;
}

export interface GdApproved {
  attempt: number;
  variant: string;
  artifact: string;
  url: string;
}

export interface GdStage {
  variant: string | null;
  attempts: GdAttempt[];
  approved: GdApproved | null;
}

export interface GdRun {
  id: string;
  user_id: string;
  brand_id: string | null;
  state: string;
  config: {
    font: string;
    aspect_ratio: string;
    text_placement?: string;
    cta_placement?: string;
    element_placement?: string;
    element_styles?: Record<string, GdElementStyle>;
    subheadings?: GdSubheading[];
    // Stage-3 free-drag coordinates per element id (headline / subheading-N / cta).
    layout?: Record<string, GdLayoutEntry>;
    shapes?: GdShape[];
    // Canva-style free elements (emoji / icon / sticker / uploaded image).
    elements?: GdElement[];
    logo_layout?: GdLogoLayout;
    custom_gradient?: GdCustomGradient | null;
    custom_element?: GdCustomElement | null;
    subject_asset_ref?: string | null;
    background_asset_ref?: string | null;
    remix_enabled?: boolean;
    creative_brief?: Record<string, string>;
    creative_type?: string;
    // Stage-3 Text Optimizer: free-text placement/style notes for the polish prompts.
    polish_notes?: string;
    use_ai_compositor: boolean;
    tokens: Record<string, string>;
    tokens_approved: Record<string, boolean>;
  };
  stages: Record<string, GdStage>;
  logo: { artifact: string } | null;
  manifest_log: Record<string, unknown>[];
  tokens_ready: boolean;
  created_at: string;
  updated_at: string;
}

// Per-element Stage-3 styling for the deterministic renderer. `placement`,
// `size_pct` and the pixel nudge are omitted for the inline highlight (it follows
// the headline); `color` is omitted for the CTA (its orange button is locked).
// `size_pct` is the element's size as a % of the canvas width; `offset_x`/`offset_y`
// are a pixel nudge from the placement anchor.
export interface GdElementStyle {
  font?: string;
  color?: string;
  placement?: string;
  align?: string; // "left" | "center" | "right" — line alignment inside the box
  size_pct?: number;
  offset_x?: number;
  offset_y?: number;
}

// Stage-3 free-drag coordinate for one element. x/y ∈ [0,1] place the element's
// `anchor` point on the canvas; w ∈ (0,1] is its max width as a fraction of width.
export interface GdLayoutEntry {
  x: number;
  y: number;
  w: number;
  anchor: string;
}

// One Stage-3 shape / infographic element (rect, circle, triangle, arrow,
// divider, callout, or a named icon). Positioned by absolute coords like text.
export interface GdShape {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: string;
  fill: string;
  stroke: string | null;
  stroke_w: number;
  radius: number;
  icon: string | null;
  text: string;
  z: number;
}

// One Stage-3 sub-heading line (the dynamic 1–5 list, replacing the old fixed
// subtext1/subtext2). Each line is independently styled, placed and approved.
export interface GdSubheading {
  text: string;
  font?: string;
  color?: string;
  align?: string;
  size_pct?: number;
  placement?: string;
  offset_x?: number;
  offset_y?: number;
  approved?: boolean;
}

// One row of the emoji catalogue served by GET /api/gd/elements.
export interface EmojiRow {
  char: string;
  name: string;
  category: string;
  file: string;
}

// One Stage-3 free element (emoji / icon / sticker / uploaded image). Positioned
// by absolute coords like shapes; `ref` identifies the asset (emoji char, icon
// key, sticker key, or an uploaded-image ref from gdElementUpload).
export interface GdElement {
  id: string;
  kind: "emoji" | "icon" | "sticker" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: string;
  z: number;
  rotation: number;
  opacity: number;
  ref: string;
  fill: string;
}

// Stage-4 logo placement controls (deterministic compositor).
export interface GdLogoLayout {
  position: string;
  size_pct: number | null;
  margin_pct: number;
  offset_x: number;
  offset_y: number;
}

export interface GdStage3Element {
  key: string;
  label: string;
  token: string;
  placeable: boolean;
  colorable: boolean;
  sizable: boolean;
  placement_kind: "text" | "cta";
}

export interface GdTextColor {
  key: string;
  label: string;
  swatch: string;
  phrase: string;
}

export interface GdVariant {
  id: string;
  title: string;
  desc: string;
  angle?: string;
  category?: string;
  css_gradient?: string;
  subject?: string; // Stage-2 element variants supply this instead of a prompt file
  prompt_file?: string; // Stage-1 variants only
}

// A per-creative, temporary AI gradient (Stage 1). Lives on the run config only —
// never added to the canonical prompt library. Selected with variant id "AI".
export interface GdCustomGradient {
  id: string; // always "AI"
  cid?: string; // curated/llm id, used to exclude already-seen picks on regenerate
  title: string;
  desc: string;
  prompt: string;
  css_gradient: string;
  source?: string; // "agent" | "agent+llm"
}

export interface GdGradientSuggestion {
  type: "gradient";
  state: "proposed";
  source: string;
  ai: boolean;
  gradient: GdCustomGradient;
  note: string;
  // Set when the LLM path failed and a curated brand preset was served instead
  // (ai is false) — surfaced to the user so a preset is never passed off as AI.
  fallback_reason?: string;
}

// A per-creative, temporary AI element (Stage 2). Lives on the run config only —
// never added to the catalogue. Selected with variant id "AI".
export interface GdCustomElement {
  id: string; // always "AI"
  cid?: string;
  title: string;
  desc: string;
  category: string;
  subject: string;
  source?: string; // "agent" | "agent+llm"
}

export interface GdElementSuggestion {
  type: "element";
  state: "proposed";
  source: string;
  ai: boolean;
  element: GdCustomElement;
  note: string;
}

export interface GdExplorePick {
  id: string;
  title: string;
  category: string;
  reason: string;
}

export interface GdExplore {
  type: "explore";
  ai: boolean;
  picks: GdExplorePick[];
  wildcard: GdExplorePick | null;
  idea: string;
  note: string;
}

export interface GdAspectRatio {
  ar: string;
  label: string;
  dimensions: string;
  w: number;
  h: number;
  orientation: string;
  default: boolean;
}

export interface GdQuestion {
  id: string;
  question: string;
  options: { id: string; label: string }[];
}

// One turn of the pre-generation discovery conversation (Steps 1–2). `kind`
// drives rendering: "choice" = chips only, "text" = free text only,
// "choice_text" = chips with a free-text override.
export interface GdDiscoveryQuestion {
  id: string;
  group: "intent" | "context";
  kind: "choice" | "text" | "choice_text";
  prompt: string;
  options?: { id: string; label: string }[];
  placeholder?: string;
  optional?: boolean;
}

// One message in the strategist conversation (agent ⇄ user).
export interface GdChatMessage {
  role: "agent" | "user";
  text: string;
}

// One agent turn returned by the conversational strategist (kind:"chat").
export interface GdChatTurn {
  type: "chat";
  state: string;
  source: string;
  reply: string;
  brief: Record<string, string>;
  done: boolean;
  direction: GdDirection | null;
}

// The synthesized creative direction returned after the discovery conversation.
export interface GdDirection {
  type: "direction";
  state: string;
  source: string;
  summary: string;
  concept: string;
  concept_title: string;
  concept_rationale: string;
  tone: string;
  palette_hint: string;
  copy_angle: string;
  highlights: string[];
}

export interface GdBrandOption {
  id: string;
  name: string;
}

export interface GdConfig {
  brand_id: string;
  brand_name: string;
  stage1_variants: GdVariant[];
  stage2_variants: GdVariant[];
  stage2_categories: string[];
  stage2_placements: { key: string; label: string; row: number; col: number }[];
  fonts: string[];
  font_family: string;
  font_variants: { name: string; weight: number; style: string; file: string }[];
  text_placements: { key: string; label: string; phrase: string }[];
  cta_placements: { key: string; label: string; phrase: string }[];
  text_colors: GdTextColor[];
  stage3_elements: GdStage3Element[];
  text_size_pct_min: number;
  text_size_pct_max: number;
  default_text_size_pct: Record<string, number>;
  text_offset_px_range: number;
  subheading_min: number;
  subheading_max: number;
  anchors: string[];
  shape_kinds: string[];
  icon_keys: string[];
  logo_positions: { key: string; label: string; row: number; col: number }[];
  logo_size_pct_min: number;
  logo_size_pct_max: number;
  logo_offset_px_range: number;
  aspect_ratios: GdAspectRatio[];
  brand_kit_block: string;
  locked_colors: {
    gradient: string[];
    text: string;
    accent: string;
    headline_highlight: { from: string; to: string; direction: string };
    cta: { from: string; to: string; direction: string; shadow: string };
  };
  stage1_source_note: string;
  onboarding_questions: GdQuestion[];
  discovery_questions: GdDiscoveryQuestion[];
  content_tokens: string[];
}

export interface GdHookSuggestion {
  headlines: { headline: string; highlight: string }[];
  ctas: { cta: string }[];
  subtext_pairs: { subtext1: string; subtext2: string }[];
}

/** Brands the studio can produce for (registry packs) — drives the picker. */
export const gdListBrands = () =>
  getJson<{ brands: GdBrandOption[]; default: string }>("/api/gd/brands");

/** Brands whose kit data has been ingested — the setup-screen readiness strip. */
export interface GdIngestedBrand {
  id: string;
  name: string;
  logo_url: string | null;
  primary_colors: string[];
  counts: { fonts: number; logos: number; reference_assets?: number };
  source?: string | null;
}

export const gdIngestedBrands = () =>
  getJson<{ brands: GdIngestedBrand[] }>("/api/gd/ingested-brands");

const _brandQuery = (brand?: string | null) =>
  brand ? `?brand=${encodeURIComponent(brand)}` : "";

export const gdGetConfig = (brand?: string | null) =>
  getJson<GdConfig>(`/api/gd/config${_brandQuery(brand)}`);

export const gdCreateRun = (
  brandId?: string | null,
  init?: { aspect_ratio?: string; creative_type?: string; creative_brief?: Record<string, string>; remix_enabled?: boolean },
) => postJson<GdRun>("/api/gd/runs", { brand_id: brandId ?? null, ...(init ?? {}) });

/* ---------------- Brand Reference Library (ingestion + retrieval) --------- */
// Test/debug surface so a human can SEE which reference creatives the agent
// picks up for a given brand + creative type + brief. Backed by /api/ref-library.

export interface RefRecord {
  id: string;
  brand_id: string;
  brand_name: string;
  creative_type: string;
  file_name: string;
  width: number;
  height: number;
  aspect_ratio: string;
  orientation: string;
  format_match: boolean;
  palette: string[];
  tags: string[];
  summary: string;
  source: string;
  _score?: number;
  _why?: string[];
}

export interface RefDriveSyncResult {
  source: string;
  folder_id: string;
  downloaded: number;
  ingested: number;
  mirrored_to_gcs: number;
  by_type: Record<string, number>;
  skipped_folders: string[];
}

/** Pull on-brand reference creatives from the shared Google Drive folder into
 *  the library (admin/creator only). Backed by POST /api/ref-library/sync-drive. */
export const gdRefSyncDrive = (useLlm = false) =>
  postJson<RefDriveSyncResult>(`/api/ref-library/sync-drive?use_llm=${useLlm}`, {});

export const gdUpdateConfig = (
  id: string,
  body: {
    font?: string;
    aspect_ratio?: string;
    text_placement?: string;
    cta_placement?: string;
    element_placement?: string;
    element_styles?: Record<string, GdElementStyle>;
    subheadings?: GdSubheading[];
    layout?: Record<string, GdLayoutEntry | null>;
    shapes?: GdShape[];
    elements?: GdElement[];
    logo_layout?: Partial<GdLogoLayout>;
    custom_gradient?: GdCustomGradient | null;
    custom_element?: GdCustomElement | null;
    subject_asset_ref?: string | null;
    background_asset_ref?: string | null;
    remix_enabled?: boolean;
    creative_brief?: Record<string, string>;
    polish_notes?: string;
    use_ai_compositor?: boolean;
    tokens?: Record<string, string>;
    token_approvals?: Record<string, { approved: boolean; source?: string; original_suggestion?: string }>;
  },
) => postJson<GdRun>(`/api/gd/runs/${id}/config`, body);

// Stage 3 with the Text Optimizer returns the brand_strict attempt as `attempt`
// plus ALL styled siblings in `attempts` (absent on single-attempt generates).
export const gdGenerate = (id: string, stage: number, variant?: string) =>
  postJson<{ attempt: GdAttempt; attempts?: GdAttempt[]; run: GdRun }>(
    `/api/gd/runs/${id}/generate`, { stage, variant });

// AI Suggest Placement — vision-first: a micro-subagent looks at the approved
// Stage-2 image and judges zone / text colour / density; the arranger computes
// exact coords ("source": "vision"). Falls back to the metadata-only arranger
// ("source": "deterministic"). The caller applies it via gdUpdateConfig or
// discards. Does not persist server-side.
export type GdPlacementSuggestion = {
  layout: Record<string, GdLayoutEntry>;
  shapes?: GdShape[];
  element_styles?: Record<string, GdElementStyle>;
  text_color?: string;
  source?: "vision" | "deterministic";
  reason?: string;
};
export const gdSuggestPlacement = (id: string) =>
  postJson<GdPlacementSuggestion>(`/api/gd/runs/${id}/suggest-placement`, {});

export const gdApprove = (id: string, stage: number, attempt?: number) =>
  postJson<GdRun>(`/api/gd/runs/${id}/approve`, { stage, attempt });

// Step 5: guardrailed retouch of the approved final. Rejections surface the
// guardrail violations as the error message; nothing is stored server-side.
export const gdTweak = (id: string, instruction: string) =>
  postJson<{ attempt: GdAttempt; run: GdRun }>(`/api/gd/runs/${id}/tweak`, { instruction });

export const gdBack = (id: string, stage: number) =>
  postJson<GdRun>(`/api/gd/runs/${id}/back`, { stage });

export const gdSuggest = (id: string, body: Record<string, unknown>) =>
  postJson<Record<string, unknown>>(`/api/gd/runs/${id}/suggest`, body);

/** Auto-mode plan: the AI's picks for all four stages, validated server-side
 *  against the run's real pack inventory. */
export interface GdPlan {
  version: number;
  brief: string;
  concept: string;
  gradient: { cid: string; reason: string };
  element: { cid: string; reason: string };
  text: { headline: string; highlight: string; subline: string; cta: string; reason: string };
  logo: { logo_id: string | null; reason: string };
  layout?: GdPlanLayout;
}

/** Binding wireframe zones planned from the brief (spec 2026-07-14). */
export interface GdPlanLayout {
  subject_cell: string;
  headline_zone: string;
  sub_zone: string;
  cta_zone: string;
  logo_corner: string;
}

export const gdPlan = (id: string, brief: string) =>
  postJson<{ plan: GdPlan; run: GdRun }>(`/api/gd/runs/${id}/plan`, { brief });

export interface GdBrandLogoVariant {
  id: string;
  name: string;
  thumb: string; // data-URL thumbnail
}

export async function gdBrandLogos(id: string) {
  return getJson<{ logos: GdBrandLogoVariant[]; brand_name: string }>(
    `/api/gd/runs/${id}/brand-logos`,
  );
}

export async function gdStage4(
  id: string,
  logo: File | null,
  useAi: boolean,
  logoId?: string | null,
): Promise<{ attempt: GdAttempt; run: GdRun }> {
  const form = new FormData();
  // Omitting the file makes the backend fall back to the picked/brand logo.
  if (logo) form.append("logo", logo);
  form.append("use_ai", String(useAi));
  if (!logo && logoId) form.append("logo_id", logoId);
  const response = await request(`/api/gd/runs/${id}/stage4`, { method: "POST", body: form });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { attempt: GdAttempt; run: GdRun };
}

/** Artifacts require the Bearer header, so fetch as a blob and hand back an
 *  object URL (callers should revoke it on unmount). */
export async function gdArtifactBlob(path: string): Promise<string> {
  const response = await request(path);
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}

/** Live Stage-3 overlay preview: renders the real (deterministic) text overlay
 *  at a small size and returns an object URL. `tokens`/`subheading_texts` carry
 *  the unsaved edits so the preview matches what Generate will produce. */
export async function gdTextPreview(
  id: string,
  body: { tokens?: Record<string, string>; subheading_texts?: string[] },
): Promise<string> {
  const response = await request(`/api/gd/runs/${id}/text-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}

/** Stage-3 element catalogue (emoji / icon / sticker keys + the per-run cap). */
export const gdElements = () =>
  getJson<{ emoji: EmojiRow[]; icons: string[]; stickers: string[]; max_elements: number }>(
    "/api/gd/elements",
  );

/** Upload a custom image element for one run; returns a `ref` to use in a
 *  GdElement with kind "image". Multipart — no JSON Content-Type so the
 *  browser sets the boundary; auth header still comes from `request()`. */
export async function gdElementUpload(runId: string, file: File): Promise<{ ref: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await request(`/api/gd/runs/${runId}/elements/upload`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { ref: string };
}

/** Fetch one brand font file (validated server-side against the pack) as an
 *  object URL, for FontFace registration so the editor canvas shows TRUE
 *  brand typography. Callers should revoke the URL after the face loads. */
export async function gdFontBlob(name: string, brand?: string | null): Promise<string> {
  const response = await request(
    `/api/gd/fonts/${encodeURIComponent(name)}${brand ? `?brand=${encodeURIComponent(brand)}` : ""}`,
  );
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}

/** Upload an image for a run. role="subject"/"background": the deterministic
 *  composite modes — store the returned `ref` via gdUpdateConfig
 *  ({ subject_asset_ref } / { background_asset_ref }) and generate with variant
 *  "UPLOAD" (Pillow composite, no image model). role="prompt": an image the
 *  user attached WITH the brief — the backend appends it to
 *  config.prompt_image_refs (max 3, deduped) and Stage-1/2 AI generation
 *  manipulates/incorporates it as the brief directs. */
export async function gdSubjectUpload(
  runId: string,
  file: File,
  role: "subject" | "background" | "prompt" = "subject",
): Promise<{ ref: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await request(
    `/api/gd/runs/${runId}/subject/upload?role=${role}`,
    { method: "POST", body: form },
  );
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { ref: string };
}

/* ---------------- Creative Agent (brochures / decks / carousels / blogs) --- */
// Standard social posts use the Graphics Studio editor (gd* above). Everything
// else routes to the dedicated Creative Agent: plan → review → generate a real
// PDF / PPTX / image set, manually or autonomously. Backed by /api/creative.

export interface CreativeTypeMeta {
  key: string;
  label: string;
  aspect_ratio: string;
  orientation: string;
  multi_frame: boolean;
  output_format: "image" | "image_set" | "pdf" | "pptx";
  notes: string;
  unit: string;
  default_count: number;
  min_count: number;
  max_count: number;
}

export interface CreativeStep {
  key: string;
  label: string;
  detail: string;
}

export interface CreativeDecision {
  step: string;
  decision: string;
  rationale: string;
  source: "agent" | "user";
  timestamp: string;
}

export interface CreativeArtifact {
  name: string;
  mime: string;
  ref: string;
  bytes: number;
  url: string;
}

export interface CreativePlan {
  creative_type: string;
  count: number;
  source: string;
  grounded: boolean;
  rationale: string;
  decisions: CreativeDecision[];
  frames?: { index: number; role: string; headline: string; body: string; visual: string }[];
  slides?: { index: number; title: string; bullets: string[]; notes: string }[];
  sections?: { heading: string; body: string; bullets: string[] }[];
  cover?: { title: string; subtitle?: string; visual?: string };
  inline?: { caption: string; visual: string }[];
  contact?: { line: string };
}

export interface CreativeRun {
  id: string;
  user_id: string;
  brand_id: string;
  brand_name: string;
  creative_type: string;
  output_format: string;
  /** Carousel only: "text" (per-slide copy) or "images_only" (image + logo). */
  text_mode?: "text" | "images_only";
  autonomous: boolean;
  autonomous_ack: boolean;
  state: "INTENT" | "STRATEGY" | "LAYOUT" | "OUTPUT" | "DONE";
  brief: string;
  intent: Record<string, unknown>;
  plan: CreativePlan | null;
  plan_approved: boolean;
  references: RefRecord[];
  grounding: string;
  decision_log: CreativeDecision[];
  artifacts: CreativeArtifact[];
  /** Live generation progress (present while/after Step 4 runs). */
  progress?: { done: number; total: number; state?: string };
}

export const creativeTypes = () =>
  getJson<{
    types: CreativeTypeMeta[];
    steps: CreativeStep[];
    autonomous_warning: string;
    engines: Record<string, boolean>;
  }>("/api/creative/types");

export const creativeCreate = (body: {
  creative_type: string;
  brand_id?: string | null;
  brief?: string;
  autonomous?: boolean;
  text_mode?: "text" | "images_only";
}) => postJson<CreativeRun>("/api/creative/runs", body);

export const creativeGet = (id: string) => getJson<CreativeRun>(`/api/creative/runs/${id}`);

export const creativeAcknowledge = (id: string) =>
  postJson<CreativeRun>(`/api/creative/runs/${id}/acknowledge`, {});

export const creativePlan = (id: string, body: { count?: number | null; use_llm?: boolean } = {}) =>
  postJson<CreativeRun>(`/api/creative/runs/${id}/plan`, body);

/** Carousel text mode: push the user's exact per-slide headline/sub-text into the
 *  plan before generation. */
export const creativeUpdatePlanText = (
  id: string,
  frames: { index: number; headline?: string; body?: string }[],
) => postJson<CreativeRun>(`/api/creative/runs/${id}/plan/text`, { frames });

export const creativeApprove = (id: string) =>
  postJson<CreativeRun>(`/api/creative/runs/${id}/plan/approve`, {});

export const creativeGenerate = (id: string) =>
  postJson<CreativeRun>(`/api/creative/runs/${id}/generate`, {});

export const creativeAutonomous = (
  id: string,
  body: { count?: number | null; use_llm?: boolean } = {},
) => postJson<CreativeRun>(`/api/creative/runs/${id}/autonomous`, body);

export const creativeOverride = (id: string) =>
  postJson<CreativeRun>(`/api/creative/runs/${id}/override`, {});

/** Download a produced artifact (PDF/PPTX/PNG/zip) with the auth header, as an
 *  object URL (callers should revoke it after triggering the download). */
export async function creativeArtifactBlob(url: string): Promise<string> {
  const response = await request(url);
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}

/* ----------------------- Marketing Research agent ------------------------ */
// Backed by /api/mr. Data enters via CSV export upload; reports render as HTML.

export type MrPlatform = "google_ads" | "meta" | "hubspot";

export const MR_REPORT_KINDS = [
  "daily_summary",
  "weekly_summary",
  "monthly_summary",
  "quarterly_summary",
  "threshold_alert",
  "competitor_digest",
  "opportunity_report",
  "utm_attribution",
  "icp_signal",
  "daily_movement",
] as const;
export type MrReportKind = (typeof MR_REPORT_KINDS)[number];

export interface MrDataGap {
  source: string;
  message: string;
}

export interface MrIngestResult {
  dataset_id: string;
  platform: string; // MrPlatform for CSVs, "pdf:<filename>" for PDF uploads
  metrics: number;
  leads: number;
  gaps: MrDataGap[];
}

export interface MrDataset {
  id: string;
  platform: string;
  generated_at?: string | null;
  metrics: number;
  leads: number;
  gaps: MrDataGap[];
}

export interface MrConnector {
  key: string;
  label: string;
  logo: string | null;
  category: string;
  status: "connected" | "needs_setup" | "available";
  detail: string;
}

export interface MrConfig {
  spreadsheet_id: string;
  spreadsheet_url: string;
  year: number;
  competitors: { name: string; url: string }[];
  schedule: { report: string; cadence: string }[];
  thresholds: Record<string, number>;
}

export interface MrReport {
  id: string;
  kind: MrReportKind;
  generated_at: string;
  user_id: string;
  agent_id: string;
  sources?: MrSource[];
  structured: Record<string, unknown>;
  markdown: string;
  html: string;
}

export interface MrRunSummary {
  id: string;
  kind: MrReportKind;
  generated_at: string;
  period?: string | null;
}

export type MrMetricStatus = "good" | "warn" | "bad" | "na";

export interface MrChannelAgg {
  spend: number;
  leads: number;
  qualified_leads: number;
  demos_booked: number;
  demos_completed: number;
  cost_per_lead?: number | null;
  cost_per_qualified_lead?: number | null;
  cost_per_demo_booked: number | null;
  cost_per_demo_completed: number | null;
  cac?: number | null;
  goal?: {
    cpd_booked_low: number;
    cpd_booked_high: number;
    cpd_completed_low: number;
    cpd_completed_high: number;
  } | null;
  status?: Partial<Record<string, MrMetricStatus>>;
}

export interface MrFlagGroup {
  metric: string | null;
  level: string;
  count: number;
  text: string;
}

export interface MrSource {
  platform: string;
  generated_at: string | null;
  metrics: number;
  leads: number;
}

export interface MrOverview {
  has_data: boolean;
  month: string | null;
  totals: MrChannelAgg | null;
  channels: Record<string, MrChannelAgg>;
  flag_summary: MrFlagGroup[];
  /** The lead sheet's month block for the overview month (null until connected). */
  lead_quality?: MrLeadMonth | null;
  sources: MrSource[];
}

export const mrOverview = () => getJson<MrOverview>("/api/mr/overview");

export interface MrDeltaField { delta: number | null; mtd: number | null; corrected: boolean }
export interface MrRateField { value: number | null; mode: "recomputed" | "mtd" }
export interface MrDeltaBlock {
  additive: Record<string, MrDeltaField>;
  rates: Record<string, MrRateField>;
}
export interface MrVendorDelta {
  vendor: string;
  vendor_slug: string;
  date: string;
  since: string | null;
  days: number;
  month_start: boolean;
  corrected: boolean;
  blocks: { team_overall: MrDeltaBlock; channels: Record<string, MrDeltaBlock> };
}
export interface MrSnapshotCaptureResult {
  date: string;
  tabs: { tab: string; slug?: string; captured?: boolean; skipped?: boolean; error?: string }[];
  exported: string[];
}
export interface MrSnapshotMeta {
  vendor: string; vendor_slug: string; gid: number; date: string; month: string; captured_at: string;
}

export const mrSnapshotCapture = () =>
  postJson<MrSnapshotCaptureResult>("/api/mr/snapshots/capture", {});
export const mrSnapshotDeltas = () => getJson<MrVendorDelta[]>("/api/mr/snapshots/deltas");
export const mrSnapshots = () => getJson<MrSnapshotMeta[]>("/api/mr/snapshots");

export interface MrSnapshotDoc {
  vendor: string; vendor_slug: string; gid: number; date: string; month: string; captured_at: string;
  canonical: { team_overall: Record<string, unknown>; channels: Record<string, Record<string, unknown>> };
}
export interface MrVendorDetail {
  vendor: string; vendor_slug: string; gid: number;
  dates: string[];
  snapshot: MrSnapshotDoc;
  delta: MrVendorDelta;
}
export const mrVendorDetail = (slug: string, date?: string) =>
  getJson<MrVendorDetail>(`/api/mr/snapshots/vendor/${slug}${date ? `?date_iso=${date}` : ""}`);

export interface MrMonthRow {
  month: string; spend: number; leads: number; qualified_leads: number;
  demos_booked: number; demos_completed: number; cpql: number | null;
}
export interface MrChannelPoint { month: string; spend: number; leads: number; qualified_leads: number }
export interface MrTrendVendor {
  vendor: string; spend_mtd: number; leads: number; qualified_leads: number;
  cpql: number | null; spend_series: { month: string; spend: number }[];
}
/** `kind` is the routing key — the board sends pace to the hero and efficiency to
 *  the vendor chart. Never re-derive it by matching words in `text`: the pace
 *  sentence mentions "qualified leads" and used to match both. */
export interface MrInsight {
  kind?: "pace" | "efficiency" | "mover";
  level: "good" | "warn" | "info";
  text: string;
}
export interface MrTrends {
  has_data: boolean; month: string | null;
  monthly: MrMonthRow[];
  channels: Record<string, MrChannelPoint[]>;
  vendors: MrTrendVendor[];
  insights: MrInsight[];
}
export const mrTrends = () => getJson<MrTrends>("/api/mr/trends");

export interface MrPortfolio {
  date: string; month: string; vendors: number;
  total_budget: number; total_spend: number; budget_utilized_pct: number | null;
  leads: number; qualified_leads: number; cost_per_qualified_lead: number | null;
  qual_demos_booked: number; cost_per_qual_demo_booked: number | null;
  demos_completed: number; cost_per_demo_completed: number | null;
  show_rate_pct: number | null; services_sold: number;
  pacing: { day: number; days_in_month: number; expected_pct: number };
  benchmarks: { cpqdb_max: number; ql_ratio_min: number; show_rate_min: number; cac_target: number; cpql_red: number };
}
export const mrPortfolio = () => getJson<MrPortfolio>("/api/mr/snapshots/portfolio");

/* Lead-analysis sheet: per-vendor Meeting Outcome / Deal Stage picture + the
   five lead-quality flags. Auto-detected from any connected workbook. */
export interface MrLeadFlag { level: string; message: string; metric: string }
export interface MrLeadVendor {
  campaign: string; slug: string; matched_vendor: string | null;
  booked: number; completed: number; no_show: number; canceled: number;
  bad_lead: number; pending: number; other: number; resolved: number;
  completed_rate_pct: number | null; no_show_rate_pct: number | null;
  canceled_rate_pct: number | null; bad_lead_rate_pct: number | null;
  deal_stages: Record<string, number>;
  services_sold: number; amount: number; mrr: number;
  brands: Record<string, number>; sources: Record<string, number>;
  tracker: {
    leads: number; qualified_leads: number; demos_booked: number;
    ql_ratio_pct: number | null; booking_rate_pct: number | null;
  } | null;
  flags: MrLeadFlag[];
  story: string;
}
export interface MrLeadTotals {
  booked: number; completed: number; no_show: number; canceled: number;
  bad_lead: number; pending: number; other: number; resolved: number;
  completed_rate_pct: number | null; no_show_rate_pct: number | null;
  canceled_rate_pct: number | null; bad_lead_rate_pct: number | null;
  services_sold: number; amount: number; mrr: number;
  brands: Record<string, number>; sources: Record<string, number>;
}
export interface MrLeadMonth {
  vendors: MrLeadVendor[];
  totals: MrLeadTotals;
  flag_count: number;
}
export interface MrLeadAnalysis {
  has_data: boolean;
  hint?: string;
  generated_at?: string;
  source_label?: string;
  tab?: string;
  gaps?: string[];
  months?: Record<string, MrLeadMonth>;
  latest_month?: string | null;
  unmatched_campaigns?: string[];
}
export const mrLeadAnalysis = () => getJson<MrLeadAnalysis>("/api/mr/lead-analysis");

/** Upload one platform's CSV export and normalize it into a dataset. */
export async function mrIngest(file: File, platform: MrPlatform): Promise<MrIngestResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("platform", platform);
  const response = await request("/api/mr/ingest", { method: "POST", body: form });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as MrIngestResult;
}

export interface MrSheetTabResult {
  tab: string;
  dataset_id?: string;
  metrics?: number;
  gaps?: MrDataGap[];
  error?: string;
}
export interface MrSheetIngestResult {
  spreadsheet_id: string;
  year: number;
  tabs: MrSheetTabResult[];
}

/** Pull Legal Soft's live Google-Sheets performance tracker (brand tabs). */
export const mrIngestSheet = (body: { gid?: string; brand?: string; year?: number } = {}) =>
  postJson<MrSheetIngestResult>("/api/mr/ingest-sheet", body);

export const mrDatasets = () => getJson<MrDataset[]>("/api/mr/datasets");

/** Remove one ingested file/pull; its numbers leave the dashboard immediately. */
export async function mrDeleteDataset(id: string): Promise<void> {
  const response = await request(`/api/mr/datasets/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

/** Upload a PDF report — text is extracted and metrics parsed into a dataset. */
export async function mrIngestPdf(file: File): Promise<MrIngestResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await request("/api/mr/ingest-pdf", { method: "POST", body: form });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as MrIngestResult;
}

export const mrConnectors = () => getJson<MrConnector[]>("/api/mr/connectors");

export const mrConfig = () => getJson<MrConfig>("/api/mr/config");

export interface MrChannelGoalFields {
  cpd_booked_low: number; cpd_booked_high: number;
  cpd_completed_low: number; cpd_completed_high: number;
  completed_demo_pct: number;
}
export interface MrTargets {
  thresholds: Record<string, number>;
  channel_goals: Record<string, MrChannelGoalFields>;
  edited: boolean;
}
export const mrGetTargets = () => getJson<MrTargets>("/api/mr/targets");
export const mrSaveTargets = (body: {
  thresholds?: Record<string, number>;
  channel_goals?: Record<string, Partial<MrChannelGoalFields>>;
  reset?: boolean;
}) => postJson<MrTargets>("/api/mr/targets", body);

export interface MrTabProfile {
  title: string;
  gid: number;
  kind: string;
  granularity: string;
  date_range: string | null;
  platforms: string[];
  metrics: string[];
  summary: string;
  useful: boolean;
  hidden: boolean;
}

export interface MrAskAnswer {
  question: string;
  timeframe: string | null;
  answer: string;
  used_tabs: string[];
}

export interface MrSheetSource {
  id: string;
  label: string;
  primary: boolean;
  include_in_dashboard: boolean;
  added_at?: string;
}
export interface MrSheetSources {
  enabled: boolean;
  service_account: string;
  sources: MrSheetSource[];
}

export const mrSources = () => getJson<MrSheetSources>("/api/mr/sources");

/** Connect another Google Sheet by pasted link; returns the agent's first-pass read of its tabs. */
export const mrAddSource = (url: string) =>
  postJson<{ source: MrSheetSource; tabs: MrTabProfile[]; tab_count: number }>("/api/mr/sources", { url });

/** Disconnect a secondary sheet — the agent stops reading it immediately. */
export async function mrDeleteSource(id: string): Promise<void> {
  const response = await request(`/api/mr/sources/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

export const mrWorkbook = () => getJson<{ tabs: MrTabProfile[]; count: number }>("/api/mr/workbook");

export const mrWorkbookScan = () =>
  postJson<{ tabs: MrTabProfile[]; count: number }>("/api/mr/workbook/scan", {});

export const mrAsk = (question: string, timeframe?: string) =>
  postJson<MrAskAnswer>("/api/mr/ask", { question, timeframe });

export interface MrReportPeriod {
  period: string;   // "2026-07" | "2026-Q3"
  label: string;    // "July 2026" | "Q3 2026"
  current: boolean; // the month/quarter containing yesterday
}

export interface MrReportPeriods {
  months: MrReportPeriod[];
  quarters: MrReportPeriod[];
}

export const mrReportPeriods = () =>
  getJson<MrReportPeriods>("/api/mr/report-periods");

export const mrBuildReport = (kind: MrReportKind, period?: string) =>
  postJson<MrReport>(`/api/mr/reports/${kind}`, period ? { period } : {});

export const mrListRuns = () => getJson<MrRunSummary[]>("/api/mr/runs");

export const mrGetRun = (id: string) => getJson<MrReport>(`/api/mr/runs/${id}`);

/** Download-report PDFs — the console panels rendered server-side in the same
 *  format. Returns an object URL ready for an <a download> click. */
async function mrPdfBlobUrl(path: string): Promise<string> {
  const response = await request(path);
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}
export const mrReportPdfUrl = (id: string) => mrPdfBlobUrl(`/api/mr/runs/${id}/pdf`);
export const mrVendorPdfUrl = (slug: string, date?: string) =>
  mrPdfBlobUrl(`/api/mr/snapshots/vendor/${slug}/pdf${date ? `?date_iso=${date}` : ""}`);
export const mrLeadsPdfUrl = (month?: string) =>
  mrPdfBlobUrl(`/api/mr/lead-analysis/pdf${month ? `?month=${month}` : ""}`);

/* ------------------------------ SEO agent (a2) ---------------------------- */

export interface SeoBrand {
  id: string;
  name: string;
  domain: string;
  gsc_property: string;
  seeds: string[];
  enabled: boolean;
}

export interface SeoRunNums {
  /** "search-console" = impression-based numbers; "rank-tracking" = live SERP positions only. */
  mode?: "search-console" | "rank-tracking";
  clicks_28d: number;
  clicks_prev_28d: number;
  impressions_28d: number;
  avg_position: number;
  est_potential_clicks: number;
  tracked?: number;
  top3?: number;
  top10?: number;
  unranked?: number;
  moved_up?: number;
  moved_down?: number;
}

export interface SeoBrandCard {
  brand: SeoBrand;
  gsc_connected?: boolean;
  headline?: string | null;
  last_run: {
    at: string;
    summary: SeoRunNums;
    degraded: string[];
    todo_count: number;
    topic_count: number;
  } | null;
}

export interface SeoOverview {
  sources: { gsc: boolean; serp: boolean };
  brands: SeoBrandCard[];
}

export type SeoTodoStatus = "todo" | "assigned" | "done";

export interface SeoTodo {
  id: string;
  kind: string;
  page: string;
  query: string;
  action: string;
  why: string;
  est_monthly_clicks: number | null;
  position: number;
  impressions: number | null;
  status: SeoTodoStatus;
}

export interface SeoTopic {
  keyword: string;
  source: string;
  priority: "high" | "medium" | "low";
  impact: string;
  angle: string;
  volume_est: number | null;
  volume_label: string;
  trend: "rising" | "falling" | "flat" | "new";
  difficulty: string | null;
  est_monthly_clicks: number | null;
  why: string;
  score: number;
  /** Search intent (e.g. "informational", "commercial") — absent on old persisted runs. */
  intent?: string;
  /** True when this topic was excluded from the live Top-10 to avoid cannibalizing an existing page. */
  avoided?: boolean;
  /** Why this topic was avoided, e.g. "overlaps https://example.com/page" — null/absent when not avoided. */
  avoided_reason?: string | null;
}

export interface SeoGaTotals {
  sessions: number;
  users: number;
  new_users: number;
  engagement_rate: number;
  avg_session_sec: number;
  pageviews: number;
}

/** Live Google Analytics (GA4) overview — null when GA isn't shared with the service account. */
export interface SeoGa {
  property: string;
  property_name: string;
  totals: SeoGaTotals;
  prev_totals: SeoGaTotals;
  top_pages: { path: string; views: number; sessions: number }[];
  channels: { channel: string; sessions: number; prev_sessions: number }[];
  key_events: { event: string; count: number }[];
}

export interface SeoRun {
  brand_id: string;
  at: string;
  trigger: string;
  degraded: string[];
  summary: SeoRunNums;
  insights: string[];
  todos: SeoTodo[];
  topics: SeoTopic[];
  ga?: SeoGa | null;
}

export const seoOverview = () => getJson<SeoOverview>("/api/seo-geo/overview");

export interface SeoGscStatus {
  connected: boolean;
  property: string | null;
}

export interface SeoSiteIssue {
  insight: string;
  evidence: string;
  action: string;
  priority: "high" | "medium" | "low";
  category: "content" | "structure" | "trust" | "other";
}

export interface SeoSiteReview {
  at: string;
  page_count: number;
  positioning: string;
  scorecard?: Record<string, { grade: number; note: string }>;
  strengths: string[];
  issues: SeoSiteIssue[];
  suggested_seeds: string[];
  covered_topics: string[];
  missing_topics: string[];
  degraded: string[];
}

export interface SeoPlanItem {
  source: string;
  action: string;
  detail: string;
}

export const seoBrandDetail = (id: string) =>
  getJson<{
    brand: SeoBrand;
    run: SeoRun | null;
    gsc?: SeoGscStatus;
    plan?: SeoPlanItem[];
    site_review?: SeoSiteReview | null;
  }>(`/api/seo-geo/brands/${id}`);

export const seoAnalyzeSite = (brandId: string) =>
  postJson<SeoSiteReview>(`/api/seo-geo/site-review/${brandId}`, {});

export const seoOauthStart = (brandId: string) =>
  getJson<{ url: string }>(`/api/seo-geo/oauth/start/${brandId}`);

export const seoOauthDisconnect = (brandId: string) =>
  postJson<{ connected: boolean }>(`/api/seo-geo/oauth/disconnect/${brandId}`, {});

export const seoRunBrand = (id: string) =>
  postJson<{ at: string; summary: SeoRunNums; degraded: string[]; todo_count: number; topic_count: number }>(
    `/api/seo-geo/run/${id}`,
    {},
  );

export const seoSaveBrand = (b: { id?: string; name: string; domain: string; gsc_property?: string; seeds?: string[] }) =>
  postJson<{ brands: SeoBrand[] }>("/api/seo-geo/brands", b);

export async function seoDeleteBrand(id: string): Promise<{ brands: SeoBrand[] }> {
  const response = await request(`/api/seo-geo/brands/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { brands: SeoBrand[] };
}

export const seoSetTodoStatus = (brandId: string, todoId: string, status: SeoTodoStatus) =>
  postJson<{ id: string; status: SeoTodoStatus }>(`/api/seo-geo/todos/${brandId}/${todoId}`, { status });

/* ------------------------ SEO agent: researcher layer --------------------- */

export interface SeoCluster {
  name: string;
  intent: "informational" | "commercial" | "transactional" | "navigational" | "local";
  keywords: string[];
  volume_est: number;
  best_position: number | null;
  coverage: "gap" | "weak" | "ranking";
  opportunity: number;
  tier: "high" | "medium" | "watch";
  recommendation: string;
  owned_by?: string[];
  aio_present?: boolean;
}

export interface SeoKeywordLab {
  brand_id: string;
  at: string;
  keyword_count: number;
  degraded: string[];
  clusters: SeoCluster[];
  gaps: string[];
}

export interface SeoRankShift {
  keyword: string;
  position: number | null;
  previous: number | null;
  delta: number | null;
  top: string[];
}

export interface SeoSitemapEntry {
  at: string;
  total: number;
  new_urls: string[];
  new_count: number;
  first_check: boolean;
}

export interface SeoCompetitors {
  tracked: string[];
  suggested: string[];
  shifts: SeoRankShift[];
  feed: Record<string, SeoSitemapEntry>;
}

export interface SeoBrief {
  id: string;
  keyword: string;
  at: string;
  intent: string;
  target_keywords: string[];
  outline: { heading: string; note: string }[];
  questions: string[];
  entities: string[];
  target_word_count: number;
  schema_recommended: string[];
  internal_links: string[];
  who_ranks: { domain: string; title: string; position: number }[];
  our_position: number | null;
  aio_present: boolean;
  degraded: string[];
}

export interface SeoAuditIssue {
  issue: string;
  severity: "high" | "medium" | "low";
  count: number;
  pages: string[];
  fix: string;
}

export interface SeoSiteCheck {
  name: string;
  ok: boolean;
  note: string;
  fix: string;
}

export interface SeoAuditReport {
  brand_id: string;
  at: string;
  pages_checked: number;
  pages_ok: number;
  health_score: number;
  site_checks?: SeoSiteCheck[];
  issues: SeoAuditIssue[];
}

export interface SeoDraftScore {
  score: number;
  verdict: "publish-ready" | "needs work" | "rework";
  keyword: string;
  word_count: number;
  checks: { name: string; ok: boolean; note: string; weight: number }[];
}

export interface SeoUpdatePlan {
  page: string;
  at: string;
  query: string;
  our_position: number | null;
  suggestions: string[];
}

export const seoKeywordLab = (brandId: string) =>
  getJson<{ lab: SeoKeywordLab | null }>(`/api/seo-geo/keywords/${brandId}`);

export const seoRunKeywordLab = (brandId: string) =>
  postJson<SeoKeywordLab>(`/api/seo-geo/keywords/${brandId}/run`, {});

export const seoCompetitors = (brandId: string) =>
  getJson<SeoCompetitors>(`/api/seo-geo/competitors/${brandId}`);

export async function seoSetCompetitors(brandId: string, domains: string[]): Promise<{ tracked: string[] }> {
  const response = await request(`/api/seo-geo/competitors/${brandId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domains }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { tracked: string[] };
}

export const seoTrackCompetitors = (brandId: string) =>
  postJson<{ shifts: SeoRankShift[]; feed: Record<string, SeoSitemapEntry>; degraded: string[] }>(
    `/api/seo-geo/competitors/${brandId}/track`,
    {},
  );

/** Top-5 competitor profiles: visibility, keywords they beat us on, and a
 *  content feed with honestly labelled reach estimates (never a bare number). */
export interface SeoCompetitorPost {
  url: string;
  title: string;
  topic: string;
  est_monthly_clicks: number | null;
  estimate_basis: string;
}

export interface SeoCompetitorProfile {
  domain: string;
  /** Null when there are no tracked keywords to compute visibility from —
   *  distinct from a real 0%; render "—" (matches avg_position's pattern). */
  visibility_pct: number | null;
  avg_position: number | null;
  keywords_won: { keyword: string; their_position: number; our_position: number | null }[];
  recent_posts: SeoCompetitorPost[];
  hot_topics: string[];
}

export interface SeoCompetitorProfilesDoc {
  at: string;
  notes: string[];
  profiles: SeoCompetitorProfile[];
}

export const seoCompetitorProfiles = (brandId: string) =>
  getJson<{ profiles: SeoCompetitorProfilesDoc | null }>(`/api/seo-geo/competitors/${brandId}/profiles`);

export const seoCompetitorProfilesRefresh = (brandId: string) =>
  postJson<SeoCompetitorProfilesDoc>(`/api/seo-geo/competitors/${brandId}/profiles/refresh`, {});

export const seoBriefs = (brandId: string) =>
  getJson<{ briefs: SeoBrief[] }>(`/api/seo-geo/briefs/${brandId}`);

export const seoBuildBrief = (brandId: string, keyword: string) =>
  postJson<SeoBrief>(`/api/seo-geo/briefs/${brandId}`, { keyword });

export const seoAuditReport = (brandId: string) =>
  getJson<{ report: SeoAuditReport | null }>(`/api/seo-geo/audit/${brandId}`);

export const seoRunAudit = (brandId: string) =>
  postJson<SeoAuditReport>(`/api/seo-geo/audit/${brandId}/run`, {});

export const seoDraftScore = (brandId: string, text: string, keyword: string) =>
  postJson<SeoDraftScore>(`/api/seo-geo/draft-score/${brandId}`, { text, keyword });

export const seoUpdatePlan = (brandId: string, page: string) =>
  postJson<SeoUpdatePlan>(`/api/seo-geo/update-plan/${brandId}`, { page });

export const seoAsk = (brandId: string, question: string) =>
  postJson<{ question: string; answer: string }>(`/api/seo-geo/ask/${brandId}`, { question });

/* ---------------------------------------------------------------- blog writer (a9) */

export interface BwCounts {
  sitemap_urls: number;
  blog_urls: number;
  titled: number;
}

export interface BwBrand {
  id: string;
  name: string;
  domain: string;
  inventory: { counts: BwCounts; scanned: string } | null;
  voice: { studied: string; count: number } | null;
}

export interface BwVoice {
  brand_id: string;
  studied: string;
  posts_read: string[];
  count: number;
  profile: Record<string, string | string[]>;
}

export interface BwInventory {
  domain: string;
  scanned: string;
  posts: { url: string; title: string }[];
  counts: BwCounts;
  notes: string[];
}

export interface BwEvidence {
  id: string;
  claim: string;
  quote: string;
  url: string;
  source_name: string;
  source_class: "studies" | "experts" | "news" | "anecdotes" | "competitors" | string;
  date: string;
  credibility: string;
}

export interface BwRound {
  n: number;
  at: string;
  queries: { angle: string; q: string; hits: number }[];
  read: string[];
  added: number;
  gaps: string[];
}

export interface BwBlock {
  id: string;
  kind: "intro" | "section" | "conclusion" | string;
  heading: string;
  text: string;
  cites: string[];
  history: string[];
  last_comment?: string;
}

export interface BwDraft {
  meta: { title: string; description: string; slug: string };
  blocks: BwBlock[];
  internal_links: { url: string; title: string }[];
  notes: string[];
  /** True once the house writing guidelines line-edit has run on every block. */
  guidelines_applied?: boolean;
}

export interface BwVisual {
  n: number;
  section: string;
  type: string;
  theme: string;
  prompt: string;
  rationale: string;
}

export interface BwRunSummary {
  id: string;
  brand_id: string;
  brand_name: string;
  topic: string;
  created: string;
  status: string;
}

export interface BwRun {
  id: string;
  brand_id: string;
  brand_name: string;
  domain: string;
  topic: string;
  notes: string;
  created: string;
  status: "research" | "saturated" | "capped";
  rounds: BwRound[];
  ledger: BwEvidence[];
  gaps: string[];
  draft: BwDraft | null;
  visuals: { items: BwVisual[]; notes: string[] } | null;
}

export type BwExportFormat = "md" | "html" | "txt" | "visuals-md" | "visuals-txt";

export const bwBrands = () => getJson<{ brands: BwBrand[] }>("/api/blog/brands");

export const bwInventory = (brandId: string) => getJson<BwInventory>(`/api/blog/brands/${brandId}/inventory`);

export const bwScanInventory = (brandId: string) => postJson<BwInventory>(`/api/blog/brands/${brandId}/inventory`, {});

export const bwVoice = (brandId: string) => getJson<BwVoice>(`/api/blog/brands/${brandId}/voice`);

export const bwStudyVoice = (brandId: string) => postJson<BwVoice>(`/api/blog/brands/${brandId}/voice`, {});

export const bwRuns = () => getJson<{ runs: BwRunSummary[] }>("/api/blog/runs");

export const bwRun = (id: string) => getJson<BwRun>(`/api/blog/runs/${id}`);

export const bwCreateRun = (p: { brand_id: string; topic: string; notes?: string }) =>
  postJson<BwRun>("/api/blog/runs", p);

export const bwResearchStep = (id: string) => postJson<BwRun>(`/api/blog/runs/${id}/research/step`, {});

export const bwBuildDraft = (id: string) => postJson<BwRun>(`/api/blog/runs/${id}/draft`, {});

export const bwCommentBlock = (id: string, blockId: string, comment: string) =>
  postJson<BwRun>(`/api/blog/runs/${id}/blocks/${blockId}/comment`, { comment });

export const bwPlanVisuals = (id: string) => postJson<BwRun>(`/api/blog/runs/${id}/visuals`, {});

export async function bwExport(id: string, format: BwExportFormat): Promise<Blob> {
  const response = await request(`/api/blog/runs/${id}/export?format=${format}`, { method: "GET" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.blob();
}

/* --------------------------- SEO agent: Pages ------------------------------ */
// Per-page traffic + crawl intel: where analytics and the site crawl disagree,
// what's underperforming, and what to do about each page.

export interface SeoPageIntel {
  path: string;
  /** Null for pages known only from GA/GSC — never crawled into the corpus
   *  (see the "not-crawled" flag), so there's no on-page fact to source these from. */
  url: string | null;
  title: string | null;
  views: number;
  sessions: number;
  engagement_rate: number;
  clicks: number;
  impressions: number;
  position: number | null;
  best_query: string | null;
  /** Beyond content/structure/trust flags, "not-crawled" = seen in analytics but
   *  absent from the site crawl; its recommendation explains why. */
  flags: string[];
  recommendation: string;
  /** True only when THIS page's recommendation came from the AI pass (top-traffic
   *  slice + successful call). Older persisted docs lack the field — falsy is the
   *  honest default ("Rule:"), never assume AI wrote it. */
  ai?: boolean;
  word_count: number;
}

export interface SeoPagesDoc {
  brand_id: string;
  at: string;
  ai: boolean;
  notes: string[];
  pages: SeoPageIntel[];
}

export const seoPages = (id: string) =>
  getJson<{ pages: SeoPagesDoc | null }>(`/api/seo-geo/pages/${id}`);

export const seoPagesRefresh = (id: string) =>
  postJson<SeoPagesDoc>(`/api/seo-geo/pages/${id}/refresh`, {});

/* ---- GEO agent (a10): AI answer visibility ---- */

export type GeoEngineId = "perplexity" | "gemini" | "chatgpt";

export interface GeoGlobalConfig {
  engines: Record<GeoEngineId, boolean>;
  default_runs: number;
  default_daily_cap: number;
}

export interface GeoBrandRow {
  id: string;
  name: string;
  domain: string;
  prompts: number;
  recent_answers: number;
  calls_used_today: number;
  competitors: number;
}

export interface GeoPrompt {
  id: string;
  text: string;
  intent: "brand" | "category" | "problem";
  stage: "awareness" | "consideration" | "purchase";
  enabled: boolean;
}

export interface GeoCompetitor {
  key: string;
  name: string;
  aliases: string[];
}

export interface GeoBrandConfig {
  brand_id: string;
  aliases: Record<string, string[]>;
  competitors: GeoCompetitor[];
  daily_cap: number;
}

export interface GeoPollProgress {
  done: number;
  total: number;
  calls_used_today: number;
  daily_cap: number;
  capped: boolean;
  engines: string[];
  date: string;
}

export interface GeoMentionStats {
  rate: number | null;
  stdev: number | null;
  n_prompts: number;
  n_answers: number;
}

export interface GeoMetricBlock {
  mention: GeoMentionStats;
  sov: {
    share: Record<string, number | null>;
    credit: Record<string, number>;
    unclaimed_answers: number;
    n_answers: number;
  };
  citation: { rate: number | null; n_answers_with_citations: number; cited_answers: number };
  source_mix: { domain: string; count: number; share: number }[];
  n_answers: number;
  n_errors: number;
}

export interface GeoPromptRollup {
  prompt_id: string;
  text: string;
  intent: string;
  n: number;
  self_rate: number;
  cited_rate: number;
  rivals: { key: string; count: number }[];
  engines_hit: string[];
}

export interface GeoReport {
  brand_id: string;
  days: number;
  blended: GeoMetricBlock;
  engines: Record<string, GeoMetricBlock>;
  source_gap: { domain: string; count: number; example_prompt_ids: string[] }[];
  competitors: Record<string, GeoMentionStats>;
  competitor_names: Record<string, string>;
  prompt_rollup?: GeoPromptRollup[];
}

export interface GeoAnswer {
  engine: string;
  model: string;
  text: string;
  citations: { url: string; domain: string; title: string }[];
  latency_ms: number;
  error: string | null;
  prompt_id: string;
  prompt_text: string;
  intent: string;
  run: number;
  at: string;
  mentions?: Record<string, number>;
  brand_mentioned?: boolean;
  brand_position?: number | null;
  brand_cited?: boolean;
  sentiment?: "positive" | "neutral" | "negative" | null;
}

export const geoConfig = () => getJson<GeoGlobalConfig>("/api/geo/config");

export const geoBrands = () => getJson<{ brands: GeoBrandRow[] }>("/api/geo/brands");

export const geoPrompts = (brandId: string) =>
  getJson<{ brand_id: string; prompts: GeoPrompt[] }>(`/api/geo/brands/${brandId}/prompts`);

export const geoGeneratePrompts = (brandId: string) =>
  postJson<{ brand_id: string; prompts: GeoPrompt[] }>(
    `/api/geo/brands/${brandId}/prompts/generate`, {},
  );

export async function geoSavePrompts(brandId: string, prompts: GeoPrompt[]): Promise<{ prompts: GeoPrompt[] }> {
  const response = await request(`/api/geo/brands/${brandId}/prompts`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompts }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { prompts: GeoPrompt[] };
}

export const geoBrandConfig = (brandId: string) =>
  getJson<GeoBrandConfig>(`/api/geo/brands/${brandId}/config`);

export async function geoSaveBrandConfig(
  brandId: string,
  patch: Partial<Pick<GeoBrandConfig, "aliases" | "competitors" | "daily_cap">>,
): Promise<GeoBrandConfig> {
  const response = await request(`/api/geo/brands/${brandId}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as GeoBrandConfig;
}

export const geoPollStep = (
  brandId: string,
  body: { engines?: string[]; runs?: number; batch_size?: number } = {},
) => postJson<GeoPollProgress>(`/api/geo/brands/${brandId}/poll/step`, body);

export const geoReport = (brandId: string, days = 7) =>
  getJson<GeoReport>(`/api/geo/brands/${brandId}/report?days=${days}`);

export const geoAnswers = (brandId: string, opts: { prompt_id?: string; engine?: string; days?: number } = {}) => {
  const p = new URLSearchParams();
  if (opts.prompt_id) p.set("prompt_id", opts.prompt_id);
  if (opts.engine) p.set("engine", opts.engine);
  if (opts.days) p.set("days", String(opts.days));
  const qs = p.toString();
  return getJson<{ answers: GeoAnswer[]; total: number }>(
    `/api/geo/brands/${brandId}/answers${qs ? `?${qs}` : ""}`,
  );
};

/* ------------- GEO Content Optimizer (a10, Layers 1-6) ------------------- */

export interface OptimizerGap { kind: string; priority: number; message: string }

export interface OptimizerTermEntry {
  term: string;
  display: string;
  importance: number;
  prevalence: number;
  range: [number, number];
  confidence: string;
  brand?: boolean;
}

export interface OptimizerSubtopicCoverage {
  label: string;
  covered: boolean;
  best_sim: number;
  evidence: string;
}

export interface OptimizerBand {
  feature: string;
  n: number;
  kind: string;
  lo?: number | null;
  hi?: number | null;
  median?: number | null;
  modes?: number[] | null;
  confidence: string;
  note: string;
}

export interface OptimizerReport {
  total: number;
  term_coverage: number;
  semantic_coverage: number | null;
  structure_fit: number;
  stuffing_penalty: number;
  winners_median: number | null;
  degraded: string[];
  gaps: OptimizerGap[];
  draft_features: Record<string, number>;
  subtopic_coverage: OptimizerSubtopicCoverage[];
  draft_term_counts: Record<string, number>;
}

export interface OptimizerAnalysis {
  meta: {
    analysis_id: string;
    keyword: string;
    locale: string;
    created_at: string;
    n_docs: number;
    article_share: number;
    warnings: string[];
    degraded: string[];
    volatility: string;
    aio_present: boolean;
    paa: string[];
  };
  results: { rank: number; url: string; title: string; page_type: string; excluded: string; flags: string[] }[];
  term_profile: OptimizerTermEntry[];
  subtopics: { label: string; suggested_heading: string; doc_idxs: number[] }[];
  structure_bands: Record<string, OptimizerBand>;
  winners_median_score: number | null;
  last_report?: OptimizerReport;
  disclaimer: string;
}

export interface OptimizerIndexRow {
  id: string;
  keyword: string;
  locale: string;
  created_at: string;
  n_docs: number;
  score: number | null;
}

export const geoOptimizerAnalyze = (body: {
  keyword: string; locale?: string; draft?: string; own_domain?: string; vertical?: string;
}) => postJson<OptimizerAnalysis>("/api/geo/optimizer/analyze", body);

export const geoOptimizerRescore = (analysisId: string, draft: string) =>
  postJson<OptimizerReport>("/api/geo/optimizer/rescore", { analysis_id: analysisId, draft });

export const geoOptimizerAnalyses = () =>
  getJson<{ analyses: OptimizerIndexRow[] }>("/api/geo/optimizer/analyses");

export const geoOptimizerAnalysis = (id: string) =>
  getJson<OptimizerAnalysis>(`/api/geo/optimizer/analyses/${id}`);

/* ---------------------- Browser Agent (a11) ------------------------------ */

export interface BrowserRunRow {
  id: string;
  goal: string;
  mode: "act" | "monitor";
  status: string;
  steps_used: number;
  step_cap: number;
  user: string;
  created_at: string;
  updated_at: string;
  summary?: string;
}

export interface BrowserSubtask {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  edge_cases: { risk: string; handle: string }[];
  done_when: string;
  status: "pending" | "done";
}

export interface BrowserPlan {
  subtasks: BrowserSubtask[];
  notes: string;
  planned: boolean;
  plan_error?: string;
}

export interface BrowserStep {
  seq: number;
  at: string;
  sensitive: boolean;
  /** The model was shown a screenshot for this step. */
  saw_page?: boolean;
  /** Which sub-task of the plan this step belongs to. */
  subtask?: string;
  action: { kind: string; why?: string; url?: string; summary?: string; reason?: string };
  result: { ok: boolean; error?: string | null } | null;
}

export interface BrowserRun extends BrowserRunRow {
  steps: BrowserStep[];
  findings: string[];
  fail_reason?: string;
  extracted?: unknown;
  plan?: BrowserPlan;
}

export interface BrowserStatus {
  ok: boolean;
  email: string;
  protocol: number;
  step_cap: number;
  allowed: string[];
  blocked: string[];
  can_download: boolean;
  extension_version: string;
}

export const browserStatus = () => getJson<BrowserStatus>("/api/browser/status");

/**
 * Fetch the extension bundle as a blob — the endpoint needs the Bearer token,
 * so a plain <a href> would just get a 401.
 */
export async function browserExtensionBlob(): Promise<Blob> {
  const response = await request("/api/browser/extension");
  if (!response.ok) throw new Error(await parseError(response));
  return await response.blob();
}

export const browserRuns = () => getJson<{ runs: BrowserRunRow[] }>("/api/browser/runs");

export const browserRun = (runId: string) =>
  getJson<BrowserRun>(`/api/browser/runs/${runId}`);

export const browserStopRun = (runId: string) =>
  postJson<{ status: string }>(`/api/browser/runs/${runId}/stop`, {});

/**
 * Pairing code for the Chrome extension: base64 of the backend URL + the JWT
 * already held by this session. The extension stores it locally; nothing is
 * baked into the extension build.
 */
export function browserPairingCode(token: string, email?: string): string {
  return btoa(JSON.stringify({ backend_url: API_URL, token, email }));
}

export interface BrowserWatchRule {
  id?: string;
  text: string;
  enabled: boolean;
}

export interface BrowserDigestRow {
  id: string;
  at: string;
  headline: string;
  pages_seen: number;
  alerts: number;
}

export interface BrowserDigest {
  id: string;
  at: string;
  headline: string;
  themes: { title: string; detail: string }[];
  open_loops: string[];
  alerts: { rule: string; count: number; pages: { title: string; url: string }[] }[];
  pages_seen: number;
  tabs_open: number;
}

export const browserDigests = () =>
  getJson<{ digests: BrowserDigestRow[] }>("/api/browser/digests");

export const browserDigest = (id: string) =>
  getJson<BrowserDigest>(`/api/browser/digests/${id}`);

export const browserConfig = () =>
  getJson<{ watch_rules: BrowserWatchRule[] }>("/api/browser/config");

export async function browserSaveConfig(
  watchRules: BrowserWatchRule[],
): Promise<{ watch_rules: BrowserWatchRule[] }> {
  const response = await request("/api/browser/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watch_rules: watchRules }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as { watch_rules: BrowserWatchRule[] };
}

