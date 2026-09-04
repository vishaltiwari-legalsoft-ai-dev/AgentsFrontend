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

/** Whether to offer the Disconnect button on one connected sheet.
 *
 *  `GET /mr/sources` now answers `can_remove` per row, and
 *  `DELETE /mr/sources/{id}` answers **403** when it is false — you may
 *  disconnect a sheet you connected, an admin or creator may disconnect any,
 *  and nobody may disconnect the primary tracker. A button offered outside
 *  that is a button that only earns an error.
 *
 *  `whenUnknown` is the deploy-skew answer, and it is the load-bearing part.
 *  Vercel ships in about a minute and Cloud Run in four to six, so this code
 *  runs against the previous backend for a window every time — and a previous
 *  console outage came from exactly that, new frontend code reading a field the
 *  backend had not started sending. Absent must therefore mean "this backend
 *  has no opinion", not "no":
 *
 *  - Reading absence as `false` hides every button on every row for minutes,
 *    including the admin's — a working control silently disappears.
 *  - Reading absence as `true` unconditionally would be the permissive default
 *    that the 403 exists to remove.
 *
 *  So absence falls back to whatever the caller offered the button on before —
 *  the panel's own role check — which is safe because the field and the 403
 *  shipped in the same commit: a reply with no `can_remove` came from a backend
 *  with no gate, where that button worked. Nothing new can 403, nothing that
 *  worked disappears, and the moment the field arrives the server's answer
 *  wins outright. */
export function mayDisconnect(
  source: { primary?: boolean; can_remove?: boolean },
  opts: { whenUnknown: boolean },
): boolean {
  if (source.primary) return false;
  if (typeof source.can_remove === "boolean") return source.can_remove;
  return opts.whenUnknown;
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
