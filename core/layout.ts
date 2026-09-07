import { overlayIds, type OverlayId } from "./types.js";

export interface ElementLayout {
  x: number;
  y: number;
  scale: number;
  z: number;
}
export interface VideoLayout {
  playfield: { x: number; y: number; scale: number };
  overlays: Record<OverlayId, ElementLayout>;
}
// Overlay positions are top-left coordinates on the 1920 x 1080 design canvas.
export const overlayBounds: Record<OverlayId, readonly [number, number, number, number, number]> = {
  "health-bar": [400, 15.75, 1280, 72, .875],
  "player-info": [400, 14, 1280, 120, .875],
  "pp-counter": [1166, 1008, 380, 60, 1],
  "accuracy-counter": [1362.5, 42.875, 180, 38, .875],
  "combo-counter": [404, 1008, 350, 60, 1],
  "hit-counts": [768, 976, 384, 52, 1],
  "hit-error-bar": [768, 976, 384, 98, 1],
  leaderboard: [4, 434, 365, 414, 1],
  "key-overlay": [1694, 394, 226, 110, 1],
  "progress-graph": [8, 214, 300, 206, 1],
};
export const defaultLayout = (): VideoLayout => ({
  playfield: { x: 960, y: 540, scale: 1 },
  overlays: Object.fromEntries(Object.entries(overlayBounds).map(([id, [x, y]], z) => [id, { x, y, scale: 1, z }])) as VideoLayout["overlays"],
});
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

// Recover old or damaged settings without passing invalid transforms to either renderer.
export function normalizeLayout(value: unknown): VideoLayout {
  const result = defaultLayout(), input = record(value), playfield = record(input.playfield), overlays = record(input.overlays);
  result.playfield = {
    x: bounded(playfield.x, 960, 0, 1920), y: bounded(playfield.y, 540, 0, 1080),
    scale: bounded(playfield.scale, 1, .1, 2),
  };
  for (const id of overlayIds) {
    const item = record(overlays[id]), base = result.overlays[id];
    result.overlays[id] = {
      x: bounded(item.x, base.x, -1920, 1920), y: bounded(item.y, base.y, -1080, 1080),
      scale: bounded(item.scale, 1, .25, 3), z: Math.round(bounded(item.z, base.z, 0, 99)),
    };
  }
  return result;
}
export function validateLayout(value: unknown): void {
  if (value === undefined) return;
  const normalized = normalizeLayout(value), input = record(value);
  const same = (actual: unknown, expected: object) => {
    const fields = record(actual);
    return Object.entries(expected).every(([key, v]) => fields[key] === v);
  };
  if (!same(input.playfield, normalized.playfield) || !overlayIds.every(id => same(record(input.overlays)[id], normalized.overlays[id])))
    throw new Error("Invalid video layout. Reset the layout or use the supported coordinate and scale ranges.");
}
export function danserPlayfield(layout?: VideoLayout) {
  const { x, y, scale } = normalizeLayout(layout).playfield;
  // Danser maps one osu! pixel to 2.25 design pixels, then applies playfield scale.
  return { Scale: scale, ShiftX: (x - 960) / (2.25 * scale), ShiftY: (y - 540) / (2.25 * scale),
    OsuShift: false, ScaleStoryboardWithPlayfield: false, MoveStoryboardWithPlayfield: false };
}
