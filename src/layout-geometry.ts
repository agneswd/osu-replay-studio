import { normalizeLayout, type VideoLayout } from "../core/layout.js";
import type { OverlayId } from "../core/types.js";

export type LayoutElement = OverlayId | "playfield";
export interface LayoutBox { x: number; y: number; w: number; h: number }
export type Corner = "nw" | "ne" | "sw" | "se";

export function editingGroup(id: LayoutElement): LayoutElement {
  return id === "accuracy-counter" ? "player-info" : id === "hit-counts" ? "hit-error-bar" : id;
}
export function groupMembers(id: LayoutElement): OverlayId[] {
  switch (editingGroup(id)) {
    case "player-info": return ["player-info", "accuracy-counter"];
    case "hit-error-bar": return ["hit-counts", "hit-error-bar"];
    case "playfield": return [];
    default: return [id as OverlayId];
  }
}

// Bounds are local to the element's layout origin. Playfield coordinates use its center.
export function placedBox(layout: VideoLayout, id: LayoutElement, box: LayoutBox): LayoutBox {
  const item = id === "playfield" ? layout.playfield : layout.overlays[id];
  return { x: item.x + box.x * item.scale, y: item.y + box.y * item.scale, w: box.w * item.scale, h: box.h * item.scale };
}

export function moveElement(layout: VideoLayout, id: LayoutElement, dx: number, dy: number): VideoLayout {
  const next = structuredClone(layout);
  const items = id === "playfield" ? [next.playfield] : groupMembers(id).map(member => next.overlays[member]);
  const minX = id === "playfield" ? 0 : -1920, minY = id === "playfield" ? 0 : -1080;
  dx = Math.max(...items.map(item => minX - item.x), Math.min(dx, ...items.map(item => 1920 - item.x)));
  dy = Math.max(...items.map(item => minY - item.y), Math.min(dy, ...items.map(item => 1080 - item.y)));
  for (const item of items) { item.x += dx; item.y += dy; }
  return normalizeLayout(next);
}

// Keep the opposite corner fixed, including internal padding and right-aligned counters.
export function resizeElement(layout: VideoLayout, id: LayoutElement, box: LayoutBox, corner: Corner, dx: number, dy: number): VideoLayout {
  const next = structuredClone(layout), item = id === "playfield" ? next.playfield : next.overlays[id];
  const sx = corner.endsWith("e") ? 1 : -1, sy = corner.startsWith("s") ? 1 : -1;
  const members = groupMembers(id);
  const minScale = id === "playfield" ? .1 : Math.max(...members.map(member => .25 * item.scale / layout.overlays[member].scale));
  const maxScale = id === "playfield" ? 2 : Math.min(...members.map(member => 3 * item.scale / layout.overlays[member].scale));
  const scale = Math.max(minScale, Math.min(maxScale,
    item.scale + (sx * dx * box.w + sy * dy * box.h) / (box.w ** 2 + box.h ** 2)));
  const anchorX = box.x + (sx < 0 ? box.w : 0), anchorY = box.y + (sy < 0 ? box.h : 0);
  const worldX = item.x + anchorX * item.scale, worldY = item.y + anchorY * item.scale;
  let factor = scale / item.scale;
  const items = id === "playfield" ? [item] : members.map(member => next.overlays[member]);
  for (const member of items) {
    for (const [value, anchor, min, max] of [[member.x, worldX, id === "playfield" ? 0 : -1920, 1920], [member.y, worldY, id === "playfield" ? 0 : -1080, 1080]]) {
      const delta = value - anchor;
      if (!delta) continue;
      const a = (min - anchor) / delta, b = (max - anchor) / delta;
      factor = Math.max(Math.min(a, b), Math.min(factor, Math.max(a, b)));
    }
  }
  for (const member of items) {
    member.x = worldX + (member.x - worldX) * factor;
    member.y = worldY + (member.y - worldY) * factor;
    member.scale *= factor;
  }
  return normalizeLayout(next);
}
