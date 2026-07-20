export type AgentCategory = "design" | "seo" | "copy" | "social" | "ads" | "data";

export interface AgentItem {
  id: string;
  name: string;
  role: string;
  category: AgentCategory;
  glyph: string;
  description: string;
}

/** Graphic Designer — the first agent wired to the live backend. */
export const LIVE_AGENT_ID = "a1";
/** Marketing Research agent (backed by /api/mr). Uses the "Market Researcher" slot. */
export const MARKETING_AGENT_ID = "a6";
/** SEO + GEO agent (backed by /api/seo). */
export const SEO_AGENT_ID = "a2";

/** Agents wired to a live backend, mapped to the console nav key they open. */
export const LIVE_AGENTS: Record<string, string> = {
  [LIVE_AGENT_ID]: "studio",
  [MARKETING_AGENT_ID]: "marketing",
  [SEO_AGENT_ID]: "seo",
};

export function isAgentLive(id: string): boolean {
  return id in LIVE_AGENTS;
}

/** Agents temporarily paused — "On hold" badge on the card, not openable.
 * Value is the toast shown if someone tries. Takes precedence over LIVE_AGENTS. */
export const ON_HOLD_AGENTS: Record<string, string> = {
  [SEO_AGENT_ID]: "SEO Analyst is on hold for now.",
};

export function isAgentOnHold(id: string): boolean {
  return id in ON_HOLD_AGENTS;
}

export interface TeamMember {
  name: string;
  category: AgentCategory;
}

export interface TeamItem {
  id: string;
  name: string;
  status: "idle" | "running" | "success" | "paused";
  lastRun: string;
  deployed: boolean;
  description: string;
  members: TeamMember[];
  comingSoon?: boolean;
  /** Glyph file in /public/glyph and the gradient tint for its app-tile. */
  glyph?: string;
  tint?: AgentCategory;
}

export interface RunStep {
  t: string;
  agent: string;
  cat: AgentCategory;
  msg: string;
  status: "idle" | "running" | "success";
}

export const agents: AgentItem[] = [
  { id: "a1", name: "Graphic Designer", role: "Brand & visual assets", category: "design", glyph: "palette", description: "Produces on-brand graphics, social creatives, and ad variants from a brief." },
  { id: "a2", name: "SEO Analyst", role: "Search & rankings", category: "seo", glyph: "search", description: "Audits pages, finds keyword gaps, and writes optimization briefs." },
  { id: "a3", name: "Copywriter", role: "Words that convert", category: "copy", glyph: "pen-line", description: "Drafts landing copy, emails, and posts in your brand voice." },
  { id: "a4", name: "Social Scheduler", role: "Posts & calendars", category: "social", glyph: "megaphone", description: "Plans and queues content across channels at the best times." },
  { id: "a5", name: "Ads Optimizer", role: "Paid performance", category: "ads", glyph: "target", description: "Tunes budgets, bids, and creatives to hit your CPA target." },
  { id: "a6", name: "Marketing Research", role: "Campaigns, competitors & funnel", category: "data", glyph: "bar-chart-3", description: "Aggregates campaign performance, tracks competitors, analyzes the lead funnel, and surfaces media opportunities." },
  { id: "a7", name: "Email Marketer", role: "Lifecycle & nurture", category: "copy", glyph: "mail", description: "Builds sequences and writes nurture flows that re-engage leads." },
  { id: "a8", name: "Brand Strategist", role: "Positioning & messaging", category: "design", glyph: "compass", description: "Shapes positioning, tone, and messaging pillars for campaigns." },
];

export const graphicDesignerAgent = agents.find((a) => a.id === LIVE_AGENT_ID)!;

export const teams: TeamItem[] = [
  {
    id: "t1",
    name: "Campaign Manager",
    glyph: "ads",
    tint: "ads",
    status: "paused",
    lastRun: "—",
    deployed: false,
    comingSoon: true,
    description: "Plans, drafts, and schedules a full campaign across channels.",
    members: [
      { name: "Brand Strategist", category: "design" },
      { name: "Copywriter", category: "copy" },
      { name: "Graphic Designer", category: "design" },
      { name: "Social Scheduler", category: "social" },
      { name: "Ads Optimizer", category: "ads" },
    ],
  },
  {
    id: "t2",
    name: "Outbound Reach",
    glyph: "social",
    tint: "social",
    status: "paused",
    lastRun: "—",
    deployed: false,
    comingSoon: true,
    description: "Researches prospects and runs personalized multi-touch outreach.",
    members: [
      { name: "Market Researcher", category: "data" },
      { name: "Copywriter", category: "copy" },
      { name: "Email Marketer", category: "copy" },
    ],
  },
  {
    id: "t3",
    name: "Content Engine",
    glyph: "copy",
    tint: "copy",
    status: "paused",
    lastRun: "—",
    deployed: false,
    comingSoon: true,
    description: "A steady stream of SEO-driven articles, edited and published.",
    members: [
      { name: "SEO Analyst", category: "seo" },
      { name: "Copywriter", category: "copy" },
      { name: "Graphic Designer", category: "design" },
      { name: "Social Scheduler", category: "social" },
    ],
  },
  {
    id: "t4",
    name: "Launch Squad",
    glyph: "rocket",
    tint: "design",
    status: "paused",
    lastRun: "—",
    deployed: false,
    comingSoon: true,
    description: "Coordinates a product launch from teaser to announcement.",
    members: [
      { name: "Brand Strategist", category: "design" },
      { name: "Graphic Designer", category: "design" },
      { name: "Ads Optimizer", category: "ads" },
      { name: "Email Marketer", category: "copy" },
    ],
  },
];

export const runSteps: RunStep[] = [
  { t: "14:02:31", agent: "Brand Strategist", cat: "design", msg: "Defined 3 messaging pillars", status: "success" },
  { t: "14:03:08", agent: "Market Researcher", cat: "data", msg: "Summarized 12 competitor campaigns", status: "success" },
  { t: "14:05:44", agent: "Copywriter", cat: "copy", msg: "Drafted 8 post variants + 2 emails", status: "success" },
  { t: "14:07:12", agent: "Graphic Designer", cat: "design", msg: "Rendering 6 creatives…", status: "running" },
  { t: "—", agent: "Social Scheduler", cat: "social", msg: "Queue posts to calendar", status: "idle" },
  { t: "—", agent: "Ads Optimizer", cat: "ads", msg: "Set budgets & launch", status: "idle" },
];
