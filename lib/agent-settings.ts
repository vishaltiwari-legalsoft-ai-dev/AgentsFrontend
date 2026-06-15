export interface ImageModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  recommended?: boolean;
}

export interface AgentSettingOption {
  id: string;
  name: string;
  description: string;
  default?: boolean;
}

export interface AgentSettingsConfig {
  agent_id: string;
  agent_name: string;
  image_models: ImageModelOption[];
  abilities: AgentSettingOption[];
  tools: AgentSettingOption[];
  defaults: AgentSettingsValues;
}

export interface AgentSettingsValues {
  image_model: string;
  enabled_tools: string[];
  enabled_abilities: string[];
}

const STORAGE_KEY = "graphic-designer-agent-settings";

export function loadAgentSettings(fallback: AgentSettingsValues): AgentSettingsValues {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as AgentSettingsValues;
    return {
      image_model: parsed.image_model || fallback.image_model,
      enabled_tools: Array.isArray(parsed.enabled_tools) ? parsed.enabled_tools : fallback.enabled_tools,
      enabled_abilities: Array.isArray(parsed.enabled_abilities)
        ? parsed.enabled_abilities
        : fallback.enabled_abilities,
    };
  } catch {
    return fallback;
  }
}

export function saveAgentSettings(values: AgentSettingsValues): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

export function toggleListItem(list: string[], id: string, on: boolean): string[] {
  if (on) return list.includes(id) ? list : [...list, id];
  return list.filter((item) => item !== id);
}

/** Client fallback when /api/agent/settings is unavailable. */
export function defaultAgentSettingsConfig(): AgentSettingsConfig {
  const defaults: AgentSettingsValues = {
    image_model: "google/gemini-3-pro-image-preview",
    enabled_tools: ["brand_kit", "web_search", "file_attachments", "logo_composite", "canva_export"],
    enabled_abilities: ["generate_creatives", "analyze_brand", "brief_intake"],
  };
  return {
    agent_id: "a1",
    agent_name: "Graphic Designer",
    image_models: [
      {
        id: "google/gemini-3-pro-image-preview",
        name: "Gemini 3 Pro Image",
        provider: "Google",
        description: "Best for on-brand creatives with logo and kit references.",
        recommended: true,
      },
      {
        id: "google/gemini-2.5-flash-image",
        name: "Gemini 2.5 Flash Image",
        provider: "Google",
        description: "Fast image generation with text and image output.",
      },
      {
        id: "black-forest-labs/flux.2-max",
        name: "Flux 2 Max",
        provider: "Black Forest Labs",
        description: "High-quality scenes and backgrounds.",
      },
      {
        id: "black-forest-labs/flux.2-pro",
        name: "Flux 2 Pro",
        provider: "Black Forest Labs",
        description: "Professional-grade image generation.",
      },
      {
        id: "openai/gpt-5-image",
        name: "GPT-5 Image",
        provider: "OpenAI",
        description: "OpenAI image generation with strong prompt following.",
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        provider: "OpenAI",
        description: "Multimodal model with image output support.",
      },
      {
        id: "recraft/recraft-v3",
        name: "Recraft V3",
        provider: "Recraft",
        description: "Vector-style graphics and brand visuals.",
      },
    ],
    abilities: [
      {
        id: "generate_creatives",
        name: "Generate creatives",
        description: "Create banners, flyers, social posts, and on-brand artwork.",
      },
      {
        id: "analyze_brand",
        name: "Analyze brand kit",
        description: "Explore brand colors, fonts, and the creative gallery.",
      },
      {
        id: "brief_intake",
        name: "Brief intake",
        description: "Ask clarifying questions before generating.",
      },
    ],
    tools: [
      {
        id: "brand_kit",
        name: "Brand kit",
        description: "Load logos, colors, and style references from your library.",
        default: true,
      },
      {
        id: "web_search",
        name: "Web search",
        description: "Research brand context to auto-fill brief gaps.",
        default: true,
      },
      {
        id: "file_attachments",
        name: "File attachments",
        description: "Read text from PDF, DOCX, and image uploads.",
        default: true,
      },
      {
        id: "logo_composite",
        name: "Logo compositing",
        description: "Overlay the exact brand logo onto generated creatives.",
        default: true,
      },
      {
        id: "canva_export",
        name: "Canva export",
        description: "Send finished creatives to Canva for editing.",
        default: true,
      },
    ],
    defaults,
  };
}
