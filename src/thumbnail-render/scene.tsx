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
  const filters = useRef(new WeakMap<HTMLElement, { base: string; applied: string }>());
  const source = useMemo(() => thumbnailData(timeline), [timeline]);
  const data = { ...source, mods: source.mods.filter(m => value.classic || m.acronym !== "CL") };
  if (value.status !== "auto") {
    data.missCount = value.status === "fc" ? 0 : value.misses ?? source.missCount;
    data.sbCount = value.status === "fc" ? 0 : value.sliderBreaks ?? source.sbCount;
    data.status = value.status === "fc" ? { kind: "fc" } : data.missCount ? { kind: "miss", count: data.missCount } : { kind: "unknown" };
    data.isFullCombo = value.status === "fc";
  }
  const overrides: EditorState = {
    accent: value.accent, twitchVisible: value.twitch, textOverrides: {}, colorOverrides: {}, fontSizeOverrides: {},
    overlayOpacity: value.overlayOpacity, dropShadow: value.dropShadow, layers: value.layers,
  };
  for (const [id, layer] of Object.entries(value.layers)) {
    if (id.startsWith("custom-")) continue;
    if (layer.text !== undefined) overrides.textOverrides![textKeys[id] ?? id] = layer.text;
    if (layer.color) overrides.colorOverrides![id] = layer.color;
    if (layer.fontSize) overrides.fontSizeOverrides![id] = layer.fontSize;
  }
  const template = applyOverrides(value.template === "cute" ? cuteTemplate : referenceTemplate, overrides);
  useLayoutEffect(() => {
    // Duplicates retain the component markup. Only their outer layer participates in editing.
    for (const wrapper of Array.from(root.current?.querySelectorAll<HTMLElement>("[data-duplicate]") ?? [])) {
      const child = wrapper.firstElementChild as HTMLElement | null;
      if (!child) continue;
      child.style.left = "0"; child.style.top = "0"; child.style.position = "relative";
      if (value.layers[wrapper.dataset.layer!]?.source === "badge-row") child.style.height = "66px";
      for (const nested of Array.from(wrapper.querySelectorAll<HTMLElement>("[data-layer]"))) nested.removeAttribute("data-layer");
    }
    for (const element of Array.from(root.current?.querySelectorAll<HTMLElement>("[data-layer]") ?? [])) {
      const patch = value.layers[element.dataset.layer!] ?? {};
      element.style.translate = `${patch.x ?? 0}px ${patch.y ?? 0}px`;
      element.style.scale = String(patch.scale ?? 1);
      element.style.transformOrigin = "top left";
      element.style.zIndex = patch.z === undefined ? "" : String(patch.z);
      element.style.visibility = patch.hidden ? "hidden" : "";
      if (element.dataset.layer === "background" || element.dataset.layer === "badge-row") continue;
      const old = filters.current.get(element);
      const base = old?.applied === element.style.filter ? old.base : element.style.filter;
      const parentRow = element.parentElement?.dataset.layer === "badge-row" ? value.layers["badge-row"]?.shadow : undefined;
      const shadow = patch.shadow === undefined ? parentRow === undefined ? value.dropShadow : parentRow : patch.shadow;
      const applied = [base, shadow ? `drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color})` : ""].filter(Boolean).join(" ");
      element.style.filter = applied;
      // CSS normalizes colors and lengths. Compare against the value the browser retained.
      filters.current.set(element, { base, applied: element.style.filter });
    }
  }, [value, template]);
  return <div ref={root} className="thumbnail-scene" style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
    <Thumbnail data={data} template={template} accentRange={value.accentRange} />
    {value.customTexts.map(id => {
      const layer = value.layers[id] ?? {};
      if (layer.source) {
        const sourceId = layer.source;
        const duplicateTemplate = applyOverrides(value.template === "cute" ? cuteTemplate : referenceTemplate, {
          accent: value.accent, twitchVisible: true, layers: { [sourceId]: layer },
          textOverrides: layer.text === undefined ? {} : { [textKeys[sourceId] ?? sourceId]: layer.text },
          colorOverrides: layer.color ? { [sourceId]: layer.color } : {},
          fontSizeOverrides: layer.fontSize ? { [sourceId]: layer.fontSize } : {},
        });
        return <div key={id} data-layer={id} data-duplicate style={{ position: "absolute", left: 0, top: 0, width: "max-content" }}>
          <Thumbnail data={data} template={duplicateTemplate} onlyLayer={sourceId} layerId={id} />
        </div>;
      }
      return <TextLayer key={id} testId={id} config={{
        visible: true, x: 420, y: 320, width: 500, maxWidth: 500,
        fontSize: layer.fontSize ?? 54,
        glow: layer.glow ?? undefined,
        fontWeight: layer.fontWeight ?? 700,
        fontFamily: layer.fontFamily === "fredoka" ? '"Fredoka", sans-serif' : layer.fontFamily === "montserrat" ? '"Montserrat", sans-serif' : '"Baloo 2", sans-serif',
        color: layer.color ?? "#ffffff",
        gradient: layer.gradient ? `linear-gradient(180deg, ${layer.gradient.from}, ${layer.gradient.to})` : undefined,
      }}>{layer.text ?? "Your text"}</TextLayer>;
    })}
  </div>;
}
