import type { ReferenceTemplateComponents, ThumbnailTemplate } from "./types";
import type { ThumbnailData } from "../shared/types/thumbnail";
import { mixColors, withAlpha } from "../shared/formatting/color";
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
    const { accent, twitchVisible, bottomText, bottomAccent, textOverrides, positionOverrides, sizeOverrides, colorOverrides, fontSizeOverrides, customTexts, } = state;
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
    return next;
}
