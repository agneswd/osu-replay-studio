import type { ThumbnailLayer } from "../core/thumbnail-document.js";
export interface ThumbnailBox { x: number; y: number; w: number; h: number }

// Keep the opposite visual corner fixed, including a layer's internal transform.
export function resizeThumbnailLayer(layer: ThumbnailLayer, box: ThumbnailBox, origin: { x: number; y: number }, corner: "nw" | "ne" | "sw" | "se", dx: number, dy: number): ThumbnailLayer {
  const sx = corner.endsWith("e") ? 1 : -1, sy = corner.startsWith("s") ? 1 : -1;
  const startScale = layer.scale ?? 1;
  const scale = Math.max(.1, Math.min(10, startScale * (1 + (sx * dx * box.w + sy * dy * box.h) / (box.w ** 2 + box.h ** 2))));
  let ratio = scale / startScale;
  const anchorX = box.x + (sx < 0 ? box.w : 0), anchorY = box.y + (sy < 0 ? box.h : 0);
  for (const [position, delta] of [[layer.x ?? 0, anchorX - origin.x], [layer.y ?? 0, anchorY - origin.y]]) {
    if (!delta) continue;
    const a = 1 + (position - 8000) / delta, b = 1 + (position + 8000) / delta;
    ratio = Math.max(Math.min(a, b), Math.min(ratio, Math.max(a, b)));
  }
  return { scale: startScale * ratio, x: (layer.x ?? 0) + (anchorX - origin.x) * (1 - ratio), y: (layer.y ?? 0) + (anchorY - origin.y) * (1 - ratio) };
}
