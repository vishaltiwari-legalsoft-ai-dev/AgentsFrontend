export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const pxToFrac = (px: number, total: number): number =>
  total > 0 ? clamp01(px / total) : 0;

/** Emoji char → asset filename under /emoji/apple/ (must match the backend's
 *  _char_to_codepoints: lowercase hex codepoints, fe0f stripped, dash-joined). */
export const emojiFile = (char: string): string =>
  Array.from(char)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((h) => h !== "fe0f")
    .join("-") + ".png";
