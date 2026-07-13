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

export interface GeneratedImage {
  url: string;
  mime_type: string;
}

export interface LogoRef {
  file_name: string;
  view_url: string;
}

/** Brand persona built from the brand's website (auto-research step). */
export interface BrandPersona {
  tone_of_voice?: string;
  target_audience?: string;
  color_palette?: string;
  typography?: string;
  visual_direction?: string;
  visual_language?: string;
  key_selling_points?: string;
}

export const PERSONA_FIELDS: { key: keyof BrandPersona; label: string }[] = [
  { key: "tone_of_voice", label: "Tone of voice" },
  { key: "target_audience", label: "Target audience" },
  { key: "color_palette", label: "Color palette" },
  { key: "typography", label: "Typography" },
  { key: "visual_direction", label: "Visual direction" },
  { key: "visual_language", label: "Visual language (from site imagery)" },
  { key: "key_selling_points", label: "Key selling points" },
];

export interface AspectRatioOption {
  ratio: string;
  label: string;
}

export interface AssetsResult {
  type: "assets";
  brand: string | null;
  category: string;
  creative_type?: string;
  aspect_ratio?: string | null;
  master_prompt: string;
  brand_profile?: string | null;
  brand_website?: string | null;
  persona?: BrandPersona;
  assets: { with_logo: GeneratedImage; with_placeholder: GeneratedImage };
  logo: LogoRef | null;
  logos?: LogoRef[];
  canva: { configured: boolean; import_url: string | null };
}

export interface BrandMetadata {
  primary_colors?: string[];
  fonts?: string[];
  tone_of_voice?: string;
  [key: string]: unknown;
}

export interface GalleryItem {
  file_name: string;
  file_type: string;
  view_url: string;
  is_image: boolean;
}

export interface BrandAnalysisResult {
  type: "brand_analysis";
  brand: { id: string; brand_name: string; brand_metadata: BrandMetadata };
  creative_count: number;
  summary: string;
  gallery: GalleryItem[];
}

export interface MessageResult {
  type: "message";
  text: string;
}

export interface IntakeResult {
  type: "intake";
  text: string;
  missing_fields: string[];
  suggestions: {
    aspect_ratio?: string | null;
    brief?: string | null;
  };
  aspect_ratios?: AspectRatioOption[];
  brand?: string | null;
  brand_website?: string | null;
  persona?: BrandPersona;
  logo?: LogoRef | null;
  logos?: LogoRef[];
  logos_found?: number;
  style_refs_loaded?: number;
}

export type AgentResult = AssetsResult | BrandAnalysisResult | MessageResult | IntakeResult;

export interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  attachments?: string[];
  result?: AgentResult;
  created_at?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface LibraryBrand {
  id: string;
  brand_name: string;
  creative_count: number;
  creatives: GalleryItem[];
}

export interface BrandSummary {
  id: string;
  brand_name: string;
  brand_metadata?: BrandMetadata;
}

export interface BrandKit {
  brand_name: string;
  colors: string[];
  fonts: string[];
  tone_of_voice?: string | null;
  logo_url?: string | null;
}

export async function listBrands(): Promise<BrandSummary[]> {
  const data = await getJson<{ brands: BrandSummary[] }>("/api/brands");
  return data.brands;
}

export async function getBrandKit(brandId: string): Promise<BrandKit> {
  return getJson<BrandKit>(`/api/brands/${brandId}/kit`);
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

/* --------------------------------- Agent --------------------------------- */

export interface AgentResponse {
  conversation_id: string;
  result: AgentResult;
}

export interface AgentSettingsConfigResponse {
  agent_id: string;
  agent_name: string;
  image_models: {
    id: string;
    name: string;
    provider: string;
    description: string;
    recommended?: boolean;
  }[];
  abilities: { id: string; name: string; description: string }[];
  tools: { id: string; name: string; description: string; default?: boolean }[];
  defaults: {
    image_model: string;
    enabled_tools: string[];
    enabled_abilities: string[];
  };
}

export async function getAgentSettings(): Promise<AgentSettingsConfigResponse> {
  return getJson<AgentSettingsConfigResponse>("/api/agent/settings");
}

export async function runAgent(
  message: string,
  files: File[] = [],
  conversationId?: string | null,
  brandId?: string | null,
  logo?: File | null,
  settings?: {
    image_model: string;
    enabled_tools: string[];
    enabled_abilities: string[];
  },
): Promise<AgentResponse> {
  const form = new FormData();
  form.append("message", message);
  if (conversationId) form.append("conversation_id", conversationId);
  if (brandId) form.append("brand_id", brandId);
  if (settings) {
    form.append("image_model", settings.image_model);
    form.append("enabled_tools", JSON.stringify(settings.enabled_tools));
    form.append("enabled_abilities", JSON.stringify(settings.enabled_abilities));
  }
  for (const file of files) form.append("files", file);
  if (logo) form.append("logo", logo);

  const response = await request("/api/agent", { method: "POST", body: form });
  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as { conversation_id: string } & AgentResult;
  const { conversation_id, ...result } = data;
  return { conversation_id, result: result as AgentResult };
}

export async function importToCanva(
  imageUrl: string,
  name: string,
): Promise<{ ok: true } | { ok: false; needsAuth: boolean; error: string }> {
  const response = await request("/api/canva/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, name }),
  });
  if (response.ok) return { ok: true };
  return {
    ok: false,
    needsAuth: response.status === 401,
    error: await parseError(response),
  };
}

