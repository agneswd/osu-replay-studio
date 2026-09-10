export const thumbnailFonts = ["baloo", "fredoka", "montserrat"] as const;
export type ThumbnailFont = (typeof thumbnailFonts)[number];
export const thumbnailFontFamily: Record<ThumbnailFont, string> = {
  baloo: '"Baloo 2", "Montserrat", sans-serif',
  fredoka: '"Fredoka", "Montserrat", sans-serif',
  montserrat: '"Montserrat", sans-serif',
};
export interface ThumbnailShadow { x: number; y: number; blur: number; color: string }
export interface ThumbnailLayer {
  x?: number;
  y?: number;
  scale?: number;
  z?: number;
  hidden?: boolean;
  text?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: ThumbnailFont;
  glow?: { color: string; blur: number } | null;
  borderWidth?: number;
  borderRadius?: number;
  borderMode?: "all" | "bottom";
  shadow?: ThumbnailShadow | null;
  gradient?: { from: string; to: string } | null;
}
export interface ThumbnailDocument {
  version: 1;
  template: "reference" | "cute";
  width: 1280 | 1920 | 2560 | 3840;
  accent: string;
  twitch: boolean;
  classic: boolean;
  status: "auto" | "fc" | "counts";
  misses?: number;
  sliderBreaks?: number;
  layers: Record<string, ThumbnailLayer>;
  customTexts: string[];
  accentRange?: { start: number; end: number };
  overlayOpacity?: number;
  dropShadow?: ThumbnailShadow | null;
}
export const defaultThumbnail = (accent = "#d4d7de"): ThumbnailDocument => ({ version: 1, template: "reference", width: 1280, accent, twitch: false, classic: true, status: "auto", layers: {}, customTexts: [] });

function validateShadow(shadow: ThumbnailShadow, message: string) {
  if (!Number.isFinite(shadow.x) || !Number.isFinite(shadow.y) || !Number.isFinite(shadow.blur) || shadow.blur < 0 || shadow.blur > 80 || !/^#[\da-f]{6}$/i.test(shadow.color) || Math.abs(shadow.x) > 80 || Math.abs(shadow.y) > 80)
    throw new Error(message);
}

export function validateThumbnailDocument(value: ThumbnailDocument) {
  if (!value || value.version !== 1 || !["reference", "cute"].includes(value.template) || ![1280, 1920, 2560, 3840].includes(value.width) ||
      !/^#[\da-f]{6}$/i.test(value.accent) || typeof value.twitch !== "boolean" || typeof value.classic !== "boolean" || !["auto", "fc", "counts"].includes(value.status) ||
      !value.layers || typeof value.layers !== "object" || Object.keys(value.layers).length > 100 || !Array.isArray(value.customTexts) || value.customTexts.length > 30 ||
      value.customTexts.some(id => typeof id !== "string" || !/^custom-[\w-]+$/.test(id)) || new Set(value.customTexts).size !== value.customTexts.length)
    throw new Error("Invalid thumbnail document.");
  for (const count of [value.misses, value.sliderBreaks]) if (count !== undefined && (!Number.isInteger(count) || count < 0 || count > 100000)) throw new Error("Invalid thumbnail hit count.");
  for (const [id, layer] of Object.entries(value.layers)) {
    if (!/^[\w-]{1,80}$/.test(id) || !layer || typeof layer !== "object") throw new Error("Invalid thumbnail layer.");
    for (const [key, min, max] of [["x", -8000, 8000], ["y", -8000, 8000], ["scale", .1, 10], ["z", 0, 1000], ["fontSize", 8, 600]] as const) {
      const n = layer[key];
      if (n !== undefined && (!Number.isFinite(n) || n < min || n > max)) throw new Error("Invalid thumbnail geometry.");
    }
    if (layer.glow !== undefined && layer.glow !== null && (!/^#[\da-f]{6}$/i.test(layer.glow.color) || !Number.isFinite(layer.glow.blur) || layer.glow.blur < 0 || layer.glow.blur > 100)) throw new Error("Invalid text glow.");
    if (layer.fontWeight !== undefined && ![400, 600, 700].includes(layer.fontWeight)) throw new Error("Invalid thumbnail font weight.");
    if (layer.fontFamily !== undefined && !thumbnailFonts.includes(layer.fontFamily)) throw new Error("Invalid thumbnail font.");
    if (layer.borderWidth !== undefined && (!Number.isFinite(layer.borderWidth) || layer.borderWidth < 0 || layer.borderWidth > 40)) throw new Error("Invalid thumbnail border.");
    if (layer.borderRadius !== undefined && (!Number.isFinite(layer.borderRadius) || layer.borderRadius < 0 || layer.borderRadius > 400)) throw new Error("Invalid thumbnail radius.");
    if (layer.borderMode !== undefined && layer.borderMode !== "all" && layer.borderMode !== "bottom") throw new Error("Invalid thumbnail border mode.");
    if (layer.shadow) validateShadow(layer.shadow, "Invalid thumbnail shadow.");
    if (layer.gradient && (!/^#[\da-f]{6}$/i.test(layer.gradient.from) || !/^#[\da-f]{6}$/i.test(layer.gradient.to))) throw new Error("Invalid thumbnail gradient.");
    if (layer.hidden !== undefined && typeof layer.hidden !== "boolean") throw new Error("Invalid thumbnail visibility.");
    if (layer.text !== undefined && (typeof layer.text !== "string" || layer.text.length > 500 || /[\r\n]/.test(layer.text))) throw new Error("Thumbnail text must be one line with at most 500 characters.");
    if (layer.color !== undefined && !/^#[\da-f]{6}$/i.test(layer.color)) throw new Error("Invalid thumbnail color.");
  }
  if (value.overlayOpacity !== undefined && (!Number.isFinite(value.overlayOpacity) || value.overlayOpacity < 0 || value.overlayOpacity > 1)) throw new Error("Invalid overlay opacity.");
  if (value.dropShadow) validateShadow(value.dropShadow, "Invalid thumbnail drop shadow.");
  const range = value.accentRange;
  if (range && (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > (value.layers["bottom-message"]?.text?.length ?? 0))) throw new Error("Invalid highlighted text selection.");
}
