import type { CSSProperties, ReactNode } from "react";
import type { BottomMessageConfig } from "../../types";
import { layerStyle } from "../Layer";
import { softGlow, TEXT_SHADOW_3D } from "../../../shared/formatting/color";
export function BottomMessage({ text, accentPart, config, }: {
    text: string;
    accentPart?: string;
    config: BottomMessageConfig;
}) {
    if (!config.visible || text === "")
        return null;
    const glow = config.highlightedGlow
        ? softGlow(config.highlightedGlow.color ?? config.highlightedColor, config.highlightedGlow.blur, config.highlightedGlow.layers ?? 3)
        : undefined;
    const accentStyle: CSSProperties = {
        color: config.highlightedColor,
        textShadow: [glow, TEXT_SHADOW_3D].filter(Boolean).join(", "),
    };
    let content: ReactNode;
    const index = accentPart ? text.indexOf(accentPart) : -1;
    if (accentPart && index >= 0) {
        content = (<>
        <span style={{ color: config.prefixColor, textShadow: TEXT_SHADOW_3D }}>{text.slice(0, index)}</span>
        <span style={accentStyle}>{accentPart}</span>
        <span style={{ color: config.prefixColor, textShadow: TEXT_SHADOW_3D }}>{text.slice(index + accentPart.length)}</span>
      </>);
    }
    else {
        content = <span style={{ color: config.prefixColor, textShadow: TEXT_SHADOW_3D }}>{text}</span>;
    }
    return (<div style={layerStyle(config, {
            width: config.width,
            textAlign: "center",
            fontFamily: config.fontFamily,
            fontSize: config.fontSize,
            fontWeight: config.fontWeight,
            letterSpacing: config.letterSpacing,
            whiteSpace: "pre",
        })} data-layer="bottom-message">
      {content}
    </div>);
}
