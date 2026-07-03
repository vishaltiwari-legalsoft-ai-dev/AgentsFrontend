/**
 * Recolor a monochrome SVG/PNG to `fill` by drawing it into an offscreen
 * canvas and compositing a solid fill with `source-in` (keeps the fill only
 * where the source image was opaque). This replaces CanvasEditor.tsx's DOM
 * CSS-mask tint (`WebkitMaskImage`/`maskImage` + `background: el.fill`) for
 * the "icon" element kind, since Konva renders to a <canvas> and has no CSS
 * mask equivalent — this produces the same visual result (icon silhouette
 * recolored to `fill`) via pixel compositing instead.
 */
export function tintedCanvas(img: HTMLImageElement, fill: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 64;
  c.height = img.naturalHeight || 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}
