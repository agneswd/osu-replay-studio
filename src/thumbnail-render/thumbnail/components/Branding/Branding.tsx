import { textEffects } from "../Text/effects";
import { EditableText, useEditingText } from "../../../editable-text.js";
import { fitFontSize } from "../Text/fit";
import type { CSSProperties, ReactNode } from "react";
import { resolveAssetUrl } from "../../../shared/assets/assetUrl";
import type { TwitchLogoConfig, BottomMessageConfig } from "../../types";
import { layerStyle } from "../Layer";
import { softGlow, TEXT_SHADOW_3D } from "../../../shared/formatting/color";
export function TwitchLogo({ config }: {
    config: TwitchLogoConfig;
}) {
    if (!config.visible)
        return null;
    const asset = resolveAssetUrl(config.asset);
    return (<div style={layerStyle(config, {
            width: config.size,
            height: config.size,
            borderRadius: config.radius,
            border: config.border && config.borderMode !== "bottom" ? `${config.border.width}px solid ${config.border.color}` : undefined,
            borderBottom: config.border && config.borderMode === "bottom" ? `${config.border.width}px solid ${config.border.color}` : undefined,
            background: config.background,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        })} data-layer="twitch-logo">
      {asset ? (<img src={asset} alt="Twitch" style={{
                width: "58%",
                height: "58%",
                filter: config.tint ? "none" : "brightness(0) invert(1)",
            }}/>) : null}
    </div>);
}
export function BottomMessage({ text, accentRange, config, testId = "bottom-message", }: {
    text: string;
    testId?: string;
    accentRange?: { start: number; end: number };
    config: BottomMessageConfig;
}) {
    const editing = useEditingText(testId);
    if (!config.visible || (text === "" && !editing))
        return null;
    const glow = config.highlightedGlow
        ? softGlow(config.highlightedGlow.color ?? config.highlightedColor, config.highlightedGlow.blur, config.highlightedGlow.layers ?? 3)
        : undefined;
    const accentStyle: CSSProperties = {
        color: config.highlightedColor,
        textShadow: [glow, TEXT_SHADOW_3D].filter(Boolean).join(", "),
    };
    let content: ReactNode;
    const effect = textEffects(config, config.prefixColor);
    const index = accentRange?.start ?? -1;
    const end = accentRange?.end ?? -1;
    const accentPart = text.slice(index, end);
    if (accentPart && index >= 0 && end <= text.length) {
        content = (<>
        <span style={{ color: config.prefixColor, ...effect }}>{text.slice(0, index)}</span>
        <span style={accentStyle}>{accentPart}</span>
        <span style={{ color: config.prefixColor, ...effect }}>{text.slice(index + accentPart.length)}</span>
      </>);
    }
    else {
        content = <span style={{ color: config.prefixColor, ...effect }}>{text}</span>;
    }
    return (<EditableText id={testId} onInput={event => {
        // Text edits clear the accent range without replacing the caret's text nodes.
        for (const span of Array.from(event.currentTarget.querySelectorAll("span"))) {
            span.style.color = "inherit"; span.style.textShadow = "inherit";
        }
    }} style={layerStyle(config, {
            width: config.width,
            textAlign: "center",
            color: config.prefixColor,
            textShadow: TEXT_SHADOW_3D,
            fontFamily: config.fontFamily,
            fontSize: config.width ? fitFontSize(text, config, config.width, 12) : config.fontSize,
            fontWeight: config.fontWeight,
            letterSpacing: config.letterSpacing,
            ...effect,
            whiteSpace: "pre",
        })} data-layer={testId}>
      {content}
    </EditableText>);
}
