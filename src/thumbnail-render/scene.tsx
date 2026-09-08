import { useLayoutEffect, useMemo, useRef } from "react";
import type { Timeline } from "../../core/types.js";
import type { ThumbnailDocument } from "../../core/thumbnail-document.js";
import { thumbnailData } from "./data.js";
import { Thumbnail } from "./thumbnail/Thumbnail.js";
import { referenceTemplate } from "./thumbnail/templates/reference/template.js";
import { cuteTemplate } from "./thumbnail/templates/cute/template.js";
import { applyOverrides, type EditorState } from "./thumbnail/overrides.js";
import { TextLayer } from "./thumbnail/components/Text/TextLayer.js";
import "./style.css";

export const textKeys: Record<string, string> = { "status-miss": "status", "bottom-message": "bottom-text" };
export const textLayers = new Set(["status", "status-miss", "status-sb", "star-rating", "pp", "combo", "difficulty", "bpm", "map-title", "map-artist", "grade", "accuracy", "leaderboard", "username", "bottom-message"]);
export const layerName = (id: string) => ({ "status": "Status", "status-miss": "Miss count", "status-sb": "Slider breaks", "pp": "PP", "badge-row": "Combo, difficulty and BPM", "top-panel": "Top panel", "star-notch": "Star panel", "mod-list": "Mods", "bottom-message": "Bottom text", "twitch-logo": "Twitch logo" }[id] ?? (id.startsWith("custom-") ? "Custom text" : id.replace(/-/g, " ").replace(/^./, c => c.toUpperCase())));

export function ThumbnailScene({ timeline, value, scale = 1 }: { timeline: Timeline; value: ThumbnailDocument; scale?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const source = useMemo(() => thumbnailData(timeline), [timeline]);
  const data = { ...source, mods: source.mods.filter(m => value.classic || m.acronym !== "CL") };
  if (value.status !== "auto") {
    data.missCount = value.status === "fc" ? 0 : value.misses ?? source.missCount;
    data.sbCount = value.status === "fc" ? 0 : value.sliderBreaks ?? source.sbCount;
    data.status = value.status === "fc" ? { kind: "fc" } : data.missCount ? { kind: "miss", count: data.missCount } : { kind: "unknown" };
    data.isFullCombo = value.status === "fc";
  }
  const overrides: EditorState = { accent: value.accent, twitchVisible: value.twitch, textOverrides: {}, colorOverrides: {}, fontSizeOverrides: {} };
  for (const [id, layer] of Object.entries(value.layers)) {
    if (layer.text !== undefined) overrides.textOverrides![textKeys[id] ?? id] = layer.text;
    if (layer.color) overrides.colorOverrides![id] = layer.color;
    if (layer.fontSize) overrides.fontSizeOverrides![id] = layer.fontSize;
  }
  const template = applyOverrides(value.template === "cute" ? cuteTemplate : referenceTemplate, overrides);
  useLayoutEffect(() => {
    for (const element of Array.from(root.current?.querySelectorAll<HTMLElement>("[data-layer]") ?? [])) {
      const patch = value.layers[element.dataset.layer!] ?? {};
      element.style.translate = `${patch.x ?? 0}px ${patch.y ?? 0}px`;
      element.style.scale = String(patch.scale ?? 1);
      element.style.transformOrigin = "top left";
      element.style.zIndex = patch.z === undefined ? "" : String(patch.z);
      element.style.visibility = patch.hidden ? "hidden" : "";

    }
  }, [value, template]);
  return <div ref={root} className="thumbnail-scene" style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
    <Thumbnail data={data} template={template} accentRange={value.accentRange} />
    {value.customTexts.map(id => <TextLayer key={id} testId={id} config={{ visible: true, x: 420, y: 320, width: 500, maxWidth: 500, fontSize: value.layers[id]?.fontSize ?? 54, glow: value.layers[id]?.glow ?? undefined, fontWeight: 700, fontFamily: '"Baloo 2", sans-serif', color: value.layers[id]?.color ?? "#ffffff" }}>{value.layers[id]?.text ?? "Your text"}</TextLayer>)}
  </div>;
}
