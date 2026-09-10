import type { ReferenceTemplateComponents, ThumbnailTemplate } from "./types";
import type { ThumbnailData } from "../shared/types/thumbnail";
import { mixColors, withAlpha } from "../shared/formatting/color";
import { thumbnailFontFamily, type ThumbnailLayer } from "../../../core/thumbnail-document";
export interface EditorState extends Pick<ThumbnailTemplate,
    "textOverrides" | "positionOverrides" | "sizeOverrides" | "colorOverrides" | "fontSizeOverrides" | "customTexts"> {
    accent?: string;
    twitchVisible?: boolean;
    classicVisible?: boolean;
    sliderBreakCount?: number;
    missCount?: number;
    statusKind?: "fc" | "miss" | "unknown";
    bottomText?: string;
    bottomAccent?: string;
    overlayOpacity?: number;
    dropShadow?: ThumbnailLayer["shadow"];
    layers?: Record<string, ThumbnailLayer>;
}
export function applyDataOverrides(data: ThumbnailData, state: EditorState | undefined): ThumbnailData {
    if (!state)
        return data;
    const missCount = state.missCount !== undefined ? Math.max(0, Math.round(state.missCount)) : data.missCount;
    const sbCount = state.sliderBreakCount !== undefined ? Math.max(0, Math.round(state.sliderBreakCount)) : data.sbCount;
    let status = data.status;
    if (state.statusKind) {
        if (state.statusKind === "fc") {
            status = { kind: "fc" };
        }
        else if (state.statusKind === "miss") {
            status = { kind: "miss", count: Math.max(1, missCount) };
        }
        else {
            status = { kind: "unknown" };
        }
    }
    else if (state.missCount !== undefined || state.sliderBreakCount !== undefined) {
        if (missCount > 0) {
            status = { kind: "miss", count: missCount };
        }
        else if (sbCount > 0) {
            status = { kind: "unknown" };
        }
        else {
            status = { kind: "fc" };
        }
    }
    const isFullCombo = status.kind === "fc" && sbCount === 0 && missCount === 0;
    return {
        ...data,
        mods: state.classicVisible === false
            ? data.mods.filter((mod) => mod.acronym !== "CL")
            : data.mods,
        missCount,
        sbCount,
        status,
        isFullCombo,
    };
}
export const COMPONENT_BY_LAYER: Record<string, keyof ReferenceTemplateComponents> = {
    "top-panel": "topPanel",
    "star-notch": "starNotch",
    status: "status",
    "status-miss": "statusMiss",
    "status-sb": "statusSB",
    "star-rating": "starRating",
    pp: "pp",
    combo: "comboBadge",
    difficulty: "difficultyBadge",
    bpm: "bpmBadge",
    "map-artist": "mapArtist",
    "map-title": "mapTitle",
    grade: "grade",
    accuracy: "accuracy",
    leaderboard: "leaderboard",
    avatar: "avatar",
    "country-flag": "countryFlag",
    username: "usernamePanel",
    "mod-list": "modList",
    "twitch-logo": "twitchLogo",
    "bottom-message": "bottomMessage",
    sparkles: "sparkles",
};
export function applyOverrides(template: ThumbnailTemplate, state: EditorState | undefined): ThumbnailTemplate {
    if (!state || Object.values(state).every((v) => v === undefined)) {
        return template;
    }
    const next = structuredClone(template);
    const { accent, twitchVisible, bottomText, bottomAccent, textOverrides, positionOverrides, sizeOverrides, colorOverrides, fontSizeOverrides, customTexts, overlayOpacity, dropShadow, layers, } = state;
    next.customTexts = structuredClone(customTexts ?? []);
    if (accent) {
        next.theme.accent = accent;
        next.theme.panelBorder = withAlpha(accent, 0.85);
        next.theme.badgeBorder = withAlpha(accent, 1);
        next.components.bottomMessage.highlightedColor = accent;
        next.components.bottomMessage.highlightedGlow = {
            blur: 14,
            layers: 2,
        };
        next.components.topPanel.borderColor = withAlpha(accent, 0.85);
        for (const key of ["comboBadge", "difficultyBadge", "bpmBadge"] as const) {
            next.components[key].borderColor = withAlpha(accent, 1);
        }
        if (next.components.usernamePanel.leftAccent) {
            next.components.usernamePanel.leftAccent = {
                ...next.components.usernamePanel.leftAccent,
                color: mixColors(accent, "#1A0D0F", 0.35) + "D9",
            };
            next.components.usernamePanel.background = `linear-gradient(180deg, ${mixColors(accent, "#1A0D0F", 0.7)}D9 0%, ${mixColors(accent, "#1A0D0F", 0.85)}B3 100%)`;
        }
        if (next.components.sparkles) {
            next.components.sparkles.color = accent;
        }
        const tint = next.background.overlays?.find((overlay) => overlay.boxShadow?.startsWith("inset"));
        if (tint) {
            tint.boxShadow = `inset 0 0 100px ${withAlpha(accent, 0.25)}`;
        }
        if (next.components.innerBorder) {
            next.components.innerBorder.border = `1.5px solid ${withAlpha(accent, 0.55)}`;
        }
        if (next.components.avatar.border) {
            next.components.avatar.border.color = accent;
        }
    }
    if (twitchVisible !== undefined) {
        next.components.twitchLogo.visible = twitchVisible;
    }
    if (bottomText !== undefined) {
        next.dataOptions.bottomPrefix = bottomText;
    }
    if (bottomAccent !== undefined) {
        next.bottomHighlightOverride = bottomAccent === "" ? undefined : bottomAccent;
    }
    if (textOverrides && Object.keys(textOverrides).length > 0) {
        next.textOverrides = { ...next.textOverrides, ...textOverrides };
    }
    if (positionOverrides) {
        next.positionOverrides = { ...next.positionOverrides, ...positionOverrides };
    }
    if (sizeOverrides) {
        next.sizeOverrides = { ...next.sizeOverrides, ...sizeOverrides };
    }
    if (fontSizeOverrides) {
        next.fontSizeOverrides = { ...next.fontSizeOverrides, ...fontSizeOverrides };
    }
    if (colorOverrides) {
        next.colorOverrides = { ...next.colorOverrides, ...colorOverrides };
    }
    if (positionOverrides) {
        for (const [layer, pos] of Object.entries(positionOverrides)) {
            const key = COMPONENT_BY_LAYER[layer];
            const conf = key ? next.components[key] : next.customTexts.find((item) => item.id === layer);
            if (conf) {
                conf.x = Math.round(pos.x);
                conf.y = Math.round(pos.y);
            }
        }
    }
    if (sizeOverrides) {
        for (const [layer, patch] of Object.entries(sizeOverrides)) {
            const key = COMPONENT_BY_LAYER[layer];
            const conf = key ? next.components[key] : next.customTexts.find((item) => item.id === layer);
            if (conf)
                Object.assign(conf, patch);
        }
    }
    for (const [layer, size] of Object.entries(fontSizeOverrides ?? {})) {
        if (layer.startsWith("custom-")) {
            const item = next.customTexts.find((c) => c.id === layer);
            if (item) item.fontSize = size;
            continue;
        }
        const key = COMPONENT_BY_LAYER[layer];
        if (!key || !(key in next.components)) continue;
        const configs = layer === "status"
            ? [next.components[key], next.components.statusMiss]
            : [next.components[key]];
        for (const conf of configs) {
            if (conf && "fontSize" in conf && typeof conf.fontSize === "number") {
                conf.fontSize = size;
                if ("maxWidth" in conf && typeof conf.maxWidth === "number")
                    conf.maxWidth = Math.max(conf.maxWidth, size * 8);
            }
        }
    }
    for (const [layer, color] of Object.entries(colorOverrides ?? {})) {
        if (layer.startsWith("custom-")) {
            const item = next.customTexts.find((c) => c.id === layer);
            if (item) item.color = color;
            continue;
        }
        const key = COMPONENT_BY_LAYER[layer];
        if (!key || !(key in next.components)) continue;
        const conf = next.components[key];
        if (conf) {
            if ("color" in conf) conf.color = color;
            if ("prefixColor" in conf) conf.prefixColor = color;
        }
        if (layer === "status") next.components.statusMiss.color = color;
    }
    if (overlayOpacity !== undefined) {
      for (const overlay of next.background.overlays) {
        if (overlay.kind === "linear-gradient" && overlay.gradient?.startsWith("180deg")) overlay.opacity = overlayOpacity;
      }
    }
    const badges = [next.components.comboBadge, next.components.difficultyBadge, next.components.bpmBadge];
    for (const [id, layer] of Object.entries(layers ?? {})) {
      const conf = id.startsWith("custom-") ? next.customTexts.find(item => item.id === id) : componentOf(next, id);
      if (!conf) continue;
      if (layer.fontWeight !== undefined && "fontWeight" in conf) conf.fontWeight = layer.fontWeight;
      if (layer.fontFamily && "fontFamily" in conf) conf.fontFamily = thumbnailFontFamily[layer.fontFamily];
      if (layer.glow !== undefined && "glow" in conf) conf.glow = layer.glow ? { color: layer.glow.color, blur: layer.glow.blur, layers: 2 } : undefined;
      if (layer.gradient !== undefined && "gradient" in conf) conf.gradient = layer.gradient ? `180deg, ${layer.gradient.from}, ${layer.gradient.to}` : undefined;
      applyLayerShadow(conf, layer.shadow);
      if (layer.borderWidth !== undefined && "borderWidth" in conf) conf.borderWidth = layer.borderWidth;
      if (layer.borderRadius !== undefined) {
        if ("radius" in conf) conf.radius = layer.borderRadius;
        else if ("borderRadius" in conf) conf.borderRadius = layer.borderRadius;
      }
      if (layer.borderMode && "borderMode" in conf) conf.borderMode = layer.borderMode;
    }
    const row = layers?.["badge-row"];
    if (row) for (const badge of badges) {
      if (row.borderWidth !== undefined) badge.borderWidth = row.borderWidth;
      if (row.borderRadius !== undefined) badge.radius = row.borderRadius;
      if (row.borderMode) badge.borderMode = row.borderMode;
      applyLayerShadow(badge, row.shadow);
    }
    if (dropShadow) {
      applyLayerShadow(next.components.topPanel, dropShadow);
      applyLayerShadow(next.components.avatar, dropShadow);
      for (const badge of badges) if (!badge.boxShadow) applyLayerShadow(badge, dropShadow);
      for (const key of ["status", "statusMiss", "mapTitle", "grade", "pp", "accuracy", "leaderboard"] as const)
        applyLayerShadow(next.components[key], dropShadow, true);
    }
    return next;
}
function box(shadow: NonNullable<ThumbnailLayer["shadow"]>) {
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`;
}
function applyLayerShadow(conf: object | undefined, shadow: ThumbnailLayer["shadow"], keepExisting = false) {
  if (!conf || shadow === undefined) return;
  if (shadow === null) {
    if ("boxShadow" in conf) (conf as { boxShadow?: string }).boxShadow = undefined;
    if ("shadow" in conf) (conf as { shadow?: unknown }).shadow = undefined;
    return;
  }
  if ("fontFamily" in conf && "borderWidth" in conf) {
    const badge = conf as { boxShadow?: string };
    if (!keepExisting || !badge.boxShadow) badge.boxShadow = box(shadow);
    return;
  }
  if ("fontFamily" in conf && "fontSize" in conf) {
    const text = conf as { shadow?: { offsetX: number; offsetY: number; blur: number; color: string } };
    if (!keepExisting || !text.shadow) text.shadow = { offsetX: shadow.x, offsetY: shadow.y, blur: shadow.blur, color: shadow.color };
    return;
  }
  if ("shadow" in conf) {
    const panel = conf as { shadow?: { x: number; y: number; blur: number; color: string } };
    if (!keepExisting || !panel.shadow) panel.shadow = { x: shadow.x, y: shadow.y, blur: shadow.blur, color: shadow.color };
  }
}
function componentOf(template: ThumbnailTemplate, id: string) {
  const key = COMPONENT_BY_LAYER[id];
  return key ? template.components[key] : undefined;
}
