/* Pure display helpers for the MR console.
   Kept free of JSX so the logic that uses them stays unit-testable — tsconfig
   runs jsx: "preserve", so vitest cannot import a .tsx module. */

export const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString()}`;
export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString();
export const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

export const fmtMonth = (ym: string | null) =>
  ym ? new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "long", year: "numeric" }) : "";

export function sourceLabel(platform: string): { src: string; tab: string } {
  if (platform?.startsWith("sheets:")) return { src: "Google Sheets", tab: platform.slice(7) };
  if (platform?.startsWith("pdf:")) return { src: "PDF upload", tab: platform.slice(4) };
  const map: Record<string, string> = { google_ads: "Google Ads", meta: "META Ads", hubspot: "HubSpot" };
  return { src: `${map[platform] ?? platform} · CSV upload`, tab: "" };
}

/** Split narrative into summary + trailing "Recommend:" line (strips md noise). */
export function readNarrative(markdown: string): { summary: string; recommend: string } {
  let body = (markdown || "").replace(/^#\s.*\n+/, "").replace(/\*\*/g, "").trim();
  body = body.replace(/^\[[a-z_]+\]\s*\(offline summary\)\s*/i, "").trim();
  const m = body.match(/recommend:\s*(.*)$/is);
  if (m) return { summary: body.slice(0, m.index).trim(), recommend: m[1].trim() };
  return { summary: body, recommend: "" };
}

export const splitAnswer = readNarrative; // ask answers share the same shape

export function verdict(reds: number, warns: number): { cls: string; label: string } {
  if (reds > 0) return { cls: "bad", label: `${reds} red flag${reds === 1 ? "" : "s"}` };
  if (warns > 0) return { cls: "warn", label: "Watch" };
  return { cls: "good", label: "On track" };
}