/* ------------------------------ Library / data --------------------------- */

export async function loadLibrary(perBrand = 24): Promise<LibraryBrand[]> {
  const data = await getJson<{ brands: LibraryBrand[] }>(
    `/api/library?per_brand=${perBrand}`,
  );
  return data.brands;
}

/* ------------------------------ Conversations ---------------------------- */

export async function listConversations(): Promise<ConversationSummary[]> {
  const data = await getJson<{ conversations: ConversationSummary[] }>(
    "/api/conversations",
  );
  return data.conversations;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const data = await getJson<{ conversation: ConversationDetail }>(
    `/api/conversations/${id}`,
  );
  return data.conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await request(`/api/conversations/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
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
  // Curated model choices, keyed by runtime-config field, for dropdowns.
  catalog: Record<AgentModelField, ModelOption[]>;
}

export interface AdminSettingsPatch {
  openrouter_api_key?: string;
  openrouter_model?: string;
  openrouter_fast_model?: string;
  openrouter_image_model?: string;
  openrouter_vision_model?: string;
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
}

export interface DbCollectionsResponse {
  collections: DbCollection[];
  connected: boolean;
  database: string;
  project: string;
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

/* ----------------------------- Usage dashboard --------------------------- */
/* Per-user (or creator all-users) activity for the Home panel.               */

export interface UsageAgent {
  agent_id: string;
  name: string;
  role: string;
  category: string;
  live: boolean;
  sessions: number;
  creatives: number;
}

export interface UsageDay {
  day: string;
  creatives: number;
  sessions: number;
}

export interface UsageUser {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  sessions: number;
  creatives: number;
  agents_used: number;
}

export interface UsageResponse {
  days: number;
  scope: "me" | "all";
  per_agent: UsageAgent[];
  per_user: UsageUser[];
  daily: UsageDay[];
  totals: { sessions: number; creatives: number; active_days: number };
}

export function getUsage(days = 30, scope: "me" | "all" = "me"): Promise<UsageResponse> {
  return getJson<UsageResponse>(`/api/usage?days=${days}&scope=${scope}`);
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
  description: string;
  recommended?: boolean;
}

/** A model field that can be overridden per agent (matches backend slugs). */
export type AgentModelField =
  | "openrouter_model"
  | "openrouter_fast_model"
  | "openrouter_image_model"
  | "openrouter_vision_model";

export interface AgentConfigItem {
  id: string;
  name: string;
  role: string;
  category: string;
  live: boolean;
  /** Explicit per-agent choice ("" = inherit the global default). */
  overrides: Record<AgentModelField, string>;
  /** What the agent actually uses right now (agent → global → env). */
  effective: Record<AgentModelField, string>;
}

export interface AgentConfigResponse {
  agents: AgentConfigItem[];
  fields: AgentModelField[];
  catalog: Record<AgentModelField, ModelOption[]>;
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

export interface GdPromptBuild {
  text: string;
  diffs: GdDiff[];
  warnings: string[];
  negative_prompt: string | null;
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

export const gdGetPrompts = (brand?: string | null) =>
  getJson<{ prompts: { filename: string; hash: string; expected: string; ok: boolean; bytes: number }[] }>(
    `/api/gd/prompts${_brandQuery(brand)}`,
  );

export const gdCreateRun = (
  brandId?: string | null,
  init?: { aspect_ratio?: string; creative_type?: string; creative_brief?: Record<string, string>; remix_enabled?: boolean },
) => postJson<GdRun>("/api/gd/runs", { brand_id: brandId ?? null, ...(init ?? {}) });

/* ---------------- Brand Reference Library (ingestion + retrieval) --------- */
// Test/debug surface so a human can SEE which reference creatives the agent
// picks up for a given brand + creative type + brief. Backed by /api/ref-library.

export interface RefCreativeType {
  key: string;
  label: string;
  aspect_ratio: string;
  orientation: string;
  multi_frame: boolean;
  notes: string;
}

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

export const gdRefTypes = () =>
  getJson<{ types: RefCreativeType[] }>("/api/ref-library/types");

export const gdRefIngest = (useLlm = false) =>
  postJson<{ ingested: number; source: string; by_brand: Record<string, Record<string, number>> }>(
    `/api/ref-library/ingest?use_llm=${useLlm}`,
    {},
  );

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

/** Reference images need the Bearer header, so fetch as a blob and hand back an
 *  object URL (callers should revoke it on unmount). */
export async function gdRefAssetBlob(recordId: string): Promise<string> {
  const response = await request(`/api/ref-library/asset/${encodeURIComponent(recordId)}`);
  if (!response.ok) throw new Error(await parseError(response));
  return URL.createObjectURL(await response.blob());
}

export const gdRefRetrieve = (
  brief: string,
  brand?: string | null,
  type?: string | null,
  k = 5,
) => {
  const p = new URLSearchParams();
  if (brief) p.set("brief", brief);
  if (brand) p.set("brand", brand);
  if (type) p.set("type", type);
  p.set("k", String(k));
  return getJson<{ count: number; results: RefRecord[]; prompt_block: string }>(
    `/api/ref-library/retrieve?${p.toString()}`,
  );
};

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

export const gdBack = (id: string, stage: number) =>
  postJson<GdRun>(`/api/gd/runs/${id}/back`, { stage });

export const gdPromptPreview = (id: string, stage: number, variant: string) =>
  getJson<GdPromptBuild>(`/api/gd/runs/${id}/prompt?stage=${stage}&variant=${encodeURIComponent(variant)}`);

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
}

export const gdPlan = (id: string, brief: string) =>
  postJson<{ plan: GdPlan; run: GdRun }>(`/api/gd/runs/${id}/plan`, { brief });

/** Whether the run's brand has a logo on file (so Stage 4 can skip the upload). */
export interface GdBrandLogo {
  available: boolean;
  view_url: string | null;
  file_name: string | null;
  brand_name: string | null;
}

export const gdBrandLogo = (id: string) =>
  getJson<GdBrandLogo>(`/api/gd/runs/${id}/brand-logo`);

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

/** Upload an image to use as the Stage-2 SUBJECT or BACKGROUND (composite mode). Accepts
 *  PNG/WebP/JPEG; the backend normalizes to PNG. Store the returned `ref` via
 *  gdUpdateConfig({ subject_asset_ref }) or gdUpdateConfig({ background_asset_ref }) and generate Stage 2 with variant
 *  "UPLOAD" — a deterministic Pillow composite, no image model involved. The `role` param defaults to "subject"
 *  and can be overridden to "background" for multi-layer compositing. */
export async function gdSubjectUpload(
  runId: string,
  file: File,
  role: "subject" | "background" = "subject",
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
export interface MrInsight { level: "good" | "warn" | "info"; text: string }
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

export const mrWorkbook = () => getJson<{ tabs: MrTabProfile[]; count: number }>("/api/mr/workbook");

export const mrWorkbookScan = () =>
  postJson<{ tabs: MrTabProfile[]; count: number }>("/api/mr/workbook/scan", {});

export const mrAsk = (question: string, timeframe?: string) =>
  postJson<MrAskAnswer>("/api/mr/ask", { question, timeframe });

export const mrBuildReport = (kind: MrReportKind) =>
  postJson<MrReport>(`/api/mr/reports/${kind}`, {});

export const mrListRuns = () => getJson<MrRunSummary[]>("/api/mr/runs");

export const mrGetRun = (id: string) => getJson<MrReport>(`/api/mr/runs/${id}`);

export const mrSchedule = (period: "daily" | "weekly" | "biweekly" | "monthly") =>
  postJson<MrReport>(`/api/mr/schedule/${period}`, {});
