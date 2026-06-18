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
  const response = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
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

export interface UsageResponse {
  days: number;
  scope: "me" | "all";
  per_agent: UsageAgent[];
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
    element_styles?: Record<string, GdElementStyle>;
    subheadings?: GdSubheading[];
    logo_layout?: GdLogoLayout;
    custom_gradient?: GdCustomGradient | null;
    custom_element?: GdCustomElement | null;
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
  size_pct?: number;
  offset_x?: number;
  offset_y?: number;
}

// One Stage-3 sub-heading line (the dynamic 1–5 list, replacing the old fixed
// subtext1/subtext2). Each line is independently styled, placed and approved.
export interface GdSubheading {
  text: string;
  font?: string;
  color?: string;
  size_pct?: number;
  placement?: string;
  offset_x?: number;
  offset_y?: number;
  approved?: boolean;
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

export interface GdConfig {
  stage1_variants: GdVariant[];
  stage2_variants: GdVariant[];
  stage2_categories: string[];
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

export const gdGetConfig = () => getJson<GdConfig>("/api/gd/config");

export const gdGetPrompts = () =>
  getJson<{ prompts: { filename: string; hash: string; expected: string; ok: boolean; bytes: number }[] }>(
    "/api/gd/prompts",
  );

export const gdCreateRun = (brandId?: string | null) =>
  postJson<GdRun>("/api/gd/runs", { brand_id: brandId ?? null });

export const gdGetRun = (id: string) => getJson<GdRun>(`/api/gd/runs/${id}`);

export const gdUpdateConfig = (
  id: string,
  body: {
    font?: string;
    aspect_ratio?: string;
    text_placement?: string;
    cta_placement?: string;
    element_styles?: Record<string, GdElementStyle>;
    subheadings?: GdSubheading[];
    logo_layout?: Partial<GdLogoLayout>;
    custom_gradient?: GdCustomGradient | null;
    custom_element?: GdCustomElement | null;
    use_ai_compositor?: boolean;
    tokens?: Record<string, string>;
    token_approvals?: Record<string, { approved: boolean; source?: string; original_suggestion?: string }>;
  },
) => postJson<GdRun>(`/api/gd/runs/${id}/config`, body);

export const gdGenerate = (id: string, stage: number, variant?: string) =>
  postJson<{ attempt: GdAttempt; run: GdRun }>(`/api/gd/runs/${id}/generate`, { stage, variant });

export const gdApprove = (id: string, stage: number, attempt?: number) =>
  postJson<GdRun>(`/api/gd/runs/${id}/approve`, { stage, attempt });

export const gdBack = (id: string, stage: number) =>
  postJson<GdRun>(`/api/gd/runs/${id}/back`, { stage });

export const gdPromptPreview = (id: string, stage: number, variant: string) =>
  getJson<GdPromptBuild>(`/api/gd/runs/${id}/prompt?stage=${stage}&variant=${encodeURIComponent(variant)}`);

export const gdSuggest = (id: string, body: Record<string, unknown>) =>
  postJson<Record<string, unknown>>(`/api/gd/runs/${id}/suggest`, body);

export async function gdStage4(
  id: string,
  logo: File,
  useAi: boolean,
): Promise<{ attempt: GdAttempt; run: GdRun }> {
  const form = new FormData();
  form.append("logo", logo);
  form.append("use_ai", String(useAi));
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
