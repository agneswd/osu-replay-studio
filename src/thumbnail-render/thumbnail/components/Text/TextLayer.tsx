import type { CSSProperties } from "react";
import type { TextLayerConfig } from "../../types";
import { fitFontSize } from "./fit";
import { softGlow, TEXT_SHADOW_3D } from "../../../shared/formatting/color";
export function TextLayer({ config, children, testId, }: {
    config: TextLayerConfig;
    children: string;
    testId?: string;
}) {
    if (!config.visible || children === "")
        return null;
    const fitWidth = config.maxWidth ?? config.width;
    const fitText = config.maxLines
        ? children.split("\n").reduce((longest, line) => line.length > longest.length ? line : longest, "")
        : children;
    const fontSize = fitWidth !== undefined
        ? fitFontSize(fitText, config, fitWidth, config.maxLines ? 32 : 20)
        : config.fontSize;
    const glow = config.glow
        ? softGlow(config.glow.color ?? config.color, config.glow.blur, config.glow.layers ?? 3)
        : undefined;
    const shadow = config.shadow
        ? `${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color}`
        : TEXT_SHADOW_3D;
    const hasGradient = Boolean(config.gradient);
    const strokeStyle = config.stroke
        ? `${config.stroke.width}px ${config.stroke.color}`
        : undefined;
    const extrusionFilters = config.extrusion
        ? Array.from({ length: config.extrusion.depth }, (_, i) => {
            const step = i + 1;
            const ox = (config.extrusion?.offsetX ?? 1) * step;
            const oy = (config.extrusion?.offsetY ?? 1) * step;
            const col = config.extrusion?.color ?? config.stroke?.color ?? "var(--shadow-color, #06070C)";
            return `drop-shadow(${ox}px ${oy}px 0px ${col})`;
        }).join(" ")
        : "";
    const style: CSSProperties = {
        position: "absolute",
        left: config.x,
        top: config.y,
        width: config.width,
        height: config.height,
        fontFamily: config.fontFamily,
        fontSize,
        fontWeight: config.fontWeight,
        letterSpacing: config.letterSpacing,
        lineHeight: config.lineHeight ?? 1.1,
        color: hasGradient ? undefined : config.color,
        background: config.gradient ?? config.background,
        WebkitBackgroundClip: hasGradient ? "text" : undefined,
        WebkitTextFillColor: hasGradient ? "transparent" : undefined,
        WebkitTextStroke: strokeStyle,
        paintOrder: "stroke fill",
        transform: config.transform,
        transformOrigin: "left center",
        border: config.border,
        borderRadius: config.borderRadius,
        padding: config.padding,
        boxShadow: config.boxShadow,
        textAlign: config.align ?? "left",
        textTransform: config.textTransform ?? "none",
        textShadow: hasGradient ? undefined : [shadow, glow].filter(Boolean).join(", ") || undefined,
        filter: [
            extrusionFilters,
            config.shadow ? `drop-shadow(${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color})` : "",
        ].filter(Boolean).join(" ") || undefined,
        whiteSpace: config.maxLines ? "pre-line" : "pre",
        overflow: config.maxLines ? "hidden" : undefined,
        WebkitBoxOrient: config.maxLines ? "vertical" : undefined,
        WebkitLineClamp: config.maxLines,
        display: config.maxLines ? "-webkit-box" : undefined,
        ...(config.valign === "center" && config.height
            ? { display: "flex", alignItems: "center", justifyContent: config.align === "center" ? "center" : config.align === "right" ? "flex-end" : "flex-start" }
            : {}),
    };
    return (<div style={style} data-layer={testId}>
      {children}
    </div>);
}
