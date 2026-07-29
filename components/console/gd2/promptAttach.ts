/** Client-side mirror of the backend's /subject/upload?role=prompt rules
 *  (routers/graphics_designer.py MAX_PROMPT_IMAGES + upload validation) so the
 *  entry screen can reject bad files instantly. Keep in sync with the backend. */

export const MAX_PROMPT_IMAGES = 3;
export const PROMPT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PROMPT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type AttachReason = "limit" | "type" | "size";
export type AttachVerdict = { ok: true } | { ok: false; reason: AttachReason };

export function canAttach(
  current: number,
  file: { type: string; size: number },
): AttachVerdict {
  if (current >= MAX_PROMPT_IMAGES) return { ok: false, reason: "limit" };
  if (!PROMPT_IMAGE_TYPES.includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > PROMPT_IMAGE_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

export function attachErrorMessage(name: string, reason: AttachReason): string {
  if (reason === "limit") return `Max ${MAX_PROMPT_IMAGES} images per creative.`;
  if (reason === "type") return `${name}: only PNG, JPEG or WebP images.`;
  return `${name}: over 10 MB — please attach a smaller image.`;
}
