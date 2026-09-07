export interface ThumbnailLayer {
  x?: number;
  y?: number;
  scale?: number;
  z?: number;
  hidden?: boolean;
  text?: string;
  color?: string;
  fontSize?: number;
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
}
export const defaultThumbnail = (accent = "#d4d7de"): ThumbnailDocument => ({ version: 1, template: "reference", width: 1280, accent, twitch: false, classic: true, status: "auto", layers: {}, customTexts: [] });

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
    if (layer.hidden !== undefined && typeof layer.hidden !== "boolean") throw new Error("Invalid thumbnail visibility.");
    if (layer.text !== undefined && (typeof layer.text !== "string" || layer.text.length > 500 || /[\r\n]/.test(layer.text))) throw new Error("Thumbnail text must be one line with at most 500 characters.");
    if (layer.color !== undefined && !/^#[\da-f]{6}$/i.test(layer.color)) throw new Error("Invalid thumbnail color.");
  }
  const range = value.accentRange;
  if (range && (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > (value.layers["bottom-message"]?.text?.length ?? 0))) throw new Error("Invalid highlighted text selection.");
}
